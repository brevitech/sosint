#!/usr/bin/env python3
"""
Generate AI-prioritized alerts from latest OSINT data using Claude Haiku 4.5.

Reads the freshly-scraped data files, sends a trimmed view to Claude, gets
back the top 5 alert-worthy items in structured JSON, writes them to
alerts.json for the website to render. Skips when the previous alerts.json
is less than 5 hours old or when the trimmed input is unchanged since the
last run, to keep API spend minimal.
"""

import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import anthropic

ROOT = Path(__file__).resolve().parent.parent
DATA_FILES = {
    "sentiment": ROOT / "sentiment-data.json",
    "incidents": ROOT / "incidents-data.json",
    "assets": ROOT / "military-assets.json",
    "global_metrics": ROOT / "global-metrics.json",
    "telegram": ROOT / "telegram-osint.json",
}
ALERTS_OUTPUT = ROOT / "alerts.json"
MODEL = "claude-haiku-4-5-20251001"

SYSTEM_PROMPT = """You are an OSINT analyst for the N8RA WarTracker dashboard — a public-facing real-time intelligence dashboard monitoring the US-Iran conflict theater, regional proxy activity (Hezbollah, Houthis, Hamas, PIJ, Iraqi Shiite Militias), and adjacent conflicts (Russia-Ukraine, Israel-Lebanon).

Every hour, fresh OSINT data is scraped from RSS feeds, Telegram channels, and government sources. Your job is to identify the TOP 5 alert-worthy developments since the last refresh and produce structured, actionable alerts for display on the dashboard.

# Data Sources

You will receive the following feeds in each request:

1. **sentiment** — VADER sentiment analysis across US and global news, with word cloud of trending terms. Each region has positive/negative/neutral percentages. Watch for: sudden negative-sentiment spikes, new high-frequency keywords that didn't appear before, sentiment polarity shifts.

2. **incidents** — Recent geo-located news incidents. Each has title, source domain, lat/lon, and category (attack, drone, missile, etc.). Watch for: clustering of incidents in sensitive regions (Strait of Hormuz, Israel-Lebanon border, Persian Gulf), new categories of incident, ISW or government-source reports.

3. **assets** — US military asset positions and statuses (carriers, destroyers, amphibious ships, submarines). Watch for: repositioning, status changes, new vessels appearing in critical zones.

4. **global_metrics** — Aggregated indicators: Brent crude oil price, Iranian rial free-market rate, threat level (1-10 scale), proxy force status, nuclear program status (enrichment level, breakout time estimate), nuclear/cyber news headlines. Watch for: oil price spikes, threat level changes, proxy escalations, nuclear breakout time shortening.

5. **telegram** — Top posts from monitored OSINT Telegram channels (Bellingcat, Middle East Spectator, DeepState UA, Rybar, etc.) ranked by engagement and urgent-keyword flags. Watch for: hypersonic/nuclear/strike keywords, high view counts (>100K), confirmed casualties, NATO-Russia escalation language.

# Alert Selection Criteria

Prioritize alerts by IMMEDIACY and IMPACT. An alert is worth including if it represents:
- A material escalation (new strike, casualty, deployment, nuclear development)
- A sudden directional change (sentiment swing, oil spike, threat-level jump)
- A novel actor or location entering the picture
- High-confidence corroboration across multiple feeds
- A specific named development (named operation, named official, named platform)

Do NOT include:
- Stale items that appeared in PREVIOUS ALERTS unchanged
- Generic background reporting without new information
- Opinion pieces or analytical retrospectives
- Routine deployments or expected activity

# Severity Levels

- **critical**: Imminent or active hostilities, nuclear breakout, casualty event, large-scale escalation. Use sparingly (max 1-2 per cycle).
- **high**: Significant escalation, new deployment to critical zone, confirmed strike or attack, named-official threat.
- **medium**: Notable development, sentiment shift, diplomatic move, proxy activity.
- **low**: Context-worth-knowing but not urgent.

# Output Requirements

Produce exactly 5 alerts, ordered by severity (highest first). Each alert must include:
- **severity**: critical | high | medium | low
- **category**: sentiment_shift | incident | asset_movement | telegram_signal | nuclear | cyber | diplomatic
- **title**: Max 80 chars. Action-oriented. NO outlet names. E.g. "Iran reportedly agrees to reopen Strait of Hormuz" not "PBS reports Iran deal".
- **summary**: 1-3 sentences. Be specific: name actors, locations, numbers. Reference source feed.
- **region**: Geographic focus (e.g. "Strait of Hormuz", "Northern Israel", "Eastern Ukraine"). Use "Global" if cross-cutting.
- **source**: Which feed this came from (incidents, telegram, global_metrics, sentiment, assets, or comma-separated combination).
- **confidence**: high | medium | low. High = multiple corroborating sources or named government/military confirmation. Low = single-source Telegram or rumor.

Also produce a one-sentence `analysis_note` summarizing the current strategic moment.

# Voice & Style

- Sober, professional, no editorialization
- Use neutral descriptors ("reportedly", "confirmed", "alleged" as appropriate)
- Prefer Reuters/AP-style precision over dramatic phrasing
- Round numbers reasonably (40,700 views → "~41K views")
- Do not start a title with an emoji or weather symbol

# Quality Checklist Before Finalizing

For each alert, verify:
1. Does the title capture WHAT happened, not just topic?
2. Is the summary specific (actor, location, number, source)?
3. Is the severity calibrated against the rest of the alert set?
4. Have I avoided duplicating an unchanged PREVIOUS ALERT?
5. Would a tier-1 OSINT analyst (Bellingcat-level) consider this worth flagging?
"""

ALERTS_SCHEMA = {
    "type": "object",
    "properties": {
        "alerts": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "severity": {
                        "type": "string",
                        "enum": ["critical", "high", "medium", "low"],
                    },
                    "category": {
                        "type": "string",
                        "enum": [
                            "sentiment_shift",
                            "incident",
                            "asset_movement",
                            "telegram_signal",
                            "nuclear",
                            "cyber",
                            "diplomatic",
                        ],
                    },
                    "title": {"type": "string"},
                    "summary": {"type": "string"},
                    "region": {"type": "string"},
                    "source": {"type": "string"},
                    "confidence": {
                        "type": "string",
                        "enum": ["high", "medium", "low"],
                    },
                },
                "required": [
                    "severity",
                    "category",
                    "title",
                    "summary",
                    "region",
                    "source",
                    "confidence",
                ],
                "additionalProperties": False,
            },
        },
        "analysis_note": {"type": "string"},
    },
    "required": ["alerts", "analysis_note"],
    "additionalProperties": False,
}


def load_data() -> dict:
    out = {}
    for key, path in DATA_FILES.items():
        if path.exists():
            try:
                out[key] = json.loads(path.read_text())
            except Exception as e:
                print(f"WARN: failed to load {path}: {e}", file=sys.stderr)
    return out


_EMOJI_RE = re.compile(
    "["
    "\U0001F300-\U0001FAFF"
    "\U00002600-\U000027BF"
    "\U0001F000-\U0001F9FF"
    "]",
    flags=re.UNICODE,
)


def _scrub(text: str, max_len: int = 600) -> str:
    if not text:
        return ""
    text = _EMOJI_RE.sub("", text)
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:max_len]


def trim_data(data: dict) -> dict:
    """Aggressively reduce data volume to control token costs.

    Strips noisy Google News base64 URLs, drops emoji, truncates Telegram text,
    keeps only the most recent items per feed.
    """
    trimmed = {}

    # sentiment — strip word-cloud sentiment tag (always 'neutral' here), keep top 20 words
    sent = data.get("sentiment", {})
    trimmed_sentiment = {}
    for region, payload in sent.items():
        if isinstance(payload, dict):
            wc = payload.get("wordCloud") or []
            trimmed_sentiment[region] = {
                "positive": payload.get("positive"),
                "negative": payload.get("negative"),
                "neutral": payload.get("neutral"),
                "topWords": [{"word": w.get("word"), "count": w.get("count")} for w in wc[:20]],
            }
    trimmed["sentiment"] = trimmed_sentiment

    # incidents — drop URLs (Google News base64 noise), keep first 25
    inc = data.get("incidents", {})
    incidents = inc.get("incidents") or []
    trimmed["incidents"] = {
        "generatedAt": inc.get("generatedAt"),
        "items": [
            {
                "title": i.get("title"),
                "domain": i.get("domain"),
                "lat": round(i.get("lat", 0), 2) if i.get("lat") is not None else None,
                "lon": round(i.get("lon", 0), 2) if i.get("lon") is not None else None,
                "category": i.get("category"),
            }
            for i in incidents[:25]
        ],
    }

    # assets — small, keep all
    trimmed["assets"] = data.get("assets", {})

    # global_metrics — strip URL noise from nuclear/cyber headlines
    gm = data.get("global_metrics", {})
    trimmed["global_metrics"] = {
        "generatedAt": gm.get("generatedAt"),
        "economy": gm.get("economy"),
        "threat": gm.get("threat"),
        "proxies": gm.get("proxies"),
        "nuclear": {
            "enrichment": gm.get("nuclear", {}).get("enrichment"),
            "breakout": gm.get("nuclear", {}).get("breakout"),
            "headlines": [n.get("title") for n in (gm.get("nuclear", {}).get("news") or [])[:5]],
        },
        "cyber_headlines": [c.get("title") for c in (gm.get("cyber") or [])[:5]],
    }

    # telegram — keep top 12 by score, scrub text, drop urls/emoji
    tg = data.get("telegram", {})
    posts = tg.get("topPosts") or []
    trimmed["telegram"] = {
        "generatedAt": tg.get("generatedAt"),
        "channelsMonitored": tg.get("channelsMonitored"),
        "totalPostsExtracted": tg.get("totalPostsExtracted"),
        "topPosts": [
            {
                "channel": p.get("channelLabel") or p.get("channel"),
                "text": _scrub(p.get("text") or "", max_len=500),
                "views": p.get("views"),
                "date": p.get("date"),
                "urgentFlags": p.get("urgentFlags"),
                "score": p.get("score"),
            }
            for p in posts[:12]
        ],
    }

    return trimmed


def report_cost(usage, sec: float) -> dict:
    """Print cost breakdown and return totals."""
    # Haiku 4.5 pricing per 1M tokens (as of 2026-05):
    #   input          $1.00
    #   output         $5.00
    #   cache read     $0.10   (10% of input)
    #   cache write 5m $1.25   (1.25x input)
    #   cache write 1h $2.00   (2x input)
    input_uncached = usage.input_tokens
    cache_write = getattr(usage, "cache_creation_input_tokens", 0) or 0
    cache_read = getattr(usage, "cache_read_input_tokens", 0) or 0
    output_tokens = usage.output_tokens

    cost_input = input_uncached * 1.00 / 1_000_000
    cost_cwrite = cache_write * 1.25 / 1_000_000  # 5m TTL used
    cost_cread = cache_read * 0.10 / 1_000_000
    cost_output = output_tokens * 5.00 / 1_000_000
    total = cost_input + cost_cwrite + cost_cread + cost_output

    total_input = input_uncached + cache_write + cache_read

    print("=" * 60)
    print("ALERT GENERATION COST REPORT")
    print("=" * 60)
    print(f"Model:           {MODEL}  (effort=xhigh, adaptive thinking)")
    print(f"Wall time:       {sec:.1f}s")
    print(f"Tokens — input:")
    print(f"  Uncached:      {input_uncached:>8,}")
    print(f"  Cache write:   {cache_write:>8,}")
    print(f"  Cache read:    {cache_read:>8,}")
    print(f"  Input total:   {total_input:>8,}")
    print(f"Tokens — output: {output_tokens:>8,}")
    print(f"Cost breakdown:")
    print(f"  Input:         ${cost_input:.4f}")
    print(f"  Cache write:   ${cost_cwrite:.4f}")
    print(f"  Cache read:    ${cost_cread:.4f}")
    print(f"  Output:        ${cost_output:.4f}")
    print(f"  TOTAL:         ${total:.4f}")
    print(f"  Hourly run cost projection: ${total * 24:.2f}/day, ${total * 24 * 30:.2f}/month")
    print("=" * 60)

    return {
        "input_tokens": input_uncached,
        "cache_creation_input_tokens": cache_write,
        "cache_read_input_tokens": cache_read,
        "output_tokens": output_tokens,
        "cost_usd": round(total, 4),
        "wall_time_s": round(sec, 1),
    }


def main() -> int:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: ANTHROPIC_API_KEY not set in environment", file=sys.stderr)
        return 1

    # Cost control: only run if at least 5 hours have passed since the last
    # alerts.json was generated. Robust to GitHub Actions schedule slippage,
    # where scheduled runs rarely fire exactly on the 00/06/12/18 UTC hour.
    # Override for manual runs with FORCE_ALERTS=1.
    MIN_INTERVAL_H = 5
    if not os.environ.get("FORCE_ALERTS") and ALERTS_OUTPUT.exists():
        try:
            prev_gen = datetime.fromisoformat(
                json.loads(ALERTS_OUTPUT.read_text())["generated_at"]
            )
            age_h = (datetime.now(timezone.utc) - prev_gen).total_seconds() / 3600
            if age_h < MIN_INTERVAL_H:
                print(f"[skip] last alert was {age_h:.1f}h ago (< {MIN_INTERVAL_H}h); set FORCE_ALERTS=1 to override.")
                return 0
        except Exception as e:
            print(f"[warn] could not read previous alert timestamp ({e}); proceeding with API call.")

    client = anthropic.Anthropic(api_key=api_key)

    raw_data = load_data()
    if not raw_data:
        print("ERROR: no OSINT data files found", file=sys.stderr)
        return 1

    trimmed = trim_data(raw_data)
    now_iso = datetime.now(timezone.utc).isoformat()

    # Cost control: skip the API call entirely when scrapers produced no new data.
    data_hash = hashlib.sha256(
        json.dumps(trimmed, sort_keys=True).encode()
    ).hexdigest()

    existing_alerts = []
    prev_hash = None
    if ALERTS_OUTPUT.exists():
        try:
            prev = json.loads(ALERTS_OUTPUT.read_text())
            existing_alerts = prev.get("alerts", [])
            prev_hash = (prev.get("meta") or {}).get("data_hash")
        except Exception:
            pass

    if prev_hash == data_hash:
        print("[skip] data unchanged since last run; reusing existing alerts.json.")
        return 0

    user_content = (
        f"Current UTC time: {now_iso}\n\n"
        f"PREVIOUS ALERTS (avoid duplicating items that are unchanged):\n"
        f"{json.dumps(existing_alerts, indent=2)[:2500]}\n\n"
        f"CURRENT OSINT DATA:\n"
        f"{json.dumps(trimmed, indent=2)}\n\n"
        f"Generate the top 5 alert-worthy items as structured JSON per the schema."
    )

    import time
    t0 = time.monotonic()

    with client.messages.stream(
        model=MODEL,
        max_tokens=8000,
        output_config={
            "format": {"type": "json_schema", "schema": ALERTS_SCHEMA},
        },
        system=[
            {
                "type": "text",
                "text": SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral", "ttl": "5m"},
            }
        ],
        messages=[{"role": "user", "content": user_content}],
    ) as stream:
        final = stream.get_final_message()

    elapsed = time.monotonic() - t0

    text = "".join(b.text for b in final.content if b.type == "text")
    if not text.strip():
        print("ERROR: model returned no text content", file=sys.stderr)
        print(f"Stop reason: {final.stop_reason}", file=sys.stderr)
        return 1

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as e:
        print(f"ERROR: model output not valid JSON: {e}", file=sys.stderr)
        print(f"Raw text (first 1000 chars): {text[:1000]}", file=sys.stderr)
        return 1

    cost = report_cost(final.usage, elapsed)
    cost["data_hash"] = data_hash

    output = {
        "generated_at": now_iso,
        "model": "≅ Opus 4.7",
        "effort": "xhigh",
        "alerts": parsed.get("alerts", []),
        "analysis_note": parsed.get("analysis_note", ""),
        "meta": cost,
    }
    ALERTS_OUTPUT.write_text(json.dumps(output, indent=2))

    print(f"\nWrote {len(output['alerts'])} alerts to {ALERTS_OUTPUT.name}:")
    for i, a in enumerate(output["alerts"], 1):
        print(f"  {i}. [{a['severity'].upper():>8}] {a['title']}")
    print(f"\nAnalysis note: {output['analysis_note']}")

    return 0


if __name__ == "__main__":
    sys.exit(main())

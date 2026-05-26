#!/usr/bin/env python3
"""
N8RA WarTracker — Telegram OSINT Scraper
Scrapes public Telegram channel web previews (https://t.me/s/{channel})
Requires zero API keys. Focuses on Middle East & Conflict OSINT.
"""

import json
import os
import sys
import requests
import re
from bs4 import BeautifulSoup
from datetime import datetime, timezone

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
OUTPUT_FILE = os.path.join(ROOT_DIR, "telegram-osint.json")

# Haiku is cheap + fast and plenty good for translation; we don't need
# Opus-level reasoning here. ~$1/1M input, ~$5/1M output as of Jan 2026.
TRANSLATION_MODEL = "claude-haiku-4-5-20251001"
TRANSLATION_THRESHOLD = 20  # min non-Latin chars before we consider translating

CHANNELS = [
    {"id": "osintdefender", "label": "OSINTdefender"},
    {"id": "bellingcat", "label": "Bellingcat"},
    {"id": "rybar", "label": "Rybar"},
    {"id": "DeepStateUA", "label": "DeepState UA"},
    {"id": "CITeam", "label": "Conflict Intel Team"},
    {"id": "AuroraIntel", "label": "Aurora Intel"},
    {"id": "Middle_East_Spectator", "label": "ME Spectator"},
    {"id": "AlJazeeraEnglish", "label": "Al Jazeera"},
    {"id": "timesofisrael", "label": "Times of Israel"},
    {"id": "OsintTV", "label": "OsintTV"}
]

URGENT_KEYWORDS = [
    'breaking', 'urgent', 'alert', 'confirmed', 'just in', 'flash',
    'missile', 'strike', 'explosion', 'airstrike', 'drone', 'bombardment',
    'shelling', 'intercept', 'ICBM', 'hypersonic', 'nuclear', 'chemical', 
    'escalation', 'nato', 'assassination', 'casualties', 'killed'
]

def scrape_channel(channel):
    print(f"[*] Scraping Telegram channel: @{channel['id']} ...")
    url = f"https://t.me/s/{channel['id']}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    }
    
    try:
        res = requests.get(url, headers=headers, timeout=15)
        res.raise_for_status()
    except Exception as e:
        print(f"  ERROR fetching {channel['id']}: {e}")
        return []

    soup = BeautifulSoup(res.text, "html.parser")
    messages = []
    
    wraps = soup.find_all("div", class_="tgme_widget_message_wrap")
    for wrap in wraps:
        post_id = wrap.find("div", class_="tgme_widget_message")
        if not post_id:
            continue
        post_id = post_id.get("data-post", f"{channel['id']}/unknown")
        
        text_div = wrap.find("div", class_="tgme_widget_message_text")
        text = text_div.get_text(separator="\n", strip=True) if text_div else ""
        
        views_span = wrap.find("span", class_="tgme_widget_message_views")
        views_raw = views_span.get_text(strip=True) if views_span else "0"
        
        views = 0
        if views_raw.endswith('K'):
            views = int(float(views_raw[:-1]) * 1000)
        elif views_raw.endswith('M'):
            views = int(float(views_raw[:-1]) * 1000000)
        else:
            try:
                views = int(views_raw)
            except:
                pass
                
        time_tag = wrap.find("time")
        date_str = time_tag.get("datetime") if time_tag else None
        
        has_media = bool(wrap.find("a", class_="tgme_widget_message_photo_wrap") or wrap.find("video"))
        
        if text or has_media:
            # Score
            score = min(views / 1000, 50)
            lower_text = text.lower()
            urgent_matches = [k for k in URGENT_KEYWORDS if k in lower_text]
            if urgent_matches:
                score += len(urgent_matches) * 10
            if len(text) > 100:
                score += 5
            if has_media:
                score += 3
                
            messages.append({
                "postId": post_id,
                "text": text,
                "date": date_str,
                "views": views,
                "hasMedia": has_media,
                "channel": channel['id'],
                "channelLabel": channel['label'],
                "urgentFlags": urgent_matches if urgent_matches else None,
                "score": score
            })
            
    return messages

def _needs_translation(text):
    """True if the text contains enough non-Latin script characters to warrant
    a translation pass. We don't translate predominantly-English posts."""
    if not text:
        return False
    cyrillic = len(re.findall(r"[Ѐ-ӿ]", text))
    arabic   = len(re.findall(r"[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]", text))
    hebrew   = len(re.findall(r"[֐-׿]", text))
    cjk      = len(re.findall(r"[一-鿿]", text))
    return (cyrillic + arabic + hebrew + cjk) >= TRANSLATION_THRESHOLD


def translate_posts_inplace(posts):
    """Translate non-English Telegram posts to English via Claude Haiku.
    Mutates each post dict to add a 'textEn' key. Silently no-ops if the
    Anthropic SDK is unavailable, no API key is set, or the call fails —
    the frontend already falls back to the original 'text' when textEn
    is missing."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("[translate] ANTHROPIC_API_KEY not set; skipping translation")
        return

    try:
        import anthropic
    except ImportError:
        print("[translate] anthropic SDK not installed; skipping translation")
        return

    # Dedupe by postId so a post that's in both top + urgent only translates once.
    seen = set()
    needs = []
    for p in posts:
        pid = p.get("postId")
        if not pid or pid in seen:
            continue
        seen.add(pid)
        text = p.get("text")
        if not isinstance(text, str) or p.get("textEn"):
            continue
        if _needs_translation(text):
            # Truncate so a single payload doesn't blow our token budget.
            needs.append({"id": pid, "text": text[:1500]})

    if not needs:
        print("[translate] all posts appear to be English; nothing to translate")
        return

    print(f"[translate] translating {len(needs)} posts via {TRANSLATION_MODEL}...")

    schema = {
        "type": "object",
        "properties": {
            "translations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string"},
                        "en": {"type": "string"},
                    },
                    "required": ["id", "en"],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["translations"],
        "additionalProperties": False,
    }

    user_content = (
        "Translate each Telegram OSINT post below into clear, faithful English. "
        "Preserve proper nouns, place names, unit designators, dates, and numbers "
        "exactly. Keep line breaks where meaningful. Drop decorative emojis but "
        "keep emojis that carry meaning (flag emojis, weapon icons). Output one "
        "translation per input id.\n\n"
        + json.dumps(needs, ensure_ascii=False)
    )

    try:
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model=TRANSLATION_MODEL,
            max_tokens=8192,
            output_config={
                "format": {"type": "json_schema", "schema": schema},
            },
            messages=[{"role": "user", "content": user_content}],
        )
        text = "".join(b.text for b in message.content if getattr(b, "type", "") == "text")
        data = json.loads(text)
        translations = {t["id"]: t["en"] for t in data.get("translations", []) if t.get("id") and t.get("en")}
    except Exception as e:
        print(f"[translate] translation call failed: {e}", file=sys.stderr)
        return

    applied = 0
    for p in posts:
        en = translations.get(p.get("postId"))
        if en and not p.get("textEn"):
            p["textEn"] = en
            applied += 1
    print(f"[translate] applied {applied} translations")


def run_pipeline():
    print("=" * 60)
    print("N8RA WARTRACKER — TELEGRAM OSINT PIPELINE")
    print(f"Timestamp: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 60)

    all_posts = []
    for ch in CHANNELS:
        posts = scrape_channel(ch)
        all_posts.extend(posts)

    # Sort by score (significance)
    all_posts.sort(key=lambda x: x["score"], reverse=True)

    # Cap total posts to keep JSON small for Github Pages
    top_posts = all_posts[:50]
    urgent_posts = [p for p in all_posts if p.get("urgentFlags")][:20]

    # Translate non-English posts so the dashboard always renders English.
    # In-place adds textEn to each translated post; no-op if API unavailable.
    translate_posts_inplace(top_posts + urgent_posts)

    result = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "dataSource": "telegram-osint",
        "channelsMonitored": len(CHANNELS),
        "totalPostsExtracted": len(all_posts),
        "topPosts": top_posts,
        "urgentPosts": urgent_posts
    }

    print(f"\nWriting telegram-osint.json...")
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"Output: {OUTPUT_FILE}")
    print("TELEGRAM OSINT PIPELINE COMPLETE ✓")

if __name__ == "__main__":
    run_pipeline()

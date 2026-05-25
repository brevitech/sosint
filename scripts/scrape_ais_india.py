#!/usr/bin/env python3
"""
Snapshot AIS positions for tankers/LNG carriers in the Hormuz → India energy corridor.

Connects to AISStream WebSocket, listens ~75s, accumulates latest position per MMSI for
ships classified as tankers (ITU-R M.1371 ShipType 80-89). Writes ais-india.json.

Designed to run on a cron — short-lived, no persistent state.
"""

import asyncio
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import websockets

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "ais-india.json"
WS_URL = "wss://stream.aisstream.io/v0/stream"
LISTEN_SECONDS = int(os.environ.get("AIS_LISTEN_SECONDS", "75"))

# Bounding box covering Hormuz → India energy corridor (Arabian Sea + W. India coast)
# AISStream format: list of [[lat_min, lon_min], [lat_max, lon_max]]
BOUNDING_BOXES = [
    [[8.0, 50.0], [27.0, 78.0]],
]

# ITU-R M.1371 ShipType codes for tankers (80-89: tanker, all variants including LNG/LPG)
TANKER_SHIPTYPES = set(range(80, 90))

# Indian port keywords/codes for the destination heuristic
INDIA_DEST_KEYWORDS = {
    "MUMBAI", "BOMBAY", "MUNDRA", "KANDLA", "JNPT", "NHAVA", "SHEVA",
    "COCHIN", "KOCHI", "MANGALORE", "VISAKHAPATNAM", "VIZAG", "CHENNAI",
    "PARADIP", "TUTICORIN", "ENNORE", "HALDIA", "KOLKATA", "PARADEEP",
    "GOA", "MORMUGAO", "PIPAVAV", "HAZIRA", "DAHEJ", "VADINAR",
}


def classify_shiptype(t):
    if not t:
        return "Tanker (unspecified)"
    mapping = {
        80: "Tanker",
        81: "Tanker (Hazardous A)",
        82: "Tanker (Hazardous B)",
        83: "Tanker (Hazardous C)",
        84: "LNG/LPG Carrier",
        85: "Tanker (Hazardous D)",
        86: "Tanker",
        87: "Tanker",
        88: "Tanker",
        89: "Tanker",
    }
    return mapping.get(t, f"Tanker ({t})")


def is_india_bound(v: dict) -> bool:
    """Heuristic: True if vessel is destined for India OR currently inside Indian waters
    OR Indian-flagged (MMSI prefix 419)."""
    dest = (v.get("destination") or "").upper().strip()
    if dest.startswith("IN") or dest.startswith(">IN"):
        return True
    if any(kw in dest for kw in INDIA_DEST_KEYWORDS):
        return True
    mmsi = str(v.get("mmsi", ""))
    if mmsi.startswith("419"):
        return True
    lat, lon = v.get("lat"), v.get("lon")
    if lat is not None and lon is not None:
        # Western India bounding box (Arabian Sea side of Indian coast)
        if 6.0 <= lat <= 25.0 and lon >= 65.0:
            return True
    return False


async def collect(api_key: str, duration: int) -> dict:
    """Connect, subscribe, accumulate latest data per MMSI for `duration` seconds."""
    sub = {
        "APIKey": api_key,
        "BoundingBoxes": BOUNDING_BOXES,
    }

    vessels: dict[str, dict] = {}
    static_cache: dict[str, dict] = {}
    type_counter: dict[str, int] = {}

    async with websockets.connect(WS_URL, ping_interval=20, ping_timeout=10) as ws:
        await ws.send(json.dumps(sub))
        print(f"[*] Subscribed (bbox={BOUNDING_BOXES[0]}); listening {duration}s", flush=True)

        deadline = time.monotonic() + duration
        msg_count = 0
        first_raw_logged = 0

        while time.monotonic() < deadline:
            remaining = max(0.5, deadline - time.monotonic())
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=remaining)
            except asyncio.TimeoutError:
                break
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            msg_count += 1
            mtype = msg.get("MessageType", "unknown")
            type_counter[mtype] = type_counter.get(mtype, 0) + 1

            # Surface server-side errors loudly (auth failure, invalid bbox, etc.)
            if mtype == "Error" or "error" in msg or "Error" in msg:
                err = msg.get("Error") or msg.get("error") or msg.get("Message") or str(msg)
                print(f"[!] AISStream error: {err}", flush=True)
                continue

            # Log first 2 raw messages for diagnostic visibility
            if first_raw_logged < 2:
                print(f"[debug] sample message: {json.dumps(msg)[:300]}", flush=True)
                first_raw_logged += 1

            metadata = msg.get("MetaData", {}) or {}
            mmsi = metadata.get("MMSI")
            if mmsi is None:
                continue
            mmsi = str(mmsi)
            ts = metadata.get("time_utc")

            if mtype == "PositionReport":
                pr = msg.get("Message", {}).get("PositionReport", {}) or {}
                rec = vessels.get(mmsi, {})
                rec.update({
                    "mmsi": mmsi,
                    "name": (metadata.get("ShipName") or rec.get("name") or "").strip() or f"MMSI {mmsi}",
                    "lat": pr.get("Latitude"),
                    "lon": pr.get("Longitude"),
                    "cog": pr.get("Cog"),
                    "sog": pr.get("Sog"),
                    "heading": pr.get("TrueHeading"),
                    "navStatus": pr.get("NavigationalStatus"),
                    "lastUpdate": ts,
                })
                if mmsi in static_cache:
                    rec.update(static_cache[mmsi])
                vessels[mmsi] = rec

            elif mtype == "ShipStaticData":
                ss = msg.get("Message", {}).get("ShipStaticData", {}) or {}
                static = {
                    "shipType": ss.get("Type"),
                    "destination": (ss.get("Destination") or "").strip(),
                    "callsign": (ss.get("CallSign") or "").strip(),
                    "imo": ss.get("ImoNumber"),
                }
                static_cache[mmsi] = static
                if mmsi in vessels:
                    vessels[mmsi].update(static)

        print(f"[*] Received {msg_count} messages, {len(vessels)} unique vessels", flush=True)
        if type_counter:
            print(f"[*] Message type breakdown: {type_counter}", flush=True)

    return vessels


def main() -> int:
    raw_key = os.environ.get("AISSTREAM_API_KEY", "")
    api_key = raw_key.strip()
    if not api_key:
        print("ERROR: AISSTREAM_API_KEY not set", file=sys.stderr)
        return 1
    # Diagnostic: confirm key is present without leaking it
    print(f"[*] API key loaded: length={len(api_key)} prefix={api_key[:4]}…", flush=True)
    if len(api_key) < 20:
        print(f"[!] API key suspiciously short ({len(api_key)} chars) — likely truncated/typo'd", flush=True)
    if raw_key != api_key:
        print(f"[!] API key had surrounding whitespace (stripped {len(raw_key) - len(api_key)} chars)", flush=True)

    t0 = time.monotonic()
    try:
        all_vessels = asyncio.run(collect(api_key, LISTEN_SECONDS))
    except Exception as e:
        print(f"ERROR connecting to AISStream: {e}", file=sys.stderr)
        return 2
    elapsed = time.monotonic() - t0

    if not all_vessels:
        print(
            "[!] Received zero messages during listen window. Most likely causes:\n"
            "    1. API key invalid/inactive — re-issue at https://aisstream.io/apikeys\n"
            "    2. API key not confirmed via email (check your aisstream.io signup email)\n"
            "    3. AISStream service issue — see https://status.aisstream.io",
            file=sys.stderr,
        )

    # Energy corridor filter: ShipType in tanker range, with a known position
    tankers = [
        v for v in all_vessels.values()
        if v.get("shipType") in TANKER_SHIPTYPES
        and v.get("lat") is not None and v.get("lon") is not None
    ]

    # Fallback: if no ShipStaticData arrived, include any positioned vessel and flag unknown type
    if not tankers:
        print("[!] No ShipStaticData received during listen window; falling back to all positioned vessels", flush=True)
        tankers = [v for v in all_vessels.values() if v.get("lat") is not None and v.get("lon") is not None]

    # Annotate
    annotated = []
    for v in tankers:
        annotated.append({
            "mmsi": v.get("mmsi"),
            "name": (v.get("name") or "").strip() or f"MMSI {v.get('mmsi')}",
            "imo": v.get("imo"),
            "callsign": v.get("callsign", ""),
            "shipType": v.get("shipType"),
            "shipTypeLabel": classify_shiptype(v.get("shipType")),
            "lat": round(v.get("lat") or 0, 5),
            "lon": round(v.get("lon") or 0, 5),
            "cog": v.get("cog"),
            "sog": v.get("sog"),
            "heading": v.get("heading"),
            "navStatus": v.get("navStatus"),
            "destination": (v.get("destination") or "").strip(),
            "lastUpdate": v.get("lastUpdate"),
            "indiaBound": is_india_bound(v),
        })

    # Sort: India-bound first, then by name
    annotated.sort(key=lambda x: (not x["indiaBound"], x["name"]))
    india_count = sum(1 for v in annotated if v["indiaBound"])

    output = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "aisstream.io",
        "corridor": "Hormuz → India (energy corridor)",
        "listenSeconds": LISTEN_SECONDS,
        "wallTimeSeconds": round(elapsed, 1),
        "boundingBox": BOUNDING_BOXES[0],
        "filter": "ShipType 80-89 (tankers + LNG/LPG carriers)",
        "vesselCount": len(annotated),
        "indiaBoundCount": india_count,
        "vessels": annotated,
    }
    OUTPUT.write_text(json.dumps(output, indent=2))
    print(f"\nWrote {len(annotated)} vessels ({india_count} India-bound) to {OUTPUT.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

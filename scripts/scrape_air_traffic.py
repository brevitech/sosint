#!/usr/bin/env python3
"""
Snapshot live ADS-B aircraft positions for the US-Iran theater via OpenSky Network.

Fetches the theater bounding box (Red Sea / Persian Gulf / Arabian Sea / India W. coast),
filters out grounded / position-less aircraft, tags each with the most-specific sub-region,
writes air-traffic.json.

OpenSky anonymous rate limits: ~400 req/day, 1 req/10s. We make 1 req/run at */10 cadence
= 144 req/day. Well within limits.
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "air-traffic.json"

# Big theater bounding box covering everything strategic:
# Red Sea (10N, 40E) → North India coast (30N, 80E)
THEATER_BBOX = {"lamin": 8.0, "lomin": 40.0, "lamax": 30.0, "lomax": 80.0}

# Sub-regions for tagging each aircraft with the most-specific theater zone
REGIONS = [
    {"name": "hormuz",      "lamin": 24.0, "lomin": 50.0, "lamax": 28.0, "lomax": 58.0},
    {"name": "mandab",      "lamin": 11.0, "lomin": 41.0, "lamax": 16.0, "lomax": 46.0},
    {"name": "oman",        "lamin": 22.0, "lomin": 57.0, "lamax": 26.5, "lomax": 62.0},
    {"name": "arabian-sea", "lamin": 16.0, "lomin": 60.0, "lamax": 22.0, "lomax": 68.0},
    {"name": "india-coast", "lamin": 8.0,  "lomin": 68.0, "lamax": 24.0, "lomax": 77.0},
    {"name": "india-south", "lamin": 8.0,  "lomin": 60.0, "lamax": 16.0, "lomax": 68.0},
]

OPENSKY_URL = "https://opensky-network.org/api/states/all"
OPENSKY_TOKEN_URL = "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token"


def get_opensky_token():
    """Fetch an OAuth2 access token via the client_credentials grant.
    Returns the access_token string, or None if creds aren't set or the
    request fails (we then fall back to anonymous, which is heavily rate-limited)."""
    client_id = os.environ.get("OPENSKY_CLIENT_ID", "").strip()
    client_secret = os.environ.get("OPENSKY_CLIENT_SECRET", "").strip()
    if not (client_id and client_secret):
        return None
    try:
        r = requests.post(
            OPENSKY_TOKEN_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": client_id,
                "client_secret": client_secret,
            },
            timeout=15,
        )
        r.raise_for_status()
        return r.json().get("access_token")
    except requests.RequestException as e:
        print(f"[!] OpenSky OAuth2 token request failed ({e}); falling back to anonymous.", file=sys.stderr)
        return None


def label_region(lat: float, lon: float) -> str:
    for r in REGIONS:
        if r["lamin"] <= lat <= r["lamax"] and r["lomin"] <= lon <= r["lomax"]:
            return r["name"]
    return "theater"


def main() -> int:
    params = THEATER_BBOX
    print(f"[*] GET {OPENSKY_URL} bbox={params}", flush=True)

    headers = {"User-Agent": "n8ra-wartracker/1.0"}
    token = get_opensky_token()
    if token:
        headers["Authorization"] = f"Bearer {token}"
        print("[*] Using OpenSky OAuth2 token", flush=True)

    try:
        r = requests.get(
            OPENSKY_URL,
            params=params,
            timeout=20,
            headers=headers,
        )
        r.raise_for_status()
        data = r.json()
    except requests.RequestException as e:
        print(f"ERROR fetching OpenSky: {e}", file=sys.stderr)
        return 1

    states = data.get("states") or []
    print(f"[*] Received {len(states)} raw states from OpenSky", flush=True)

    aircraft = []
    for s in states:
        # OpenSky state vector format:
        # [icao24, callsign, origin_country, time_position, last_contact, longitude,
        #  latitude, baro_altitude, on_ground, velocity, true_track, vertical_rate,
        #  sensors, geo_altitude, squawk, spi, position_source, category]
        if len(s) < 17:
            continue
        icao, callsign, country, _tp, _lc, lon, lat, baro_alt, on_ground, velocity, heading, vert_rate, _sensors, geo_alt = s[:14]
        category = s[17] if len(s) > 17 else 0

        if on_ground or lat is None or lon is None:
            continue

        aircraft.append({
            "icao": icao,
            "callsign": (callsign or "").strip(),
            "country": country or "",
            "lat": round(lat, 5),
            "lon": round(lon, 5),
            "altitude": baro_alt if baro_alt is not None else geo_alt,
            "velocity": velocity,
            "heading": heading or 0,
            "vertRate": vert_rate,
            "category": category,
            "region": label_region(lat, lon),
        })

    print(f"[*] {len(aircraft)} airborne aircraft after filtering", flush=True)

    output = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "opensky-network.org",
        "theaterBoundingBox": THEATER_BBOX,
        "openSkyTime": data.get("time"),
        "aircraftCount": len(aircraft),
        "aircraft": aircraft,
    }
    OUTPUT.write_text(json.dumps(output, separators=(",", ":")))
    print(f"Wrote {len(aircraft)} aircraft to {OUTPUT.name}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())

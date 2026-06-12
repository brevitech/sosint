#!/usr/bin/env python3
"""
Snapshot live ADS-B aircraft positions for the US-Iran theater via the adsb.lol
community ADS-B aggregator.

Why adsb.lol instead of OpenSky: OpenSky deprecated basic-auth in favour of
OAuth2 and their /api/states/all endpoint became flaky from GitHub-runner IPs
(40%+ failure rate via connect timeouts). adsb.lol is community-fed, free,
no auth required, and accepts radius queries large enough to cover our theater
in a single call.

We make one request per run (every 10 min) which is well within their
reasonable-use guidelines.
"""

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "air-traffic.json"

# Theater bounding box (Red Sea / Persian Gulf / Arabian Sea / India W. coast)
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

# Single radius query large enough to encompass the entire theater bbox.
# Worst-case corner distance from (19N, 60E) is ~1312 NM; 1500 NM gives margin.
ADSB_CENTRE_LAT = 19
ADSB_CENTRE_LON = 60
ADSB_RADIUS_NM = 1500
ADSB_URL = f"https://api.adsb.lol/v2/lat/{ADSB_CENTRE_LAT}/lon/{ADSB_CENTRE_LON}/dist/{ADSB_RADIUS_NM}"


# adsb.lol returns altitude in feet, ground speed in knots, vertical rate in
# ft/min. Convert to the OpenSky-compatible units (metres, m/s) that the
# frontend already expects, so app.js needs no changes.
def _ft_to_m(v):
    return None if v is None else round(v * 0.3048, 1)


def _kts_to_ms(v):
    return None if v is None else round(v * 0.514444, 2)


def _fpm_to_ms(v):
    return None if v is None else round(v * 0.00508, 3)


# Minimal registration-prefix -> country lookup. The frontend's "isIndian"
# check also looks at airline callsigns (AIC/IGO/6E/SEJ/SG/...), so most
# Indian carriers stay flagged even with country blank — this lookup just
# adds nationality info for the popup and the country-equality path.
_REG_PREFIXES = [
    ("VT-", "India"),
    ("A6-", "United Arab Emirates"),
    ("HZ-", "Saudi Arabia"),
    ("EP-", "Iran"),
    ("EK-", "Armenia"),
    ("4X-", "Israel"),
    ("4R-", "Sri Lanka"),
    ("SU-", "Egypt"),
    ("OO-", "Belgium"),
    ("G-",  "United Kingdom"),
    ("N",   "United States"),
]


def _country_from_reg(reg):
    if not reg:
        return ""
    for pref, country in _REG_PREFIXES:
        if reg.startswith(pref):
            return country
    return ""


def label_region(lat: float, lon: float) -> str:
    for r in REGIONS:
        if r["lamin"] <= lat <= r["lamax"] and r["lomin"] <= lon <= r["lomax"]:
            return r["name"]
    return "theater"


def main() -> int:
    print(f"[*] GET {ADSB_URL}", flush=True)

    # adsb.lol is community infrastructure and occasionally times out for
    # 20-30s. Retry up to 3x with 5s/10s backoff before giving up so a single
    # transient blip doesn't fail the workflow run.
    data = None
    last_err = None
    for attempt in range(1, 4):
        try:
            r = requests.get(
                ADSB_URL,
                timeout=20,
                # adsb.lol's ODbL guard 451s UAs that embed a project URL; keep it bare.
                headers={"User-Agent": "n8ra-wartracker/1.0"},
            )
            r.raise_for_status()
            data = r.json()
            break
        except requests.RequestException as e:
            last_err = e
            print(f"[!] attempt {attempt}/3 failed: {e}", file=sys.stderr)
            if attempt < 3:
                wait_s = 5 * attempt
                print(f"[!] retrying in {wait_s}s...", file=sys.stderr)
                time.sleep(wait_s)

    if data is None:
        print(f"ERROR fetching adsb.lol after 3 attempts: {last_err}", file=sys.stderr)
        return 1

    # adsb.lol returns the aircraft list under "ac" (tar1090 format).
    raw = data.get("ac") or data.get("aircraft") or []
    print(f"[*] Received {len(raw)} aircraft from adsb.lol", flush=True)

    bbox = THEATER_BBOX
    aircraft = []
    for a in raw:
        lat = a.get("lat")
        lon = a.get("lon")
        if lat is None or lon is None:
            continue
        # Clip the radius result down to our theater bbox.
        if not (bbox["lamin"] <= lat <= bbox["lamax"] and bbox["lomin"] <= lon <= bbox["lomax"]):
            continue
        # adsb.lol uses the string "ground" for grounded aircraft in alt_baro.
        alt_baro = a.get("alt_baro")
        if alt_baro == "ground":
            continue

        # Prefer baro altitude; fall back to geometric if baro is missing.
        alt_ft = alt_baro if isinstance(alt_baro, (int, float)) else a.get("alt_geom")

        aircraft.append({
            "icao": a.get("hex"),
            "callsign": (a.get("flight") or "").strip(),
            "country": _country_from_reg(a.get("r") or ""),
            "lat": round(lat, 5),
            "lon": round(lon, 5),
            "altitude": _ft_to_m(alt_ft),
            "velocity": _kts_to_ms(a.get("gs")),
            "heading": a.get("track") or 0,
            "vertRate": _fpm_to_ms(a.get("baro_rate")),
            "category": a.get("category", 0),
            "region": label_region(lat, lon),
        })

    print(f"[*] {len(aircraft)} airborne aircraft inside theater bbox", flush=True)

    output = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "adsb.lol",
        "theaterBoundingBox": THEATER_BBOX,
        # Keep the legacy field name so the frontend doesn't notice the source swap.
        "openSkyTime": data.get("now"),
        "aircraftCount": len(aircraft),
        "aircraft": aircraft,
    }
    OUTPUT.write_text(json.dumps(output, separators=(",", ":")))
    print(f"Wrote {len(aircraft)} aircraft to {OUTPUT.name}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())

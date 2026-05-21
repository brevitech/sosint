#!/usr/bin/env python3
"""
N8RA WarTracker — Real Military Assets Pipeline
Scrapes defense news RSS feeds to extract deployment locations of major naval 
and air assets using OSINT keyword matching. Outputs military-assets.json.
"""

import json
import os
import re
import requests
import feedparser
from datetime import datetime, timezone

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
OUTPUT_FILE = os.path.join(ROOT_DIR, "military-assets.json")

FEEDS = [
    {"name": "USNI News", "url": "https://news.usni.org/feed"},
    {"name": "Defense One", "url": "https://www.defenseone.com/rss/all/"},
    {"name": "Military.com", "url": "https://www.military.com/rss-feeds/military-news"},
]

# Base known positions mapping to coordinates
REGIONS = {
    "red sea": [15.5, 42.0],
    "arabian sea": [21.0, 60.0],
    "gulf of oman": [24.5, 58.5],
    "persian gulf": [26.0, 52.0],
    "mediterranean": [34.0, 30.0],
    "indopacom": [15.0, 115.0],
    "pacific": [15.0, 115.0],
    "atlantic": [35.0, -40.0],
}

# Assets to track
TRACKED_ASSETS = [
    # Carriers
    {"name": "USS Dwight D. Eisenhower", "keywords": ["eisenhower", "cvn-69", "cvn 69"], "type": "Carrier", "default": "Red Sea"},
    {"name": "USS Abraham Lincoln", "keywords": ["lincoln", "cvn-72", "cvn 72"], "type": "Carrier", "default": "Arabian Sea"},
    {"name": "USS Gerald R. Ford", "keywords": ["ford", "cvn-78", "cvn 78"], "type": "Carrier", "default": "Mediterranean"},
    {"name": "USS Harry S. Truman", "keywords": ["truman", "cvn-75", "cvn 75"], "type": "Carrier", "default": "Atlantic"},
    {"name": "USS Theodore Roosevelt", "keywords": ["roosevelt", "cvn-71", "cvn 71"], "type": "Carrier", "default": "Pacific"},
    # Amphibious
    {"name": "USS Bataan", "keywords": ["bataan", "lhd-5", "lhd 5"], "type": "Amphibious", "default": "Red Sea"},
    {"name": "USS Boxer", "keywords": ["boxer", "lhd-4", "lhd 4"], "type": "Amphibious", "default": "Pacific"},
    # Destroyers
    {"name": "USS Carney", "keywords": ["carney", "ddg-64", "ddg 64"], "type": "Destroyer", "default": "Red Sea"},
    {"name": "USS Mason", "keywords": ["mason", "ddg-87", "ddg 87"], "type": "Destroyer", "default": "Red Sea"},
    {"name": "USS Laboon", "keywords": ["laboon", "ddg-58", "ddg 58"], "type": "Destroyer", "default": "Red Sea"},
    # Subs
    {"name": "USS Florida", "keywords": ["florida", "ssgn-728", "ssgn 728"], "type": "Submarine", "default": "Persian Gulf"},
]

def fetch_articles():
    print("[*] Fetching defense RSS feeds...")
    articles = []
    for feed in FEEDS:
        try:
            print(f"  Fetching {feed['name']}...")
            resp = requests.get(feed['url'], timeout=15)
            d = feedparser.parse(resp.content)
            for entry in d.entries[:30]:
                text = (entry.get("title", "") + " " + entry.get("summary", "")).lower()
                articles.append(text)
        except Exception as e:
            print(f"  ERROR fetching {feed['name']}: {e}")
    return articles

def determine_locations(articles):
    print("[*] Parsing asset locations from OSINT...")
    results = []
    
    for asset in TRACKED_ASSETS:
        found_region = None
        
        # Scan articles for asset mentions
        for text in articles:
            mentioned = any(kw in text for kw in asset["keywords"])
            if mentioned:
                # Look for region keywords in the same article
                for region in REGIONS.keys():
                    if region in text:
                        found_region = region
                        break
            if found_region:
                break
        
        region_name = found_region if found_region else asset["default"]
        
        # Add a tiny bit of jitter to coordinates so icons don't overlap perfectly
        base_coords = REGIONS.get(region_name.lower(), [0, 0])
        import random
        lat = base_coords[0] + random.uniform(-0.5, 0.5)
        lon = base_coords[1] + random.uniform(-0.5, 0.5)
        
        results.append({
            "name": asset["name"],
            "type": asset["type"],
            "status": f"Deployed - {region_name.title()}",
            "pos": [lat, lon],
            "osintConfirmed": bool(found_region)
        })
        
    return results

def run_pipeline():
    print("=" * 60)
    print("N8RA WARTRACKER — LIVE MILITARY ASSETS PIPELINE")
    print(f"Timestamp: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 60)

    articles = fetch_articles()
    print(f"[*] Fetched {len(articles)} recent defense articles.")
    
    assets = determine_locations(articles)
    
    # Filter to only assets in the Middle East / Europe area
    # (Exclude Pacific/Atlantic base defaults to keep map clean)
    active_assets = [a for a in assets if a["pos"][0] != 0 and a["pos"][1] > 0]
    
    print(f"[*] Tracked {len(active_assets)} active deployments.")

    now = datetime.now(timezone.utc)
    result = {
        "generatedAt": now.isoformat(),
        "dataSource": "live-osint",
        "assets": active_assets,
        "articlesAnalyzed": len(articles)
    }

    print(f"\nWriting military-assets.json...")
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"Output: {OUTPUT_FILE}")
    print("PIPELINE COMPLETE ✓")

if __name__ == "__main__":
    run_pipeline()

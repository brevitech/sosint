#!/usr/bin/env python3
"""
N8RA WarTracker — Real Incidents Pipeline
Scrapes Google News RSS for conflict events and geocodes them using 
a known OSINT location dictionary.
"""

import json
import os
import re
import feedparser
from datetime import datetime, timezone

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
OUTPUT_FILE = os.path.join(ROOT_DIR, "incidents-data.json")

# RSS Feeds for conflict news
FEEDS = [
    "https://news.google.com/rss/search?q=Iran+attack+OR+strike+OR+explosion+OR+missile&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=Israel+attack+OR+strike+OR+explosion&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=Houthi+Red+Sea+attack+OR+missile&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=US+base+attack+Iraq+OR+Syria&hl=en-US&gl=US&ceid=US:en"
]

# Simple geocoding dictionary
LOCATIONS = {
    "tehran": [35.68, 51.38],
    "isfahan": [32.65, 51.66],
    "natanz": [33.72, 51.73],
    "baghdad": [33.31, 44.36],
    "erbil": [36.19, 44.00],
    "damascus": [33.51, 36.29],
    "beirut": [33.89, 35.50],
    "sanaa": [15.36, 44.20],
    "hodeidah": [14.79, 42.95],
    "aden": [12.79, 45.03],
    "gaza": [31.50, 34.46],
    "tel aviv": [32.08, 34.78],
    "red sea": [16.0, 41.0],
    "gulf of aden": [12.0, 48.0],
    "persian gulf": [26.0, 52.0],
    "strait of hormuz": [26.5, 56.4],
    "syria": [35.0, 38.0],
    "lebanon": [33.8, 35.8],
    "iraq": [33.0, 43.0],
    "iran": [32.0, 53.0],
    "yemen": [15.0, 48.0],
}

def fetch_incidents():
    print("[*] Fetching Incident RSS feeds...")
    incidents = []
    seen_titles = set()
    
    for url in FEEDS:
        try:
            d = feedparser.parse(url)
            for entry in d.entries[:15]:
                title = entry.get("title", "")
                if title in seen_titles:
                    continue
                seen_titles.add(title)
                
                text = (title + " " + entry.get("summary", "")).lower()
                
                # Find location
                found_loc = None
                coords = None
                for loc, pos in LOCATIONS.items():
                    if re.search(r'\b' + re.escape(loc) + r'\b', text):
                        found_loc = loc
                        coords = pos
                        break
                        
                if not coords:
                    continue
                    
                # Determine category/color
                color = "#ef4444" # Default Red
                cat = "attack"
                if "missile" in text or "drone" in text or "airstrike" in text:
                    color = "#f97316" # Orange
                    cat = "airstrike"
                elif "ship" in text or "vessel" in text or "sea" in text or "tanker" in text:
                    color = "#3b82f6" # Blue
                    cat = "naval"
                elif "explosion" in text:
                    color = "#eab308" # Yellow
                    cat = "explosion"
                
                # Add some jitter so they don't perfectly overlap
                import random
                lat = coords[0] + random.uniform(-0.3, 0.3)
                lon = coords[1] + random.uniform(-0.3, 0.3)
                
                incidents.append({
                    "title": title,
                    "url": entry.get("link", ""),
                    "domain": entry.get("source", {}).get("title", "News Source") if isinstance(entry.get("source"), dict) else "News Source",
                    "lat": lat,
                    "lon": lon,
                    "color": color,
                    "category": cat
                })
        except Exception as e:
            print(f"  ERROR fetching feed: {e}")
            
    print(f"  Geocoded {len(incidents)} incidents.")
    return incidents

def run_pipeline():
    print("=" * 60)
    print("N8RA WARTRACKER — LIVE INCIDENTS PIPELINE")
    print(f"Timestamp: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 60)

    incidents = fetch_incidents()
    
    # Limit to top 50
    incidents = incidents[:50]

    now = datetime.now(timezone.utc)
    result = {
        "generatedAt": now.isoformat(),
        "dataSource": "live-osint",
        "incidents": incidents,
        "count": len(incidents)
    }

    print(f"\nWriting incidents-data.json...")
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"Output: {OUTPUT_FILE}")
    print("PIPELINE COMPLETE ✓")

if __name__ == "__main__":
    run_pipeline()

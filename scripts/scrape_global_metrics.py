#!/usr/bin/env python3
"""
N8RA WarTracker — Global Live Metrics Pipeline
Aggregates economic, cyber, and geopolitical indicators to make the 
remaining dashboard panels fully dynamic.
"""

import json
import os
import requests
import feedparser
from datetime import datetime, timezone

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
OUTPUT_FILE = os.path.join(ROOT_DIR, "global-metrics.json")
INCIDENTS_FILE = os.path.join(ROOT_DIR, "incidents-data.json")

def fetch_brent_crude():
    print("[*] Fetching Brent Crude Price...")
    url = "https://query1.finance.yahoo.com/v8/finance/chart/BZ=F"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    try:
        res = requests.get(url, headers=headers, timeout=10)
        res.raise_for_status()
        data = res.json()
        price = data["chart"]["result"][0]["meta"]["regularMarketPrice"]
        return round(price, 2)
    except Exception as e:
        print(f"  ERROR fetching Brent Crude: {e}")
        return 82.50 # Fallback

def fetch_irr_exchange_rate():
    print("[*] Fetching Free Market IRR...")
    url = "https://api.priceto.day/v1/latest/irr/usd"
    try:
        res = requests.get(url, timeout=10)
        res.raise_for_status()
        data = res.json()
        price_str = str(data["price"]).replace(',', '')
        return int(float(price_str))
    except Exception as e:
        print(f"  ERROR fetching IRR: {e}")
        return 650000 # Fallback

def fetch_cyber_news():
    print("[*] Fetching Cyber Warfare News...")
    url = "https://news.google.com/rss/search?q=cyber+warfare+OR+hack+Iran+US+Middle+East&hl=en-US&gl=US&ceid=US:en"
    news = []
    try:
        d = feedparser.parse(url)
        for entry in d.entries[:6]:
            news.append({
                "title": entry.get("title", ""),
                "url": entry.get("link", ""),
                "published": entry.get("published", "")
            })
    except Exception as e:
        print(f"  ERROR fetching Cyber News: {e}")
    return news

def analyze_threats_and_proxies():
    print("[*] Calculating Dynamic Threat Levels...")
    
    # Defaults
    threat_level = 7
    threat_label = "HIGH — ELEVATED"
    proxy_activity = {
        "Hezbollah": "Active",
        "Houthis (Ansar Allah)": "Active - Red Sea",
        "Iraqi Shiite Militias (PMF)": "Active",
        "Hamas": "Degraded",
        "Palestinian Islamic Jihad": "Active"
    }
    
    # Try to load incidents data
    if os.path.exists(INCIDENTS_FILE):
        try:
            with open(INCIDENTS_FILE, "r") as f:
                data = json.load(f)
                incidents = data.get("incidents", [])
                
                # Threat level heuristic
                if len(incidents) > 30:
                    threat_level = 9
                    threat_label = "CRITICAL — IMMINENT ESCALATION"
                elif len(incidents) > 15:
                    threat_level = 8
                    threat_label = "SEVERE — ONGOING ESCALATION"
                    
                # Proxy heuristics
                houthi_mentions = sum(1 for i in incidents if "houthi" in i["title"].lower() or "red sea" in i["title"].lower() or "yemen" in i["title"].lower())
                if houthi_mentions > 3:
                    proxy_activity["Houthis (Ansar Allah)"] = "Elevated - Multiple Recent Attacks"
                    
                hezbollah_mentions = sum(1 for i in incidents if "hezbollah" in i["title"].lower() or "lebanon" in i["title"].lower())
                if hezbollah_mentions > 3:
                    proxy_activity["Hezbollah"] = "Elevated - Active Exchanges"
                    
                pmf_mentions = sum(1 for i in incidents if "iraq" in i["title"].lower() or "base" in i["title"].lower())
                if pmf_mentions > 2:
                    proxy_activity["Iraqi Shiite Militias (PMF)"] = "Elevated - Base Strikes Detected"
                    
        except Exception as e:
            print(f"  ERROR processing incidents for threats: {e}")
            
    return threat_level, threat_label, proxy_activity

def run_pipeline():
    print("=" * 60)
    print("N8RA WARTRACKER — GLOBAL LIVE METRICS PIPELINE")
    print(f"Timestamp: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 60)

    oil_price = fetch_brent_crude()
    irr_rate = fetch_irr_exchange_rate()
    cyber_news = fetch_cyber_news()
    threat_level, threat_label, proxy_activity = analyze_threats_and_proxies()

    now = datetime.now(timezone.utc)
    result = {
        "generatedAt": now.isoformat(),
        "dataSource": "live-osint",
        "economy": {
            "brentCrude": oil_price,
            "irrFreeMarket": irr_rate
        },
        "cyber": cyber_news,
        "threat": {
            "level": threat_level,
            "label": threat_label
        },
        "proxies": proxy_activity,
        "nuclear": {
            "enrichment": "60% U-235",
            "breakout": "~1-2 weeks (estimated)"
        }
    }

    print(f"\nWriting global-metrics.json...")
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"Output: {OUTPUT_FILE}")
    print("PIPELINE COMPLETE ✓")

if __name__ == "__main__":
    run_pipeline()

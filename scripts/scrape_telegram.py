#!/usr/bin/env python3
"""
N8RA WarTracker — Telegram OSINT Scraper
Scrapes public Telegram channel web previews (https://t.me/s/{channel})
Requires zero API keys. Focuses on Middle East & Conflict OSINT.
"""

import json
import os
import requests
import re
from bs4 import BeautifulSoup
from datetime import datetime, timezone

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
OUTPUT_FILE = os.path.join(ROOT_DIR, "telegram-osint.json")

CHANNELS = [
    {"id": "middleeastosint", "label": "Middle East OSINT"},
    {"id": "intelslava", "label": "Intel Slava Z"},
    {"id": "ukraine_frontline", "label": "Ukraine Frontline"},
    {"id": "CIG_telegram", "label": "Conflict Intel Team"},
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

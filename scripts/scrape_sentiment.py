#!/usr/bin/env python3
"""
N8RA WarTracker — Real Sentiment Data Pipeline
Scrapes RSS news feeds, matches personality mentions, runs VADER sentiment analysis,
and outputs sentiment-data.json for the frontend dashboard.
"""

import json
import os
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone

import feedparser
import requests
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

# ── Configuration ─────────────────────────────────────────────────────────────

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
PERSONALITIES_FILE = os.path.join(SCRIPT_DIR, "personalities.json")
OUTPUT_FILE = os.path.join(ROOT_DIR, "sentiment-data.json")

# Stop words for word cloud extraction
STOP_WORDS = frozenset([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "dare", "ought",
    "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
    "as", "into", "through", "during", "before", "after", "above", "below",
    "between", "out", "off", "over", "under", "again", "further", "then",
    "once", "here", "there", "when", "where", "why", "how", "all", "both",
    "each", "few", "more", "most", "other", "some", "such", "no", "nor",
    "not", "only", "own", "same", "so", "than", "too", "very", "just",
    "don", "now", "and", "but", "or", "if", "while", "about", "up",
    "it", "its", "this", "that", "these", "those", "he", "she", "they",
    "we", "you", "i", "me", "him", "her", "us", "them", "my", "your",
    "his", "our", "their", "what", "which", "who", "whom", "says", "said",
    "also", "new", "one", "two", "like", "get", "make", "go", "know",
    "take", "see", "come", "think", "look", "want", "give", "use", "find",
    "tell", "ask", "work", "seem", "feel", "try", "leave", "call", "keep",
    "let", "begin", "show", "hear", "play", "run", "move", "live", "believe",
    "hold", "bring", "happen", "must", "write", "provide", "sit", "stand",
    "lose", "pay", "meet", "include", "continue", "set", "learn", "change",
    "lead", "understand", "watch", "follow", "stop", "create", "speak",
    "read", "allow", "add", "spend", "grow", "open", "walk", "win", "offer",
    "remember", "love", "consider", "appear", "buy", "wait", "serve", "die",
    "send", "expect", "build", "stay", "fall", "cut", "reach", "kill",
    "remain", "top", "per", "via", "yet", "many", "much", "still",
    "even", "back", "well", "way", "long", "part", "first", "last",
    "big", "old", "year", "years", "day", "time", "world", "people",
    "news", "report", "reports", "according", "sources", "source",
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    "january", "february", "march", "april", "may", "june", "july",
    "august", "september", "october", "november", "december", "today",
    "week", "month", "ago", "reuters", "press", "associated",
])

# Minimum word length for word cloud
MIN_WORD_LENGTH = 3

# ── RSS Feed Sources ──────────────────────────────────────────────────────────

RSS_FEEDS = {
    "us": [
        # Major wire services
        {"name": "Yahoo News World", "url": "https://news.yahoo.com/rss/world"},
        {"name": "Yahoo News US", "url": "https://news.yahoo.com/rss/us"},
        {"name": "AP News", "url": "https://feedx.net/rss/ap.xml"},
        # US News
        {"name": "NPR News", "url": "https://feeds.npr.org/1001/rss.xml"},
        {"name": "BBC World", "url": "https://feeds.bbci.co.uk/news/world/rss.xml"},
        {"name": "BBC US/Canada", "url": "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml"},
        {"name": "Al Jazeera", "url": "https://www.aljazeera.com/xml/rss/all.xml"},
        {"name": "The Guardian World", "url": "https://www.theguardian.com/world/rss"},
        {"name": "The Guardian US", "url": "https://www.theguardian.com/us-news/rss"},
        # Business
        {"name": "CNBC Top", "url": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114"},
        {"name": "Bloomberg", "url": "https://feeds.bloomberg.com/markets/news.rss"},
        # Tech
        {"name": "TechCrunch", "url": "https://techcrunch.com/feed/"},
        {"name": "The Verge", "url": "https://www.theverge.com/rss/index.xml"},
        # Politics
        {"name": "PBS NewsHour", "url": "https://www.pbs.org/newshour/feeds/rss/headlines"},
        {"name": "The Hill", "url": "https://thehill.com/feed/"},
    ],
    "india": [
        # Indian news
        {"name": "NDTV Top", "url": "https://feeds.feedburner.com/ndtvnews-top-stories"},
        {"name": "NDTV India", "url": "https://feeds.feedburner.com/ndtvnews-india-news"},
        {"name": "The Hindu", "url": "https://www.thehindu.com/news/feeder/default.rss"},
        {"name": "Indian Express", "url": "https://indianexpress.com/feed/"},
        {"name": "Times of India", "url": "https://timesofindia.indiatimes.com/rssfeedstopstories.cms"},
        {"name": "Hindustan Times", "url": "https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml"},
        {"name": "Livemint", "url": "https://www.livemint.com/rss/news"},
        {"name": "Economic Times", "url": "https://economictimes.indiatimes.com/rssfeedstopstories.cms"},
        {"name": "Deccan Herald", "url": "https://www.deccanherald.com/rss/india.rss"},
        {"name": "The Print", "url": "https://theprint.in/feed/"},
        # International coverage of India
        {"name": "Yahoo India", "url": "https://news.yahoo.com/rss/india"},
        {"name": "Al Jazeera Asia", "url": "https://www.aljazeera.com/xml/rss/all.xml"},
        # Business
        {"name": "Moneycontrol", "url": "https://www.moneycontrol.com/rss/latestnews.xml"},
        # Sports
        {"name": "ESPN Cricinfo", "url": "https://www.espncricinfo.com/rss/content/story/feeds/0.xml"},
        {"name": "NDTV Sports", "url": "https://feeds.feedburner.com/ndtvsports-latest"},
    ],
}

# ── Helper Functions ──────────────────────────────────────────────────────────

def load_personalities():
    """Load personality data from JSON file."""
    with open(PERSONALITIES_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def build_name_index(personalities, mode):
    """
    Build a lookup index: lowercase alias → (name, category).
    This enables fast O(1) matching of article text against personality names.
    """
    index = {}
    mode_data = personalities.get(mode, {})
    for category, people in mode_data.items():
        for person in people:
            name = person["name"]
            # Add the full name
            name_lower = name.lower()
            index[name_lower] = (name, category)
            # Add aliases
            for alias in person.get("aliases", []):
                alias_lower = alias.lower()
                if len(alias_lower) >= 3:  # Skip very short aliases to avoid false matches
                    index[alias_lower] = (name, category)
    return index


def fetch_feeds(feed_list):
    """Fetch and parse all RSS feeds. Returns list of article dicts."""
    articles = []
    for feed_info in feed_list:
        try:
            print(f"  Fetching: {feed_info['name']}...", end=" ", flush=True)
            response = requests.get(
                feed_info["url"],
                timeout=15,
                headers={"User-Agent": "N8RA-WarTracker-Sentiment/1.0"}
            )
            if response.status_code != 200:
                print(f"HTTP {response.status_code}")
                continue

            feed = feedparser.parse(response.content)
            count = 0
            for entry in feed.entries[:50]:  # Cap at 50 articles per feed
                title = entry.get("title", "")
                summary = entry.get("summary", entry.get("description", ""))
                # Strip HTML tags from summary
                summary = re.sub(r"<[^>]+>", " ", summary)
                published = entry.get("published", entry.get("updated", ""))

                if title:
                    articles.append({
                        "title": title,
                        "summary": summary[:500],  # Cap summary length
                        "source": feed_info["name"],
                        "published": published,
                        "text": f"{title}. {summary[:500]}",
                    })
                    count += 1
            print(f"{count} articles")

        except Exception as e:
            print(f"ERROR: {e}")
            continue

    return articles


def match_personalities(articles, name_index):
    """
    Match articles to personalities. Returns list of
    (article, matched_name, category) tuples.
    """
    matches = []
    for article in articles:
        text_lower = article["text"].lower()
        matched_this_article = set()

        for alias, (name, category) in name_index.items():
            if name in matched_this_article:
                continue
            # Word boundary matching to avoid partial matches
            # e.g., "Modi" shouldn't match "modify"
            pattern = r"\b" + re.escape(alias) + r"\b"
            if re.search(pattern, text_lower):
                matches.append((article, name, category))
                matched_this_article.add(name)

    return matches


def analyze_sentiment(matches, analyzer):
    """
    Run VADER sentiment on matched articles.
    Returns aggregated sentiment data per category and overall.
    """
    category_scores = defaultdict(lambda: {"positive": 0, "negative": 0, "neutral": 0, "count": 0})
    overall = {"positive": 0, "negative": 0, "neutral": 0, "count": 0}
    personality_sentiments = defaultdict(list)

    for article, name, category in matches:
        scores = analyzer.polarity_scores(article["text"])
        compound = scores["compound"]

        if compound >= 0.05:
            sentiment = "positive"
        elif compound <= -0.05:
            sentiment = "negative"
        else:
            sentiment = "neutral"

        category_scores[category][sentiment] += 1
        category_scores[category]["count"] += 1
        overall[sentiment] += 1
        overall["count"] += 1
        personality_sentiments[name].append(compound)

    return category_scores, overall, personality_sentiments


def extract_word_cloud(matches, analyzer, top_n=30):
    """
    Extract top keywords from matched article titles for the word cloud.
    Each word is tagged with its dominant sentiment.
    """
    word_sentiments = defaultdict(lambda: {"scores": [], "count": 0})

    for article, name, category in matches:
        title = article["title"]
        # Tokenize: keep alphanumeric and hyphens
        words = re.findall(r"[a-zA-Z][\w-]*[a-zA-Z]|[a-zA-Z]{2,}", title)

        for word in words:
            w = word.lower()
            if w in STOP_WORDS or len(w) < MIN_WORD_LENGTH:
                continue
            # Skip personality names themselves from the cloud
            if w in [name.lower().split()[0] for _, name, _ in [(None, name, None)]]:
                continue

            scores = analyzer.polarity_scores(word)
            word_sentiments[w]["scores"].append(scores["compound"])
            word_sentiments[w]["count"] += 1

    # Build word cloud entries
    cloud = []
    for word, data in word_sentiments.items():
        if data["count"] < 2:  # Minimum 2 occurrences
            continue
        avg_score = sum(data["scores"]) / len(data["scores"]) if data["scores"] else 0
        if avg_score >= 0.05:
            sentiment = "positive"
        elif avg_score <= -0.05:
            sentiment = "negative"
        else:
            sentiment = "neutral"

        cloud.append({
            "word": word,
            "count": data["count"],
            "sentiment": sentiment,
        })

    # Sort by count, take top N
    cloud.sort(key=lambda x: x["count"], reverse=True)
    return cloud[:top_n]


def compute_percentages(overall):
    """Convert raw counts to percentages."""
    total = overall["count"]
    if total == 0:
        return 33, 33, 34  # Fallback neutral split

    pos = round(overall["positive"] / total * 100)
    neg = round(overall["negative"] / total * 100)
    neu = 100 - pos - neg
    return pos, neg, neu


# ── Main Pipeline ─────────────────────────────────────────────────────────────

def run_pipeline():
    """Execute the full sentiment analysis pipeline."""
    print("=" * 60)
    print("N8RA WARTRACKER — SENTIMENT DATA PIPELINE")
    print(f"Timestamp: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 60)

    # Load personalities
    print("\n[1/5] Loading personality data...")
    personalities = load_personalities()
    for mode in ["us", "india"]:
        total = sum(len(v) for v in personalities.get(mode, {}).values())
        print(f"  {mode.upper()} mode: {total} personalities")

    # Initialize VADER
    print("\n[2/5] Initializing VADER sentiment analyzer...")
    analyzer = SentimentIntensityAnalyzer()

    result = {}

    for mode in ["us", "india"]:
        print(f"\n{'─' * 60}")
        print(f"Processing {mode.upper()} MODE")
        print(f"{'─' * 60}")

        # Build name index
        name_index = build_name_index(personalities, mode)
        print(f"\n[3/5] Name index built: {len(name_index)} searchable aliases")

        # Fetch RSS feeds
        print(f"\n[4/5] Fetching RSS feeds ({len(RSS_FEEDS[mode])} sources)...")
        articles = fetch_feeds(RSS_FEEDS[mode])
        print(f"  Total articles fetched: {len(articles)}")

        if not articles:
            print("  WARNING: No articles fetched. Using fallback data.")
            result[mode] = _fallback_data(mode, personalities)
            continue

        # Match personalities
        matches = match_personalities(articles, name_index)
        print(f"\n[5/5] Personality matches found: {len(matches)}")
        if matches:
            matched_names = set(m[1] for m in matches)
            print(f"  Unique personalities mentioned: {len(matched_names)}")

        # Analyze sentiment
        category_scores, overall, personality_sentiments = analyze_sentiment(matches, analyzer)

        # Compute percentages
        pos_pct, neg_pct, neu_pct = compute_percentages(overall)
        print(f"\n  Sentiment: +{pos_pct}% / -{neg_pct}% / ~{neu_pct}%")

        # Extract word cloud
        word_cloud = extract_word_cloud(matches, analyzer, top_n=30)
        print(f"  Word cloud: {len(word_cloud)} keywords")

        # Count total personalities
        total_personalities = sum(len(v) for v in personalities.get(mode, {}).values())

        # Build output
        now = datetime.now(timezone.utc)
        result[mode] = {
            "positive": pos_pct,
            "negative": neg_pct,
            "neutral": neu_pct,
            "wordCloud": word_cloud,
            "totalPersonalities": total_personalities,
            "generatedAt": now.isoformat(),
            "nextRefresh": now.isoformat(),  # Will be computed by frontend
            "articlesAnalyzed": len(articles),
            "matchedMentions": len(matches),
            "uniquePersonalities": len(set(m[1] for m in matches)) if matches else 0,
            "dataSource": "live-rss",
        }

    # Write output
    print(f"\n{'=' * 60}")
    print("Writing sentiment-data.json...")
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"Output: {OUTPUT_FILE}")
    print(f"Size: {os.path.getsize(OUTPUT_FILE)} bytes")
    print("PIPELINE COMPLETE ✓")
    print("=" * 60)


def _fallback_data(mode, personalities):
    """Generate minimal fallback data if feeds fail."""
    total = sum(len(v) for v in personalities.get(mode, {}).values())
    return {
        "positive": 33,
        "negative": 33,
        "neutral": 34,
        "wordCloud": [],
        "totalPersonalities": total,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "nextRefresh": datetime.now(timezone.utc).isoformat(),
        "articlesAnalyzed": 0,
        "matchedMentions": 0,
        "uniquePersonalities": 0,
        "dataSource": "fallback",
    }


if __name__ == "__main__":
    try:
        run_pipeline()
    except Exception as e:
        print(f"\nFATAL ERROR: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

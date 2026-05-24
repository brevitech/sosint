#!/usr/bin/env python3
"""
N8RA WarTracker — Telegram Alert Bot
Sends automated SITREPs when the threat level elevates or significant
thermal anomalies (strikes/explosions) are detected.
"""

import json
import os
import requests

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
METRICS_FILE = os.path.join(ROOT_DIR, "global-metrics.json")

def send_alert():
    print("[*] Checking alert thresholds...")
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    
    if not token or not chat_id:
        print("  Skipping Alerts: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID required.")
        return

    if not os.path.exists(METRICS_FILE):
        print("  Skipping Alerts: global-metrics.json not found.")
        return

    try:
        with open(METRICS_FILE, "r") as f:
            data = json.load(f)
    except Exception as e:
        print(f"  ERROR reading metrics: {e}")
        return

    threat_level = data.get("threat", {}).get("level", 0)
    threat_label = data.get("threat", {}).get("label", "NORMAL")
    firms = data.get("firms", {})
    high_intensity = firms.get("highIntensityAnomalies", [])

    alerts = []

    # Threat Alert
    if threat_level >= 8:
        alerts.append(f"🚨 **WARTRACKER SITREP** 🚨\n\n**Threat Level:** {threat_level}/10 ({threat_label})\nElevated proxy activity or significant incidents detected.")

    # FIRMS Alert
    if len(high_intensity) > 0:
        alerts.append(f"🔥 **THERMAL ANOMALY WARNING** 🔥\n\nDetected {len(high_intensity)} high-intensity thermal anomalies (>10MW) in the Middle East. Potential kinetic strikes or explosions.")

    if not alerts:
        print("  No alert thresholds met. Threat is nominal.")
        return

    message = "\n\n---\n\n".join(alerts)

    print(f"[*] Sending alert to Telegram...")
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "Markdown"
    }

    try:
        res = requests.post(url, json=payload, timeout=10)
        res.raise_for_status()
        print("  Alert sent successfully ✓")
    except Exception as e:
        print(f"  ERROR sending Telegram alert: {e}")

if __name__ == "__main__":
    send_alert()

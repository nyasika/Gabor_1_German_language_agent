"""Standalone reminder script – runs via GitHub Actions, no Streamlit needed."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

# Ellenőrzés: megvannak-e a szükséges env változók?
required = ["SUPABASE_URL", "SUPABASE_KEY", "GMAIL_USER", "GMAIL_APP_PASSWORD"]
missing = [k for k in required if not os.environ.get(k)]
if missing:
    print(f"HIBA: hiányzó GitHub Secrets: {', '.join(missing)}")
    sys.exit(1)

print("Secrets OK – csatlakozás Supabase-hez...")

from database import Database
from reminder import send_reminder

db = Database()
state = db.get_user_state()
email = state.get("email", "")

if not email:
    print("HIBA: Nincs email beállítva az appban (Beállítások → Email mező).")
    sys.exit(1)

session_count = len(db.get_today_sessions())
streak = state.get("current_streak", 0)

print(f"Email küldése: {email} | mai sessionök: {session_count} | streak: {streak} nap")

ok = send_reminder(
    recipient_email=email,
    session_count_today=session_count,
    streak=streak,
)

if ok:
    print("Email sikeresen elküldve!")
else:
    print("HIBA: Email küldés sikertelen – ellenőrizd a GMAIL_USER és GMAIL_APP_PASSWORD secret-eket.")

sys.exit(0 if ok else 1)

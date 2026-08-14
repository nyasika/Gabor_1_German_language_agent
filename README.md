# Deutsch Üben – German Learning Agent

**Állapot: ÉLES, fut a Streamlit Cloudon ✅**
**URL: [nyasikagerman.streamlit.app](https://nyasikagerman.streamlit.app)**
**Utoljára frissítve: 2026-05-29**

**2026-08-14: saját, önálló repóba emelve** (`github.com/nyasika/german-language-agent`),
korábban a `personal-agents` repó `agents/Personal/...` alatt volt beágyazva, azelőtt pedig
(2026-08-06 előtt) a `nyasika/AI-agents` monorepo része. Történet nélkül, friss git repóként
lett kiválasztva ide is, a `.devcontainer`, `.github/workflows` (napi emlékeztető) és
`.streamlit` configgal együtt. **A Streamlit Cloud app forrás-repóját és a GitHub Actions
secreteket emiatt kézzel át kell állítani** — lásd `SETUP.md`.

---

## Funkciók

| Funkció | Státusz |
|---------|---------|
| B1-B2 szintfelmérés (20 kérdés) | ✅ |
| Napi practice session (5 típus) | ✅ |
| Gyengeség tracking kategóriánként | ✅ |
| Streak számolás | ✅ |
| Spaced repetition szókincs (SM-2) | ✅ |
| Reggeli email emlékeztető (07:00) | ✅ |
| Esti email emlékeztető (19:00) | ✅ |
| Heti összefoglaló generálás | ✅ |

---

## Fájlstruktúra

```
Gabor_1_German_language_agent/   (repó gyökér)
├── app.py           # Streamlit frontend + cron-job.org endpoint
├── agent.py         # Claude API: szintfelmérés, session gen/eval, heti összefoglaló
├── database.py      # Supabase: sessions, streak, error_categories, vocabulary
├── reminder.py      # Gmail SMTP HTML emlékeztető emailek
├── curriculum.py    # Linie B1.2 fejezetek + grammatika kategóriák
├── requirements.txt # Python függőségek
├── .env.example     # Szükséges environment változók listája
├── SETUP.md         # Deploy útmutató
└── README.md        # Ez a fájl
```

---

## Tech stack

| Réteg | Technológia | Megjegyzés |
|-------|-------------|------------|
| Frontend | Streamlit Cloud | ingyenes, auto-deploy GitHub-ról |
| AI | Claude claude-opus-4-7 | adaptive thinking + streaming + prompt caching |
| DB | Supabase (PostgreSQL) | ingyenes tier, 4 tábla |
| Email | Gmail SMTP port 465 SSL | App Password szükséges |
| Scheduler | cron-job.org | 2× naponta (07:00 és 19:00) |

---

## Supabase táblák

- `user_state` — egyetlen sor (id=1): assessment_done, assessment_results (JSONB), current_chapter, email, current_streak, longest_streak, last_session_date
- `sessions` — minden gyakorlási session: session_type, score, duration_minutes, errors (JSONB)
- `error_categories` — grammatika kategóriánként: total_attempts, wrong_attempts
- `vocabulary` — spaced repetition SM-2: german, hungarian, next_review, ease_factor, interval_days

SQL séma generálása:
```bash
python -c "from database import Database; print(Database.sql_setup())"
```

---

## Session típusok

| Típus | Leírás | Feladatszám |
|-------|--------|-------------|
| `lueckentext` | Lückentext – hiányzó szavak kitöltése | 6 |
| `fehlerkorrektur` | Hibás mondatok javítása | 6 |
| `schreiben` | Szabad fogalmazás (3-5 mondat) | 3 |
| `grammatik` | Intenzív grammatika drill | 8 |
| `vokabeln` | Szókincs (spaced repetition) | 8 |

---

## Emlékeztető flow

1. cron-job.org → GET `https://nyasikagerman.streamlit.app/?action=remind&token=deutsch-reminder-2026`
2. `app.py` elején: ha token egyezik `REMINDER_TOKEN` env var-ral → `reminder.send_reminder()` → `st.stop()`
3. Email: HTML, progress bar, streak badge, CTA gomb az appra

---

## Environment változók (Streamlit Secrets, TOML formátum)

```toml
ANTHROPIC_API_KEY = "sk-ant-..."
SUPABASE_URL = "https://qrcmwdsdipwixqqhhdby.supabase.co"
SUPABASE_KEY = "eyJ..."
APP_URL = "https://nyasikagerman.streamlit.app"
REMINDER_TOKEN = "deutsch-reminder-2026"
GMAIL_USER = "nyasika@gmail.com"
GMAIL_APP_PASSWORD = "xxxx xxxx xxxx xxxx"
```

---

## Lokális futtatás

```powershell
pip install -r requirements.txt
# töltsd ki a .env fájlt a .env.example alapján
python -m streamlit run app.py
```

---

## Deploy checklist (kész)

- [x] Supabase projekt létrehozva, SQL séma futtatva
- [x] RLS kikapcsolva mind a 4 táblán
- [x] Gmail App Password létrehozva
- [x] GitHub repó: github.com/nyasika/german-language-agent *(korábban AI-agents →
      personal-agents → ez, 2026-08-14)*
- [ ] Streamlit Cloud deploy: nyasikagerman.streamlit.app — **forrás-repó átállítása
      szükséges** a 2026-08-14-i áthelyezés után (l. tetején)
- [x] Streamlit Secrets beállítva
- [x] cron-job.org 2× napi trigger (07:00 és 19:00)
- [x] Email emlékeztető tesztelve ✅

---

## Ismert megoldott problémák

- `supabase>=2.15.0` pyiceberg C++ fordítót igényel Python 3.14-en → verzió pinelve `<2.15.0`
- Settings oldal csak assessment után volt elérhető → javítva: settings mindig elérhető
- Streamlit Cloud nem tölti be a `.env` fájlt → `python-dotenv` hozzáadva az `app.py` tetejére

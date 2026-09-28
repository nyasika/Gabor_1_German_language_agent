# Wortweg

A Duolingo-style German learning app for two 15-20 minute sessions a day: **7:00 review** (spaced repetition + colleague-mission phrases) and **20:30 lesson** (varied exercises + evening log). Installs on Android as an app, works on PC in the browser, costs about nothing to run.

## Status

| Part | State |
|---|---|
| Learning app (path, XP, streak, goal ring, FSRS review, 6 exercise types, evening log, stats, backup) | Built and tested in a real browser |
| Progress saving | After **every answer**, verified by test; export/restore in Settings |
| Phone + PC sync (Supabase) | Built, tested against a faked Supabase; **not yet run against your real project** |
| Push reminders 7:00 / 20:30 | Built, schedule logic tested (summer, winter, DST days); **not yet run end to end** |
| Content | 4 placeholder lessons (52 exercises), 46 cards, 24 colleague missions. **Linie B1.1/B1.2 chapters still to be added** |
| Speaking practice (browser speech, free) | Built: hear a phrase, say it, word-by-word feedback, confidence rating, conversation counter. Tested with a fake recogniser; **not yet tried with a real microphone on your phone** |
| Curriculum map | Drafted in `content/curriculum_map.json` (34 grammar topics, 13 vocabulary clusters, 12 situations, sprints); lessons still use the 4 placeholders |
| Not built yet | Sprint mechanism, real lessons from the map, placement test, writing task with feedback, more exercise types (transformation, dialogue, reading), boss challenges, weekly report |

## Run locally

```bash
npm install
npm run serve        # then open http://localhost:8080
npm test             # logic, content and sync tests
npm run e2e          # drives the real app in Edge (needs Edge installed)
npm run validate     # structural check of all lesson content
```

## Deploy (free)

1. Create a GitHub repo and push this folder. GitHub Pages on a free account needs a **public** repo; nothing secret is in it (progress lives in your browser and, if you enable sync, in your own Supabase row protected by login).
2. Repo Settings, Pages, Source: **GitHub Actions**. The `Deploy app` workflow tests and publishes `web/`.
3. On your Android phone open the site in Chrome, menu, **Add to Home screen** (or "Install app").

## Sync phone and PC (optional, recommended)

1. Create a free project at supabase.com. In the SQL editor run `supabase/schema.sql`.
2. Authentication, Users, **Add user** (email + password of your choice). Turn off public sign-ups in Authentication settings.
3. In the app, Settings, "Sync phone and PC": paste the project URL, the **anon** key, your email and password, tap **Save and sync now**. Do this on both devices.
4. Optional weekly safety net: add repo secrets `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`; the `Backup progress` workflow then stores a copy of your progress twice a week.

Sync merges instead of overwriting: phone and PC progress are combined, so doing the review on the phone and the lesson on the PC loses nothing.

## Reminders (7:00 and 20:30 Swiss time)

1. `npm run vapid` prints a key pair. Put the **public** key into `web/config.js` (`vapidPublicKey`), commit, deploy.
2. Add repo secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (e.g. `mailto:you@example.com`).
3. On the phone: Settings, "Reminders on this phone", **Enable reminders**, allow notifications, copy the text shown into the repo secret `PUSH_SUBSCRIPTION`.
4. Actions, Reminders, **Run workflow** with "force" ticked to send a test notification.
5. On Android, exclude Chrome/the app from battery optimisation, otherwise notifications can arrive late.

GitHub's scheduler can start a few minutes late; a run more than 45 minutes late is skipped rather than sent at a wrong time.

## Speaking

The **Speaking practice** card starts a 5-minute session: shadow a few phrases (listen, then repeat), say today's colleague missions from memory, and revisit phrases you found hard. You see word by word what the recogniser heard (green = right, amber = nearly, red = wrong or missing), get up to three tries, and can overrule a mishearing. At the end you rate your confidence 1-5; the Progress page shows the trend next to your count of German conversations.

- Uses the browser's built-in German voice and speech recognition: no account, no cost. Works best in **Chrome on Android**.
- In Chrome the audio goes to Google's speech service to become text. This app stores only the scores.
- It compares words, so it does **not** judge pronunciation quality (vowel length, ch/sch, intonation). If it mishears you, tap "Count it as correct".
- Practice phrases come from the spoken chunks of the curriculum map: after editing `content/curriculum_map.json` run `npm run chunks`.

## Adding the Linie chapters (superseded)

The curriculum map in `content/curriculum_map.json` replaces the plan to follow a textbook. The section below describes the lesson file format, which stays the same.


Content is plain JSON in `web/data/`:

- `path.json`: chapters and the order of lessons.
- `lessons/Lxx.json`: intro bullets and 10+ exercises (types: `mc`, `article`, `cloze`, `order`, `match`, `errorspot`). Every lesson needs at least 4 different types.
- `cards.json`: review deck (`flip` = Hungarian cue to German, `cloze` = typed gap). New cards enter at 4 per day plus 3 colleague missions.
- `missions.json`: phrases to use with your colleague that day.

Run `npm run validate` after editing: it checks, for example, that every word-order answer can be built from its tiles and every multiple-choice answer is among the options.

## How it works

- **Scheduler**: FSRS-4.5 (`web/js/fsrs.js`), target retention 90%.
- **Variety**: `buildLesson` cycles through exercise types, never repeats a type back to back, and never opens with the type that opened the previous lesson.
- **Mistakes come back**: a wrong answer is asked again at the end of the lesson and becomes a review card for the next session.
- **Streak**: a day counts at 10+ active minutes; one freeze is earned every 7 days (max 2) and covers one missed day.
- **Security**: all learning content is inserted as text (no `innerHTML`); Supabase access is protected by row level security.

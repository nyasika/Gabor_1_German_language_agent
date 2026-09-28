# Wortweg

A Duolingo-style German learning app for two 15-20 minute sessions a day: **7:00 review** (spaced repetition + colleague-mission phrases) and **20:30 lesson** (varied exercises + evening log). Installs on Android as an app, works on PC in the browser, costs about nothing to run.

## Status

| Part | State |
|---|---|
| Learning app (path, XP, streak, goal ring, FSRS review, 6 exercise types, evening log, stats, backup) | Built and tested in a real browser |
| Progress saving | After **every answer**, verified by test; export/restore in Settings |
| Phone + PC sync (Supabase) | Built, tested against a faked Supabase; **not yet run against your real project** |
| Push reminders 7:00 / 20:30 | Built, schedule logic tested (summer, winter, DST days); **not yet run end to end** |
| Curriculum map | `content/curriculum_map.json`: 34 grammar topics B1→C1 in prerequisite order (can-do statements + spoken chunks), 13 vocabulary clusters, 12 situations, sprint template. Original content, not the Linie textbook |
| Content | 12 real B1 lessons (G01-G12, 136 exercises) covering the map's B1 grammar topics, 46 review cards, 24 colleague missions. **B1+/B2/C1 lessons (G13-G34) not yet written** |
| Sprints (3-7 day topic deep-dives) | Built: notice → drill → drill → produce (speaking) → check, with a home-page suggestion when a topic's accuracy is low. 2 examples written (`G05` Konjunktiv II, `SP01` Hungarian-speaker pitfalls); more topics can be added as sprint content without touching the engine |
| Speaking practice (browser speech, free) | Built: hear a phrase, say it, word-by-word feedback, confidence rating, conversation counter. Tested with a fake recogniser; **not yet tried with a real microphone on your phone** |
| Not built yet | Lessons for G13-G34, more sprint topics, a placement test, writing task with AI feedback, more exercise types (transformation, dialogue, reading), boss challenges, weekly report |

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

## Sprints

A sprint is 3-7 focused days on one topic, on top of the normal daily path: **notice** (see the pattern in context) → **drill** → **drill** (form, then choice/meaning) → **produce** (say it, via the same speaking flow as daily practice) → **check** (mixed, scored). Reviews and lessons continue as normal alongside it.

- The Home page suggests a sprint once a topic has 6+ samples and under 60% accuracy, if sprint content exists for it (`suggestSprint` in `web/js/sprint.js`).
- Browse and start any sprint from the Progress page ("Browse sprints") or `#/sprints`.
- Mistakes on drill/check days become review cards, same as a lesson.
- **Adding a sprint**: write `web/data/sprints/<id>.json` (`notice`/`drill`/`drill`/`produce`/`check` days; drill/check days reuse the lesson exercise schema, produce uses `speak_items: [{id, de}]`), add its id to `web/data/sprints.json`, and make sure the id is in `web/data/topics.json` (regenerate with `npm run topics` after editing the curriculum map, or add an `extra_sprints` entry for a topic outside the grammar map). Run `npm run validate` — it checks day numbering, exercise structure, and id uniqueness across all sprints.

## Content format

Content is plain JSON in `web/data/`:

- `path.json`: chapters and the order of lessons. Lesson ids match the curriculum map's grammar topic ids (e.g. `G05`).
- `lessons/<id>.json`: intro bullets and 10+ exercises (types: `mc`, `article`, `cloze`, `order`, `match`, `errorspot`). Every lesson needs at least 4 different types. Each exercise's `topic` field should be a topic id from `topics.json`, so mastery and sprint suggestions line up.
- `cards.json`: review deck (`flip` = Hungarian cue to German, `cloze` = typed gap). New cards enter at 4 per day plus 3 colleague missions.
- `missions.json`: phrases to use with your colleague that day.
- `topics.json`, `chunks.json`: generated from `content/curriculum_map.json` via `npm run topics` / `npm run chunks` — edit the map, not these files.

Run `npm run validate` after editing: it checks, for example, that every word-order answer can be built from its tiles, every multiple-choice answer is among the options, and sprint days are numbered correctly.

## How it works

- **Scheduler**: FSRS-4.5 (`web/js/fsrs.js`), target retention 90%.
- **Variety**: `buildLesson` cycles through exercise types, never repeats a type back to back, and never opens with the type that opened the previous lesson.
- **Mistakes come back**: a wrong answer is asked again at the end of the lesson and becomes a review card for the next session.
- **Streak**: a day counts at 10+ active minutes; one freeze is earned every 7 days (max 2) and covers one missed day.
- **Security**: all learning content is inserted as text (no `innerHTML`); Supabase access is protected by row level security.

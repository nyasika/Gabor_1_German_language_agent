# Wortweg

A Duolingo-style German learning app, in Hungarian, for two 15-20 minute sessions a day: **7:00 review** (spaced repetition + colleague-mission phrases) and **20:30 lesson** (varied exercises + evening log). Installs on Android as an app, works on PC in the browser, costs about nothing to run.

## Status

| Part | State |
|---|---|
| Interface language | Hungarian throughout (buttons, instructions, exercise prompts, grammar explanations). German target content stays German |
| Learning app (free-choice grammar path, XP, streak, goal ring, FSRS review, 6 exercise types, evening log, stats, backup) | Built and tested in a real browser |
| Progress saving | After **every answer**, verified by test; export/restore in Settings |
| Phone + PC sync (Supabase) | Built, tested against a faked Supabase; **not yet run against your real project** |
| Push reminders 7:00 / 20:30 | Built, schedule logic tested (summer, winter, DST days); **not yet run end to end** |
| Curriculum map | `content/curriculum_map.json`: 46 grammar topics A1→C1 in prerequisite order (Hungarian can-do statements + spoken chunks) - 12 new A1-A2 fundamentals (`F01`-`F12`) plus the original 34 B1→C1 topics (`G01`-`G34`) - 13 vocabulary clusters, 12 situations, sprint template. Original content, not the Linie textbook |
| Grammar path (free choice, no locking) | Every lesson is always open, in any order - the path's chapters are a suggested grouping, not a gate. Completing one just checks it off (`✓`) and feeds its mistakes into review; nothing blocks starting any other lesson first. 13 lessons written: `F01` (A1 fundamentals pilot: nouns/articles `der/die/das`) plus `G01`-`G12` (B1, 170 exercises total). Lesson intros can carry `examples` (sentence pairs) and a `pitfalls` callout alongside the description and tables - `F01` is the pilot for that too. `G01` is also a pilot for difficulty-tagged practice (10 easy/medium/hard exercises each, repeatable from its intro screen). **F02-F12 (A1-A2) and G13-G34 (B1+/B2/C1) not yet written** |
| Sprints (3-7 day topic deep-dives) | Built: notice → drill → drill → produce (speaking) → check, with a home-page suggestion when a topic's accuracy is low. 2 examples written (`G05` Konjunktiv II, `SP01` Hungarian-speaker pitfalls); more topics can be added as sprint content without touching the engine |
| Vocabulary topics (pick what to learn) | Built: real-world topics (office work, transport, doctor, ...) instead of a fixed rotation. Activating a topic seeds a few words right away and feeds the rest into the normal daily new-card pacing, all the way up to the topic's deepest level (A2→C1). `office` is the pilot, written out to C1 (81 words, nouns carry `der/die/das`, verbs their Präteritum/Partizip II). The other 9 topics (transport, health, kids/Kita, housing, admin, banking, shopping, clubs, telecom) are listed but not yet written |
| Speaking practice (browser speech, free) | Built: hear a phrase, say it, word-by-word feedback, confidence rating, conversation counter. Tested with a fake recogniser; **not yet tried with a real microphone on your phone** |
| Not built yet | A1-A2 fundamentals F02-F12, B1+/B2/C1 lessons G13-G34, difficulty-tagged practice for lessons beyond G01, vocabulary content for the 9 topics beyond office work, more sprint topics, a placement test, writing task with AI feedback, more exercise types (transformation, dialogue, reading), boss challenges, weekly report |

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

## Reminders (nominally 7:00 and 20:30 Swiss time)

1. `npm run vapid` prints a key pair. Put the **public** key into `web/config.js` (`vapidPublicKey`), commit, deploy.
2. Add repo secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (e.g. `mailto:you@example.com`).
3. On the phone: Settings, "Reminders on this phone", **Enable reminders**, allow notifications, copy the text shown into the repo secret `PUSH_SUBSCRIPTION`.
4. Actions, Reminders, **Run workflow** with "force" ticked to send a test notification.
5. On Android, exclude Chrome/the app from battery optimisation, otherwise notifications can arrive late.

GitHub's scheduler for this repo has been landing scheduled runs hours after their cron time, sometimes past local midnight - too unreliable to key sending off "is it close to the target clock time right now". Instead `scripts/send_push.mjs` / `reminder_slots.mjs` track, in `reminder_state.json`, the last Zurich-local calendar day each slot (`review` / `lesson`) was actually sent, and send any slot whose latest occurrence isn't recorded yet - whenever GitHub next happens to run the job, however late. The workflow commits that file back after a successful send. This means reminders arrive reliably once a day each, but not at a precise time; a slot can land well after 7:00 or 20:30 if GitHub itself is slow.

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

## Vocabulary topics

A separate, lighter-weight track next to the lessons, organized by real-world topic instead of grammatical category: pick what you actually need (office work, transport, doctor, kids/Kita, ...) rather than working through a fixed rotation, and go as deep as you want — each topic's words are ordered A2→B1→B2→C1, so picking a topic means picking how far to go, not a word count.

- Browse topics and their word lists at `#/vocab` / `#/vocab/<id>` (`web/js/vocab_view.js`). A topic with no content yet shows "Hamarosan".
- **Activating** a topic (`activateTopic` in `web/js/vocabtopics.js`) seeds a handful of its words as review cards immediately, for visible feedback, then the rest trickles in through the normal daily new-card cap (`combinedVocabDeck` feeds `introduceNewCards`, round-robining across every active topic so picking several doesn't starve the others). Deactivating stops new words but never removes cards already added.
- A word you miss on first try comes back exactly like any other review card — there is no separate "missed words" mechanic, the FSRS scheduler already does this.
- Noun cards always show the article on the back (`die Besprechung`, not just `Besprechung`), so gender is learned together with the word, never separately. Verb cards with past-tense forms show all three principal parts: `anrufen – rief an – hat angerufen`.
- **Adding a topic's content**: fill in its `items` array in `web/data/vocab_topics.json`. Each item needs `type` (`noun`/`verb`/`adjective`/`adverb`/`phrase`), `de`, `hu`, `level` (`A2`/`B1`/`B2`/`C1`); nouns need `artikel` (`der`/`die`/`das`); a verb's `praeteritum`/`partizip2`/`aux` (`sein`/`haben`) are optional but must come as a complete set if given. Keep items ordered A2→C1 within the topic — that order is what paces daily introduction. Run `npm run validate` (`tools/validate_vocabtopics.mjs`) — it checks all of this plus no duplicate words within a topic. `office` is the fully-written pilot to copy the pattern from.

## Content format

Content is plain JSON in `web/data/`:

- `path.json`: chapters and a suggested order of lessons - **not a gate**: every lesson is always open regardless of chapter or position (`web/js/session.js` has no lock check any more; `nextLesson()` is only Home's "what's next" suggestion). Lesson ids match the curriculum map's grammar topic ids (e.g. `G05`, `F01`).
- `lessons/<id>.json`: `intro` (an array of Hungarian paragraphs — these are meant to be long and detailed, not terse bullets), optional `examples` (an array of `{de, hu}` example-sentence pairs, rendered under "Példamondatok") and `pitfalls` (an array of Hungarian strings, rendered as a "Mikre figyelj" callout), an optional `tables` array for declension/conjugation patterns (`{title, headers, rows}}`, rendered as a real, horizontally-scrollable `<table>`), and 10+ exercises (types: `mc`, `article`, `cloze`, `order`, `match`, `errorspot`). Every lesson needs at least 4 different exercise types. Each exercise's `topic` field should be a topic id from `topics.json`, so mastery and sprint suggestions line up. Exercise instructions/prompts are Hungarian; the German sentences, tiles and answers stay German. `F01` is the pilot for the full shape (description + examples + pitfalls + exercises); the `G01`-`G12` B1 lessons don't have `examples`/`pitfalls` yet.
- **Difficulty-tagged practice** (optional, currently only `G01`): tag exercises with `"level": "easy"|"medium"|"hard"`. Once a lesson has 5+ exercises at a level, its intro screen shows a "Gyakorlás" button for that level, linking to `#/run/<id>/<level>` — a fresh 10-exercise session sampled only from that difficulty, as many times as you like. It doesn't touch the lesson's done/bestScore bookkeeping (that's still only set by the untagged first pass through the full pool), but mistakes still become review cards as usual. The normal, first-time lesson run ignores `level` and samples from the whole pool. Rolling this out to more lessons means tagging ~10 exercises per level per lesson (see `G01.json` for the pattern).
- `cards.json`: review deck (`flip` = Hungarian cue to German, `cloze` = typed gap). New cards enter at 4 per day plus 3 colleague missions.
- `missions.json`: phrases to use with your colleague that day.
- `vocab_topics.json`: the topic-picker vocabulary track, see above.
- `topics.json`, `chunks.json`: generated from `content/curriculum_map.json` via `npm run topics` / `npm run chunks` — edit the map, not these files. Topic `title`/`cando` in the map are Hungarian; regenerate after editing.

Run `npm run validate` after editing: it checks, for example, that every word-order answer can be built from its tiles, every multiple-choice answer is among the options, sprint days are numbered correctly, every grammar table's rows match its header count, a lesson's `examples`/`pitfalls` are well-formed when present, and vocab topic nouns/verbs carry a valid artikel/past-tense set.

## How it works

- **Scheduler**: FSRS-4.5 (`web/js/fsrs.js`), target retention 90%.
- **Variety**: `buildLesson` cycles through exercise types, never repeats a type back to back, and never opens with the type that opened the previous lesson.
- **Mistakes come back**: a wrong answer is asked again at the end of the lesson and becomes a review card for the next session.
- **Streak**: a day counts at 10+ active minutes; one freeze is earned every 7 days (max 2) and covers one missed day.
- **Security**: all learning content is inserted as text (no `innerHTML`); Supabase access is protected by row level security.

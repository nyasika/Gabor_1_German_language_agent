import { h, ring, bar, fmtMin, mount } from './ui.js';
import { createExercise, cardFromExercise, TYPE_LABEL } from './exercises.js';
import { localDateStr, review, previewIntervals, formatInterval, newCardFields, addDays } from './fsrs.js';
import {
  addActivity, dayTotals, totalXp, levelInfo, updateStreak, displayStreak, recordTopic, mastery, wordsStuck,
} from './progress.js';
import { buildLesson, introduceNewCards, dueCards, pickMissions, nextLesson, isUnlocked } from './session.js';
import { CONFIG } from '../config.js';
import { enablePush, pushSupported } from './push.js';

const errorBox = (e) => h('div', { class: 'card error' }, h('strong', {}, 'Something went wrong'), h('p', {}, String(e?.message || e)));

function topBar(title, ctx, { back = '#/' } = {}) {
  return h('div', { class: 'runbar' },
    h('button', { class: 'btn ghost small', onclick: () => ctx.go(back) }, 'Quit'),
    h('span', { class: 'runtitle' }, title));
}

// ---------------------------------------------------------------- Home
export function homeView(ctx) {
  const today = localDateStr();
  const { store, data } = ctx;
  store.save((s) => introduceNewCards(s, data, today));
  const s = store.get();
  const totals = dayTotals(s, today);
  const goal = s.settings.dailyGoalMin * 60;
  const xp = totalXp(s);
  const lv = levelInfo(xp);
  const streak = displayStreak(s, today);
  const due = dueCards(s, today, 30).length;
  const reviewDone = (s.log[today]?.review?.answers || 0) > 0;
  const lessonDone = (s.log[today]?.lesson?.answers || 0) > 0;
  const nextId = nextLesson(data.path, s);
  const nextTitle = nextId ? data.lessonTitles[nextId] : null;
  const missions = pickMissions(data.missions, today, s.settings.missionsPerDay);
  const used = new Set(s.missionsUsed[today] || []);

  const missionRows = missions.map((m) =>
    h('label', { class: 'mission' },
      h('input', { type: 'checkbox', checked: used.has(m.id) ? true : null, onchange: (e) => {
        store.save((st) => {
          const set = new Set(st.missionsUsed[today] || []);
          if (e.target.checked) set.add(m.id); else set.delete(m.id);
          st.missionsUsed[today] = [...set];
        });
      } }),
      h('span', {}, h('strong', {}, m.de), h('em', {}, `${m.en} · ${m.hu}`))));

  const pathRows = data.path.chapters.map((ch) => {
    const done = ch.lessons.filter((id) => s.lessons[id]?.done).length;
    return h('div', { class: 'chrow' }, h('span', {}, ch.title), h('span', { class: 'muted' }, `${done}/${ch.lessons.length}`),
      bar(done / ch.lessons.length));
  });

  return h('div', { class: 'home' },
    h('section', { class: 'hero card' },
      ring(totals.seconds / goal, fmtMin(totals.seconds), `of ${s.settings.dailyGoalMin} min`),
      h('div', { class: 'hero-stats' },
        h('div', { class: 'stat' }, h('strong', {}, streak), h('span', {}, streak === 1 ? 'day streak' : 'day streak')),
        h('div', { class: 'stat' }, h('strong', {}, `Lv ${lv.level}`), h('span', {}, `${xp} XP`)),
        h('div', { class: 'stat' }, h('strong', {}, wordsStuck(s)), h('span', {}, 'words stuck'))),
      h('div', { class: 'lvbar' }, bar(lv.into / lv.span), h('small', {}, `${lv.span - lv.into} XP to level ${lv.level + 1}`))),

    h('section', { class: 'card session' },
      h('div', { class: 'session-head' }, h('h2', {}, 'Session 1 · Review'), h('span', { class: `chip ${reviewDone ? 'ok' : ''}` }, reviewDone ? 'done today' : '7:00')),
      h('p', { class: 'muted' }, `${due} card${due === 1 ? '' : 's'} waiting, plus today's colleague missions.`),
      h('a', { class: 'btn primary', href: '#/review' }, reviewDone ? 'Review more' : 'Start review')),

    h('section', { class: 'card session' },
      h('div', { class: 'session-head' }, h('h2', {}, 'Session 2 · Lesson'), h('span', { class: `chip ${lessonDone ? 'ok' : ''}` }, lessonDone ? 'done today' : '20:30')),
      nextId
        ? h('p', { class: 'muted' }, `Next: ${nextTitle}`)
        : h('p', { class: 'muted' }, 'You finished every lesson in the path. Replay one from the path to keep it fresh.'),
      nextId ? h('a', { class: 'btn primary', href: `#/lesson/${nextId}` }, lessonDone ? 'One more lesson' : 'Start lesson') : h('a', { class: 'btn', href: '#/path' }, 'Open path')),

    h('section', { class: 'card' },
      h('h2', {}, "Today's colleague missions"),
      h('p', { class: 'muted' }, 'Try to use each phrase in a real conversation today. Tick it when you did.'),
      h('div', { class: 'missions' }, missionRows),
      h('a', { class: 'btn', href: '#/log' }, 'Evening log: what I could not say')),

    h('section', { class: 'card' }, h('h2', {}, 'Your path'), pathRows, h('a', { class: 'btn ghost', href: '#/path' }, 'Open full path')));
}

// ---------------------------------------------------------------- Path
export function pathView(ctx) {
  const s = ctx.store.get();
  const { data } = ctx;
  return h('div', {},
    h('h1', {}, 'Learning path'),
    data.path.note ? h('p', { class: 'muted note' }, 'Placeholder chapters: they will be replaced by the Linie B1.1 and B1.2 chapters.') : null,
    data.path.chapters.map((ch) => {
      const done = ch.lessons.filter((id) => s.lessons[id]?.done).length;
      return h('section', { class: 'card chapter' },
        h('div', { class: 'chapter-head' }, h('div', {}, h('h2', {}, ch.title), h('p', { class: 'muted' }, ch.subtitle)), h('span', { class: 'chip' }, `${done}/${ch.lessons.length}`)),
        ch.lessons.map((id) => {
          const l = s.lessons[id];
          const unlocked = isUnlocked(data.path, s, id);
          const status = l?.done ? `Done · ${Math.round((l.bestScore || 0) * 100)}%` : unlocked ? 'Ready' : 'Locked';
          return h(unlocked ? 'a' : 'div', { class: `node ${l?.done ? 'done' : unlocked ? 'open' : 'locked'}`, href: unlocked ? `#/lesson/${id}` : null },
            h('span', { class: 'node-dot' }, l?.done ? '✓' : unlocked ? '▶' : ''),
            h('span', { class: 'node-title' }, data.lessonTitles[id]),
            h('span', { class: 'node-status' }, status));
        }));
    }));
}

export function lessonIntroView(ctx, id) {
  const root = h('div', {}, h('p', { class: 'muted' }, 'Loading…'));
  ctx.data.loadLesson(id).then((lesson) => {
    const s = ctx.store.get();
    if (!isUnlocked(ctx.data.path, s, id)) {
      mount(root, h('div', { class: 'card' }, h('h2', {}, lesson.title), h('p', {}, 'Finish the previous lesson first.'), h('a', { class: 'btn', href: '#/path' }, 'Back to path')));
      return;
    }
    mount(root, h('div', { class: 'card' },
      h('p', { class: 'eyebrow' }, lesson.topic),
      h('h1', {}, lesson.title),
      h('ul', { class: 'intro' }, lesson.intro.map((t) => h('li', {}, t))),
      h('p', { class: 'muted' }, '10 exercises, about 5 minutes. Mistakes come back at the end of the lesson and as review cards tomorrow.'),
      h('a', { class: 'btn primary', href: `#/run/${id}` }, 'Start lesson'),
      h('a', { class: 'btn ghost', href: '#/path' }, 'Back')));
  }).catch((e) => mount(root, errorBox(e)));
  return root;
}

// ---------------------------------------------------------------- Lesson runner
export function lessonRunView(ctx, lessonId) {
  const root = h('div', { class: 'run' }, h('p', { class: 'muted' }, 'Loading…'));
  ctx.data.loadLesson(lessonId).then(start).catch((e) => mount(root, errorBox(e)));

  function start(lesson) {
    const today = localDateStr();
    const items = buildLesson(lesson.exercises, { n: 10, prevLead: ctx.store.get().lastLead });
    ctx.store.save((s) => { s.lastLead = items[0]?.type ?? null; });
    const queue = items.map((ex) => ({ ex, retry: false }));
    const firstTry = {};
    let idx = 0;
    let xpGained = 0;
    ctx.tracker();
    next();

    function next() {
      if (idx >= queue.length) return finish();
      const { ex, retry } = queue[idx];
      let answered = false;
      const exercise = createExercise(ex, { onSubmit: () => { if (!answered && exercise.ready()) submit(); } });
      const checkBtn = h('button', { class: 'btn primary', disabled: true, onclick: () => submit() }, 'Check');
      exercise.onChange(() => { checkBtn.disabled = !exercise.ready(); });
      const feedback = h('div', { class: 'feedback' });
      const footer = h('div', { class: 'footer' }, checkBtn);
      mount(root, 
        topBar(lesson.title, ctx),
        bar(idx / queue.length, 'progress'),
        h('p', { class: 'eyebrow' }, TYPE_LABEL[ex.type], retry ? h('span', { class: 'chip warn' }, 'second try') : null),
        exercise.el, feedback, footer);
      exercise.focus();

      function submit() {
        if (answered) return;
        answered = true;
        const res = exercise.check();
        const secs = ctx.tracker();
        const first = !retry;
        const gain = first && res.correct ? 10 : 0;
        xpGained += gain;
        ctx.store.save((s) => {
          addActivity(s, today, 'lesson', { seconds: secs, answers: first ? 1 : 0, correct: first && res.correct ? 1 : 0, xp: gain });
          if (first) recordTopic(s, ex.topic, res.correct);
          if (!res.correct) {
            const card = cardFromExercise(ex);
            if (card && !s.cards[card.id]) s.cards[card.id] = { ...card, ...newCardFields() };
          }
          updateStreak(s, today);
        });
        if (first) firstTry[ex.id] = res.correct;
        if (!res.correct && first) queue.push({ ex, retry: true });
        feedback.className = `feedback ${res.correct ? 'right' : 'wrong'}`;
        mount(feedback, 
          h('strong', {}, res.correct ? (gain ? 'Richtig! +10 XP' : 'Richtig!') : 'Not quite'),
          res.correct ? null : h('p', {}, 'Correct: ', h('b', {}, res.answerText)),
          ex.explain ? h('p', { class: 'muted' }, ex.explain) : null,
          !res.correct && first ? h('p', { class: 'muted' }, 'This one will come back at the end and as a review card.') : null);
        mount(footer, h('button', { class: 'btn primary', onclick: () => { idx += 1; next(); } }, idx + 1 >= queue.length ? 'Finish' : 'Continue'));
      }
    }

    function finish() {
      const total = items.length;
      const ok = items.filter((ex) => firstTry[ex.id]).length;
      const score = ok / total;
      const first = !ctx.store.get().lessons[lessonId]?.done;
      const bonus = first ? 20 : 5;
      ctx.store.save((s) => {
        const l = (s.lessons[lessonId] ||= { done: false, bestScore: 0, attempts: 0, completedAt: null });
        l.done = true;
        l.attempts += 1;
        l.bestScore = Math.max(l.bestScore || 0, score);
        l.completedAt ||= today;
        addActivity(s, today, 'lesson', { xp: bonus });
      });
      const nextId = nextLesson(ctx.data.path, ctx.store.get());
      mount(root, h('div', { class: 'card summary' },
        h('p', { class: 'eyebrow' }, 'Lesson complete'),
        h('h1', {}, `${Math.round(score * 100)}% first try`),
        h('p', {}, `${ok} of ${total} correct on the first attempt · +${xpGained + bonus} XP${first ? ' (includes lesson bonus)' : ''}`),
        score < 0.7 ? h('p', { class: 'muted' }, 'Worth a replay later. Your mistakes are already in tomorrow\'s review.') : h('p', { class: 'muted' }, 'Nice. Your mistakes are queued for review tomorrow.'),
        h('a', { class: 'btn primary', href: '#/log' }, 'Evening log: what I could not say today'),
        nextId ? h('a', { class: 'btn', href: `#/lesson/${nextId}` }, 'Next lesson') : null,
        h('a', { class: 'btn ghost', href: '#/' }, 'Home')));
    }
  }
  return root;
}

// ---------------------------------------------------------------- Review runner
export function reviewRunView(ctx) {
  const today = localDateStr();
  const root = h('div', { class: 'run' });
  ctx.store.save((s) => introduceNewCards(s, ctx.data, today));
  const s0 = ctx.store.get();
  const missions = pickMissions(ctx.data.missions, today, s0.settings.missionsPerDay);
  const queue = dueCards(s0, today, 30).map((c) => ({ id: c.id, practice: false }));
  const requeued = new Set();
  let idx = 0;
  let good = 0;
  let graded = 0;
  let xp = 0;

  mount(root, 
    topBar('Review', ctx),
    h('div', { class: 'card' },
      h('p', { class: 'eyebrow' }, 'Colleague missions for today'),
      h('p', { class: 'muted' }, 'Read them once, then try to use them in real conversations.'),
      h('div', { class: 'missions readonly' }, missions.map((m) =>
        h('div', { class: 'mission' }, h('span', {}, h('strong', {}, m.de), h('em', {}, `${m.en} · ${m.hu}`))))),
      h('button', { class: 'btn primary', onclick: () => { ctx.tracker(); next(); } }, queue.length ? `Start review (${queue.length} cards)` : 'Continue')));

  function next() {
    if (idx >= queue.length) return finish();
    const { id, practice } = queue[idx];
    const card = ctx.store.get().cards[id];
    if (!card) { idx += 1; return next(); }
    mount(root, topBar('Review', ctx), bar(idx / queue.length, 'progress'),
      h('p', { class: 'eyebrow' }, card.state === 'new' ? 'New card' : practice ? 'Once more' : 'Review',
        card.src === 'error' ? h('span', { class: 'chip warn' }, 'from your mistakes') : null),
      card.type === 'cloze' ? clozeCard(card, practice) : flipCard(card, practice));
  }

  function grade(id, rating, practice) {
    const secs = ctx.tracker();
    const gain = rating > 1 ? (rating === 2 ? 3 : 5) : 1;
    ctx.store.save((s) => {
      if (!practice) s.cards[id] = review(s.cards[id], rating, today);
      addActivity(s, today, 'review', { seconds: secs, answers: practice ? 0 : 1, correct: !practice && rating > 1 ? 1 : 0, xp: practice ? 0 : gain });
      updateStreak(s, today);
    });
    if (!practice) {
      graded += 1;
      xp += gain;
      if (rating > 1) good += 1;
      if (rating === 1 && !requeued.has(id)) { requeued.add(id); queue.push({ id, practice: true }); }
    }
    idx += 1;
    next();
  }

  function flipCard(card, practice) {
    const face = h('div', { class: 'card-face' }, h('div', { class: 'card-cue' }, card.front), card.hint ? h('div', { class: 'muted' }, card.hint) : null);
    const actions = h('div', { class: 'footer' });
    const reveal = h('button', { class: 'btn primary', onclick: () => {
      face.append(h('div', { class: 'card-answer' }, card.back));
      if (practice) {
        mount(actions, h('button', { class: 'btn primary', onclick: () => grade(card.id, 3, true) }, 'Got it'));
        return;
      }
      const p = previewIntervals(card, today);
      mount(actions, h('div', { class: 'rate' }, [['Again', 1], ['Hard', 2], ['Good', 3], ['Easy', 4]].map(([name, r]) =>
        h('button', { class: `btn rate-${name.toLowerCase()}`, onclick: () => grade(card.id, r, false) }, name, h('small', {}, formatInterval(p[name]))))));
    } }, 'Show answer');
    actions.append(reveal);
    return h('div', {}, face, actions);
  }

  function clozeCard(card, practice) {
    const submit = () => { if (ex.ready() && !done) check(); };
    let done = false;
    const ex = createExercise({ type: 'cloze', sentence: card.sentence, answers: card.answers, hint: card.hu, prompt: null }, { onSubmit: submit });
    const feedback = h('div', { class: 'feedback' });
    const footer = h('div', { class: 'footer' });
    const checkBtn = h('button', { class: 'btn primary', disabled: true, onclick: submit }, 'Check');
    ex.onChange(() => { checkBtn.disabled = !ex.ready(); });
    footer.append(checkBtn);
    function check() {
      done = true;
      const res = ex.check();
      feedback.className = `feedback ${res.correct ? 'right' : 'wrong'}`;
      mount(feedback, h('strong', {}, res.correct ? 'Richtig!' : 'Not quite'), res.correct ? null : h('p', {}, 'Correct: ', h('b', {}, res.answerText)));
      mount(footer, h('button', { class: 'btn primary', onclick: () => grade(card.id, res.correct ? 3 : 1, practice) }, 'Continue'));
    }
    setTimeout(() => ex.focus(), 0);
    return h('div', {}, ex.el, feedback, footer);
  }

  function finish() {
    const s = ctx.store.get();
    mount(root, h('div', { class: 'card summary' },
      h('p', { class: 'eyebrow' }, 'Review complete'),
      h('h1', {}, graded ? `${good} of ${graded} remembered` : 'Nothing due right now'),
      h('p', {}, graded ? `+${xp} XP · ${wordsStuck(s)} words have stuck (21+ day memory)` : 'Come back after your next lesson: mistakes turn into review cards.'),
      h('a', { class: 'btn primary', href: '#/' }, 'Home'),
      h('a', { class: 'btn', href: '#/log' }, 'Evening log')));
  }
  return root;
}

// ---------------------------------------------------------------- Evening log
export function logView(ctx) {
  const today = localDateStr();
  const root = h('div', {});
  function render() {
    const s = ctx.store.get();
    const wanted = h('textarea', { rows: 3, placeholder: 'e.g. I wanted to say that we should move the meeting to Thursday', 'aria-label': 'What I wanted to say' });
    const german = h('input', { type: 'text', placeholder: 'German version (optional)', 'aria-label': 'German version' });
    const save = h('button', { class: 'btn primary', onclick: () => {
      const text = wanted.value.trim();
      if (!text) return;
      const de = german.value.trim();
      const id = `g${Date.now()}`;
      ctx.store.save((st) => {
        st.gaps.push({ id, date: today, text, de, converted: !!de });
        if (de) st.cards[`gap_${id}`] = { id: `gap_${id}`, type: 'flip', src: 'gap', front: text, back: de, hint: 'from my evening log', ...newCardFields() };
        addActivity(st, today, 'extra', { xp: 5, seconds: ctx.tracker() });
        updateStreak(st, today);
      });
      render();
    } }, 'Save');
    const recent = [...s.gaps].reverse().slice(0, 10).map((g) => {
      const input = h('input', { type: 'text', placeholder: 'Add the German phrase', 'aria-label': 'German phrase' });
      return h('div', { class: 'gap' },
        h('div', {}, h('small', { class: 'muted' }, g.date), h('p', {}, g.text), g.de ? h('p', { class: 'de' }, g.de) : null),
        g.de ? null : h('div', { class: 'gap-add' }, input, h('button', { class: 'btn small', onclick: () => {
          const de = input.value.trim();
          if (!de) return;
          ctx.store.save((st) => {
            const gap = st.gaps.find((x) => x.id === g.id);
            gap.de = de;
            gap.converted = true;
            st.cards[`gap_${g.id}`] = { id: `gap_${g.id}`, type: 'flip', src: 'gap', front: gap.text, back: de, hint: 'from my evening log', ...newCardFields() };
          });
          render();
        } }, 'Make card')));
    });
    mount(root, 
      h('h1', {}, 'Evening log'),
      h('div', { class: 'card' },
        h('p', { class: 'muted' }, 'What did you want to say today but could not (or said wrongly)? With a German version it becomes a review card.'),
        wanted, german, save),
      recent.length ? h('div', { class: 'card' }, h('h2', {}, 'Recent entries'), recent) : null);
  }
  render();
  return root;
}

// ---------------------------------------------------------------- Stats
function heatmap(s, today) {
  const dt = new Date(`${today}T00:00:00`);
  const weekday = (dt.getDay() + 6) % 7;
  const start = addDays(today, -(weekday + 77));
  const cells = [];
  for (let i = 0; i < 84; i++) {
    const date = addDays(start, i);
    const min = dayTotals(s, date).seconds / 60;
    const lvl = date > today ? 'future' : min <= 0 ? 0 : min < 10 ? 1 : min < 20 ? 2 : min < 30 ? 3 : 4;
    cells.push(h('div', { class: `hm hm-${lvl}`, title: `${date}: ${Math.round(min)} min` }));
  }
  return h('div', { class: 'heatmap', 'aria-label': 'Activity in the last 12 weeks' }, cells);
}

export function statsView(ctx) {
  const s = ctx.store.get();
  const today = localDateStr();
  const xp = totalXp(s);
  const lv = levelInfo(xp);
  let weekSec = 0;
  for (let i = 0; i < 7; i++) weekSec += dayTotals(s, addDays(today, -i)).seconds;
  const topics = Object.keys(s.topics).sort();
  const cards = Object.values(s.cards);
  const learned = cards.filter((c) => c.state === 'review').length;
  return h('div', {},
    h('h1', {}, 'Progress'),
    h('section', { class: 'card grid4' },
      h('div', { class: 'stat' }, h('strong', {}, `Lv ${lv.level}`), h('span', {}, `${xp} XP`)),
      h('div', { class: 'stat' }, h('strong', {}, displayStreak(s, today)), h('span', {}, `streak (best ${s.streak.longest})`)),
      h('div', { class: 'stat' }, h('strong', {}, wordsStuck(s)), h('span', {}, `words stuck of ${learned} learned`)),
      h('div', { class: 'stat' }, h('strong', {}, fmtMin(weekSec)), h('span', {}, 'last 7 days'))),
    h('section', { class: 'card' }, h('h2', {}, 'Last 12 weeks'), heatmap(s, today),
      h('p', { class: 'muted small' }, `Streak freezes available: ${s.streak.freezes}. A day counts at ${s.settings.streakMinMinutes}+ minutes.`)),
    h('section', { class: 'card' }, h('h2', {}, 'Grammar mastery'),
      topics.length ? topics.map((t) => {
        const m = mastery(s, t);
        return h('div', { class: 'chrow' }, h('span', {}, t), h('span', { class: 'muted' }, `${Math.round(m * 100)}% · last ${s.topics[t].hist.length}`), bar(m, m < 0.6 ? 'low' : ''));
      }) : h('p', { class: 'muted' }, 'Finish a lesson to see mastery per topic.')));
}

// ---------------------------------------------------------------- Settings
function numberField(ctx, label, key, min, max) {
  const s = ctx.store.get();
  return h('label', { class: 'field' }, h('span', {}, label),
    h('input', { type: 'number', min, max, value: s.settings[key], onchange: (e) => {
      const v = Math.max(min, Math.min(max, Number(e.target.value) || min));
      ctx.store.save((st) => { st.settings[key] = v; });
      e.target.value = v;
    } }));
}

export function settingsView(ctx) {
  const root = h('div', {});
  function render() {
    const s = ctx.store.get();
    const st = ctx.sync.status();
    const url = h('input', { type: 'url', value: s.settings.sync.url, placeholder: 'https://xxxx.supabase.co', 'aria-label': 'Supabase URL' });
    const key = h('input', { type: 'text', value: s.settings.sync.anonKey, placeholder: 'anon public key', 'aria-label': 'Supabase anon key' });
    const email = h('input', { type: 'email', value: s.settings.sync.email, placeholder: 'email', autocomplete: 'username', 'aria-label': 'Email' });
    const pw = h('input', { type: 'password', value: ctx.sync.getPassword(), placeholder: 'password (stored on this device only)', autocomplete: 'current-password', 'aria-label': 'Password' });
    const fileInput = h('input', { type: 'file', accept: 'application/json', class: 'hidden', onchange: async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try { ctx.store.importJson(await f.text()); render(); alert('Backup restored.'); } catch (err) { alert(`Import failed: ${err.message}`); }
    } });
    const pushOut = h('div', {});
    mount(root, 
      h('h1', {}, 'Settings'),
      h('section', { class: 'card' }, h('h2', {}, 'Daily plan'),
        numberField(ctx, 'Daily goal (minutes)', 'dailyGoalMin', 5, 120),
        numberField(ctx, 'Minutes that keep the streak', 'streakMinMinutes', 1, 60),
        numberField(ctx, 'New vocabulary cards per day', 'newVocabPerDay', 0, 15),
        numberField(ctx, 'Colleague mission phrases per day', 'missionsPerDay', 0, 8),
        h('p', { class: 'muted small' }, 'Reminders are planned for 7:00 and 20:30 Swiss time.')),
      h('section', { class: 'card' }, h('h2', {}, 'Backup'),
        h('p', { class: 'muted' }, 'Progress is saved on this device after every answer. Download a backup now and then, or turn on sync below.'),
        h('div', { class: 'row' },
          h('button', { class: 'btn', onclick: () => {
            const blob = new Blob([ctx.store.exportJson()], { type: 'application/json' });
            const a = h('a', { href: URL.createObjectURL(blob), download: `wortweg-backup-${localDateStr()}.json` });
            document.body.append(a); a.click(); a.remove();
          } }, 'Download backup'),
          h('button', { class: 'btn', onclick: () => fileInput.click() }, 'Restore from file'), fileInput)),
      h('section', { class: 'card' }, h('h2', {}, 'Sync phone and PC (optional)'),
        h('p', { class: 'muted' }, `Status: ${st.message}`),
        h('label', { class: 'field col' }, h('span', {}, 'Supabase URL'), url),
        h('label', { class: 'field col' }, h('span', {}, 'Anon key'), key),
        h('label', { class: 'field col' }, h('span', {}, 'Email'), email),
        h('label', { class: 'field col' }, h('span', {}, 'Password'), pw),
        h('button', { class: 'btn primary', onclick: async () => {
          ctx.store.save((x) => { x.settings.sync = { url: url.value.trim(), anonKey: key.value.trim(), email: email.value.trim() }; });
          ctx.sync.setPassword(pw.value);
          await ctx.sync.syncNow();
          render();
        } }, 'Save and sync now')),
      h('section', { class: 'card' }, h('h2', {}, 'Reminders on this phone'),
        pushSupported()
          ? h('div', {}, h('p', { class: 'muted' }, CONFIG.vapidPublicKey ? 'Allow notifications, then copy the subscription into the reminder job (see README).' : 'Push is not configured yet: set vapidPublicKey in web/config.js (see README).'),
            h('button', { class: 'btn', disabled: !CONFIG.vapidPublicKey, onclick: async () => {
              try {
                const json = await enablePush(CONFIG.vapidPublicKey);
                mount(pushOut, h('textarea', { rows: 5, readonly: true }, json), h('p', { class: 'muted small' }, 'Copy this text into the GitHub secret PUSH_SUBSCRIPTION.'));
              } catch (e) { mount(pushOut, errorBox(e)); }
            } }, 'Enable reminders'), pushOut)
          : h('p', { class: 'muted' }, 'This browser does not support push notifications.')));
  }
  render();
  return root;
}

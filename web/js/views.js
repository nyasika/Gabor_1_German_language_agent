import { h, ring, bar, fmtMin, mount } from './ui.js';
import { createExercise, cardFromExercise, TYPE_LABEL } from './exercises.js';
import { localDateStr, review, previewIntervals, formatInterval, newCardFields, addDays } from './fsrs.js';
import {
  addActivity, dayTotals, totalXp, levelInfo, updateStreak, displayStreak, recordTopic, mastery, wordsStuck,
} from './progress.js';
import { buildLesson, introduceNewCards, dueCards, pickMissions, nextLesson, isUnlocked } from './session.js';
import { CONFIG } from '../config.js';
import { enablePush, pushSupported } from './push.js';
import { speak, speechSupport } from './speech.js';
import { addTalk, speakingStats } from './speaking.js';
import { suggestSprint, isSprintDone, sprintProgress } from './sprint.js';
import { nextAvailablePack } from './vocabpacks.js';

const errorBox = (e) => h('div', { class: 'card error' }, h('strong', {}, 'Hiba történt'), h('p', {}, String(e?.message || e)));

export function topBar(title, ctx, { back = '#/' } = {}) {
  return h('div', { class: 'runbar' },
    h('button', { class: 'btn ghost small', onclick: () => ctx.go(back) }, 'Kilépés'),
    h('span', { class: 'runtitle' }, title));
}

// ---------------------------------------------------------------- Home
export function homeView(ctx) {
  const today = localDateStr();
  const { store, data } = ctx;
  store.save((s) => introduceNewCards(s, data, today));
  let availablePack = null;
  store.save((s) => { availablePack = nextAvailablePack(s, data.vocabPacks, today); });
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
      h('span', { class: 'grow' }, h('strong', {}, m.de), h('em', {}, m.hu)),
      speechSupport().tts ? h('button', { type: 'button', class: 'btn small listen', onclick: (e) => { e.preventDefault(); speak(m.de); } }, 'Lejátszás') : null));

  const talks = s.talks[today] || 0;
  const lastConf = s.speaking.log[today]?.confidence;
  const speakDone = (s.speaking.log[today]?.attempts || 0) > 0;

  const pathRows = data.path.chapters.map((ch) => {
    const done = ch.lessons.filter((id) => s.lessons[id]?.done).length;
    return h('div', { class: 'chrow' }, h('span', {}, ch.title), h('span', { class: 'muted' }, `${done}/${ch.lessons.length}`),
      bar(done / ch.lessons.length));
  });

  const talkCount = h('strong', { 'data-role': 'talks' }, talks);
  const undoBtn = h('button', { type: 'button', class: 'btn ghost small', disabled: talks ? null : true, onclick: () => bumpTalks(-1) }, 'visszavonás');
  function bumpTalks(delta) {
    store.save((st) => addTalk(st, today, delta));
    const n = store.get().talks[today] || 0;
    talkCount.textContent = n;
    undoBtn.disabled = n === 0;
  }
  const talksRow = h('div', { class: 'talks' },
    h('span', {}, 'Mai német beszélgetések: ', talkCount),
    h('button', { type: 'button', class: 'btn small', onclick: () => bumpTalks(1) }, '+1'),
    undoBtn);

  const activeId = s.sprints.active;
  const suggestedId = activeId ? null : suggestSprint(s, data.sprintIds);
  const sprintBanner = activeId
    ? h('section', { class: 'card sprint-banner' },
        h('p', { class: 'eyebrow' }, 'Sprint folyamatban'),
        h('p', {}, data.topics[activeId]?.title || activeId, ` · ${sprintProgress(s, activeId)?.day ?? 1}. nap`),
        h('a', { class: 'btn primary', href: `#/sprint/${activeId}` }, 'Folytatás'))
    : suggestedId
      ? h('section', { class: 'card sprint-banner' },
          h('p', { class: 'eyebrow' }, 'Érdemes ránézni'),
          h('p', {}, `A pontosságod a(z) „${data.topics[suggestedId]?.title || suggestedId}” témában alacsony volt — töltenél rá pár fókuszált napot?`),
          h('a', { class: 'btn primary', href: `#/sprint/${suggestedId}` }, 'Sprint indítása'))
      : null;

  const vocabBanner = availablePack
    ? h('section', { class: 'card sprint-banner' },
        h('p', { class: 'eyebrow' }, 'Új szókincs-csomag'),
        h('p', {}, availablePack.title),
        h('a', { class: 'btn primary', href: `#/vocab/${availablePack.id}` }, 'Megnézem'))
    : null;

  return h('div', { class: 'home' },
    sprintBanner,
    vocabBanner,
    h('section', { class: 'hero card' },
      ring(totals.seconds / goal, fmtMin(totals.seconds), `/ ${s.settings.dailyGoalMin} perc`),
      h('div', { class: 'hero-stats' },
        h('div', { class: 'stat' }, h('strong', {}, streak), h('span', {}, 'napos sorozat')),
        h('div', { class: 'stat' }, h('strong', {}, `Szint ${lv.level}`), h('span', {}, `${xp} XP`)),
        h('div', { class: 'stat' }, h('strong', {}, wordsStuck(s)), h('span', {}, 'rögzült szó'))),
      h('div', { class: 'lvbar' }, bar(lv.into / lv.span), h('small', {}, `${lv.span - lv.into} XP a(z) ${lv.level + 1}. szintig`))),

    h('section', { class: 'card session' },
      h('div', { class: 'session-head' }, h('h2', {}, '1. foglalkozás · Ismétlés'), h('span', { class: `chip ${reviewDone ? 'ok' : ''}` }, reviewDone ? 'ma kész' : '7:00')),
      h('p', { class: 'muted' }, `${due} kártya vár, plusz a mai kolléga-küldetések.`),
      h('a', { class: 'btn primary', href: '#/review' }, reviewDone ? 'Még ismétlés' : 'Ismétlés indítása')),

    h('section', { class: 'card session' },
      h('div', { class: 'session-head' }, h('h2', {}, '2. foglalkozás · Lecke'), h('span', { class: `chip ${lessonDone ? 'ok' : ''}` }, lessonDone ? 'ma kész' : '20:30')),
      nextId
        ? h('p', { class: 'muted' }, `Következő: ${nextTitle}`)
        : h('p', { class: 'muted' }, 'Az összes leckét elvégezted az útvonalon. Vegyél át újra egyet, hogy frissen tartsd.'),
      nextId ? h('a', { class: 'btn primary', href: `#/lesson/${nextId}` }, lessonDone ? 'Még egy lecke' : 'Lecke indítása') : h('a', { class: 'btn', href: '#/path' }, 'Útvonal megnyitása')),

    h('section', { class: 'card session' },
      h('div', { class: 'session-head' }, h('h2', {}, 'Beszédgyakorlat'), h('span', { class: `chip ${speakDone ? 'ok' : ''}` }, speakDone ? 'ma kész' : '5 perc')),
      h('p', { class: 'muted' }, 'Hallgass meg egy kifejezést, mondd ki, és szóról szóra lásd, mennyire voltál pontos.'),
      h('a', { class: 'btn primary', href: '#/speak' }, speakDone ? 'Még beszéd' : 'Beszéd indítása'),
      talksRow,
      lastConf ? h('p', { class: 'muted small' }, `Mai magabiztosság: ${lastConf} / 5`) : null),

    h('section', { class: 'card' },
      h('h2', {}, 'Mai kolléga-küldetések'),
      h('p', { class: 'muted' }, 'Próbáld meg ma éles beszélgetésben használni mindegyiket. Pipáld ki, ha sikerült.'),
      h('div', { class: 'missions' }, missionRows),
      h('a', { class: 'btn', href: '#/log' }, 'Esti napló: amit nem tudtam elmondani')),

    h('section', { class: 'card' }, h('h2', {}, 'A te útvonalad'), pathRows, h('a', { class: 'btn ghost', href: '#/path' }, 'Teljes útvonal megnyitása')));
}

// ---------------------------------------------------------------- Path
export function pathView(ctx) {
  const s = ctx.store.get();
  const { data } = ctx;
  return h('div', {},
    h('h1', {}, 'Tanulási útvonal'),
    data.path.note ? h('p', { class: 'muted note' }, data.path.note) : null,
    data.path.chapters.map((ch) => {
      const done = ch.lessons.filter((id) => s.lessons[id]?.done).length;
      return h('section', { class: 'card chapter' },
        h('div', { class: 'chapter-head' }, h('div', {}, h('h2', {}, ch.title), h('p', { class: 'muted' }, ch.subtitle)), h('span', { class: 'chip' }, `${done}/${ch.lessons.length}`)),
        ch.lessons.map((id) => {
          const l = s.lessons[id];
          const unlocked = isUnlocked(data.path, s, id);
          const status = l?.done ? `Kész · ${Math.round((l.bestScore || 0) * 100)}%` : unlocked ? 'Elérhető' : 'Zárolva';
          return h(unlocked ? 'a' : 'div', { class: `node ${l?.done ? 'done' : unlocked ? 'open' : 'locked'}`, href: unlocked ? `#/lesson/${id}` : null },
            h('span', { class: 'node-dot' }, l?.done ? '✓' : unlocked ? '▶' : ''),
            h('span', { class: 'node-title' }, data.lessonTitles[id]),
            h('span', { class: 'node-status' }, status));
        }));
    }));
}

export function lessonIntroView(ctx, id) {
  const root = h('div', {}, h('p', { class: 'muted' }, 'Betöltés…'));
  ctx.data.loadLesson(id).then((lesson) => {
    const s = ctx.store.get();
    if (!isUnlocked(ctx.data.path, s, id)) {
      mount(root, h('div', { class: 'card' }, h('h2', {}, lesson.title), h('p', {}, 'Előbb fejezd be az előző leckét.'), h('a', { class: 'btn', href: '#/path' }, 'Vissza az útvonalhoz')));
      return;
    }
    mount(root, h('div', { class: 'card' },
      h('p', { class: 'eyebrow' }, ctx.data.topics[lesson.topic]?.title || lesson.topic),
      h('h1', {}, lesson.title),
      renderIntro(lesson),
      h('p', { class: 'muted' }, '10 feladat, kb. 5 perc. A hibák a lecke végén még egyszer előkerülnek, holnap pedig ismétlőkártyaként is visszatérnek.'),
      h('a', { class: 'btn primary', href: `#/run/${id}` }, 'Lecke indítása'),
      h('a', { class: 'btn ghost', href: '#/path' }, 'Vissza')));
  }).catch((e) => mount(root, errorBox(e)));
  return root;
}

// Renders a lesson/sprint intro: paragraphs, bullet points, and any grammar tables.
export function renderIntro(content) {
  const blocks = [h('ul', { class: 'intro' }, content.intro.map((t) => h('li', {}, t)))];
  for (const t of content.tables || []) {
    blocks.push(h('div', { class: 'grammar-table-wrap' },
      t.title ? h('h3', { class: 'grammar-table-title' }, t.title) : null,
      h('table', { class: 'grammar-table' },
        h('thead', {}, h('tr', {}, t.headers.map((hd) => h('th', {}, hd)))),
        h('tbody', {}, t.rows.map((row) => h('tr', {}, row.map((cell) => h('td', {}, cell))))))));
  }
  return h('div', { class: 'grammar-intro' }, blocks);
}

// ---------------------------------------------------------------- Lesson runner
export function lessonRunView(ctx, lessonId) {
  const root = h('div', { class: 'run' }, h('p', { class: 'muted' }, 'Betöltés…'));
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
      const checkBtn = h('button', { class: 'btn primary', disabled: true, onclick: () => submit() }, 'Ellenőrzés');
      exercise.onChange(() => { checkBtn.disabled = !exercise.ready(); });
      const feedback = h('div', { class: 'feedback' });
      const footer = h('div', { class: 'footer' }, checkBtn);
      mount(root,
        topBar(lesson.title, ctx),
        bar(idx / queue.length, 'progress'),
        h('p', { class: 'eyebrow' }, TYPE_LABEL[ex.type], retry ? h('span', { class: 'chip warn' }, 'második próbálkozás') : null),
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
          h('strong', {}, res.correct ? (gain ? 'Richtig! +10 XP' : 'Richtig!') : 'Még nem az'),
          res.correct ? null : h('p', {}, 'Helyes megoldás: ', h('b', {}, res.answerText)),
          ex.explain ? h('p', { class: 'muted' }, ex.explain) : null,
          !res.correct && first ? h('p', { class: 'muted' }, 'Ez a feladat visszatér a lecke végén, és ismétlőkártyaként is megjelenik.') : null);
        mount(footer, h('button', { class: 'btn primary', onclick: () => { idx += 1; next(); } }, idx + 1 >= queue.length ? 'Befejezés' : 'Tovább'));
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
        h('p', { class: 'eyebrow' }, 'Lecke kész'),
        h('h1', {}, `${Math.round(score * 100)}% elsőre`),
        h('p', {}, `${ok}/${total} helyes elsőre · +${xpGained + bonus} XP${first ? ' (tartalmazza a lecke-bónuszt)' : ''}`),
        score < 0.7 ? h('p', { class: 'muted' }, 'Érdemes majd újra átvenni. A hibáid már benne vannak a holnapi ismétlésben.') : h('p', { class: 'muted' }, 'Szép volt! A hibáid be vannak ütemezve holnapra.'),
        h('a', { class: 'btn primary', href: '#/log' }, 'Esti napló: amit ma nem tudtam elmondani'),
        nextId ? h('a', { class: 'btn', href: `#/lesson/${nextId}` }, 'Következő lecke') : null,
        h('a', { class: 'btn ghost', href: '#/' }, 'Kezdőlap')));
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
    topBar('Ismétlés', ctx),
    h('div', { class: 'card' },
      h('p', { class: 'eyebrow' }, 'Mai kolléga-küldetések'),
      h('p', { class: 'muted' }, 'Olvasd át őket egyszer, majd próbáld használni valódi beszélgetésben.'),
      h('div', { class: 'missions readonly' }, missions.map((m) =>
        h('div', { class: 'mission' }, h('span', {}, h('strong', {}, m.de), h('em', {}, m.hu))))),
      h('button', { class: 'btn primary', onclick: () => { ctx.tracker(); next(); } }, queue.length ? `Ismétlés indítása (${queue.length} kártya)` : 'Tovább')));

  function next() {
    if (idx >= queue.length) return finish();
    const { id, practice } = queue[idx];
    const card = ctx.store.get().cards[id];
    if (!card) { idx += 1; return next(); }
    mount(root, topBar('Ismétlés', ctx), bar(idx / queue.length, 'progress'),
      h('p', { class: 'eyebrow' }, card.state === 'new' ? 'Új kártya' : practice ? 'Még egyszer' : 'Ismétlés',
        card.src === 'error' ? h('span', { class: 'chip warn' }, 'a hibáidból') : null),
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
        mount(actions, h('button', { class: 'btn primary', onclick: () => grade(card.id, 3, true) }, 'Megvan'));
        return;
      }
      const p = previewIntervals(card, today);
      mount(actions, h('div', { class: 'rate' }, [['Again', 'Újra', 1], ['Hard', 'Nehéz', 2], ['Good', 'Jó', 3], ['Easy', 'Könnyű', 4]].map(([slug, label, r]) =>
        h('button', { class: `btn rate-${slug.toLowerCase()}`, onclick: () => grade(card.id, r, false) }, label, h('small', {}, formatInterval(p[slug]))))));
    } }, 'Válasz megmutatása');
    actions.append(reveal);
    return h('div', {}, face, actions);
  }

  function clozeCard(card, practice) {
    const submit = () => { if (ex.ready() && !done) check(); };
    let done = false;
    const ex = createExercise({ type: 'cloze', sentence: card.sentence, answers: card.answers, hint: card.hu, prompt: null }, { onSubmit: submit });
    const feedback = h('div', { class: 'feedback' });
    const footer = h('div', { class: 'footer' });
    const checkBtn = h('button', { class: 'btn primary', disabled: true, onclick: submit }, 'Ellenőrzés');
    ex.onChange(() => { checkBtn.disabled = !ex.ready(); });
    footer.append(checkBtn);
    function check() {
      done = true;
      const res = ex.check();
      feedback.className = `feedback ${res.correct ? 'right' : 'wrong'}`;
      mount(feedback, h('strong', {}, res.correct ? 'Richtig!' : 'Még nem az'), res.correct ? null : h('p', {}, 'Helyes megoldás: ', h('b', {}, res.answerText)));
      mount(footer, h('button', { class: 'btn primary', onclick: () => grade(card.id, res.correct ? 3 : 1, practice) }, 'Tovább'));
    }
    setTimeout(() => ex.focus(), 0);
    return h('div', {}, ex.el, feedback, footer);
  }

  function finish() {
    const s = ctx.store.get();
    mount(root, h('div', { class: 'card summary' },
      h('p', { class: 'eyebrow' }, 'Ismétlés kész'),
      h('h1', {}, graded ? `${good}/${graded} ment` : 'Most nincs esedékes kártya'),
      h('p', {}, graded ? `+${xp} XP · ${wordsStuck(s)} szó rögzült (21+ napos memória)` : 'Gyere vissza a következő lecke után: a hibák ismétlőkártyává válnak.'),
      h('a', { class: 'btn primary', href: '#/' }, 'Kezdőlap'),
      h('a', { class: 'btn', href: '#/log' }, 'Esti napló')));
  }
  return root;
}

// ---------------------------------------------------------------- Evening log
export function logView(ctx) {
  const today = localDateStr();
  const root = h('div', {});
  function render() {
    const s = ctx.store.get();
    const wanted = h('textarea', { rows: 3, placeholder: 'pl. El akartam mondani, hogy csütörtökre tegyük a megbeszélést', 'aria-label': 'Amit el akartam mondani' });
    const german = h('input', { type: 'text', placeholder: 'Német verzió (opcionális)', 'aria-label': 'Német verzió' });
    const save = h('button', { class: 'btn primary', onclick: () => {
      const text = wanted.value.trim();
      if (!text) return;
      const de = german.value.trim();
      const id = `g${Date.now()}`;
      ctx.store.save((st) => {
        st.gaps.push({ id, date: today, text, de, converted: !!de });
        if (de) st.cards[`gap_${id}`] = { id: `gap_${id}`, type: 'flip', src: 'gap', front: text, back: de, hint: 'az esti naplódból', ...newCardFields() };
        addActivity(st, today, 'extra', { xp: 5, seconds: ctx.tracker() });
        updateStreak(st, today);
      });
      render();
    } }, 'Mentés');
    const recent = [...s.gaps].reverse().slice(0, 10).map((g) => {
      const input = h('input', { type: 'text', placeholder: 'Add meg a német kifejezést', 'aria-label': 'Német kifejezés' });
      return h('div', { class: 'gap' },
        h('div', {}, h('small', { class: 'muted' }, g.date), h('p', {}, g.text), g.de ? h('p', { class: 'de' }, g.de) : null),
        g.de ? null : h('div', { class: 'gap-add' }, input, h('button', { class: 'btn small', onclick: () => {
          const de = input.value.trim();
          if (!de) return;
          ctx.store.save((st) => {
            const gap = st.gaps.find((x) => x.id === g.id);
            gap.de = de;
            gap.converted = true;
            st.cards[`gap_${g.id}`] = { id: `gap_${g.id}`, type: 'flip', src: 'gap', front: gap.text, back: de, hint: 'az esti naplódból', ...newCardFields() };
          });
          render();
        } }, 'Kártya készítése')));
    });
    mount(root,
      h('h1', {}, 'Esti napló'),
      h('div', { class: 'card' },
        h('p', { class: 'muted' }, 'Mit szerettél volna ma elmondani, de nem sikerült (vagy rosszul mondtad)? Ha megadod a német verziót, ismétlőkártya lesz belőle.'),
        wanted, german, save),
      recent.length ? h('div', { class: 'card' }, h('h2', {}, 'Legutóbbi bejegyzések'), recent) : null);
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
    cells.push(h('div', { class: `hm hm-${lvl}`, title: `${date}: ${Math.round(min)} perc` }));
  }
  return h('div', { class: 'heatmap', 'aria-label': 'Aktivitás az elmúlt 12 hétben' }, cells);
}

function delta(now, before, digits = 0, unit = '') {
  if (now == null || before == null) return '';
  const d = now - before;
  if (Math.abs(d) < 0.05) return ' (mint előző héten)';
  return ` (${d > 0 ? '+' : ''}${d.toFixed(digits)}${unit} az előző héthez képest)`;
}

function speakingCard(s, today) {
  const { week, previous } = speakingStats(s, today);
  const pct = (x) => (x == null ? '–' : `${Math.round(x * 100)}%`);
  return h('section', { class: 'card' }, h('h2', {}, 'Beszéd'),
    week.attempts || week.talks ? h('div', { class: 'grid4' },
      h('div', { class: 'stat' }, h('strong', {}, week.talks), h('span', {}, `német beszélgetés${delta(week.talks, previous.talks)}`)),
      h('div', { class: 'stat' }, h('strong', {}, week.attempts), h('span', {}, `elmondott kifejezés (${week.passes} sikeres)`)),
      h('div', { class: 'stat' }, h('strong', {}, pct(week.accuracy)), h('span', {}, `pontosság${delta(week.accuracy == null ? null : week.accuracy * 100, previous.accuracy == null ? null : previous.accuracy * 100, 0, ' pont')}`)),
      h('div', { class: 'stat' }, h('strong', {}, week.confidence == null ? '–' : `${week.confidence.toFixed(1)} / 5`), h('span', {}, `magabiztosság${delta(week.confidence, previous.confidence, 1)}`)))
      : h('p', { class: 'muted' }, 'Csinálj egy beszédgyakorlást, és jegyezd fel a beszélgetéseidet, hogy lásd itt a magabiztosság-trendet.'));
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
    h('h1', {}, 'Haladás'),
    h('section', { class: 'card grid4' },
      h('div', { class: 'stat' }, h('strong', {}, `Szint ${lv.level}`), h('span', {}, `${xp} XP`)),
      h('div', { class: 'stat' }, h('strong', {}, displayStreak(s, today)), h('span', {}, `sorozat (legjobb: ${s.streak.longest})`)),
      h('div', { class: 'stat' }, h('strong', {}, wordsStuck(s)), h('span', {}, `rögzült szó (${learned} megtanultból)`)),
      h('div', { class: 'stat' }, h('strong', {}, fmtMin(weekSec)), h('span', {}, 'elmúlt 7 nap'))),
    h('section', { class: 'card' }, h('h2', {}, 'Elmúlt 12 hét'), heatmap(s, today),
      h('p', { class: 'muted small' }, `Elérhető sorozat-fagyasztás: ${s.streak.freezes}. Egy nap akkor számít, ha legalább ${s.settings.streakMinMinutes} percet gyakoroltál.`)),
    speakingCard(s, today),
    h('section', { class: 'card' }, h('h2', {}, 'Nyelvtani tudásszint'),
      topics.length ? topics.map((t) => {
        const m = mastery(s, t);
        const title = ctx.data.topics[t]?.title || t;
        const weak = m < 0.6 && s.topics[t].hist.length >= 6;
        const sprintReady = weak && ctx.data.sprintIds.includes(t) && !isSprintDone(s, t);
        return h('div', { class: 'chrow' },
          h('span', {}, title, sprintReady ? h('a', { class: 'btn small', href: `#/sprint/${t}` }, 'Sprintelj rá') : null),
          h('span', { class: 'muted' }, `${Math.round(m * 100)}% · utolsó ${s.topics[t].hist.length}`),
          bar(m, weak ? 'low' : ''));
      }) : h('p', { class: 'muted' }, 'Fejezz be egy leckét, hogy lásd a témánkénti tudásszintet.')),
    h('section', { class: 'card' }, h('h2', {}, 'Sprintek'),
      h('p', { class: 'muted' }, 'Tölts néhány fókuszált napot egy témával, a megszokott útvonal mellett.'),
      h('a', { class: 'btn', href: '#/sprints' }, 'Sprintek böngészése')),
    h('section', { class: 'card' }, h('h2', {}, 'Szókincs-csomagok'),
      h('p', { class: 'muted' }, 'Alapigék, melléknevek és határozószók — egy új csomag 10 naponta nyílik meg.'),
      h('a', { class: 'btn', href: '#/vocab' }, 'Szókincs-csomagok böngészése')));
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
    const key = h('input', { type: 'text', value: s.settings.sync.anonKey, placeholder: 'anon public kulcs', 'aria-label': 'Supabase anon kulcs' });
    const email = h('input', { type: 'email', value: s.settings.sync.email, placeholder: 'email cím', autocomplete: 'username', 'aria-label': 'Email cím' });
    const pw = h('input', { type: 'password', value: ctx.sync.getPassword(), placeholder: 'jelszó (csak ezen az eszközön tárolva)', autocomplete: 'current-password', 'aria-label': 'Jelszó' });
    const fileInput = h('input', { type: 'file', accept: 'application/json', class: 'hidden', onchange: async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try { ctx.store.importJson(await f.text()); render(); alert('Biztonsági mentés visszaállítva.'); } catch (err) { alert(`Sikertelen importálás: ${err.message}`); }
    } });
    const pushOut = h('div', {});
    mount(root,
      h('h1', {}, 'Beállítások'),
      h('section', { class: 'card' }, h('h2', {}, 'Napi terv'),
        numberField(ctx, 'Napi cél (perc)', 'dailyGoalMin', 5, 120),
        numberField(ctx, 'Sorozathoz szükséges percek', 'streakMinMinutes', 1, 60),
        numberField(ctx, 'Új szókártya naponta', 'newVocabPerDay', 0, 15),
        numberField(ctx, 'Kolléga-mondat naponta', 'missionsPerDay', 0, 8),
        h('p', { class: 'muted small' }, 'Az emlékeztetők 7:00-ra és 20:30-ra vannak tervezve, svájci idő szerint.')),
      h('section', { class: 'card' }, h('h2', {}, 'Biztonsági mentés'),
        h('p', { class: 'muted' }, 'A haladás minden válasz után mentésre kerül ezen az eszközön. Időnként tölts le egy biztonsági mentést, vagy kapcsold be lent a szinkronizálást.'),
        h('div', { class: 'row' },
          h('button', { class: 'btn', onclick: () => {
            const blob = new Blob([ctx.store.exportJson()], { type: 'application/json' });
            const a = h('a', { href: URL.createObjectURL(blob), download: `wortweg-backup-${localDateStr()}.json` });
            document.body.append(a); a.click(); a.remove();
          } }, 'Biztonsági mentés letöltése'),
          h('button', { class: 'btn', onclick: () => fileInput.click() }, 'Visszaállítás fájlból'), fileInput)),
      h('section', { class: 'card' }, h('h2', {}, 'Telefon és PC szinkronizálása (opcionális)'),
        h('p', { class: 'muted' }, `Állapot: ${st.message}`),
        h('label', { class: 'field col' }, h('span', {}, 'Supabase URL'), url),
        h('label', { class: 'field col' }, h('span', {}, 'Anon kulcs'), key),
        h('label', { class: 'field col' }, h('span', {}, 'Email cím'), email),
        h('label', { class: 'field col' }, h('span', {}, 'Jelszó'), pw),
        h('button', { class: 'btn primary', onclick: async () => {
          ctx.store.save((x) => { x.settings.sync = { url: url.value.trim(), anonKey: key.value.trim(), email: email.value.trim() }; });
          ctx.sync.setPassword(pw.value);
          await ctx.sync.syncNow();
          render();
        } }, 'Mentés és szinkronizálás most')),
      h('section', { class: 'card' }, h('h2', {}, 'Emlékeztetők ezen a telefonon'),
        pushSupported()
          ? h('div', {}, h('p', { class: 'muted' }, CONFIG.vapidPublicKey ? 'Engedélyezd az értesítéseket, majd másold be a feliratkozást az emlékeztető jobba (lásd README).' : 'A push még nincs beállítva: állítsd be a vapidPublicKey-t a web/config.js-ben (lásd README).'),
            h('button', { class: 'btn', disabled: !CONFIG.vapidPublicKey, onclick: async () => {
              try {
                const json = await enablePush(CONFIG.vapidPublicKey);
                mount(pushOut, h('textarea', { rows: 5, readonly: true }, json), h('p', { class: 'muted small' }, 'Másold be ezt a szöveget a GitHub PUSH_SUBSCRIPTION secretjébe.'));
              } catch (e) { mount(pushOut, errorBox(e)); }
            } }, 'Emlékeztetők engedélyezése'), pushOut)
          : h('p', { class: 'muted' }, 'Ez a böngésző nem támogatja a push értesítéseket.')));
  }
  render();
  return root;
}

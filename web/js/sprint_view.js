import { h, mount, bar } from './ui.js';
import { localDateStr, newCardFields } from './fsrs.js';
import { createExercise, TYPE_LABEL } from './exercises.js';
import { buildLesson } from './session.js';
import { addActivity, recordTopic, updateStreak } from './progress.js';
import { speak, speechSupport } from './speech.js';
import { startSprint, pauseSprint, completeSprintDay, currentDay, isSprintDone, sprintProgress } from './sprint.js';
import { runSpeakSequence } from './speak_view.js';
import { topBar } from './views.js';

const errorBox = (e) => h('div', { class: 'card error' }, h('strong', {}, 'Something went wrong'), h('p', {}, String(e?.message || e)));

function dayList(sprint, today, s) {
  const p = sprintProgress(s, sprint.id);
  return sprint.days.map((d) => {
    const result = p?.dayResults[d.day];
    const status = result ? 'done' : d.day === (p?.day ?? 1) ? 'open' : 'locked';
    return h('div', { class: `node ${status}` },
      h('span', { class: 'node-dot' }, result ? '✓' : status === 'open' ? '▶' : ''),
      h('span', { class: 'node-title' }, `Day ${d.day}: ${d.title}`),
      h('span', { class: 'node-status' }, result ? (result.score != null ? `${Math.round(result.score * 100)}%` : 'done') : status === 'open' ? 'ready' : 'locked'));
  });
}

export function sprintOverviewView(ctx, id) {
  const root = h('div', {}, h('p', { class: 'muted' }, 'Loading…'));
  ctx.data.loadSprint(id).then((sprint) => {
    const today = localDateStr();
    const s = ctx.store.get();
    const topic = ctx.data.topics[sprint.topicId];
    const done = isSprintDone(s, id);
    const day = currentDay(s, id);
    mount(root, h('div', { class: 'card' },
      h('p', { class: 'eyebrow' }, `${sprint.days.length}-day sprint`, topic?.level ? h('span', { class: 'chip' }, topic.level) : null),
      h('h1', {}, sprint.title),
      topic?.cando ? h('p', { class: 'muted' }, topic.cando) : null,
      dayList(sprint, today, s),
      done
        ? h('p', { class: 'muted' }, 'Sprint complete. Nice work — this topic will keep coming back in your regular reviews.')
        : h('a', { class: 'btn primary', href: `#/sprint/${id}/${day}` }, sprintProgress(s, id) ? `Continue: Day ${day}` : 'Start the sprint'),
      h('a', { class: 'btn ghost', href: '#/sprints' }, 'All sprints')));
  }).catch((e) => mount(root, errorBox(e)));
  return root;
}

export function sprintDayView(ctx, id, dayNum) {
  const root = h('div', { class: 'run' });
  ctx.data.loadSprint(id).then((sprint) => start(sprint)).catch((e) => mount(root, errorBox(e)));

  function start(sprint) {
    const today = localDateStr();
    const day = sprint.days.find((d) => d.day === Number(dayNum));
    if (!day) { mount(root, errorBox(new Error(`Day ${dayNum} does not exist in this sprint.`))); return; }
    ctx.store.save((s) => startSprint(s, id, today));
    ctx.tracker();
    if (day.focus === 'notice') return notice(sprint, day);
    if (day.focus === 'produce') return produce(sprint, day);
    return drill(sprint, day);
  }

  function finishDay(sprint, day, { score = null } = {}) {
    const seconds = ctx.tracker();
    let result;
    ctx.store.save((s) => { result = completeSprintDay(s, id, day.day, sprint.days.length, today(), { score, seconds }); });
    const nextDay = sprint.days.find((d) => d.day === day.day + 1);
    mount(root, topBar(sprint.title, ctx), h('div', { class: 'card summary' },
      h('p', { class: 'eyebrow' }, `Day ${day.day} of ${sprint.days.length} done`),
      h('h1', {}, result.completed ? 'Sprint complete!' : day.title),
      h('p', {}, `+${result.xp} XP${result.completed ? ' (includes the completion bonus)' : ''}`),
      result.completed
        ? h('p', { class: 'muted' }, 'This topic will keep coming back in your regular reviews.')
        : nextDay ? h('a', { class: 'btn primary', href: `#/sprint/${id}/${nextDay.day}` }, `Start Day ${nextDay.day}: ${nextDay.title}`) : null,
      h('a', { class: 'btn ghost', href: `#/sprint/${id}` }, 'Sprint overview'),
      h('a', { class: 'btn ghost', href: '#/' }, 'Home')));
  }
  const today = () => localDateStr();

  function notice(sprint, day) {
    const support = speechSupport();
    mount(root, topBar(sprint.title, ctx), h('div', { class: 'card' },
      h('p', { class: 'eyebrow' }, `Day ${day.day} of ${sprint.days.length} · Notice`),
      h('h1', {}, day.title),
      h('ul', { class: 'intro' }, day.intro.map((t) => h('li', {}, t))),
      h('h2', {}, 'Phrases to notice'),
      day.chunks.map((c) => h('div', { class: 'chunk-row' }, h('span', {}, c.de),
        support.tts ? h('button', { class: 'btn small', onclick: () => speak(c.de) }, 'Listen') : null)),
      h('button', { class: 'btn primary', onclick: () => finishDay(sprint, day) }, 'Continue')));
  }

  function produce(sprint, day) {
    const items = day.speak_items.map((it) => ({ id: it.id, kind: 'shadow', de: it.de }));
    mount(root, topBar(sprint.title, ctx), h('div', { class: 'card' },
      h('p', { class: 'eyebrow' }, `Day ${day.day} of ${sprint.days.length} · Produce`),
      h('h1', {}, day.title),
      h('p', { class: 'muted' }, `${items.length} phrases to say out loud. This also counts toward your daily speaking stats.`),
      h('button', { class: 'btn primary', onclick: () => runSpeakSequence(ctx, root, items, {
        title: sprint.title,
        onDone: ({ results }) => finishDay(sprint, day, { score: results.length ? results.reduce((a, r) => a + r.best, 0) / results.length : null }),
      }) }, 'Start')));
  }

  function drill(sprint, day) {
    const items = buildLesson(day.exercises, { n: Math.min(day.exercises.length, 12) });
    const firstTry = {};
    let idx = 0;

    function next() {
      if (idx >= items.length) return finish();
      const ex = items[idx];
      let answered = false;
      const exercise = createExercise(ex);
      const checkBtn = h('button', { class: 'btn primary', disabled: true, onclick: () => submit() }, 'Check');
      exercise.onChange(() => { checkBtn.disabled = !exercise.ready(); });
      const feedback = h('div', { class: 'feedback' });
      const footer = h('div', { class: 'footer' }, checkBtn);
      mount(root, topBar(sprint.title, ctx), bar(idx / items.length, 'progress'),
        h('p', { class: 'eyebrow' }, `Day ${day.day} of ${sprint.days.length} · ${TYPE_LABEL[ex.type]}`),
        exercise.el, feedback, footer);
      exercise.focus();

      function submit() {
        if (answered) return;
        answered = true;
        const res = exercise.check();
        ctx.store.save((s) => {
          addActivity(s, today(), 'sprint', { seconds: 0, answers: 1, correct: res.correct ? 1 : 0 });
          recordTopic(s, ex.topic, res.correct);
          updateStreak(s, today());
          if (!res.correct) {
            const card = { id: `err_${ex.id}`, type: 'flip', src: 'error', topic: ex.topic, front: ex.prompt || ex.sentence || ex.noun, back: ex.answer || ex.answers?.[0] || ex.fixed, hint: ex.explain || '' };
            if (!s.cards[card.id]) s.cards[card.id] = { ...card, ...newCardFields() };
          }
        });
        firstTry[ex.id] = res.correct;
        feedback.className = `feedback ${res.correct ? 'right' : 'wrong'}`;
        mount(feedback, h('strong', {}, res.correct ? 'Richtig!' : 'Not quite'),
          res.correct ? null : h('p', {}, 'Correct: ', h('b', {}, res.answerText)),
          ex.explain ? h('p', { class: 'muted' }, ex.explain) : null);
        mount(footer, h('button', { class: 'btn primary', onclick: () => { idx += 1; next(); } }, idx + 1 >= items.length ? 'Finish' : 'Continue'));
      }
    }

    function finish() {
      const ok = Object.values(firstTry).filter(Boolean).length;
      const score = items.length ? ok / items.length : 0;
      finishDay(sprint, day, { score });
    }
    next();
  }
  return root;
}

export function sprintsListView(ctx) {
  const root = h('div', {});
  Promise.all(ctx.data.sprintIds.map((id) => ctx.data.loadSprint(id))).then((sprints) => {
    const s = ctx.store.get();
    mount(root,
      h('h1', {}, 'Sprints'),
      h('p', { class: 'muted' }, 'A few focused days on one topic. Reviews and lessons continue as normal alongside a sprint.'),
      sprints.map((sp) => {
        const topic = ctx.data.topics[sp.topicId];
        const done = isSprintDone(s, sp.id);
        const started = sprintProgress(s, sp.id);
        return h('a', { class: `node ${done ? 'done' : started ? 'open' : ''}`, href: `#/sprint/${sp.id}` },
          h('span', { class: 'node-dot' }, done ? '✓' : started ? '▶' : ''),
          h('span', { class: 'node-title' }, sp.title, topic?.level ? h('span', { class: 'chip' }, topic.level) : null),
          h('span', { class: 'node-status' }, done ? 'done' : started ? `Day ${started.day} of ${sp.days.length}` : `${sp.days.length} days`));
      }));
  }).catch((e) => mount(root, errorBox(e)));
  return root;
}

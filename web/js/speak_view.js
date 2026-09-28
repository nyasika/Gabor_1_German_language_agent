import { h, mount, bar } from './ui.js';
import { localDateStr } from './fsrs.js';
import { speechSupport, speak, listen, errorText } from './speech.js';
import { bestAlternative, PASS_THRESHOLD } from './compare.js';
import { buildSpeakSession, recordAttempt, recordConfidence } from './speaking.js';
import { topBar } from './views.js';

const MAX_TRIES = 3;
const CONFIDENCE_LABELS = ['shaky', 'unsure', 'okay', 'good', 'confident'];

function diffView(cmp, heard) {
  return h('div', { class: 'diff-box' },
    h('p', { class: 'diff' }, cmp.words.map((w) => [h('span', { class: `w-${w.status}`, title: w.heard ? `heard: ${w.heard}` : 'not heard' }, w.word), ' '])),
    h('p', { class: 'muted small' }, `I heard: “${heard || '…'}”`),
    cmp.extras.length ? h('p', { class: 'muted small' }, `Extra words: ${cmp.extras.join(', ')}`) : null);
}

export function speakView(ctx) {
  const root = h('div', { class: 'run' });
  const today = localDateStr();
  const support = speechSupport();
  const items = buildSpeakSession(ctx.store.get(), ctx.data, today);
  const results = [];
  let idx = 0;
  let xp = 0;

  function intro() {
    mount(root, topBar('Speaking', ctx),
      h('div', { class: 'card' },
        h('p', { class: 'eyebrow' }, 'Speaking practice · about 5 minutes'),
        h('h1', {}, 'Hear it, say it, see how close you got'),
        h('ul', { class: 'intro' },
          h('li', {}, `${items.filter((i) => i.kind === 'shadow').length} phrases to shadow: listen, then repeat.`),
          h('li', {}, `${items.filter((i) => i.kind === 'prompt').length} colleague missions to say from memory.`),
          h('li', {}, 'Up to three tries each. If the recogniser mishears you, you can overrule it.')),
        !support.stt ? h('p', { class: 'note' }, 'This browser has no speech recognition (Chrome has it), so you will rate yourself instead. You can still listen.') : null,
        !support.tts ? h('p', { class: 'note' }, 'This browser cannot read German aloud, so there is no Listen button.') : null,
        support.stt ? h('p', { class: 'muted small' }, 'Chrome sends the audio to Google\'s speech service to turn it into text. Nothing is stored by this app.') : null,
        h('button', { class: 'btn primary', onclick: () => { ctx.tracker(); next(); } }, 'Start')));
  }

  function next() {
    if (idx >= items.length) return summary();
    showItem(items[idx]);
  }

  function showItem(it) {
    let tries = 0;
    let revealed = it.kind === 'shadow';
    let best = 0;
    const stage = h('div', {});
    const status = h('p', { class: 'muted listening', 'aria-live': 'polite' });
    const feedback = h('div', { class: 'feedback' });
    const actions = h('div', { class: 'speak-actions' });

    function record(score) {
      const secs = ctx.tracker();
      let res;
      ctx.store.save((s) => { res = recordAttempt(s, today, it.id, score, { seconds: secs }); });
      xp += res.xp;
      best = Math.max(best, score);
      tries += 1;
      return res;
    }

    function finishItem() {
      results.push({ id: it.id, best });
      idx += 1;
      next();
    }

    function draw() {
      const face = it.kind === 'prompt'
        ? h('div', { class: 'card-face' }, h('div', { class: 'card-cue' }, it.en), h('div', { class: 'muted' }, it.hu),
            revealed ? h('div', { class: 'card-answer' }, it.de) : h('p', { class: 'muted small' }, 'Say it in German. Tap Peek if you are stuck.'))
        : h('div', { class: 'card-face' }, h('div', { class: 'card-answer big-de' }, it.de), it.revisit ? h('p', { class: 'muted small' }, 'A phrase to revisit') : null);
      mount(stage,
        bar(idx / items.length, 'progress'),
        h('p', { class: 'eyebrow' }, it.kind === 'shadow' ? 'Shadow: listen, then repeat' : 'Say it from memory', h('span', { class: 'chip' }, `${idx + 1} / ${items.length}`)),
        face);
      const buttons = [];
      if (support.tts) {
        buttons.push(h('button', { class: 'btn', onclick: () => speak(it.de) }, 'Listen'));
        buttons.push(h('button', { class: 'btn', onclick: () => speak(it.de, { rate: 0.7 }) }, 'Slow'));
      }
      if (it.kind === 'prompt' && !revealed) buttons.push(h('button', { class: 'btn', onclick: () => { revealed = true; draw(); } }, 'Peek'));
      if (support.stt) buttons.push(h('button', { class: 'btn primary', onclick: attempt, 'data-role': 'speak' }, tries ? 'Speak again' : 'Speak'));
      else {
        buttons.push(h('button', { class: 'btn primary', onclick: () => selfRate(1) }, 'I said it well'));
        buttons.push(h('button', { class: 'btn', onclick: () => selfRate(0.4) }, 'Needs more practice'));
      }
      mount(actions, buttons, h('button', { class: 'btn ghost small', onclick: finishItem }, 'Skip'));
    }

    async function attempt() {
      const speakBtn = actions.querySelector('[data-role=speak]');
      if (speakBtn) speakBtn.disabled = true;
      status.textContent = 'Listening… speak now';
      mount(feedback);
      feedback.className = 'feedback';
      try {
        const { alternatives } = await listen();
        status.textContent = '';
        const { transcript, cmp } = bestAlternative(alternatives, it.de);
        const res = record(cmp.accuracy);
        revealed = true;
        showResult(cmp, transcript, res);
      } catch (e) {
        status.textContent = '';
        feedback.className = 'feedback wrong';
        mount(feedback, h('strong', {}, 'No result'), h('p', {}, errorText(e.code)));
        if (speakBtn) speakBtn.disabled = false;
      }
    }

    function showResult(cmp, transcript, res) {
      const pass = cmp.accuracy >= PASS_THRESHOLD;
      draw();
      feedback.className = `feedback ${pass ? 'right' : 'wrong'}`;
      mount(feedback,
        h('strong', {}, pass ? `Gut! ${Math.round(cmp.accuracy * 100)}%${res.xp ? ` · +${res.xp} XP` : ''}` : `${Math.round(cmp.accuracy * 100)}%: ${cmp.accuracy >= 0.5 ? 'almost there' : 'not quite yet'}`),
        diffView(cmp, transcript));
      const more = [];
      if (!pass && tries < MAX_TRIES) more.push(h('button', { class: 'btn primary', onclick: () => { mount(feedback); feedback.className = 'feedback'; attempt(); } }, `Try again (${MAX_TRIES - tries} left)`));
      if (!pass) more.push(h('button', { class: 'btn', onclick: () => { const r = record(1); xp += 0; showOverruled(r); } }, 'Count it as correct'));
      more.push(h('button', { class: pass || tries >= MAX_TRIES ? 'btn primary' : 'btn ghost small', onclick: finishItem }, 'Next'));
      mount(actions, more);
    }

    function showOverruled(res) {
      feedback.className = 'feedback right';
      mount(feedback, h('strong', {}, `Counted as correct${res.xp ? ` · +${res.xp} XP` : ''}`), h('p', { class: 'muted' }, 'Speech recognition is not perfect, so you have the last word.'));
      mount(actions, h('button', { class: 'btn primary', onclick: finishItem }, 'Next'));
    }

    function selfRate(score) {
      const res = record(score);
      feedback.className = `feedback ${score >= PASS_THRESHOLD ? 'right' : 'wrong'}`;
      mount(feedback, h('strong', {}, score >= PASS_THRESHOLD ? `Noted${res.xp ? ` · +${res.xp} XP` : ''}` : 'Noted: it will come back'));
      mount(actions, h('button', { class: 'btn primary', onclick: finishItem }, 'Next'));
    }

    mount(root, topBar('Speaking', ctx), stage, status, feedback, actions);
    draw();
  }

  function summary() {
    const passed = results.filter((r) => r.best >= PASS_THRESHOLD).length;
    const avg = results.length ? results.reduce((s, r) => s + r.best, 0) / results.length : 0;
    const chosen = ctx.store.get().speaking.log[today]?.confidence;
    const confRow = h('div', { class: 'conf' }, CONFIDENCE_LABELS.map((label, i) =>
      h('button', { class: `btn small${chosen === i + 1 ? ' primary' : ''}`, onclick: () => {
        ctx.store.save((s) => recordConfidence(s, today, i + 1));
        summary();
      } }, `${i + 1} ${label}`)));
    mount(root, topBar('Speaking', ctx),
      h('div', { class: 'card summary' },
        h('p', { class: 'eyebrow' }, 'Speaking done'),
        h('h1', {}, `${passed} of ${results.length} phrases clear`),
        h('p', {}, `Average ${Math.round(avg * 100)}%${xp ? ` · +${xp} XP` : ''}`),
        h('h2', {}, 'How confident did you feel speaking today?'),
        confRow,
        chosen ? h('p', { class: 'muted' }, 'Saved. Your confidence trend is on the Progress page.') : null,
        h('a', { class: 'btn primary', href: '#/' }, 'Home')));
  }

  if (!items.length) {
    mount(root, topBar('Speaking', ctx), h('div', { class: 'card' }, h('p', {}, 'No speaking material yet.'), h('a', { class: 'btn', href: '#/' }, 'Home')));
  } else intro();
  return root;
}

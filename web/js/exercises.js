// Exercise renderers. Each returns { el, ready(), check(), focus() }.
// check() locks the exercise, marks right/wrong visually and returns { correct, answerText }.
import { h } from './ui.js';
import { matchesAny } from './text.js';
import { shuffle } from './session.js';

function notifier() {
  let fn = () => {};
  return { set: (f) => (fn = f), fire: () => fn() };
}

function choice(ex, { keepOrder = false, big = false, header = null } = {}) {
  const opts = keepOrder ? ex.options : shuffle(ex.options);
  const n = notifier();
  let sel = null;
  let locked = false;
  const buttons = opts.map((o) =>
    h('button', {
      type: 'button', class: `opt${big ? ' big' : ''}`, 'data-v': o,
      onclick: () => {
        if (locked) return;
        sel = o;
        buttons.forEach((b) => b.classList.toggle('sel', b.dataset.v === o));
        n.fire();
      },
    }, o));
  const el = h('div', { class: 'ex ex-choice' },
    header || h('p', { class: 'prompt' }, ex.prompt),
    h('div', { class: `opts${big ? ' opts-row' : ''}` }, buttons));
  return {
    el, onChange: n.set,
    ready: () => sel !== null,
    focus() {},
    check() {
      locked = true;
      const correct = sel === ex.answer;
      buttons.forEach((b) => {
        b.disabled = true;
        if (b.dataset.v === ex.answer) b.classList.add('right');
        else if (b.dataset.v === sel) b.classList.add('wrong');
      });
      return { correct, answerText: ex.answer };
    },
  };
}

function article(ex) {
  const header = h('div', { class: 'noun-card' },
    h('div', { class: 'noun-q' }, '___ ', h('strong', {}, ex.noun)),
    ex.hu ? h('div', { class: 'noun-hu' }, ex.hu) : null,
    h('p', { class: 'prompt' }, 'Which article?'));
  return choice({ ...ex, options: ['der', 'die', 'das'] }, { keepOrder: true, big: true, header });
}

function cloze(ex, { onSubmit } = {}) {
  const n = notifier();
  const input = h('input', {
    type: 'text', class: 'cloze-input', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false',
    'aria-label': 'Your answer',
    oninput: () => n.fire(),
    onkeydown: (e) => { if (e.key === 'Enter' && onSubmit) onSubmit(); },
  });
  const [before, after] = ex.sentence.split('___');
  const el = h('div', { class: 'ex ex-cloze' },
    ex.prompt ? h('p', { class: 'prompt' }, ex.prompt) : null,
    h('p', { class: 'sentence' }, before, input, after),
    ex.hint ? h('p', { class: 'hint' }, ex.hint) : null);
  return {
    el, onChange: n.set,
    ready: () => input.value.trim().length > 0,
    focus: () => input.focus(),
    check() {
      const correct = matchesAny(input.value, ex.answers);
      input.disabled = true;
      input.classList.add(correct ? 'right' : 'wrong');
      return { correct, answerText: ex.answers[0] };
    },
  };
}

function order(ex) {
  const n = notifier();
  const tiles = shuffle(ex.tiles.map((text, i) => ({ text, i })));
  let chosen = [];
  let locked = false;
  const bank = h('div', { class: 'tiles bank' });
  const answer = h('div', { class: 'tiles answer' });
  function render() {
    bank.replaceChildren(...tiles.map((t) => {
      const used = chosen.includes(t.i);
      return h('button', { type: 'button', class: `tile${used ? ' used' : ''}`, disabled: used || locked,
        onclick: () => { chosen.push(t.i); render(); n.fire(); } }, t.text);
    }));
    answer.replaceChildren(...chosen.map((i) =>
      h('button', { type: 'button', class: 'tile placed', disabled: locked,
        onclick: () => { chosen = chosen.filter((x) => x !== i); render(); n.fire(); } }, ex.tiles[i])));
    if (!chosen.length) answer.append(h('span', { class: 'placeholder' }, 'Tap the words in order'));
  }
  render();
  const el = h('div', { class: 'ex ex-order' }, h('p', { class: 'prompt' }, ex.prompt), answer, bank);
  return {
    el, onChange: n.set,
    ready: () => chosen.length === ex.tiles.length,
    focus() {},
    check() {
      locked = true;
      const given = chosen.map((i) => ex.tiles[i]).join(' ');
      const correct = matchesAny(given, ex.answers);
      render();
      answer.classList.add(correct ? 'right' : 'wrong');
      return { correct, answerText: ex.answers[0] };
    },
  };
}

function match(ex) {
  const n = notifier();
  const lefts = shuffle(ex.pairs.map((p) => p[0]));
  const rights = shuffle(ex.pairs.map((p) => p[1]));
  const map = new Map(ex.pairs);
  const done = new Set();
  let selLeft = null;
  let mistakes = 0;
  const colL = h('div', { class: 'col' });
  const colR = h('div', { class: 'col' });
  function render(flash = null) {
    colL.replaceChildren(...lefts.map((l) => h('button', { type: 'button',
      class: `opt${done.has(l) ? ' right' : ''}${selLeft === l ? ' sel' : ''}${flash === l ? ' wrong' : ''}`,
      disabled: done.has(l), onclick: () => { selLeft = l; render(); } }, l)));
    colR.replaceChildren(...rights.map((r) => {
      const isDone = [...done].some((l) => map.get(l) === r);
      return h('button', { type: 'button', class: `opt${isDone ? ' right' : ''}`, disabled: isDone || !selLeft,
        onclick: () => {
          if (map.get(selLeft) === r) { done.add(selLeft); selLeft = null; render(); n.fire(); }
          else { mistakes++; const bad = selLeft; selLeft = null; render(bad); }
        } }, r);
    }));
  }
  render();
  const el = h('div', { class: 'ex ex-match' }, h('p', { class: 'prompt' }, ex.prompt),
    h('div', { class: 'match-cols' }, colL, colR));
  return {
    el, onChange: n.set,
    ready: () => done.size === ex.pairs.length,
    focus() {},
    check() {
      const correct = mistakes <= 1;
      return { correct, answerText: mistakes ? `${mistakes} mismatch${mistakes > 1 ? 'es' : ''}` : 'All matched' };
    },
  };
}

function errorspot(ex) {
  const n = notifier();
  let sel = null;
  let locked = false;
  const btns = ex.tokens.map((t, i) =>
    h('button', { type: 'button', class: 'word',
      onclick: () => {
        if (locked) return;
        sel = i;
        btns.forEach((b, j) => b.classList.toggle('sel', j === i));
        n.fire();
      } }, t));
  const el = h('div', { class: 'ex ex-spot' }, h('p', { class: 'prompt' }, ex.prompt), h('div', { class: 'words' }, btns));
  return {
    el, onChange: n.set,
    ready: () => sel !== null,
    focus() {},
    check() {
      locked = true;
      const correct = sel === ex.wrongIndex;
      btns.forEach((b, i) => {
        b.disabled = true;
        if (i === ex.wrongIndex) b.classList.add(correct ? 'right' : 'missed');
        else if (i === sel) b.classList.add('wrong');
      });
      return { correct, answerText: ex.fixed };
    },
  };
}

export function createExercise(ex, opts = {}) {
  switch (ex.type) {
    case 'mc': return choice(ex);
    case 'article': return article(ex);
    case 'cloze': return cloze(ex, opts);
    case 'order': return order(ex);
    case 'match': return match(ex);
    case 'errorspot': return errorspot(ex);
    default: throw new Error(`Unknown exercise type: ${ex.type}`);
  }
}

export const TYPE_LABEL = {
  mc: 'Multiple choice', article: 'Article', cloze: 'Fill the gap', order: 'Build the sentence',
  match: 'Match pairs', errorspot: 'Spot the error',
};

// Build a review card from a wrongly answered exercise, so errors come back tomorrow.
export function cardFromExercise(ex) {
  const id = `err_${ex.id}`;
  const base = { id, src: 'error', topic: ex.topic };
  switch (ex.type) {
    case 'cloze':
      return { ...base, type: 'cloze', sentence: ex.sentence, answers: ex.answers, hu: ex.hint || '' };
    case 'mc':
      if (ex.prompt.includes('___')) return { ...base, type: 'cloze', sentence: ex.prompt, answers: [ex.answer], hu: ex.explain || '' };
      return { ...base, type: 'flip', front: ex.prompt, back: ex.answer, hint: ex.explain || '' };
    case 'order':
      return { ...base, type: 'flip', front: ex.prompt, back: ex.answers[0], hint: 'Word order' };
    case 'errorspot':
      return { ...base, type: 'flip', front: `Correct this: ${ex.tokens.join(' ')}`, back: ex.fixed, hint: ex.explain || '' };
    case 'article':
      return { ...base, type: 'flip', front: `${ex.noun} (${ex.hu || 'article?'})`, back: `${ex.answer} ${ex.noun}`, hint: ex.explain || '' };
    default:
      return null;
  }
}

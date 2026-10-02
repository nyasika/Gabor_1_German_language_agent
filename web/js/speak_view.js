import { h, mount, bar } from './ui.js';
import { localDateStr } from './fsrs.js';
import { speechSupport, speak, listen, errorText } from './speech.js';
import { bestAlternative, PASS_THRESHOLD } from './compare.js';
import { buildSpeakSession, recordAttempt, recordConfidence } from './speaking.js';
import { topBar } from './views.js';

const MAX_TRIES = 3;
const CONFIDENCE_LABELS = ['bizonytalan', 'kissé bizonytalan', 'rendben', 'jó', 'magabiztos'];

function diffView(cmp, heard) {
  return h('div', { class: 'diff-box' },
    h('p', { class: 'diff' }, cmp.words.map((w) => [h('span', { class: `w-${w.status}`, title: w.heard ? `hallott szó: ${w.heard}` : 'nem hallottam' }, w.word), ' '])),
    h('p', { class: 'muted small' }, `Ezt hallottam: „${heard || '…'}”`),
    cmp.extras.length ? h('p', { class: 'muted small' }, `Plusz szavak: ${cmp.extras.join(', ')}`) : null);
}

// Runs a sequence of shadow/prompt items into `root` (recording each attempt via ctx.store),
// then calls onDone({ results, xp }). Shared by the daily speaking session and a sprint's produce day.
export function runSpeakSequence(ctx, root, items, { title = 'Beszéd', onDone, recordScore = recordAttempt } = {}) {
  const today = localDateStr();
  const support = speechSupport();
  const results = [];
  let idx = 0;
  let xp = 0;

  function next() {
    if (idx >= items.length) return onDone({ results, xp });
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
      ctx.store.save((s) => { res = recordScore(s, today, it.id, score, { seconds: secs }); });
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
        ? h('div', { class: 'card-face' }, h('div', { class: 'card-cue' }, it.hu || it.en),
            revealed ? h('div', { class: 'card-answer' }, it.de) : h('p', { class: 'muted small' }, 'Mondd ki németül. Koppints a Súgásra, ha elakadtál.'))
        : h('div', { class: 'card-face' }, h('div', { class: 'card-answer big-de' }, it.de), it.revisit ? h('p', { class: 'muted small' }, 'Átismétlendő kifejezés') : null);
      mount(stage,
        bar(idx / items.length, 'progress'),
        h('p', { class: 'eyebrow' }, it.kind === 'shadow' ? 'Visszhang: hallgasd meg, majd ismételd' : 'Mondd el emlékezetből', h('span', { class: 'chip' }, `${idx + 1} / ${items.length}`)),
        face);
      const buttons = [];
      if (support.tts) {
        buttons.push(h('button', { class: 'btn', onclick: () => speak(it.de) }, 'Lejátszás'));
        buttons.push(h('button', { class: 'btn', onclick: () => speak(it.de, { rate: 0.7 }) }, 'Lassan'));
      }
      if (it.kind === 'prompt' && !revealed) buttons.push(h('button', { class: 'btn', onclick: () => { revealed = true; draw(); } }, 'Súgás'));
      if (support.stt) buttons.push(h('button', { class: 'btn primary', onclick: attempt, 'data-role': 'speak' }, tries ? 'Mondd ki újra' : 'Mondd ki'));
      else {
        buttons.push(h('button', { class: 'btn primary', onclick: () => selfRate(1) }, 'Jól mondtam'));
        buttons.push(h('button', { class: 'btn', onclick: () => selfRate(0.4) }, 'Többet kell gyakorolni'));
      }
      mount(actions, buttons, h('button', { class: 'btn ghost small', onclick: finishItem }, 'Kihagyás'));
    }

    async function attempt() {
      const speakBtn = actions.querySelector('[data-role=speak]');
      if (speakBtn) speakBtn.disabled = true;
      status.textContent = 'Hallgatom… beszélj most';
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
        mount(feedback, h('strong', {}, 'Nincs eredmény'), h('p', {}, errorText(e.code)));
        if (speakBtn) speakBtn.disabled = false;
      }
    }

    function showResult(cmp, transcript, res) {
      const pass = cmp.accuracy >= PASS_THRESHOLD;
      draw();
      feedback.className = `feedback ${pass ? 'right' : 'wrong'}`;
      mount(feedback,
        h('strong', {}, pass ? `Gut! ${Math.round(cmp.accuracy * 100)}%${res.xp ? ` · +${res.xp} XP` : ''}` : `${Math.round(cmp.accuracy * 100)}%: ${cmp.accuracy >= 0.5 ? 'már közel' : 'még nem az igazi'}`),
        diffView(cmp, transcript));
      const more = [];
      if (!pass && tries < MAX_TRIES) more.push(h('button', { class: 'btn primary', onclick: () => { mount(feedback); feedback.className = 'feedback'; attempt(); } }, `Próbáld újra (${MAX_TRIES - tries} van hátra)`));
      if (!pass) more.push(h('button', { class: 'btn', onclick: () => { const r = record(1); showOverruled(r); } }, 'Számítson helyesnek'));
      more.push(h('button', { class: pass || tries >= MAX_TRIES ? 'btn primary' : 'btn ghost small', onclick: finishItem }, 'Tovább'));
      mount(actions, more);
    }

    function showOverruled(res) {
      feedback.className = 'feedback right';
      mount(feedback, h('strong', {}, `Helyesnek számítva${res.xp ? ` · +${res.xp} XP` : ''}`), h('p', { class: 'muted' }, 'A beszédfelismerés nem tökéletes, úgyhogy a tiéd az utolsó szó.'));
      mount(actions, h('button', { class: 'btn primary', onclick: finishItem }, 'Tovább'));
    }

    function selfRate(score) {
      const res = record(score);
      feedback.className = `feedback ${score >= PASS_THRESHOLD ? 'right' : 'wrong'}`;
      mount(feedback, h('strong', {}, score >= PASS_THRESHOLD ? `Rögzítve${res.xp ? ` · +${res.xp} XP` : ''}` : 'Rögzítve: vissza fog térni'));
      mount(actions, h('button', { class: 'btn primary', onclick: finishItem }, 'Tovább'));
    }

    mount(root, topBar(title, ctx), stage, status, feedback, actions);
    draw();
  }

  next();
}

export function speakView(ctx) {
  const root = h('div', { class: 'run' });
  const today = localDateStr();
  const support = speechSupport();
  const items = buildSpeakSession(ctx.store.get(), ctx.data, today);

  function intro() {
    mount(root, topBar('Beszéd', ctx),
      h('div', { class: 'card' },
        h('p', { class: 'eyebrow' }, 'Beszédgyakorlat · kb. 5 perc'),
        h('h1', {}, 'Halld, mondd ki, és lásd mennyire voltál pontos'),
        h('ul', { class: 'intro' },
          h('li', {}, `${items.filter((i) => i.kind === 'shadow').length} kifejezés visszhangozásra: hallgasd meg, majd ismételd.`),
          h('li', {}, `${items.filter((i) => i.kind === 'prompt').length} kolléga-küldetés elmondása emlékezetből.`),
          h('li', {}, 'Legfeljebb három próbálkozás mindegyikhez. Ha a felismerő félrehall, felülbírálhatod.')),
        !support.stt ? h('p', { class: 'note' }, 'Ebben a böngészőben nincs beszédfelismerés (a Chrome-ban van), ezért magad fogod értékelni magad. Meghallgatni továbbra is tudsz.') : null,
        !support.tts ? h('p', { class: 'note' }, 'Ez a böngésző nem tudja felolvasni a németet, ezért nincs Lejátszás gomb.') : null,
        support.stt ? h('p', { class: 'muted small' }, 'A Chrome elküldi a hangot a Google beszédfelismerő szolgáltatásának, hogy szöveggé alakítsa. Ez az app semmit nem tárol belőle.') : null,
        h('button', { class: 'btn primary', onclick: () => { ctx.tracker(); runSpeakSequence(ctx, root, items, { title: 'Beszéd', onDone: summary }); } }, 'Indítás')));
  }

  function summary({ results, xp }) {
    const passed = results.filter((r) => r.best >= PASS_THRESHOLD).length;
    const avg = results.length ? results.reduce((s, r) => s + r.best, 0) / results.length : 0;
    const chosen = ctx.store.get().speaking.log[today]?.confidence;
    const confRow = h('div', { class: 'conf' }, CONFIDENCE_LABELS.map((label, i) =>
      h('button', { class: `btn small${chosen === i + 1 ? ' primary' : ''}`, onclick: () => {
        ctx.store.save((s) => recordConfidence(s, today, i + 1));
        summary({ results, xp });
      } }, `${i + 1} ${label}`)));
    mount(root, topBar('Beszéd', ctx),
      h('div', { class: 'card summary' },
        h('p', { class: 'eyebrow' }, 'Beszédgyakorlat kész'),
        h('h1', {}, `${passed}/${results.length} kifejezés rendben`),
        h('p', {}, `Átlag ${Math.round(avg * 100)}%${xp ? ` · +${xp} XP` : ''}`),
        h('h2', {}, 'Mennyire voltál magabiztos ma beszéd közben?'),
        confRow,
        chosen ? h('p', { class: 'muted' }, 'Mentve. A magabiztosság-trended a Haladás oldalon látható.') : null,
        h('a', { class: 'btn primary', href: '#/' }, 'Kezdőlap')));
  }

  if (!items.length) {
    mount(root, topBar('Beszéd', ctx), h('div', { class: 'card' }, h('p', {}, 'Még nincs beszéd-anyag.'), h('a', { class: 'btn', href: '#/' }, 'Kezdőlap')));
  } else intro();
  return root;
}

import { h, mount } from './ui.js';
import { localDateStr } from './fsrs.js';
import { speak, speechSupport } from './speech.js';
import { daysUntilNext, isPackClaimed, claimPack, dueIndex, INTERVAL_DAYS } from './vocabpacks.js';

const CATEGORY_LABEL = { verb: 'Igék', adjective: 'Melléknevek', adverb: 'Határozószók' };

function itemRow(pack, item, support) {
  const sub = pack.category === 'verb'
    ? `${item.praeteritum} – ${item.aux === 'sein' ? 'ist' : 'hat'} ${item.partizip2}`
    : item.opposite ? `↔ ${item.opposite}` : null;
  return h('div', { class: 'chunk-row' },
    h('span', {}, h('strong', {}, item.de), h('br'), h('span', { class: 'muted small' }, item.hu, sub ? ` · ${sub}` : '')),
    support.tts ? h('button', { class: 'btn small', onclick: () => speak(item.de) }, 'Lejátszás') : null);
}

export function vocabPackView(ctx, id) {
  const root = h('div', {});
  const pack = ctx.data.vocabPacks.find((p) => p.id === id);
  if (!pack) { mount(root, h('div', { class: 'card error' }, h('strong', {}, 'Hiba történt'), h('p', {}, `Ismeretlen szókincs-csomag: ${id}`))); return root; }

  function render() {
    const today = localDateStr();
    const s = ctx.store.get();
    const support = speechSupport();
    const claimed = isPackClaimed(s, pack.id);
    mount(root,
      h('div', { class: 'card' },
        h('p', { class: 'eyebrow' }, CATEGORY_LABEL[pack.category] || pack.category),
        h('h1', {}, pack.title),
        h('p', { class: 'muted' }, pack.category === 'verb'
          ? 'Minden ige a főnévi igenév mellett a Präteritum és a Partizip II alakját is mutatja, a segédigével együtt.'
          : 'Minden szóhoz tartozik egy magyar jelentés, meghallgathatod is a kiejtését.'),
        pack.items.map((item) => itemRow(pack, item, support)),
        claimed
          ? h('p', { class: 'muted' }, 'Ez a csomag már bekerült a napi ismétlésbe.')
          : h('button', { class: 'btn primary', onclick: () => {
              ctx.store.save((st) => claimPack(st, pack, today));
              render();
            } }, 'Hozzáadás a napi ismétléshez'),
        h('a', { class: 'btn ghost', href: '#/vocab' }, 'Összes szókincs-csomag')));
  }
  render();
  return root;
}

export function vocabListView(ctx) {
  const root = h('div', {});
  const today = localDateStr();
  const s = ctx.store.get();
  const packs = ctx.data.vocabPacks;
  const idx = dueIndex(s, today);
  const nodes = packs.map((p, i) => {
    const claimed = isPackClaimed(s, p.id);
    const unlocked = i <= idx || claimed;
    const status = claimed ? 'kész' : unlocked ? 'elérhető' : 'zárolva';
    return h(unlocked ? 'a' : 'div', { class: `node ${claimed ? 'done' : unlocked ? 'open' : 'locked'}`, href: unlocked ? `#/vocab/${p.id}` : null },
      h('span', { class: 'node-dot' }, claimed ? '✓' : unlocked ? '▶' : ''),
      h('span', { class: 'node-title' }, p.title, h('span', { class: 'chip' }, CATEGORY_LABEL[p.category] || p.category)),
      h('span', { class: 'node-status' }, status));
  });
  const wait = daysUntilNext(s, packs, today);
  mount(root,
    h('h1', {}, 'Szókincs-csomagok'),
    h('p', { class: 'muted' }, `Alapigék, melléknevek és határozószók — egy új csomag ${INTERVAL_DAYS} naponta nyílik meg, és a szavai a napi ismétlésbe kerülnek.`),
    nodes,
    wait != null && wait > 0 ? h('p', { class: 'muted small' }, `A következő csomag ${wait} nap múlva nyílik meg.`) : null);
  return root;
}

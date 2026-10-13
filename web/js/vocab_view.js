import { h, mount } from './ui.js';
import { speak, speechSupport } from './speech.js';
import { isTopicActive, activateTopic, deactivateTopic, topicLearnedCount, formatWord } from './vocabtopics.js';

const LEVELS = ['A2', 'B1', 'B2', 'C1'];

function wordRow(topicId, item, support) {
  return h('div', { class: 'chunk-row' },
    h('span', {}, h('strong', {}, formatWord(item)), h('br'), h('span', { class: 'muted small' }, item.hu, item.opposite ? ` · ↔ ${item.opposite}` : '')),
    support.tts ? h('button', { class: 'btn small', onclick: () => speak(item.de) }, 'Lejátszás') : null);
}

export function vocabTopicView(ctx, id) {
  const root = h('div', {});
  const topic = ctx.data.vocabTopics.find((t) => t.id === id);
  if (!topic) { mount(root, h('div', { class: 'card error' }, h('strong', {}, 'Hiba történt'), h('p', {}, `Ismeretlen téma: ${id}`))); return root; }

  function render() {
    const s = ctx.store.get();
    const support = speechSupport();
    const active = isTopicActive(s, topic.id);
    const learned = topicLearnedCount(s, topic.id);
    const byLevel = LEVELS.map((lv) => [lv, topic.items.filter((it) => it.level === lv)]).filter(([, items]) => items.length);
    mount(root,
      h('div', { class: 'card' },
        h('p', { class: 'eyebrow' }, 'Szótanulás'),
        h('h1', {}, topic.title),
        h('p', { class: 'muted' }, topic.description),
        topic.items.length
          ? h('p', { class: 'muted small' }, `${learned}/${topic.items.length} szó már bekerült a napi ismétlésbe.`)
          : h('p', { class: 'muted' }, 'Ez a téma még nincs feltöltve szókinccsel. Hamarosan!'),
        topic.items.length ? h('button', { class: `btn ${active ? '' : 'primary'}`, onclick: () => {
          ctx.store.save((st) => (active ? deactivateTopic(st, topic.id) : activateTopic(st, topic)));
          render();
        } }, active ? 'Téma leállítása' : 'Téma tanulása') : null,
        h('a', { class: 'btn ghost', href: '#/vocab' }, 'Összes téma')),
      byLevel.map(([lv, items]) => h('section', { class: 'card' },
        h('h2', {}, lv),
        items.map((item) => wordRow(topic.id, item, support)))));
  }
  render();
  return root;
}

export function vocabListView(ctx) {
  const root = h('div', {});
  const s = ctx.store.get();
  const topics = ctx.data.vocabTopics;
  const nodes = topics.map((t) => {
    const active = isTopicActive(s, t.id);
    const learned = topicLearnedCount(s, t.id);
    const hasContent = t.items.length > 0;
    const status = !hasContent ? 'hamarosan' : active ? `aktív · ${learned}/${t.items.length}` : `${t.items.length} szó, A2-C1`;
    return h(hasContent ? 'a' : 'div', { class: `node ${active ? 'done' : hasContent ? 'open' : 'locked'}`, href: hasContent ? `#/vocab/${t.id}` : null },
      h('span', { class: 'node-dot' }, active ? '✓' : hasContent ? '▶' : ''),
      h('span', { class: 'node-title' }, t.title),
      h('span', { class: 'node-status' }, status));
  });
  mount(root,
    h('h1', {}, 'Szótanulás'),
    h('p', { class: 'muted' }, 'Válassz egy vagy több témát — a szavaik automatikusan, fokozatosan bekerülnek a napi ismétlésbe, A2-től a megadott szintig. Amit elsőre nem tudsz, az rendes ismétlőkártyaként visszatér.'),
    nodes);
  return root;
}

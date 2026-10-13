// Topic-based vocabulary: pick real-world topics (office work, transport, ...) instead of a
// fixed rotation. A topic's words feed into the normal new-card-per-day introduction once it is
// active, so they trickle into review the same way lesson vocabulary does - no separate scheduler,
// and a word you miss on first try comes back exactly like any other review card (FSRS).
import { newCardFields } from './fsrs.js';

const AUX_FORM = { sein: 'ist', haben: 'hat' };
const INSTANT_SEED = 4; // immediate feedback on activation; the rest trickles in via the daily cap

export function formatWord(item) {
  if (item.type === 'noun') return `${item.artikel} ${item.de}`;
  if (item.type === 'verb' && item.praeteritum && item.partizip2) {
    return `${item.de} – ${item.praeteritum} – ${AUX_FORM[item.aux] || 'hat'} ${item.partizip2}`;
  }
  return item.de;
}

function formatHint(item) {
  const parts = [];
  if (item.opposite) parts.push(`↔ ${item.opposite}`);
  if (item.level) parts.push(`Szint: ${item.level}`);
  return parts.join(' · ');
}

export function cardIdForItem(topicId, item) {
  return `vt_${topicId}_${item.de.replace(/\s+/g, '_')}`;
}

export function cardForTopicItem(topicId, item) {
  return {
    id: cardIdForItem(topicId, item), type: 'flip', src: 'vocabtopic', topic: topicId,
    front: item.hu, back: formatWord(item), hint: formatHint(item),
  };
}

export function isTopicActive(state, topicId) {
  return state.vocabTopics.active.includes(topicId);
}

// Activates the topic and immediately seeds a few of its words, so the effect is visible right
// away instead of waiting for tomorrow's new-card cap; the rest of the topic still trickles in
// through the normal daily pacing (combinedVocabDeck + introduceNewCards).
export function activateTopic(state, topic) {
  if (state.vocabTopics.active.includes(topic.id)) return;
  state.vocabTopics.active.push(topic.id);
  for (const item of topic.items.slice(0, INSTANT_SEED)) {
    const card = cardForTopicItem(topic.id, item);
    if (!state.cards[card.id]) state.cards[card.id] = { ...card, ...newCardFields() };
  }
}

export function deactivateTopic(state, topicId) {
  state.vocabTopics.active = state.vocabTopics.active.filter((id) => id !== topicId);
}

// Round-robins the active topics' items (each already ordered A2->C1 in the content file) into
// one deck, so introduceNewCards's daily cap spreads evenly across every topic picked, instead of
// exhausting one topic before starting the next.
export function combinedVocabDeck(topics, activeIds) {
  const byId = new Map(topics.map((t) => [t.id, t]));
  const queues = activeIds.map((id) => (byId.get(id)?.items || []).map((item) => cardForTopicItem(id, item)));
  const out = [];
  for (let i = 0; queues.some((q) => i < q.length); i++) {
    for (const q of queues) if (i < q.length) out.push(q[i]);
  }
  return out;
}

// How many of a topic's words have already been introduced as cards, for a simple progress readout.
export function topicLearnedCount(state, topicId) {
  const prefix = `vt_${topicId}_`;
  return Object.keys(state.cards).filter((k) => k.startsWith(prefix)).length;
}

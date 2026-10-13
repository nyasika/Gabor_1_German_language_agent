import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultState } from '../web/js/progress.js';
import { mergeStates } from '../web/js/merge.js';
import {
  cardIdForItem, cardForTopicItem, isTopicActive, activateTopic, deactivateTopic,
  combinedVocabDeck, topicLearnedCount,
} from '../web/js/vocabtopics.js';

const topicStub = (id, n = 0) => ({ id, items: Array.from({ length: n }, (_, i) => ({ de: `${id}${i}`, hu: `h${i}`, type: 'phrase', level: 'A2' })) });

test('vocabtopics: activating and deactivating a topic is idempotent', () => {
  const s = defaultState();
  const office = topicStub('office');
  activateTopic(s, office);
  activateTopic(s, office);
  assert.deepEqual(s.vocabTopics.active, ['office']);
  assert.ok(isTopicActive(s, 'office'));
  deactivateTopic(s, 'office');
  deactivateTopic(s, 'office');
  assert.deepEqual(s.vocabTopics.active, []);
  assert.ok(!isTopicActive(s, 'office'));
});

test('vocabtopics: activating seeds an immediate handful of cards, not the whole topic', () => {
  const s = defaultState();
  activateTopic(s, topicStub('office', 10));
  const seeded = Object.keys(s.cards).filter((k) => k.startsWith('vt_office_'));
  assert.equal(seeded.length, 4, 'only the instant-feedback batch is added right away');
  assert.ok(s.cards.vt_office_office0, 'the first item in content order is among the seeded cards');
});

test('vocabtopics: activating twice never re-seeds or duplicates cards', () => {
  const s = defaultState();
  const office = topicStub('office', 10);
  activateTopic(s, office);
  const before = { ...s.cards };
  activateTopic(s, office);
  assert.deepEqual(s.cards, before);
});

test('vocabtopics: cardIdForItem is stable and space-safe', () => {
  assert.equal(cardIdForItem('office', { de: 'Besprechung' }), 'vt_office_Besprechung');
  assert.equal(cardIdForItem('office', { de: 'sich kümmern' }), 'vt_office_sich_kümmern');
});

test('vocabtopics: a noun card shows the artikel in the back', () => {
  const card = cardForTopicItem('office', { type: 'noun', artikel: 'die', de: 'Besprechung', hu: 'megbeszélés', level: 'A2' });
  assert.equal(card.front, 'megbeszélés');
  assert.equal(card.back, 'die Besprechung');
  assert.equal(card.hint, 'Szint: A2');
  assert.equal(card.type, 'flip');
  assert.equal(card.topic, 'office');
});

test('vocabtopics: a verb with past-tense forms shows all three parts and the right auxiliary', () => {
  const card = cardForTopicItem('office', { type: 'verb', de: 'anrufen', hu: 'felhívni', level: 'A2', praeteritum: 'rief an', partizip2: 'angerufen', aux: 'haben' });
  assert.equal(card.back, 'anrufen – rief an – hat angerufen');
  const sein = cardForTopicItem('office', { type: 'verb', de: 'kommen', hu: 'jönni', level: 'A2', praeteritum: 'kam', partizip2: 'gekommen', aux: 'sein' });
  assert.equal(sein.back, 'kommen – kam – ist gekommen');
});

test('vocabtopics: a verb without past-tense forms just shows the infinitive', () => {
  const card = cardForTopicItem('office', { type: 'verb', de: 'delegieren', hu: 'delegálni', level: 'B2' });
  assert.equal(card.back, 'delegieren');
});

test('vocabtopics: an adjective with an opposite carries it in the hint', () => {
  const card = cardForTopicItem('office', { type: 'adjective', de: 'wichtig', hu: 'fontos', level: 'A2', opposite: 'unwichtig' });
  assert.equal(card.hint, '↔ unwichtig · Szint: A2');
});

test('vocabtopics: combinedVocabDeck round-robins active topics in content order', () => {
  const topics = [
    { id: 'a', items: [{ de: 'a1', hu: 'h1', type: 'phrase', level: 'A2' }, { de: 'a2', hu: 'h2', type: 'phrase', level: 'B1' }] },
    { id: 'b', items: [{ de: 'b1', hu: 'h1', type: 'phrase', level: 'A2' }] },
  ];
  const deck = combinedVocabDeck(topics, ['a', 'b']);
  assert.deepEqual(deck.map((c) => c.id), ['vt_a_a1', 'vt_b_b1', 'vt_a_a2']);
});

test('vocabtopics: combinedVocabDeck ignores an unknown or inactive topic id gracefully', () => {
  const topics = [{ id: 'a', items: [{ de: 'a1', hu: 'h1', type: 'phrase', level: 'A2' }] }];
  assert.deepEqual(combinedVocabDeck(topics, ['missing']), []);
  assert.deepEqual(combinedVocabDeck(topics, []), []);
});

test('vocabtopics: topicLearnedCount only counts that topic\'s cards', () => {
  const s = defaultState();
  s.cards.vt_office_Pause = { id: 'vt_office_Pause' };
  s.cards.vt_office_Termin = { id: 'vt_office_Termin' };
  s.cards.vt_transport_Zug = { id: 'vt_transport_Zug' };
  assert.equal(topicLearnedCount(s, 'office'), 2);
  assert.equal(topicLearnedCount(s, 'transport'), 1);
  assert.equal(topicLearnedCount(s, 'health'), 0);
});

test('vocabtopics: phone and PC active-topic selections merge without loss', () => {
  const a = defaultState();
  activateTopic(a, topicStub('office'));
  const b = defaultState();
  activateTopic(b, topicStub('transport'));
  const merged = mergeStates(a, b);
  assert.deepEqual([...merged.vocabTopics.active].sort(), ['office', 'transport']);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateVocabTopics } from '../tools/validate_vocabtopics.mjs';

const base = () => [{ id: 't1', title: 'T', description: 'D', items: [] }];

test('vocab topics: a well-formed noun/verb/adjective/phrase set passes', () => {
  const topics = base();
  topics[0].items = [
    { type: 'noun', artikel: 'die', de: 'Pause', hu: 'szünet', level: 'A2' },
    { type: 'verb', de: 'arbeiten', hu: 'dolgozni', level: 'A2', praeteritum: 'arbeitete', partizip2: 'gearbeitet', aux: 'haben' },
    { type: 'adjective', de: 'wichtig', hu: 'fontos', level: 'B1', opposite: 'unwichtig' },
    { type: 'phrase', de: 'Ich melde mich.', hu: 'Jelzek.', level: 'C1' },
  ];
  const { errors } = validateVocabTopics(topics);
  assert.deepEqual(errors, []);
});

test('vocab topics: a noun without a der/die/das artikel is rejected', () => {
  const topics = base();
  topics[0].items = [{ type: 'noun', de: 'Pause', hu: 'szünet', level: 'A2' }];
  const { errors } = validateVocabTopics(topics);
  assert.ok(errors.some((e) => /artikel/.test(e)));
});

test('vocab topics: a verb with a partial past-tense set is rejected', () => {
  const topics = base();
  topics[0].items = [{ type: 'verb', de: 'gehen', hu: 'menni', level: 'A2', praeteritum: 'ging' }];
  const { errors } = validateVocabTopics(topics);
  assert.ok(errors.some((e) => /past-tense/.test(e)));
});

test('vocab topics: an unknown level is rejected', () => {
  const topics = base();
  topics[0].items = [{ type: 'adverb', de: 'oft', hu: 'gyakran', level: 'B3' }];
  const { errors } = validateVocabTopics(topics);
  assert.ok(errors.some((e) => /level/.test(e)));
});

test('vocab topics: a duplicate word within one topic is rejected', () => {
  const topics = base();
  topics[0].items = [
    { type: 'adverb', de: 'oft', hu: 'gyakran', level: 'A2' },
    { type: 'adverb', de: 'oft', hu: 'sűrűn', level: 'B1' },
  ];
  const { errors } = validateVocabTopics(topics);
  assert.ok(errors.some((e) => /duplicate/.test(e)));
});

test('vocab topics: duplicate topic ids are rejected', () => {
  const topics = [...base(), ...base()];
  const { errors } = validateVocabTopics(topics);
  assert.ok(errors.some((e) => /duplicate topic id/.test(e)));
});

test('vocab topics: an empty items array (content not written yet) is valid', () => {
  const { errors, counts } = validateVocabTopics(base());
  assert.deepEqual(errors, []);
  assert.equal(counts.items, 0);
});

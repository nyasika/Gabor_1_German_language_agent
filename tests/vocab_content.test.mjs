import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateVocabPacks } from '../tools/validate_vocab.mjs';

test('vocabulary pack content is structurally valid', () => {
  const { errors, counts } = validateVocabPacks();
  assert.deepEqual(errors, []);
  assert.ok(counts.packs >= 3);
  assert.ok(counts.items >= 15);
});

test('validator catches a verb pack item missing its past-tense forms', () => {
  const { errors } = validateVocabPacks([
    { id: 'X', category: 'verb', title: 't', items: [{ de: 'gehen', hu: 'menni' }] },
  ]);
  assert.match(errors.join('\n'), /needs praeteritum/);
  assert.match(errors.join('\n'), /needs partizip2/);
});

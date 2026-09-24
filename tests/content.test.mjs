import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateContent } from '../tools/validate_content.mjs';

test('all lesson, card and mission content is structurally valid', () => {
  const { errors, counts } = validateContent();
  assert.deepEqual(errors, []);
  assert.ok(counts.lessons >= 4);
  assert.ok(counts.cards >= 40);
});

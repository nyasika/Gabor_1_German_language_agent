import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSprints } from '../tools/validate_sprints.mjs';

test('sprint content is structurally valid: notice/drill/produce/check days, unique ids', () => {
  const { errors, counts } = validateSprints();
  assert.deepEqual(errors, []);
  assert.ok(counts.sprints >= 2);
});

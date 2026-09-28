import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateMap } from '../tools/validate_map.mjs';

test('curriculum map is structurally valid and ordered by prerequisites', () => {
  const { errors, counts } = validateMap();
  assert.deepEqual(errors, []);
  assert.ok(counts.grammar >= 30);
});

test('curriculum map validator rejects a broken prerequisite order', () => {
  const map = {
    levels: ['B1', 'B2'],
    grammar: [
      { id: 'G1', title: 'a', level: 'B1', requires: ['G2'], cando: 'I can a.', chunks: ['x'] },
      { id: 'G2', title: 'b', level: 'B1', requires: [], cando: 'I can b.', chunks: ['y'] },
    ],
    vocabulary: [], situations: [], extra_sprints: [], sprint_template: { days: [1, 2, 3] },
  };
  assert.match(validateMap(map).errors.join('\n'), /does not come earlier/);
});

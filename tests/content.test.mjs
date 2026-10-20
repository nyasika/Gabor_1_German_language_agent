import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateContent, validateTables, validateExamplesAndPitfalls } from '../tools/validate_content.mjs';

test('all lesson, card and mission content is structurally valid', () => {
  const { errors, counts } = validateContent();
  assert.deepEqual(errors, []);
  assert.ok(counts.lessons >= 4);
  assert.ok(counts.cards >= 40);
});

test('validateTables catches a row with the wrong number of cells', () => {
  const errs = [];
  validateTables([{ title: 'x', headers: ['A', 'B'], rows: [['1', '2'], ['3']] }], (m) => errs.push(m));
  assert.match(errs.join('\n'), /each row must have exactly 2 cells/);
});

test('validateTables accepts a well-formed table and is a no-op when tables is absent', () => {
  const errs = [];
  validateTables([{ title: 'x', headers: ['A', 'B'], rows: [['1', '2']] }], (m) => errs.push(m));
  assert.deepEqual(errs, []);
  validateTables(undefined, (m) => errs.push(m));
  assert.deepEqual(errs, []);
});

test('validateExamplesAndPitfalls catches an incomplete example and an empty pitfalls array', () => {
  const errs = [];
  validateExamplesAndPitfalls({ examples: [{ de: 'Der Tisch.' }] }, (m) => errs.push(m));
  assert.match(errs.join('\n'), /example 1: needs de and hu/);
  errs.length = 0;
  validateExamplesAndPitfalls({ pitfalls: [] }, (m) => errs.push(m));
  assert.match(errs.join('\n'), /pitfalls must be a non-empty array/);
});

test('validateExamplesAndPitfalls accepts well-formed input and is a no-op when both are absent', () => {
  const errs = [];
  validateExamplesAndPitfalls({ examples: [{ de: 'Der Tisch.', hu: 'az asztal.' }], pitfalls: ['Figyelj a névelőre.'] }, (m) => errs.push(m));
  assert.deepEqual(errs, []);
  validateExamplesAndPitfalls({}, (m) => errs.push(m));
  assert.deepEqual(errs, []);
});

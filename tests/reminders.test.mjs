import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dueSlots, zurichMinutes } from '../scripts/reminder_slots.mjs';

const ids = (iso, state) => dueSlots(new Date(iso), state).map((d) => d.slot.id);

test('reminders: a cold state owes both slots, the lesson for yesterday', () => {
  assert.deepEqual(ids('2026-07-15T11:00:00Z', {}), ['review', 'lesson']);
});

test('reminders: nothing is owed once both occurrences are recorded', () => {
  assert.deepEqual(ids('2026-07-15T11:00:00Z', { review: '2026-07-15', lesson: '2026-07-14' }), []);
});

test('reminders: a run landing just after local midnight still catches the prior evening\'s lesson', () => {
  // 22:16 UTC in summer (UTC+2) is already 00:16 the next day in Zurich.
  assert.deepEqual(ids('2026-10-11T22:16:00Z', { review: '2026-10-11', lesson: '2026-10-10' }), ['lesson']);
  assert.deepEqual(ids('2026-10-11T22:16:00Z', { review: '2026-10-11', lesson: '2026-10-11' }), [], 'already recorded for that occurrence');
});

test('reminders: a late-firing run still catches a slot it is well past', () => {
  // 11:00 UTC summer = 13:00 Zurich, five hours after the 07:00 review slot.
  assert.deepEqual(ids('2026-07-15T11:00:00Z', { lesson: '2026-07-14' }), ['review']);
});

test('reminders: DST changeover days resolve to the correct Zurich date', () => {
  assert.deepEqual(ids('2026-03-29T05:00:00Z', {}).includes('review'), true, 'spring forward: 05:00 UTC is 07:00 CEST');
  assert.deepEqual(ids('2026-10-25T06:00:00Z', {}).includes('review'), true, 'fall back: 06:00 UTC is 07:00 CET');
});

test('reminders: an occurrence already sent is not repeated by a second same-day run', () => {
  const state = {};
  const first = dueSlots(new Date('2026-07-15T11:00:00Z'), state);
  for (const { slot, occurrence } of first) state[slot.id] = occurrence;
  assert.deepEqual(ids('2026-07-15T12:00:00Z', state), [], 'a later run the same morning finds nothing new owed');
});

test('zurichMinutes still reports the local time of day', () => {
  assert.equal(zurichMinutes(new Date('2026-07-15T22:30:00Z')), 0 * 60 + 30);
});

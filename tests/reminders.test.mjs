import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dueSlot, zurichMinutes } from '../scripts/reminder_slots.mjs';

const at = (iso) => dueSlot(new Date(iso))?.id ?? null;

test('reminders: summer time (UTC+2) fires the 05:00 and 18:30 UTC runs only', () => {
  assert.equal(at('2026-07-15T05:00:00Z'), 'review');
  assert.equal(at('2026-07-15T06:00:00Z'), null, 'the winter-time twin run must stay silent');
  assert.equal(at('2026-07-15T18:30:00Z'), 'lesson');
  assert.equal(at('2026-07-15T19:30:00Z'), null);
});

test('reminders: winter time (UTC+1) fires the 06:00 and 19:30 UTC runs only', () => {
  assert.equal(at('2026-01-15T06:00:00Z'), 'review');
  assert.equal(at('2026-01-15T05:00:00Z'), null);
  assert.equal(at('2026-01-15T19:30:00Z'), 'lesson');
  assert.equal(at('2026-01-15T18:30:00Z'), null);
});

test('reminders: a late GitHub scheduler run still sends, a very late one does not', () => {
  assert.equal(at('2026-07-15T05:40:00Z'), 'review');
  assert.equal(at('2026-07-15T06:00:00Z'), null);
  assert.equal(at('2026-07-15T18:50:00Z'), 'lesson');
});

test('reminders: the two DST changeover days stay correct', () => {
  assert.equal(at('2026-03-29T05:00:00Z'), 'review', 'spring forward: 05:00 UTC is 07:00 CEST');
  assert.equal(at('2026-03-29T06:00:00Z'), null);
  assert.equal(at('2026-10-25T06:00:00Z'), 'review', 'fall back: 06:00 UTC is 07:00 CET');
  assert.equal(at('2026-10-25T05:00:00Z'), null);
  assert.equal(at('2026-10-25T19:30:00Z'), 'lesson');
});

test('reminders: never fires outside the two windows', () => {
  for (const h of [0, 3, 9, 12, 15, 22]) assert.equal(at(`2026-09-24T${String(h).padStart(2, '0')}:00:00Z`), null, `hour ${h}`);
  assert.equal(zurichMinutes(new Date('2026-07-15T22:30:00Z')), 0 * 60 + 30);
});

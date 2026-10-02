import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, totalXp, dayTotals } from '../web/js/progress.js';
import { nextAvailablePack, daysUntilNext, isPackClaimed, claimPack, dueIndex, INTERVAL_DAYS, cardIdForItem } from '../web/js/vocabpacks.js';
import { mergeStates } from '../web/js/merge.js';

const packs = [
  { id: 'VP01', category: 'verb', title: 'Verbs 1', items: [{ de: 'gehen', hu: 'menni', praeteritum: 'ging', partizip2: 'gegangen', aux: 'sein' }] },
  { id: 'VP02', category: 'adjective', title: 'Adjectives 1', items: [{ de: 'groß', hu: 'nagy', opposite: 'klein (kicsi)' }] },
  { id: 'VP03', category: 'adverb', title: 'Adverbs 1', items: [{ de: 'oft', hu: 'gyakran' }] },
];

test('vocabpacks: day 1 only the first pack is available; the clock starts on first use', () => {
  const s = defaultState();
  assert.equal(s.vocab.startDate, null);
  const pack = nextAvailablePack(s, packs, '2026-01-01');
  assert.equal(pack.id, 'VP01');
  assert.equal(s.vocab.startDate, '2026-01-01', 'the 10-day clock starts the first time this is checked');
  assert.equal(dueIndex(s, '2026-01-01'), 0);
});

test('vocabpacks: the second pack unlocks exactly after INTERVAL_DAYS, not a day earlier', () => {
  const s = defaultState();
  nextAvailablePack(s, packs, '2026-01-01'); // starts the clock
  claimPack(s, packs[0], '2026-01-01');
  const justBefore = `2026-01-${String(1 + INTERVAL_DAYS - 1).padStart(2, '0')}`;
  const onDay = `2026-01-${String(1 + INTERVAL_DAYS).padStart(2, '0')}`;
  assert.equal(nextAvailablePack(s, packs, justBefore), null, 'not yet unlocked one day before the interval');
  assert.equal(nextAvailablePack(s, packs, onDay).id, 'VP02');
});

test('vocabpacks: claiming adds one flip card per word, with principal parts for verbs', () => {
  const s = defaultState();
  const res = claimPack(s, packs[0], '2026-01-01');
  assert.deepEqual(res, { added: 1, xp: 15 });
  const id = cardIdForItem(packs[0], packs[0].items[0]);
  const card = s.cards[id];
  assert.equal(card.type, 'flip');
  assert.equal(card.front, 'menni');
  assert.equal(card.back, 'gehen – ging – ist gegangen', 'shows infinitive, Präteritum and aux + Partizip II');
  assert.equal(card.state, 'new');
  assert.ok(isPackClaimed(s, 'VP01'));
  assert.equal(totalXp(s), 15);
  assert.equal(dayTotals(s, '2026-01-01').xp, 15);
});

test('vocabpacks: an adjective card shows the opposite as a hint, not required to answer', () => {
  const s = defaultState();
  claimPack(s, packs[1], '2026-01-05');
  const id = cardIdForItem(packs[1], packs[1].items[0]);
  assert.equal(s.cards[id].back, 'groß');
  assert.equal(s.cards[id].hint, '↔ klein (kicsi)');
});

test('vocabpacks: claiming twice is a no-op and never overwrites review progress on the cards', () => {
  const s = defaultState();
  claimPack(s, packs[0], '2026-01-01');
  const id = cardIdForItem(packs[0], packs[0].items[0]);
  s.cards[id].state = 'review'; // pretend it has been reviewed since
  s.cards[id].stability = 12;
  const again = claimPack(s, packs[0], '2026-01-20');
  assert.deepEqual(again, { added: 0, xp: 0 });
  assert.equal(s.cards[id].state, 'review', 'existing review progress is untouched');
  assert.equal(totalXp(s), 15, 'no duplicate XP for re-claiming');
});

test('vocabpacks: nextAvailablePack skips packs already claimed, even out of order', () => {
  const s = defaultState();
  nextAvailablePack(s, packs, '2026-01-01');
  claimPack(s, packs[0], '2026-01-01');
  claimPack(s, packs[1], '2026-01-01'); // claimed "early" relative to its own unlock, e.g. via sync
  const onDay20 = '2026-01-21'; // both VP01 and VP02 windows have passed
  assert.equal(nextAvailablePack(s, packs, onDay20).id, 'VP03');
});

test('vocabpacks: once every pack is claimed, nothing more is offered and daysUntilNext is null', () => {
  const s = defaultState();
  nextAvailablePack(s, packs, '2026-01-01');
  for (const p of packs) claimPack(s, p, '2026-01-01');
  assert.equal(nextAvailablePack(s, packs, '2026-06-01'), null);
  assert.equal(daysUntilNext(s, packs, '2026-01-01'), null, 'no more packs scheduled after the last one');
});

test('vocabpacks: daysUntilNext is 0 while a pack is claimable, then counts down to the one after it', () => {
  const s = defaultState();
  nextAvailablePack(s, packs, '2026-01-01'); // starts the clock; VP01 is immediately claimable
  assert.equal(daysUntilNext(s, packs, '2026-01-01'), 0, 'VP01 itself is available right now');
  claimPack(s, packs[0], '2026-01-01');
  assert.equal(daysUntilNext(s, packs, '2026-01-01'), INTERVAL_DAYS, 'now counting down to VP02');
  assert.equal(daysUntilNext(s, packs, '2026-01-05'), INTERVAL_DAYS - 4);
});

test('vocabpacks: phone and PC progress merge without loss, clock keeps the earliest start', () => {
  const phone = defaultState();
  const pc = defaultState();
  nextAvailablePack(phone, packs, '2026-01-03');
  claimPack(phone, packs[0], '2026-01-03');
  nextAvailablePack(pc, packs, '2026-01-01'); // pc started the clock earlier
  claimPack(pc, packs[1], '2026-01-01');
  phone.updatedAt = 1; pc.updatedAt = 2;
  const m = mergeStates(phone, pc);
  assert.equal(m.vocab.startDate, '2026-01-01', 'the earlier start date wins, so nobody loses unlock time');
  assert.deepEqual(new Set(m.vocab.claimed), new Set(['VP01', 'VP02']));
  assert.ok(m.cards[cardIdForItem(packs[0], packs[0].items[0])]);
  assert.ok(m.cards[cardIdForItem(packs[1], packs[1].items[0])]);
});

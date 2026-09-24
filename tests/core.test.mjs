import { test } from 'node:test';
import assert from 'node:assert/strict';
import { review, newCardFields, Rating, retrievability, nextInterval, addDays, daysBetween, previewIntervals } from '../web/js/fsrs.js';
import { defaultState, addActivity, dayTotals, totalXp, levelInfo, updateStreak, displayStreak, recordTopic, mastery, wordsStuck, makeTracker } from '../web/js/progress.js';
import { mergeStates } from '../web/js/merge.js';
import { createStore } from '../web/js/store.js';
import { buildLesson, pickMissions, introduceNewCards, dueCards, nextLesson, isUnlocked } from '../web/js/session.js';
import { norm, matchesAny } from '../web/js/text.js';

const memStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) };
};

test('fsrs: date helpers', () => {
  assert.equal(addDays('2026-09-30', 1), '2026-10-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(daysBetween('2026-03-27', '2026-03-30'), 3);
});

test('fsrs: first review sets stability from rating and schedules', () => {
  const base = { id: 'a', ...newCardFields() };
  const good = review(base, Rating.Good, '2026-09-24');
  assert.equal(good.state, 'review');
  assert.ok(Math.abs(good.stability - 3.7145) < 1e-9);
  assert.equal(good.due, addDays('2026-09-24', nextInterval(3.7145)));
  const again = review(base, Rating.Again, '2026-09-24');
  assert.equal(again.due, '2026-09-25');
  assert.equal(again.lapses, 1);
  const easy = review(base, Rating.Easy, '2026-09-24');
  assert.ok(easy.stability > good.stability);
});

test('fsrs: retrievability is 0.9 at the scheduled interval', () => {
  const s = 10;
  const iv = nextInterval(s, 0.9);
  assert.ok(Math.abs(retrievability(iv, s) - 0.9) < 0.02);
});

test('fsrs: successful reviews grow stability, lapses shrink it', () => {
  let c = review({ id: 'a', ...newCardFields() }, Rating.Good, '2026-01-01');
  const s1 = c.stability;
  c = review(c, Rating.Good, c.due);
  assert.ok(c.stability > s1);
  const s2 = c.stability;
  const lapsed = review(c, Rating.Again, c.due);
  assert.ok(lapsed.stability < s2);
  assert.equal(lapsed.lapses, 1);
});

test('fsrs: rating order gives increasing intervals', () => {
  let c = review({ id: 'a', ...newCardFields() }, Rating.Good, '2026-01-01');
  const p = previewIntervals(c, c.due);
  assert.ok(p.Again <= p.Hard && p.Hard <= p.Good && p.Good <= p.Easy);
});

test('progress: xp/level/topic mastery/words stuck', () => {
  const s = defaultState();
  addActivity(s, '2026-09-24', 'lesson', { xp: 100, answers: 10, correct: 8, seconds: 600 });
  addActivity(s, '2026-09-24', 'review', { xp: 20, seconds: 300 });
  assert.equal(totalXp(s), 120);
  assert.equal(dayTotals(s, '2026-09-24').seconds, 900);
  assert.equal(levelInfo(0).level, 1);
  assert.ok(levelInfo(120).level >= 2);
  recordTopic(s, 'Passiv', true);
  recordTopic(s, 'Passiv', false);
  assert.equal(mastery(s, 'Passiv'), 0.5);
  assert.equal(mastery(s, 'Unknown'), null);
  s.cards.x = { state: 'review', stability: 30 };
  s.cards.y = { state: 'review', stability: 5 };
  assert.equal(wordsStuck(s), 1);
});

test('progress: streak qualifies at 10 minutes, breaks, and freezes cover one missed day', () => {
  const s = defaultState();
  addActivity(s, '2026-09-01', 'lesson', { seconds: 300 });
  updateStreak(s, '2026-09-01');
  assert.equal(s.streak.current, 0, 'under 10 min does not count');
  addActivity(s, '2026-09-01', 'review', { seconds: 400 });
  updateStreak(s, '2026-09-01');
  assert.equal(s.streak.current, 1);
  updateStreak(s, '2026-09-01');
  assert.equal(s.streak.current, 1, 'idempotent within a day');
  for (let d = 2; d <= 7; d++) {
    const date = `2026-09-0${d}`;
    addActivity(s, date, 'lesson', { seconds: 700 });
    updateStreak(s, date);
  }
  assert.equal(s.streak.current, 7);
  assert.equal(s.streak.freezes, 1, 'freeze earned at 7');
  addActivity(s, '2026-09-09', 'lesson', { seconds: 700 }); // 09-08 missed
  updateStreak(s, '2026-09-09');
  assert.equal(s.streak.current, 8);
  assert.equal(s.streak.freezes, 0);
  addActivity(s, '2026-09-12', 'lesson', { seconds: 700 }); // two days missed
  updateStreak(s, '2026-09-12');
  assert.equal(s.streak.current, 1);
  assert.equal(s.streak.longest, 8);
  assert.equal(displayStreak(s, '2026-09-13'), 1);
  assert.equal(displayStreak(s, '2026-09-20'), 0);
});

test('progress: tracker ignores idle gaps', () => {
  const t = makeTracker(60000);
  assert.equal(t(1000), 0);
  assert.equal(t(11000), 10);
  assert.equal(t(200000), 0);
});

test('store: saves immediately, survives reload, rejects bad imports', () => {
  const storage = memStorage();
  const a = createStore(storage, 'k');
  a.save((s) => addActivity(s, '2026-09-24', 'lesson', { xp: 10 }));
  assert.ok(a.status().savedAt);
  const b = createStore(storage, 'k');
  assert.equal(totalXp(b.get()), 10);
  assert.throws(() => b.importJson('{"nope":1}'));
  b.importJson(a.exportJson());
  assert.equal(totalXp(b.get()), 10);
});

test('merge: phone + pc progress are both kept', () => {
  const phone = defaultState();
  const pc = defaultState();
  addActivity(phone, '2026-09-24', 'review', { xp: 30, seconds: 600 });
  addActivity(pc, '2026-09-24', 'lesson', { xp: 50, seconds: 900 });
  phone.updatedAt = 100;
  pc.updatedAt = 200;
  phone.cards.a = { id: 'a', state: 'review', last: '2026-09-24', reps: 2 };
  pc.cards.a = { id: 'a', state: 'review', last: '2026-09-20', reps: 1 };
  pc.cards.b = { id: 'b', state: 'review', last: '2026-09-24', reps: 1 };
  pc.lessons.L01 = { done: true, bestScore: 0.9, attempts: 1 };
  phone.lessons.L01 = { done: false, bestScore: 0.5, attempts: 2 };
  phone.gaps.push({ id: 'g1', date: '2026-09-24', text: 'x' });
  pc.gaps.push({ id: 'g2', date: '2026-09-24', text: 'y' });
  const m = mergeStates(phone, pc);
  assert.equal(totalXp(m), 80);
  assert.equal(m.cards.a.reps, 2, 'newer review of the same card wins');
  assert.ok(m.cards.b);
  assert.equal(m.lessons.L01.done, true);
  assert.equal(m.lessons.L01.bestScore, 0.9);
  assert.equal(m.lessons.L01.attempts, 2);
  assert.equal(m.gaps.length, 2);
});

test('session: lesson builder never repeats a type back-to-back and varies the lead', () => {
  const types = ['mc', 'cloze', 'order', 'match', 'errorspot'];
  const pool = [];
  let id = 0;
  for (const t of types) for (let i = 0; i < 3; i++) pool.push({ id: `e${id++}`, type: t });
  for (let run = 0; run < 200; run++) {
    const prevLead = types[run % types.length];
    const picked = buildLesson(pool, { n: 10, prevLead });
    assert.equal(picked.length, 10);
    assert.notEqual(picked[0].type, prevLead);
    for (let i = 1; i < picked.length; i++) assert.notEqual(picked[i].type, picked[i - 1].type);
    assert.equal(new Set(picked.map((p) => p.id)).size, 10, 'no duplicates');
    assert.ok(new Set(picked.map((p) => p.type)).size >= 4);
  }
});

test('session: builder degrades gracefully when one type dominates', () => {
  const pool = [{ id: 'a', type: 'mc' }, { id: 'b', type: 'mc' }, { id: 'c', type: 'cloze' }];
  const picked = buildLesson(pool, { n: 10 });
  assert.equal(picked.length, 3);
});

test('session: missions rotate daily and new cards are introduced once per day', () => {
  const missions = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, hu: `hu${i}`, en: `en${i}`, de: `de${i}` }));
  const deck = Array.from({ length: 10 }, (_, i) => ({ id: `v${i}`, type: 'flip', front: `f${i}`, back: `b${i}` }));
  const d1 = pickMissions(missions, '2026-09-24', 3).map((m) => m.id);
  const d2 = pickMissions(missions, '2026-09-25', 3).map((m) => m.id);
  assert.notDeepEqual(d1, d2);
  const s = defaultState();
  const added = introduceNewCards(s, { deck, missions }, '2026-09-24');
  assert.equal(added.length, 3 + 4);
  assert.deepEqual(introduceNewCards(s, { deck, missions }, '2026-09-24'), [], 'idempotent per day');
  const next = introduceNewCards(s, { deck, missions }, '2026-09-25');
  assert.equal(next.filter((id) => id.startsWith('v')).length, 4);
  assert.equal(new Set(Object.keys(s.cards)).size, Object.keys(s.cards).length);
});

test('session: skipped days do not snowball new vocabulary', () => {
  const missions = [{ id: 'p0', hu: 'h', en: 'e', de: 'd' }];
  const deck = Array.from({ length: 60 }, (_, i) => ({ id: `v${i}`, type: 'flip', front: `f${i}`, back: `b${i}` }));
  const s = defaultState();
  s.settings.missionsPerDay = 1;
  for (let day = 1; day <= 10; day++) introduceNewCards(s, { deck, missions }, `2026-09-${String(day).padStart(2, '0')}`);
  const vocab = Object.keys(s.cards).filter((id) => id.startsWith('v')).length;
  assert.ok(vocab <= 15 + 4, `vocab introduced without any review should plateau, got ${vocab}`);
});

test('session: due queue puts reviews before new cards and honours the cap', () => {
  const s = defaultState();
  s.cards.n1 = { id: 'n1', state: 'new' };
  s.cards.r1 = { id: 'r1', state: 'review', due: '2026-09-20', difficulty: 5 };
  s.cards.r2 = { id: 'r2', state: 'review', due: '2026-09-30', difficulty: 5 };
  const q = dueCards(s, '2026-09-24', 30);
  assert.deepEqual(q.map((c) => c.id), ['r1', 'n1']);
  assert.equal(dueCards(s, '2026-09-24', 1).length, 1);
});

test('session: lesson path unlocks sequentially', () => {
  const path = { chapters: [{ id: 'c1', lessons: ['L1', 'L2'] }, { id: 'c2', lessons: ['L3'] }] };
  const s = defaultState();
  assert.equal(nextLesson(path, s), 'L1');
  assert.ok(isUnlocked(path, s, 'L1'));
  assert.ok(!isUnlocked(path, s, 'L2'));
  s.lessons.L1 = { done: true };
  assert.ok(isUnlocked(path, s, 'L2'));
  assert.equal(nextLesson(path, s), 'L2');
});

test('text: normalisation tolerates case, spacing and umlaut aliases', () => {
  assert.equal(norm('  Hätte. '), 'haette');
  assert.ok(matchesAny('haette', ['hätte']));
  assert.ok(matchesAny('Strasse', ['Straße']));
  assert.ok(matchesAny('  vom  ', ['vom', 'von dem']));
  assert.ok(!matchesAny('hatte', ['hätte']));
});

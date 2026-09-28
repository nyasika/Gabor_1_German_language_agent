import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, totalXp, recordTopic, dayTotals } from '../web/js/progress.js';
import { startSprint, pauseSprint, completeSprintDay, currentDay, isSprintDone, sprintProgress, suggestSprint, addMistakeCard } from '../web/js/sprint.js';
import { mergeStates } from '../web/js/merge.js';

test('sprint: starting sets the active sprint and initialises day 1', () => {
  const s = defaultState();
  startSprint(s, 'G05', '2026-09-24');
  assert.equal(s.sprints.active, 'G05');
  assert.equal(currentDay(s, 'G05'), 1);
  assert.equal(sprintProgress(s, 'G05').startedDate, '2026-09-24');
  startSprint(s, 'G05', '2026-09-25'); // resuming does not reset progress
  assert.equal(sprintProgress(s, 'G05').startedDate, '2026-09-24');
});

test('sprint: completing days advances day, awards XP once, and completes on the last day', () => {
  const s = defaultState();
  startSprint(s, 'G05', '2026-09-24');
  const r1 = completeSprintDay(s, 'G05', 1, 5, '2026-09-24', {});
  assert.deepEqual(r1, { xp: 15, completed: false });
  assert.equal(currentDay(s, 'G05'), 2);
  assert.ok(!isSprintDone(s, 'G05'));
  // repeating day 1 does not pay XP again and does not move day backward
  const r1b = completeSprintDay(s, 'G05', 1, 5, '2026-09-25', {});
  assert.deepEqual(r1b, { xp: 0, completed: false });
  assert.equal(currentDay(s, 'G05'), 2);

  completeSprintDay(s, 'G05', 2, 5, '2026-09-25', { score: 0.8 });
  completeSprintDay(s, 'G05', 3, 5, '2026-09-26', { score: 0.7 });
  completeSprintDay(s, 'G05', 4, 5, '2026-09-27', {});
  const r5 = completeSprintDay(s, 'G05', 5, 5, '2026-09-28', { score: 0.9 });
  assert.deepEqual(r5, { xp: 35, completed: true }, 'last day pays the first-pass XP plus the completion bonus');
  assert.ok(isSprintDone(s, 'G05'));
  assert.equal(s.sprints.active, null, 'finishing a sprint clears the active pointer');
  assert.equal(sprintProgress(s, 'G05').completedDate, '2026-09-28');
  assert.equal(totalXp(s), 15 + 15 + 15 + 15 + 35);
});

test('sprint: a day counts toward the streak and daily activity log', () => {
  const s = defaultState();
  startSprint(s, 'G05', '2026-09-24');
  completeSprintDay(s, 'G05', 1, 5, '2026-09-24', { seconds: 300 });
  assert.equal(dayTotals(s, '2026-09-24').seconds, 300);
  assert.ok(s.log['2026-09-24'].sprint);
});

test('sprint: pausing leaves progress intact so it can be resumed later', () => {
  const s = defaultState();
  startSprint(s, 'G05', '2026-09-24');
  completeSprintDay(s, 'G05', 1, 5, '2026-09-24', {});
  pauseSprint(s);
  assert.equal(s.sprints.active, null);
  assert.equal(currentDay(s, 'G05'), 2, 'progress on the paused sprint survives');
});

test('sprint: mistakes become review cards, same as a lesson', () => {
  const s = defaultState();
  addMistakeCard(s, { id: 'G05S-d2-01', type: 'cloze', sentence: 'Es ___ sinnvoll.', answers: ['wäre'], topic: 'G05' });
  assert.ok(s.cards['err_G05S-d2-01']);
  assert.equal(s.cards['err_G05S-d2-01'].state, 'new');
});

test('sprint: suggestion picks the weakest sampled topic that has content and is not done', () => {
  const s = defaultState();
  const available = ['G05', 'SP01'];
  assert.equal(suggestSprint(s, available), null, 'not enough samples yet');
  for (let i = 0; i < 6; i++) recordTopic(s, 'G05', i < 2); // 2/6 = 0.33
  for (let i = 0; i < 6; i++) recordTopic(s, 'SP01', i < 5); // 5/6 = 0.83, above threshold
  for (let i = 0; i < 6; i++) recordTopic(s, 'G09', false); // weak but no sprint content available
  assert.equal(suggestSprint(s, available), 'G05', 'the weak, sampled, available topic wins');
  startSprint(s, 'G01', '2026-09-24');
  assert.equal(suggestSprint(s, available), null, 'no suggestion while a sprint is already active');
  pauseSprint(s);
  const s2 = defaultState();
  for (let i = 0; i < 6; i++) recordTopic(s2, 'G05', i < 2);
  startSprint(s2, 'G05', '2026-09-24');
  for (let d = 1; d <= 5; d++) completeSprintDay(s2, 'G05', d, 5, '2026-09-24', {});
  assert.equal(suggestSprint(s2, available), null, 'a finished sprint is not suggested again even if still weak');
});

test('sprint: phone and PC sprint progress merge without loss', () => {
  const phone = defaultState();
  const pc = defaultState();
  startSprint(phone, 'G05', '2026-09-24');
  completeSprintDay(phone, 'G05', 1, 5, '2026-09-24', { score: 0.5 });
  startSprint(pc, 'G05', '2026-09-24');
  completeSprintDay(pc, 'G05', 1, 5, '2026-09-24', { score: 0.9 });
  completeSprintDay(pc, 'G05', 2, 5, '2026-09-24', { score: 0.8 });
  phone.updatedAt = 1; pc.updatedAt = 2;
  const m = mergeStates(phone, pc);
  assert.equal(m.sprints.progress.G05.day, 3);
  assert.equal(m.sprints.progress.G05.dayResults[1].score, 0.9, 'the better score for a shared day wins');
  assert.equal(m.sprints.active, 'G05', 'active comes from the newer state (pc)');
});

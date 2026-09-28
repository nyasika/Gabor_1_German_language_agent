// Sprints: a 3-7 day focused deep-dive on one topic, on top of the normal daily path.
import { addActivity, updateStreak } from './progress.js';
import { newCardFields } from './fsrs.js';
import { cardFromExercise } from './exercises.js';

export function sprintProgress(state, id) {
  return state.sprints.progress[id] || null;
}

export function currentDay(state, id) {
  return sprintProgress(state, id)?.day ?? 1;
}

export function isSprintDone(state, id) {
  return !!sprintProgress(state, id)?.completedDate;
}

export function startSprint(state, id, today) {
  state.sprints.active = id;
  if (!state.sprints.progress[id]) {
    state.sprints.progress[id] = { day: 1, dayResults: {}, startedDate: today, completedDate: null };
  }
}

export function pauseSprint(state) {
  state.sprints.active = null;
}

const FIRST_PASS_XP = 15;
const COMPLETION_BONUS_XP = 20;

// Records a day's result, advances to the next day, and completes the sprint on the last day.
export function completeSprintDay(state, id, day, totalDays, today, { score = null, seconds = 0 } = {}) {
  const p = state.sprints.progress[id];
  const first = !p.dayResults[day];
  p.dayResults[day] = { done: true, score };
  const xp = first ? FIRST_PASS_XP : 0;
  addActivity(state, today, 'sprint', { seconds, xp, answers: score != null ? 1 : 0, correct: score != null && score >= 0.8 ? 1 : 0 });
  updateStreak(state, today);
  if (first && day === p.day && day < totalDays) p.day = day + 1;
  const completed = day >= totalDays;
  if (completed && !p.completedDate) {
    p.completedDate = today;
    state.sprints.active = null;
    addActivity(state, today, 'sprint', { xp: COMPLETION_BONUS_XP });
  }
  return { xp: xp + (completed && first ? COMPLETION_BONUS_XP : 0), completed };
}

// A wrong sprint exercise becomes a review card, same as a lesson mistake.
export function addMistakeCard(state, ex) {
  const card = cardFromExercise(ex);
  if (card && !state.cards[card.id]) state.cards[card.id] = { ...card, ...newCardFields() };
}

// Suggests the weakest topic with sprint content available, once there is enough data to trust it.
export function suggestSprint(state, availableIds, { minSamples = 6, maxMastery = 0.6 } = {}) {
  if (state.sprints.active) return null;
  const candidates = Object.entries(state.topics)
    .filter(([id, t]) => availableIds.includes(id) && t.hist.length >= minSamples && !isSprintDone(state, id))
    .map(([id, t]) => [id, t.hist.reduce((a, b) => a + b, 0) / t.hist.length])
    .filter(([, mastery]) => mastery < maxMastery)
    .sort((a, b) => a[1] - b[1]);
  return candidates[0]?.[0] ?? null;
}

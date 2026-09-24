// XP, levels, streak, topic mastery. All pure functions over the state object.
import { daysBetween } from './fsrs.js';

export const SLOTS = ['review', 'lesson', 'extra'];

export function defaultState() {
  return {
    version: 1,
    updatedAt: 0,
    settings: {
      dailyGoalMin: 30,
      streakMinMinutes: 10,
      newVocabPerDay: 4,
      missionsPerDay: 3,
      sync: { url: '', anonKey: '', email: '' },
    },
    log: {},
    streak: { current: 0, longest: 0, lastQualified: null, freezes: 0 },
    cards: {},
    introduced: {},
    lessons: {},
    topics: {},
    gaps: [],
    missionsUsed: {},
    lastLead: null,
  };
}

export function addActivity(state, date, slot, { seconds = 0, xp = 0, answers = 0, correct = 0 } = {}) {
  const day = (state.log[date] ||= {});
  const s = (day[slot] ||= { seconds: 0, xp: 0, answers: 0, correct: 0 });
  s.seconds += seconds;
  s.xp += xp;
  s.answers += answers;
  s.correct += correct;
}

export function dayTotals(state, date) {
  const t = { seconds: 0, xp: 0, answers: 0, correct: 0 };
  const day = state.log[date] || {};
  for (const slot of Object.values(day)) {
    t.seconds += slot.seconds || 0;
    t.xp += slot.xp || 0;
    t.answers += slot.answers || 0;
    t.correct += slot.correct || 0;
  }
  return t;
}

export function totalXp(state) {
  let xp = 0;
  for (const date of Object.keys(state.log)) xp += dayTotals(state, date).xp;
  return xp;
}

export function levelInfo(xp) {
  const level = Math.floor(Math.sqrt(xp / 60)) + 1;
  const lo = 60 * (level - 1) ** 2;
  const hi = 60 * level ** 2;
  return { level, into: xp - lo, span: hi - lo };
}

export function updateStreak(state, today) {
  const min = (state.settings.streakMinMinutes ?? 10) * 60;
  if (dayTotals(state, today).seconds < min) return;
  const st = state.streak;
  if (st.lastQualified === today) return;
  if (!st.lastQualified) {
    st.current = 1;
  } else {
    const gap = daysBetween(st.lastQualified, today);
    if (gap === 1) st.current += 1;
    else if (gap === 2 && st.freezes > 0) {
      st.freezes -= 1;
      st.current += 1;
    } else st.current = 1;
  }
  st.lastQualified = today;
  st.longest = Math.max(st.longest, st.current);
  if (st.current % 7 === 0) st.freezes = Math.min(2, st.freezes + 1);
}

// Streak as it should be displayed today (broken streaks show 0).
export function displayStreak(state, today) {
  const st = state.streak;
  if (!st.lastQualified) return 0;
  const gap = daysBetween(st.lastQualified, today);
  if (gap <= 1) return st.current;
  if (gap === 2 && st.freezes > 0) return st.current;
  return 0;
}

export function recordTopic(state, topic, ok) {
  if (!topic) return;
  const t = (state.topics[topic] ||= { hist: [] });
  t.hist.push(ok ? 1 : 0);
  if (t.hist.length > 20) t.hist.shift();
}

export function mastery(state, topic) {
  const h = state.topics[topic]?.hist || [];
  if (!h.length) return null;
  return h.reduce((a, b) => a + b, 0) / h.length;
}

export function wordsStuck(state, minStability = 21) {
  return Object.values(state.cards).filter((c) => c.state === 'review' && c.stability >= minStability).length;
}

// Per-second tracker: counts active time, ignoring long idle gaps.
export function makeTracker(maxGapMs = 60000) {
  let last = 0;
  return (now = Date.now()) => {
    const gap = last && now - last < maxGapMs ? (now - last) / 1000 : 0;
    last = now;
    return gap;
  };
}

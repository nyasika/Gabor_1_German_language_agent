// Speaking practice: session building and progress tracking (pure functions over the state).
import { daysBetween, addDays } from './fsrs.js';
import { addActivity, updateStreak } from './progress.js';
import { pickMissions } from './session.js';
import { PASS_THRESHOLD } from './compare.js';

const dayNumber = (d) => daysBetween('2000-01-01', d);

export function allPhrases({ missions, chunks }) {
  const map = new Map();
  for (const m of missions) map.set(`m_${m.id}`, { id: `m_${m.id}`, de: m.de, en: m.en, hu: m.hu });
  for (const c of chunks) map.set(c.id, { id: c.id, de: c.de, topic: c.topic });
  return map;
}

// About 8 items / 5 minutes: shadow a few chunks, say today's missions from memory, revisit weak phrases.
export function buildSpeakSession(state, data, today, { shadow = 3, prompt = 3, review = 2 } = {}) {
  const phrases = state.speaking.phrases;
  const items = [];
  const used = new Set();

  for (const m of pickMissions(data.missions, today, state.settings.missionsPerDay).slice(0, prompt)) {
    used.add(`m_${m.id}`);
    items.push({ id: `m_${m.id}`, kind: 'prompt', de: m.de, en: m.en, hu: m.hu });
  }

  const chunks = data.chunks;
  if (chunks.length) {
    const start = (dayNumber(today) * shadow) % chunks.length;
    let picked = 0;
    for (let k = 0; k < chunks.length && picked < shadow; k++) {
      const c = chunks[(start + k) % chunks.length];
      if (used.has(c.id) || (phrases[c.id]?.best ?? 0) >= 0.9) continue;
      used.add(c.id);
      items.push({ id: c.id, kind: 'shadow', de: c.de, topic: c.topic });
      picked++;
    }
  }

  const lookup = allPhrases(data);
  const weak = Object.entries(phrases)
    .filter(([id, p]) => p.tries > 0 && p.best < PASS_THRESHOLD && !used.has(id) && lookup.has(id))
    .sort((a, b) => a[1].best - b[1].best)
    .slice(0, review);
  for (const [id] of weak) items.push({ id, kind: 'shadow', de: lookup.get(id).de, revisit: true });
  return items;
}

export function recordAttempt(state, today, id, score, { seconds = 0 } = {}) {
  const p = (state.speaking.phrases[id] ||= { tries: 0, best: 0, last: null });
  p.tries += 1;
  p.best = Math.max(p.best, score);
  p.last = today;
  const day = (state.speaking.log[today] ||= { attempts: 0, passes: 0, scoreSum: 0, confidence: null, ids: [] });
  day.attempts += 1;
  day.scoreSum += score;
  const pass = score >= PASS_THRESHOLD;
  let xp = 0;
  if (pass) {
    day.passes += 1;
    if (!day.ids.includes(id)) { day.ids.push(id); xp = 3; }
  }
  addActivity(state, today, 'speak', { seconds, xp, answers: 1, correct: pass ? 1 : 0 });
  updateStreak(state, today);
  return { pass, xp };
}

export function recordConfidence(state, today, rating) {
  const day = (state.speaking.log[today] ||= { attempts: 0, passes: 0, scoreSum: 0, confidence: null, ids: [] });
  day.confidence = rating;
}

export function addTalk(state, today, delta = 1) {
  state.talks[today] = Math.max(0, (state.talks[today] || 0) + delta);
}

function period(state, today, from, to) {
  let attempts = 0; let passes = 0; let scoreSum = 0; let talks = 0; const conf = [];
  for (let i = from; i < to; i++) {
    const d = addDays(today, -i);
    const day = state.speaking.log[d];
    if (day) {
      attempts += day.attempts; passes += day.passes; scoreSum += day.scoreSum;
      if (day.confidence != null) conf.push(day.confidence);
    }
    talks += state.talks[d] || 0;
  }
  return {
    attempts, passes, talks,
    accuracy: attempts ? scoreSum / attempts : null,
    confidence: conf.length ? conf.reduce((a, b) => a + b, 0) / conf.length : null,
  };
}

export function speakingStats(state, today) {
  return { week: period(state, today, 0, 7), previous: period(state, today, 7, 14) };
}

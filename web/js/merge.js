// Merge two states (phone + PC) without losing progress from either side.
import { defaultState } from './progress.js';

const maxNum = (a, b) => Math.max(a || 0, b || 0);

function mergeLog(a, b) {
  const out = {};
  for (const date of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const da = a[date] || {};
    const db = b[date] || {};
    out[date] = {};
    for (const slot of new Set([...Object.keys(da), ...Object.keys(db)])) {
      const sa = da[slot] || {};
      const sb = db[slot] || {};
      out[date][slot] = {
        seconds: maxNum(sa.seconds, sb.seconds),
        xp: maxNum(sa.xp, sb.xp),
        answers: maxNum(sa.answers, sb.answers),
        correct: maxNum(sa.correct, sb.correct),
      };
    }
  }
  return out;
}

function mergeCards(a, b) {
  const out = { ...a };
  for (const [id, cb] of Object.entries(b)) {
    const ca = out[id];
    if (!ca) out[id] = cb;
    else if ((cb.last || '') > (ca.last || '') || ((cb.last || '') === (ca.last || '') && (cb.reps || 0) > (ca.reps || 0))) {
      out[id] = cb;
    }
  }
  return out;
}

function mergeLessons(a, b) {
  const out = { ...a };
  for (const [id, lb] of Object.entries(b)) {
    const la = out[id];
    if (!la) out[id] = lb;
    else {
      out[id] = {
        done: !!(la.done || lb.done),
        bestScore: maxNum(la.bestScore, lb.bestScore),
        attempts: maxNum(la.attempts, lb.attempts),
        completedAt: la.completedAt || lb.completedAt || null,
      };
    }
  }
  return out;
}

function mergeGaps(a, b) {
  const byId = new Map();
  for (const g of [...a, ...b]) {
    const prev = byId.get(g.id);
    if (!prev || (g.converted && !prev.converted)) byId.set(g.id, g);
  }
  return [...byId.values()].sort((x, y) => (x.date < y.date ? -1 : 1));
}

function mergeTopics(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (!out[k] || v.hist.length > out[k].hist.length) out[k] = v;
  }
  return out;
}

function mergeUnionMap(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] = Array.isArray(v) ? [...new Set([...(out[k] || []), ...v])] : v;
  }
  return out;
}

export function mergeStates(local, remote) {
  const base = defaultState();
  const newer = (remote.updatedAt || 0) > (local.updatedAt || 0) ? remote : local;
  const other = newer === local ? remote : local;
  const streakA = local.streak || base.streak;
  const streakB = remote.streak || base.streak;
  const streak =
    (streakB.lastQualified || '') > (streakA.lastQualified || '') ||
    ((streakB.lastQualified || '') === (streakA.lastQualified || '') && streakB.current > streakA.current)
      ? streakB
      : streakA;
  return {
    ...base,
    version: 1,
    updatedAt: Math.max(local.updatedAt || 0, remote.updatedAt || 0),
    settings: { ...base.settings, ...(other.settings || {}), ...(newer.settings || {}) },
    log: mergeLog(local.log || {}, remote.log || {}),
    streak: { ...streak, longest: maxNum(streakA.longest, streakB.longest) },
    cards: mergeCards(local.cards || {}, remote.cards || {}),
    introduced: mergeUnionMap(local.introduced || {}, remote.introduced || {}),
    lessons: mergeLessons(local.lessons || {}, remote.lessons || {}),
    topics: mergeTopics(local.topics || {}, remote.topics || {}),
    gaps: mergeGaps(local.gaps || [], remote.gaps || []),
    missionsUsed: mergeUnionMap(local.missionsUsed || {}, remote.missionsUsed || {}),
    lastLead: newer.lastLead ?? other.lastLead ?? null,
  };
}

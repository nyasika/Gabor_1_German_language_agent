// FSRS-4.5 scheduler (default parameters), day-granularity.
const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474,
  0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const DECAY = -0.5;
const FACTOR = 19 / 81;

export const Rating = { Again: 1, Hard: 2, Good: 3, Easy: 4 };

const clamp = (x, lo, hi) => Math.min(Math.max(x, lo), hi);

export function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const toUtcDay = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};

export function daysBetween(a, b) {
  return Math.round(toUtcDay(b) - toUtcDay(a));
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

export function retrievability(elapsedDays, stability) {
  return Math.pow(1 + (FACTOR * elapsedDays) / stability, DECAY);
}

export function nextInterval(stability, retention = 0.9) {
  const days = (stability / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1);
  return Math.max(1, Math.round(days));
}

const initDifficulty = (g) => clamp(W[4] - W[5] * (g - 3), 1, 10);
const initStability = (g) => Math.max(W[g - 1], 0.1);

export function newCardFields() {
  return { state: 'new', stability: 0, difficulty: 0, reps: 0, lapses: 0, last: null, due: null };
}

export function review(card, rating, today) {
  const c = { ...card };
  if (c.state === 'new' || !c.stability) {
    c.stability = initStability(rating);
    c.difficulty = initDifficulty(rating);
    c.reps = 1;
    c.lapses = rating === 1 ? 1 : 0;
  } else {
    const elapsed = Math.max(0, daysBetween(c.last, today));
    const r = retrievability(elapsed, c.stability);
    if (rating === 1) {
      c.stability = Math.max(
        0.1,
        W[11] * Math.pow(c.difficulty, -W[12]) * (Math.pow(c.stability + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r))
      );
      c.lapses = (c.lapses || 0) + 1;
    } else {
      const hardPenalty = rating === 2 ? W[15] : 1;
      const easyBonus = rating === 4 ? W[16] : 1;
      c.stability =
        c.stability *
        (Math.exp(W[8]) * (11 - c.difficulty) * Math.pow(c.stability, -W[9]) *
          (Math.exp(W[10] * (1 - r)) - 1) * hardPenalty * easyBonus + 1);
    }
    const d = c.difficulty - W[6] * (rating - 3);
    c.difficulty = clamp(W[7] * initDifficulty(3) + (1 - W[7]) * d, 1, 10);
    c.reps = (c.reps || 0) + 1;
  }
  c.stability = Math.min(c.stability, 36500);
  c.state = 'review';
  c.last = today;
  const interval = rating === 1 ? 1 : nextInterval(c.stability);
  c.due = addDays(today, interval);
  return c;
}

// Preview the interval (days) each rating would produce, for button labels.
export function previewIntervals(card, today) {
  const out = {};
  for (const [name, g] of Object.entries(Rating)) {
    const next = review(card, g, today);
    out[name] = daysBetween(today, next.due);
  }
  return out;
}

export function formatInterval(days) {
  if (days < 1) return '<1d';
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

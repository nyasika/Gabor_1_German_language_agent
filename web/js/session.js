// Session building: lesson variety rule, daily missions, card introduction, due queue.
import { newCardFields, daysBetween } from './fsrs.js';

export function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Picks n exercises from the pool, cycling through exercise types so the same
// type never appears twice in a row (while other types remain) and the lesson
// does not open with the type that opened the previous lesson.
export function buildLesson(pool, { n = 10, prevLead = null, rng = Math.random } = {}) {
  const byType = new Map();
  for (const ex of shuffle(pool, rng)) {
    if (!byType.has(ex.type)) byType.set(ex.type, []);
    byType.get(ex.type).push(ex);
  }
  let order = shuffle([...byType.keys()], rng);
  if (order.length > 1 && order[0] === prevLead) {
    const swapIdx = order.findIndex((t) => t !== prevLead);
    [order[0], order[swapIdx]] = [order[swapIdx], order[0]];
  }
  const picked = [];
  let last = null;
  while (picked.length < n && [...byType.values()].some((l) => l.length)) {
    const candidates = order.filter((t) => byType.get(t).length);
    const preferred = candidates.filter((t) => t !== last);
    const type = (preferred.length ? preferred : candidates)[0];
    picked.push(byType.get(type).shift());
    last = type;
    // rotate so every type gets its turn
    order = [...order.filter((t) => t !== type), type];
  }
  return picked;
}

const dayNumber = (dateStr) => daysBetween('2000-01-01', dateStr);

export function pickMissions(missions, dateStr, n) {
  if (!missions.length) return [];
  const start = (dayNumber(dateStr) * n) % missions.length;
  const out = [];
  for (let i = 0; i < Math.min(n, missions.length); i++) out.push(missions[(start + i) % missions.length]);
  return out;
}

const MAX_PENDING_NEW = 15;

// Adds today's new cards (missions + next vocab) to the deck, once per day.
export function introduceNewCards(state, { deck, missions }, today) {
  if (state.introduced[today]) return [];
  const added = [];
  const settings = state.settings;
  for (const m of pickMissions(missions, today, settings.missionsPerDay)) {
    const id = `m_${m.id}`;
    if (!state.cards[id]) {
      state.cards[id] = { id, type: 'flip', src: 'mission', front: m.hu, hint: m.en, back: m.de, ...newCardFields() };
      added.push(id);
    }
  }
  // Skipped days must not snowball into a backlog: pause new vocabulary while many cards are still unseen.
  const pendingNew = Object.values(state.cards).filter((c) => c.state === 'new').length;
  let vocabAdded = pendingNew >= MAX_PENDING_NEW ? Infinity : 0;
  for (const c of deck) {
    if (vocabAdded >= settings.newVocabPerDay) break;
    if (!state.cards[c.id]) {
      state.cards[c.id] = { ...c, src: 'deck', ...newCardFields() };
      added.push(c.id);
      vocabAdded++;
    }
  }
  state.introduced[today] = added;
  return added;
}

export function dueCards(state, today, cap = 30) {
  const all = Object.values(state.cards);
  const reviews = all
    .filter((c) => c.state === 'review' && c.due <= today)
    .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : b.difficulty - a.difficulty));
  const fresh = all.filter((c) => c.state === 'new');
  return [...reviews, ...fresh].slice(0, cap);
}

export function nextLesson(path, state) {
  for (const ch of path.chapters) {
    for (const id of ch.lessons) {
      if (!state.lessons[id]?.done) return id;
    }
  }
  return null;
}

export function isUnlocked(path, state, lessonId) {
  const flat = path.chapters.flatMap((c) => c.lessons);
  const idx = flat.indexOf(lessonId);
  if (idx <= 0) return idx === 0;
  return !!state.lessons[flat[idx - 1]]?.done;
}

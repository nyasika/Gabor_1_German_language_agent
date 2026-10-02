// A basic-vocabulary track (verbs with principal parts, adjectives, adverbs) that unlocks a new
// pack every 10 days and, once claimed, feeds its words into the normal FSRS review deck.
import { daysBetween, addDays, newCardFields } from './fsrs.js';
import { addActivity, updateStreak } from './progress.js';

export const INTERVAL_DAYS = 10;
const CLAIM_XP = 15;

function ensureStart(state, today) {
  if (!state.vocab.startDate) state.vocab.startDate = today;
}

// How many 10-day windows have elapsed since the first time this ran (0-based index of the pack due now).
export function dueIndex(state, today) {
  if (!state.vocab.startDate) return 0;
  return Math.max(0, Math.floor(daysBetween(state.vocab.startDate, today) / INTERVAL_DAYS));
}

// The first pack (in content order) that has not been claimed yet, regardless of whether it is
// already due - out-of-order claims (e.g. a sync from a device with an earlier clock) are handled
// by just treating that pack as done and moving on to the next gap.
function firstUnclaimedIndex(state, packs) {
  for (let i = 0; i < packs.length; i++) if (!state.vocab.claimed.includes(packs[i].id)) return i;
  return -1;
}

// The earliest pack that is both time-unlocked and not yet claimed, or null if there is nothing
// to claim right now (either everything is claimed, or the next one is not due yet).
export function nextAvailablePack(state, packs, today) {
  ensureStart(state, today);
  const i = firstUnclaimedIndex(state, packs);
  if (i === -1) return null;
  return i <= dueIndex(state, today) ? packs[i] : null;
}

// Days remaining until the next not-yet-claimed pack becomes available. Meaningful when
// nextAvailablePack() is null: 0 means it is actually already due, null means nothing is left to unlock.
export function daysUntilNext(state, packs, today) {
  ensureStart(state, today);
  const i = firstUnclaimedIndex(state, packs);
  if (i === -1) return null;
  if (i <= dueIndex(state, today)) return 0;
  return Math.max(0, daysBetween(today, addDays(state.vocab.startDate, i * INTERVAL_DAYS)));
}

export function isPackClaimed(state, packId) {
  return state.vocab.claimed.includes(packId);
}

function formatBack(pack, item) {
  if (pack.category === 'verb') {
    const aux = item.aux === 'sein' ? 'ist' : 'hat';
    return `${item.de} – ${item.praeteritum} – ${aux} ${item.partizip2}`;
  }
  return item.de;
}

export function cardIdForItem(pack, item) {
  return `vp_${pack.id}_${item.de.replace(/\s+/g, '_')}`;
}

// Adds every word in the pack as a new review card (skipping ones already present) and marks it claimed.
export function claimPack(state, pack, today) {
  if (state.vocab.claimed.includes(pack.id)) return { added: 0, xp: 0 };
  let added = 0;
  for (const item of pack.items) {
    const id = cardIdForItem(pack, item);
    if (state.cards[id]) continue;
    state.cards[id] = {
      id, type: 'flip', src: 'vocabpack', topic: pack.id,
      front: item.hu, back: formatBack(pack, item), hint: item.opposite ? `↔ ${item.opposite}` : '',
      ...newCardFields(),
    };
    added++;
  }
  state.vocab.claimed.push(pack.id);
  addActivity(state, today, 'extra', { xp: CLAIM_XP });
  updateStreak(state, today);
  return { added, xp: CLAIM_XP };
}

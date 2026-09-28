// Word-level comparison of what the speech recogniser heard against the target phrase.
import { norm } from './text.js';

const DIGITS = ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn',
  'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn', 'zwanzig'];

export function tokenize(text) {
  return String(text ?? '')
    .replace(/\.\.\.|…/g, ' ')
    .replace(/[.,!?;:„“"()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => ({ raw, key: norm(/^\d+$/.test(raw) && Number(raw) <= 20 ? DIGITS[Number(raw)] : raw) }))
    .filter((t) => t.key);
}

function lev(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

// 0 = same word, 0.4 = nearly the same (a slip or an ending), 1 = a different word.
function wordCost(a, b) {
  if (a === b) return 0;
  const d = lev(a, b);
  if (d <= 1 || (Math.min(a.length, b.length) >= 7 && d <= 2)) return 0.4;
  return 1;
}

export const PASS_THRESHOLD = 0.8;

export function compare(target, heard) {
  const T = tokenize(target);
  const H = tokenize(heard);
  const n = T.length;
  const m = H.length;
  const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) dp[i][0] = i;
  for (let j = 1; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + wordCost(T[i - 1].key, H[j - 1].key));
    }
  }
  const words = new Array(n);
  const extras = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && Math.abs(dp[i][j] - (dp[i - 1][j - 1] + wordCost(T[i - 1].key, H[j - 1].key))) < 1e-9) {
      const c = wordCost(T[i - 1].key, H[j - 1].key);
      words[i - 1] = { word: T[i - 1].raw, status: c === 0 ? 'ok' : c < 1 ? 'close' : 'wrong', heard: H[j - 1].raw };
      i--; j--;
    } else if (i > 0 && Math.abs(dp[i][j] - (dp[i - 1][j] + 1)) < 1e-9) {
      words[i - 1] = { word: T[i - 1].raw, status: 'missing', heard: null };
      i--;
    } else {
      extras.unshift(H[j - 1].raw);
      j--;
    }
  }
  const credit = words.reduce((s, w) => s + (w.status === 'ok' ? 1 : w.status === 'close' ? 0.6 : 0), 0);
  const accuracy = n ? credit / n : 0;
  return { words, extras, accuracy, pass: accuracy >= PASS_THRESHOLD };
}

// Recognisers return several alternatives; judge the learner by the most favourable reading.
export function bestAlternative(alternatives, target) {
  let best = null;
  for (const alt of alternatives) {
    const cmp = compare(target, alt.transcript);
    if (!best || cmp.accuracy > best.cmp.accuracy) best = { transcript: alt.transcript, cmp };
  }
  return best;
}

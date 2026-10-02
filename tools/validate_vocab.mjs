// Structural validation of the vocabulary packs (basic verbs/adjectives/adverbs, unlocked every 10 days).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'web', 'data', 'vocab_packs.json');
const CATEGORIES = ['verb', 'adjective', 'adverb'];

export function validateVocabPacks(packs = JSON.parse(readFileSync(FILE, 'utf8'))) {
  const errors = [];
  const err = (w, m) => errors.push(`${w}: ${m}`);
  const ids = new Set();
  let totalItems = 0;

  if (!Array.isArray(packs) || !packs.length) err('vocab_packs.json', 'must be a non-empty array');

  for (const pack of packs) {
    if (ids.has(pack.id)) err(pack.id, 'duplicate pack id');
    ids.add(pack.id);
    if (!pack.title) err(pack.id, 'missing title');
    if (!CATEGORIES.includes(pack.category)) err(pack.id, `unknown category "${pack.category}"`);
    if (!Array.isArray(pack.items) || pack.items.length < 5) err(pack.id, 'needs >= 5 items');
    const words = new Set();
    for (const item of pack.items || []) {
      const w = `${pack.id} / ${item.de || '?'}`;
      if (!item.de || !item.hu) err(w, 'needs de and hu');
      if (words.has(item.de)) err(w, 'duplicate word in this pack');
      words.add(item.de);
      if (pack.category === 'verb') {
        if (!item.praeteritum) err(w, 'verb item needs praeteritum');
        if (!item.partizip2) err(w, 'verb item needs partizip2');
        if (!['sein', 'haben'].includes(item.aux)) err(w, 'verb item needs aux: sein|haben');
      }
      totalItems++;
    }
  }

  return { errors, counts: { packs: packs.length, items: totalItems } };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { errors, counts } = validateVocabPacks();
  console.log('Vocab packs:', JSON.stringify(counts));
  if (errors.length) {
    console.error(`\n${errors.length} problem(s):`);
    for (const e of errors) console.error(' -', e);
    process.exit(1);
  }
  console.log('All vocab pack content valid.');
}

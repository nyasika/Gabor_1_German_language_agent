// Structural validation of web/data/vocab_topics.json. Used by `npm run validate` and its test.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'web', 'data', 'vocab_topics.json');
const LEVELS = ['A2', 'B1', 'B2', 'C1'];
const TYPES = ['noun', 'verb', 'adjective', 'adverb', 'phrase'];

export function validateVocabTopics(topics) {
  const errors = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);
  const ids = new Set();

  for (const t of topics) {
    if (ids.has(t.id)) err('topics', `duplicate topic id ${t.id}`);
    ids.add(t.id);
    if (!t.title || !t.description) err(t.id, 'missing title/description');
    if (!Array.isArray(t.items)) { err(t.id, 'items must be an array'); continue; }

    const seenWords = new Set();
    for (const item of t.items) {
      const w = `${t.id}/${item.de || '?'}`;
      if (!item.de || !item.hu) err(w, 'needs de and hu');
      if (!TYPES.includes(item.type)) err(w, `type must be one of ${TYPES.join('/')}`);
      if (!LEVELS.includes(item.level)) err(w, `level must be one of ${LEVELS.join('/')}`);
      if (item.type === 'noun' && !['der', 'die', 'das'].includes(item.artikel)) err(w, 'noun needs artikel der/die/das');
      if (item.type === 'verb' && (item.praeteritum || item.partizip2 || item.aux)) {
        if (!item.praeteritum || !item.partizip2) err(w, 'verb past-tense forms need both praeteritum and partizip2');
        if (!['sein', 'haben'].includes(item.aux)) err(w, 'verb with past-tense forms needs aux sein/haben');
      }
      if (item.de) {
        if (seenWords.has(item.de)) err(w, 'duplicate word within this topic');
        seenWords.add(item.de);
      }
    }
  }
  return { errors, counts: { topics: topics.length, items: topics.reduce((n, t) => n + t.items.length, 0) } };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const topics = JSON.parse(readFileSync(PATH, 'utf8'));
  const { errors, counts } = validateVocabTopics(topics);
  console.log('Vocab topics:', JSON.stringify(counts));
  if (errors.length) {
    console.error(`\n${errors.length} problem(s):`);
    for (const e of errors) console.error(' -', e);
    process.exit(1);
  }
  console.log('All vocab topic content valid.');
}

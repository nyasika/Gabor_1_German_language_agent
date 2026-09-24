// Structural validation of all learning content. Used by `npm run validate` and the content test.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'web', 'data');
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

export function validateContent() {
  const errors = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);
  const path = readJson('path.json');
  const seenIds = new Set();

  const lessonIds = path.chapters.flatMap((c) => c.lessons);
  if (new Set(lessonIds).size !== lessonIds.length) err('path', 'duplicate lesson ids');

  const files = readdirSync(join(ROOT, 'lessons')).filter((f) => f.endsWith('.json'));
  const fileIds = files.map((f) => f.replace('.json', ''));
  for (const id of lessonIds) if (!fileIds.includes(id)) err('path', `lesson ${id} has no file`);
  for (const id of fileIds) if (!lessonIds.includes(id)) err('lessons', `${id}.json is not in path.json`);

  for (const f of files) {
    const lesson = readJson(`lessons/${f}`);
    const L = lesson.id;
    if (f !== `${L}.json`) err(L, 'file name does not match id');
    if (!lesson.title || !lesson.topic) err(L, 'missing title/topic');
    if (!Array.isArray(lesson.intro) || !lesson.intro.length) err(L, 'missing intro');
    const types = new Set();
    for (const ex of lesson.exercises) {
      const w = ex.id || `${L}?`;
      types.add(ex.type);
      if (seenIds.has(ex.id)) err(w, 'duplicate exercise id');
      seenIds.add(ex.id);
      if (!ex.id?.startsWith(L)) err(w, 'id should start with lesson id');
      if (!ex.topic) err(w, 'missing topic');
      switch (ex.type) {
        case 'mc':
          if (!ex.prompt) err(w, 'missing prompt');
          if (!Array.isArray(ex.options) || ex.options.length < 2) err(w, 'needs >= 2 options');
          else {
            if (new Set(ex.options).size !== ex.options.length) err(w, 'duplicate options');
            if (!ex.options.includes(ex.answer)) err(w, 'answer is not among the options');
          }
          break;
        case 'article':
          if (!ex.noun) err(w, 'missing noun');
          if (!['der', 'die', 'das'].includes(ex.answer)) err(w, 'answer must be der/die/das');
          break;
        case 'cloze':
          if (!ex.sentence?.includes('___')) err(w, 'sentence needs ___');
          if ((ex.sentence?.match(/___/g) || []).length !== 1) err(w, 'exactly one ___ expected');
          if (!Array.isArray(ex.answers) || !ex.answers.length) err(w, 'needs answers[]');
          break;
        case 'order': {
          if (!Array.isArray(ex.tiles) || ex.tiles.length < 3) err(w, 'needs >= 3 tiles');
          if (!Array.isArray(ex.answers) || !ex.answers.length) err(w, 'needs answers[]');
          else if (Array.isArray(ex.tiles)) {
            const key = (arr) => [...arr].sort().join('|');
            for (const a of ex.answers) {
              if (key(a.split(' ')) !== key(ex.tiles)) err(w, `answer "${a}" cannot be built from the tiles`);
            }
          }
          break;
        }
        case 'match':
          if (!Array.isArray(ex.pairs) || ex.pairs.length < 3) err(w, 'needs >= 3 pairs');
          else {
            const lefts = ex.pairs.map((p) => p[0]);
            const rights = ex.pairs.map((p) => p[1]);
            if (new Set(lefts).size !== lefts.length || new Set(rights).size !== rights.length) err(w, 'pairs must be unique on both sides');
          }
          break;
        case 'errorspot':
          if (!Array.isArray(ex.tokens)) err(w, 'needs tokens[]');
          else {
            if (!(ex.wrongIndex >= 0 && ex.wrongIndex < ex.tokens.length)) err(w, 'wrongIndex out of range');
            if (!ex.fixed) err(w, 'missing fixed sentence');
            else if (ex.fixed === ex.tokens.join(' ')) err(w, 'fixed equals the wrong sentence');
          }
          break;
        default:
          err(w, `unknown type ${ex.type}`);
      }
    }
    if (lesson.exercises.length < 10) err(L, 'needs >= 10 exercises to fill a lesson');
    if (types.size < 4) err(L, 'needs >= 4 distinct exercise types');
  }

  const cards = readJson('cards.json');
  const cardIds = new Set();
  for (const c of cards) {
    if (cardIds.has(c.id)) err(c.id, 'duplicate card id');
    cardIds.add(c.id);
    if (c.type === 'flip') {
      if (!c.front || !c.back) err(c.id, 'flip card needs front/back');
    } else if (c.type === 'cloze') {
      if (!c.sentence?.includes('___') || !c.answers?.length) err(c.id, 'cloze card needs ___ and answers');
    } else err(c.id, `unknown card type ${c.type}`);
  }

  const missions = readJson('missions.json');
  const mIds = new Set();
  for (const m of missions) {
    if (mIds.has(m.id)) err(m.id, 'duplicate mission id');
    mIds.add(m.id);
    if (!m.hu || !m.en || !m.de) err(m.id, 'mission needs hu/en/de');
  }

  return { errors, counts: { lessons: files.length, exercises: seenIds.size, cards: cards.length, missions: missions.length } };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { errors, counts } = validateContent();
  console.log('Content:', JSON.stringify(counts));
  if (errors.length) {
    console.error(`\n${errors.length} problem(s):`);
    for (const e of errors) console.error(' -', e);
    process.exit(1);
  }
  console.log('All content valid.');
}

// Structural validation of the sprint content (a day-by-day mini-course on one topic).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateExercise, validateTables } from './validate_content.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'web', 'data');
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

const FOCUS_BY_DAY = { 1: 'notice', 5: 'check' };

export function validateSprints() {
  const errors = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);
  const manifest = readJson('sprints.json');
  if (!Array.isArray(manifest) || !manifest.length) err('sprints.json', 'must be a non-empty array of ids');

  const topics = readJson('topics.json');
  const seenIds = new Set();
  let totalExercises = 0;

  for (const id of manifest) {
    let sprint;
    try {
      sprint = readJson(`sprints/${id}.json`);
    } catch {
      err(id, 'listed in sprints.json but sprints/<id>.json is missing or invalid');
      continue;
    }
    const S = sprint.id;
    if (S !== id) err(id, `file id "${S}" does not match the manifest entry`);
    if (!sprint.title) err(S, 'missing title');
    if (!topics[sprint.topicId]) err(S, `topicId "${sprint.topicId}" is not in topics.json`);
    if (!Array.isArray(sprint.days) || sprint.days.length < 3 || sprint.days.length > 7) err(S, 'needs 3-7 days');

    const daysSeen = new Set();
    (sprint.days || []).forEach((d, i) => {
      const w = `${S} day ${d.day ?? i + 1}`;
      if (d.day !== i + 1) err(w, `days must be numbered 1..N in order (found ${d.day})`);
      if (daysSeen.has(d.day)) err(w, 'duplicate day number');
      daysSeen.add(d.day);
      if (!d.title) err(w, 'missing title');
      const expectedFocus = FOCUS_BY_DAY[d.day] || (d.day === sprint.days.length ? 'check' : undefined);
      if (expectedFocus && d.focus !== expectedFocus) err(w, `expected focus "${expectedFocus}", got "${d.focus}"`);
      if (!['notice', 'drill', 'produce', 'check'].includes(d.focus)) err(w, `unknown focus "${d.focus}"`);

      if (d.focus === 'notice') {
        if (!Array.isArray(d.intro) || !d.intro.length) err(w, 'notice day needs intro[]');
        validateTables(d.tables, (msg) => err(w, msg));
        if (!Array.isArray(d.chunks) || d.chunks.length < 3) err(w, 'notice day needs >= 3 chunks');
        else for (const c of d.chunks) if (!c.de || c.de.split(/\s+/).length < 2) err(w, 'each chunk needs a real German phrase (de)');
      } else if (d.focus === 'produce') {
        if (!Array.isArray(d.speak_items) || d.speak_items.length < 3) err(w, 'produce day needs >= 3 speak_items');
        else {
          const ids = new Set();
          for (const it of d.speak_items) {
            if (!it.id || !it.de) err(w, 'each speak item needs id and de');
            if (ids.has(it.id)) err(w, `duplicate speak item id ${it.id}`);
            ids.add(it.id);
            if (seenIds.has(it.id)) err(w, `speak item id ${it.id} collides with another sprint`);
            seenIds.add(it.id);
          }
        }
      } else {
        if (!Array.isArray(d.exercises) || d.exercises.length < 6) err(w, 'drill/check day needs >= 6 exercises');
        else {
          for (const ex of d.exercises) {
            const ew = ex.id || w;
            if (seenIds.has(ex.id)) err(ew, 'duplicate exercise id (across all sprints)');
            seenIds.add(ex.id);
            if (!ex.id?.startsWith(S)) err(ew, 'exercise id should start with the sprint id');
            validateExercise(ex, (msg) => err(ew, msg));
            totalExercises++;
          }
        }
      }
    });
  }

  return { errors, counts: { sprints: manifest.length, exercises: totalExercises } };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { errors, counts } = validateSprints();
  console.log('Sprints:', JSON.stringify(counts));
  if (errors.length) {
    console.error(`\n${errors.length} problem(s):`);
    for (const e of errors) console.error(' -', e);
    process.exit(1);
  }
  console.log('All sprint content valid.');
}

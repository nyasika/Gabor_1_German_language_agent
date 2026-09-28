// Turns the curriculum map into web/data/topics.json: an id -> display-info lookup
// used by lesson/sprint content (exercise "topic" fields) and by the UI (mastery list, sprint list).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function buildTopics(map = JSON.parse(readFileSync(join(ROOT, 'content', 'curriculum_map.json'), 'utf8'))) {
  const out = {};
  for (const g of map.grammar) out[g.id] = { title: g.title, level: g.level, cando: g.cando, kind: 'grammar' };
  for (const s of map.extra_sprints) out[s.id] = { title: s.title, level: null, cando: null, kind: 'extra', days: s.days };
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const topics = buildTopics();
  writeFileSync(join(ROOT, 'web', 'data', 'topics.json'), `${JSON.stringify(topics, null, 2)}\n`);
  console.log(`Wrote ${Object.keys(topics).length} topics to web/data/topics.json`);
}

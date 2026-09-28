// Checks the curriculum map: unique ids, prerequisites that exist and come earlier (so the map is a valid order).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'content', 'curriculum_map.json');

export function validateMap(map = JSON.parse(readFileSync(FILE, 'utf8'))) {
  const errors = [];
  const err = (w, m) => errors.push(`${w}: ${m}`);
  const ids = new Set();
  const seen = (id) => { if (ids.has(id)) err(id, 'duplicate id'); ids.add(id); };
  const rank = new Map();

  map.grammar.forEach((g, i) => {
    seen(g.id);
    rank.set(g.id, i);
    if (!map.levels.includes(g.level)) err(g.id, `unknown level ${g.level}`);
    if (!/^I can /.test(g.cando || '')) err(g.id, 'cando must start with "I can "');
    if (!g.title || !g.chunks?.length) err(g.id, 'needs title and spoken chunks');
  });
  for (const g of map.grammar) {
    for (const r of g.requires) {
      if (!rank.has(r)) err(g.id, `requires unknown topic ${r}`);
      else if (rank.get(r) >= rank.get(g.id)) err(g.id, `requires ${r}, which does not come earlier in the list`);
    }
  }
  const order = map.levels;
  const lv = map.grammar.map((g) => order.indexOf(g.level));
  for (let i = 1; i < lv.length; i++) if (lv[i] < lv[i - 1]) err(map.grammar[i].id, 'levels must not go backwards along the list');

  for (const v of map.vocabulary) { seen(v.id); if (!v.title || !(v.target_items > 0)) err(v.id, 'needs title and target_items'); }
  for (const s of map.situations) { seen(s.id); if (!map.levels.includes(s.level)) err(s.id, `unknown level ${s.level}`); }
  for (const s of map.extra_sprints) { seen(s.id); if (!(s.days >= 1 && s.days <= 7)) err(s.id, 'days must be 1-7'); }
  if (map.sprint_template.days.length < 3) err('sprint_template', 'needs at least 3 days');

  return { errors, counts: { grammar: map.grammar.length, vocabulary: map.vocabulary.length, situations: map.situations.length, sprints: map.grammar.length + map.extra_sprints.length } };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { errors, counts } = validateMap();
  console.log('Map:', JSON.stringify(counts));
  if (errors.length) { console.error(errors.map((e) => ` - ${e}`).join('\n')); process.exit(1); }
  console.log('Curriculum map valid.');
}

// Turns the spoken chunks of the curriculum map into web/data/chunks.json (speaking practice material).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function buildChunks(map = JSON.parse(readFileSync(join(ROOT, 'content', 'curriculum_map.json'), 'utf8'))) {
  const out = [];
  for (const g of map.grammar) {
    g.chunks.forEach((de, i) => {
      if (de.split(/\s+/).length >= 3) out.push({ id: `${g.id}-${i + 1}`, topic: g.id, title: g.title, de });
    });
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const chunks = buildChunks();
  writeFileSync(join(ROOT, 'web', 'data', 'chunks.json'), `${JSON.stringify(chunks, null, 2)}\n`);
  console.log(`Wrote ${chunks.length} chunks to web/data/chunks.json`);
}

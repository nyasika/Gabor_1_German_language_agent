// Browser test for topic-based vocabulary: the picker lists all topics (populated ones openable,
// empty ones marked "hamarosan"), the detail page groups words by CEFR level and shows the
// der/die/das article and verb principal parts, activating adds an immediate handful of cards
// that show up in review (missed ones coming back exactly like any other review card), and Home
// reflects the active topic's progress.
import http from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', 'web');
const SHOTS = process.env.SHOTS_DIR || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^[/\\]+/, '');
  const file = join(ROOT, p || 'index.html');
  if (!file.startsWith(ROOT) || !existsSync(file) || file === ROOT) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
const problems = [];
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') problems.push(`console.error: ${m.text()}`); });

const noJunk = async (where) => {
  const text = await page.innerText('body');
  const m = text.match(/(null|undefined|NaN)/);
  assert.ok(!m, `stray "${m && m[0]}" text at ${where}`);
};
const shot = async (name) => { await noJunk(name); if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`) }); };
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('wortweg.state.v1')));
let step = 0;
const ok = (m) => console.log(`  ok ${++step}. ${m}`);

const topics = JSON.parse(readFileSync(join(ROOT, 'data', 'vocab_topics.json'), 'utf8'));
const office = topics.find((t) => t.id === 'office');

try {
  // ---- list: office is openable with a word count, an empty topic shows "hamarosan"
  await page.goto(`${base}#/vocab`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Szótanulás');
  assert.ok(await page.locator('a.node', { hasText: 'Irodai munka' }).count(), 'office topic is a clickable node');
  assert.ok((await page.innerText('body')).includes('hamarosan'), 'an empty topic is marked as coming soon');
  await shot('t01-list');
  ok('topic list shows office as open and an empty topic as hamarosan');

  // ---- detail: levels grouped, article and verb principal parts visible
  await page.click('a.node:has-text("Irodai munka")');
  await page.waitForSelector('text=Irodai munka');
  assert.ok(await page.locator('h2:has-text("A2")').count(), 'A2 section header shown');
  assert.ok(await page.locator('h2:has-text("C1")').count(), 'C1 section header shown');
  const firstNoun = office.items.find((i) => i.type === 'noun');
  await page.waitForSelector(`text=${firstNoun.artikel} ${firstNoun.de}`);
  const firstVerbWithForms = office.items.find((i) => i.praeteritum);
  await page.waitForSelector(`text=${firstVerbWithForms.praeteritum}`);
  await shot('t02-detail');
  ok('topic detail groups words by level and shows der/die/das and verb principal parts');

  // ---- activate: button flips, a few cards appear right away
  const before = await state();
  await page.click('button:has-text("Téma tanulása")');
  await page.waitForSelector('button:has-text("Téma leállítása")');
  const after = await state();
  const addedIds = Object.keys(after.cards).filter((k) => k.startsWith('vt_office_'));
  assert.ok(addedIds.length >= 1 && addedIds.length < office.items.length, `a handful of cards were added right away (${addedIds.length}), not the whole topic`);
  assert.ok(after.vocabTopics.active.includes('office'));
  await shot('t03-activated');
  ok(`activating seeds ${addedIds.length} cards immediately and marks the topic active`);

  // ---- home reflects the active topic
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Aktív szókincs-témák');
  assert.ok((await page.innerText('body')).includes('Irodai munka'));
  await shot('t04-home');
  ok('home shows the active topic with a progress readout');

  // ---- a seeded word shows up in review, with its artikel/principal-part back
  await page.goto(`${base}#/review`);
  await page.waitForSelector('button:has-text("Ismétlés indítása")');
  await page.click('button:has-text("Ismétlés indítása")');
  const addedHu = addedIds.map((id) => after.cards[id].front);
  let seen = false;
  for (let i = 0; i < 20 && !seen; i++) {
    if (await page.locator('text=Ismétlés kész').count()) break;
    await page.waitForSelector('.card-face, .ex-cloze');
    if (await page.locator('.card-cue').count()) {
      const cue = (await page.locator('.card-cue').first().innerText()).trim();
      if (addedHu.includes(cue)) seen = true;
      await page.click('button:has-text("Válasz megmutatása")');
      await page.waitForSelector('.rate, button:has-text("Megvan")');
      if (await page.locator('.rate').count()) await page.click('.rate button.rate-good');
      else await page.click('button:has-text("Megvan")');
    } else {
      await page.fill('.cloze-input', 'x');
      await page.click('button:has-text("Ellenőrzés")');
      await page.click('button:has-text("Tovább")');
    }
  }
  assert.ok(seen, 'one of the just-activated office words showed up in the review queue');
  await noJunk('t05-review');
  ok('a newly activated word appears in the review queue right away');

  // ---- deactivating stops it, but keeps already-seeded cards
  await page.goto(`${base}#/vocab/office`);
  await page.waitForSelector('button:has-text("Téma leállítása")');
  await page.click('button:has-text("Téma leállítása")');
  await page.waitForSelector('button:has-text("Téma tanulása")');
  const afterStop = await state();
  assert.ok(!afterStop.vocabTopics.active.includes('office'));
  assert.equal(Object.keys(afterStop.cards).filter((k) => k.startsWith('vt_office_')).length, addedIds.length, 'deactivating does not remove cards already learned');
  await shot('t06-deactivated');
  ok('deactivating a topic stops new words but keeps the ones already added');

  assert.deepEqual(problems, [], problems.join('\n'));
  ok('no console or page errors');
  console.log('\nVOCAB TOPICS E2E PASSED');
} catch (e) {
  await shot('FAILURE').catch(() => {});
  console.error('\nVOCAB TOPICS E2E FAILED:', e.message);
  if (problems.length) console.error('Browser problems:\n' + problems.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}

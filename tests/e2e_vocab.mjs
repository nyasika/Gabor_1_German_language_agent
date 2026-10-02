// Browser test for the vocabulary-pack track: home banner when a pack is due, the pack detail
// screen (principal parts for verbs), claiming adds cards that then show up in review, and the
// list page reflects kész/elérhető/zárolva correctly with a countdown to the next pack.
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
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'en-GB', timezoneId: 'Europe/Zurich' })).newPage();
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

const packs = JSON.parse(readFileSync(join(ROOT, 'data', 'vocab_packs.json'), 'utf8'));

try {
  // ---- seed: the clock starts today, so only pack 1 (VP01, verbs) is due; VP02/VP03 stay locked
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const d = new Date();
    const startDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const s = {
      version: 1, updatedAt: Date.now(),
      settings: { dailyGoalMin: 30, streakMinMinutes: 10, newVocabPerDay: 4, missionsPerDay: 3, sync: { url: '', anonKey: '', email: '' } },
      log: {}, streak: { current: 0, longest: 0, lastQualified: null, freezes: 0 },
      cards: {}, introduced: {}, lessons: {}, topics: {}, gaps: {}, missionsUsed: {},
      speaking: { phrases: {}, log: {} }, talks: {}, sprints: { active: null, progress: {} },
      vocab: { startDate, claimed: [] }, lastLead: null,
    };
    localStorage.setItem('wortweg.state.v1', JSON.stringify(s));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('text=Új szókincs-csomag');
  assert.ok((await page.locator('text=' + packs[0].title).count()) >= 1, 'home banner names the due pack');
  await shot('v01-home-banner');
  ok('home shows a banner for the pack that is due (clock starts today)');

  // ---- pack detail: verbs show principal parts, claiming adds cards
  await page.click('a:has-text("Megnézem")');
  await page.waitForSelector('text=' + packs[0].title);
  const firstVerb = packs[0].items[0];
  await page.waitForSelector(`text=${firstVerb.praeteritum}`);
  await shot('v02-pack-detail');
  const before = await state();
  const baselineCardCount = Object.keys(before.cards).length; // the daily deck (missions + vocab) is already introduced on Home
  await page.click('button:has-text("Hozzáadás a napi ismétléshez")');
  await page.waitForSelector('text=már bekerült a napi ismétlésbe');
  const after = await state();
  assert.equal(Object.keys(after.cards).length, baselineCardCount + packs[0].items.length, 'one new card per word in the pack');
  assert.ok(after.vocab.claimed.includes('VP01'));
  const sampleCard = after.cards[`vp_VP01_${firstVerb.de}`];
  assert.ok(sampleCard, `a card exists for ${firstVerb.de}`);
  assert.equal(sampleCard.front, firstVerb.hu);
  assert.ok(sampleCard.back.includes(firstVerb.praeteritum) && sampleCard.back.includes(firstVerb.partizip2), 'card back has both past-tense forms');
  assert.equal(sampleCard.state, 'new');
  await shot('v03-claimed');
  ok(`claimed VP01: ${Object.keys(after.cards).length} cards added, each with front=hu, back=infinitive–Präteritum–aux Partizip II`);

  // ---- claimed words appear in the review queue right away (not necessarily first, so scan a few)
  await page.goto(`${base}#/review`);
  await page.waitForSelector('button:has-text("Ismétlés indítása")');
  await page.click('button:has-text("Ismétlés indítása")');
  const hus = packs[0].items.map((it) => it.hu);
  let seenPackCue = null;
  for (let i = 0; i < 20 && !seenPackCue; i++) {
    if (await page.locator('text=Ismétlés kész').count()) break;
    await page.waitForSelector('.card-face, .ex-cloze');
    if (await page.locator('.card-cue').count()) {
      const cue = (await page.locator('.card-cue').first().innerText()).trim();
      if (hus.includes(cue)) { seenPackCue = cue; if (SHOTS) await page.screenshot({ path: join(SHOTS, 'v04-in-review.png') }); }
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
  assert.ok(seenPackCue, `one of the claimed pack's words (${hus.join(', ')}) showed up in the review queue`);
  await noJunk('v04-in-review');
  ok(`a newly claimed word ("${seenPackCue}") appears in the review queue right away`);

  // ---- list page: VP01 done, VP02/VP03 still locked (the clock only started today), countdown shown
  await page.goto(`${base}#/vocab`);
  await page.waitForSelector('text=Szókincs-csomagok');
  assert.equal(await page.locator('.node.done').count(), 1, 'VP01 shows as done');
  assert.equal(await page.locator('.node.locked').count(), 2, 'VP02 and VP03 are still locked');
  assert.ok((await page.innerText('body')).includes('10 nap múlva'), 'countdown to the next pack is shown');
  await shot('v05-list');
  ok('vocab pack list shows claimed/locked state and a countdown to the next pack');

  assert.deepEqual(problems, [], problems.join('\n'));
  ok('no console or page errors');
  console.log('\nVOCAB E2E PASSED');
} catch (e) {
  await shot('FAILURE').catch(() => {});
  console.error('\nVOCAB E2E FAILED:', e.message);
  if (problems.length) console.error('Browser problems:\n' + problems.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}

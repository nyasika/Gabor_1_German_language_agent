// Browser test for the per-difficulty practice track: a lesson with level-tagged exercises
// (currently only G01) shows three "Gyakorlás" buttons on its intro screen, each running a
// fresh 10-exercise session sampled only from that difficulty, without touching the normal
// lesson's done/bestScore bookkeeping — while mistakes still become review cards as usual.
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
const rx = (s) => new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
const canon = (t) => t.replace(/\s+/g, ' ').trim();
let step = 0;
const ok = (m) => console.log(`  ok ${++step}. ${m}`);

const lesson = JSON.parse(readFileSync(join(ROOT, 'data', 'lessons', 'G01.json'), 'utf8'));
const easyPool = lesson.exercises.filter((ex) => ex.level === 'easy');
const findEx = (probe) => easyPool.find(probe);

try {
  await page.goto(`${base}#/lesson/G01`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Lecke indítása');
  assert.ok(await page.locator('a:has-text("Könnyű gyakorlás")').count(), 'easy practice button shown');
  assert.ok(await page.locator('a:has-text("Közepes gyakorlás")').count(), 'medium practice button shown');
  assert.ok(await page.locator('a:has-text("Nehéz gyakorlás")').count(), 'hard practice button shown');
  await shot('p01-lesson-intro');
  ok('lesson intro shows all three difficulty practice buttons');

  await page.click('a:has-text("Könnyű gyakorlás")');
  assert.match(page.url(), /#\/run\/G01\/easy$/);
  await page.waitForSelector('.run .ex');
  ok('easy practice routes to #/run/G01/easy');

  let answered = 0;
  let deliberateWrong = 0;
  let wrongExId = null;
  for (let guard = 0; guard < 30; guard++) {
    if (await page.locator('text=Gyakorlás kész').count()) break;
    const isRetry = (await page.locator('.eyebrow .chip.warn').count()) > 0;
    const isMatch = (await page.locator('.ex-match').count()) > 0; // match pairs cannot be answered wrongly on purpose here
    const wrongOnPurpose = !isRetry && answered >= 2 && !deliberateWrong && !isMatch;

    if (await page.locator('.ex-choice').count()) {
      const prompt = (await page.locator('.ex-choice .prompt').first().innerText()).trim();
      const ex = findEx((e) => e.type === 'mc' && e.prompt === prompt);
      assert.ok(ex, `easy mc exercise found for "${prompt}"`);
      const pick = wrongOnPurpose ? ex.options.find((o) => o !== ex.answer) : ex.answer;
      if (wrongOnPurpose) wrongExId = ex.id;
      await page.locator('.opt', { hasText: rx(pick) }).first().click();
    } else if (await page.locator('.ex-cloze').count()) {
      const shown = canon(await page.locator('.ex-cloze .sentence').innerText());
      const ex = findEx((e) => e.type === 'cloze' && canon(e.sentence.replace('___', '')) === shown);
      assert.ok(ex, `easy cloze exercise found for "${shown}"`);
      await page.fill('.cloze-input', wrongOnPurpose ? 'zzz' : ex.answers[0]);
      if (wrongOnPurpose) wrongExId = ex.id;
    } else if (await page.locator('.ex-order').count()) {
      const prompt = (await page.locator('.ex-order .prompt').innerText()).trim();
      const ex = findEx((e) => e.type === 'order' && e.prompt === prompt);
      assert.ok(ex, `easy order exercise found for "${prompt}"`);
      const words = ex.answers[0].split(' ');
      const seq = wrongOnPurpose ? [...words].reverse() : words;
      if (wrongOnPurpose) wrongExId = ex.id;
      for (const w of seq) await page.locator('.tiles.bank .tile:not(.used)', { hasText: rx(w) }).first().click();
    } else if (await page.locator('.ex-match').count()) {
      const prompt = (await page.locator('.ex-match .prompt').innerText()).trim();
      const ex = findEx((e) => e.type === 'match' && e.prompt === prompt);
      assert.ok(ex, `easy match exercise found for "${prompt}"`);
      for (const [a, b] of ex.pairs) {
        await page.locator('.match-cols .col').nth(0).locator('.opt:not(:disabled)', { hasText: rx(a) }).first().click();
        await page.locator('.match-cols .col').nth(1).locator('.opt:not(:disabled)', { hasText: rx(b) }).first().click();
      }
    } else if (await page.locator('.ex-spot').count()) {
      const shown = (await page.locator('.ex-spot .word').allInnerTexts()).join(' ');
      const ex = findEx((e) => e.type === 'errorspot' && e.tokens.join(' ') === shown);
      assert.ok(ex, `easy errorspot exercise found for "${shown}"`);
      if (wrongOnPurpose) wrongExId = ex.id;
      await page.locator('.ex-spot .word').nth(wrongOnPurpose ? (ex.wrongIndex === 0 ? 1 : 0) : ex.wrongIndex).click();
    } else { await page.waitForTimeout(50); continue; }

    if (wrongOnPurpose) deliberateWrong++;
    await page.click('button:has-text("Ellenőrzés")');
    await noJunk(`practice feedback after exercise ${answered + 1}`);
    if (!isRetry) answered++;
    await page.click('.footer button:has-text("Tovább"), .footer button:has-text("Befejezés")');
  }
  await page.waitForSelector('text=Gyakorlás kész');
  assert.ok(answered >= 10, `all ${answered} sampled exercises came from the easy pool (no mismatch threw)`);
  await shot('p02-practice-done');
  ok(`easy practice session completed: ${answered} exercises, all found in the easy pool, 1 deliberate mistake`);

  const s = await state();
  assert.ok(!s.lessons?.G01?.done, 'practice alone does not mark the normal lesson as done');
  assert.ok(Object.keys(s.cards).some((k) => k === `err_${wrongExId}`), 'the deliberate mistake became a review card, same as a normal lesson');
  ok('practice does not touch lesson completion state, but mistakes still become review cards');

  await page.click('a:has-text("Vissza a leckéhez")');
  await page.waitForSelector('text=Lecke indítása');
  ok('"Vissza a leckéhez" returns to the lesson intro');

  assert.deepEqual(problems, [], problems.join('\n'));
  ok('no console or page errors');
  console.log('\nPRACTICE E2E PASSED');
} catch (e) {
  await shot('FAILURE').catch(() => {});
  console.error('\nPRACTICE E2E FAILED:', e.message);
  if (problems.length) console.error('Browser problems:\n' + problems.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}

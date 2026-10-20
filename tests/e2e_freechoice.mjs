// Browser test for the free-choice grammar path: no lesson is ever locked (any lesson, however
// late in the path, is immediately startable), and the new A1-A2 "Alapok" pilot (F01) renders its
// extra intro sections (example sentences, pitfalls) and can be completed end to end, including
// the der/die/das "article" exercise type.
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

const f01 = JSON.parse(readFileSync(join(ROOT, 'data', 'lessons', 'F01.json'), 'utf8'));
const findEx = (probe) => f01.exercises.find(probe);

try {
  // ---- nothing is ever locked
  await page.goto(`${base}#/path`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Tanulási útvonal');
  assert.equal(await page.locator('.node.locked').count(), 0, 'no lesson is locked on a fresh profile');
  assert.ok(await page.locator('a.node', { hasText: 'Főnevek és névelők' }).count(), 'the F01 pilot is listed and open');
  await shot('fc01-path');
  ok('no lesson is locked, including the new Alapok chapter');

  // ---- a late lesson is immediately startable without finishing anything earlier
  await page.goto(`${base}#/lesson/G12`);
  await page.waitForSelector('a:has-text("Lecke indítása")');
  assert.ok(!(await page.innerText('body')).includes('Előbb fejezd be'), 'no "finish the previous lesson first" gate remains');
  ok('a late lesson (G12) is immediately startable with nothing done before it');

  // ---- F01 intro shows examples, pitfalls and the table, no difficulty-practice buttons
  await page.goto(`${base}#/lesson/F01`);
  await page.waitForSelector('text=Főnevek és névelők');
  const introText = await page.innerText('body');
  assert.ok(introText.includes('Példamondatok') && introText.includes('der Tisch – die Tische'), 'example sentences render');
  assert.ok(introText.includes('Mikre figyelj') && introText.includes('kicsinyítő végződés'), 'pitfalls callout renders');
  assert.ok(introText.includes('Gyakori többes szám-végződések'), 'the plural-pattern table renders');
  assert.ok(!introText.includes('gyakorlás'), 'no difficulty-practice buttons for a lesson without tagged levels');
  await shot('fc02-f01-intro');
  ok('F01 intro renders example sentences, a pitfalls callout and the plural table');

  // ---- complete F01, including the der/die/das "article" exercises
  await page.click('a:has-text("Lecke indítása")');
  await page.waitForSelector('.run .ex');
  let answered = 0;
  for (let guard = 0; guard < 30; guard++) {
    if (await page.locator('text=Lecke kész').count()) break;
    const isRetry = (await page.locator('.eyebrow .chip.warn').count()) > 0;

    if (await page.locator('.noun-card').count()) {
      const noun = (await page.locator('.noun-q strong').innerText()).trim();
      const ex = findEx((e) => e.type === 'article' && e.noun === noun);
      assert.ok(ex, `article exercise found for noun "${noun}"`);
      await page.locator('.opt', { hasText: rx(ex.answer) }).first().click();
    } else if (await page.locator('.ex-choice').count()) {
      const prompt = (await page.locator('.ex-choice .prompt').first().innerText()).trim();
      const ex = findEx((e) => e.type === 'mc' && e.prompt === prompt);
      assert.ok(ex, `mc exercise found for "${prompt}"`);
      await page.locator('.opt', { hasText: rx(ex.answer) }).first().click();
    } else if (await page.locator('.ex-cloze').count()) {
      const shown = canon(await page.locator('.ex-cloze .sentence').innerText());
      const ex = findEx((e) => e.type === 'cloze' && canon(e.sentence.replace('___', '')) === shown);
      assert.ok(ex, `cloze exercise found for "${shown}"`);
      await page.fill('.cloze-input', ex.answers[0]);
    } else if (await page.locator('.ex-order').count()) {
      const prompt = (await page.locator('.ex-order .prompt').innerText()).trim();
      const ex = findEx((e) => e.type === 'order' && e.prompt === prompt);
      assert.ok(ex, `order exercise found for "${prompt}"`);
      for (const w of ex.answers[0].split(' ')) await page.locator('.tiles.bank .tile:not(.used)', { hasText: rx(w) }).first().click();
    } else if (await page.locator('.ex-match').count()) {
      const prompt = (await page.locator('.ex-match .prompt').innerText()).trim();
      const ex = findEx((e) => e.type === 'match' && e.prompt === prompt);
      assert.ok(ex, `match exercise found for "${prompt}"`);
      for (const [a, b] of ex.pairs) {
        await page.locator('.match-cols .col').nth(0).locator('.opt:not(:disabled)', { hasText: rx(a) }).first().click();
        await page.locator('.match-cols .col').nth(1).locator('.opt:not(:disabled)', { hasText: rx(b) }).first().click();
      }
    } else if (await page.locator('.ex-spot').count()) {
      const shown = (await page.locator('.ex-spot .word').allInnerTexts()).join(' ');
      const ex = findEx((e) => e.type === 'errorspot' && e.tokens.join(' ') === shown);
      assert.ok(ex, `errorspot exercise found for "${shown}"`);
      await page.locator('.ex-spot .word').nth(ex.wrongIndex).click();
    } else { await page.waitForTimeout(50); continue; }

    await page.click('button:has-text("Ellenőrzés")');
    await noJunk(`F01 feedback after exercise ${answered + 1}`);
    if (!isRetry) answered++;
    await page.click('.footer button:has-text("Tovább"), .footer button:has-text("Befejezés")');
  }
  await page.waitForSelector('text=Lecke kész');
  assert.equal(answered, 10, 'the default 10-exercise sample from F01\'s pool, all answered correctly');
  await shot('fc03-f01-done');
  ok(`F01 completed (${answered} exercises, including der/die/das article exercises), answered correctly first try`);

  const s = await state();
  assert.equal(s.lessons.F01.done, true);
  assert.equal(s.lessons.F01.bestScore, 1, 'a clean run scores 100%');
  assert.ok(s.topics.F01.hist.length >= 10, 'topic mastery recorded under F01');
  ok('F01 completion and topic mastery saved correctly');

  assert.deepEqual(problems, [], problems.join('\n'));
  ok('no console or page errors');
  console.log('\nFREE CHOICE E2E PASSED');
} catch (e) {
  await shot('FAILURE').catch(() => {});
  console.error('\nFREE CHOICE E2E FAILED:', e.message);
  if (problems.length) console.error('Browser problems:\n' + problems.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}

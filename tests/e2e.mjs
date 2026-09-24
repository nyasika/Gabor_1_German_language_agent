// End-to-end test: drives the real app in Edge (mobile viewport), checks saving after every
// answer, lesson variety, review flow, evening log, persistence across reload, and PWA basics.
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
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  const file = join(ROOT, p || 'index.html');
  if (!file.startsWith(ROOT) || !existsSync(file) || file === ROOT) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'en-GB', timezoneId: 'Europe/Zurich' });
const page = await context.newPage();
const problems = [];
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') problems.push(`console.error: ${m.text()}`); });
page.on('dialog', (d) => d.accept());

const noJunk = async (where) => {
  const text = await page.innerText('body');
  const m = text.match(/(null|undefined|NaN)/);
  assert.ok(!m, `stray "${m && m[0]}" text on screen at ${where}: ...${text.slice(Math.max(0, text.indexOf(m?.[0] ?? '') - 40), text.indexOf(m?.[0] ?? '') + 40)}...`);
};
const shot = async (name) => { await noJunk(name); if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`) }); };
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('wortweg.state.v1') || 'null'));
const today = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
const lessons = {};
for (const id of ['L01', 'L02', 'L03', 'L04']) lessons[id] = JSON.parse(readFileSync(join(ROOT, 'data', 'lessons', `${id}.json`), 'utf8'));

const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, (c) => `\\${c}`);
const rx = (t) => new RegExp(`^${escapeRe(t)}$`);
const canon = (t) => t.replace(/\s+/g, ' ').trim();
let step = 0;
const ok = (msg) => console.log(`  ok ${++step}. ${msg}`);

try {
  // ---- boot + home
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Session 1');
  assert.ok(await page.locator('text=Session 2').count());
  ok('home renders both sessions');
  const s0 = await state();
  assert.ok(s0, 'state is written on first load');
  assert.ok(Object.keys(s0.cards).length >= 7, 'new cards introduced (3 missions + 4 vocab)');
  ok(`first load introduced ${Object.keys(s0.cards).length} cards`);
  await shot('01-home');

  // ---- review session
  await page.click('a:has-text("Start review")');
  await page.waitForSelector('text=Colleague missions for today');
  await shot('02-missions');
  await page.click('button:has-text("Start review")');
  let reviewed = 0;
  let againCount = 0;
  let practiced = 0;
  for (let guard = 0; guard < 60; guard++) {
    if (await page.locator('text=Review complete').count()) break;
    if (await page.locator('button:has-text("Show answer")').count()) {
      if (reviewed === 0) await shot('03-card');
      await page.click('button:has-text("Show answer")');
      if (reviewed === 0) await shot('04-rating');
      if (await page.locator('.rate').count()) {
        const rate = (reviewed % 4 === 3) ? 'Again' : 'Good';
        await page.click(`.rate button:has-text("${rate}")`);
        reviewed++;
        if (rate === 'Again') againCount++;
        const st = await state();
        assert.equal(st.log[today].review.answers, reviewed, 'each graded card is saved immediately');
      } else {
        practiced++; // a card rated Again comes back once as an ungraded practice repeat
        await page.click('button:has-text("Got it")');
      }
    } else if (await page.locator('.cloze-input').count()) {
      await page.fill('.cloze-input', 'x');
      await page.click('button:has-text("Check")');
      await page.click('button:has-text("Continue")');
      reviewed++;
    } else await page.waitForTimeout(50);
  }
  await page.waitForSelector('text=Review complete');
  const s1 = await state();
  assert.ok(reviewed >= 7);
  assert.ok(Object.values(s1.cards).some((c) => c.state === 'review' && c.due > today), 'reviewed cards are scheduled into the future');
  assert.equal(practiced, againCount, 'every "Again" card is shown once more in the same session');
  ok(`review: ${reviewed} cards graded, each saved at once, FSRS due dates set, ${practiced} "Again" card(s) repeated`);
  await shot('05-review-done');

  // ---- lesson: variety + save-after-every-answer + retry + error card
  await page.goto(`${base}#/lesson/L01`);
  await page.waitForSelector('text=Start lesson');
  await shot('06-lesson-intro');
  await page.click('a:has-text("Start lesson")');
  await page.waitForSelector('.run .ex');
  const labels = [];
  const shotTypes = new Set();
  let answered = 0;
  let deliberateWrong = 0;
  const findEx = (L, probe) => lessons[L].exercises.find(probe);

  for (let guard = 0; guard < 40; guard++) {
    if (await page.locator('text=Lesson complete').count()) break;
    const label = (await page.locator('.eyebrow').first().innerText()).replace(/second try/i, '').trim();
    const isRetry = (await page.locator('.eyebrow .chip').count()) > 0;
    if (!isRetry) labels.push(label);
    if (!isRetry && !shotTypes.has(label)) { shotTypes.add(label); await shot(`ex-${label.toLowerCase().replace(/\s+/g, '-')}`); }
    const isMatch = (await page.locator('.ex-match').count()) > 0; // match pairs cannot be answered wrongly on purpose here
    const wrongOnPurpose = !isRetry && answered >= 2 && !deliberateWrong && !isMatch;
    const L = 'L01';

    if (await page.locator('.ex-choice').count()) {
      const prompt = (await page.locator('.ex-choice .prompt').first().innerText()).trim();
      const ex = findEx(L, (e) => e.type === 'mc' && e.prompt === prompt);
      assert.ok(ex, `mc exercise found for "${prompt}"`);
      const pick = wrongOnPurpose ? ex.options.find((o) => o !== ex.answer) : ex.answer;
      await page.locator('.opt', { hasText: rx(pick) }).first().click();
    } else if (await page.locator('.ex-cloze').count()) {
      const shown = canon(await page.locator('.ex-cloze .sentence').innerText());
      const ex = findEx(L, (e) => e.type === 'cloze' && canon(e.sentence.replace('___', '')) === shown);
      assert.ok(ex);
      await page.fill('.cloze-input', wrongOnPurpose ? 'zzz' : ex.answers[0]);
    } else if (await page.locator('.ex-order').count()) {
      const prompt = (await page.locator('.ex-order .prompt').innerText()).trim();
      const ex = findEx(L, (e) => e.type === 'order' && e.prompt === prompt);
      assert.ok(ex);
      const words = ex.answers[0].split(' ');
      const seq = wrongOnPurpose ? [...words].reverse() : words;
      for (const w of seq) await page.locator('.tiles.bank .tile:not(.used)', { hasText: rx(w) }).first().click();
    } else if (await page.locator('.ex-match').count()) {
      const prompt = (await page.locator('.ex-match .prompt').innerText()).trim();
      const ex = findEx(L, (e) => e.type === 'match' && e.prompt === prompt);
      assert.ok(ex);
      for (const [a, b] of ex.pairs) {
        await page.locator('.match-cols .col').nth(0).locator('.opt:not(:disabled)', { hasText: rx(a) }).first().click();
        await page.locator('.match-cols .col').nth(1).locator('.opt:not(:disabled)', { hasText: rx(b) }).first().click();
      }
    } else if (await page.locator('.ex-spot').count()) {
      const shown = (await page.locator('.ex-spot .word').allInnerTexts()).join(' ');
      const ex = findEx(L, (e) => e.type === 'errorspot' && e.tokens.join(' ') === shown);
      assert.ok(ex);
      await page.locator('.ex-spot .word').nth(wrongOnPurpose ? (ex.wrongIndex === 0 ? 1 : 0) : ex.wrongIndex).click();
    } else { await page.waitForTimeout(50); continue; }

    if (wrongOnPurpose) deliberateWrong++;
    if (answered === 0) await shot('07-exercise');
    await page.click('button:has-text("Check")');
    await noJunk(`feedback after exercise ${answered + 1}${wrongOnPurpose ? ' (wrong on purpose)' : ''}`);
    if (answered === 0) {
      const st = await state();
      assert.equal(st.log[today].lesson.answers, 1, 'answer is persisted immediately, before the lesson ends');
      ok('first answer was already saved mid-lesson');
      await shot('08-feedback');
    }
    if (!isRetry) answered++;
    await page.click('.footer button:has-text("Continue"), .footer button:has-text("Finish")');
  }
  await page.waitForSelector('text=Lesson complete');
  await shot('09-lesson-complete');
  assert.ok(labels.length === 10, `10 first-try exercises, got ${labels.length}: ${labels.join(' | ')}`);
  for (let i = 1; i < labels.length; i++) assert.notEqual(labels[i], labels[i - 1], `no same-type back-to-back at ${i}: ${labels.join(' | ')}`);
  assert.ok(new Set(labels).size >= 4, `>=4 exercise types per lesson: ${[...new Set(labels)].join(', ')}`);
  ok(`variety rule holds: ${labels.join(' > ')}`);

  const s2 = await state();
  assert.equal(s2.lessons.L01.done, true);
  assert.ok(s2.lessons.L01.bestScore < 1 && s2.lessons.L01.bestScore >= 0.8, `score reflects the deliberate mistake (${s2.lessons.L01.bestScore})`);
  assert.ok(Object.keys(s2.cards).some((k) => k.startsWith('err_')), 'the mistake became a review card');
  assert.ok(s2.topics['Konjunktiv II'].hist.length >= 10);
  ok(`lesson saved: score ${s2.lessons.L01.bestScore}, mistake turned into a card, topic mastery recorded`);

  // ---- unlock chain
  await page.goto(`${base}#/path`);
  await page.waitForSelector('text=Learning path');
  assert.ok(await page.locator('.node.done').count() === 1);
  assert.ok(await page.locator('.node.locked').count() >= 1);
  await shot('10-path');
  ok('path shows the finished lesson and locks later ones');

  // ---- evening log
  await page.goto(`${base}#/log`);
  await page.waitForSelector('text=Evening log');
  await shot('11a-log-empty');
  await page.fill('textarea', 'I wanted to say we should postpone the meeting');
  await page.fill('input[aria-label="German version"]', 'Wir sollten das Meeting verschieben.');
  await page.click('button:has-text("Save")');
  await page.waitForSelector('text=Recent entries');
  const s3 = await state();
  assert.equal(s3.gaps.length, 1);
  assert.ok(Object.values(s3.cards).some((c) => c.src === 'gap' && c.back.includes('verschieben')));
  await shot('11-log');
  ok('evening log entry saved and converted to a review card');

  // ---- stats + settings
  await page.goto(`${base}#/stats`);
  await page.waitForSelector('text=Grammar mastery');
  assert.equal(await page.locator('.hm').count(), 84);
  await shot('12-stats');
  await page.goto(`${base}#/settings`);
  await page.waitForSelector('text=Backup');
  await shot('13-settings');
  const dl = page.waitForEvent('download');
  await page.click('button:has-text("Download backup")');
  const d = await dl;
  assert.match(d.suggestedFilename(), /^wortweg-backup-\d{4}-\d{2}-\d{2}\.json$/);
  ok('stats heatmap renders, backup download works');

  // ---- persistence across a full reload
  await page.reload({ waitUntil: 'networkidle' });
  await page.goto(base);
  await page.waitForSelector('text=Session 2');
  const homeText = await page.innerText('body');
  assert.ok(/done today/.test(homeText), 'home remembers today\'s sessions after reload');
  assert.ok(/Saved \d{2}:\d{2}:\d{2}/.test(homeText), 'save indicator visible');
  const s4 = await state();
  assert.equal(s4.lessons.L01.done, true);
  await shot('14-home-after');
  ok('everything persists across a reload');

  // ---- PWA basics
  const manifest = await (await page.request.get(`${base}manifest.webmanifest`)).json();
  for (const icon of manifest.icons) assert.equal((await page.request.get(base + icon.src)).status(), 200, icon.src);
  await page.waitForFunction(() => navigator.serviceWorker.getRegistration().then(Boolean), null, { timeout: 8000 });
  ok('manifest, icons and service worker are in place');

  assert.deepEqual(problems, [], `no console errors:\n${problems.join('\n')}`);
  ok('no console or page errors');
  console.log('\nE2E PASSED');
} catch (e) {
  await shot('FAILURE').catch(() => {});
  console.error('\nE2E FAILED:', e.message);
  if (problems.length) console.error('Browser problems:\n' + problems.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}


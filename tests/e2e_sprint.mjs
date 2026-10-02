// Browser test for the sprint feature: suggestion banner, all 4 day types (notice/drill/produce/check),
// a deliberate mistake becoming a review card, and completion. Speech uses the same fake as e2e_speak.mjs.
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

const seedState = {
  version: 1, updatedAt: Date.now(),
  settings: { dailyGoalMin: 30, streakMinMinutes: 10, newVocabPerDay: 4, missionsPerDay: 3, sync: { url: '', anonKey: '', email: '' } },
  log: {}, streak: { current: 0, longest: 0, lastQualified: null, freezes: 0 },
  cards: {}, introduced: {}, lessons: {},
  topics: { G05: { hist: [0, 0, 1, 0, 0, 1] } }, // 2/6 = 33%, enough samples to trigger a suggestion
  gaps: {}, missionsUsed: {}, speaking: { phrases: {}, log: {} }, talks: {},
  sprints: { active: null, progress: {} }, lastLead: null,
};

const withFakeSpeech = () => {
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  window.__spoken = [];
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: { speak(u) { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 5); }, cancel() {}, getVoices() { return [{ lang: 'de-DE' }]; } },
  });
  window.__heard = '';
  const FakeRecognition = class {
    start() { setTimeout(() => this.onresult({ results: [[{ transcript: window.__heard, confidence: 0.9 }]] }), 20); }
    abort() {}
  };
  window.SpeechRecognition = FakeRecognition;
  window.webkitSpeechRecognition = FakeRecognition;
};

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'en-GB', timezoneId: 'Europe/Zurich' });
// withFakeSpeech only defines harmless window globals, so re-running it on every navigation is fine.
// The state seed must NOT be an addInitScript: that would re-run (and wipe real progress) on every
// later full navigation (e.g. the page.goto(base) after completing the sprint).
await ctx.addInitScript(withFakeSpeech);
const page = await ctx.newPage();
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
const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, (c) => `\\${c}`);
const rx = (t) => new RegExp(`^${escapeRe(t)}$`);
const canon = (t) => t.replace(/\s+/g, ' ').trim();
let step = 0;
const ok = (m) => console.log(`  ok ${++step}. ${m}`);

const sprint = JSON.parse(readFileSync(join(ROOT, 'data', 'sprints', 'G05.json'), 'utf8'));
const dayContent = (n) => sprint.days.find((d) => d.day === n);

async function answerDrillDay(day, { wrongAt = -1 } = {}) {
  const exercises = day.exercises;
  for (let i = 0; i < exercises.length; i++) {
    await page.waitForSelector('.ex');
    const wrong = i === wrongAt;
    if (await page.locator('.ex-choice').count()) {
      const prompt = (await page.locator('.ex-choice .prompt').first().innerText()).trim();
      const ex = exercises.find((e) => e.type === 'mc' && e.prompt === prompt);
      assert.ok(ex, `mc exercise found for "${prompt}"`);
      const pick = wrong ? ex.options.find((o) => o !== ex.answer) : ex.answer;
      await page.locator('.opt', { hasText: rx(pick) }).first().click();
    } else if (await page.locator('.ex-cloze').count()) {
      const shown = canon(await page.locator('.ex-cloze .sentence').innerText());
      const ex = exercises.find((e) => e.type === 'cloze' && canon(e.sentence.replace('___', '')) === shown);
      assert.ok(ex, `cloze exercise found for "${shown}"`);
      await page.fill('.cloze-input', wrong ? 'zzz' : ex.answers[0]);
    } else if (await page.locator('.ex-order').count()) {
      const prompt = (await page.locator('.ex-order .prompt').innerText()).trim();
      const ex = exercises.find((e) => e.type === 'order' && e.prompt === prompt);
      assert.ok(ex, `order exercise found for "${prompt}"`);
      const words = ex.answers[0].split(' ');
      const seq = wrong ? [...words].reverse() : words;
      for (const w of seq) await page.locator('.tiles.bank .tile:not(.used)', { hasText: rx(w) }).first().click();
    } else if (await page.locator('.ex-match').count()) {
      const prompt = (await page.locator('.ex-match .prompt').innerText()).trim();
      const ex = exercises.find((e) => e.type === 'match' && e.prompt === prompt);
      assert.ok(ex, `match exercise found for "${prompt}"`);
      if (wrong) {
        // Matching tolerates a single mistake (mismatches <= 1 still counts as correct), so deliberately
        // mismatch the first pair twice before finishing correctly - this pushes the exercise to "wrong"
        // while still satisfying ready() (every pair ends up matched).
        const wrongRight = ex.pairs[1][1];
        for (let k = 0; k < 2; k++) {
          await page.locator('.match-cols .col').nth(0).locator('.opt:not(:disabled)', { hasText: rx(ex.pairs[0][0]) }).first().click();
          await page.locator('.match-cols .col').nth(1).locator('.opt:not(:disabled)', { hasText: rx(wrongRight) }).first().click();
        }
      }
      for (const [a, b] of ex.pairs) {
        await page.locator('.match-cols .col').nth(0).locator('.opt:not(:disabled)', { hasText: rx(a) }).first().click();
        await page.locator('.match-cols .col').nth(1).locator('.opt:not(:disabled)', { hasText: rx(b) }).first().click();
      }
    } else if (await page.locator('.ex-spot').count()) {
      const shown = (await page.locator('.ex-spot .word').allInnerTexts()).join(' ');
      const ex = exercises.find((e) => e.type === 'errorspot' && e.tokens.join(' ') === shown);
      assert.ok(ex, `errorspot exercise found for "${shown}"`);
      await page.locator('.ex-spot .word').nth(wrong ? (ex.wrongIndex === 0 ? 1 : 0) : ex.wrongIndex).click();
    } else throw new Error('Unrecognised exercise on screen');
    await page.click('button:has-text("Ellenőrzés")');
    await page.click('.footer button:has-text("Tovább"), .footer button:has-text("Befejezés")');
  }
}

try {
  // ---- suggestion banner on Home, driven by real (seeded) mastery data
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.evaluate((json) => localStorage.setItem('wortweg.state.v1', json), JSON.stringify(seedState));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('text=Érdemes ránézni');
  await shot('sp01-home-suggestion');
  ok('a weak, sampled topic produces a real sprint suggestion on Home');

  await page.click('a:has-text("Sprint indítása")');
  await page.waitForSelector('text=Konjunktiv II elmélyítve');
  assert.equal(await page.locator('.node.locked').count(), 4, 'days 2-5 start locked');
  await shot('sp02-overview');
  ok('sprint overview shows the 5-day plan, only day 1 open');

  // ---- Day 1: notice
  await page.click('a:has-text("Sprint indítása")');
  await page.waitForSelector('text=Megfigyelendő kifejezések'); // day-1-specific: the overview's day list already contains the day title text
  const chunkCount = await page.locator('.chunk-row').count();
  assert.equal(chunkCount, dayContent(1).chunks.length);
  await page.click('.chunk-row >> nth=0 >> button:has-text("Lejátszás")');
  assert.ok((await page.evaluate(() => window.__spoken)).length >= 1, 'Listen actually calls speech synthesis');
  await shot('sp03-day1-notice');
  await page.click('button:has-text("Tovább")');
  await page.waitForSelector('text=1. nap / 5 kész');
  const s1 = await state();
  assert.equal(s1.sprints.progress.G05.day, 2);
  assert.ok(s1.sprints.progress.G05.dayResults['1'].done);
  ok('day 1 (notice) completes, advances to day 2, saved immediately');

  // ---- Day 2: drill, with one deliberate mistake
  await page.click('a:has-text("2. nap indítása")');
  await page.waitForSelector('.ex');
  await shot('sp04-day2-drill');
  await answerDrillDay(dayContent(2), { wrongAt: 2 });
  await page.waitForSelector('text=2. nap / 5 kész');
  const s2 = await state();
  assert.equal(s2.sprints.progress.G05.day, 3);
  assert.equal(s2.sprints.progress.G05.dayResults['2'].score, 0.9, '9 of 10 correct on day 2');
  const mistakeCardId = Object.keys(s2.cards).find((k) => k.startsWith('err_G05S-d2-'));
  assert.ok(mistakeCardId, 'the deliberate mistake became a review card');
  ok(`day 2 (drill): score ${s2.sprints.progress.G05.dayResults['2'].score}, mistake turned into a review card`);

  // ---- Day 3: drill, all correct
  await page.click('a:has-text("3. nap indítása")');
  await page.waitForSelector('.ex');
  await answerDrillDay(dayContent(3));
  await page.waitForSelector('text=3. nap / 5 kész');
  const s3 = await state();
  assert.equal(s3.sprints.progress.G05.dayResults['3'].score, 1);
  assert.equal(s3.sprints.progress.G05.day, 4);
  ok('day 3 (drill) all correct: score 100%, advances to day 4');

  // ---- Day 4: produce (speaking)
  await page.click('a:has-text("4. nap indítása")');
  await page.waitForSelector('text=kifejezést kell hangosan kimondanod'); // "Say it: diplomacy..." is already in the previous page's "Start Day 4" button text
  await shot('sp05-day4-intro');
  await page.click('button:has-text("Indítás")');
  const speakCount = dayContent(4).speak_items.length;
  for (let i = 0; i < speakCount; i++) {
    await page.waitForSelector('.card-answer.big-de');
    const target = await page.locator('.card-answer').first().innerText();
    await page.evaluate((t) => { window.__heard = t; }, target);
    await page.click('[data-role=speak]');
    await page.waitForSelector('text=Gut!');
    await page.click('.speak-actions button:has-text("Tovább")');
  }
  await page.waitForSelector('text=4. nap / 5 kész');
  const s4 = await state();
  assert.equal(s4.sprints.progress.G05.day, 5);
  assert.ok(s4.sprints.progress.G05.dayResults['4'].score > 0.9, 'produce day score reflects the speaking accuracy');
  assert.ok(Object.keys(s4.speaking.phrases).some((id) => id.startsWith('G05S-4-')), 'produce-day speech also feeds the normal speaking stats');
  ok(`day 4 (produce): ${speakCount} phrases spoken, score ${s4.sprints.progress.G05.dayResults['4'].score.toFixed(2)}, counted in speaking stats`);

  // ---- Day 5: check, all correct, completes the sprint
  await page.click('a:has-text("5. nap indítása")');
  await page.waitForSelector('.ex');
  await answerDrillDay(dayContent(5));
  await page.waitForSelector('text=Sprint kész!');
  await shot('sp06-complete');
  const s5 = await state();
  assert.equal(s5.sprints.active, null);
  assert.ok(s5.sprints.progress.G05.completedDate);
  const totalXp = Object.values(s5.log).reduce((sum, day) => sum + Object.values(day).reduce((a, slot) => a + (slot.xp || 0), 0), 0);
  assert.ok(totalXp >= 15 * 5 + 20, `completion bonus included in total XP (got ${totalXp})`);
  ok(`sprint completed: active cleared, completedDate set, total XP ${totalXp}`);

  // ---- Home no longer suggests a finished sprint; stats and list reflect it
  await page.goto(base);
  await page.waitForSelector('text=Beszédgyakorlat');
  assert.equal(await page.locator('text=Érdemes ránézni').count(), 0, 'a completed sprint is not suggested again');
  await shot('sp07-home-after');

  await page.goto(`${base}#/stats`);
  await page.waitForSelector('text=Nyelvtani tudásszint');
  await shot('sp08-stats');

  await page.goto(`${base}#/sprints`);
  await page.waitForSelector('text=Sprintek');
  await page.waitForSelector('.node.done');
  assert.equal(await page.locator('.node').count(), 2);
  await shot('sp09-list');
  ok('sprints list shows G05 as done, SP01 as available');

  assert.deepEqual(problems, [], problems.join('\n'));
  ok('no console or page errors across the whole sprint flow');
  console.log('\nSPRINT E2E PASSED');
} catch (e) {
  await shot('FAILURE').catch(() => {});
  console.error('\nSPRINT E2E FAILED:', e.message);
  if (problems.length) console.error('Browser problems:\n' + problems.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}

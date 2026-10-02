// Browser test for the speaking feature. Headless Edge has no microphone, so a fake speech
// recogniser / synthesiser is injected and driven by the test. Real speech quality cannot be tested here.
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

const withFakeSpeech = () => {
  window.__spoken = [];
  window.__heard = '';
  window.__sttError = null;
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: { speak(u) { window.__spoken.push({ text: u.text, rate: u.rate, lang: u.lang }); setTimeout(() => u.onend && u.onend(), 5); }, cancel() {}, getVoices() { return [{ lang: 'de-DE', name: 'Fake German' }]; } },
  });
  const FakeRecognition = class {
    start() { setTimeout(() => { if (window.__sttError) this.onerror({ error: window.__sttError }); else this.onresult({ results: [[{ transcript: window.__heard, confidence: 0.9 }]] }); }, 30); }
    abort() {}
  };
  window.SpeechRecognition = FakeRecognition;
  window.webkitSpeechRecognition = FakeRecognition;
};
const withoutSpeech = () => {
  window.webkitSpeechRecognition = undefined;
  window.SpeechRecognition = undefined;
  window.SpeechSynthesisUtterance = undefined;
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined });
};

async function newPage(init) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'en-GB', timezoneId: 'Europe/Zurich' });
  await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console.error: ${m.text()}`); });
  page.noJunk = async (where) => {
    const text = await page.innerText('body');
    const m = text.match(/(null|undefined|NaN)/);
    assert.ok(!m, `stray "${m && m[0]}" text at ${where}`);
  };
  page.shot = async (name) => { await page.noJunk(name); if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`) }); };
  page.problems = problems;
  page.state = () => page.evaluate(() => JSON.parse(localStorage.getItem('wortweg.state.v1')));
  return page;
}
const localDate = (page) => page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
async function expectText(page, text, ms = 6000) {
  try { await page.waitForSelector(`text=${text}`, { timeout: ms }); }
  catch {
    const shown = (await page.innerText('body')).split('\n').filter(Boolean).join(' | ');
    throw new Error(`expected "${text}" on screen, but the page shows: ${shown}`);
  }
}
let step = 0;
const ok = (m) => console.log(`  ok ${++step}. ${m}`);

try {
  // ============ Scenario A: speech supported ============
  const page = await newPage(withFakeSpeech);
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Beszédgyakorlat');
  const today = await localDate(page);
  await page.shot('s01-home');
  assert.ok(await page.locator('button.listen').count() >= 1, 'mission rows have a Listen button');
  await page.locator('button.listen').first().click();
  assert.equal((await page.evaluate(() => window.__spoken)).at(-1).lang, 'de-DE');
  ok('home shows the speaking card and a working Listen button (German voice requested)');

  // conversations counter
  await page.click('button:has-text("+1")'); await page.click('button:has-text("+1")');
  assert.equal(await page.locator('[data-role=talks]').innerText(), '2');
  assert.equal((await page.state()).talks[today], 2, 'counter saved immediately');
  await page.click('button:has-text("visszavonás")');
  assert.equal((await page.state()).talks[today], 1);
  ok('conversation counter saves in place');

  await page.click('a:has-text("Beszéd indítása")');
  await page.waitForSelector('text=Halld, mondd ki');
  await page.shot('s02-intro');
  await page.click('button:has-text("Indítás")');
  const target = () => page.locator('.card-answer').first().innerText();
  const say = async (text) => { await page.evaluate((t) => { window.__heard = t; window.__sttError = null; }, text); await page.click('[data-role=speak]'); };
  let item = 0;
  let sawFail = false; let sawBlocked = false; let sawOverrule = false;
  for (let guard = 0; guard < 20; guard++) {
    if (await page.locator('text=Beszédgyakorlat kész').count()) break;
    await page.waitForSelector('[data-role=speak]');
    const isPrompt = (await page.locator('.eyebrow').first().innerText()).toLowerCase().includes('emlékezetből');
    if (isPrompt) await page.click('button:has-text("Súgás")');
    const t = await target();
    if (item === 1) {
      await say('guten tag wie geht es'); // a bad attempt
      await page.waitForSelector('text=0%: még nem az igazi');
      assert.ok(await page.locator('.w-missing, .w-wrong').count() >= 1, 'wrong words are marked');
      assert.ok(await page.locator('button:has-text("Próbáld újra (2 van hátra)")').count() === 1);
      await page.shot('s03-fail');
      await page.click('button:has-text("Számítson helyesnek")');
      await page.waitForSelector('text=Helyesnek számítva');
      sawFail = true; sawOverrule = true;
    } else if (item === 2) {
      await page.evaluate(() => { window.__sttError = 'not-allowed'; });
      await page.click('[data-role=speak]');
      await page.waitForSelector('text=mikrofon le van tiltva');
      await page.shot('s04-blocked');
      sawBlocked = true;
      await say(t);
      await expectText(page, 'Gut!');
    } else {
      await say(item === 0 ? t.toLowerCase().replace(/[.?!]/g, '') : t);
      await expectText(page, 'Gut!');
      if (item === 0) { await page.shot('s05-pass'); assert.ok(await page.locator('.w-ok').count() >= 2); assert.ok(await page.locator('text=+3 XP').count() === 1); }
    }
    const mid = await page.state();
    assert.ok(mid.speaking.log[today].attempts >= item + 1, 'every attempt is saved immediately');
    await page.click('.speak-actions button:has-text("Tovább")');
    item++;
  }
  await page.waitForSelector('text=Beszédgyakorlat kész');
  await page.shot('s06-summary');
  assert.ok(sawFail && sawBlocked && sawOverrule);
  assert.ok(item >= 6, `a full session has 6+ items, got ${item}`);
  ok(`session of ${item} items: pass, mishearing + overrule, blocked microphone message, retry`);

  await page.click('button:has-text("4 jó")');
  await page.waitForSelector('text=Mentve. A magabiztosság-trended');
  const st = await page.state();
  assert.equal(st.speaking.log[today].confidence, 4);
  assert.ok(st.speaking.log[today].passes >= item - 1);
  assert.ok(st.log[today].speak.xp >= 3 * (item - 1) - 3, 'speaking XP recorded in the activity log');
  assert.ok(Object.keys(st.speaking.phrases).length >= item - 1);
  ok('confidence rating and per-phrase history saved');

  await page.goto(`${base}#/stats`);
  await page.waitForSelector('text=Beszéd');
  assert.ok(await page.locator('text=4.0 / 5').count() === 1);
  await page.shot('s07-stats');
  await page.goto(base);
  await page.waitForSelector('text=Beszédgyakorlat');
  assert.ok(await page.locator('text=Mai magabiztosság: 4 / 5').count() === 1);
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal((await page.state()).speaking.log[today].confidence, 4, 'persists across reload');
  ok('stats show confidence and conversations; data persists across reload');
  assert.deepEqual(page.problems, [], page.problems.join('\n'));

  // ============ Scenario B: no speech support ============
  const plain = await newPage(withoutSpeech);
  await plain.goto(base, { waitUntil: 'networkidle' });
  await plain.waitForSelector('text=Beszédgyakorlat');
  assert.equal(await plain.locator('button.listen').count(), 0, 'no Listen buttons without a synthesiser');
  await plain.click('a:has-text("Beszéd indítása")');
  await plain.waitForSelector('text=nincs beszédfelismerés');
  await plain.shot('s08-nosupport-intro');
  await plain.click('button:has-text("Indítás")');
  await plain.waitForSelector('button:has-text("Jól mondtam")');
  assert.equal(await plain.locator('button:has-text("Lejátszás")').count(), 0);
  await plain.click('button:has-text("Jól mondtam")');
  await plain.waitForSelector('text=Rögzítve');
  await plain.shot('s09-nosupport-rated');
  const ps = await plain.state();
  const day = Object.values(ps.speaking.log)[0];
  assert.equal(day.attempts, 1);
  assert.equal(day.passes, 1);
  await plain.click('.speak-actions button:has-text("Tovább")');
  await plain.waitForSelector('button:has-text("Többet kell gyakorolni")');
  await plain.click('button:has-text("Többet kell gyakorolni")');
  await plain.click('.speak-actions button:has-text("Tovább")');
  assert.equal(Object.values((await plain.state()).speaking.log)[0].attempts, 2);
  ok('browser without speech: clear notice, self-rating still works and is saved');
  assert.deepEqual(plain.problems, [], plain.problems.join('\n'));

  console.log('\nSPEAKING E2E PASSED');
} catch (e) {
  console.error('\nSPEAKING E2E FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}

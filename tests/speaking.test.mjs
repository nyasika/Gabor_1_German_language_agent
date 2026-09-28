import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compare, bestAlternative, tokenize } from '../web/js/compare.js';
import { speechSupport, pickGermanVoice, listen, speak, errorText } from '../web/js/speech.js';
import { buildSpeakSession, recordAttempt, recordConfidence, addTalk, speakingStats } from '../web/js/speaking.js';
import { defaultState, totalXp, dayTotals } from '../web/js/progress.js';
import { mergeStates } from '../web/js/merge.js';
import { buildChunks } from '../tools/build_chunks.mjs';

const T = 'Ich schaue mir das heute noch an.';
const statuses = (r) => r.words.map((w) => w.status).join(',');

test('compare: exact match, case and punctuation do not matter', () => {
  const r = compare(T, 'ich schaue mir das heute noch an');
  assert.equal(r.accuracy, 1);
  assert.ok(r.pass);
  assert.equal(statuses(r), 'ok,ok,ok,ok,ok,ok,ok');
});

test('compare: a missing word is reported and lowers the score', () => {
  const r = compare(T, 'ich schaue mir das noch an');
  assert.equal(r.words.find((w) => w.word === 'heute').status, 'missing');
  assert.ok(r.accuracy < 1 && r.accuracy > 0.8);
});

test('compare: a nearly-right word counts as close, a different word as wrong', () => {
  const close = compare('Wir hätten das gemacht.', 'wir hatten das gemacht');
  assert.equal(close.words[1].status, 'close');
  assert.ok(close.pass === (close.accuracy >= 0.8));
  const wrong = compare('Ich bin gerade an etwas dran.', 'ich bin gerade an dem Auto dran');
  assert.ok(wrong.words.some((w) => w.status === 'wrong'));
});

test('compare: extra spoken words are listed but do not break alignment', () => {
  const r = compare(T, 'ähm ich schaue mir das heute noch an');
  assert.deepEqual(r.extras, ['ähm']);
  assert.equal(r.accuracy, 1);
});

test('compare: umlaut spelling aliases are accepted', () => {
  assert.equal(compare('Das ist für mich möglich.', 'das ist fuer mich moeglich').accuracy, 1);
});

test('compare: spoken digits match written number words and "..." placeholders are ignored', () => {
  assert.equal(compare('Wir treffen uns um neun Uhr.', 'wir treffen uns um 9 uhr').accuracy, 1);
  assert.deepEqual(tokenize('Habe ich das richtig verstanden, dass ...?').map((t) => t.key).slice(-2), ['verstanden', 'dass']);
});

test('compare: silence and unrelated speech score zero', () => {
  assert.equal(compare(T, '').accuracy, 0);
  assert.ok(compare(T, 'guten tag wie geht es').accuracy < 0.2);
});

test('compare: judged by the best of the recogniser alternatives', () => {
  const best = bestAlternative([{ transcript: 'ich schaue mir das heute nach an' }, { transcript: 'ich schaue mir das heute noch an' }], T);
  assert.equal(best.cmp.accuracy, 1);
});

test('speech: feature detection and German voice choice', () => {
  assert.deepEqual(speechSupport({}), { tts: false, stt: false });
  assert.deepEqual(speechSupport({ webkitSpeechRecognition: function R() {}, speechSynthesis: {}, SpeechSynthesisUtterance: function U() {} }), { tts: true, stt: true });
  const v = [{ lang: 'en-US' }, { lang: 'de-AT' }, { lang: 'de-DE' }];
  assert.equal(pickGermanVoice(v).lang, 'de-DE');
  assert.equal(pickGermanVoice([{ lang: 'de-CH' }]).lang, 'de-CH');
  assert.equal(pickGermanVoice([{ lang: 'en-US' }]), null);
});

function fakeRecognizer(behaviour) {
  return class {
    start() { setTimeout(() => behaviour(this), 0); }
    abort() {}
  };
}

test('speech: listen resolves with alternatives, and maps errors to readable messages', async () => {
  const ok = fakeRecognizer((r) => r.onresult({ results: [[{ transcript: 'hallo welt', confidence: 0.9 }, { transcript: 'hallo weld', confidence: 0.4 }]] }));
  const res = await listen({ w: { webkitSpeechRecognition: ok } });
  assert.equal(res.alternatives.length, 2);
  await assert.rejects(listen({ w: { webkitSpeechRecognition: fakeRecognizer((r) => r.onerror({ error: 'not-allowed' })) } }), { code: 'not-allowed' });
  await assert.rejects(listen({ w: { webkitSpeechRecognition: fakeRecognizer((r) => r.onend()) } }), { code: 'no-speech' });
  await assert.rejects(listen({ w: {} }), { code: 'unsupported' });
  assert.match(errorText('not-allowed'), /microphone is blocked/);
  assert.match(errorText('weird'), /weird/);
  assert.equal(await speak('x', { w: {} }), false);
});

const data = {
  missions: Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, de: `Satz ${i}`, en: `en${i}`, hu: `hu${i}` })),
  chunks: Array.from({ length: 20 }, (_, i) => ({ id: `G${i}-1`, topic: `G${i}`, de: `Chunk ${i} hier` })),
};

test('speaking: a session mixes mission prompts, new chunks and weak revisits', () => {
  const s = defaultState();
  const first = buildSpeakSession(s, data, '2026-09-24');
  assert.equal(first.filter((i) => i.kind === 'prompt').length, 3);
  assert.equal(first.filter((i) => i.kind === 'shadow').length, 3);
  assert.equal(new Set(first.map((i) => i.id)).size, first.length);
  recordAttempt(s, '2026-09-24', first[3].id, 0.4);
  const second = buildSpeakSession(s, data, '2026-09-25');
  assert.ok(second.some((i) => i.id === first[3].id && i.revisit), 'a weak phrase comes back');
  const mastered = first[4].id;
  recordAttempt(s, '2026-09-24', mastered, 1);
  assert.ok(!buildSpeakSession(s, data, '2026-09-30').some((i) => i.id === mastered && i.kind === 'shadow' && !i.revisit), 'mastered chunks are not offered again');
});

test('speaking: attempts are recorded, XP only for the first pass of a phrase per day', () => {
  const s = defaultState();
  const a = recordAttempt(s, '2026-09-24', 'G01-1', 0.5, { seconds: 20 });
  assert.deepEqual(a, { pass: false, xp: 0 });
  const b = recordAttempt(s, '2026-09-24', 'G01-1', 0.9);
  assert.deepEqual(b, { pass: true, xp: 3 });
  const c = recordAttempt(s, '2026-09-24', 'G01-1', 1);
  assert.deepEqual(c, { pass: true, xp: 0 });
  assert.equal(s.speaking.phrases['G01-1'].tries, 3);
  assert.equal(s.speaking.phrases['G01-1'].best, 1);
  assert.equal(s.speaking.log['2026-09-24'].attempts, 3);
  assert.equal(totalXp(s), 3);
  assert.equal(dayTotals(s, '2026-09-24').seconds, 20);
});

test('speaking: stats compare this week with the previous one, talks and confidence included', () => {
  const s = defaultState();
  recordAttempt(s, '2026-09-24', 'a', 1);
  recordAttempt(s, '2026-09-24', 'b', 0.5);
  recordConfidence(s, '2026-09-24', 4);
  addTalk(s, '2026-09-24', 2);
  addTalk(s, '2026-09-20', 1);
  recordAttempt(s, '2026-09-14', 'c', 0.6);
  recordConfidence(s, '2026-09-14', 2);
  addTalk(s, '2026-09-24', -5);
  assert.equal(s.talks['2026-09-24'], 0, 'talks never go below zero');
  addTalk(s, '2026-09-24', 2);
  const st = speakingStats(s, '2026-09-24');
  assert.equal(st.week.attempts, 2);
  assert.equal(st.week.accuracy, 0.75);
  assert.equal(st.week.confidence, 4);
  assert.equal(st.week.talks, 3);
  assert.equal(st.previous.attempts, 1);
  assert.equal(st.previous.confidence, 2);
});

test('speaking: phone and PC speaking progress merge without loss', () => {
  const phone = defaultState();
  const pc = defaultState();
  recordAttempt(phone, '2026-09-24', 'x', 0.6);
  recordAttempt(pc, '2026-09-24', 'x', 0.9);
  recordAttempt(pc, '2026-09-24', 'y', 1);
  recordConfidence(pc, '2026-09-24', 5);
  addTalk(phone, '2026-09-24', 2);
  addTalk(pc, '2026-09-24', 1);
  phone.updatedAt = 1; pc.updatedAt = 2;
  const m = mergeStates(phone, pc);
  assert.equal(m.speaking.phrases.x.best, 0.9);
  assert.ok(m.speaking.phrases.y);
  assert.equal(m.speaking.log['2026-09-24'].confidence, 5);
  assert.deepEqual(m.speaking.log['2026-09-24'].ids.sort(), ['x', 'y']);
  assert.equal(m.talks['2026-09-24'], 2);
  const old = mergeStates({ ...defaultState(), speaking: undefined, talks: undefined }, phone);
  assert.ok(old.speaking.phrases.x, 'an older state without speaking fields still merges');
});

test('chunks.json is in sync with the curriculum map', () => {
  const onDisk = JSON.parse(readFileSync(new URL('../web/data/chunks.json', import.meta.url), 'utf8'));
  assert.deepEqual(onDisk, buildChunks(), 'run: node tools/build_chunks.mjs');
  assert.ok(onDisk.length >= 60);
  for (const c of onDisk) assert.ok(c.de.split(/\s+/).length >= 3, `${c.id} is a real phrase`);
});

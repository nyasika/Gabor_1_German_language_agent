// Thin wrappers around the browser's built-in speech synthesis and recognition (no accounts, no cost).
// In Chrome the recogniser sends audio to Google's speech service; nothing goes to our own servers.

export function speechSupport(w = globalThis.window ?? globalThis) {
  return {
    tts: !!(w.speechSynthesis && w.SpeechSynthesisUtterance),
    stt: !!(w.SpeechRecognition || w.webkitSpeechRecognition),
  };
}

export function pickGermanVoice(voices) {
  return voices.find((v) => v.lang === 'de-DE') || voices.find((v) => /^de/i.test(v.lang)) || null;
}

export function speak(text, { rate = 0.95, w = globalThis.window ?? globalThis } = {}) {
  return new Promise((resolve) => {
    if (!speechSupport(w).tts) return resolve(false);
    try {
      w.speechSynthesis.cancel();
      const u = new w.SpeechSynthesisUtterance(text);
      u.lang = 'de-DE';
      u.rate = rate;
      const voice = pickGermanVoice(w.speechSynthesis.getVoices?.() || []);
      if (voice) u.voice = voice;
      const guard = setTimeout(() => resolve(true), 20000);
      const done = () => { clearTimeout(guard); resolve(true); };
      u.onend = done;
      u.onerror = done;
      w.speechSynthesis.speak(u);
    } catch {
      resolve(false);
    }
  });
}

export const ERROR_TEXT = {
  'not-allowed': 'A mikrofon le van tiltva. Engedélyezd a mikrofonhasználatot ennek az oldalnak a böngésző beállításaiban, majd próbáld újra.',
  'service-not-allowed': 'A mikrofon le van tiltva. Engedélyezd a mikrofonhasználatot ennek az oldalnak a böngésző beállításaiban, majd próbáld újra.',
  'no-speech': 'Nem hallottam semmit. Koppints a Mondd ki gombra, és rögtön kezdj el beszélni.',
  'audio-capture': 'Nem található mikrofon.',
  network: 'A beszédfelismeréshez internetkapcsolat szükséges.',
  unsupported: 'Ebben a böngészőben nincs beszédfelismerés. Használj Chrome-ot, vagy értékeld magad lent.',
  aborted: 'A hallgatás megszakadt. Próbáld újra.',
};
export const errorText = (code) => ERROR_TEXT[code] || `A beszédfelismerés nem sikerült (${code}). Próbáld újra.`;

// Resolves with { alternatives: [{transcript, confidence}] } or rejects with { code }.
export function listen({ lang = 'de-DE', maxMs = 9000, w = globalThis.window ?? globalThis } = {}) {
  return new Promise((resolve, reject) => {
    const Rec = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Rec) return reject({ code: 'unsupported' });
    const rec = new Rec();
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    rec.continuous = false;
    let settled = false;
    const timer = setTimeout(() => finish(reject, { code: 'no-speech' }), maxMs);
    function finish(fn, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { rec.abort?.(); } catch { /* already stopped */ }
      fn(value);
    }
    rec.onresult = (e) => {
      const r = e.results[0];
      const alternatives = [];
      for (let i = 0; i < r.length; i++) alternatives.push({ transcript: r[i].transcript, confidence: r[i].confidence });
      finish(resolve, { alternatives });
    };
    rec.onerror = (e) => finish(reject, { code: e.error || 'error' });
    rec.onend = () => finish(reject, { code: 'no-speech' });
    try { rec.start(); } catch { finish(reject, { code: 'error' }); }
  });
}

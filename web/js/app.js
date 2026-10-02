import { h } from './ui.js';
import { createStore } from './store.js';
import { createSync } from './sync.js';
import { registerSW } from './push.js';
import { makeTracker } from './progress.js';
import { homeView, pathView, lessonIntroView, lessonRunView, reviewRunView, logView, statsView, settingsView } from './views.js';
import { speakView } from './speak_view.js';
import { sprintsListView, sprintOverviewView, sprintDayView } from './sprint_view.js';
import { vocabListView, vocabPackView } from './vocab_view.js';

const app = document.getElementById('app');

async function getJson(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
  return res.json();
}

async function boot() {
  let storage;
  try {
    storage = window.localStorage;
    storage.setItem('wortweg.probe', '1');
    storage.removeItem('wortweg.probe');
  } catch {
    app.replaceChildren(h('div', { class: 'card error' }, h('strong', {}, 'A tárolás le van tiltva'), h('p', {}, 'Ez a böngésző letiltja a helyi tárolást, ezért a haladás nem menthető. Engedélyezd az oldal adatait, majd töltsd újra.')));
    return;
  }

  const [path, deck, missions, chunks, topics, sprintIds, vocabPacks] = await Promise.all([
    getJson('data/path.json'), getJson('data/cards.json'), getJson('data/missions.json'),
    getJson('data/chunks.json'), getJson('data/topics.json'), getJson('data/sprints.json'),
    getJson('data/vocab_packs.json'),
  ]);
  const lessonIds = path.chapters.flatMap((c) => c.lessons);
  const lessons = Object.fromEntries((await Promise.all(lessonIds.map((id) => getJson(`data/lessons/${id}.json`)))).map((l) => [l.id, l]));
  const sprints = {};
  const data = {
    path, deck, missions, chunks, topics, sprintIds, vocabPacks,
    lessonTitles: Object.fromEntries(Object.values(lessons).map((l) => [l.id, l.title])),
    loadLesson: (id) => (lessons[id] ? Promise.resolve(lessons[id]) : Promise.reject(new Error(`Unknown lesson ${id}`))),
    loadSprint: async (id) => {
      if (!sprintIds.includes(id)) throw new Error(`Unknown sprint ${id}`);
      if (!sprints[id]) sprints[id] = await getJson(`data/sprints/${id}.json`);
      return sprints[id];
    },
  };

  const store = createStore(storage);
  const sync = createSync(store);
  const ctx = { store, sync, data, tracker: makeTracker(120000), go: (hash) => { location.hash = hash; } };

  const saved = h('span', { class: 'saved' }, 'Betöltve');
  const syncBadge = h('span', { class: 'syncbadge' });
  const main = h('main', { id: 'main' });
  const nav = h('nav', { class: 'tabs', 'aria-label': 'Fő navigáció' },
    [['#/', 'Kezdőlap'], ['#/path', 'Útvonal'], ['#/stats', 'Haladás'], ['#/settings', 'Beállítások']].map(([href, label]) =>
      h('a', { href, 'data-href': href }, label)));
  app.replaceChildren(h('header', { class: 'top' }, h('a', { class: 'brand', href: '#/' }, 'Wortweg'), h('span', { class: 'top-right' }, syncBadge, saved)), main, nav);

  function updateSaved() {
    const { savedAt, error } = store.status();
    if (error) { saved.textContent = 'NINCS MENTVE: tárolási hiba'; saved.className = 'saved bad'; return; }
    if (savedAt) { saved.textContent = `Mentve ${new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`; saved.className = 'saved ok'; }
  }
  function updateSync() {
    const st = sync.status();
    syncBadge.textContent = st.state === 'off' ? '' : st.state === 'ok' ? 'szinkronban' : st.state === 'syncing' ? 'szinkronizálás…' : 'szinkronhiba';
    syncBadge.className = `syncbadge ${st.state}`;
    syncBadge.title = st.message;
  }
  store.onChange(updateSaved);
  sync.onStatus(updateSync);

  const routes = [
    [/^#\/?$/, () => homeView(ctx)],
    [/^#\/path$/, () => pathView(ctx)],
    [/^#\/lesson\/(\w+)$/, (m) => lessonIntroView(ctx, m[1])],
    [/^#\/run\/(\w+)$/, (m) => lessonRunView(ctx, m[1])],
    [/^#\/review$/, () => reviewRunView(ctx)],
    [/^#\/speak$/, () => speakView(ctx)],
    [/^#\/sprints$/, () => sprintsListView(ctx)],
    [/^#\/sprint\/(\w+)$/, (m) => sprintOverviewView(ctx, m[1])],
    [/^#\/sprint\/(\w+)\/(\d+)$/, (m) => sprintDayView(ctx, m[1], m[2])],
    [/^#\/vocab$/, () => vocabListView(ctx)],
    [/^#\/vocab\/(\w+)$/, (m) => vocabPackView(ctx, m[1])],
    [/^#\/log$/, () => logView(ctx)],
    [/^#\/stats$/, () => statsView(ctx)],
    [/^#\/settings$/, () => settingsView(ctx)],
  ];

  function render() {
    const hash = location.hash || '#/';
    let view = null;
    for (const [re, fn] of routes) {
      const m = hash.match(re);
      if (m) { view = fn(m); break; }
    }
    document.body.classList.toggle('running', /^#\/(run|review|speak)/.test(hash) || /^#\/sprint\/\w+\/\d+/.test(hash));
    nav.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.href === hash || (a.dataset.href === '#/path' && hash.startsWith('#/lesson'))));
    main.replaceChildren(view || h('div', { class: 'card' }, h('p', {}, 'Az oldal nem található.'), h('a', { class: 'btn', href: '#/' }, 'Kezdőlap')));
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', render);
  render();
  registerSW();
  sync.init().then(() => { if ((location.hash || '#/') === '#/' && sync.status().state === 'ok') render(); });
  window.__wortweg = { store, ctx };
}

boot().catch((e) => {
  app.replaceChildren(h('div', { class: 'card error' }, h('strong', {}, 'Az alkalmazás nem tudott elindulni'), h('p', {}, String(e.message || e))));
});

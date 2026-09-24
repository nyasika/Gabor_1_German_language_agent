import { h } from './ui.js';
import { createStore } from './store.js';
import { createSync } from './sync.js';
import { registerSW } from './push.js';
import { makeTracker } from './progress.js';
import { homeView, pathView, lessonIntroView, lessonRunView, reviewRunView, logView, statsView, settingsView } from './views.js';

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
    app.replaceChildren(h('div', { class: 'card error' }, h('strong', {}, 'Storage is blocked'), h('p', {}, 'This browser blocks local storage, so progress could not be saved. Allow site data for this page and reload.')));
    return;
  }

  const [path, deck, missions] = await Promise.all([getJson('data/path.json'), getJson('data/cards.json'), getJson('data/missions.json')]);
  const lessonIds = path.chapters.flatMap((c) => c.lessons);
  const lessons = Object.fromEntries((await Promise.all(lessonIds.map((id) => getJson(`data/lessons/${id}.json`)))).map((l) => [l.id, l]));
  const data = {
    path, deck, missions,
    lessonTitles: Object.fromEntries(Object.values(lessons).map((l) => [l.id, l.title])),
    loadLesson: (id) => (lessons[id] ? Promise.resolve(lessons[id]) : Promise.reject(new Error(`Unknown lesson ${id}`))),
  };

  const store = createStore(storage);
  const sync = createSync(store);
  const ctx = { store, sync, data, tracker: makeTracker(120000), go: (hash) => { location.hash = hash; } };

  const saved = h('span', { class: 'saved' }, 'Loaded');
  const syncBadge = h('span', { class: 'syncbadge' });
  const main = h('main', { id: 'main' });
  const nav = h('nav', { class: 'tabs', 'aria-label': 'Main' },
    [['#/', 'Home'], ['#/path', 'Path'], ['#/stats', 'Progress'], ['#/settings', 'Settings']].map(([href, label]) =>
      h('a', { href, 'data-href': href }, label)));
  app.replaceChildren(h('header', { class: 'top' }, h('a', { class: 'brand', href: '#/' }, 'Wortweg'), h('span', { class: 'top-right' }, syncBadge, saved)), main, nav);

  function updateSaved() {
    const { savedAt, error } = store.status();
    if (error) { saved.textContent = 'NOT SAVED: storage error'; saved.className = 'saved bad'; return; }
    if (savedAt) { saved.textContent = `Saved ${new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`; saved.className = 'saved ok'; }
  }
  function updateSync() {
    const st = sync.status();
    syncBadge.textContent = st.state === 'off' ? '' : st.state === 'ok' ? 'synced' : st.state === 'syncing' ? 'syncing…' : 'sync error';
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
    document.body.classList.toggle('running', /^#\/(run|review)/.test(hash));
    nav.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.href === hash || (a.dataset.href === '#/path' && hash.startsWith('#/lesson'))));
    main.replaceChildren(view || h('div', { class: 'card' }, h('p', {}, 'Page not found.'), h('a', { class: 'btn', href: '#/' }, 'Home')));
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', render);
  render();
  registerSW();
  sync.init().then(() => { if ((location.hash || '#/') === '#/' && sync.status().state === 'ok') render(); });
  window.__wortweg = { store, ctx };
}

boot().catch((e) => {
  app.replaceChildren(h('div', { class: 'card error' }, h('strong', {}, 'The app could not start'), h('p', {}, String(e.message || e))));
});

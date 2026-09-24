import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../web/js/store.js';
import { createSync } from '../web/js/sync.js';
import { addActivity, totalXp } from '../web/js/progress.js';

const memStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
};

// A minimal fake of the two Supabase endpoints the app uses (auth + one RLS-protected table).
function fakeSupabase({ password = 'pw', failNext = false } = {}) {
  const db = { row: null };
  const calls = [];
  const api = {
    db, calls,
    fail: () => { failNext = true; },
    fetch: async (url, init = {}) => {
      calls.push(`${init.method || 'GET'} ${url.replace('https://x.supabase.co', '')}`);
      if (failNext) { failNext = false; throw new Error('network down'); }
      const json = (status, body) => ({ ok: status < 400, status, json: async () => body });
      if (url.includes('/auth/v1/token')) {
        const body = JSON.parse(init.body);
        return body.password === password
          ? json(200, { access_token: 't', expires_in: 3600, user: { id: 'u1' } })
          : json(400, { error: 'invalid_grant' });
      }
      assert.equal(init.headers.Authorization, 'Bearer t', 'REST calls carry the user token');
      assert.ok(init.headers.apikey, 'REST calls carry the anon key');
      if (url.includes('/rest/v1/app_state') && (init.method || 'GET') === 'GET') return json(200, api.db.row ? [api.db.row] : []);
      if (url.includes('/rest/v1/app_state') && init.method === 'POST') {
        const body = JSON.parse(init.body);
        assert.equal(body.user_id, 'u1');
        api.db.row = { data: body.data, updated_at: body.updated_at };
        return json(201, {});
      }
      return json(404, {});
    },
  };
  return api;
}

function device(server, { pw = 'pw' } = {}) {
  const storage = memStorage();
  const store = createStore(storage, 'k');
  store.save((s) => { s.settings.sync = { url: 'https://x.supabase.co', anonKey: 'anon', email: 'me@example.com' }; });
  const sync = createSync(store, { fetchImpl: server.fetch, storage, debounceMs: 60000 });
  sync.setPassword(pw);
  return { store, sync };
}

test('sync: not configured means no network calls and a clear status', async () => {
  const server = fakeSupabase();
  const store = createStore(memStorage(), 'k');
  const sync = createSync(store, { fetchImpl: server.fetch, storage: memStorage(), debounceMs: 60000 });
  await sync.syncNow();
  assert.equal(sync.status().state, 'off');
  assert.equal(server.calls.length, 0);
});

test('sync: first sync uploads local progress', async () => {
  const server = fakeSupabase();
  const a = device(server);
  a.store.save((s) => addActivity(s, '2026-09-24', 'lesson', { xp: 40, seconds: 600 }));
  await a.sync.syncNow();
  assert.equal(a.sync.status().state, 'ok');
  assert.equal(totalXp(server.db.row.data), 40);
});

test('sync: phone and PC progress are merged, neither side is overwritten', async () => {
  const server = fakeSupabase();
  const phone = device(server);
  const pc = device(server);
  phone.store.save((s) => addActivity(s, '2026-09-24', 'review', { xp: 30, seconds: 500 }));
  await phone.sync.syncNow();
  pc.store.save((s) => addActivity(s, '2026-09-24', 'lesson', { xp: 50, seconds: 800 }));
  await pc.sync.syncNow(); // pc has no idea about the phone's review yet
  assert.equal(totalXp(pc.store.get()), 80, 'pc pulled the phone progress');
  assert.equal(totalXp(server.db.row.data), 80, 'server holds both');
  await phone.sync.syncNow();
  assert.equal(totalXp(phone.store.get()), 80, 'phone receives the pc lesson');
});

test('sync: a network failure never touches local progress', async () => {
  const server = fakeSupabase();
  const a = device(server);
  a.store.save((s) => addActivity(s, '2026-09-24', 'lesson', { xp: 25 }));
  server.fail();
  await a.sync.syncNow();
  assert.equal(a.sync.status().state, 'error');
  assert.match(a.sync.status().message, /still saved on this device/);
  assert.equal(totalXp(a.store.get()), 25);
  await a.sync.syncNow(); // recovers on the next attempt
  assert.equal(a.sync.status().state, 'ok');
});

test('sync: wrong password gives a readable error and keeps local data', async () => {
  const server = fakeSupabase({ password: 'right' });
  const a = device(server, { pw: 'wrong' });
  a.store.save((s) => addActivity(s, '2026-09-24', 'lesson', { xp: 10 }));
  await a.sync.syncNow();
  assert.equal(a.sync.status().state, 'error');
  assert.match(a.sync.status().message, /Wrong email or password/);
  assert.equal(totalXp(a.store.get()), 10);
});

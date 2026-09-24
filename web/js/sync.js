// Optional Supabase sync (email + password auth, one row per user, RLS protected).
// Every push is pull -> merge -> push, so phone and PC progress never overwrite each other.
import { mergeStates } from './merge.js';

const PW_KEY = 'wortweg.sync.pw';

export function createSync(store, { fetchImpl = (...a) => fetch(...a), storage = globalThis.localStorage, debounceMs = 3000 } = {}) {
  let token = null;
  let userId = null;
  let tokenExpiry = 0;
  let timer = null;
  let suppress = false;
  let busy = false;
  const status = { state: 'off', message: 'Not configured (progress stays on this device)', at: null };
  const listeners = new Set();
  const set = (state, message) => {
    status.state = state;
    status.message = message;
    status.at = Date.now();
    for (const fn of listeners) fn(status);
  };

  const cfg = () => store.get().settings.sync || {};
  const configured = () => !!(cfg().url && cfg().anonKey && cfg().email && getPassword());
  const getPassword = () => { try { return storage.getItem(PW_KEY) || ''; } catch { return ''; } };
  const setPassword = (pw) => { try { storage.setItem(PW_KEY, pw); } catch { /* ignore */ } };

  async function signIn() {
    const { url, anonKey, email } = cfg();
    const res = await fetchImpl(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: getPassword() }),
    });
    if (!res.ok) throw new Error(res.status === 400 ? 'Wrong email or password' : `Sign-in failed (${res.status})`);
    const j = await res.json();
    token = j.access_token;
    userId = j.user.id;
    tokenExpiry = Date.now() + (j.expires_in - 60) * 1000;
  }

  async function authed(path, init = {}) {
    if (!token || Date.now() > tokenExpiry) await signIn();
    const { url, anonKey } = cfg();
    const res = await fetchImpl(`${url}/rest/v1/${path}`, {
      ...init,
      headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    });
    if (res.status === 401) { token = null; throw new Error('Session expired, retrying next time'); }
    if (!res.ok) throw new Error(`Server said ${res.status}`);
    return res;
  }

  async function pull() {
    const res = await authed('app_state?select=data,updated_at&limit=1');
    const rows = await res.json();
    return rows[0]?.data || null;
  }

  async function syncNow() {
    if (!configured()) { set('off', 'Not configured (progress stays on this device)'); return; }
    if (busy) return;
    busy = true;
    set('syncing', 'Syncing…');
    try {
      const remote = await pull();
      let local = store.get();
      if (remote) {
        const merged = mergeStates(local, remote);
        if (JSON.stringify(merged) !== JSON.stringify(local)) {
          suppress = true;
          store.replace(merged);
          suppress = false;
          local = store.get();
        }
      }
      await authed('app_state?on_conflict=user_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ user_id: userId, data: local, updated_at: new Date().toISOString() }),
      });
      set('ok', `Synced at ${new Date().toLocaleTimeString()}`);
    } catch (e) {
      suppress = false;
      set('error', `Sync failed: ${e.message}. Your progress is still saved on this device.`);
    } finally {
      busy = false;
    }
  }

  store.onChange(() => {
    if (suppress || !configured()) return;
    clearTimeout(timer);
    timer = setTimeout(syncNow, debounceMs);
    timer?.unref?.();
  });

  return {
    status: () => status,
    onStatus: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    syncNow, getPassword, setPassword, configured,
    init: () => (configured() ? syncNow() : Promise.resolve()),
  };
}

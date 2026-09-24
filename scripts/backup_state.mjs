// Downloads the synced progress row so a deleted or paused database can never wipe your history.
// Needs SUPABASE_URL and SUPABASE_SERVICE_KEY (service role key: keep it secret, CI only).
import { writeFileSync, mkdirSync } from 'node:fs';

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY.');
  process.exit(1);
}
const res = await fetch(`${SUPABASE_URL}/rest/v1/app_state?select=user_id,data,updated_at`, {
  headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
});
if (!res.ok) {
  console.error(`Backup failed: server said ${res.status}`);
  process.exit(1);
}
const rows = await res.json();
mkdirSync('backups', { recursive: true });
const file = `backups/wortweg-state-${new Date().toISOString().slice(0, 10)}.json`;
writeFileSync(file, JSON.stringify(rows, null, 2));
console.log(`Saved ${rows.length} row(s) to ${file}`);

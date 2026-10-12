// Sends every reminder still owed as a web-push notification. Run by .github/workflows/reminders.yml.
// FORCE=1 sends a test notification regardless of the time, and never touches reminder_state.json.
import fs from 'node:fs';
import webpush from 'web-push';
import { dueSlots } from './reminder_slots.mjs';

const STATE_PATH = new URL('../reminder_state.json', import.meta.url);

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, PUSH_SUBSCRIPTION, FORCE } = process.env;
const missing = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'PUSH_SUBSCRIPTION'].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing secrets: ${missing.join(', ')}. See README "Reminders".`);
  process.exit(1);
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); } catch { return {}; }
}

webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:noreply@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
const parsed = JSON.parse(PUSH_SUBSCRIPTION);
const subscriptions = Array.isArray(parsed) ? parsed : [parsed];

async function sendOne(title, body, url, tag) {
  const payload = JSON.stringify({ title, body, url, tag });
  let failed = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(sub, payload, { TTL: 60 * 60 * 3 });
      console.log(`Sent "${title}"`);
    } catch (e) {
      failed++;
      const gone = e.statusCode === 404 || e.statusCode === 410;
      console.error(gone
        ? 'This phone subscription has expired. Open Settings in the app, tap "Enable reminders" and update the PUSH_SUBSCRIPTION secret.'
        : `Push failed (${e.statusCode || 'no status'}): ${e.body || e.message}`);
    }
  }
  return failed === 0;
}

if (FORCE === 'true' || FORCE === '1') {
  const ok = await sendOne('Wortweg: test reminder', 'Reminders are working.', './#/review', 'wortweg-test');
  process.exit(ok ? 0 : 1);
}

const state = loadState();
const due = dueSlots(new Date(), state);
if (!due.length) {
  console.log('Nothing owed right now: every reminder slot is already recorded as sent for its latest occurrence.');
  process.exit(0);
}

let anyFailed = false;
for (const { slot, occurrence } of due) {
  const ok = await sendOne(slot.title, slot.body, slot.url, `wortweg-${slot.id}`);
  if (ok) state[slot.id] = occurrence;
  else anyFailed = true;
}
fs.writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
process.exit(anyFailed ? 1 : 0);

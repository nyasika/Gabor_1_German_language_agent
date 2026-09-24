// Sends the due reminder as a web-push notification. Run by .github/workflows/reminders.yml.
// FORCE=1 sends a test notification regardless of the time.
import webpush from 'web-push';
import { dueSlot, SLOTS } from './reminder_slots.mjs';

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, PUSH_SUBSCRIPTION, FORCE } = process.env;
const missing = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'PUSH_SUBSCRIPTION'].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing secrets: ${missing.join(', ')}. See README "Reminders".`);
  process.exit(1);
}

const slot = FORCE === 'true' || FORCE === '1' ? { ...SLOTS[0], title: 'Wortweg: test reminder', body: 'Reminders are working.' } : dueSlot(new Date());
if (!slot) {
  console.log('No reminder due right now (this is the off-season twin of the cron run). Nothing sent.');
  process.exit(0);
}

webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:noreply@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
const parsed = JSON.parse(PUSH_SUBSCRIPTION);
const subscriptions = Array.isArray(parsed) ? parsed : [parsed];
const payload = JSON.stringify({ title: slot.title, body: slot.body, url: slot.url, tag: `wortweg-${slot.id}` });

let failed = 0;
for (const sub of subscriptions) {
  try {
    await webpush.sendNotification(sub, payload, { TTL: 60 * 60 * 3 });
    console.log(`Sent "${slot.title}"`);
  } catch (e) {
    failed++;
    const gone = e.statusCode === 404 || e.statusCode === 410;
    console.error(gone
      ? 'This phone subscription has expired. Open Settings in the app, tap "Enable reminders" and update the PUSH_SUBSCRIPTION secret.'
      : `Push failed (${e.statusCode || 'no status'}): ${e.body || e.message}`);
  }
}
process.exit(failed ? 1 : 0);

// Which reminders are still owed, in Swiss time.
// GitHub's scheduler is unreliable for this repo: runs have been landing hours
// after their cron time (sometimes past local midnight), so a run can no longer
// assume "now" is close to a slot's clock time. Instead each slot is sent once
// per its own Zurich-local calendar day, tracked in `state` (slot id -> last
// date it was actually sent). A run sends every slot whose latest occurrence
// (today's, or yesterday's if today's hasn't happened yet) isn't recorded yet.
export const SLOTS = [
  { id: 'review', hour: 7, minute: 0, title: 'Wortweg: review time', body: 'Cards and today\'s colleague missions. About 15 minutes.', url: './#/review' },
  { id: 'lesson', hour: 20, minute: 30, title: 'Wortweg: evening lesson', body: 'One lesson, then your evening log. About 15 minutes.', url: './#/' },
];

function zurichParts(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t).value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

function addDays(ymd, delta) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

export function zurichMinutes(date) {
  return zurichParts(date).minutes;
}

// Returns [{ slot, occurrence }] for every slot not yet recorded as sent for its
// latest due occurrence. `early` (minutes) avoids counting today's occurrence a
// touch before its clock time, same as the old tolerance window.
export function dueSlots(date, state = {}, { early = 5 } = {}) {
  const { date: today, minutes: now } = zurichParts(date);
  const yesterday = addDays(today, -1);
  const due = [];
  for (const slot of SLOTS) {
    const at = slot.hour * 60 + slot.minute;
    const occurrence = now >= at - early ? today : yesterday;
    if (state[slot.id] !== occurrence) due.push({ slot, occurrence });
  }
  return due;
}

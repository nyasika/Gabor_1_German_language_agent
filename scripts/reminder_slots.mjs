// Which reminder (if any) is due right now, in Swiss time.
// GitHub cron runs in UTC, so the workflow fires at both possible UTC hours (summer/winter time)
// and this function makes sure exactly one of them actually sends.
export const SLOTS = [
  { id: 'review', hour: 7, minute: 0, title: 'Wortweg: review time', body: 'Cards and today\'s colleague missions. About 15 minutes.', url: './#/review' },
  { id: 'lesson', hour: 20, minute: 30, title: 'Wortweg: evening lesson', body: 'One lesson, then your evening log. About 15 minutes.', url: './#/' },
];

export function zurichMinutes(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Zurich', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return get('hour') * 60 + get('minute');
}

// early/late allow for GitHub's scheduler running a few minutes ahead or up to ~45 minutes late.
export function dueSlot(date, { early = 5, late = 45 } = {}) {
  const now = zurichMinutes(date);
  return SLOTS.find((s) => {
    const at = s.hour * 60 + s.minute;
    return now >= at - early && now <= at + late;
  }) || null;
}

// Answer normalisation: case-insensitive, whitespace-tolerant, umlaut-alias tolerant
// (so "hatte" typed on a phone keyboard as "haette" is not punished for ae/oe/ue/ss).
export function norm(s) {
  return String(s ?? '')
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.!?]+$/g, '')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

export function matchesAny(given, answers) {
  const g = norm(given);
  return answers.some((a) => norm(a) === g);
}

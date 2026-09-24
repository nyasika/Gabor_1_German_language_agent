// Tiny DOM helper (no innerHTML: all content is inserted as text).
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export function svg(tag, attrs = {}, ...kids) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const kid of kids) if (kid) el.append(kid);
  return el;
}

export function ring(fraction, label, sub) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, fraction));
  return h('div', { class: 'ring' },
    svg('svg', { viewBox: '0 0 100 100', width: '96', height: '96' },
      svg('circle', { cx: 50, cy: 50, r, fill: 'none', 'stroke-width': 9, class: 'ring-bg' }),
      svg('circle', { cx: 50, cy: 50, r, fill: 'none', 'stroke-width': 9, 'stroke-linecap': 'round', class: 'ring-fg',
        'stroke-dasharray': `${(c * f).toFixed(1)} ${c.toFixed(1)}`, transform: 'rotate(-90 50 50)' })),
    h('div', { class: 'ring-label' }, h('strong', {}, label), sub ? h('span', {}, sub) : null));
}

export function bar(fraction, cls = '') {
  const f = Math.max(0, Math.min(1, fraction));
  return h('div', { class: `bar ${cls}` }, h('div', { class: 'bar-fill', style: `width:${(f * 100).toFixed(0)}%` }));
}

export const fmtMin = (seconds) => `${Math.round(seconds / 60)} min`;

// Null-safe replaceChildren: the DOM would render a literal "null" for null/false arguments.
export function mount(parent, ...kids) {
  parent.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false));
  return parent;
}

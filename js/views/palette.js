// Command palette (Ctrl+K): every action in one searchable list, so nothing needs hunting through menus.
import { h } from '../util.js';
import { dialog } from '../ui-kit.js';
import { L } from '../i18n.js';

/** commands: [{ label, hint?, run }] ; palette fuzzy-matches the label (also by initials in any order of words) */
export function scoreOf(query, label) {
  const q = query.trim().toLowerCase(), t = label.toLowerCase();
  if (!q) return 1;
  if (t.includes(q)) return 100 - t.indexOf(q);
  const words = q.split(/\s+/);
  if (words.every((w) => t.includes(w))) return 50;
  let i = 0;
  for (const ch of t) if (ch === q[i]) i++;
  return i === q.length ? 10 : 0; // letters in order
}

export async function openPalette(commands) {
  const input = h('input', { class: 'inp', placeholder: 'コマンドを入力 / Type a command…', style: { width: '100%' } });
  const list = h('div', { class: 'search-results' });
  let shown = [], sel = 0;
  const run = (c) => { document.querySelector('.overlay .dialog-head button')?.click(); setTimeout(() => c?.run(), 0); };
  const draw = () => {
    list.textContent = '';
    shown.forEach((c, i) => list.append(h('button', { class: 'sr' + (i === sel ? ' on' : ''), onclick: () => run(c), onmousemove: () => { sel = i; } },
      h('b', {}, c.label), c.hint ? h('span', { class: 'muted small' }, c.hint) : null)));
    list.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  };
  const filter = () => { shown = commands.map((c) => [c, scoreOf(input.value, L(c.label) + ' ' + (c.keywords || ''))]).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).map(([c]) => c).slice(0, 40); sel = 0; draw(); };
  input.addEventListener('input', filter);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(shown.length - 1, sel + 1); draw(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
    else if (e.key === 'Enter') { e.preventDefault(); run(shown[sel]); }
  });
  filter();
  await dialog({ title: '⌘ Command palette', body: h('div', { class: 'search' }, input, list), actions: [] });
}

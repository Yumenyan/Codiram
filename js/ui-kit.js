// Small UI toolkit: dialogs, toasts, dropdown menus.
import { h } from './util.js';

export function toast(msg, action) {
  let box = document.getElementById('toasts');
  if (!box) { box = h('div', { id: 'toasts' }); document.body.append(box); }
  const t = h('div', { class: 'toast' }, msg);
  if (action) t.append(h('button', { class: 'link', onclick: () => { action.fn(); t.remove(); } }, action.label));
  box.append(t);
  setTimeout(() => t.remove(), action ? 6000 : 2800);
}

export function dialog({ title, body, actions = [], wide = false }) {
  return new Promise((resolve) => {
    const close = (v) => { overlay.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(null); } };
    const overlay = h('div', { class: 'overlay', onmousedown: (e) => { if (e.target === overlay) close(null); } },
      h('div', { class: 'dialog' + (wide ? ' wide' : ''), role: 'dialog', 'aria-label': title },
        h('div', { class: 'dialog-head' }, h('b', {}, title), h('button', { class: 'icon-btn', title: '閉じる', onclick: () => close(null) }, '✕')),
        h('div', { class: 'dialog-body' }, body),
        actions.length ? h('div', { class: 'dialog-foot' }, actions.map((a) =>
          h('button', { class: 'btn' + (a.primary ? ' primary' : ''), onclick: async () => { const r = await a.onClick?.(); if (r !== false) close(a.value ?? true); } }, a.label))) : null));
    document.addEventListener('keydown', onKey, true);
    document.body.append(overlay);
    overlay.querySelector('input,textarea,button.primary')?.focus();
  });
}

export async function promptText(title, value = '', label = '') {
  const input = h('input', { class: 'inp', value, style: { width: '100%' } });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.closest('.dialog').querySelector('.primary').click(); });
  const ok = await dialog({ title, body: h('div', {}, label ? h('div', { class: 'muted', style: { marginBottom: '6px' } }, label) : null, input), actions: [{ label: 'キャンセル', value: false }, { label: 'OK', primary: true, value: 'ok' }] });
  return ok === 'ok' ? input.value.trim() : null;
}

export async function confirmDlg(title, message, okLabel = 'OK') {
  return (await dialog({ title, body: h('p', {}, message), actions: [{ label: 'キャンセル', value: false }, { label: okLabel, primary: true, value: 'ok' }] })) === 'ok';
}

/** Dropdown menu anchored below `anchor`. items: [{label, hint, onClick, sep}] */
export function menu(anchor, items) {
  document.querySelectorAll('.menu').forEach((m) => m.remove());
  const r = anchor.getBoundingClientRect();
  const m = h('div', { class: 'menu', style: { left: Math.min(r.left, innerWidth - 240) + 'px', top: r.bottom + 4 + 'px' } },
    items.map((it) => it.sep ? h('hr') : h('button', { class: 'menu-item', disabled: it.disabled, onclick: () => { m.remove(); it.onClick?.(); } },
      h('span', {}, it.label), it.hint ? h('span', { class: 'muted' }, it.hint) : null)));
  const off = (e) => { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('mousedown', off, true); } };
  setTimeout(() => document.addEventListener('mousedown', off, true));
  document.body.append(m);
}

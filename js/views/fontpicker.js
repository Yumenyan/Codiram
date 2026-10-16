// Font <select> shared by Properties and Project Settings.
import { h } from '../util.js';
import { L } from '../i18n.js';
import { BUILTIN_FONTS, GOOGLE_FONTS } from '../fonts.js';
import { promptText } from '../ui-kit.js';

export function fontSelect(value, onChange, attrs = {}) {
  const known = BUILTIN_FONTS.some((f) => f.id === value) || GOOGLE_FONTS.some((f) => f.n === value);
  const sel = h('select', { class: 'sel', ...attrs, onchange: async (e) => {
    if (e.target.value !== '__custom') return onChange(e.target.value);
    const n = await promptText('Google Fonts のフォント名', '', 'https://fonts.google.com にあるフォント名(例: Kiwi Maru)');
    if (n) onChange(n); else sel.value = value || '';
  } },
  h('option', { value: '' }, '(default)'),
  value && !known ? h('option', { value, selected: true }, value + ' (Google Fonts)') : null,
  h('optgroup', { label: L({ ja: '内蔵フォント', en: 'Built-in fonts' }) }, BUILTIN_FONTS.map((f) => h('option', { value: f.id, selected: f.id === value }, L({ ja: f.ja, en: f.en })))),
  h('optgroup', { label: L({ ja: 'Google Fonts(日本語)', en: 'Google Fonts (Japanese)' }) }, GOOGLE_FONTS.filter((f) => f.jp).map((f) => h('option', { value: f.n, selected: f.n === value }, f.n))),
  h('optgroup', { label: 'Google Fonts' }, GOOGLE_FONTS.filter((f) => !f.jp).map((f) => h('option', { value: f.n, selected: f.n === value }, f.n))),
  h('option', { value: '__custom' }, '＋ Google Fonts 名を入力…'));
  return sel;
}

const hex = (c) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : '#000000');
/** colour swatch + text input; onChange(value) ('' = default) */
export function colorField(value, onChange) {
  const txt = h('input', { class: 'inp', value: value || '', placeholder: '(default)', oninput: (e) => { onChange(e.target.value); sw.value = hex(e.target.value); } });
  const sw = h('input', { type: 'color', class: 'swatch', value: hex(value), oninput: (e) => { txt.value = e.target.value; onChange(e.target.value); } });
  return h('div', { class: 'colorf' }, sw, txt);
}

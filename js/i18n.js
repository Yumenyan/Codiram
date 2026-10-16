// Tiny i18n layer. Source strings in the code are English or Japanese; both are registered
// as pairs [en, ja] (plus optional extra languages) and looked up by exact text.
// h() (util.js) translates text nodes and title/placeholder attributes automatically.
export const LANGS = [{ id: 'ja', label: '日本語' }, { id: 'en', label: 'English' }];

const toLang = new Map();   // lang id -> Map(en key -> text)
const keyOf = new Map();    // any registered text -> en key
let lang = 'ja';

try {
  lang = localStorage.getItem('codiram.lang') || (/^ja/i.test(navigator.language) ? 'ja' : 'en');
} catch { /* ignore */ }
if (!LANGS.some((l) => l.id === lang)) lang = 'ja';

/** Register a translation. en is the canonical key; more = { zh:'…', ko:'…' } for extra languages. */
export function addPair(en, ja, more = {}) {
  const key = en || '\0' + ja;
  const all = { en, ja, ...more };
  for (const [id, text] of Object.entries(all)) {
    if (!toLang.has(id)) toLang.set(id, new Map());
    toLang.get(id).set(key, text);
    if (text) keyOf.set(text, key);
  }
  return ja;
}
export const addPairs = (list) => list.forEach(([en, ja, more]) => addPair(en, ja, more));

export function getLang() { return lang; }
export function setLang(id) {
  lang = id;
  try { localStorage.setItem('codiram.lang', id); } catch { /* ignore */ }
  document.documentElement.lang = id;
}

/** Translate an exact source string; unknown strings pass through. */
export function t(s) {
  if (typeof s !== 'string' || !s) return s;
  const key = keyOf.get(s);
  if (key === undefined) return s;
  return toLang.get(lang)?.get(key) ?? (lang === 'en' ? key : s);
}

/** Translate a template with {0} {1} placeholders. */
export function tf(template, ...args) {
  return t(template).replace(/\{(\d+)\}/g, (m, i) => args[i] ?? m);
}

/**
 * Resolve a UI text: plain strings go through the dictionary; bilingual objects
 * { ja, en, ... } (used by block definitions) pick the current language directly.
 */
export function L(x) {
  if (x && typeof x === 'object' && !x.nodeType) return x[lang] ?? x.en ?? x.ja ?? '';
  return t(x);
}
export const isBi = (x) => !!x && typeof x === 'object' && !x.nodeType && 'ja' in x;

/** Map an exact source string used in the code to an existing English key (for strings that differ slightly). */
export function alias(src, en) { keyOf.set(src, en); }

// Shared emitter utilities. Anything two generators need goes here instead of being copied.

/** snake_case that keeps non-ASCII letters: "myVar-2" -> "my_var_2" */
export const snakeCase = (s) => String(s).replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[^\p{L}\p{N}_]+/gu, '_').replace(/^_+|_+$/g, '').toLowerCase();
export const slug = (s, sep = '-') => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, sep).replace(new RegExp(`^${sep}+|${sep}+$`, 'g'), '');
/** C-like string literal body (", \, newline ...) */
export const escapeString = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');

/** Unique, valid identifiers: `const name = identifierNamer({ keywords, style: snakeCase }); name('My Var', 'var')` */
export function identifierNamer({ keywords = new Set(), style = snakeCase, suffix = '_' } = {}) {
  const used = new Set();
  return (raw, fallback = 'x') => {
    let base = style(raw) || fallback;
    if (/^\d/.test(base)) base = fallback + '_' + base;
    if (keywords.has(base)) base += suffix;
    let n = base, i = 2;
    while (used.has(n)) n = base + '_' + i++;
    used.add(n);
    return n;
  };
}

export const indent = (lines, depth = 1, unit = '    ') => lines.map((l) => (l ? unit.repeat(depth) + l : l));

/** Drops one pair of redundant outer parentheses: "(a + b)" -> "a + b" */
export function unparen(x) {
  if (x[0] !== '(' || x[x.length - 1] !== ')') return x;
  let depth = 0, quote = false;
  for (let i = 0; i < x.length; i++) {
    const ch = x[i];
    if (ch === '"' && x[i - 1] !== '\\') quote = !quote;
    if (quote) continue;
    if (ch === '(') depth++;
    if (ch === ')' && --depth === 0 && i < x.length - 1) return x;
  }
  return x.slice(1, -1);
}

export const json = (v) => JSON.stringify(v, null, 2) + '\n';
export const tomlString = (s) => JSON.stringify(String(s ?? ''));
/** The standard extra file every export carries: the Codiram project itself, so it can be re-imported. */
export const projectFile = (project) => json(project);

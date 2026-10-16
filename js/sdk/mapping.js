// Operation -> target code mapping, as data. Simple operations are described by a template string, so a new generator
// needs a table instead of code; anything a table cannot express stays in the generator's own emitter.
//
//   const rust = defineMapping({ comment: '// {text}', exit: 'process::exit({code} as i32);' });
//   rust.emit('exit', { code: '1.0' })  ->  'process::exit(1.0 as i32);'
export function defineMapping(table) {
  const emit = (op, vars = {}) => {
    const t = table[op];
    if (t == null) return null;
    if (typeof t === 'function') return t(vars);
    return t.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  };
  return { table, has: (op) => op in table, emit, ops: () => Object.keys(table) };
}

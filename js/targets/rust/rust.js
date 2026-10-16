// IR -> Rust (std only, no external crates). Output is plain, readable Rust:
// global variables become fields of a `State` struct that is passed to every function.
import { irType } from '../../ir.js';
import { emit, defineMapping } from '../../sdk/index.js';

const KEYWORDS = new Set('as break const continue crate else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while async await dyn abstract become box do final macro override priv typeof unsized virtual yield try main'.split(' '));
const RTYPE = { num: 'f64', str: 'String', bool: 'bool' };
const VTYPE = { Number: 'num', String: 'str', Boolean: 'bool' };

const rstr = (s) => '"' + emit.escapeString(s) + '"';
const fmtEsc = (s) => rstr(s).slice(1, -1).replace(/[{}]/g, (m) => m + m);
const rnum = (v) => { const s = String(Number(v)); return /^-?\d+$/.test(s) ? s + '.0' : /e/i.test(s) ? Number(v).toFixed(10).replace(/0+$/, '') : s; };

const namer = () => emit.identifierNamer({ keywords: KEYWORDS });

/** Operations that map 1:1 to a line of Rust: a table instead of code (see sdk/mapping.js). */
const MAP = defineMapping({
  comment: '// {text}',
  exit: 'process::exit({code} as i32);',
  sleep: 'thread::sleep(Duration::from_millis({ms}));',
  write_file: 'fs::write({path}, {text}).ok();',
  append_file: 'append_file({path}, {text});',
});

export function generateRust(ir, cfg, project) {
  const problems = [];
  const uses = new Set();
  const nm = namer();
  const varId = new Map(ir.variables.filter((v) => VTYPE[v.type]).map((v) => [v.name, nm(v.name, 'var')]));
  const fnNm = namer();
  const fnInfo = new Map(ir.functions.map((f) => [f.fnName, { id: fnNm(f.fnName, 'func'), params: f.params.map((p) => ({ name: p, id: p, type: null })) }]));
  let cur = null; // function being generated

  // parameter types are inferred from the first call site that gives them a type
  const preTy = (e) => ty(e, true);
  const collect = (list) => list.forEach((s) => {
    if (s.op === 'call') { const f = fnInfo.get(s.fn); if (f) s.args.forEach((a, i) => { if (f.params[i] && !f.params[i].type) { const t = preTy(a); if (t !== 'any') f.params[i].type = t; } }); }
    ['then', 'else', 'body'].forEach((k) => s[k] && collect(s[k]));
  });
  [...ir.handlers, ...ir.functions].forEach((h) => collect(h.body));
  fnInfo.forEach((f) => { const pn = namer(); f.params.forEach((p) => { p.id = pn(p.name, 'arg'); p.type = p.type || 'str'; }); });
  const paramOf = (name) => cur?.params.find((p) => p.name === name);

  function ty(e, loose) {
    if (e.k === 'var') {
      if (e.scope === 'local') return loose ? 'any' : (paramOf(e.name)?.type || 'str');
      return VTYPE[e.type] || 'any';
    }
    if (e.k === 'call' && e.fn === 'ternary') { const a = ty(e.args[1], loose), b = ty(e.args[2], loose); return a === b ? a : 'str'; }
    if (e.k === 'bin') {
      if (e.op === '+') { const a = ty(e.a, loose), b = ty(e.b, loose); return a === 'str' || b === 'str' ? 'str' : 'num'; }
      return ['-', '*', '/', '%'].includes(e.op) ? 'num' : 'bool';
    }
    const t = irType(e);
    return t === 'any' ? 'num' : t;
  }

  // ---- numbers / strings / bools in each coercion ------------------------------------------------
  const n = (e) => {
    const t = ty(e);
    if (t === 'num') return rx(e);
    if (t === 'bool') return `(if ${rx(e)} { 1.0 } else { 0.0 })`;
    uses.add('parse_num');
    return `parse_num(${sref(e)})`;
  };
  const b = (e) => { const t = ty(e); return t === 'bool' ? rx(e) : t === 'num' ? `(${rx(e)} != 0.0)` : `!${rx(e)}.is_empty()`; };
  /** &str-like operand (no clone for literals and variables) */
  const sref = (e) => {
    if (ty(e) === 'str') {
      if (e.k === 'str') return rstr(e.v);
      if (e.k === 'var') return `${rx(e)}.as_str()`;
      return `${rx(e)}.as_str()`;
    }
    return `${s(e)}.as_str()`;
  };
  /** owned String */
  const s = (e) => {
    const t = ty(e);
    if (t === 'str') return e.k === 'str' ? `String::from(${rstr(e.v)})` : e.k === 'var' ? `${rx(e)}.clone()` : rx(e);
    if (t === 'num') { uses.add('num_to_string'); return `num_to_string(${rx(e)})`; }
    return `${rx(e)}.to_string()`;
  };
  /** { fmt, args } of a string-valued expression, for format! / println! */
  const fmtOf = (e) => {
    const parts = e.k === 'call' && e.fn === 'concat' ? e.args : [e];
    let fmt = '';
    const args = [];
    for (const p of parts) {
      if (p.k === 'str') fmt += fmtEsc(p.v);
      else { fmt += '{}'; args.push(disp(p)); }
    }
    return { fmt, args };
  };
  const disp = (e) => { const t = ty(e); if (t === 'num') { uses.add('num_to_string'); return `num_to_string(${rx(e)})`; } return rx(e); };
  const sx = (e) => {
    const { fmt, args } = fmtOf(e);
    return args.length ? `format!("${fmt}", ${args.join(', ')})` : `String::from("${fmt}")`;
  };

  /** the value of an expression in its own type */
  function rx(e) {
    switch (e.k) {
      case 'num': return rnum(e.v);
      case 'str': return rstr(e.v);
      case 'bool': return String(e.v);
      case 'var': {
        if (e.scope === 'local') return paramOf(e.name)?.id || nm(e.name, 'arg');
        return 'state.' + (varId.get(e.name) || nm(e.name, 'var'));
      }
      case 'un': return e.op === '!' ? `!${b(e.a)}` : `(-${n(e.a)})`;
      case 'bin': return bin(e);
      case 'call': return call(e);
      case 'cli': return cli(e);
      default: problems.push({ msg: `unsupported IR expression: ${e.k}` }); return '0.0';
    }
  }
  function bin(e) {
    const { op } = e, ta = ty(e.a), tb = ty(e.b);
    if (op === '&&' || op === '||') return `(${b(e.a)} ${op} ${b(e.b)})`;
    if (op === '==' || op === '!=') {
      if (ta === 'num' && tb === 'num') return `(${rx(e.a)} ${op} ${rx(e.b)})`;
      if (ta === 'bool' && tb === 'bool') return `(${rx(e.a)} ${op} ${rx(e.b)})`;
      return `(${sref(e.a)} ${op} ${sref(e.b)})`;
    }
    if (op === '+') {
      if (ta === 'str' || tb === 'str') return sx({ k: 'call', fn: 'concat', args: [e.a, e.b] });
      return `(${n(e.a)} + ${n(e.b)})`;
    }
    if (['<', '>', '<=', '>='].includes(op)) return ta === 'str' && tb === 'str' ? `(${sref(e.a)} ${op} ${sref(e.b)})` : `(${n(e.a)} ${op} ${n(e.b)})`;
    return `(${n(e.a)} ${op} ${n(e.b)})`;
  }
  function call(e) {
    const a = e.args || [];
    switch (e.fn) {
      case 'concat': return sx(e);
      case 'contains': return `${sref(a[0])}.contains(${sref(a[1])})`;
      case 'isEmpty': return ty(a[0]) === 'str' ? `${rx(a[0])}.is_empty()` : `!${b(a[0])}`;
      case 'bool': return b(a[0]);
      case 'num': return n(a[0]);
      case 'pow': return `${n(a[0])}.powf(${n(a[1])})`;
      case 'random': uses.add('random_between'); return `random_between(${n(a[0])}, ${n(a[1])})`;
      case 'ternary': {
        const t = ty(e), conv = t === 'num' ? n : t === 'bool' ? b : s;
        return `(if ${b(a[0])} { ${conv(a[1])} } else { ${conv(a[2])} })`;
      }
      default: problems.push({ msg: `unknown IR call: ${e.fn}` }); return '0.0';
    }
  }
  function cli(e) {
    const a = e.args || [];
    switch (e.fn) {
      case 'readLine': uses.add('read_line'); return 'read_line()';
      case 'arg': return `std::env::args().nth(${n(a[0])} as usize).unwrap_or_default()`;
      case 'readFile': return `fs::read_to_string(${sref(a[0])}).unwrap_or_default()`;
      case 'fileExists': return `Path::new(${sref(a[0])}).exists()`;
      default: problems.push({ msg: `unknown CLI value: ${e.fn}` }); return '""';
    }
  }

  // ---- statements ----------------------------------------------------------------------------------
  const unparen = emit.unparen;
  const pad = (d) => '    '.repeat(d);
  const coerce = (e, type) => (type === 'Number' ? n(e) : type === 'Boolean' ? b(e) : s(e));
  const printOf = (value, nl) => {
    const { fmt, args } = fmtOf(value);
    return `${nl ? 'println' : 'print'}!("${fmt}"${args.length ? ', ' + args.join(', ') : ''});`;
  };
  function stmts(list, d) {
    const out = [];
    for (const st of list) out.push(...stmt(st, d));
    return out;
  }
  function stmt(st, d) {
    const p = pad(d);
    switch (st.op) {
      case 'comment': return [p + MAP.emit('comment', { text: String(st.text).replace(/[\r\n]+/g, ' ') })];
      case 'log': return [p + printOf(st.value, true)];
      case 'cli.print': { const l = printOf(st.value, st.newline); return st.newline ? [p + l] : [p + l, p + 'io::stdout().flush().ok();']; }
      case 'set': return [p + `${rx(st.var)} = ${unparen(coerce(st.value, st.var.type))};`];
      case 'if': {
        const out = [p + `if ${unparen(b(st.cond))} {`, ...stmts(st.then, d + 1)];
        if (st.else.length) out.push(p + '} else {', ...stmts(st.else, d + 1));
        out.push(p + '}');
        return out;
      }
      case 'repeat': {
        const cnt = st.count.k === 'num' ? String(Math.max(0, Math.floor(st.count.v))) : `(${unparen(n(st.count))} as i64)`;
        return [p + `for _ in 0..${cnt} {`, ...stmts(st.body, d + 1), p + '}'];
      }
      case 'wait': uses.add('sleep'); return [p + `${MAP.emit('sleep', { ms: st.ms.k === 'num' ? String(Math.max(0, Math.round(st.ms.v))) : `${unparen(n(st.ms))} as u64` })}`];
      case 'call': {
        const f = fnInfo.get(st.fn);
        if (!f) { problems.push({ block: st.block, msg: `関数「${st.fn}」が定義されていません` }); return [p + `// (undefined function: ${st.fn})`]; }
        if (st.args.length !== f.params.length) problems.push({ block: st.block, msg: `関数「${st.fn}」の引数は ${f.params.length} 個です(${st.args.length} 個指定)` });
        const args = f.params.map((pa, i) => (st.args[i] ? (pa.type === 'num' ? n(st.args[i]) : pa.type === 'bool' ? b(st.args[i]) : s(st.args[i])) : pa.type === 'num' ? '0.0' : pa.type === 'bool' ? 'false' : 'String::new()'));
        return [p + `${f.id}(${['state', ...args].join(', ')});`];
      }
      case 'cli.exit': return [p + MAP.emit('exit', { code: n(st.code) })];
      case 'cli.write_file':
        if (st.append) uses.add('append_file');
        return [p + MAP.emit(st.append ? 'append_file' : 'write_file', { path: sref(st.path), text: sref(st.text) })];
      default: problems.push({ msg: `unsupported IR statement: ${st.op}` }); return [p + `// unsupported: ${st.op}`];
    }
  }

  // ---- program -------------------------------------------------------------------------------------
  const usesState = (lines) => lines.some((l) => /\bstate\b/.test(l));
  const hid = namer();
  hid('main', 'main');
  const handlers = ir.handlers.filter((h) => h.kind === 'main').map((h) => ({ h, id: hid(/^[ -~]+$/.test(h.name || '') ? h.name : 'on_start', 'on_start') }));
  const fnLines = [];
  for (const f of ir.functions) {
    const info = fnInfo.get(f.fnName);
    cur = info;
    const params = ['state: &mut State', ...info.params.map((pa) => `${pa.id}: ${RTYPE[pa.type]}`)];
    const fb = stmts(f.body, 1);
    fnLines.push('', `fn ${info.id}(${params.join(', ').replace('state:', usesState(fb) ? 'state:' : '_state:')}) {`, ...fb, '}');
  }
  const handlerLines = [];
  for (const { h, id } of handlers) {
    cur = null;
    const hb = stmts(h.body, 1);
    handlerLines.push('', `fn ${id}(${usesState(hb) ? 'state' : '_state'}: &mut State) {`, ...hb, '}');
  }
  cur = null;

  const vars = ir.variables.filter((v) => VTYPE[v.type]);
  const initOf = (v) => (v.type === 'Number' ? rnum(Number(v.initial) || 0) : v.type === 'Boolean' ? String(String(v.initial) === 'true') : `String::from(${rstr(v.initial ?? '')})`);
  const stateLines = vars.length
    ? ['struct State {', ...vars.map((v) => `    ${varId.get(v.name)}: ${RTYPE[VTYPE[v.type]]},`), '}', '',
      'impl State {', '    fn new() -> Self {', '        State {', ...vars.map((v) => `            ${varId.get(v.name)}: ${initOf(v)},`), '        }', '    }', '}']
    : ['struct State;', '', 'impl State {', '    fn new() -> Self {', '        State', '    }', '}'];

    const body = [...handlerLines, ...fnLines].join('\n');
  const needFs = /\bfs::/.test(body), needPath = /Path::new/.test(body), needProcess = /process::/.test(body);
  const needIo = /io::/.test(body) || uses.has('read_line') || uses.has('append_file');
  const stdImports = [];
  if (uses.has('sleep')) stdImports.push('use std::thread;', 'use std::time::Duration;');
  if (needFs || uses.has('append_file')) stdImports.push('use std::fs;');
  if (needIo) {
    const traits = [uses.has('read_line') && 'BufRead', (/\.flush\(\)/.test(body) || uses.has('append_file')) && 'Write'].filter(Boolean);
    stdImports.push(traits.length ? `use std::io::{self, ${traits.join(', ')}};` : 'use std::io;');
  }
  if (needPath) stdImports.push('use std::path::Path;');
  if (needProcess) stdImports.push('use std::process;');

  const helpers = [];
  if (uses.has('num_to_string')) helpers.push('', '/// Formats a number like JavaScript does: 3 instead of 3.0.', 'fn num_to_string(value: f64) -> String {', '    if value.fract() == 0.0 && value.abs() < 1e15 {', '        format!("{}", value as i64)', '    } else {', '        format!("{}", value)', '    }', '}');
  if (uses.has('parse_num')) helpers.push('', '/// Text to number (0 when it is not a number).', 'fn parse_num(text: &str) -> f64 {', '    text.trim().parse().unwrap_or(0.0)', '}');
  if (uses.has('read_line')) helpers.push('', '/// Reads one line from the keyboard (without the line break).', 'fn read_line() -> String {', '    let mut line = String::new();', '    io::stdin().lock().read_line(&mut line).ok();', '    line.trim_end_matches(&[\'\\r\', \'\\n\'][..]).to_string()', '}');
  if (uses.has('append_file')) helpers.push('', 'fn append_file(path: &str, text: &str) {', '    use std::fs::OpenOptions;', '    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {', '        file.write_all(text.as_bytes()).ok();', '    }', '}');
  if (uses.has('random_between')) helpers.push('', '/// Random integer between min and max (both included). Small generator seeded from the clock: no external crate needed.',
    'fn random_between(min: f64, max: f64) -> f64 {', '    use std::cell::Cell;', '    use std::time::{SystemTime, UNIX_EPOCH};', '    thread_local!(static SEED: Cell<u64> = Cell::new(', '        SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos() as u64).unwrap_or(1) | 1', '    ));',
    '    let r = SEED.with(|s| {', '        let mut x = s.get();', '        x ^= x << 13;', '        x ^= x >> 7;', '        x ^= x << 17;', '        s.set(x);', '        (x >> 11) as f64 / (1u64 << 53) as f64', '    });', '    let (lo, hi) = if min <= max { (min.floor(), max.floor()) } else { (max.floor(), min.floor()) };', '    (lo + r * (hi - lo + 1.0)).floor()', '}');

  const main = ['fn main() {', '    let mut state = State::new();', ...(handlers.length ? handlers.map(({ id }) => `    ${id}(&mut state);`) : ['    let _ = &mut state;']), '}'];
  if (!handlers.length) problems.push({ msg: '「プログラムが開始されたとき」のスクリプトがありません(何も実行されません)', level: 'info' });
  const main_rs = [`//! ${project.name || 'App'} — generated by Codiram. Plain Rust (std only): edit freely.`, '', ...stdImports, ...(stdImports.length ? [''] : []), ...stateLines, '', ...main, ...handlerLines, ...fnLines, ...helpers, ''].join('\n');
  return { main_rs, problems };
}

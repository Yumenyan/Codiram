// Semantic model / IR used by code generators that do NOT work directly from the visual blocks
// (the Web target still generates straight from blocks; new targets such as Minecraft go through the IR).
//
//   Visual blocks --(def.ir)--> IR --(target generator)--> source code
//
// IR statements:  { op, ... }   e.g. { op:'set', var, value } { op:'if', cond, then, else } { op:'repeat', count, body }
//                 { op:'wait', ms } { op:'call', fn, args } { op:'comment', text } { op:'<target>.<action>', ... }
// IR expressions: { k:'num'|'str'|'bool', v } { k:'var', name, scope, type } { k:'bin', op, a, b } { k:'un', op, a }
//                 { k:'call', fn, args } (portable helpers)  { k:'<target>', fn, args } (target specific values)
import { blocks, blockSupports } from './registry.js';
import { tf } from './i18n.js';

// ---------------------------------------------------------------- expression text -> IR
function tokenize(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '"' || ch === "'") {
      let j = i + 1, v = '';
      while (j < src.length && src[j] !== ch) { if (src[j] === '\\' && j + 1 < src.length) { j++; v += { n: '\n', t: '\t' }[src[j]] ?? src[j]; } else v += src[j]; j++; }
      if (j >= src.length) return null;
      out.push({ t: 'str', v }); i = j + 1; continue;
    }
    const num = /^\d+(\.\d+)?/.exec(src.slice(i));
    if (num) { out.push({ t: 'num', v: Number(num[0]) }); i += num[0].length; continue; }
    const id = /^[\p{L}_$][\p{L}\p{N}_$]*/u.exec(src.slice(i));
    if (id) { out.push({ t: 'id', v: id[0] }); i += id[0].length; continue; }
    const op = /^(\|\||&&|==|!=|<=|>=|[<>+\-*/%!()])/.exec(src.slice(i));
    if (op) { out.push({ t: 'op', v: op[0] }); i += op[0].length; continue; }
    return null;
  }
  return out;
}

const PREC = [['||'], ['&&'], ['==', '!='], ['<', '>', '<=', '>='], ['+', '-'], ['*', '/', '%']];

/** Parse a user-typed expression. Returns IR; anything that is not a valid expression becomes a string literal. */
export function parseExpr(src, env) {
  src = String(src ?? '').trim();
  if (src === '') return { k: 'str', v: '' };
  const toks = tokenize(src);
  const asText = () => ({ k: 'str', v: src });
  if (!toks || !toks.length) return asText();
  let pos = 0, failed = false;
  const peek = () => toks[pos];
  const eat = (v) => { if (peek() && peek().t === 'op' && peek().v === v) { pos++; return true; } return false; };
  const binary = (level) => {
    if (level >= PREC.length) return unary();
    let a = binary(level + 1);
    while (peek() && peek().t === 'op' && PREC[level].includes(peek().v)) {
      const op = toks[pos++].v;
      a = { k: 'bin', op, a, b: binary(level + 1) };
    }
    return a;
  };
  const unary = () => {
    if (eat('!')) return { k: 'un', op: '!', a: unary() };
    if (eat('-')) return { k: 'un', op: '-', a: unary() };
    return primary();
  };
  const primary = () => {
    const t = toks[pos++];
    if (!t) { failed = true; return { k: 'str', v: '' }; }
    if (t.t === 'num') return { k: 'num', v: t.v };
    if (t.t === 'str') return { k: 'str', v: t.v };
    if (t.t === 'id') {
      if (t.v === 'true' || t.v === 'false') return { k: 'bool', v: t.v === 'true' };
      if (env.scope?.has(t.v)) return { k: 'var', name: t.v, scope: 'local', type: env.scope.get(t.v) };
      if (env.vars?.has(t.v)) return { k: 'var', name: t.v, scope: 'global', type: env.vars.get(t.v) };
      failed = true; return { k: 'str', v: '' };
    }
    if (t.t === 'op' && t.v === '(') {
      const e = binary(0);
      if (!eat(')')) failed = true;
      return e;
    }
    failed = true;
    return { k: 'str', v: '' };
  };
  const e = binary(0);
  return failed || pos < toks.length ? asText() : e;
}

/** Static type of an IR expression: 'num' | 'str' | 'bool' | 'any' */
export function irType(e) {
  switch (e.k) {
    case 'num': return 'num';
    case 'str': return 'str';
    case 'bool': return 'bool';
    case 'var': return { Number: 'num', String: 'str', Boolean: 'bool' }[e.type] || 'any';
    case 'un': return e.op === '!' ? 'bool' : 'num';
    case 'bin': {
      if (e.op === '+') { const a = irType(e.a), b = irType(e.b); return a === 'str' || b === 'str' ? 'str' : a === 'num' && b === 'num' ? 'num' : 'any'; }
      return ['-', '*', '/', '%'].includes(e.op) ? 'num' : 'bool';
    }
    case 'call': return e.type || 'any';
    default: return e.type || 'any';
  }
}

// ---------------------------------------------------------------- blocks -> IR
export function buildIR(project, targetId) {
  const problems = [];
  const vars = new Map(project.variables.map((v) => [v.name, v.type]));
  const ir = { version: 1, target: targetId, variables: project.variables.map((v) => ({ ...v })), handlers: [], functions: [], problems };
  const state = { scope: new Map(), depth: 0, scriptId: '', event: null };
  const env = () => ({ vars, scope: state.scope });
  const c = {
    state,
    problem: (msg, block, unsupported) => problems.push({ script: state.scriptId, block: block || null, msg, ...(unsupported ? { unsupported: true } : {}) }),
    expr(src) {
      if (src && typeof src === 'object' && src.$b) {
        const d = blocks.get(src.$b.type);
        if (!d || !blockSupports(d, targetId, true)) { c.problem(tf('この値ブロックは {0} では使えません', targetId), null, true); return { k: 'str', v: '' }; }
        return d.irExpr(src.$b, c);
      }
      return parseExpr(src, env());
    },
    cond(cd) {
      if (!cd || !cd.rows || !cd.rows.length) return { k: 'bool', v: true };
      const rows = cd.rows.map((r) => {
        const a = c.expr(r.l), b = c.expr(r.r);
        switch (r.op) {
          case '==': case '!=': case '>': case '<': case '>=': case '<=': return { k: 'bin', op: r.op, a, b };
          case 'contains': return { k: 'call', fn: 'contains', args: [a, b], type: 'bool' };
          case 'empty': return { k: 'call', fn: 'isEmpty', args: [a], type: 'bool' };
          case 'notempty': return { k: 'un', op: '!', a: { k: 'call', fn: 'isEmpty', args: [a], type: 'bool' } };
          case 'true': return { k: 'call', fn: 'bool', args: [a], type: 'bool' };
          default: c.problem('この比較方法(式 JS)は Minecraft では使えません'); return { k: 'bool', v: true };
        }
      });
      let e = rows.reduce((x, y) => ({ k: 'bin', op: cd.join === 'or' ? '||' : '&&', a: x, b: y }));
      if (cd.not) e = { k: 'un', op: '!', a: e };
      return e;
    },
    stack(list) {
      const out = [];
      for (const b of list) {
        const d = blocks.get(b.type);
        if (!d || !d.ir || !blockSupports(d, targetId)) { c.problem(tf('このブロックは {0} では使えません', targetId), b.id, true); continue; }
        const r = d.ir(b, c);
        if (Array.isArray(r)) out.push(...r); else if (r) out.push(r);
      }
      return out;
    },
    /** reference to a variable (local parameter or global); reports unsupported / unknown ones */
    varRef(name, blockId) {
      if (!name) { c.problem(tf('変数が未選択です'), blockId); return null; }
      if (state.scope.has(name)) return { k: 'var', name, scope: 'local', type: state.scope.get(name) };
      const type = vars.get(name);
      if (!type) { c.problem(tf('変数「{0}」が存在しません', name), blockId); return null; }
      if (!['Number', 'String', 'Boolean'].includes(type)) { c.problem(tf('{0} 型の変数「{1}」は このターゲットではまだ使えません', type, name), blockId); return null; }
      return { k: 'var', name, scope: 'global', type };
    },
    nested(fn) { state.depth++; try { return fn(); } finally { state.depth--; } },
  };
  for (const s of project.scripts) {
    const d = blocks.get(s.hat.type);
    if (!d || !blockSupports(d, targetId) || !d.irHat) continue;
    state.scriptId = s.id; state.depth = 0; state.scope = new Map();
    const hat = d.irHat({ id: 'hat:' + s.id, args: s.hat.args }, c);
    if (!hat) continue;
    hat.script = s.id;
    hat.name = s.name || '';
    hat.body = c.stack(s.body);
    (hat.kind === 'function' ? ir.functions : ir.handlers).push(hat);
  }
  return ir;
}

// Common blocks (variables, conditions, loops, functions, math, text ...) that every IR-based generator can use.
// Each gets an `ir` implementation (block -> IR); they are marked `portable`, so a generator that sets `portable: true`
// (Minecraft, Rust CLI, ...) accepts them without the block having to list the generator.
import '../blocks.js';
import '../blocks-extra.js';
import '../blocks-reporters.js';
import '../blocks-game.js';
import '../blocks-more.js';
import { blocks } from '../registry.js';

const common = (type, patch) => {
  const d = blocks.get(type);
  d.portable = true;
  Object.assign(d, patch);
};
const parseParams = (src) => String(src || '').split(',').map((x) => x.trim()).filter((x) => /^[\p{L}_$][\p{L}\p{N}_$]*$/u.test(x));
const splitArgs = (src) => {
  const items = []; let depth = 0, cur = '', quote = '';
  for (const ch of String(src ?? '')) {
    if (quote) { cur += ch; if (ch === quote) quote = ''; continue; }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if ('(['.includes(ch)) depth++;
    if (')]'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { items.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim() !== '') items.push(cur);
  return items;
};
const num = (e) => ({ k: 'call', fn: 'num', args: [e], type: 'num' });

common('set_var', { ir: (b, c) => { const v = c.varRef(b.args.name, b.id); if (!v) return null; if (v.scope === 'local') { c.problem('関数の引数には代入できません', b.id); return null; } return { op: 'set', var: v, value: c.expr(b.args.value) }; } });
common('change_var', { ir: (b, c) => { const v = c.varRef(b.args.name, b.id); if (!v) return null; if (v.scope === 'local') { c.problem('関数の引数には代入できません', b.id); return null; } return { op: 'set', var: v, value: { k: 'bin', op: '+', a: num(v), b: num(c.expr(b.args.by)) } }; } });
common('if', { ir: (b, c) => ({ op: 'if', cond: c.cond(b.args.cond), then: c.nested(() => c.stack(b.slots.then)), else: c.nested(() => c.stack(b.slots.else)) }) });
common('repeat', { ir: (b, c) => ({ op: 'repeat', count: c.expr(b.args.times), body: c.nested(() => c.stack(b.slots.body)) }) });
common('wait', { ir: (b, c) => { if (c.state.depth > 0) { c.problem('「待つ」は処理の一番外側(ループ・条件分岐の中ではなく)でのみ使えます', b.id); return null; } return { op: 'wait', ms: c.expr(b.args.ms) }; } });
common('call_fn', { ir: (b, c) => {
  if (!b.args.name) { c.problem('関数が未選択です', b.id); return null; }
  if (b.args.to) c.problem('関数の戻り値はこのターゲットではまだ使えません', b.id);
  return { op: 'call', fn: b.args.name, args: splitArgs(b.args.args).map((a) => c.expr(a)), block: b.id };
} });
common('onFunction', { irHat: (b, c) => {
  if (!b.args.name) return null;
  const params = parseParams(b.args.params);
  params.forEach((p) => c.state.scope.set(p, 'any'));
  c.state.event = 'function';
  return { kind: 'function', fnName: b.args.name, params };
} });
common('note', { ir: (b) => ({ op: 'comment', text: String(b.args.text || '') }) });
common('sys_log', { ir: (b, c) => ({ op: 'log', value: c.expr(b.args.value) }) });
common('math_calc', { irExpr: (b, c) => {
  const a = num(c.expr(b.args.a)), z = num(c.expr(b.args.b));
  return b.args.op === '^' ? { k: 'call', fn: 'pow', args: [a, z], type: 'num' } : { k: 'bin', op: ['+', '-', '*', '/', '%'].includes(b.args.op) ? b.args.op : '+', a, b: z };
} });
common('text_join', { irExpr: (b, c) => ({ k: 'call', fn: 'concat', type: 'str', args: [c.expr(b.args.a), c.expr(b.args.b), ...(String(b.args.c).trim() || (b.args.c && typeof b.args.c === 'object') ? [c.expr(b.args.c)] : [])] }) });
common('math_random', { irExpr: (b, c) => ({ k: 'call', fn: 'random', type: 'num', args: [num(c.expr(b.args.min)), num(c.expr(b.args.max))] }) });
common('r_var', { irExpr: (b, c) => c.varRef(b.args.name) || { k: 'str', v: '' } });
common('b_cmp', { irExpr: (b, c) => c.cond({ rows: [{ l: b.args.a, op: b.args.op, r: b.args.b }], join: 'and', not: false }) });
common('b_and', { irExpr: (b, c) => ({ k: 'bin', op: '&&', a: c.expr(b.args.a), b: c.expr(b.args.b) }) });
common('b_or', { irExpr: (b, c) => ({ k: 'bin', op: '||', a: c.expr(b.args.a), b: c.expr(b.args.b) }) });
common('b_not', { irExpr: (b, c) => ({ k: 'un', op: '!', a: c.expr(b.args.a) }) });
common('r_if', { irExpr: (b, c) => ({ k: 'call', fn: 'ternary', type: 'any', args: [c.cond(b.args.cond), c.expr(b.args.a), c.expr(b.args.b)] }) });

// Golden projects: small standard programs every generator that can express them must generate correctly.
//   web-golden  : Button -> Event -> Variable change -> Condition -> display update, plus loop / function / array / object / data operation
//   cli-golden  : variables, condition, loop, function, console I/O  (expected stdout is part of the project)
import { emptyProject, createNode, newScript, newBlock, newModel } from '../../js/model.js';

const blk = (type, args, slots) => { const b = newBlock(type, args); if (slots) Object.assign(b.slots, slots); return b; };
const cond = (l, op, r) => ({ rows: [{ l, op, r }], join: 'and', not: false });
const rep = (type, args) => ({ $b: { id: 'r' + type, type, args } });

export function webGolden(targetCfg = { type: 'web' }) {
  const p = emptyProject('Golden Web', targetCfg);
  p.variables.push({ name: 'count', type: 'Number', initial: '0' }, { name: 'message', type: 'String', initial: '' }, { name: 'big', type: 'Boolean', initial: 'false' },
    { name: 'items', type: 'Array', initial: '[]' }, { name: 'config', type: 'Object', initial: '{}' });
  const m = newModel(p, 'Log'); m.fields = [{ name: 'id', type: 'Number' }, { name: 'text', type: 'String' }]; p.models.push(m);
  const root = p.pages[0].root;
  const add = (type, props) => { const n = createNode(p, type); Object.assign(n.props, props); root.children.push(n); return n; };
  add('text', { text: '{message}' });
  const btn = add('button', { text: '+1' });
  const f = newScript(p, 'main', 'onFunction', { name: 'describe', params: 'n' });
  f.body.push(blk('if', { cond: cond('n', '>', '2') }, { then: [blk('set_var', { name: 'message', value: '"big"' })], else: [blk('set_var', { name: 'message', value: '"small"' })] }));
  const s = newScript(p, 'main', 'onClick', { target: btn.id });
  s.body.push(
    blk('change_var', { name: 'count', by: '1' }),
    blk('repeat', { times: '2' }, { body: [blk('change_var', { name: 'count', by: '1' })] }),
    blk('call_fn', { name: 'describe', args: 'count', to: '' }),
    blk('list_add', { list: 'items', where: 'end', item: 'count' }),
    blk('obj_set', { obj: 'config', key: '"last"', value: 'count' }),
    blk('add_row', { model: 'Log', values: { id: 'count', text: 'message' } }),
    blk('if', { cond: cond(rep('r_var', { name: 'count' }), '>', '2') }, { then: [blk('set_var', { name: 'big', value: 'true' })], else: [] }));
  p.scripts.push(f, s);
  return p;
}

export function cliGolden(targetCfg = { type: 'rust-cli', crateName: 'golden_cli', version: '0.1.0', author: '', description: 'golden' }) {
  const p = emptyProject('Golden CLI', targetCfg);
  p.variables.push({ name: 'total', type: 'Number', initial: '0' }, { name: 'label', type: 'String', initial: 'sum' });
  const f = newScript(p, 'main', 'onFunction', { name: 'add', params: 'n' });
  f.body.push(blk('change_var', { name: 'total', by: 'n' }));
  const s = newScript(p, 'main', 'cli_main', {});
  s.body.push(
    blk('repeat', { times: '4' }, { body: [blk('call_fn', { name: 'add', args: '2.5', to: '' })] }),
    blk('if', { cond: cond('total', '>=', '10') }, { then: [blk('cli_print', { value: rep('text_join', { a: 'label', b: '" = "', c: 'total' }), nl: '1' })], else: [blk('cli_print', { value: '"too small"', nl: '1' })] }));
  p.scripts.push(f, s);
  return { project: p, stdout: 'sum = 10\n' };
}

/** which generators each golden project is for */
export const GOLDEN = [
  { id: 'web-golden', generators: [['web', () => webGolden()], ['vite-web', () => webGolden({ type: 'vite-web', version: '0.1.0' })], ['desktop', () => webGolden({ type: 'desktop', appName: 'Golden', identifier: 'com.example.golden', version: '1.0.0', width: 800, height: 600 })]] },
  { id: 'cli-golden', generators: [['rust-cli', () => cliGolden().project], ['python', () => cliGolden({ type: 'python', version: '0.1.0' }).project]], stdout: cliGolden().stdout },
];

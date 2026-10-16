// A small console program used by the Generator Builder to preview what a spec generates.
import { emptyProject, newScript, newBlock } from '../model.js';
import '../targets/rust/blocks.js';

const blk = (type, args, slots) => { const b = newBlock(type, args); if (slots) Object.assign(b.slots, slots); return b; };
const rep = (type, args) => ({ $b: { id: 'r' + type, type, args } });

export function sampleProject() {
  const p = emptyProject('Sample');
  p.variables.push({ name: 'total', type: 'Number', initial: '0' }, { name: 'name', type: 'String', initial: 'world' });
  const f = newScript(p, 'main', 'onFunction', { name: 'add', params: 'n' });
  f.body.push(blk('change_var', { name: 'total', by: 'n' }));
  const s = newScript(p, 'main', 'cli_main', {});
  s.body.push(
    blk('cli_print', { value: rep('text_join', { a: '"Hello, "', b: 'name', c: '"!"' }), nl: '1' }),
    blk('repeat', { times: '4' }, { body: [blk('call_fn', { name: 'add', args: '2.5', to: '' })] }),
    blk('if', { cond: { rows: [{ l: 'total', op: '>=', r: '10' }], join: 'and', not: false } }, { then: [blk('cli_print', { value: rep('text_join', { a: '"total = "', b: 'total', c: '' }), nl: '1' })], else: [blk('cli_print', { value: '"small"', nl: '1' })] }));
  p.scripts.push(f, s);
  return p;
}

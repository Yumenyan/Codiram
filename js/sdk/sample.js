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

// ---- samples per kind of generator (Generator Library "Validate", tests)
import { createNode, newModel } from '../model.js';
import '../targets/bot/blocks.js';

export function sampleWebProject() {
  const p = emptyProject('Sample Web');
  p.variables.push({ name: 'count', type: 'Number', initial: '0' });
  const root = p.pages[0].root;
  const text = createNode(p, 'text'); text.props.text = '{count}'; root.children.push(text);
  const btn = createNode(p, 'button'); btn.props.text = '+1'; root.children.push(btn);
  const s = newScript(p, 'main', 'onClick', { target: btn.id });
  s.body.push(blk('change_var', { name: 'count', by: '1' }));
  p.scripts.push(s);
  return p;
}
export function sampleDataProject() {
  const p = emptyProject('Sample Data');
  const m = newModel(p, 'Memo'); m.fields = [{ name: 'id', type: 'Number' }, { name: 'text', type: 'String' }, { name: 'done', type: 'Boolean' }];
  m.rows = [{ _id: 1, id: 1, text: 'buy milk', done: false }, { _id: 2, id: 2, text: "it's done", done: true }];
  p.models.push(m);
  return p;
}
export function sampleBotProject() {
  const p = emptyProject('Sample Bot');
  const s = newScript(p, 'main', 'bot_on_command', { command: '!hello' });
  s.body.push(blk('bot_reply', { text: rep('text_join', { a: '"Hello, "', b: rep('r_bot_author', {}), c: '"!"' }) }));
  p.scripts.push(s);
  return p;
}
/** a sample project that fits the generator (null when there is none, e.g. paused generators) */
export function sampleFor(gen) {
  if (gen.supports?.includes('minecraft')) return null;
  if (gen.sample) return gen.sample(); // a generator with a tiny feature set provides its own sample
  const p = gen.engine === 'data' ? sampleDataProject() : gen.engine === 'blocks' ? sampleWebProject() : gen.supports?.includes('bot') ? sampleBotProject() : sampleProject();
  p.targets = [gen.defaultConfig(p.name, p.name)]; p.activeTarget = gen.id;
  return p;
}

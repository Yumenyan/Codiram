// Generator-independent validation: which blocks of a project does a generator NOT support, and why?
import { blocks, targets, blockSupports, blockCaps } from '../registry.js';
import { tf } from '../i18n.js';

const label = (def) => def.title || def.type;

/** Why can't this generator use the block? -> message or null */
export function unsupportedReason(def, genId, asValue = false) {
  const gen = targets.get(genId);
  const name = gen ? (gen.name.ja || genId) : genId;
  if (!def) return tf('不明なブロック');
  if (blockSupports(def, genId, asValue)) return null;
  const missing = gen?.supports ? blockCaps(def).filter((c) => !gen.supports.includes(c)) : [];
  if (missing.length) return tf('{0} は「{1}」に対応していません({2})', name, label(def), missing.join(', '));
  return tf('{0} は「{1}」に対応していません', name, label(def));
}

/** Walks every script (hat, statements, nested slots, value blocks inside arguments). */
export function walkBlocks(project, fn) {
  const deep = (v, script, owner) => {
    if (!v || typeof v !== 'object') return;
    if (v.$b) { fn({ id: owner, type: v.$b.type, args: v.$b.args }, script, true); deep(v.$b.args, script, owner); return; }
    for (const x of Array.isArray(v) ? v : Object.values(v)) deep(x, script, owner);
  };
  const stack = (list, script) => (list || []).forEach((b) => {
    fn(b, script, false);
    deep(b.args, script, b.id);
    Object.values(b.slots || {}).forEach((s) => stack(s, script));
  });
  for (const s of project.scripts) {
    fn({ id: 'hat:' + s.id, type: s.hat.type, args: s.hat.args }, s, false);
    deep(s.hat.args, s, 'hat:' + s.id);
    stack(s.body, s);
  }
}

/** [{ script, block, msg }] for blocks the generator cannot use; { name -> count } in `used`. */
export function validateBlocks(project, genId) {
  const problems = [], seen = new Set();
  walkBlocks(project, (b, script, asValue) => {
    const def = blocks.get(b.type);
    const why = unsupportedReason(def, genId, asValue);
    if (why && !seen.has(b.id + b.type)) { seen.add(b.id + b.type); problems.push({ script: script.id, block: b.id, msg: why, unsupported: true }); }
  });
  return problems;
}

/** How many blocks of each kind a generator offers (for the Target settings dialog). */
export function compatSummary(genId) {
  let total = 0, ok = 0;
  for (const def of blocks.values()) {
    if (def.kind === 'reporter' && !def.irExpr && genId !== 'web') continue;
    total++;
    if (blockSupports(def, genId) || blockSupports(def, genId, true)) ok++;
  }
  return { total, ok };
}

// Generates every Minecraft template and (when a JDK is installed) type-checks the Java against API stubs.
// NOTE: the stubs mirror the Fabric/Yarn 1.19.2 signatures the generator relies on; a real Gradle build against
// Minecraft is still the final check (see docs/ARCHITECTURE.md).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import '../js/generator.js';
import { targets } from '../js/registry.js';
import { TEMPLATES } from '../js/templates.js';
import { emptyProject, normalizeProject, newScript, newBlock, lint } from '../js/model.js';
import { blocks, blockSupports } from '../js/registry.js';
import { defaultMcConfig } from '../js/targets/minecraft/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const mc = targets.get('minecraft');
assert.ok(mc, 'minecraft target registered');

// version-1 projects (no targets) open as Web projects
const old = normalizeProject({ id: 'x', name: 'old', pages: [], models: [], variables: [], scripts: [] });
assert.equal(old.activeTarget, 'web');
assert.deepEqual(old.targets, [{ type: 'web' }]);
assert.equal(emptyProject('w').activeTarget, 'web');

// a project that uses EVERY Minecraft-capable block, so the Java generator is exercised completely
function everyBlockProject() {
  const p = emptyProject('All', defaultMcConfig('all_blocks', 'All Blocks'));
  p.variables.push({ name: 'n', type: 'Number', initial: '1' }, { name: 's', type: 'String', initial: 'x' }, { name: 'b', type: 'Boolean', initial: 'false' });
  const fill = (blk) => {
    const d = blocks.get(blk.type);
    for (const [k, f] of Object.entries(d.fields || {})) {
      if (f.t === 'var') { if (!blk.args[k] && k !== 'to') blk.args[k] = 'n'; }
      else if (f.t === 'expr' && !blk.args[k]) blk.args[k] = '1';
      else if (f.t === 'text' && !blk.args[k]) blk.args[k] = 'x';
      else if (f.t === 'fn') blk.args[k] = 'helper';
      else if (f.t === 'select') blk.args[k] = Array.isArray(f.opts[0]) ? f.opts[0][0] : f.opts[0];
    }
    return blk;
  };
  const fn = newScript(p, 'main', 'onFunction', { name: 'helper', params: 'a' });
  fn.body.push(fill(newBlock('mc_send_message', {})));
  p.scripts.push(fn);
  const stmts = [...blocks.values()].filter((d) => d.kind === 'stmt' && blockSupports(d, 'minecraft') && d.type !== 'wait' && d.type !== 'call_fn' && d.type !== 'note');
  const hats = [...blocks.values()].filter((d) => d.kind === 'hat' && blockSupports(d, 'minecraft') && d.type !== 'onFunction');
  for (const h of hats) {
    const s = newScript(p, 'main', h.type, {});
    for (const d of stmts) {
      const b = fill(newBlock(d.type, {}));
      if (d.type === 'mc_set_block' && !['mc_on_right_click', 'mc_on_block_break', 'mc_on_block_place'].includes(h.type)) b.args.mode = 'relative';
      for (const sl of Object.keys(b.slots)) b.slots[sl].push(fill(newBlock('set_var', { name: 's', value: '"a"' })));
      s.body.push(b);
    }
    s.body.push(fill(newBlock('call_fn', { name: 'helper', args: '1' })));
    // every value block inside one message
    const reps = [...blocks.values()].filter((d) => (d.kind === 'reporter' || d.reporter) && blockSupports(d, 'minecraft', true));
    for (const r of reps) {
      if (['r_mc_block_id', 'r_mc_block_pos'].includes(r.type) && !['mc_on_right_click', 'mc_on_block_break', 'mc_on_block_place'].includes(h.type)) continue;
      const rb = fill({ id: 'r', type: r.type, args: { ...(r.defaults || {}) } });
      if (r.type === 'r_var') rb.args.name = 'n';
      s.body.push(newBlock('mc_send_message', { to: 'player', text: { $b: rb } }));
    }
    s.body.push(newBlock('wait', { ms: '500' }), newBlock('mc_send_message', { to: 'all', text: '"done"' }));
    p.scripts.push(s);
  }
  return p;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codiram-mc-'));
const everything = { id: 'all_blocks', target: 'minecraft', build: everyBlockProject };
for (const t of [...TEMPLATES.filter((x) => x.target === 'minecraft'), everything]) {
  const p = t.build({});
  { const lp = lint(p); if (lp.length) { const types = {}; p.scripts.forEach((sc) => { const w = (arr) => arr.forEach((b) => { types[b.id] = b.type; Object.values(b.slots || {}).forEach(w); }); w(sc.body); }); console.log(lp.slice(0, 5).map((x) => `${x.msg} @ ${types[x.block] || x.block}`)); } }
  assert.deepEqual(lint(p), [], `${t.id}: lint problems`);
  const r = mc.generate(p);
  assert.deepEqual(r.problems.filter((x) => x.level !== 'info'), [], `${t.id}: generator problems`);
  for (const f of ['build.gradle', 'gradle.properties', 'settings.gradle', 'src/main/resources/fabric.mod.json', 'README.md']) assert.ok(r.files[f], `${t.id}: missing ${f}`);
  JSON.parse(r.files['src/main/resources/fabric.mod.json']);
  const dir = path.join(tmp, t.id);
  for (const [f, c] of Object.entries(r.files)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), c); }
  const javaFiles = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? javaFiles(path.join(d, e.name)) : e.name.endsWith('.java') ? [path.join(d, e.name)] : []));
  try { execFileSync('javac', ['-version'], { stdio: 'ignore' }); } catch { console.log('javac not found: skipped type-check'); continue; }
  const out = path.join(dir, 'classes');
  fs.mkdirSync(out, { recursive: true });
  const srcs = [...javaFiles(path.join(here, 'mc-stubs')), ...javaFiles(path.join(dir, 'src/main/java'))];
  try { execFileSync('javac', ['-encoding', 'UTF-8', '-source', '17', '-target', '17', '-d', out, ...srcs], { stdio: 'pipe' }); }
  catch (e) { try { execFileSync('javac', ['-encoding', 'UTF-8', '--release', '17', '-d', out, ...srcs], { stdio: 'pipe' }); } catch (e2) { assert.fail(`${t.id}: javac failed\n${e2.stderr?.toString() || e2.message}`); } }
}
// "Wait" inside a condition is reported, and Web-only blocks are rejected for the Minecraft target
{
  const p = emptyProject('bad', defaultMcConfig('bad_mod', 'Bad'));
  const sc = newScript(p, 'main', 'mc_on_join', {});
  const iff = newBlock('if', { cond: { rows: [{ l: '1', op: '==', r: '1' }], join: 'and', not: false } });
  iff.slots.then.push(newBlock('wait', { ms: '100' }));
  sc.body.push(iff, newBlock('set_text', { target: 'x', value: '"a"' }));
  p.scripts.push(sc);
  const probs = lint(p);
  assert.ok(probs.length >= 2, 'nested wait and Web-only block must be reported: ' + JSON.stringify(probs));
}
console.log('OK: Minecraft templates generate Fabric projects (type-checked against stubs when javac is available)');

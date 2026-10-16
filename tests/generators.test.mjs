// Generator SDK: registry, capabilities, validation, and the Desktop / Rust CLI generators.
// If `cargo` is installed the Rust output is really compiled and run (std only, works offline).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import '../js/generator.js';
import { GeneratorRegistry, runGenerator, defineGenerator, validateBlocks, CAPABILITIES } from '../js/sdk/index.js';
import { blocks, blockSupports } from '../js/registry.js';
import { TEMPLATES } from '../js/templates.js';
import { emptyProject, newScript, newBlock } from '../js/model.js';

// ---- registry
assert.deepEqual(GeneratorRegistry.list().map((g) => g.id), ['web', 'desktop', 'rust-cli', 'python', 'vite-web']);
assert.ok(GeneratorRegistry.get('minecraft').hidden, 'minecraft is paused (hidden)');
assert.ok(GeneratorRegistry.list({ includeHidden: true }).some((g) => g.id === 'minecraft'));
assert.deepEqual(GeneratorRegistry.findByCapability('cli').map((g) => g.id), ['rust-cli', 'python']);
assert.ok(GeneratorRegistry.findByCapability('dialog').some((g) => g.id === 'desktop'));
assert.throws(() => defineGenerator({ id: 'x', name: { ja: 'x', en: 'x' }, generate() {}, supports: ['nope'] }), /unknown capabilities/);
const tmp = defineGenerator({ id: 'tmp-gen', name: { ja: 'T', en: 'T' }, generate: () => ({ files: {}, problems: [] }), supports: ['variables'] });
assert.equal(tmp.version, '1.0.0');
assert.ok(GeneratorRegistry.unregister('tmp-gen') && !GeneratorRegistry.get('tmp-gen'));
for (const g of GeneratorRegistry.list({ includeHidden: true })) for (const c of g.supports) assert.ok(CAPABILITIES[c], `${g.id}: ${c}`);

// ---- block compatibility
const onClick = blocks.get('onClick'), cliPrint = blocks.get('cli_print'), notify = blocks.get('desk_notify'), openFile = blocks.get('desk_open_file');
assert.ok(blockSupports(onClick, 'web') && blockSupports(onClick, 'desktop') && !blockSupports(onClick, 'rust-cli'));
assert.ok(!blockSupports(cliPrint, 'web') && blockSupports(cliPrint, 'rust-cli'));
assert.ok(blockSupports(notify, 'web') && blockSupports(notify, 'desktop') && !blockSupports(notify, 'rust-cli'), 'notification degrades gracefully on web');
assert.ok(!blockSupports(openFile, 'web') && blockSupports(openFile, 'desktop'));
assert.ok(blockSupports(blocks.get('set_var'), 'rust-cli') && blockSupports(blocks.get('repeat'), 'rust-cli') && !blockSupports(blocks.get('ui_style'), 'rust-cli'));

// ---- validation: a Rust CLI project that uses "Button Clicked"
{
  const p = emptyProject('Bad', { type: 'rust-cli', crateName: 'bad', version: '0.1.0' });
  p.scripts.push(newScript(p, 'main', 'onClick', { target: 'x' }));
  const probs = validateBlocks(p, 'rust-cli');
  assert.equal(probs.length, 1);
  assert.match(probs[0].msg, /Rust CLI/);
  assert.ok(runGenerator(p, 'rust-cli').problems.some((x) => x.unsupported));
}

// ---- Web through the SDK still produces the same app
for (const t of TEMPLATES.filter((x) => !x.target)) {
  const r = runGenerator(t.build(), 'web');
  assert.ok(r.files['index.html'] && r.files['app.js'], t.id);
  assert.equal(r.generator.id, 'web');
}

// ---- Desktop
const desk = TEMPLATES.find((t) => t.id === 'desk_editor').build({});
assert.equal(desk.activeTarget, 'desktop');
{
  const r = runGenerator(desk, 'desktop');
  const f = r.files;
  assert.deepEqual(r.problems.filter((x) => x.level !== 'info'), []);
  for (const n of ['package.json', 'src/index.html', 'src/app.js', 'src/style.css', 'src-tauri/Cargo.toml', 'src-tauri/build.rs', 'src-tauri/src/main.rs', 'src-tauri/tauri.conf.json', 'README.md', 'app-icon.png', 'src-tauri/icons/128x128.png']) assert.ok(f[n], n);
  const conf = JSON.parse(f['src-tauri/tauri.conf.json']);
  assert.equal(conf.build.distDir, '../src');
  assert.equal(conf.tauri.bundle.identifier, 'com.example.texteditor');
  JSON.parse(f['package.json']);
  new vm.Script(f['src/app.js']); // valid JavaScript
  assert.match(f['src/app.js'], /Desktop\.openFile\(\)/);
  assert.match(f['src/app.js'], /const Desktop = /);
  assert.ok(f['app-icon.png'].length > 1000 && f['app-icon.png'][1] === 80);
}

// ---- Rust CLI: compile and run (if cargo exists)
let hasCargo = true;
try { execFileSync('cargo', ['--version'], { stdio: 'ignore' }); } catch { hasCargo = false; }
const rustTemplates = TEMPLATES.filter((t) => t.target === 'rust-cli');
assert.ok(rustTemplates.length >= 2);
const run = (project, input = '', args = []) => {
  const r = runGenerator(project, 'rust-cli');
  assert.deepEqual(r.problems.filter((x) => x.level !== 'info'), [], project.name);
  if (!hasCargo) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codiram-rust-'));
  for (const [n, c] of Object.entries(r.files)) { fs.mkdirSync(path.dirname(path.join(dir, n)), { recursive: true }); fs.writeFileSync(path.join(dir, n), c); }
  const env = { ...process.env, CARGO_TARGET_DIR: path.join(os.tmpdir(), 'codiram-rust-target') };
  const build = execFileSync('cargo', ['run', '--quiet', '--offline', '--', ...args], { cwd: dir, input, env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  return build;
};
const hello = rustTemplates.find((t) => t.id === 'cli_hello').build();
assert.equal(run(hello, 'Codiram\n'), hello && hasCargo ? 'What is your name?\nHello, Codiram!\n' : null);
if (hasCargo) assert.equal(run(hello, '\n'), 'What is your name?\nHello, world!\n');
const fizz = run(rustTemplates.find((t) => t.id === 'cli_fizzbuzz').build());
if (hasCargo) assert.equal(fizz.trim().split('\n').slice(0, 15).join(','), '1,2,Fizz,4,Buzz,Fizz,7,8,Fizz,Buzz,11,Fizz,13,14,FizzBuzz');

// a program that touches every supported feature compiles without warnings about types
{
  const p = emptyProject('All', { type: 'rust-cli', crateName: 'all_features', version: '0.1.0' });
  p.variables.push({ name: 'n', type: 'Number', initial: '2' }, { name: 'label', type: 'String', initial: 'x{y}' }, { name: 'ok', type: 'Boolean', initial: 'true' });
  const rep = (type, args) => ({ $b: { id: 'r' + type, type, args } });
  const fn = newScript(p, 'main', 'onFunction', { name: 'greet', params: 'who, times' });
  fn.body.push(newBlock('repeat', { times: 'times' }), newBlock('sys_log', { value: 'who' }));
  fn.body[0].slots.body = [newBlock('sys_log', { value: 'who + "!"' })]; fn.body.pop();
  const s = newScript(p, 'main', 'cli_main', {});
  const nb = (t, a, slots) => { const b = newBlock(t, a); if (slots) Object.assign(b.slots, slots); return b; };
  s.body.push(
    nb('change_var', { name: 'n', by: '3' }),
    nb('set_var', { name: 'label', value: rep('text_join', { a: '"n="', b: 'n', c: '"/ok=" + ok' }) }),
    nb('cli_print', { value: 'label', nl: '1' }),
    nb('set_var', { name: 'n', value: rep('math_calc', { a: 'n', op: '^', b: '2' }) }),
    nb('cli_print', { value: 'n', nl: '0' }), nb('cli_print', { value: '" squared\\n"', nl: '0' }),
    nb('if', { cond: { rows: [{ l: 'n', op: '>', r: '20' }, { l: 'label', op: 'contains', r: '"ok=true"' }], join: 'and', not: false } }, { then: [nb('set_var', { name: 'ok', value: 'false' })], else: [nb('note', { text: 'never' })] }),
    nb('cli_write_file', { path: '"out.txt"', text: '"a"', mode: 'write' }), nb('cli_write_file', { path: '"out.txt"', text: '"b"', mode: 'append' }),
    nb('cli_print', { value: rep('r_cli_read_file', { path: '"out.txt"' }), nl: '1' }),
    nb('cli_print', { value: rep('r_if', { cond: { rows: [{ l: rep('b_cli_file_exists', { path: '"out.txt"' }), op: 'true', r: '' }], join: 'and', not: false }, a: '"exists"', b: '"missing"' }), nl: '1' }),
    nb('cli_print', { value: rep('math_random', { min: '5', max: '5' }), nl: '1' }),
    nb('wait', { ms: '10' }),
    nb('call_fn', { name: 'greet', args: '"hi", 2', to: '' }),
    nb('cli_print', { value: 'ok', nl: '1' }));
  p.scripts.push(fn, s);
  const out = run(p);
  if (hasCargo) assert.equal(out, 'n=5/ok=true\n25 squared\nab\nexists\n5\nhi!\nhi!\nfalse\n');
}
console.log('OK: Generator SDK (registry, capabilities, validation) + Desktop + Rust CLI' + (hasCargo ? ' (Rust compiled and run)' : ' (cargo not found: Rust not compiled)'));

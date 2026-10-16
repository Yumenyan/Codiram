// Generator Builder back-end: declarative generators, external install / plugin, scaffold.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import '../js/generator.js';
import { GeneratorRegistry, runGenerator, verifyGenerated } from '../js/sdk/index.js';
import { validateSpec, previewSpec, defineDeclarativeGenerator } from '../js/sdk/declarative.js';
import { PRESETS, blankSpec } from '../js/sdk/presets.js';
import { installGeneratorSpec, uninstallGenerator, loadUserGenerators, userGenerators, storage, parseSpecFile, exportSpec } from '../js/sdk/external.js';
import { scaffoldGenerator } from '../js/sdk/scaffold.js';
import { sampleProject } from '../js/sdk/sample.js';
import { registerPlugin } from '../js/registry.js';
import { cliGolden } from './golden/projects.mjs';

let mem = '[]';
storage.get = () => mem; storage.set = (v) => { mem = v; };
const has = (tool) => { try { execFileSync(tool, ['--version'], { stdio: 'ignore' }); return true; } catch { return false; } };

// spec validation
assert.deepEqual(validateSpec(PRESETS.python), []);
assert.deepEqual(validateSpec(blankSpec()), []);
assert.ok(validateSpec({ ...blankSpec(), id: 'Bad Id' }).some((e) => /id:/.test(e)));
{ const s = blankSpec(); delete s.rules.set; assert.ok(validateSpec(s).some((e) => /rules.set/.test(e))); }
{ const s = blankSpec(); s.supports = [...s.supports, 'nonsense']; assert.ok(validateSpec(s).some((e) => /unknown capability/.test(e))); }
{ const s = blankSpec(); delete s.rules.readFile; assert.ok(validateSpec(s).some((e) => /filesystem.*readFile/.test(e))); }
{ const s = blankSpec(); s.program.template = 'no slots'; assert.ok(validateSpec(s).some((e) => /\{\{functions\}\}/.test(e))); }
assert.throws(() => installGeneratorSpec({ ...blankSpec(), id: 'rust-cli' }), /built-in/);

// preview does not leave anything registered
const pv = previewSpec(PRESETS.nodejs, sampleProject());
assert.deepEqual(pv.errors, []);
assert.match(pv.files['main.js'], /function add\(n\)/);
assert.ok(!GeneratorRegistry.get('preview-draft'));
assert.ok(previewSpec({ ...blankSpec(), id: 'x' }, sampleProject()).errors.length);

// install the Node.js preset as an EXTERNAL generator and run the golden CLI program through it
installGeneratorSpec(PRESETS.nodejs);
assert.ok(GeneratorRegistry.get('nodejs-cli').external);
assert.ok(GeneratorRegistry.list().some((g) => g.id === 'nodejs-cli'));
assert.equal(userGenerators().length, 1);
{
  const { project, stdout } = cliGolden({ type: 'nodejs-cli', version: '0.1.0' });
  const res = runGenerator(project, 'nodejs-cli');
  assert.deepEqual(verifyGenerated(res, GeneratorRegistry.get('nodejs-cli').verify), []);
  if (has('node')) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codiram-node-'));
    for (const [n, c] of Object.entries(res.files)) fs.writeFileSync(path.join(dir, n), c);
    assert.equal(execFileSync('node', ['main.js'], { cwd: dir, encoding: 'utf8' }), stdout);
  }
  // blocks the generator has no capability for are rejected
  const web = sampleProject(); web.scripts.push({ ...web.scripts[0], id: 'x', hat: { type: 'onClick', args: { target: 'q' } }, body: [] });
  web.targets = [{ type: 'nodejs-cli' }]; web.activeTarget = 'nodejs-cli';
  assert.ok(GeneratorRegistry.get('nodejs-cli').validate(web).problems.some((p) => p.unsupported));
}
// reload from storage after a "restart"
uninstallGenerator('nodejs-cli');
assert.ok(!GeneratorRegistry.get('nodejs-cli') && userGenerators().length === 0);
installGeneratorSpec(PRESETS.nodejs); GeneratorRegistry.unregister('nodejs-cli');
assert.deepEqual(loadUserGenerators(), []);
assert.ok(GeneratorRegistry.get('nodejs-cli'));
// export / import round trip
assert.deepEqual(parseSpecFile(exportSpec(PRESETS.nodejs)), PRESETS.nodejs);
assert.throws(() => parseSpecFile('{"format":"x"}'), /not a Codiram generator file/);
uninstallGenerator('nodejs-cli');

// a plugin can ship generators (data) and code generators
registerPlugin({ id: 'demo-gen', name: 'demo', generators: [{ ...blankSpec(), id: 'demo-lang', name: { ja: 'デモ', en: 'Demo' } }] });
assert.ok(GeneratorRegistry.get('demo-lang'));
GeneratorRegistry.unregister('demo-lang');
registerPlugin({ id: 'demo-code', name: 'demo', generators: [{ id: 'demo-code-gen', name: { ja: 'x', en: 'x' }, supports: ['variables'], generate: () => ({ files: { a: '1' }, problems: [] }) }] });
assert.equal(runGenerator(sampleProject(), 'demo-code-gen').files.a, '1');
GeneratorRegistry.unregister('demo-code-gen');

// scaffold: both kinds produce a loadable module
for (const kind of ['declarative', 'custom']) {
  const files = scaffoldGenerator({ ...blankSpec(), id: 'scaffolded' }, kind);
  assert.deepEqual(Object.keys(files).sort(), ['js/targets/scaffolded/README.md', 'js/targets/scaffolded/generator.spec.json', 'js/targets/scaffolded/index.js']);
  assert.deepEqual(parseSpecFile(files['js/targets/scaffolded/generator.spec.json']).id, 'scaffolded');
  // run the generated module for real (it imports the SDK by relative path, so place it inside js/targets)
  const dir = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'js', 'targets', 'scaffolded');
  fs.mkdirSync(dir, { recursive: true });
  try {
    fs.writeFileSync(path.join(dir, 'index.js'), files['js/targets/scaffolded/index.js']);
    await import('../js/targets/scaffolded/index.js?kind=' + kind);
    const g = GeneratorRegistry.get('scaffolded');
    assert.ok(g);
    const p = sampleProject(); p.targets = [{ type: 'scaffolded', version: '0.1.0' }]; p.activeTarget = 'scaffolded';
    assert.match(runGenerator(p, 'scaffolded').files['main.js'], /function add/);
    GeneratorRegistry.unregister('scaffolded');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
console.log('OK: Generator Builder back-end (declarative generators, external install / plugin, scaffold)');

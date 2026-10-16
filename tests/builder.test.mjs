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
import { installGeneratorSpec, uninstallGenerator, loadUserGenerators, userGenerators, storage, parseSpecFile, exportSpec, importSpecTexts, definitionOf } from '../js/sdk/external.js';
import { toDefinition, normalizeDefinition, validateDefinition, importDefinitions, splitDefinition, buildJsonSchema, RULE_SECTIONS } from "../js/sdk/definition.js";
import { makeZip } from "../js/zip.js";
import { scaffoldGenerator, readScaffoldZip } from '../js/sdk/scaffold.js';
import { sampleProject } from '../js/sdk/sample.js';
import { registerPlugin } from '../js/registry.js';
import { cliGolden, webGolden } from './golden/projects.mjs';

const NODE_EXT = { ...PRESETS.nodejs, id: 'node-ext', builtin: false };
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
installGeneratorSpec(NODE_EXT);
assert.ok(GeneratorRegistry.get('node-ext').external);
assert.ok(GeneratorRegistry.list().some((g) => g.id === 'node-ext'));
assert.equal(userGenerators().length, 1);
{
  const { project, stdout } = cliGolden({ type: 'node-ext', version: '0.1.0' });
  const res = runGenerator(project, 'node-ext');
  assert.deepEqual(verifyGenerated(res, GeneratorRegistry.get('node-ext').verify), []);
  if (has('node')) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codiram-node-'));
    for (const [n, c] of Object.entries(res.files)) fs.writeFileSync(path.join(dir, n), c);
    assert.equal(execFileSync('node', ['main.js'], { cwd: dir, encoding: 'utf8' }), stdout);
  }
  // blocks the generator has no capability for are rejected
  const web = sampleProject(); web.scripts.push({ ...web.scripts[0], id: 'x', hat: { type: 'onClick', args: { target: 'q' } }, body: [] });
  web.targets = [{ type: 'node-ext' }]; web.activeTarget = 'node-ext';
  assert.ok(GeneratorRegistry.get('node-ext').validate(web).problems.some((p) => p.unsupported));
}
// reload from storage after a "restart"
uninstallGenerator('node-ext');
assert.ok(!GeneratorRegistry.get('node-ext') && userGenerators().length === 0);
installGeneratorSpec(NODE_EXT); GeneratorRegistry.unregister('node-ext');
assert.deepEqual(loadUserGenerators(), []);
assert.ok(GeneratorRegistry.get('node-ext'));
// export / import round trip
assert.deepEqual(toDefinition(parseSpecFile(exportSpec(PRESETS.nodejs))), toDefinition(PRESETS.nodejs));
assert.throws(() => parseSpecFile('{"format":"x"}'), /format must be/);
uninstallGenerator('node-ext');

// a plugin can ship generators (data) and code generators
registerPlugin({ id: 'demo-gen', name: 'demo', generators: [{ ...blankSpec(), id: 'demo-lang', name: { ja: 'デモ', en: 'Demo' } }] });
assert.ok(GeneratorRegistry.get('demo-lang'));
GeneratorRegistry.unregister('demo-lang');
registerPlugin({ id: 'demo-code', name: 'demo', generators: [{ id: 'demo-code-gen', name: { ja: 'x', en: 'x' }, supports: ['variables'], generate: () => ({ files: { a: '1' }, problems: [] }) }] });
assert.equal(runGenerator(sampleProject(), 'demo-code-gen').files.a, '1');
GeneratorRegistry.unregister('demo-code-gen');

// scaffold: both kinds produce a loadable module (+ definition + scaffold/ skeleton)
for (const kind of ['declarative', 'custom']) {
  const files = scaffoldGenerator({ ...blankSpec(), id: 'scaffolded' }, kind);
  const names = Object.keys(files);
  for (const n of ['generator.definition.json', 'scaffold/package.json', 'scaffold/README.md', 'js/targets/scaffolded/index.js', 'js/targets/scaffolded/generator.definition.json', 'js/targets/scaffolded/README.md']) assert.ok(names.includes(n), n);
  assert.equal(names.includes('js/targets/scaffolded/custom.js'), kind === 'custom');
  assert.equal(JSON.parse(files['generator.definition.json']).schemaVersion, 2);
  // run the generated module for real (it imports the SDK by relative path, so place it inside js/targets)
  const dir = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'js', 'targets', 'scaffolded');
  fs.mkdirSync(dir, { recursive: true });
  try {
    for (const n of names.filter((x) => x.startsWith('js/targets/scaffolded/'))) fs.writeFileSync(path.join(dir, path.basename(n)), files[n]);
    await import('../js/targets/scaffolded/index.js?kind=' + kind);
    assert.ok(GeneratorRegistry.get('scaffolded'));
    const p = sampleProject(); p.targets = [{ type: 'scaffolded', version: '0.1.0' }]; p.activeTarget = 'scaffolded';
    assert.match(runGenerator(p, 'scaffolded').files['main.js'], /function add/);
    GeneratorRegistry.unregister('scaffolded');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// ---- Definition schema (v2)
{
  const def = toDefinition(PRESETS.python);
  assert.equal(def.schemaVersion, 2);
  for (const k of ['generator', 'target', 'capabilities', 'types', 'expressions', 'statements', 'conditions', 'loops', 'functions', 'events', 'mappings', 'templates', 'scaffold']) assert.ok(def[k], k);
  assert.deepEqual(validateDefinition(def), { errors: [], warnings: [] });
  assert.ok(validateDefinition({ ...def, schemaVersion: 1 }).errors.length);
  assert.ok(validateDefinition({ ...def, statements: { set: 5 } }).errors.some((e) => /statements.set/.test(e)));
  assert.ok(validateDefinition({ ...def, mystery: 1, statements: { ...def.statements, bogus: 'x' } }).warnings.length === 2, 'unknown keys are warnings (forward compatible)');
  // v1 specs still import, v2 round-trips to the same generator
  assert.deepEqual(toDefinition(normalizeDefinition(PRESETS.python)), def);
  assert.deepEqual(toDefinition(normalizeDefinition(def)), def);
  // the checked-in files are in sync with the code
  const docs = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'docs');
  const read = (rel) => JSON.parse(fs.readFileSync(path.join(docs, rel), 'utf8'));
  assert.deepEqual(read('schemas/generator-definition.schema.json'), buildJsonSchema(), 'run: node scripts/export-definitions.mjs');
  assert.deepEqual(read('definitions/python.json'), def);
  for (const spec of Object.values(PRESETS)) assert.deepEqual(read(`definitions/${spec.id}.json`), toDefinition(spec), spec.id);
  assert.deepEqual(Object.keys(buildJsonSchema().properties.statements.properties), RULE_SECTIONS.statements);
}

// ---- split definitions: core + parts in any order give the same generator
{
  const full = toDefinition(PRESETS.python);
  const { core, parts } = splitDefinition(full, { io: ['io'], types: ['types'], control: ['conditions', 'loops'] });
  assert.ok(!core.io && !core.loops && parts.length === 3);
  const merged = importDefinitions([JSON.stringify(parts[1]), JSON.stringify(core), JSON.stringify(parts[0]), JSON.stringify(parts[2])]);
  assert.deepEqual(toDefinition(merged), full);
  assert.throws(() => importDefinitions([JSON.stringify(parts[0])]), /no full definition/);
  assert.throws(() => importDefinitions([JSON.stringify(core), JSON.stringify({ ...parts[0], generator: { id: 'other' } })]), /does not match/);
  assert.throws(() => importDefinitions([JSON.stringify(core), JSON.stringify(core)]), /more than one full definition/);
  // a later part overrides / extends (e.g. add a rule, add a capability)
  const more = importDefinitions([JSON.stringify(full), JSON.stringify({ format: 'codiram-generator', schemaVersion: 2, fragment: true, generator: { id: 'python' }, statements: { comment: '## {text}' }, capabilities: ['http'] })]);
  assert.equal(more.rules.comment, '## {text}'); assert.ok(more.supports.includes('http') && more.supports.includes('cli'));
}

// ---- extends: duplicate an installed definition and change the target-specific parts
{
  const text = JSON.stringify({ format: 'codiram-generator', schemaVersion: 2, extends: 'python', generator: { id: 'python-fancy', name: { ja: 'Fancy', en: 'Fancy' }, icon: '✨' }, statements: { comment: '#~ {text}' } });
  const spec = importSpecTexts([text]);
  assert.equal(spec.id, 'python-fancy'); assert.equal(spec.rules.comment, '#~ {text}'); assert.equal(spec.rules.set, PRESETS.python.rules.set);
  installGeneratorSpec(spec);
  const { project } = cliGolden({ type: 'python-fancy', version: '0.1.0' });
  assert.ok(runGenerator(project, 'python-fancy').files['main.py'].includes('add(2.5)'));
  uninstallGenerator('python-fancy');
  assert.throws(() => importSpecTexts([text.replace('python', 'rust-cli')]), /no such declarative generator/);
}

// ---- project generator (kind: project): scaffold + another generator's output
{
  const vite = GeneratorRegistry.get('vite-web');
  assert.equal(vite.kind, 'project'); assert.equal(vite.inherits, 'web');
  const res = runGenerator(webGolden({ type: 'vite-web', version: '0.1.0' }), 'vite-web');
  for (const n of ['package.json', 'vite.config.js', 'index.html', 'app.js', 'style.css']) assert.ok(res.files[n], n);
  assert.equal(JSON.parse(res.files['package.json']).scripts.dev, 'vite');
  assert.ok(!res.files['README.md'].includes('index.html'), 'scaffold README replaces the web README');
  // a project definition built in the Builder format, placing the app under src/
  const spec = importSpecTexts([JSON.stringify({ format: 'codiram-generator', schemaVersion: 2, kind: 'project', generator: { id: 'my-shell', name: { ja: 'Shell', en: 'Shell' } },
    scaffold: { source: { generator: 'web', dir: 'www' }, config: { version: '1.0.0' } }, templates: { files: { 'shell.json': '{ "app": {{json name}} }' } }, verify: { requiredFiles: ['shell.json', 'www/index.html'] } })]);
  installGeneratorSpec(spec);
  const r2 = runGenerator(webGolden({ type: 'my-shell', version: '1.0.0' }), 'my-shell');
  assert.ok(r2.files['www/index.html'] && JSON.parse(r2.files['shell.json']).app === 'Golden Web');
  assert.equal(r2.entry, 'www/index.html');
  assert.deepEqual(verifyGenerated(r2, GeneratorRegistry.get('my-shell').verify), []);
  uninstallGenerator('my-shell');
  assert.throws(() => importSpecTexts([JSON.stringify({ format: 'codiram-generator', schemaVersion: 2, kind: 'project', generator: { id: 'bad-shell' }, scaffold: { source: { generator: 'nope' } } })]) && installGeneratorSpec(importSpecTexts([JSON.stringify({ format: 'codiram-generator', schemaVersion: 2, kind: 'project', generator: { id: 'bad-shell' }, scaffold: { source: { generator: 'nope' } } })])), /not a registered generator/);
}

// ---- scaffold ZIP round trip (definition + scaffold/ edits come back)
{
  const files = scaffoldGenerator(PRESETS.viteWeb, 'declarative');
  files['scaffold/extra.txt'] = 'hello {{name}}';
  const blob = makeZip(files);
  const spec = await readScaffoldZip(new Uint8Array(await blob.arrayBuffer()), definitionOf);
  assert.equal(spec.id, 'vite-web'); assert.equal(spec.files['extra.txt'], 'hello {{name}}'); assert.equal(spec.kind, 'project');
  assert.equal(spec.files['vite.config.js'], PRESETS.viteWeb.files['vite.config.js']);
  await assert.rejects(async () => readScaffoldZip(new Uint8Array(await makeZip({ 'a.txt': 'x' }).arrayBuffer())), /not found/);
}

// ---- code extension hooks
{
  const spec = { ...importSpecTexts([exportSpec(PRESETS.python)]), id: 'python-hooked', builtin: false };
  GeneratorRegistry.unregister('python-hooked');
  defineDeclarativeGenerator(spec, { files: (files) => { files['EXTRA.txt'] = 'added by code'; } });
  const { project } = cliGolden({ type: 'python-hooked', version: '0.1.0' });
  assert.equal(runGenerator(project, 'python-hooked').files['EXTRA.txt'], 'added by code');
  GeneratorRegistry.unregister('python-hooked');
}

// ---- typed languages: {type} in globalDecl comes from types.varTypes
{
  const ts = importSpecTexts([JSON.stringify({ ...toDefinition(PRESETS.nodejs), generator: { id: 'ts-cli', name: { ja: 'TS', en: 'TS' } },
    types: { varTypes: { Number: 'number', String: 'string', Boolean: 'boolean' } }, statements: { ...toDefinition(PRESETS.nodejs).statements, globalDecl: 'let {name}: {type} = {value};' } })]);
  installGeneratorSpec(ts);
  assert.match(runGenerator(cliGolden({ type: 'ts-cli', version: '0.1.0' }).project, 'ts-cli').files['main.js'], /let total: number = 0;/);
  uninstallGenerator('ts-cli');
}
console.log('OK: Generator Builder back-end (declarative generators, external install / plugin, scaffold)');

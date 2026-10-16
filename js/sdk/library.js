// Generator Library: everything Codiram can generate with, with import / export / duplicate / update / validate.
import { GeneratorRegistry } from '../registry.js';
import { toDefinition, importDefinitions } from './definition.js';
import { installGeneratorSpec, uninstallGenerator, definitionOf, userGenerators } from './external.js';
import { runGenerator, verifyGenerated, manifestOf } from './index.js';
import { validateSpec } from './declarative.js';
import { sampleFor } from './sample.js';
import { CAPABILITIES } from './capabilities.js';

/** 'syntax' | 'project' (declarative definitions), 'data' | 'code' (generators written as code) */
export const kindOf = (g) => (g.spec ? (g.spec.kind || (g.spec.source ? 'project' : g.spec.program ? 'syntax' : 'project')) : g.engine === 'data' ? 'data' : 'code');

export function libraryEntries() {
  return GeneratorRegistry.list({ includeHidden: true }).filter((g) => g.id !== 'preview-draft').map((g) => ({
    id: g.id, name: g.name, icon: g.icon, version: g.version, kind: kindOf(g), builtin: !g.external, paused: !!g.hidden && !g.external, external: !!g.external,
    definition: !!g.spec, language: g.language, supports: g.supports,
  }));
}

/** Definition JSON for declarative generators; a read-only manifest (reference for AI) for code generators */
export function exportGenerator(id) {
  const g = GeneratorRegistry.get(id);
  if (!g) throw new Error(`unknown generator: ${id}`);
  if (g.spec) return { file: `${id}.json`, importable: true, text: JSON.stringify(toDefinition(g.spec), null, 2) + '\n' };
  return { file: `${id}.manifest.json`, importable: false, text: JSON.stringify({ format: 'codiram-generator-manifest', note: 'Generator written as code: not importable. Use as a reference for a Definition.', ...manifestOf(g), kind: kindOf(g), engine: g.engine, views: g.views, configFields: (g.configFields || []).map((f) => f.key), verify: g.verify }, null, 2) + '\n' };
}
export function exportAll() {
  const files = {};
  for (const e of libraryEntries()) { const x = exportGenerator(e.id); files[(x.importable ? 'definitions/' : 'manifests/') + x.file] = x.text; }
  return files;
}

/** copy a declarative generator under a new id (installed as an external generator) */
export function duplicateGenerator(id, newId, name) {
  const spec = definitionOf(id);
  if (!spec) throw new Error('only Definition-based generators can be duplicated (code generators: use the manifest as reference)');
  const copy = JSON.parse(JSON.stringify(spec));
  delete copy.builtin; copy.id = newId; copy.version = '0.1.0';
  copy.name = { ja: name || `${spec.name.ja} (コピー)`, en: name || `${spec.name.en} (copy)` };
  return installGeneratorSpec(copy);
}

const cmpVer = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
/**
 * Import definition files (full + fragments). New id -> install. Same id as an external generator -> update
 * (older versions need allowDowngrade). Built-in ids are never replaced. Returns { id, action, from?, to }.
 */
export function importIntoLibrary(texts, { allowDowngrade = false } = {}) {
  const spec = importDefinitions(texts, definitionOf);
  const existing = GeneratorRegistry.get(spec.id);
  let action = 'installed', from = null;
  if (existing) {
    if (!existing.external) throw new Error(`"${spec.id}" is a built-in generator (use a different generator.id, or "extends")`);
    from = existing.version;
    if (cmpVer(spec.version, from) < 0 && !allowDowngrade) { const e = new Error(`version ${spec.version} is older than the installed ${from}`); e.code = 'downgrade'; throw e; }
    action = cmpVer(spec.version, from) === 0 ? 'replaced' : 'updated';
  }
  installGeneratorSpec(spec);
  return { id: spec.id, action, from, to: spec.version };
}

/** health check of one generator: [{ name, ok, msg }] — definition, sample generation, files, build (when the tool exists is left to the tests) */
export function validateGenerator(id) {
  const g = GeneratorRegistry.get(id), checks = [];
  const add = (name, ok, msg = '') => checks.push({ name, ok, msg });
  if (!g) return [{ name: 'exists', ok: false, msg: 'unknown generator' }];
  add('manifest', !!(g.id && g.name && typeof g.generate === 'function'), 'id / name / generate');
  const badCaps = (g.supports || []).filter((c) => !CAPABILITIES[c]);
  add('capabilities', !badCaps.length, badCaps.join(', '));
  if (g.spec) { const errs = validateSpec(g.spec); add('definition', !errs.length, errs.join('; ')); }
  const sample = sampleFor(g);
  if (!sample) { add('sample generation', true, 'skipped (paused generator)'); return checks; }
  try {
    const v = g.validate(sample);
    add('sample validates', v.ok, v.problems.map((p) => p.msg).slice(0, 3).join('; '));
    const res = runGenerator(sample, id);
    add('sample generates', Object.keys(res.files).length > 0, `${Object.keys(res.files).length} files`);
    const errs = verifyGenerated(res, g.verify || {});
    add('verify rules', !errs.length, errs.slice(0, 3).join('; '));
  } catch (e) { add('sample generation', false, e.message); }
  return checks;
}

export { uninstallGenerator, userGenerators };

// Generator SDK.
//
//   Visual blocks -> (Validate) -> [IR] -> Target generator -> project files
//
// A generator is a plain object registered with the GeneratorRegistry. `defineGenerator` fills in the metadata every
// generator needs, so a new target is one module that calls it - Codiram Core never mentions a target by name.
//
//   defineGenerator({
//     id, name:{ja,en}, icon, desc, order,
//     version, language:[..], platforms:[..], supports:[capability ids],   // manifest + capabilities
//     engine: 'blocks' | 'ir', portable, inherits, hidden,                // how blocks are mapped (see registry.js)
//     views:[..], defaultConfig(), configFields:[..], validateConfig(cfg), // UI
//     check?(project, cfg) -> problems, generate(project, cfg) -> { files, problems, root },
//   })
import { GeneratorRegistry, targets, hooks } from '../registry.js';
import { targetConfig } from '../model.js';
import { missingCapabilities } from './features.js';
import { ADDONS } from './addons.js';
import { tf } from '../i18n.js';
import { validateBlocks } from './validate.js';
import { CAPABILITIES } from './capabilities.js';

export { GeneratorRegistry, CAPABILITIES };
export { validateBlocks, compatSummary, unsupportedReason, walkBlocks } from './validate.js';
export { usedCapabilities, missingCapabilities } from './features.js';
export { defineProjectTemplate, renderProjectTemplate, ProjectTemplates } from './template.js';
export { defineMapping } from './mapping.js';
export { verifyGenerated } from './verify.js';
export { ADDONS, workflowFor } from './addons.js';
export * as emit from './emit.js';
// The Common Semantic Model is the IR of js/ir.js (blocks -> operations); generators with engine 'ir' build on it.
export { buildIR as buildSemanticModel, parseExpr, irType } from '../ir.js';

export function defineGenerator(spec) {
  const missing = ['id', 'name', 'generate'].filter((k) => !spec[k]);
  if (missing.length) throw new Error('Generator is missing: ' + missing.join(', '));
  const bad = (spec.supports || []).filter((c) => !CAPABILITIES[c]);
  if (bad.length) throw new Error(`Generator ${spec.id}: unknown capabilities ${bad.join(', ')}`);
  const gen = {
    version: '1.0.0', language: [], platforms: [], supports: [], engine: 'ir', verify: {},
    views: ['data', 'logic', 'output'], configFields: [], defaultConfig: () => ({ type: spec.id }),
    ...spec,
  };
  if (spec.inherits) gen.supports = [...new Set([...(GeneratorRegistry.get(spec.inherits)?.supports || []), ...gen.supports])]; // inherited generator's capabilities come along
  // Contract: validate(project) -> { ok, problems }. Block support + capability check come for free;
  // a generator only adds its own rules through `check(project, cfg)`.
  gen.validate = (project) => {
    const cfg = targetConfig(project, gen.id) || gen.defaultConfig(project.name, project.name);
    const problems = [
      ...(gen.engine === 'data' ? [] : validateBlocks(project, gen.id)), // data generators work from models, not blocks
      ...(gen.engine === 'data' ? [] : missingCapabilities(project, gen)).map((m) => ({ msg: tf('{0} は機能「{1}」に対応していません({2})', gen.name.ja, m.capability, m.where), capability: m.capability })),
      ...(spec.check ? spec.check(project, cfg) : []),
    ];
    return { ok: !problems.some((p) => p.level !== 'info'), problems };
  };
  return GeneratorRegistry.register(gen);
}
hooks.defineGenerator = defineGenerator;

/** The manifest of a generator (what it is, what it can do) as plain JSON. */
export const manifestOf = (gen) => ({ id: gen.id, name: gen.name.en, version: gen.version, language: gen.language, platforms: gen.platforms, supports: gen.supports });

/**
 * validate -> generate. Result = GeneratedProject: { files, problems, root, entry, generator }
 *  files: { path: string | Uint8Array }   root: folder name for the ZIP   entry: file to show first
 */
export function runGenerator(project, genId, { addons = [] } = {}) {
  const gen = targets.get(genId);
  if (!gen) throw new Error('Unknown generator: ' + genId);
  const cfg = targetConfig(project, genId) || gen.defaultConfig(project.name, project.name);
  const pre = gen.validate(project).problems;
  const res = gen.generate(project, cfg);
  const files = { ...res.files };
  for (const id of addons) ADDONS.get(id)?.apply(files, { gen, project });
  return {
    files, root: res.root || null, entry: res.entry || null, ir: res.ir,
    problems: [...pre, ...(res.problems || []).filter((p) => !(p.unsupported && pre.some((q) => q.unsupported)))],
    generator: manifestOf(gen),
  };
}

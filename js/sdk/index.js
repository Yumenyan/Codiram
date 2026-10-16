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
//     validate?(project, cfg) -> problems, generate(project, cfg) -> { files, problems, root },
//   })
import { GeneratorRegistry, targets } from '../registry.js';
import { targetConfig } from '../model.js';
import { validateBlocks } from './validate.js';
import { CAPABILITIES } from './capabilities.js';

export { GeneratorRegistry, CAPABILITIES };
export { validateBlocks, compatSummary, unsupportedReason, walkBlocks } from './validate.js';

export function defineGenerator(spec) {
  const missing = ['id', 'name', 'generate'].filter((k) => !spec[k]);
  if (missing.length) throw new Error('Generator is missing: ' + missing.join(', '));
  const bad = (spec.supports || []).filter((c) => !CAPABILITIES[c]);
  if (bad.length) throw new Error(`Generator ${spec.id}: unknown capabilities ${bad.join(', ')}`);
  const gen = {
    version: '1.0.0', language: [], platforms: [], supports: [], engine: 'ir',
    views: ['data', 'logic', 'output'], configFields: [], defaultConfig: () => ({ type: spec.id }),
    ...spec,
  };
  return GeneratorRegistry.register(gen);
}

/** The manifest of a generator (what it is, what it can do) as plain JSON. */
export const manifestOf = (gen) => ({ id: gen.id, name: gen.name.en, version: gen.version, language: gen.language, platforms: gen.platforms, supports: gen.supports });

/** validate -> generate. Problems from block-support validation, the generator's own validate() and generate() are merged. */
export function runGenerator(project, genId) {
  const gen = targets.get(genId);
  if (!gen) throw new Error('Unknown generator: ' + genId);
  const cfg = targetConfig(project, genId) || gen.defaultConfig(project.name);
  const pre = gen.engine === 'blocks' ? [] : validateBlocks(project, genId);
  const own = gen.validate ? gen.validate(project, cfg) : [];
  const res = gen.generate(project, cfg);
  return { ...res, problems: [...pre, ...own, ...(res.problems || []).filter((p) => !(p.unsupported && pre.length))], generator: manifestOf(gen) };
}

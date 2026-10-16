// External generators: generator specs (pure data, see declarative.js) that live outside the Codiram source.
// They are kept in the browser (localStorage), can be exported / imported as `.codiram-generator.json`, and can also be
// shipped inside a plugin:  export default { id, name, generators: [ spec, ... ] }.
// A spec contains no code, so installing one cannot run anything on your machine.
import { GeneratorRegistry } from '../registry.js';
import { defineDeclarativeGenerator, validateSpec, SPEC_FORMAT } from './declarative.js';

const KEY = 'codiram.generators';
/** replaceable storage (tests run without a browser) */
export const storage = { get: () => { try { return localStorage.getItem(KEY); } catch { return null; } }, set: (v) => { try { localStorage.setItem(KEY, v); } catch { /* ignore */ } } };

export function userGenerators() {
  try { return JSON.parse(storage.get() || '[]'); } catch { return []; }
}
const save = (list) => storage.set(JSON.stringify(list));

/** validate, register and remember a spec. Built-in generators cannot be replaced. */
export function installGeneratorSpec(spec) {
  const errs = validateSpec(spec);
  if (errs.length) throw new Error(errs.join('\n'));
  const existing = GeneratorRegistry.get(spec.id);
  if (existing && !existing.external) throw new Error(`"${spec.id}" is a built-in generator id`);
  const gen = defineDeclarativeGenerator(spec);
  save([...userGenerators().filter((s) => s.id !== spec.id), spec]);
  return gen;
}

export function uninstallGenerator(id) {
  const g = GeneratorRegistry.get(id);
  if (g && !g.external) throw new Error(`"${id}" is a built-in generator`);
  GeneratorRegistry.unregister(id);
  save(userGenerators().filter((s) => s.id !== id));
}

/** register every saved generator at start-up; returns the ids that failed */
export function loadUserGenerators() {
  const failed = [];
  for (const spec of userGenerators()) {
    try { if (!GeneratorRegistry.get(spec.id)) defineDeclarativeGenerator(spec); } catch (e) { failed.push({ id: spec.id, error: e.message }); }
  }
  return failed;
}

export const exportSpec = (spec) => JSON.stringify(spec, null, 2) + '\n';
export function parseSpecFile(text) {
  const spec = JSON.parse(text);
  if (spec.format !== SPEC_FORMAT) throw new Error(`not a Codiram generator file (format must be "${SPEC_FORMAT}")`);
  return spec;
}

// Generator Definition: the JSON format the Generator Builder imports / exports.
//
//   { "format": "codiram-generator", "schemaVersion": 2,
//     "kind": "syntax" | "project",          // syntax = program source from rules; project = multi-file project (scaffold + optional source generator)
//     "extends": "<generator id>",           // optional: start from an installed declarative generator and override parts
//     "fragment": true,                      // optional: a PART (e.g. rust-io.json) merged into the definition with the same generator.id
//     "generator":  { id, name:{ja,en}, icon, desc:{ja,en}, version },
//     "target":     { language:[], platforms:[] },
//     "capabilities": [ capability ids ],
//     "types":       { true, false, null, toStr, toStrNum, toNum, toBool, varTypes:{ Number, String, Boolean } },
//     "expressions": { not, neg, concat, ops:{}, calls:{ contains, isEmpty, pow, random, ternary }, globalRef, localRef },
//     "statements":  { comment, globalDecl, set, log, call, wait, print, printInline, exit },
//     "io":          { readLine, arg, readFile, fileExists, writeFile, appendFile },
//     "conditions":  { ifOpen, elseOpen },  "loops": { repeatOpen },  "functions": { fnOpen, fnGlobals },
//     "events":      { mainOpen, mainClose },
//     "syntax":      { indent, close, emptyBody, keywords:[] },
//     "mappings":    { imports:{ use: line }, helpers:{ use: code } },
//     "templates":   { program:{ file, template }, files:{ path: text with {{vars}} } },
//     "scaffold":    { config:{}, configFields:[{key,label}], source:{ generator, dir, exclude:[] } },
//     "verify":      { requiredFiles, contains, json, build:{tool,args}, run:{tool,args} } }
//
// The internal form used by sdk/declarative.js is the flat "spec" (rules / program / files). normalizeDefinition()
// converts a definition (or an old v1 spec) to it, toDefinition() converts back for Export.
import { CAPABILITIES } from './capabilities.js';

export const FORMAT = 'codiram-generator';
export const SCHEMA_VERSION = 2;
export const KINDS = ['syntax', 'project'];

/** section -> the rule keys it holds (rule keys are unique across sections, so flattening is trivial) */
export const RULE_SECTIONS = {
  types: ['true', 'false', 'null', 'toStr', 'toStrNum', 'toNum', 'toBool', 'varTypes'],
  expressions: ['not', 'neg', 'concat', 'ops', 'calls', 'globalRef', 'localRef'],
  statements: ['comment', 'globalDecl', 'set', 'log', 'call', 'wait', 'print', 'printInline', 'exit'],
  io: ['readLine', 'arg', 'readFile', 'fileExists', 'writeFile', 'appendFile'],
  conditions: ['ifOpen', 'elseOpen'],
  loops: ['repeatOpen'],
  functions: ['fnOpen', 'fnGlobals'],
  events: ['mainOpen', 'mainClose'],
  syntax: ['indent', 'close', 'emptyBody', 'keywords'],
  mappings: ['imports', 'helpers'],
};
const OBJECT_RULES = new Set(['varTypes', 'ops', 'calls', 'imports', 'helpers']);
const TOP_KEYS = new Set(['format', 'schemaVersion', 'kind', 'extends', 'fragment', 'generator', 'target', 'capabilities', ...Object.keys(RULE_SECTIONS), 'templates', 'scaffold', 'verify', '$schema', 'comment']);
const ID = /^[a-z][a-z0-9-]{1,30}$/;

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const clone = (o) => JSON.parse(JSON.stringify(o));

/** structural check of a definition (v2). { errors, warnings } — unknown keys are warnings so newer files still import. */
export function validateDefinition(def) {
  const errors = [], warnings = [];
  if (!isObj(def)) return { errors: ['definition must be a JSON object'], warnings };
  if (def.format !== FORMAT) errors.push(`format must be "${FORMAT}"`);
  if (def.schemaVersion !== SCHEMA_VERSION) errors.push(`schemaVersion must be ${SCHEMA_VERSION}`);
  if (def.kind != null && !KINDS.includes(def.kind)) errors.push(`kind must be one of ${KINDS.join(', ')}`);
  for (const k of Object.keys(def)) if (!TOP_KEYS.has(k)) warnings.push(`unknown key "${k}" ignored`);
  if (!isObj(def.generator) || !ID.test(def.generator.id || '')) errors.push('generator.id: lowercase letters, digits and - (2–31 chars, starts with a letter)');
  if (def.capabilities != null) {
    if (!Array.isArray(def.capabilities)) errors.push('capabilities must be an array');
    else for (const c of def.capabilities) if (!CAPABILITIES[c]) errors.push(`unknown capability: ${c}`);
  }
  for (const [section, keys] of Object.entries(RULE_SECTIONS)) {
    const s = def[section];
    if (s == null) continue;
    if (!isObj(s)) { errors.push(`${section} must be an object`); continue; }
    for (const [k, v] of Object.entries(s)) {
      if (!keys.includes(k)) { warnings.push(`${section}.${k}: unknown rule ignored`); continue; }
      if (k === 'keywords') { if (!Array.isArray(v)) errors.push('syntax.keywords must be an array'); }
      else if (OBJECT_RULES.has(k)) { if (!isObj(v)) errors.push(`${section}.${k} must be an object`); }
      else if (typeof v !== 'string') errors.push(`${section}.${k} must be a string`);
    }
  }
  if (def.templates != null) {
    if (!isObj(def.templates)) errors.push('templates must be an object');
    else {
      if (def.templates.program && (typeof def.templates.program.file !== 'string' || typeof def.templates.program.template !== 'string')) errors.push('templates.program needs file and template (strings)');
      if (def.templates.files && !isObj(def.templates.files)) errors.push('templates.files must be an object (path -> text)');
    }
  }
  if (def.scaffold?.source && (typeof def.scaffold.source.generator !== 'string')) errors.push('scaffold.source.generator must be a generator id');
  return { errors, warnings };
}

/** Definition (v2) or old v1 spec -> internal spec (flat). Throws on structural errors. */
export function normalizeDefinition(def) {
  if (def && def.format === FORMAT && def.schemaVersion == null && def.id) return clone(def); // v1 spec: already internal
  const { errors } = validateDefinition(def);
  if (errors.length) throw new Error(errors.join('\n'));
  const g = def.generator || {};
  const spec = {
    format: FORMAT, formatVersion: 1, kind: def.kind || (def.scaffold?.source ? 'project' : 'syntax'),
    id: g.id, name: g.name || { ja: g.id, en: g.id }, icon: g.icon, desc: g.desc, version: g.version || '0.1.0',
    language: def.target?.language || [], platforms: def.target?.platforms || [], supports: def.capabilities || [],
    config: def.scaffold?.config || {}, configFields: def.scaffold?.configFields || [],
    rules: {}, program: def.templates?.program, files: def.templates?.files || {}, verify: def.verify || {},
  };
  if (def.scaffold?.source) spec.source = def.scaffold.source;
  if (def.extends) spec.extends = def.extends;
  for (const [section, keys] of Object.entries(RULE_SECTIONS)) for (const k of keys) if (def[section]?.[k] !== undefined) spec.rules[k] = clone(def[section][k]);
  if (!spec.program) delete spec.program;
  return spec;
}

/** internal spec -> Definition v2 (for Export) */
export function toDefinition(spec) {
  const def = { format: FORMAT, schemaVersion: SCHEMA_VERSION, kind: spec.kind || (spec.source ? 'project' : 'syntax') };
  if (spec.extends) def.extends = spec.extends;
  def.generator = { id: spec.id, name: spec.name, icon: spec.icon, desc: spec.desc, version: spec.version };
  def.target = { language: spec.language || [], platforms: spec.platforms || [] };
  def.capabilities = spec.supports || [];
  for (const [section, keys] of Object.entries(RULE_SECTIONS)) {
    const o = {};
    for (const k of keys) if (spec.rules?.[k] !== undefined) o[k] = clone(spec.rules[k]);
    if (Object.keys(o).length) def[section] = o;
  }
  def.templates = { ...(spec.program ? { program: spec.program } : {}), files: spec.files || {} };
  def.scaffold = { config: spec.config || {}, configFields: spec.configFields || [], ...(spec.source ? { source: spec.source } : {}) };
  def.verify = spec.verify || {};
  return def;
}

/** Merge a part (fragment) into a base definition: objects merge by key, arrays union, scalars override. */
export function mergeDefinition(base, part) {
  const out = clone(base);
  const merge = (a, b) => {
    for (const [k, v] of Object.entries(b)) {
      if (isObj(v) && isObj(a[k])) merge(a[k], v);
      else if (Array.isArray(v) && Array.isArray(a[k])) a[k] = [...new Set([...a[k], ...v])];
      else a[k] = clone(v);
    }
  };
  const { fragment, generator, ...rest } = part;
  void fragment;
  if (generator) merge(out.generator = out.generator || {}, generator);
  merge(out, rest);
  return out;
}

/**
 * Import any number of definition files (texts). One full definition + any number of fragments with the same
 * generator.id (rust-core.json + rust-io.json …) -> one internal spec. Order does not matter.
 * `resolve(id)` returns the definition of an installed generator, for `extends`.
 */
export function importDefinitions(texts, resolve = () => null) {
  const docs = texts.map((t, i) => { try { return typeof t === 'string' ? JSON.parse(t) : t; } catch (e) { throw new Error(`file ${i + 1}: invalid JSON (${e.message})`); } });
  for (const d of docs) { const { errors } = validateDefinition(d); if (errors.length) throw new Error(errors.join('\n')); }
  const full = docs.filter((d) => !d.fragment), parts = docs.filter((d) => d.fragment);
  if (full.length > 1) throw new Error('more than one full definition: mark the others with "fragment": true');
  let base = full[0];
  if (!base) {
    const first = parts[0];
    const parent = first?.extends && resolve(first.extends);
    if (!parent) throw new Error('no full definition among the files (a fragment needs a full definition or "extends")');
    base = { ...toDefinition(parent), generator: { ...toDefinition(parent).generator, ...first.generator }, extends: first.extends };
  } else if (base.extends) {
    const parent = resolve(base.extends);
    if (!parent) throw new Error(`extends "${base.extends}": no such declarative generator`);
    base = mergeDefinition(toDefinition(parent), { ...base, generator: { ...base.generator } });
  }
  const id = base.generator.id;
  for (const p of parts) {
    if (p.generator?.id && p.generator.id !== id) throw new Error(`fragment for "${p.generator.id}" does not match "${id}"`);
    base = mergeDefinition(base, p);
  }
  delete base.fragment;
  return normalizeDefinition(base);
}

/** Split a definition into fragments by section group (used for the documentation examples and tests). */
export function splitDefinition(def, groups) {
  const parts = [];
  const rest = clone(def);
  for (const [name, sections] of Object.entries(groups)) {
    const p = { format: FORMAT, schemaVersion: SCHEMA_VERSION, fragment: true, generator: { id: def.generator.id }, comment: name };
    for (const s of sections) if (rest[s] !== undefined) { p[s] = rest[s]; delete rest[s]; }
    parts.push(p);
  }
  return { core: rest, parts };
}

/** JSON Schema (draft-07) of the definition format, generated from the same tables the validator uses. */
export function buildJsonSchema() {
  const str = { type: 'string' }, strMap = { type: 'object', additionalProperties: str };
  const ruleSchema = (section, k) => (k === 'keywords' ? { type: 'array', items: str } : OBJECT_RULES.has(k) ? strMap : { ...str, description: `${section}.${k}` });
  const props = {
    $schema: str, comment: str,
    format: { const: FORMAT }, schemaVersion: { const: SCHEMA_VERSION },
    kind: { enum: KINDS, description: 'syntax: program source from rules. project: multi-file project (scaffold + optional source generator)' },
    extends: { type: 'string', description: 'id of an installed declarative generator to start from' },
    fragment: { type: 'boolean', description: 'a part merged into the definition with the same generator.id' },
    generator: { type: 'object', required: ['id'], properties: { id: { type: 'string', pattern: ID.source }, name: { type: 'object', properties: { ja: str, en: str } }, icon: str, desc: { type: 'object', properties: { ja: str, en: str } }, version: str } },
    target: { type: 'object', properties: { language: { type: 'array', items: str }, platforms: { type: 'array', items: str } } },
    capabilities: { type: 'array', items: { enum: Object.keys(CAPABILITIES) } },
  };
  for (const [section, keys] of Object.entries(RULE_SECTIONS)) props[section] = { type: 'object', properties: Object.fromEntries(keys.map((k) => [k, ruleSchema(section, k)])), additionalProperties: false };
  props.templates = { type: 'object', properties: { program: { type: 'object', required: ['file', 'template'], properties: { file: str, template: str } }, files: strMap } };
  props.scaffold = { type: 'object', properties: { config: { type: 'object' }, configFields: { type: 'array', items: { type: 'object', required: ['key'], properties: { key: str, label: str, ph: str } } },
    source: { type: 'object', required: ['generator'], properties: { generator: str, dir: str, exclude: { type: 'array', items: str } } } } };
  props.verify = { type: 'object', properties: { requiredFiles: { type: 'array', items: str }, contains: { type: 'object' }, json: { type: 'array', items: str },
    build: { type: 'object', properties: { tool: str, args: { type: 'array', items: str } } }, run: { type: 'object', properties: { tool: str, args: { type: 'array', items: str } } } } };
  return { $schema: 'http://json-schema.org/draft-07/schema#', title: 'Codiram Generator Definition', type: 'object', required: ['format', 'schemaVersion', 'generator'], properties: props };
}

// Declarative generators: a generator described ENTIRELY BY DATA (a "generator spec"), no code.
// This is what the Generator Builder edits, what external generator plugins are, and what scaffolds contain.
//
//   spec = { format:'codiram-generator', formatVersion:1, id, name:{ja,en}, icon, desc:{ja,en}, version,
//            language:[..], platforms:[..], supports:[capabilities], config:{ key: default, ... },
//            rules:{ ...how each operation is written in the target language... },
//            program:{ file, template },      // the main source file; {{imports}} {{helpers}} {{globals}} {{functions}} {{main}}
//            files:{ path: 'text with {{vars}}' },  // the rest of the project template
//            verify:{ requiredFiles, build?:{tool,args}, run?:{tool,args} } }
//
// The engine walks the Common Semantic Model (IR) and fills the rule templates, so the next generator costs a spec.
import { defineGenerator, defineProjectTemplate, renderProjectTemplate, buildSemanticModel, irType, emit } from './index.js';
import { CAPABILITIES } from './capabilities.js';
import { GeneratorRegistry, hooks } from '../registry.js';
import { targetConfig } from '../model.js';
import { J } from '../i18n-helpers.js';
import '../targets/rust/blocks.js'; // console / file blocks (shared by every generator that declares cli / io / filesystem)
import './common-ir.js';

export const SPEC_FORMAT = 'codiram-generator';
const ID = /^[a-z][a-z0-9-]{1,30}$/;
const RULES_REQUIRED = ['comment', 'globalDecl', 'set', 'ifOpen', 'elseOpen', 'repeatOpen', 'call', 'fnOpen', 'log'];
const PROGRAM_SLOTS = ['functions', 'main'];
/** rules that a capability needs */
const CAP_RULES = { io: ['print', 'readLine'], cli: ['arg', 'exit'], filesystem: ['readFile', 'writeFile', 'appendFile', 'fileExists'] };

export function validateSpec(spec) {
  const errs = [];
  if (!spec || spec.format !== SPEC_FORMAT) return [`format must be "${SPEC_FORMAT}"`];
  if (!ID.test(spec.id || '')) errs.push('id: lowercase letters, digits and - (2–31 chars, starts with a letter)');
  if (!spec.name?.ja && !spec.name?.en) errs.push('name is empty');
  if (!/^\d+\.\d+\.\d+/.test(spec.version || '')) errs.push('version must look like 1.0.0');
  for (const c of spec.supports || []) if (!CAPABILITIES[c]) errs.push(`unknown capability: ${c}`);
  const rules = spec.rules || {};
  for (const k of RULES_REQUIRED) if (!rules[k]) errs.push(`rules.${k} is required`);
  if (!spec.program?.file) errs.push('program.file is required');
  for (const s of PROGRAM_SLOTS) if (!(spec.program?.template || '').includes(`{{${s}}}`)) errs.push(`program.template must contain {{${s}}}`);
  for (const cap of spec.supports || []) for (const k of CAP_RULES[cap] || []) if (!rules[k]) errs.push(`capability "${cap}" needs rules.${k}`);
  const files = { ...(spec.files || {}), [spec.program?.file || '']: spec.program?.template || '' };
  if (!(spec.verify?.requiredFiles || []).every((f) => f in files || f === 'codiram.project.json')) errs.push('verify.requiredFiles lists a file the template does not create');
  return errs;
}

const fill = (tpl, vars) => String(tpl).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));

/** IR -> { program source pieces, problems } following spec.rules */
export function emitProgram(ir, spec, project) {
  const R = spec.rules, problems = [], uses = new Set();
  const unit = R.indent ?? '    ';
  const bracy = (R.close ?? '') !== '';
  const q = (v) => '"' + emit.escapeString(v) + '"';
  const need = (rule, what) => { if (R[rule] == null) { problems.push({ msg: `${spec.id}: rules.${rule} が未定義です(${what})` }); return false; } return true; };
  const gname = emit.identifierNamer({ keywords: new Set(R.keywords || []) });
  const globals = new Map(ir.variables.filter((v) => ['Number', 'String', 'Boolean'].includes(v.type)).map((v) => [v.name, gname(v.name, 'var')]));
  const fnName = emit.identifierNamer({ keywords: new Set(R.keywords || []) });
  const fns = new Map(ir.functions.map((f) => [f.fnName, { id: fnName(f.fnName, 'func'), params: f.params }]));
  const handlerName = emit.identifierNamer({ keywords: new Set([...(R.keywords || []), 'main']) });
  let counter = 0, assigned = null;

  const str = (e) => { if (irType(e) === 'str') return x(e); if (irType(e) === 'num' && R.toStrNum) { uses.add('toStrNum'); return fill(R.toStrNum, { a: x(e) }); } return fill(R.toStr || '{a}', { a: x(e) }); };
  const num = (e) => { if (irType(e) === 'num') return x(e); uses.add('toNum'); return fill(R.toNum || '{a}', { a: x(e) }); };
  const bool = (e) => (irType(e) === 'bool' ? x(e) : fill(R.toBool || '{a}', { a: x(e) }));
  const op = (o) => (R.ops && R.ops[o]) || o;
  function x(e) {
    switch (e.k) {
      case 'num': return String(e.v);
      case 'str': return q(e.v);
      case 'bool': return e.v ? (R.true || 'true') : (R.false || 'false');
      case 'var': {
        if (e.scope === 'local') return fill(R.localRef || '{name}', { name: emit.snakeCase(e.name) || 'arg' });
        return fill(R.globalRef || '{name}', { name: globals.get(e.name) || e.name });
      }
      case 'un': return e.op === '!' ? fill(R.not || '!{a}', { a: bool(e.a) }) : fill(R.neg || '-{a}', { a: num(e.a) });
      case 'bin': {
        if (e.op === '&&' || e.op === '||') return `(${bool(e.a)} ${op(e.op)} ${bool(e.b)})`;
        if (e.op === '+' && (irType(e.a) === 'str' || irType(e.b) === 'str')) return `(${str(e.a)}${R.concat || ' + '}${str(e.b)})`;
        if (e.op === '==' || e.op === '!=') return `(${x(e.a)} ${op(e.op)} ${x(e.b)})`;
        return `(${num(e.a)} ${op(e.op)} ${num(e.b)})`;
      }
      case 'call': {
        const a = e.args || [];
        if (e.fn === 'concat') return `(${a.map(str).join(R.concat || ' + ')})`;
        if (e.fn === 'bool') return bool(a[0]);
        if (e.fn === 'num') return num(a[0]);
        const t = R.calls?.[e.fn];
        if (!t) { problems.push({ msg: `${spec.id}: rules.calls.${e.fn} が未定義です` }); return '0'; }
        uses.add(e.fn);
        const v = { a: a[0] ? x(a[0]) : '', b: a[1] ? x(a[1]) : '', c: a[2] ? x(a[2]) : '' };
        if (e.fn === 'ternary') v.a = bool(a[0]);
        if (e.fn === 'contains' || e.fn === 'isEmpty') { v.a = str(a[0]); v.b = a[1] ? str(a[1]) : ''; }
        if (e.fn === 'random' || e.fn === 'pow') { v.a = num(a[0]); v.b = num(a[1]); }
        return fill(t, v);
      }
      case 'cli': {
        const a = e.args || [], rule = { readLine: 'readLine', arg: 'arg', readFile: 'readFile', fileExists: 'fileExists' }[e.fn];
        if (!need(rule, e.fn)) return '""';
        uses.add(rule);
        return fill(R[rule], { a: a[0] ? (e.fn === 'arg' ? num(a[0]) : str(a[0])) : '' });
      }
      default: problems.push({ msg: `unsupported expression: ${e.k}` }); return '0';
    }
  }
  const stmts = (list, d, out = []) => {
    const before = out.length;
    for (const s of list) st(s, d, out);
    if (out.length === before && R.emptyBody) out.push(unit.repeat(d) + R.emptyBody);
    return out;
  };
  function st(s, d, out) {
    const p = unit.repeat(d), push = (...l) => out.push(...l.map((v) => p + v));
    switch (s.op) {
      case 'comment': push(fill(R.comment, { text: String(s.text).replace(/[\r\n]+/g, ' ') })); break;
      case 'log': push(fill(R.log, { value: str(s.value) })); break;
      case 'cli.print':
        if (!need(s.newline ? 'print' : 'printInline', 'print')) break;
        push(fill(s.newline ? R.print : R.printInline, { value: str(s.value) })); break;
      case 'set': {
        const target = x(s.var);
        if (assigned && s.var.scope === 'global') assigned.add(globals.get(s.var.name));
        push(fill(R.set, { target, value: s.var.type === 'Number' ? num(s.value) : s.var.type === 'Boolean' ? bool(s.value) : str(s.value) })); break;
      }
      case 'if':
        push(fill(R.ifOpen, { cond: emit.unparen(bool(s.cond)) })); stmts(s.then, d + 1, out);
        if (s.else.length) { push(R.elseOpen); stmts(s.else, d + 1, out); }
        if (bracy) push(R.close);
        break;
      case 'repeat': push(fill(R.repeatOpen, { i: '_i' + ++counter, count: emit.unparen(num(s.count)) })); stmts(s.body, d + 1, out); if (bracy) push(R.close); break;
      case 'wait': if (!need('wait', 'wait')) break; uses.add('wait'); push(fill(R.wait, { ms: emit.unparen(num(s.ms)) })); break;
      case 'call': {
        const f = fns.get(s.fn);
        if (!f) { problems.push({ block: s.block, msg: `関数「${s.fn}」が定義されていません` }); break; }
        if (s.args.length !== f.params.length) problems.push({ block: s.block, msg: `関数「${s.fn}」の引数は ${f.params.length} 個です(${s.args.length} 個指定)` });
        push(fill(R.call, { fn: f.id, args: f.params.map((_, i) => (s.args[i] ? x(s.args[i]) : R.null || 'null')).join(', ') })); break;
      }
      case 'cli.exit': if (need('exit', 'exit')) { uses.add('exit'); push(fill(R.exit, { code: num(s.code) })); } break;
      case 'cli.write_file': {
        const rule = s.append ? 'appendFile' : 'writeFile';
        if (need(rule, rule)) { uses.add(rule); push(fill(R[rule], { path: str(s.path), text: str(s.text) })); }
        break;
      }
      default: problems.push({ msg: `unsupported statement: ${s.op}` });
    }
  }
  const block = (open, body, params = '') => {
    const out = [];
    assigned = new Set();
    const lines = stmts(body, 1);
    if (R.fnGlobals && assigned.size) out.push(unit + fill(R.fnGlobals, { names: [...assigned].join(', ') }));
    out.push(...lines);
    return [fill(open, { params }), ...out, ...(bracy ? [R.close] : []), ''];
  };
  const functions = [];
  for (const f of ir.functions) {
    const info = fns.get(f.fnName);
    functions.push(...block(R.fnOpen.replace('{name}', info.id), f.body, f.params.map((q2) => emit.snakeCase(q2) || 'arg').join(', ')));
  }
  const handlers = ir.handlers.filter((h) => h.kind === 'main').map((h) => ({ h, id: handlerName(/^[ -~]+$/.test(h.name || '') ? h.name : 'on_start', 'on_start') }));
  for (const { h, id } of handlers) functions.push(...block(R.fnOpen.replace('{name}', id), h.body));
  const callMain = handlers.map(({ id }) => fill(R.call, { fn: id, args: '' }));
  const main = R.mainOpen ? [R.mainOpen, ...callMain.map((l) => unit + l), ...(R.mainClose ? [R.mainClose] : [])] : callMain;
  if (!handlers.length) problems.push({ msg: '「プログラムが開始されたとき」のスクリプトがありません(何も実行されません)', level: 'info' });

  const globalLines = ir.variables.filter((v) => globals.has(v.name)).map((v) => fill(R.globalDecl, {
    name: globals.get(v.name),
    value: v.type === 'Number' ? String(Number(v.initial) || 0) : v.type === 'Boolean' ? (String(v.initial) === 'true' ? (R.true || 'true') : (R.false || 'false')) : q(v.initial ?? ''),
  }));
  const usedKeys = [...uses];
  const imports = [...new Set(usedKeys.map((u) => R.imports?.[u]).filter(Boolean))];
  const helpers = [...new Set(usedKeys.map((u) => R.helpers?.[u]).filter(Boolean))];
  return {
    pieces: { imports: imports.join('\n'), helpers: helpers.join('\n\n'), globals: globalLines.join('\n'), functions: functions.join('\n').replace(/\n+$/, ''), main: main.join('\n') },
    problems,
  };
}

/** Spec -> { files, problems, ... } for a project whose generator (spec.id) is registered. */
function generateFromSpec(spec, project, cfg) {
  const tplId = 'decl:' + spec.id;
  const cfgDefaults = { ...(spec.config || {}) };
  cfg = cfg || targetConfig(project, spec.id) || { type: spec.id, ...cfgDefaults };
  const ir = buildSemanticModel(project, spec.id);
  const { pieces, problems } = emitProgram(ir, spec, project);
  const files = renderProjectTemplate(tplId, { ...cfgDefaults, ...cfg, name: project.name, slug: emit.slug(project.name, '_') || 'app', ...pieces });
  files[spec.program.file] = files[spec.program.file].replace(/\n{3,}/g, '\n\n'); // empty {{imports}} / {{helpers}} slots leave gaps
  files['codiram.project.json'] = emit.projectFile(project);
  return { files, problems: [...ir.problems.filter((p) => !p.unsupported), ...problems], root: emit.slug(project.name, '-') || 'app', entry: spec.program.file, ir };
}

/** Registers a generator described by a spec. Returns the generator. `spec.draft` = Builder preview (hidden). */
export function defineDeclarativeGenerator(spec) {
  const errs = validateSpec(spec);
  if (errs.length) throw new Error(`Generator spec "${spec?.id}": ${errs.join('; ')}`);
  defineProjectTemplate('decl:' + spec.id, { ...(spec.files || {}), [spec.program.file]: spec.program.template }, spec.name.en || spec.id);
  const cfgDefaults = { ...(spec.config || {}) };
  return defineGenerator({
    id: spec.id, order: spec.order ?? 5, portable: true, external: !spec.builtin && !spec.draft, hidden: !!spec.draft, spec,
    name: { ja: spec.name.ja || spec.name.en, en: spec.name.en || spec.name.ja },
    icon: spec.icon || '⚙', desc: spec.desc || J('', ''),
    version: spec.version, language: spec.language || [], platforms: spec.platforms || [], supports: spec.supports || [],
    views: ['data', 'logic', 'output'],
    defaultConfig: () => ({ type: spec.id, ...cfgDefaults }),
    configFields: (spec.configFields || []).map((f) => ({ key: f.key, label: { ja: f.label, en: f.label }, ph: f.ph })),
    generate: (project, cfg) => generateFromSpec(spec, project, cfg),
    lint: (project) => buildSemanticModel(project, spec.id).problems.filter((p) => !p.unsupported).map((p) => ({ script: p.script, block: p.block, msg: p.msg })),
    verify: spec.verify || {},
  });
}
hooks.defineDeclarativeGenerator = defineDeclarativeGenerator;

/** Generate a sample project with a spec without keeping the generator registered (Generator Builder preview). */
export function previewSpec(spec, project) {
  const errors = validateSpec(spec);
  if (errors.length) return { errors };
  const draft = { ...spec, id: 'preview-draft', draft: true };
  try {
    defineDeclarativeGenerator(draft);
    const p = JSON.parse(JSON.stringify(project));
    p.targets = [{ type: 'preview-draft', ...(spec.config || {}) }]; p.activeTarget = 'preview-draft';
    const res = generateFromSpec(draft, p);
    const v = GeneratorRegistry.get('preview-draft').validate(p).problems;
    return { errors: [], files: res.files, entry: res.entry, problems: [...v, ...res.problems] };
  } finally { GeneratorRegistry.unregister('preview-draft'); }
}

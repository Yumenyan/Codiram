// "Process data" import / export: scripts, variables and data models as plain, human- and AI-friendly JSON.
// An AI (or a person) writes this JSON; Codiram turns it into blocks, so the logic is shown as readable blocks.
//
//   { "format": "codiram-process", "version": 1,
//     "variables": [{ "name": "count", "type": "Number", "initial": "0" }],
//     "models":    [{ "name": "Memo", "fields": [{ "name": "text", "type": "String" }], "rows": [{ "text": "buy milk" }] }],
//     "scripts":   [{ "name": "Add one", "hat": { "type": "onClick", "target": "Button1" },
//                     "body": [ { "type": "change_var", "name": "count", "by": "1" },
//                               { "type": "if", "cond": "count > 3", "then": [ { "type": "set_var", "name": "msg", "value": "\"big\"" } ] },
//                               { "type": "repeat", "times": "3", "body": [ ... ] } ] }] }
//
// * a block = { type, ...fields } (or { type, args: {...} }); blocks with slots take arrays under the slot names (then / else / body ...)
// * "cond": "count > 3 and name != \"\"" is a shortcut for the condition editor
// * a value block inside a field: { "$": "text_join", "a": "\"Hi \"", "b": "name" }
// * components / pages / models / variables / functions can be named instead of using ids
import { blocks, blockSupports, activeTargetId } from './registry.js';
import { allNodes, newBlock, newScript, newModel, defaultInitial, VAR_TYPES, FIELD_TYPES } from './model.js';
import { uid } from './util.js';

export const PROCESS_FORMAT = 'codiram-process';

const OPS = [['==', '=='], ['!=', '!='], ['>=', '>='], ['<=', '<='], ['>', '>'], ['<', '<'], ['contains', 'contains']];
/** "a > 1 and b == 2" -> condition object; null when it cannot be read */
export function parseCond(text) {
  const src = String(text).trim();
  if (!src) return null;
  let join = 'and', parts = src.split(/\s+and\s+/i);
  if (parts.length === 1 && /\s+or\s+/i.test(src)) { join = 'or'; parts = src.split(/\s+or\s+/i); }
  let not = false;
  const rows = parts.map((p) => {
    let s = p.trim();
    if (/^not\s+/i.test(s) && parts.length === 1) { not = true; s = s.replace(/^not\s+/i, ''); }
    let m = /^(.*?)\s+is\s+(empty|not empty|true)$/i.exec(s);
    if (m) return { l: m[1].trim(), op: { empty: 'empty', 'not empty': 'notempty', true: 'true' }[m[2].toLowerCase()], r: '' };
    for (const [tok, op] of OPS) {
      const i = tok === 'contains' ? s.search(/\s+contains\s+/) : s.indexOf(tok);
      if (i > 0) { return { l: s.slice(0, i).trim(), op, r: s.slice(i + (tok === 'contains' ? s.match(/\s+contains\s+/)[0].length : tok.length)).trim() }; }
    }
    return { l: s, op: 'true', r: '' };
  });
  return { rows, join, not };
}

const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
const suggest = (type) => [...blocks.keys()].map((k) => [k, lev(type, k)]).sort((a, b) => a[1] - b[1]).slice(0, 3).filter((x) => x[1] <= 4).map((x) => x[0]);

/**
 * Convert process JSON into pieces for the project. Never throws for content problems: returns { errors, warnings, result }.
 * result = { variables, models, scripts } ready to be added (null when there are errors).
 */
export function readProcess(data, project) {
  const errors = [], warnings = [];
  if (!data || typeof data !== 'object') return { errors: ['JSON のオブジェクトではありません'], warnings, result: null };
  if (data.format && data.format !== PROCESS_FORMAT) errors.push(`format は "${PROCESS_FORMAT}" にしてください`);
  const tid = activeTargetId(project);
  const nodes = allNodes(project);
  const byName = (list, v) => list.find((x) => x.name === v || x.id === v);
  const newVars = [], newModels = [];
  const varNames = new Set([...project.variables.map((v) => v.name)]);
  for (const v of data.variables || []) {
    if (!v.name) { errors.push('variables: name がありません'); continue; }
    const type = VAR_TYPES.includes(v.type) ? v.type : 'String';
    if (v.type && !VAR_TYPES.includes(v.type)) warnings.push(`変数「${v.name}」: 型 ${v.type} は使えません(String にしました)`);
    if (varNames.has(v.name)) { warnings.push(`変数「${v.name}」は既にあります(そのまま使います)`); continue; }
    varNames.add(v.name);
    newVars.push({ name: v.name, type, initial: v.initial !== undefined ? String(v.initial) : defaultInitial(type) });
  }
  const modelNames = new Set(project.models.map((m) => m.name));
  for (const m of data.models || []) {
    if (!m.name) { errors.push('models: name がありません'); continue; }
    if (modelNames.has(m.name)) { warnings.push(`モデル「${m.name}」は既にあります(スキップ)`); continue; }
    modelNames.add(m.name);
    const model = newModel({ models: [] }, m.name);
    model.fields = (m.fields || []).map((f) => ({ name: f.name, type: FIELD_TYPES.includes(f.type) ? f.type : 'String', ...(f.options ? { options: f.options } : {}), ...(f.ref ? { ref: f.ref } : {}) }));
    if (!model.fields.length) model.fields = [{ name: 'id', type: 'Number' }, { name: 'name', type: 'String' }];
    model.rows = (m.rows || []).map((r, i) => ({ _id: r._id ?? i + 1, ...r }));
    newModels.push(model);
  }
  const fnNames = new Set(project.scripts.filter((s) => s.hat.type === 'onFunction' && s.hat.args.name).map((s) => s.hat.args.name));
  for (const s of data.scripts || []) if (s.hat?.type === 'onFunction' && s.hat.name) fnNames.add(s.hat.name);

  const resolveField = (def, key, value, where) => {
    const f = def.fields?.[key];
    if (!f || typeof value !== 'string') return value;
    if (f.t === 'comp') { if (value === '@it' || value === '@me') return value; const n = byName(nodes.map((x) => x.node), value); if (!n) errors.push(`${where}: 部品「${value}」が見つかりません`); return n ? n.id : value; }
    if (f.t === 'page') { const p = byName(project.pages, value); if (!p) errors.push(`${where}: ページ「${value}」が見つかりません`); return p ? p.id : value; }
    if (f.t === 'model' && value && !modelNames.has(value)) errors.push(`${where}: データモデル「${value}」がありません`);
    if (f.t === 'var' && value && !varNames.has(value)) errors.push(`${where}: 変数「${value}」が定義されていません(variables に追加してください)`);
    if (f.t === 'fn' && value && !fnNames.has(value)) errors.push(`${where}: 関数「${value}」が定義されていません`);
    return value;
  };
  const value = (v, where) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (v.$b) return v; // already internal
      if (typeof v.$ === 'string') { // value block shorthand
        const d = blocks.get(v.$);
        if (!d) { errors.push(`${where}: 値ブロック「${v.$}」は存在しません`); return ''; }
        const { $, ...rest } = v;
        const args = { ...(d.defaults || {}) };
        for (const [k, x] of Object.entries(rest)) args[k] = resolveField(d, k, value(x, where), where);
        return { $b: { id: uid('r'), type: v.$, args } };
      }
    }
    return v;
  };
  const block = (b, where) => {
    const def = blocks.get(b.type);
    if (!def) { const s = suggest(b.type); errors.push(`${where}: ブロック「${b.type}」は存在しません${s.length ? '(もしかして: ' + s.join(', ') + ')' : ''}`); return null; }
    if (!blockSupports(def, tid)) warnings.push(`${where}: 「${def.title}」は現在のターゲットでは使えません`);
    const slotKeys = (def.slots || []).map((x) => x.key);
    const args = { ...(def.defaults || {}), ...(b.args || {}) };
    for (const [k, v] of Object.entries(b)) {
      if (['type', 'args', 'id', 'comment', ...slotKeys].includes(k)) continue;
      if (k === 'cond' && typeof v === 'string' && def.fields?.cond) { const c = parseCond(v); if (!c) errors.push(`${where}: 条件「${v}」を読み取れません`); else args.cond = c; continue; }
      if (def.fields && !(k in def.fields)) warnings.push(`${where}: 「${def.title}」に項目「${k}」はありません(無視)`);
      args[k] = v;
    }
    for (const k of Object.keys(args)) args[k] = resolveField(def, k, value(args[k], where), where);
    const out = newBlock(b.type, args);
    for (const key of slotKeys) if (Array.isArray(b[key])) out.slots[key] = b[key].map((x, i) => block(x, `${where} › ${key}[${i + 1}]`)).filter(Boolean);
    return out;
  };

  const scripts = [];
  for (const [i, s] of (data.scripts || []).entries()) {
    const where = `スクリプト${i + 1}${s.name ? '「' + s.name + '」' : ''}`;
    if (!s.hat?.type) { errors.push(`${where}: hat.type がありません`); continue; }
    const hdef = blocks.get(s.hat.type);
    if (!hdef || hdef.kind !== 'hat') { const sg = suggest(s.hat.type); errors.push(`${where}: イベントブロック「${s.hat.type}」は存在しません${sg.length ? '(もしかして: ' + sg.join(', ') + ')' : ''}`); continue; }
    if (!blockSupports(hdef, tid)) warnings.push(`${where}: 「${hdef.title}」は現在のターゲットでは使えません`);
    const { type, args: hargs, ...flat } = s.hat;
    const args = { ...(hdef.defaults || {}), ...(hargs || {}), ...flat };
    for (const k of Object.keys(args)) args[k] = resolveField(hdef, k, args[k], where);
    const page = (s.page && byName(project.pages, s.page)) || project.pages[0];
    const script = newScript(project, page.id, type, args);
    script.name = s.name || '';
    script.body = (s.body || []).map((b, j) => block(b, `${where} › ${j + 1}`)).filter(Boolean);
    scripts.push(script);
  }
  return { errors, warnings, result: errors.length ? null : { variables: newVars, models: newModels, scripts } };
}

/** add the result of readProcess to a project draft (use inside commit()) */
export function applyProcess(project, result, { replace = false } = {}) {
  project.variables.push(...result.variables);
  project.models.push(...result.models);
  for (const s of result.scripts) {
    if (replace && s.name) project.scripts = project.scripts.filter((x) => x.name !== s.name);
    project.scripts.push(s);
  }
}

const unresolve = (def, key, v, project) => {
  const f = def?.fields?.[key];
  if (!f || typeof v !== 'string') return v;
  if (f.t === 'comp') return allNodes(project).find((x) => x.node.id === v)?.node.name || v;
  if (f.t === 'page') return project.pages.find((p) => p.id === v)?.name || v;
  return v;
};
const condText = (c) => c.rows.map((r) => ({ empty: `${r.l} is empty`, notempty: `${r.l} is not empty`, true: `${r.l} is true` }[r.op] || `${r.l} ${r.op} ${r.r}`)).join(c.join === 'or' ? ' or ' : ' and ');
/** project -> readable process JSON (names instead of ids; round-trips through readProcess) */
export function exportProcess(project) {
  const value = (v, def, key) => {
    if (v && typeof v === 'object' && v.$b) { const d = blocks.get(v.$b.type); return { $: v.$b.type, ...Object.fromEntries(Object.entries(v.$b.args).filter(([, x]) => x !== '').map(([k, x]) => [k, value(x, d, k)])) }; }
    return unresolve(def, key, v, project);
  };
  const block = (b) => {
    const def = blocks.get(b.type), out = { type: b.type };
    for (const [k, v] of Object.entries(b.args)) {
      if (k === 'cond' && v && v.rows) { out.cond = condText(v); continue; }
      if (v === '' || (v && typeof v === 'object' && !v.$b && !Object.keys(v).length)) continue;
      out[k] = value(v, def, k);
    }
    for (const [k, list] of Object.entries(b.slots || {})) if (list.length) out[k] = list.map(block);
    return out;
  };
  return {
    format: PROCESS_FORMAT, version: 1,
    variables: project.variables.map((v) => ({ name: v.name, type: v.type, initial: v.initial })),
    models: project.models.map((m) => ({ name: m.name, fields: m.fields, rows: m.rows.map(({ _id, ...r }) => r) })),
    scripts: project.scripts.map((s) => {
      const def = blocks.get(s.hat.type);
      return { name: s.name || undefined, page: project.pages.find((p) => p.id === s.page)?.name, hat: { type: s.hat.type, ...Object.fromEntries(Object.entries(s.hat.args).map(([k, v]) => [k, unresolve(def, k, v, project)])) }, body: s.body.map(block) };
    }),
  };
}

export const PROCESS_DOC = `# Process JSON ("codiram-process")

Import it with Tools → Import process data. Codiram converts it into blocks.

\`\`\`json
{ "format": "codiram-process", "version": 1,
  "variables": [ { "name": "count", "type": "Number", "initial": "0" } ],
  "models": [ { "name": "Memo", "fields": [ { "name": "text", "type": "String" } ], "rows": [ { "text": "buy milk" } ] } ],
  "scripts": [ {
    "name": "Add one",
    "hat": { "type": "onClick", "target": "Button1" },
    "body": [
      { "type": "change_var", "name": "count", "by": "1" },
      { "type": "if", "cond": "count > 3 and name != \\"\\"", "then": [ { "type": "set_var", "name": "msg", "value": "\\"big\\"" } ], "else": [] },
      { "type": "repeat", "times": "3", "body": [ { "type": "set_var", "name": "msg", "value": { "$": "text_join", "a": "\\"n=\\"", "b": "count" } } ] }
    ] } ] }
\`\`\`

* block = \`{ "type": <block type>, ...fields }\`; slots (then / else / body ...) are arrays of blocks.
* field values are expression texts (strings): \`"count + 1"\`, \`"\\"text\\""\`; a value block is \`{ "$": "<reporter type>", ...fields }\`.
* \`cond\` is text: \`a > 1\`, \`x == "a" or y is empty\`, operators == != >= <= > < contains, "is empty", "is not empty", "is true".
* components, pages, models, variables and functions are referenced by NAME. Variables must be declared in "variables" (or already exist).
* the available block types and their fields are listed in blocks-<generator>.md of the AI pack.
`;

// Project data model + helpers. A project is plain JSON:
// { pages:[{id,name,root:Node}], models:[{id,name,fields,rows}], variables:[], scripts:[] }
import { uid, clone, sanitizeIdent } from './util.js';
import { components, blocks, blockSupports, targets, activeTargetId } from './registry.js';
import { tf, t as tt } from './i18n.js';

export const FIELD_TYPES = ['String', 'Number', 'Boolean', 'Date', 'Array', 'Object', 'Enum', 'Relation'];
export const VAR_TYPES = ['String', 'Number', 'Boolean'];

export function newPage(name, id) {
  return {
    id: id || uid('pg'),
    name,
    root: { id: uid('c'), type: 'page', name: 'Page', props: {}, style: { padding: '24', gap: '12' }, children: [] },
  };
}

/** Project format version. 1 = Web only (no targets), 2 = targets[] + activeTarget. */
export const PROJECT_VERSION = 2;

export function emptyProject(name = 'Untitled Project', targetCfg = { type: 'web' }) {
  return {
    v: 1, version: PROJECT_VERSION, targets: [targetCfg], activeTarget: targetCfg.type, id: uid('p'), name, created: Date.now(), updated: Date.now(),
    settings: { title: name },
    pages: [newPage('Main', 'main')],
    models: [], variables: [], scripts: [], assets: [],
  };
}

/** Fill in fields added in later versions so old saved projects keep working. */
export function normalizeProject(p) {
  if (!p.targets || !p.targets.length) p.targets = [{ type: 'web' }]; // version-1 projects are Web projects
  if (!p.activeTarget || !p.targets.some((t) => t.type === p.activeTarget)) p.activeTarget = p.targets[0].type;
  p.version = PROJECT_VERSION;
  p.assets = p.assets || [];
  p.settings = p.settings || {};
  p.variables = p.variables || [];
  return p;
}

/** assets/<name> -> data URL (editor / preview), anything else unchanged */
export function assetUrl(project, src) {
  if (typeof src === 'string' && src.startsWith('assets/')) {
    const a = (project.assets || []).find((x) => 'assets/' + x.name === src);
    if (a) return a.data;
  }
  return src;
}

export function newModel(project, name = 'Model') {
  let n = 1, nm = name;
  const names = new Set(project.models.map((m) => m.name));
  while (names.has(nm)) nm = name + ++n;
  return {
    id: uid('m'), name: nm,
    fields: [{ name: 'id', type: 'Number' }, { name: 'name', type: 'String' }],
    rows: [],
  };
}

export const nextRowId = (model) => model.rows.reduce((m, r) => Math.max(m, r._id || 0), 0) + 1;

export function defaultFor(type) {
  return type === 'Number' ? 0 : type === 'Boolean' ? false : type === 'Array' ? [] : type === 'Object' ? {} : type === 'Relation' ? null : '';
}

// ---------- node tree ----------
export function walk(node, fn, parent = null) {
  fn(node, parent);
  (node.children || []).forEach((c) => walk(c, fn, node));
}

export function allNodes(project) {
  const out = [];
  for (const page of project.pages) walk(page.root, (node, parent) => out.push({ node, parent, page }));
  return out;
}

export function findNode(project, id) {
  for (const page of project.pages) {
    let hit = null;
    walk(page.root, (node, parent) => {
      if (!hit && node.id === id) hit = { node, parent, page, index: parent ? parent.children.indexOf(node) : 0 };
    });
    if (hit) return hit;
  }
  return null;
}

export function uniqueName(project, base, extraTaken = new Set()) {
  const taken = new Set(extraTaken);
  allNodes(project).forEach(({ node }) => taken.add(node.name));
  const b = sanitizeIdent(base);
  let n = 1;
  while (taken.has(b + n)) n++;
  return b + n;
}

export function createNode(project, type) {
  const def = components.get(type);
  const d = def.defaults || {};
  return {
    id: uid('c'), type,
    name: uniqueName(project, def.label.replace(/\s+/g, '')),
    props: clone(d.props || {}), style: clone(d.style || {}),
    children: [],
  };
}

/** Deep copy with new ids and project-unique names (for duplicate / paste / library insert). */
/** Copy a page (nodes get new ids/names; the page's scripts are copied and re-pointed at the new nodes). */
export function duplicatePage(project, pageId) {
  const src = project.pages.find((x) => x.id === pageId);
  if (!src) return null;
  const root = freshClone(project, src.root);
  const idMap = new Map();
  const pair = (a, b) => { idMap.set(a.id, b.id); (a.children || []).forEach((c, i) => pair(c, b.children[i])); };
  pair(src.root, root);
  const page = { id: uid('pg'), name: src.name + ' (copy)', root };
  idMap.set(src.id, page.id);
  const remap = (v) => {
    if (typeof v === 'string') return idMap.has(v) ? idMap.get(v) : v;
    if (Array.isArray(v)) return v.map(remap);
    if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = k === 'id' ? uid('b') : remap(v[k]); return o; }
    return v;
  };
  const scripts = project.scripts.filter((x) => x.page === pageId).map((x) => ({ ...remap(clone(x)), id: uid('s'), page: page.id, name: x.name ? x.name + ' (copy)' : '' }));
  project.pages.push(page);
  project.scripts.push(...scripts);
  return page;
}

export function freshClone(project, node) {
  const copy = clone(node);
  const taken = new Set();
  walk(copy, (n) => {
    n.id = uid('c');
    const base = n.name.replace(/\d+$/, '') || n.type;
    n.name = uniqueName(project, base, taken);
    taken.add(n.name);
  });
  return copy;
}

export function isContainer(node) {
  return !!components.get(node.type)?.container;
}

// ---------- blocks / scripts ----------
export function newBlock(type, args) {
  const def = blocks.get(type);
  return {
    id: uid('b'), type,
    args: { ...clone(def.defaults || {}), ...(args || {}) },
    slots: Object.fromEntries((def.slots || []).map((s) => [s.key, []])),
  };
}

export function newScript(project, pageId, hatType, args) {
  const hat = newBlock(hatType, args);
  return { id: uid('s'), page: pageId, name: '', hat: { type: hat.type, args: hat.args }, body: [] };
}

export function scriptTitle(project, script) {
  if (script.name) return script.name;
  const def = blocks.get(script.hat.type);
  if (def?.summary) return def.summary(script.hat.args, project);
  const tgt = script.hat.args.target && allNodes(project).find((x) => x.node.id === script.hat.args.target);
  return tgt ? `${tgt.node.name} · ${tt(def.title)}` : (def?.title || script.hat.type);
}

/** Visit every block in a stack (depth-first). fn(block, arr, index, parentBlock) */
export function walkBlocks(arr, fn, parent = null) {
  arr.forEach((b, i) => {
    fn(b, arr, i, parent);
    Object.values(b.slots || {}).forEach((s) => walkBlocks(s, fn, b));
  });
}

export function findBlock(script, id) {
  let hit = null;
  walkBlocks(script.body, (b, arr, idx, parent) => { if (b.id === id) hit = { block: b, arr, idx, parent }; });
  return hit;
}

export function freshBlockClone(b) {
  const c = clone(b);
  const re = (x) => { x.id = uid('b'); Object.values(x.slots || {}).forEach((s) => s.forEach(re)); };
  re(c);
  return c;
}

export const fnNames = (project) =>
  project.scripts.filter((s) => s.hat.type === 'onFunction' && s.hat.args.name).map((s) => s.hat.args.name);

// ---------- static checks ("Problems") ----------
export const targetConfig = (project, type) => project.targets.find((t) => t.type === type);

/** Scripts that belong to a target (their event/hat block is supported by it). */
export function scriptsFor(project, targetId) {
  return project.scripts.filter((s) => blockSupports(blocks.get(s.hat.type), targetId));
}

export function lint(project) {
  const problems = [];
  const tid = activeTargetId(project);
  const tdef = targets.get(tid);
  const nodes = new Map(allNodes(project).map(({ node }) => [node.id, node]));
  const models = new Set(project.models.map((m) => m.name));
  const vars = new Set(project.variables.map((v) => v.name));
  const pages = new Set(project.pages.map((p) => p.id));
  const fns = new Set(fnNames(project));
  const check = (b, script, nested) => {
    const def = blocks.get(b.type);
    if (!def) { problems.push({ script: script.id, block: b.id, msg: tf('不明なブロック: {0}', b.type) }); return; }
    if (!blockSupports(def, tid, nested)) problems.push({ script: script.id, block: b.id, msg: tf('このブロックは {0} では使えません', tdef ? tt(tdef.name.ja) : tid) });
    for (const [k, f] of Object.entries(def.fields || {})) {
      if (nested && k === 'to') continue; // value blocks have no result variable
      const v = b.args[k];
      const bad = (m) => problems.push({ script: script.id, block: b.id, msg: m });
      if (f.t === 'comp' && (v === '@it' || v === '@me')) continue;
      if (f.t === 'comp') { if (!v) bad(tt('対象のUI部品が未選択です')); else if (!nodes.has(v)) bad(tt('対象のUI部品が見つかりません(削除された可能性)')); }
      if (f.t === 'model') { if (!v) bad(tt('データモデルが未選択です')); else if (!models.has(v)) bad(tf('データモデル「{0}」が存在しません', v)); }
      if (f.t === 'var') { if (!v) { if (!f.opt) bad(tt('変数が未選択です')); } else if (!vars.has(v)) bad(tf('変数「{0}」が存在しません', v)); }
      if (f.t === 'page' && v && !pages.has(v)) bad(tt('移動先のページが見つかりません'));
      if (f.t === 'page' && !v && f.required) bad(tt('ページが未選択です'));
      if (f.t === 'fn') { if (!v) bad(tt('関数が未選択です')); else if (!fns.has(v)) bad(tf('関数「{0}」が定義されていません', v)); }
      if (f.t === 'fieldname' && b.args.model) {
        const m = project.models.find((x) => x.name === b.args.model);
        if (m && v && !m.fields.some((x) => x.name === v)) bad(tf('フィールド「{0}」が {1} に存在しません', v, m.name));
      }
    }
  };
  // value blocks nested inside argument values are checked too
  const deep = (v, owner, script) => {
    if (!v || typeof v !== 'object') return;
    if (v.$b) { check({ id: owner, type: v.$b.type, args: v.$b.args }, script, true); deep(v.$b.args, owner, script); return; }
    Object.values(v).forEach((x) => deep(x, owner, script));
  };
  const check0 = check;
  for (const s of scriptsFor(project, tid)) {
    check({ id: 'hat:' + s.id, type: s.hat.type, args: s.hat.args }, s);
    deep(s.hat.args, 'hat:' + s.id, s);
    walkBlocks(s.body, (b) => { check(b, s); deep(b.args, b.id, s); });
  }
  if (tdef?.lint) problems.push(...tdef.lint(project));
  return problems;
}

// Project -> ordinary web files (index.html / style.css / app.js / data/ / README.md).
// Pure string generation (no DOM) so it also runs under Node for tests.
import { components, blocks, pluginModules } from './registry.js';
import './components.js';
import './blocks.js';
import './blocks-extra.js';
import './blocks-reporters.js';
import './blocks-game.js';
import './blocks-more.js';
import './targets/index.js';
import { fontStack, googleFontsUrl } from './fonts.js';
import { animationRules, keyframesCss } from './animations.js';
import { drawChart } from './chartdraw.js';
import { mapTiles, drawMap } from './maputil.js';
import { cm, commentLang, localizeComments } from './comments.js';
import { BASE_CSS, cssDecls, renderNode } from './components.js';
import { allNodes, walk, defaultFor, nextRowId, scriptsFor } from './model.js';
import { esc } from './util.js';

const GLOBALS = new Set(['Math', 'Number', 'String', 'Boolean', 'Date', 'JSON', 'Array', 'Object', 'parseInt', 'parseFloat',
  'isNaN', 'Infinity', 'NaN', 'true', 'false', 'null', 'undefined', 'typeof', 'new', 'in', 'of', 'instanceof', 'dt']);
const IDENT_OK = /^[\p{L}_$][\p{L}\p{N}_$]*$/u;
const q = (s) => JSON.stringify(String(s ?? ''));
const varRef = (n) => (IDENT_OK.test(n) ? `vars.${n}` : `vars[${q(n)}]`);

export function buildEnv(project) {
  return {
    vars: new Set(project.variables.map((v) => v.name)),
    comps: new Map(allNodes(project).map(({ node }) => [node.name, node.id])),
    models: new Set(project.models.map((m) => m.name)),
    scope: new Set(),
  };
}

/**
 * Compile a user-typed expression. Known variables / components / models are rewritten;
 * anything that is not a valid expression is treated as a plain string literal,
 * so typing `こんにちは` or `Hello world` just works.
 */
export function compileExpr(src, env) {
  src = String(src ?? '').trim();
  if (src === '') return '""';
  let out = '', unknown = false, i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== ch) { if (src[j] === '\\') j++; j++; }
      out += src.slice(i, j + 1); i = j + 1; continue;
    }
    if (/[\p{L}_$]/u.test(ch)) {
      let j = i + 1;
      while (j < src.length && /[\p{L}\p{N}_$]/u.test(src[j])) j++;
      const id = src.slice(i, j);
      const prev = out.trimEnd().slice(-1);
      const rest = src.slice(j).trimStart();
      if (prev === '.') out += id;
      else if (env.scope.has(id)) out += id;
      else if (env.vars.has(id)) out += varRef(id);
      else if (env.comps.has(id)) out += rest.startsWith('.') ? `$(${q(env.comps.get(id))})` : `getValue(${q(env.comps.get(id))})`;
      else if (env.models.has(id)) out += `data[${q(id)}]`;
      else if (GLOBALS.has(id)) out += id;
      else { unknown = true; out += id; }
      i = j; continue;
    }
    if (/\d/.test(ch)) {
      const m = /^\d+(\.\d+)?/.exec(src.slice(i));
      out += m[0]; i += m[0].length; continue;
    }
    out += ch; i++;
  }
  if (unknown) return q(src);
  try { new Function('return (' + out + ')'); } catch { return q(src); }
  return out;
}

function compileCond(c, g) {
  if (!c || !c.rows || !c.rows.length) return 'true';
  const parts = c.rows.map((r) => {
    const L = g.expr(r.l), R = g.expr(r.r);
    switch (r.op) {
      case 'js': return `(${typeof r.l === 'string' && L === q(String(r.l).trim()) ? 'false' : L})`;
      case 'true': return `Boolean(${L})`;
      case '==': return `(${L} == ${R})`;
      case '!=': return `(${L} != ${R})`;
      case '>': case '<': case '>=': case '<=': return `(Number(${L}) ${r.op} Number(${R}))`;
      case 'contains': return `String(${L}).includes(String(${R}))`;
      case 'empty': return `(${L} === "" || ${L} == null)`;
      case 'notempty': return `!(${L} === "" || ${L} == null)`;
      default: return 'true';
    }
  });
  const joined = parts.join(c.join === 'or' ? ' || ' : ' && ');
  return c.not ? `!(${joined})` : parts.length > 1 ? `(${joined})` : joined;
}

function makeCtx(project, debug) {
  const env = buildEnv(project);
  let counter = 0, loopDepth = 0;
  const cloneVars = [], meVars = [];
  const used = new Set();
  const g = {
    env, used,
    use: (m) => { used.add(m); },
    v: (n) => varRef(n),
    inLoop: () => loopDepth > 0,
    loop(fn) { loopDepth++; try { return fn(); } finally { loopDepth--; } },
    /** "a, b, [1,2], 'x'" -> JS array literal; each item compiled like an expression */
    exprList(src) {
      const items = []; let depth = 0, cur = '', quote = '';
      for (const ch of String(src ?? '')) {
        if (quote) { cur += ch; if (ch === quote) quote = ''; continue; }
        if (ch === '"' || ch === "'" || ch === '`') { quote = ch; cur += ch; continue; }
        if ('([{'.includes(ch)) depth++;
        if (')]}'.includes(ch)) depth--;
        if (ch === ',' && depth === 0) { items.push(cur); cur = ''; } else cur += ch;
      }
      if (cur.trim() !== '' || items.length) items.push(cur);
      return '[' + items.filter((x, i) => x.trim() !== '' || i < items.length - 1).map((x) => compileExpr(x, env)).join(', ') + ']';
    },
    expr: (s) => (s && typeof s === 'object' && s.$b ? g.reporter(s.$b) : compileExpr(s, env)),
    cond: (c) => compileCond(c, g),
    comp: (id) => (id === '@it' ? (cloneVars[cloneVars.length - 1] || '""') : id === '@me' ? (meVars[meVars.length - 1] || '""') : q(id || '')),
    withClone(name, fn, me) { cloneVars.push(name); if (me) meVars.push(me); try { return fn(); } finally { cloneVars.pop(); if (me) meVars.pop(); } },
    /** JS expression for a value block (round / hexagon reporter) */
    reporter(rb) {
      const def = blocks.get(rb.type);
      if (!def) return '""';
      if (def.rep) return def.rep(rb, g);
      const lines = def.gen({ ...rb, args: { ...rb.args, to: '__R__' }, slots: {} }, g);
      const m = /^setVar\("__R__", ([\s\S]*)\);$/.exec(lines[0] || '');
      return m ? `(${m[1]})` : '""';
    },
    uid: (p) => `_${p}${++counter}`,
    scoped(names, fn) {
      const added = names.filter((n) => !env.scope.has(n));
      added.forEach((n) => env.scope.add(n));
      try { return fn(); } finally { added.forEach((n) => env.scope.delete(n)); }
    },
    stack(list) {
      const lines = [];
      for (const b of list) {
        const def = blocks.get(b.type);
        if (!def || !def.gen) { lines.push(`// (unknown block: ${b.type})`); continue; }
        lines.push(`// ${commentLang(project) === 'ja' ? def.title : (def.en || def.title)}`);
        if (debug) lines.push(`__at(${q(b.id)});`);
        lines.push(...def.gen(b, g));
      }
      return lines;
    },
  };
  return g;
}

function genCss(project, keyframes) {
  const f = project.settings?.font;
  const st = project.settings || {};
  const out = [BASE_CSS, st.primary ? `:root { --primary: ${st.primary}; }` : '', `body { margin: 0; font-family: ${fontStack(f) || '"Hiragino Sans", "Noto Sans JP", system-ui, -apple-system, "Segoe UI", sans-serif'}; color: ${st.textColor || '#1f2328'}; background: ${st.bg || '#fff'}; }`,
    '.page { min-height: 100vh; }'];
  if (keyframes) out.push('', '/* ---- Animations ---- */', keyframesCss(), '@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }');
  out.push('', '/* ---- Component styles ---- */');
  for (const { node } of allNodes(project)) {
    const def = components.get(node.type);
    const sel = `#${node.id}${def?.cssTarget || ''}`;
    const decls = cssDecls(node);
    out.push(`/* ${node.name} (${node.type}) */`);
    if (decls.length) out.push(`${sel} {`, ...decls.map((d) => `  ${d};`), '}');
    for (const r of animationRules(node.props)) out.push(`${sel}${r.suffix} {`, ...r.decls.map((d) => `  ${d};`), '}');
    if (out[out.length - 1].startsWith('/*')) out.pop();
  }
  if (st.customCss && st.customCss.trim()) out.push('', '/* ---- Custom CSS (Project Settings) ---- */', st.customCss.trim());
  return out.join('\n') + '\n';
}

export function usedFontValues(project) {
  return [project.settings?.font, ...allNodes(project).map(({ node }) => node.style?.fontFamily)].filter(Boolean);
}

function genHtml(project) {
  const ctx = { project, editor: false };
  const pages = project.pages.map((p, i) => {
    const body = (p.root.children || []).map((c) => renderNode(c, ctx)).join('\n    ');
    const hidden = i === 0 ? '' : ' hidden';
    return `  <section id="${p.root.id}" class="page cx cx-page" data-page="${esc(p.id)}"${hidden}>\n    ${body}\n  </section>`;
  });
  const fontUrl = googleFontsUrl(usedFontValues(project));
  const stg = project.settings || {};
  const desc = stg.description ? `\n  <meta name="description" content="${esc(stg.description)}">` : '';
  const icon = stg.favicon ? `\n  <link rel="icon" href="data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>${stg.favicon}</text></svg>`)}">` : '';
  const fontTags = fontUrl ? `\n  <link rel="preconnect" href="https://fonts.googleapis.com">\n  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n  <link rel="stylesheet" href="${esc(fontUrl)}">` : '';
  return `<!DOCTYPE html>
<html lang="${esc(project.settings?.appLang || 'ja')}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(project.settings?.title || project.name)}</title>${desc}${icon}${fontTags}
  <link rel="stylesheet" href="style.css">
</head>
<body>
${pages.join('\n')}
  <script src="data/data.js"></script>
  <script src="app.js"></script>
</body>
</html>
`;
}

function typedVar(v) {
  if (v.type === 'Number') return Number(v.initial) || 0;
  if (v.type === 'Boolean') return String(v.initial) === 'true';
  if (v.type === 'Array') { try { const a = JSON.parse(v.initial || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } }
  if (v.type === 'Object') { try { const o = JSON.parse(v.initial || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; } }
  return String(v.initial ?? '');
}

function genJs(project, debug, persist) {
  const g = makeCtx(project, debug);
  const models = {};
  project.models.forEach((m) => {
    models[m.name] = { fields: m.fields.map((f) => f.name), types: Object.fromEntries(m.fields.map((f) => [f.name, f.type])) };
    const opts = Object.fromEntries(m.fields.filter((f) => f.type === 'Enum').map((f) => [f.name, String(f.options || '').split(',').map((x) => x.trim()).filter(Boolean)]));
    const refs = Object.fromEntries(m.fields.filter((f) => f.type === 'Relation' && f.ref).map((f) => [f.name, f.ref]));
    if (Object.keys(opts).length) models[m.name].options = opts;
    if (Object.keys(refs).length) models[m.name].refs = refs;
  });
  const vars = Object.fromEntries(project.variables.map((v) => [v.name, typedVar(v)]));
  // 1) logic first, so we know which optional runtime modules are needed
  const logic = [];
  for (const s of scriptsFor(project, 'web')) {
    const def = blocks.get(s.hat.type);
    if (!def) continue;
    logic.push('', `// ▶ ${s.name || (def.summary ? def.summary(s.hat.args, project) : def.title)}`);
    const body = def.bodyScope ? g.withClone(def.bodyScope.it, () => g.stack(s.body), def.bodyScope.me)
      : def.hatScope ? g.scoped(def.hatScope(s.hat.args), () => g.stack(s.body)) : g.stack(s.body);
    logic.push(...def.gen({ id: 'hat:' + s.id, type: s.hat.type, args: s.hat.args }, g, body));
  }
  if (allNodes(project).some(({ node }) => node.type === 'chart')) g.use('chart');
  if (allNodes(project).some(({ node }) => node.type === 'map')) g.use('map');
  const L = [];
  L.push(`/* ${project.name} — generated by Codiram. Plain JavaScript: edit freely. */`, '"use strict";', '');
  L.push('// ===== 1. Data models =====', `const MODELS = ${JSON.stringify(models, null, 2)};`, '');
  L.push('// ===== 2. State =====', `const vars = ${JSON.stringify(vars, null, 2)};`,
    `const APP_ID = ${q(project.id)};`, `const PERSIST = ${persist ? 'true' : 'false'};`, 'const data = loadData();', '');
  L.push(RUNTIME, '');
  for (const [name, code] of Object.entries({ ...MODULES, ...pluginModules })) if (g.used.has(name)) L.push(code, '');
  L.push('// ===== 4. Logic (generated from blocks) =====', ...logic);
  if ((project.settings?.customJs || '').trim()) L.push('', '// ===== 4b. Custom JavaScript (Project Settings) =====', project.settings.customJs.trim());
  L.push('', '// ===== 5. Start =====', 'boot();', '');
  return { js: L.join('\n'), used: g.used };
}

const RUNTIME = String.raw`// ===== 3. Runtime helpers =====
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fns = {};
const pageHandlers = {};
const dataHandlers = {};
let currentPage = null;
let skipEl = null; // table being edited: not re-rendered while the user types

function reportError(e) {
  console.error(e);
  if (window.__codiramReport) window.__codiramReport(e);
}
function guard(fn) {
  return async (...a) => { try { await fn(...a); } catch (e) { reportError(e); } };
}
function on(id, type, fn) {
  const el = $(id);
  if (!el) { reportError(new Error("UI部品が見つかりません: " + id)); return; }
  el.addEventListener(type, guard(fn));
}
function onPage(page, fn) { (pageHandlers[page] = pageHandlers[page] || []).push(guard(fn)); }
function onData(model, fn) { (dataHandlers[model] = dataHandlers[model] || []).push(guard(fn)); }
function every(ms, fn) { setInterval(guard(fn), Math.max(50, Number(ms) || 1000)); }
async function callFn(name, args) {
  if (!fns[name]) throw new Error("関数が定義されていません: " + name);
  return await fns[name](...(args || []));
}

// ---- storage ----
function loadData() {
  let d = {};
  const initial = window.CODIRAM_DATA || {};
  for (const name of Object.keys(MODELS)) d[name] = JSON.parse(JSON.stringify(initial[name] || []));
  if (PERSIST) {
    try {
      const saved = JSON.parse(localStorage.getItem("codiram:" + APP_ID + ":data") || "null");
      if (saved) for (const name of Object.keys(MODELS)) if (saved[name]) d[name] = saved[name];
    } catch (e) { /* storage unavailable */ }
  }
  return d;
}
function saveData() {
  if (!PERSIST) return;
  try { localStorage.setItem("codiram:" + APP_ID + ":data", JSON.stringify(data)); } catch (e) { /* ignore */ }
}

// ---- variables ----
function setVar(name, value) { vars[name] = value; refresh(); }
function changeVar(name, delta) { setVar(name, (Number(vars[name]) || 0) + (Number(delta) || 0)); }

// ---- UI helpers ----
function inputOf(el) {
  if (!el) return null;
  return el.matches("input, textarea, select") ? el : el.querySelector("input, textarea, select");
}
function readInput(el) {
  if (el.type === "checkbox") return el.checked;
  if (el.type === "number") return el.value === "" ? "" : Number(el.value);
  return el.value;
}
function getValue(id) {
  const el = $(id);
  const input = inputOf(el);
  return input ? readInput(input) : el ? el.textContent : "";
}
function setValue(id, value) {
  const input = inputOf($(id));
  if (!input) return;
  if (input.type === "checkbox") input.checked = !!value; else input.value = value;
  if (input.dataset.bind) vars[input.dataset.bind] = readInput(input);
  refresh();
}
function setText(id, value) {
  const el = $(id);
  if (!el) return;
  if (el.hasAttribute("data-text")) el.dataset.text = String(value); else el.textContent = String(value);
  refresh();
}
function setVisible(id, visible) { const el = $(id); if (el) el.hidden = !visible; }
function showMessage(message) { alert(String(message)); }
function showPage(id) {
  document.querySelectorAll(".page").forEach((p) => { p.hidden = p.dataset.page !== id; });
  currentPage = id;
  refresh();
  (pageHandlers[id] || []).forEach((fn) => fn());
}
function lookup(path, row) {
  const parts = path.match(/[^.\[\]]+/g) || [];
  const first = parts.shift();
  let cur;
  if (row && first in row) cur = row[first];
  else if (first in vars) cur = vars[first];
  else if (first in data) cur = data[first];
  else return undefined;
  for (const p of parts) { if (cur == null) return undefined; cur = cur[p]; }
  return cur;
}
// "{name}", "{items.length}", "{User[0].name}" ...
function interpolate(template, row) {
  return String(template).replace(/\{([^{}]+)\}/g, (m, key) => {
    const v = lookup(key.trim(), row);
    return v === undefined ? m : v !== null && typeof v === "object" ? JSON.stringify(v) : v;
  });
}

// ---- rendering of bound elements ----
function refresh() {
  document.querySelectorAll("[data-text]").forEach((el) => { el.textContent = interpolate(el.dataset.text); });
  document.querySelectorAll("[data-bind]").forEach((el) => {
    if (el === document.activeElement) return;
    const v = vars[el.dataset.bind];
    if (el.type === "checkbox") el.checked = !!v;
    else if (String(el.value) !== String(v == null ? "" : v)) el.value = v == null ? "" : v;
  });
  document.querySelectorAll("[data-source]").forEach((el) => { if (el !== skipEl && el.tagName !== "CANVAS") renderCollection(el); });
  if (typeof refreshCharts === "function") refreshCharts();
}
function renderCollection(el) {
  const name = el.dataset.source;
  const model = MODELS[name];
  el.textContent = "";
  if (!model) return;
  const rows = data[name] || [];
  if (el.tagName === "TABLE") {
    const cols = el.dataset.cols ? el.dataset.cols.split(",").map((s) => s.trim()).filter(Boolean) : model.fields;
    const head = el.createTHead().insertRow();
    cols.forEach((c) => { const th = document.createElement("th"); th.textContent = c; head.append(th); });
    if (el.hasAttribute("data-delete")) head.append(document.createElement("th"));
    const body = el.createTBody();
    rows.forEach((row) => {
      const tr = body.insertRow();
      cols.forEach((c) => {
        const td = tr.insertCell();
        if (!el.hasAttribute("data-editable")) { td.textContent = display(name, c, row[c]); return; }
        const type = (model.types || {})[c];
        const choice = type === "Enum" || type === "Relation";
        const input = document.createElement(choice ? "select" : "input");
        if (choice) {
          input.append(new Option("", ""));
          choicesOf(name, c).forEach(([v, label]) => input.append(new Option(label, v)));
          input.value = row[c] == null ? "" : String(row[c]);
        } else {
          input.type = type === "Number" ? "number" : type === "Boolean" ? "checkbox" : type === "Date" ? "date" : "text";
          if (type === "Boolean") input.checked = !!row[c]; else input.value = cell(row[c]);
        }
        input.addEventListener("change", () => {
          row[c] = coerce(name, c, type === "Boolean" ? input.checked : input.value);
          skipEl = el;
          try { touch(name); } finally { skipEl = null; }
        });
        td.append(input);
      });
      if (el.hasAttribute("data-delete")) {
        const btn = document.createElement("button");
        btn.textContent = el.getAttribute("data-delete") || "削除";
        btn.type = "button";
        btn.addEventListener("click", () => { data[name] = data[name].filter((r) => r._id !== row._id); touch(name); });
        tr.insertCell().append(btn);
      }
    });
    if (el.hasAttribute("data-add")) {
      const cell0 = el.createTFoot().insertRow().insertCell();
      cell0.colSpan = cols.length + (el.hasAttribute("data-delete") ? 1 : 0);
      const add = document.createElement("button");
      add.type = "button";
      add.textContent = el.getAttribute("data-add") || "+";
      add.addEventListener("click", () => addRow(name, {}));
      cell0.append(add);
    }
  } else {
    const tpl = el.dataset.template || "{" + (model.fields[0] || "id") + "}";
    rows.forEach((row) => { const li = document.createElement("li"); li.textContent = interpolate(tpl, row); el.append(li); });
  }
}
function cell(v) { return v !== null && typeof v === "object" ? JSON.stringify(v) : v == null ? "" : String(v); }
// Relation fields store the _id of a row of another model; show that row's first text field instead
function refLabel(refModel, id) {
  const m = MODELS[refModel], row = (data[refModel] || []).find((r) => r._id === Number(id));
  if (!m || !row) return "";
  const f = m.fields.find((x) => m.types[x] === "String") || m.fields[0];
  return cell(row[f]);
}
function display(model, field, v) { const ref = ((MODELS[model] || {}).refs || {})[field]; return ref ? refLabel(ref, v) : cell(v); }
function choicesOf(model, field) {
  const m = MODELS[model], ref = (m.refs || {})[field];
  if (ref) return (data[ref] || []).map((r) => [r._id, refLabel(ref, r._id)]);
  return ((m.options || {})[field] || []).map((x) => [x, x]);
}

// ---- data operations ----
const busy = {};
function touch(name) {
  saveData();
  if (!busy[name]) {
    busy[name] = true;
    try { (dataHandlers[name] || []).forEach((fn) => fn()); } finally { busy[name] = false; }
  }
  refresh();
}
function coerce(model, field, v) {
  const t = (MODELS[model].types || {})[field];
  if (t === "Number") return v === "" || v == null ? 0 : Number(v);
  if (t === "Relation") return v === "" || v == null ? null : Number(v);
  if (t === "Boolean") return v === true || v === "true";
  if (t === "Array" || t === "Object") { try { return typeof v === "string" ? JSON.parse(v) : v; } catch (e) { return v; } }
  return v;
}
function addRow(model, values) {
  const rows = data[model];
  const row = { _id: rows.reduce((m, r) => Math.max(m, r._id || 0), 0) + 1 };
  for (const f of MODELS[model].fields) {
    if (f in values) row[f] = coerce(model, f, values[f]);
    else if (f === "id") row[f] = rows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1;
    else row[f] = coerce(model, f, MODELS[model].types[f] === "String" ? "" : null);
  }
  rows.push(row);
  touch(model);
}
function deleteWhere(model, pred) { data[model] = data[model].filter((r) => !pred(r)); touch(model); }
function clearRows(model) { data[model] = []; touch(model); }
function updateWhere(model, pred, field, value) {
  data[model].forEach((r) => { if (pred(r)) r[field] = coerce(model, field, value); });
  touch(model);
}
function findRow(model, pred) { return data[model].find(pred); }
function sortRows(model, field, desc) {
  data[model].sort((a, b) => (a[field] > b[field] ? 1 : a[field] < b[field] ? -1 : 0) * (desc ? -1 : 1));
  touch(model);
}

// ---- timers, keys, element helpers ----
const timers = {};
function later(ms, fn) { setTimeout(guard(fn), Math.max(0, Number(ms) || 0)); }
function startTimer(name, ms, fn) { stopTimer(name); timers[name] = setInterval(guard(fn), Math.max(30, Number(ms) || 1000)); }
function stopTimer(name) { clearInterval(timers[name]); delete timers[name]; }
function onKey(key, fn, up) {
  const wanted = String(key).toLowerCase() === "space" ? " " : String(key).toLowerCase();
  document.addEventListener(up ? "keyup" : "keydown", guard(async (ev) => {
    if (ev.key.toLowerCase() !== wanted) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName) && wanted.length === 1) return;
    await fn(ev);
  }));
}
function setStyle(id, prop, value) { const el = $(id); if (el) el.style.setProperty(prop, String(value)); }
function setAttr(id, name, value) { const el = $(id); if (el) el.setAttribute(name, String(value)); }
function setDisabled(id, disabled) { const el = inputOf($(id)) || $(id); if (el) el.disabled = !!disabled; }
function focusEl(id) { const el = inputOf($(id)) || $(id); if (el) el.focus(); }
function scrollToEl(id) { const el = $(id); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); }
function readUi(id, kind) {
  const el = $(id);
  if (!el) return "";
  if (kind === "visible") return !el.hidden;
  if (kind === "checked") { const i = inputOf(el); return !!(i && i.checked); }
  if (kind === "text") return el.textContent;
  return getValue(id);
}

// ---- start up ----
function boot() {
  if (typeof initMaps === "function") initMaps();
  document.querySelectorAll("[data-bind]").forEach((el) => {
    const input = inputOf(el);
    const ev = input.type === "checkbox" || input.tagName === "SELECT" ? "change" : "input";
    input.addEventListener(ev, () => { vars[el.dataset.bind] = readInput(input); refresh(); });
    if (!(el.dataset.bind in vars)) vars[el.dataset.bind] = readInput(input);
  });
  document.querySelectorAll("form").forEach((f) => f.addEventListener("submit", (e) => e.preventDefault()));
  document.addEventListener("click", (e) => {
    const t = e.target.closest && e.target.closest("[data-tab]");
    if (t) selectTab(t.closest("[data-tabs]").id, Number(t.dataset.tab));
  });
  const first = document.querySelector(".page");
  showPage(first ? first.dataset.page : null);
}
function selectTab(id, i) {
  const root = $(id);
  if (!root) return;
  root.querySelectorAll(":scope > .cx-tabbar > .cx-tab").forEach((b, k) => b.classList.toggle("on", k === i));
  [...root.querySelector(":scope > .cx-tabpanels").children].forEach((p, k) => p.classList.toggle("cx-tabhide", k !== i));
}`;


const MODULES = {
  chart: `// ---- charts ----
${drawChart.toString()}
function refreshCharts() {
  document.querySelectorAll("canvas[data-chart]").forEach((cv) => {
    const d = cv.dataset, src = d.source, m = MODELS[src];
    let rows = [];
    if (m) rows = (data[src] || []).map((r) => ({ label: r[d.label || m.fields[0]], value: r[d.value || m.fields[1] || m.fields[0]] }));
    else if (Array.isArray(vars[src])) rows = vars[src].map((v, i) => (v !== null && typeof v === "object" ? { label: v[d.label] ?? i + 1, value: v[d.value] } : { label: i + 1, value: v }));
    drawChart(cv, rows, { kind: d.kind, title: d.title, color: d.color });
  });
}`,
  map: `// ---- map ----
${mapTiles.toString()}
${drawMap.toString()}
function initMaps() { document.querySelectorAll(".cx-map[data-lat]").forEach((el) => drawMap(el)); }
function setMap(id, lat, lon, zoom) { const el = $(id); if (el) { el.dataset.lat = lat; el.dataset.lon = lon; el.dataset.zoom = zoom; drawMap(el); } }`,
  list: String.raw`// ---- list / object helpers ----
function listOf(name) { if (!Array.isArray(vars[name])) vars[name] = []; return vars[name]; }
function listOp(name, fn) { const result = fn(listOf(name)); refresh(); return result; }
function objOf(name) { if (!vars[name] || typeof vars[name] !== "object" || Array.isArray(vars[name])) vars[name] = {}; return vars[name]; }
function objOp(name, fn) { const result = fn(objOf(name)); refresh(); return result; }
function range(from, to, step) {
  const out = [];
  step = Number(step) || 1;
  for (let i = Number(from); step > 0 ? i <= to : i >= to; i += step) { out.push(i); if (out.length > 100000) break; }
  return out;
}
function unique(a) { return [...new Set(a)]; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function stat(a, kind) {
  const n = (Array.isArray(a) ? a : []).map(Number);
  if (kind === "count") return n.length;
  if (!n.length) return 0;
  const sum = n.reduce((x, y) => x + y, 0);
  return kind === "sum" ? sum : kind === "avg" ? sum / n.length : kind === "max" ? Math.max(...n) : Math.min(...n);
}`,
  date: String.raw`// ---- date / time helpers ----
const pad2 = (n) => String(n).padStart(2, "0");
function dateOf(v) { return v === "" || v == null ? new Date() : new Date(v); }
function dateGet(v, kind) {
  const d = dateOf(v);
  switch (kind) {
    case "iso": return d.toISOString();
    case "ts": return d.getTime();
    case "year": return d.getFullYear();
    case "month": return d.getMonth() + 1;
    case "day": return d.getDate();
    case "weekday": return d.getDay();
    case "hour": return d.getHours();
    case "minute": return d.getMinutes();
    case "second": return d.getSeconds();
    case "ms": return d.getMilliseconds();
    case "date": return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
    case "time": return pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
    default: return d.toLocaleString();
  }
}
function dateAdd(v, n, unit) {
  const d = dateOf(v);
  n = Number(n) || 0;
  const ms = { second: 1000, minute: 60000, hour: 3600000, day: 86400000, week: 604800000 }[unit];
  if (ms) d.setTime(d.getTime() + n * ms);
  else if (unit === "month") d.setMonth(d.getMonth() + n);
  else if (unit === "year") d.setFullYear(d.getFullYear() + n);
  return d.toISOString();
}
function dateDiff(a, b, unit) {
  const x = dateOf(a), y = dateOf(b);
  if (unit === "month") return (x.getFullYear() - y.getFullYear()) * 12 + x.getMonth() - y.getMonth();
  if (unit === "year") return x.getFullYear() - y.getFullYear();
  const ms = { second: 1000, minute: 60000, hour: 3600000, day: 86400000, week: 604800000 }[unit] || 1;
  return (x - y) / ms;
}
function dateFmt(v, pattern) {
  const d = dateOf(v);
  const map = { YYYY: d.getFullYear(), MM: pad2(d.getMonth() + 1), DD: pad2(d.getDate()), HH: pad2(d.getHours()), mm: pad2(d.getMinutes()), ss: pad2(d.getSeconds()), W: "日月火水木金土"[d.getDay()] };
  return String(pattern).replace(/YYYY|MM|DD|HH|mm|ss|W/g, (t) => map[t]);
}`,
  anim: String.raw`// ---- animation helpers ----
const tweenState = new WeakMap();
function playAnim(id, name, ms, wait) {
  const el = $(id);
  if (!el) return undefined;
  el.style.animation = "none";
  void el.offsetWidth;
  el.style.animation = "cx-" + name + " " + (Number(ms) || 600) + "ms ease both";
  if (!wait) return undefined;
  return new Promise((resolve) => { el.addEventListener("animationend", resolve, { once: true }); });
}
function stopAnim(id) { const el = $(id); if (el) el.style.animation = "none"; }
function resetAnim(id) {
  const el = $(id);
  if (!el) return;
  el.getAnimations().forEach((a) => a.cancel());
  el.style.animation = ""; el.style.transform = ""; el.style.opacity = "";
  tweenState.delete(el);
}
async function tween(id, prop, to, ms, easing) {
  const el = $(id);
  if (!el) return;
  const from = tweenState.get(el) || { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 };
  const next = { ...from, [prop]: Number(to) };
  const css = (o) => "translate(" + o.x + "px, " + o.y + "px) rotate(" + o.rotate + "deg) scale(" + o.scale + ")";
  const a = el.animate([{ transform: css(from), opacity: from.opacity }, { transform: css(next), opacity: next.opacity }],
    { duration: Math.max(1, Number(ms) || 400), easing: easing || "ease", fill: "forwards" });
  try { await a.finished; } catch (e) { return; }
  el.style.transform = css(next);
  el.style.opacity = next.opacity;
  a.cancel();
  tweenState.set(el, next);
}`,
  audio: String.raw`// ---- sound ----
let audioCtx = null, masterVol = 1, muted = false;
const voices = [];
function ac() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}
function playSound(src, volume, loop) {
  const a = new Audio(String(src));
  a._v = Math.min(1, Math.max(0, volume == null || volume === "" ? 1 : Number(volume)));
  a.volume = a._v * masterVol;
  a.muted = muted;
  a.loop = !!loop;
  a._src = String(src);
  voices.push(a);
  a.addEventListener("ended", () => { const i = voices.indexOf(a); if (i >= 0) voices.splice(i, 1); });
  a.play().catch(() => { /* blocked until the user interacts */ });
  return a;
}
function stopSound(src) {
  for (const a of [...voices]) if (!src || a._src === String(src)) { a.pause(); voices.splice(voices.indexOf(a), 1); }
}
function setVolume(v) { masterVol = Math.min(1, Math.max(0, Number(v))); voices.forEach((a) => { a.volume = a._v * masterVol; }); }
function setMuted(m) { muted = !!m; voices.forEach((a) => { a.muted = muted; }); }
function tone(freq, ms, type, volume, when, slideTo) {
  if (muted) return;
  const c = ac(), t0 = c.currentTime + (when || 0), o = c.createOscillator(), g = c.createGain();
  o.type = type || "square";
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + ms / 1000);
  const v = Math.min(1, Math.max(0, volume == null || volume === "" ? 0.3 : Number(volume))) * masterVol;
  g.gain.setValueAtTime(Math.max(0.0002, v), t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + ms / 1000 + 0.02);
}
function noiseBurst(ms, volume, when) {
  if (muted) return;
  const c = ac(), len = Math.floor(c.sampleRate * ms / 1000), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource(), g = c.createGain();
  src.buffer = buf;
  g.gain.value = Math.min(1, Math.max(0, volume == null ? 0.3 : volume)) * masterVol;
  src.connect(g).connect(c.destination);
  src.start(c.currentTime + (when || 0));
}
const NOTES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function noteFreq(name) {
  const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(String(name).trim());
  if (!m) return Number(name) || 440;
  const n = NOTES[m[1].toUpperCase()] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + (Number(m[3]) + 1) * 12;
  return 440 * Math.pow(2, (n - 69) / 12);
}
function beep(freq, ms, type, volume) { tone(Number(freq) || 440, Number(ms) || 200, type, volume); }
function playNote(name, ms, type, volume) { tone(noteFreq(name), Number(ms) || 300, type, volume); }
async function playMelody(seq, bpm, type) {
  const beat = 60000 / (Number(bpm) || 120);
  for (const tok of String(seq).split(/\s+/).filter(Boolean)) {
    const parts = tok.split(":"), ms = beat * (Number(parts[1]) || 1);
    if (parts[0] !== "-" && parts[0] !== "r") tone(noteFreq(parts[0]), ms * 0.9, type);
    await sleep(ms);
  }
}
function sfx(name, volume) {
  const v = volume == null || volume === "" ? 0.3 : Number(volume);
  switch (name) {
    case "coin": tone(988, 90, "square", v); tone(1319, 220, "square", v, 0.09); break;
    case "jump": tone(280, 220, "square", v, 0, 760); break;
    case "hit": noiseBurst(120, v); tone(160, 120, "sawtooth", v, 0, 60); break;
    case "explosion": noiseBurst(600, v * 1.2); tone(90, 500, "sawtooth", v, 0, 30); break;
    case "powerup": [523, 659, 784, 1047].forEach((f, i) => tone(f, 110, "square", v, i * 0.08)); break;
    case "laser": tone(1200, 220, "sawtooth", v, 0, 150); break;
    case "click": tone(900, 40, "sine", v); break;
    case "gameover": [392, 330, 262, 196].forEach((f, i) => tone(f, 260, "triangle", v, i * 0.2)); break;
    case "win": [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 160, "square", v, i * 0.13)); break;
    default: tone(660, 120, "sine", v);
  }
}
function speak(text, lang, rate, pitch) {
  if (!window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(String(text));
  if (lang) u.lang = lang;
  u.rate = Number(rate) || 1;
  u.pitch = Number(pitch) || 1;
  u.volume = muted ? 0 : masterVol;
  speechSynthesis.speak(u);
}
function stopSpeak() { if (window.speechSynthesis) speechSynthesis.cancel(); }`,
  game: String.raw`// ---- game engine: sprites, input, collisions, frame loop ----
const keys = {};
const mouse = { cx: 0, cy: 0, down: false };
const sprites = new Map();
const frameHandlers = [];
const collideRules = [];
let paused = false, dt = 0, loopOn = false, lastTime = 0, cloneSeq = 0;
const startedAt = performance.now();
addEventListener("keydown", (e) => { keys[e.key.toLowerCase()] = true; if (e.key === " ") keys.space = true; });
addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; if (e.key === " ") keys.space = false; });
addEventListener("blur", () => { for (const k in keys) keys[k] = false; });
addEventListener("pointermove", (e) => { mouse.cx = e.clientX; mouse.cy = e.clientY; });
addEventListener("pointerdown", (e) => { mouse.down = true; mouse.cx = e.clientX; mouse.cy = e.clientY; });
addEventListener("pointerup", () => { mouse.down = false; });
const keyDown = (k) => !!keys[String(k).toLowerCase()];
function stageEl() { return document.querySelector(".page:not([hidden]) .cx-stage") || document.querySelector(".cx-stage"); }
function stageBox() { const el = stageEl(); return el ? el.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight }; }
const mouseX = () => mouse.cx - stageBox().left;
const mouseY = () => mouse.cy - stageBox().top;
function spriteOf(id) {
  if (!id) return null;
  let s = sprites.get(id);
  if (s) return s;
  const el = $(id);
  if (!el) return null;
  const cs = getComputedStyle(el), w = parseFloat(cs.width) || el.offsetWidth || 50, h = parseFloat(cs.height) || el.offsetHeight || 50;
  s = { id, el, w, h, x: (parseFloat(cs.left) || 0) + w / 2, y: (parseFloat(cs.top) || 0) + h / 2, vx: 0, vy: 0, gy: 0, dir: 0, rot: 0, sx: 1, sy: 1, tpl: null };
  sprites.set(id, s);
  return s;
}
function place(s) {
  s.w = s.el.offsetWidth || s.w;
  s.h = s.el.offsetHeight || s.h;
  s.el.style.left = (s.x - s.w / 2) + "px";
  s.el.style.top = (s.y - s.h / 2) + "px";
}
function setPos(id, x, y) { const s = spriteOf(id); if (s) { s.x = Number(x); s.y = Number(y); place(s); } }
function moveBy(id, dx, dy) { const s = spriteOf(id); if (s) { s.x += Number(dx); s.y += Number(dy); place(s); } }
function setVel(id, vx, vy) { const s = spriteOf(id); if (s) { s.vx = Number(vx); s.vy = Number(vy); startLoop(); } }
function setGravity(id, g) { const s = spriteOf(id); if (s) { s.gy = Number(g); startLoop(); } }
function setDir(id, op, deg) { const s = spriteOf(id); if (s) s.dir = op === "turn" ? s.dir + Number(deg) : Number(deg); }
function moveForward(id, steps) {
  const s = spriteOf(id);
  if (!s) return;
  const r = s.dir * Math.PI / 180;
  s.x += Math.cos(r) * Number(steps);
  s.y += Math.sin(r) * Number(steps);
  place(s);
}
function pointToward(id, x, y) { const s = spriteOf(id); if (s) s.dir = Math.atan2(Number(y) - s.y, Number(x) - s.x) * 180 / Math.PI; }
function pointToSprite(id, other) { const o = spriteOf(other); if (o) pointToward(id, o.x, o.y); }
function setLook(id, prop, v) {
  const s = spriteOf(id);
  if (!s) return;
  if (prop === "rotate") { s.rot = Number(v); s.el.style.rotate = s.rot + "deg"; }
  else if (prop === "scale") { const k = Number(v) || 1; s.sx = Math.sign(s.sx || 1) * k; s.sy = k; }
  else if (prop === "flipx") s.sx = Math.abs(s.sx) * (v ? -1 : 1);
  else if (prop === "opacity") s.el.style.opacity = String(v);
  else if (prop === "visible") s.el.hidden = !v;
  s.el.style.scale = s.sx + " " + s.sy;
}
function edge(id, mode) {
  const s = spriteOf(id);
  if (!s) return;
  const par = s.el.offsetParent || document.body, W = par.clientWidth, H = par.clientHeight, hw = s.w / 2, hh = s.h / 2;
  if (mode === "bounce") {
    if (s.x - hw < 0) { s.x = hw; s.vx = Math.abs(s.vx); }
    if (s.x + hw > W) { s.x = W - hw; s.vx = -Math.abs(s.vx); }
    if (s.y - hh < 0) { s.y = hh; s.vy = Math.abs(s.vy); }
    if (s.y + hh > H) { s.y = H - hh; s.vy = -Math.abs(s.vy); }
  } else if (mode === "wrap") {
    if (s.x < -hw) s.x = W + hw; else if (s.x > W + hw) s.x = -hw;
    if (s.y < -hh) s.y = H + hh; else if (s.y > H + hh) s.y = -hh;
  } else {
    s.x = Math.min(W - hw, Math.max(hw, s.x));
    s.y = Math.min(H - hh, Math.max(hh, s.y));
    if (mode === "stop") { if (s.x <= hw || s.x >= W - hw) s.vx = 0; if (s.y <= hh || s.y >= H - hh) s.vy = 0; }
  }
  place(s);
}
function touching(a, b) {
  const p = spriteOf(a), q = spriteOf(b);
  if (!p || !q || p === q || p.el.hidden || q.el.hidden) return false;
  return Math.abs(p.x - q.x) * 2 < (p.w + q.w) * 0.85 && Math.abs(p.y - q.y) * 2 < (p.h + q.h) * 0.85;
}
const groupOf = (id) => [id, ...clonesOf(id)];
function touchingAny(a, tpl) { return groupOf(a).some((x) => groupOf(tpl).some((y) => touching(x, y))); }
function touchingEdge(id) {
  const s = spriteOf(id);
  if (!s) return false;
  const par = s.el.offsetParent || document.body;
  return s.x - s.w / 2 <= 0 || s.y - s.h / 2 <= 0 || s.x + s.w / 2 >= par.clientWidth || s.y + s.h / 2 >= par.clientHeight;
}
function dist(a, b) { const p = spriteOf(a), q = spriteOf(b); return p && q ? Math.hypot(p.x - q.x, p.y - q.y) : 0; }
function angleTo(a, b) { const p = spriteOf(a), q = spriteOf(b); return p && q ? Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI : 0; }
function spriteProp(id, prop) { const s = spriteOf(id); return s ? s[prop] : 0; }
function clonesOf(tpl) { return [...sprites.values()].filter((s) => s.tpl === tpl && s.el.isConnected).map((s) => s.id); }
function cloneSprite(tpl, x, y) {
  const t = spriteOf(tpl);
  if (!t) return "";
  const el = t.el.cloneNode(true), id = tpl + "_c" + (++cloneSeq);
  el.id = id;
  el.hidden = false;
  el.classList.add("cx-clone");
  t.el.parentNode.append(el);
  const s = { ...t, id, el, vx: 0, vy: 0, gy: 0, tpl };
  if (x !== undefined && x !== "") s.x = Number(x);
  if (y !== undefined && y !== "") s.y = Number(y);
  sprites.set(id, s);
  place(s);
  return id;
}
function deleteSprite(id) {
  const s = sprites.get(id);
  if (!s) { const el = $(id); if (el) el.hidden = true; return; }
  if (s.tpl) { s.el.remove(); sprites.delete(id); } else s.el.hidden = true;
}
function deleteClones(tpl) { clonesOf(tpl).forEach(deleteSprite); }
function setPaused(v) { paused = !!v; }
function onFrame(fn) {
  let busy = false;
  const run = guard(fn);
  frameHandlers.push(async () => { if (busy) return; busy = true; try { await run(); } finally { busy = false; } });
  startLoop();
}
function onCollide(a, b, fn) { collideRules.push({ a, b, fn: guard(fn), hit: new Set() }); startLoop(); }
function checkCollisions() {
  for (const r of collideRules) {
    const now = new Set();
    for (const x of groupOf(r.a)) for (const y of groupOf(r.b)) {
      if (x === y || !touching(x, y)) continue;
      const k = x + "|" + y;
      now.add(k);
      if (!r.hit.has(k)) r.fn(x, y);
    }
    r.hit = now;
  }
}
function startLoop() { if (!loopOn) { loopOn = true; lastTime = performance.now(); requestAnimationFrame(tick); } }
function tick(now) {
  dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  if (!paused) {
    for (const s of sprites.values()) {
      if (s.vx || s.vy || s.gy) { s.vy += s.gy * dt; s.x += s.vx * dt; s.y += s.vy * dt; place(s); }
    }
    frameHandlers.forEach((f) => f());
    checkCollisions();
  }
  requestAnimationFrame(tick);
}
function burst(x, y, text, count) {
  const st = stageEl();
  if (!st) return;
  for (let i = 0; i < (Number(count) || 8); i++) {
    const p = document.createElement("span"), a = Math.random() * Math.PI * 2, d = 30 + Math.random() * 60;
    p.textContent = text || "✨";
    p.style.cssText = "position:absolute;pointer-events:none;font-size:18px;left:" + Number(x) + "px;top:" + Number(y) + "px";
    st.append(p);
    p.animate([{ transform: "translate(0,0) scale(1)", opacity: 1 }, { transform: "translate(" + Math.cos(a) * d + "px," + Math.sin(a) * d + "px) scale(.3)", opacity: 0 }],
      { duration: 600 + Math.random() * 300, easing: "ease-out" }).onfinish = () => p.remove();
  }
}`,
  canvas: String.raw`// ---- canvas drawing ----
const imgCache = {};
function cv(id) { const el = $(id); return el && el.getContext ? el.getContext("2d") : null; }
function cvClear(id, color) {
  const c = cv(id);
  if (!c) return;
  if (color) { c.fillStyle = String(color); c.fillRect(0, 0, c.canvas.width, c.canvas.height); } else c.clearRect(0, 0, c.canvas.width, c.canvas.height);
}
function cvRect(id, x, y, w, h, color, stroke) {
  const c = cv(id);
  if (!c) return;
  c.fillStyle = c.strokeStyle = String(color || "#000");
  if (stroke) c.strokeRect(Number(x), Number(y), Number(w), Number(h)); else c.fillRect(Number(x), Number(y), Number(w), Number(h));
}
function cvCircle(id, x, y, r, color, stroke) {
  const c = cv(id);
  if (!c) return;
  c.fillStyle = c.strokeStyle = String(color || "#000");
  c.beginPath();
  c.arc(Number(x), Number(y), Math.max(0, Number(r)), 0, Math.PI * 2);
  if (stroke) c.stroke(); else c.fill();
}
function cvLine(id, x1, y1, x2, y2, color, width) {
  const c = cv(id);
  if (!c) return;
  c.strokeStyle = String(color || "#000");
  c.lineWidth = Number(width) || 2;
  c.beginPath();
  c.moveTo(Number(x1), Number(y1));
  c.lineTo(Number(x2), Number(y2));
  c.stroke();
}
function cvText(id, text, x, y, color, size) {
  const c = cv(id);
  if (!c) return;
  c.fillStyle = String(color || "#000");
  c.font = (Number(size) || 20) + "px sans-serif";
  c.textBaseline = "middle";
  c.fillText(String(text), Number(x), Number(y));
}
function cvImage(id, src, x, y, w, h) {
  const c = cv(id);
  if (!c) return;
  const img = imgCache[src] || (imgCache[src] = Object.assign(new Image(), { src: String(src) }));
  const draw = () => c.drawImage(img, Number(x), Number(y), Number(w) || img.width, Number(h) || img.height);
  if (img.complete) draw(); else img.addEventListener("load", draw, { once: true });
}`,
  csv: String.raw`// ---- CSV ----
function toCsv(model) {
  const m = MODELS[model];
  if (!m) return "";
  const esc = (v) => { v = v !== null && typeof v === "object" ? JSON.stringify(v) : v == null ? "" : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  return [m.fields.join(","), ...(data[model] || []).map((r) => m.fields.map((f) => esc(r[f])).join(","))].join("\n");
}
function parseCsv(text) {
  const rows = [];
  let row = [], cur = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else quoted = false; } else cur += ch; }
    else if (ch === '"') quoted = true;
    else if (ch === "," || ch === "\t") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += ch;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c !== ""));
}
function importCsv(model, text) {
  const m = MODELS[model];
  if (!m) return;
  const rows = parseCsv(String(text));
  let head = m.fields;
  if (rows.length && rows[0].some((c) => m.fields.includes(c))) head = rows.shift();
  for (const r of rows) {
    const obj = {};
    head.forEach((f, i) => { if (m.fields.includes(f) && r[i] !== undefined) obj[f] = r[i]; });
    addRow(model, obj);
  }
}`,
  file: String.raw`// ---- file input ----
function readFile(id, mode) {
  const input = inputOf($(id)), f = input && input.files && input.files[0];
  if (!f) return Promise.resolve("");
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    if (mode === "dataurl") r.readAsDataURL(f); else r.readAsText(f);
  });
}`,
  ws: String.raw`// ---- WebSocket ----
let ws = null, wsMessage = "";
const wsHandlers = [];
function wsConnect(url) {
  wsClose();
  ws = new WebSocket(String(url));
  ws.onmessage = (ev) => { wsMessage = ev.data; wsHandlers.forEach((fn) => fn()); };
  ws.onerror = () => reportError(new Error("WebSocket error"));
}
function wsSend(msg) {
  if (ws && ws.readyState === 1) ws.send(typeof msg === "string" ? msg : JSON.stringify(msg));
  else reportError(new Error("WebSocket is not connected"));
}
function wsClose() { if (ws) { ws.close(); ws = null; } }
function onWs(fn) { wsHandlers.push(guard(fn)); }`,
  sys: String.raw`// ---- system helpers ----
const memStore = {};
function storeSet(key, value) { const s = JSON.stringify(value); try { localStorage.setItem("app:" + key, s); } catch (e) { memStore[key] = s; } }
function storeGet(key, fallback) {
  let s;
  try { s = localStorage.getItem("app:" + key); } catch (e) { s = memStore[key]; }
  if (s == null) return fallback;
  try { return JSON.parse(s); } catch (e) { return fallback; }
}
function storeDel(key) { try { localStorage.removeItem("app:" + key); } catch (e) { delete memStore[key]; } }
async function copyText(text) { try { await navigator.clipboard.writeText(String(text)); } catch (e) { reportError(e); } }
function openUrl(url, newTab) { if (newTab) window.open(String(url), "_blank", "noopener"); else location.href = String(url); }
function downloadText(name, content) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([String(content)], { type: "text/plain" }));
  a.download = String(name);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
async function fetchJson(url, method, body) {
  const res = await fetch(String(url), { method: method || "GET", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error("HTTP " + res.status + " " + url);
  const text = await res.text();
  try { return JSON.parse(text); } catch (e) { return text; }
}
function sysInfo(kind) {
  switch (kind) {
    case "width": return innerWidth;
    case "height": return innerHeight;
    case "url": return location.href;
    case "lang": return navigator.language;
    case "online": return navigator.onLine;
    case "dark": return matchMedia("(prefers-color-scheme: dark)").matches;
    default: return navigator.userAgent;
  }
}`,
};

const dataJs = (project) => {
  const d = {};
  project.models.forEach((m) => { d[m.name] = m.rows; });
  return `// Initial data (edit in Codiram's Data view, or here).\nwindow.CODIRAM_DATA = ${JSON.stringify(d, null, 2)};\n`;
};

const readmeJa = (project) => `# ${project.name}

**Codiram** から書き出したファイルです。ビルド不要の普通の静的 Web アプリです。

## 実行方法

\`index.html\` をブラウザで開く(または任意の静的サーバーでこのフォルダを配信する)だけで動きます。

## ファイル

| ファイル | 内容 |
| --- | --- |
| \`index.html\` | ページ構造(ページごとに \`<section class="page">\`) |
| \`style.css\` | 部品の基本スタイルと部品ごとのルール(\`#<id>\`) |
| \`app.js\` | ランタイム補助関数(セクション3)と、ブロックから生成したロジック(セクション4) |
| \`data/data.js\` | モデルの初期データ(\`data/<モデル名>.json\` にも同じ内容) |
| \`assets/\` | 画像などの素材を置く場所 |

## カスタマイズ

\`app.js\` は普通の JavaScript です。ブロックのスクリプトは読みやすい関数・イベントハンドラになっているので、手で編集したり AI アシスタントに渡したりできます。
使用中に入力したデータは \`localStorage\` に保存されます。
`;

const readme = (project) => `# ${project.name}

Exported from **Codiram**. This is an ordinary static web app — no build step.

## Run

Open \`index.html\` in a browser (or serve the folder with any static server).

## Files

| File | Purpose |
| --- | --- |
| \`index.html\` | Page structure (one \`<section class="page">\` per page) |
| \`style.css\` | Base component styles + per-component rules (\`#<id>\`) |
| \`app.js\` | Runtime helpers (section 3) and logic generated from your blocks (section 4) |
| \`data/data.js\` | Initial data of your models (also mirrored as \`data/<Model>.json\`) |
| \`assets/\` | Put images and other assets here |

## Customising

\`app.js\` is plain JavaScript. Each block script became a readable function / event handler,
so you can hand it to an AI assistant or edit it by hand for special behaviour.
Data entered while using the app is kept in \`localStorage\`.
`;

/**
 * @param {object} project
 * @param {{debug?:boolean, persist?:boolean}} opts  debug: tag statements with block ids (Preview).
 */
export function generate(project, opts = {}) {
  const debug = !!opts.debug;
  const persist = opts.persist !== false;
  const { js, used } = genJs(project, debug, persist);
  const anyAnim = used.has('anim') || allNodes(project).some(({ node }) => node.props.anim || node.props.animLoop || node.props.hover);
  const files = {
    'index.html': genHtml(project),
    'style.css': genCss(project, anyAnim),
    'app.js': js,
    'data/data.js': dataJs(project),
    'assets/.gitkeep': '',
    'README.md': commentLang(project) === 'ja' ? readmeJa(project) : readme(project),
  };
  files['app.js'] = localizeComments(files['app.js'], project);
  files['style.css'] = localizeComments(files['style.css'], project);
  files['data/data.js'] = localizeComments(files['data/data.js'], project);
  project.models.forEach((m) => { files[`data/${m.name}.json`] = JSON.stringify(m.rows, null, 2) + '\n'; });
  if ((project.assets || []).length) delete files['assets/.gitkeep'];
  for (const a of project.assets || []) files[`assets/${a.name}`] = dataUrlToBytes(a.data);
  if (opts.htmlOnly) { // design only: no scripts, no data
    files['index.html'] = files['index.html'].replace(/\s*<script src="[^"]*"><\/script>/g, '');
    for (const n of Object.keys(files)) if (n === 'app.js' || n.startsWith('data/')) delete files[n];
  }
  return files;
}

export function dataUrlToBytes(url) {
  const i = String(url).indexOf(',');
  const bin = atob(String(url).slice(i + 1));
  const out = new Uint8Array(bin.length);
  for (let k = 0; k < bin.length; k++) out[k] = bin.charCodeAt(k);
  return out;
}

/** Single self-contained HTML document for the Preview iframe (assets are inlined as data URLs). */
export function bundleInline(files, { debug = false, assets = [] } = {}) {
  const safe = (s) => s.replace(/<\/(script|style)/gi, '<\\/$1');
  const prelude = debug ? `<script>
var __cur = null;
function __at(id) { __cur = id; }
window.__codiramReport = function (e) {
  parent.postMessage({ codiram: 'error', block: __cur, message: String((e && e.message) || e) }, '*');
};
['log', 'info', 'warn'].forEach(function (l) {
  var orig = console[l];
  console[l] = function () {
    try { parent.postMessage({ codiram: 'log', level: l, text: Array.prototype.map.call(arguments, function (a) { return typeof a === 'object' ? JSON.stringify(a) : String(a); }).join(' ') }, '*'); } catch (e) { /* ignore */ }
    orig.apply(console, arguments);
  };
});
// variable monitor: report every change of "vars" (also inside arrays / objects) together with the block that was running
(function () {
  var last = {}, first = true;
  function clip(v) { var t = JSON.stringify(v); return t === undefined ? 'undefined' : t.length > 200 ? t.slice(0, 200) + '…' : t; }
  setInterval(function () {
    if (typeof vars === 'undefined') return;
    Object.keys(vars).forEach(function (k) {
      var now = clip(vars[k]);
      if (first || last[k] !== now) { try { parent.postMessage({ codiram: 'var', name: k, old: first ? undefined : last[k], value: now, block: __cur, t: Date.now() }, '*'); } catch (e) { /* ignore */ } last[k] = now; }
    });
    first = false;
  }, 120);
})();
window.addEventListener('error', function (ev) { window.__codiramReport(ev.error || ev.message); });
window.addEventListener('unhandledrejection', function (ev) { window.__codiramReport(ev.reason); });
</script>` : '';
  let html = files['index.html']
    .replace('<link rel="stylesheet" href="style.css">', () => `<style>${safe(files['style.css'])}</style>`)
    .replace('<script src="data/data.js"></script>', () => `${prelude}<script>${safe(files['data/data.js'])}</script>`)
    .replace('<script src="app.js"></script>', () => `<script>${safe(files['app.js'])}</script>`);
  for (const a of [...assets].sort((x, y) => y.name.length - x.name.length)) html = html.split('assets/' + a.name).join(a.data);
  return html;
}

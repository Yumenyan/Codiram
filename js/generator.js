// Project -> ordinary web files (index.html / style.css / app.js / data/ / README.md).
// Pure string generation (no DOM) so it also runs under Node for tests.
import { components, blocks } from './registry.js';
import './components.js';
import './blocks.js';
import { BASE_CSS, cssDecls, renderNode } from './components.js';
import { allNodes, walk, defaultFor, nextRowId } from './model.js';
import { esc } from './util.js';

const GLOBALS = new Set(['Math', 'Number', 'String', 'Boolean', 'Date', 'JSON', 'Array', 'Object', 'parseInt', 'parseFloat',
  'isNaN', 'Infinity', 'NaN', 'true', 'false', 'null', 'undefined', 'typeof', 'new', 'in', 'of', 'instanceof']);
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

function compileCond(c, env) {
  if (!c || !c.rows || !c.rows.length) return 'true';
  const parts = c.rows.map((r) => {
    if (r.op === 'js') return `(${compileExpr(r.l, env) === q(String(r.l).trim()) ? 'false' : compileExpr(r.l, env)})`;
    const L = compileExpr(r.l, env), R = compileExpr(r.r, env);
    switch (r.op) {
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
  let counter = 0;
  const g = {
    env,
    expr: (s) => compileExpr(s, env),
    cond: (c) => compileCond(c, env),
    comp: (id) => q(id || ''),
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
        if (!def) { lines.push(`// (unknown block: ${b.type})`); continue; }
        lines.push(`// ${def.title}`);
        if (debug) lines.push(`__at(${q(b.id)});`);
        lines.push(...def.gen(b, g));
      }
      return lines;
    },
  };
  return g;
}

function genCss(project) {
  const out = [BASE_CSS, 'body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Noto Sans JP", sans-serif; color: #1f2328; background: #fff; }',
    '.page { min-height: 100vh; }', '', '/* ---- Component styles ---- */'];
  for (const { node } of allNodes(project)) {
    const def = components.get(node.type);
    const decls = cssDecls(node);
    if (!decls.length) continue;
    out.push(`/* ${node.name} (${node.type}) */`, `#${node.id}${def?.cssTarget || ''} {`, ...decls.map((d) => `  ${d};`), '}');
  }
  return out.join('\n') + '\n';
}

function genHtml(project) {
  const ctx = { project, editor: false };
  const pages = project.pages.map((p, i) => {
    const body = (p.root.children || []).map((c) => renderNode(c, ctx)).join('\n    ');
    const hidden = i === 0 ? '' : ' hidden';
    return `  <section id="${p.root.id}" class="page cx cx-page" data-page="${esc(p.id)}"${hidden}>\n    ${body}\n  </section>`;
  });
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(project.settings?.title || project.name)}</title>
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
  return String(v.initial ?? '');
}

function genJs(project, debug, persist) {
  const g = makeCtx(project, debug);
  const models = {};
  project.models.forEach((m) => {
    models[m.name] = { fields: m.fields.map((f) => f.name), types: Object.fromEntries(m.fields.map((f) => [f.name, f.type])) };
  });
  const vars = Object.fromEntries(project.variables.map((v) => [v.name, typedVar(v)]));
  const L = [];
  L.push(`/* ${project.name} — generated by Codiram. Plain JavaScript: edit freely. */`, '"use strict";', '');
  L.push('// ===== 1. Data models =====', `const MODELS = ${JSON.stringify(models, null, 2)};`, '');
  L.push('// ===== 2. State =====', `const vars = ${JSON.stringify(vars, null, 2)};`,
    `const APP_ID = ${q(project.id)};`, `const PERSIST = ${persist ? 'true' : 'false'};`, 'const data = loadData();', '');
  L.push(RUNTIME, '');
  L.push('// ===== 4. Logic (generated from blocks) =====');
  for (const s of project.scripts) {
    const def = blocks.get(s.hat.type);
    if (!def) continue;
    L.push('', `// ▶ ${s.name || (def.summary ? def.summary(s.hat.args, project) : def.title)}`);
    if (debug) {
      // hats are not statements; tag them so errors thrown in setup can be traced
    }
    L.push(...def.gen({ id: 'hat:' + s.id, type: s.hat.type, args: s.hat.args }, g, g.stack(s.body)));
  }
  L.push('', '// ===== 5. Start =====', 'boot();', '');
  return L.join('\n');
}

const RUNTIME = String.raw`// ===== 3. Runtime helpers =====
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fns = {};
const pageHandlers = {};
const dataHandlers = {};
let currentPage = null;

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
async function callFn(name) {
  if (!fns[name]) throw new Error("関数が定義されていません: " + name);
  await fns[name]();
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
function interpolate(template, row) {
  return String(template).replace(/\{([^{}]+)\}/g, (m, key) => {
    key = key.trim();
    if (row && key in row) return row[key];
    if (key in vars) return vars[key];
    return m;
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
  document.querySelectorAll("[data-source]").forEach(renderCollection);
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
      cols.forEach((c) => { tr.insertCell().textContent = cell(row[c]); });
      if (el.hasAttribute("data-delete")) {
        const btn = document.createElement("button");
        btn.textContent = "削除";
        btn.type = "button";
        btn.addEventListener("click", () => { data[name] = data[name].filter((r) => r._id !== row._id); touch(name); });
        tr.insertCell().append(btn);
      }
    });
  } else {
    const tpl = el.dataset.template || "{" + (model.fields[0] || "id") + "}";
    rows.forEach((row) => { const li = document.createElement("li"); li.textContent = interpolate(tpl, row); el.append(li); });
  }
}
function cell(v) { return v !== null && typeof v === "object" ? JSON.stringify(v) : v == null ? "" : String(v); }

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
  if (t === "Boolean") return v === true || v === "true";
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

// ---- start up ----
function boot() {
  document.querySelectorAll("[data-bind]").forEach((el) => {
    const input = inputOf(el);
    const ev = input.type === "checkbox" || input.tagName === "SELECT" ? "change" : "input";
    input.addEventListener(ev, () => { vars[el.dataset.bind] = readInput(input); refresh(); });
    if (!(el.dataset.bind in vars)) vars[el.dataset.bind] = readInput(input);
  });
  const first = document.querySelector(".page");
  showPage(first ? first.dataset.page : null);
}`;

const dataJs = (project) => {
  const d = {};
  project.models.forEach((m) => { d[m.name] = m.rows; });
  return `// Initial data (edit in Codiram's Data view, or here).\nwindow.CODIRAM_DATA = ${JSON.stringify(d, null, 2)};\n`;
};

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
  const files = {
    'index.html': genHtml(project),
    'style.css': genCss(project),
    'app.js': genJs(project, debug, persist),
    'data/data.js': dataJs(project),
    'assets/.gitkeep': '',
    'README.md': readme(project),
  };
  project.models.forEach((m) => { files[`data/${m.name}.json`] = JSON.stringify(m.rows, null, 2) + '\n'; });
  return files;
}

/** Single self-contained HTML document for the Preview iframe. */
export function bundleInline(files, { debug = false } = {}) {
  const safe = (s) => s.replace(/<\/(script|style)/gi, '<\\/$1');
  const prelude = debug ? `<script>
var __cur = null;
function __at(id) { __cur = id; }
window.__codiramReport = function (e) {
  parent.postMessage({ codiram: 'error', block: __cur, message: String((e && e.message) || e) }, '*');
};
window.addEventListener('error', function (ev) { window.__codiramReport(ev.error || ev.message); });
window.addEventListener('unhandledrejection', function (ev) { window.__codiramReport(ev.reason); });
</script>` : '';
  return files['index.html']
    .replace('<link rel="stylesheet" href="style.css">', () => `<style>${safe(files['style.css'])}</style>`)
    .replace('<script src="data/data.js"></script>', () => `${prelude}<script>${safe(files['data/data.js'])}</script>`)
    .replace('<script src="app.js"></script>', () => `<script>${safe(files['app.js'])}</script>`);
}

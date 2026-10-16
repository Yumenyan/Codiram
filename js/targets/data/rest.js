// REST API / Node server generators: CRUD endpoints for every data model (Node.js, no dependencies).
//   rest-api    : the API only (+ openapi.json)
//   node-server : the API + the Web app served from public/
import { defineGenerator } from '../../sdk/index.js';
import { J } from '../../i18n-helpers.js';
import { cm, noteFor } from '../../comments.js';
import { json, projectFile } from '../../sdk/emit.js';
import { modelsOf, checkModels } from './model.js';
import { generate as generateWeb } from '../../generator.js';

const jsType = (f) => ({ Number: 'number', Boolean: 'boolean', Array: 'array', Object: 'object', Relation: 'number' }[f.type] || 'string');

const serverJs = (project, models, { withStatic }) => {
  const t = cm(project);
  const spec = Object.fromEntries(models.map((m) => [m.table, { fields: Object.fromEntries(m.fields.map((f) => [f.name, jsType(f)])) }]));
  return `"use strict";
// ${project.name} — ${noteFor(project, 'Node.js')}
const http = require("http");
const fs = require("fs");
const path = require("path");

// ${t('モデルごとのデータ(data/<テーブル名>.json)と項目の型', 'Data per model (data/<table>.json) and the type of every field')}
const MODELS = ${JSON.stringify(spec, null, 2)};
const DATA_DIR = path.join(__dirname, "data");
${withStatic ? 'const PUBLIC_DIR = path.join(__dirname, "public");\nconst MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };\n' : ''}
function load(table) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, table + ".json"), "utf8")); } catch (e) { return []; }
}
const cache = {}; // rows stay in memory while the server runs
const rowsOf = (table) => cache[table] || (cache[table] = load(table));
function save(table, rows) {
  if (process.env.PERSIST === "1") fs.writeFileSync(path.join(DATA_DIR, table + ".json"), JSON.stringify(rows, null, 2));
}

// ${t('受け取った値を項目の型に合わせる(合わなければ null)', 'Coerces incoming values to the field types (null when they do not fit)')}
function coerce(table, body) {
  const out = {};
  for (const [name, type] of Object.entries(MODELS[table].fields)) {
    if (!(name in body)) continue;
    const v = body[name];
    if (type === "number") out[name] = v === "" || v === null ? null : Number.isFinite(Number(v)) ? Number(v) : null;
    else if (type === "boolean") out[name] = v === true || v === "true" || v === 1;
    else if (type === "array") out[name] = Array.isArray(v) ? v : null;
    else if (type === "object") out[name] = v && typeof v === "object" && !Array.isArray(v) ? v : null;
    else out[name] = v === null || v === undefined ? "" : String(v);
  }
  return out;
}

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let text = "";
    req.on("data", (c) => { text += c; });
    req.on("end", () => { try { resolve(text ? JSON.parse(text) : {}); } catch (e) { resolve(null); } });
  });
}

${t('// /api/<テーブル名> と /api/<テーブル名>/<id> を処理する', '// Handles /api/<table> and /api/<table>/<id>')}
async function api(req, res, parts) {
  const table = parts[1];
  if (!MODELS[table]) return send(res, 404, { error: "unknown table: " + table });
  const rows = rowsOf(table);
  const id = parts[2] === undefined ? null : Number(parts[2]);
  if (req.method === "OPTIONS") return send(res, 204);
  if (req.method === "GET") {
    if (id === null) return send(res, 200, rows);
    const row = rows.find((r) => r._id === id);
    return row ? send(res, 200, row) : send(res, 404, { error: "not found" });
  }
  if (req.method === "POST" && id === null) {
    const body = await readBody(req);
    if (body === null) return send(res, 400, { error: "invalid JSON" });
    const row = { _id: rows.reduce((m, r) => Math.max(m, r._id || 0), 0) + 1, ...coerce(table, body) };
    rows.push(row); save(table, rows);
    return send(res, 201, row);
  }
  if ((req.method === "PUT" || req.method === "DELETE") && id !== null) {
    const index = rows.findIndex((r) => r._id === id);
    if (index < 0) return send(res, 404, { error: "not found" });
    if (req.method === "DELETE") { rows.splice(index, 1); save(table, rows); return send(res, 204); }
    const body = await readBody(req);
    if (body === null) return send(res, 400, { error: "invalid JSON" });
    rows[index] = { ...rows[index], ...coerce(table, body), _id: id }; save(table, rows);
    return send(res, 200, rows[index]);
  }
  return send(res, 405, { error: "method not allowed" });
}

function createServer() {
  return http.createServer(async (req, res) => {
    const parts = new URL(req.url, "http://localhost").pathname.split("/").filter(Boolean);
    if (parts[0] === "api") return api(req, res, parts);
${withStatic ? `    // ${t('それ以外は public/ の静的ファイル', 'everything else: static files from public/')}
    const file = path.join(PUBLIC_DIR, parts.length ? path.normalize(parts.join("/")) : "index.html");
    if (!file.startsWith(PUBLIC_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    return fs.createReadStream(file).pipe(res);` : '    return send(res, 404, { error: "not found" });'}
  });
}

if (require.main === module) {
  const port = process.env.PORT || 3000;
  createServer().listen(port, () => console.log("http://localhost:" + port));
}
module.exports = { createServer };
`;
};

const selftest = (models, withStatic) => {
  const m = models[0];
  const sample = m ? Object.fromEntries(m.fields.filter((f) => f.type === 'String').slice(0, 1).map((f) => [f.name, 'selftest'])) : {};
  return `"use strict";
// Starts the server on a free port, runs create / read / update / delete against the first table, prints "ok".
const assert = require("assert");
const { createServer } = require("./server.js");

const server = createServer().listen(0, async () => {
  const base = "http://127.0.0.1:" + server.address().port;
  try {
${m ? `    const table = ${JSON.stringify(m.table)};
    const before = await (await fetch(base + "/api/" + table)).json();
    const created = await (await fetch(base + "/api/" + table, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(${JSON.stringify(sample)}) })).json();
    assert.ok(created._id, "created row has an _id");
    const after = await (await fetch(base + "/api/" + table)).json();
    assert.strictEqual(after.length, before.length + 1);
    const one = await fetch(base + "/api/" + table + "/" + created._id);
    assert.strictEqual(one.status, 200);
    const upd = await fetch(base + "/api/" + table + "/" + created._id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(${JSON.stringify(sample)}) });
    assert.strictEqual(upd.status, 200);
    const del = await fetch(base + "/api/" + table + "/" + created._id, { method: "DELETE" });
    assert.strictEqual(del.status, 204);
    assert.strictEqual((await fetch(base + "/api/" + table + "/" + created._id)).status, 404);` : '    assert.strictEqual((await fetch(base + "/api/none")).status, 404);'}
${withStatic ? '    assert.strictEqual((await fetch(base + "/")).status, 200);' : ''}
    console.log("ok");
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
`;
};

const openapi = (project, models) => ({
  openapi: '3.0.3', info: { title: project.name, version: '0.1.0' },
  paths: Object.fromEntries(models.flatMap((m) => [
    [`/api/${m.table}`, { get: { summary: `List ${m.name}`, responses: { 200: { description: 'OK' } } }, post: { summary: `Create ${m.name}`, responses: { 201: { description: 'Created' } } } }],
    [`/api/${m.table}/{id}`, { get: { summary: `Get ${m.name}`, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'OK' }, 404: { description: 'Not found' } } },
      put: { summary: `Update ${m.name}`, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'OK' } } },
      delete: { summary: `Delete ${m.name}`, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 204: { description: 'Deleted' } } } }],
  ])),
});

function build(project, { withStatic }) {
  const t = cm(project), models = modelsOf(project), files = {};
  files['server.js'] = serverJs(project, models, { withStatic });
  files['selftest.js'] = selftest(models, withStatic);
  for (const m of models) files[`data/${m.table}.json`] = json(m.rows.map((r) => ({ _id: r._id, ...Object.fromEntries(m.fields.map((f) => [f.name, r[f.name] ?? null])) })));
  files['openapi.json'] = json(openapi(project, models));
  files['package.json'] = json({ name: (project.name || 'app').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'app', version: '0.1.0', private: true, scripts: { start: 'node server.js', test: 'node selftest.js' } });
  if (withStatic) {
    const web = generateWeb(project);
    for (const [n, c] of Object.entries(web)) if (n !== 'README.md') files['public/' + n] = c;
  }
  files['README.md'] = `# ${project.name}\n\n${t('Codiram のデータモデルから生成した', 'A')} ${withStatic ? t('Node.js サーバー(API + Web アプリ)', 'Node.js server (API + web app)') : 'REST API'} ${t('です。依存パッケージはありません。', 'generated from the Codiram data models. No dependencies.')}\n\n\`\`\`sh\nnpm start        # http://localhost:3000${withStatic ? '' : '/api/<table>'}\nnpm test         # self test\nPERSIST=1 npm start   # ${t('変更を data/*.json に保存', 'save changes to data/*.json')}\n\`\`\`\n\n| ${t('メソッドとパス', 'Method and path')} | |\n|---|---|\n${models.map((m) => `| \`GET/POST /api/${m.table}\`, \`GET/PUT/DELETE /api/${m.table}/:id\` | ${m.name} |`).join('\n')}\n\nopenapi.json ${t('に API の説明があります。', 'describes the API.')}\n`;
  files['.gitignore'] = 'node_modules\n';
  files['codiram.project.json'] = projectFile(project);
  return { files, problems: checkModels(project), root: withStatic ? 'node-server' : 'rest-api', entry: 'server.js' };
}

const verify = (extra = []) => ({ requiredFiles: ['server.js', 'selftest.js', 'package.json', 'openapi.json', ...extra], json: ['package.json', 'openapi.json'], syntax: { js: ['server.js', 'selftest.js'] }, run: { tool: 'node', args: ['selftest.js'] } });
defineGenerator({
  id: 'rest-api', order: 6.3, engine: 'data',
  name: J('REST API (Node.js)', 'REST API (Node.js)'), icon: '🔌', desc: J('データモデルごとの CRUD API(依存なしの Node.js)と OpenAPI 定義', 'CRUD API for every data model (dependency-free Node.js) with an OpenAPI file'),
  version: '0.1.0', language: ['javascript'], platforms: ['node'], supports: ['data', 'server', 'http'], views: ['data', 'output'],
  defaultConfig: () => ({ type: 'rest-api' }), generate: (project) => build(project, { withStatic: false }), verify: verify(),
});
defineGenerator({
  id: 'node-server', order: 6.4, engine: 'blocks', inherits: 'web',
  name: J('Node サーバー(API + Web)', 'Node server (API + web)'), icon: '🖧', desc: J('Web アプリを public/ から配信し、データモデルの CRUD API も提供する Node.js サーバー', 'Node.js server that serves the web app from public/ and a CRUD API for the data models'),
  version: '0.1.0', language: ['javascript'], platforms: ['node'], supports: ['data', 'server', 'http'], views: ['design', 'data', 'logic', 'preview'],
  defaultConfig: () => ({ type: 'node-server' }), generate: (project) => build(project, { withStatic: true }), verify: verify(['public/index.html']),
});

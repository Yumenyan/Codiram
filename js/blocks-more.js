// Forms, tabs, maps, CSV, files, WebSocket, custom JavaScript, function calls as value blocks.
import { stmt, hat, E, q, ind } from './blocks.js';
import { blocks } from './registry.js';
import { J } from './i18n-helpers.js';
import { R } from './blocks-reporters.js';

const X = (ph) => ({ t: 'expr', ph });
const to = { t: 'var' };
const opts = (arr) => arr.map(([v, ja, en]) => [v, J(ja, en)]);
const B = (type, cat, icon, ja, en, parts, fields, defaults, gen, slots) => {
  stmt(type, cat, icon, ja, parts, fields, defaults, gen, slots);
  const d = blocks.get(type);
  d.en = en;
  d.reporter = !!(fields.to && !fields.to.opt && !slots);
};
const out = (b, js) => [`setVar(${q(b.args.to)}, ${js});`];
const num = (g, x) => `Number(${g.expr(x)})`;

// ---- events
hat('onSubmit', J('フォームが送信されたとき', 'When a form is submitted').ja, [J('フォーム', 'When form'), E('target'), J('が送信されたとき', 'is submitted')],
  { target: { t: 'comp', types: ['form'] } }, { target: '' },
  (b, g, body) => [`on(${g.comp(b.args.target)}, "submit", async () => {`, ...ind(body), '});']);
blocks.get('onSubmit').en = 'When a form is submitted';
hat('onWsMessage', 'WebSocketでメッセージを受け取ったとき', [J('WebSocketでメッセージを受信したとき', 'When a WebSocket message arrives')], {}, {},
  (b, g, body) => { g.use('ws'); return ['onWs(async () => {', ...ind(body), '});']; });
blocks.get('onWsMessage').en = 'When a WebSocket message arrives';

// ---- UI: tabs / form / map
B('tab_select', 'UI', '⊟', 'タブを切り替え', 'Select tab', [J('タブ', 'Tabs'), E('t'), J('の', ': switch to tab'), E('i'), J('番目(0から)を表示', '(0-based)')],
  { t: { t: 'comp', types: ['tabs'] }, i: X('0') }, { t: '', i: '0' }, (b, g) => [`selectTab(${g.comp(b.args.t)}, ${num(g, b.args.i)});`]);
B('form_reset', 'UI', '↺', 'フォームをリセット', 'Reset form', [J('フォーム', 'Reset form'), E('t'), J('の入力を空にする', '')],
  { t: { t: 'comp', types: ['form'] } }, { t: '' }, (b, g) => [`{ const f = $(${g.comp(b.args.t)}); if (f) { f.reset(); setTimeout(() => { f.querySelectorAll("[data-bind]").forEach((el) => { const i = inputOf(el); vars[el.dataset.bind] = i.type === "checkbox" ? false : ""; }); refresh(); }); } }`]);
B('map_set', 'UI', '🗺', '地図を移動', 'Move map', [J('地図', 'Map'), E('t'), J('を 緯度', ': go to lat'), E('lat'), J('経度', 'lon'), E('lon'), J('ズーム', 'zoom'), E('z'), J('に移動', '')],
  { t: { t: 'comp', types: ['map'] }, lat: X('35.68'), lon: X('139.76'), z: X('14') }, { t: '', lat: '35.6812', lon: '139.7671', z: '14' },
  (b, g) => { g.use('map'); return [`setMap(${g.comp(b.args.t)}, ${num(g, b.args.lat)}, ${num(g, b.args.lon)}, ${num(g, b.args.z)});`]; });

// ---- data: CSV / files
B('csv_download', 'Data', '⬇', 'CSVをダウンロード', 'Download CSV', [J('データ', 'Download'), E('model'), J('をCSVファイルとして保存', 'as a CSV file')],
  { model: { t: 'model' } }, { model: '' }, (b, g) => { g.use('csv'); g.use('sys'); return [`downloadText(${q((b.args.model || 'data') + '.csv')}, toCsv(${q(b.args.model)}));`]; });
B('csv_text', 'Data', '≡', 'CSV文字列にする', 'To CSV text', [J('変数', 'Set'), E('to'), J('に', 'to'), E('model'), J('のCSV文字列を入れる', 'as CSV text')],
  { to, model: { t: 'model' } }, { to: '', model: '' }, (b, g) => { g.use('csv'); return out(b, `toCsv(${q(b.args.model)})`); });
B('csv_import', 'Data', '⬆', 'CSVを読み込んで追加', 'Import CSV rows', [J('データ', 'Add rows to'), E('model'), J('に CSV文字列', 'from CSV text'), E('text'), J('の行を追加', '')],
  { model: { t: 'model' }, text: X('fileText') }, { model: '', text: '' }, (b, g) => { g.use('csv'); return [`importCsv(${q(b.args.model)}, ${g.expr(b.args.text)});`]; });
B('file_read', 'System', '📎', 'ファイルを読み込む', 'Read chosen file', [J('変数', 'Set'), E('to'), J('に', 'to'), E('t'), J('で選ばれたファイルの', ': chosen file as'), E('mode')],
  { to, t: { t: 'comp', types: ['fileinput'] }, mode: { t: 'select', opts: opts([['text', 'テキスト', 'text'], ['dataurl', 'データURL(画像など)', 'data URL (images…)']]) } }, { to: '', t: '', mode: 'text' },
  (b, g) => { g.use('sys'); g.use('file'); return out(b, `await readFile(${g.comp(b.args.t)}, ${q(b.args.mode)})`); });

// ---- WebSocket
B('ws_connect', 'System', '🔌', 'WebSocketに接続', 'Connect WebSocket', [J('WebSocket', 'Connect to'), E('url'), J('に接続', '')],
  { url: X('"wss://echo.websocket.org"') }, { url: '"wss://"' }, (b, g) => { g.use('ws'); return [`wsConnect(${g.expr(b.args.url)});`]; });
B('ws_send', 'System', '📤', 'WebSocketで送信', 'Send over WebSocket', [J('WebSocketで', 'Send'), E('msg'), J('を送信', 'over WebSocket')],
  { msg: X() }, { msg: '' }, (b, g) => { g.use('ws'); return [`wsSend(${g.expr(b.args.msg)});`]; });
B('ws_close', 'System', '⏏', 'WebSocketを切断', 'Close WebSocket', [J('WebSocketを切断', 'Close WebSocket')], {}, {}, (b, g) => { g.use('ws'); return ['wsClose();']; });
R('r_ws_message', 'System', '📥', '最後に受信したメッセージ', 'Last WebSocket message', [J('受信メッセージ', 'received message')], {}, {}, (b, g) => { g.use('ws'); return 'wsMessage'; });

// ---- advanced: custom JS + function value block
B('js_run', 'System', '＜/＞', 'JavaScriptを実行(上級)', 'Run JavaScript (advanced)', [J('JavaScript', 'JavaScript:'), E('code')],
  { code: { t: 'code', ph: 'console.log(vars)' } }, { code: '' },
  (b) => ['// custom JavaScript', ...String(b.args.code || '').split('\n')]);
R('r_call', 'Control', 'ƒ', '関数の結果', 'Function result', [J('関数', 'call'), E('name'), J('を引数', 'with'), E('args'), J('で実行した結果', '')],
  { name: { t: 'fn' }, args: { t: 'text', ph: '1, 2' } }, { name: '', args: '' }, (b, g) => `(await callFn(${q(b.args.name)}, ${g.exprList(b.args.args)}))`);

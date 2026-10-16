// Block definitions. Each block knows how to describe itself (parts/fields) and how to
// generate readable JavaScript (gen). Plugins can register more via registerBlock().
import { registerBlock, blocks } from './registry.js';
import { allNodes } from './model.js';
import { tf } from './i18n.js';
import { J } from './i18n-helpers.js';
/** title may be a string (Japanese) or { ja, en } */
const ttl = (t) => (typeof t === 'object' ? { title: t.ja, en: t.en } : { title: t });

export const COND_OPS = [
  ['==', '＝'], ['!=', '≠'], ['>', '＞'], ['<', '＜'], ['>=', '≧'], ['<=', '≦'],
  ['true', J('が真', 'is true')], ['contains', J('含む', 'contains')], ['empty', J('空', 'is empty')], ['notempty', J('空でない', 'is not empty')], ['js', J('式(JS)', 'JS expression')],
];
export const defaultCond = () => ({ rows: [{ l: '', op: '==', r: '' }], join: 'and', not: false });

const nodeName = (project, id) => allNodes(project).find((x) => x.node.id === id)?.node.name || '(未選択)';
export const q = (s) => JSON.stringify(String(s ?? ''));
export const ind = (lines) => lines.map((l) => '  ' + l);

export const E = (key) => ({ f: key });
export const hat = (type, title, parts, fields, defaults, gen, summary) =>
  registerBlock({ type, cat: 'Events', kind: 'hat', icon: '⚡', ...ttl(title), parts, fields, defaults, gen, summary });
export const stmt = (type, cat, icon, title, parts, fields, defaults, gen, slots) =>
  registerBlock({ type, cat, kind: 'stmt', icon, ...ttl(title), parts, fields, defaults, gen, slots });

// ---------------- Events ----------------
const T = J; // shorthand: T('日本語', 'English')

hat('onClick', T('ボタンがクリックされたとき', 'When clicked'), [T('クリックされたとき:', 'When clicked:'), E('target')],
  { target: { t: 'comp' } }, { target: '' },
  (b, g, body) => [`on(${g.comp(b.args.target)}, "click", async () => {`, ...ind(body), '});'],
  (a, p) => tf('{0} クリック', nodeName(p, a.target)));

hat('onChange', T('入力が変更されたとき', 'When input changes'), [T('変更されたとき:', 'When changed:'), E('target')],
  { target: { t: 'comp' } }, { target: '' },
  (b, g, body) => [`on(${g.comp(b.args.target)}, "change", async () => {`, ...ind(body), '});'],
  (a, p) => tf('{0} 変更', nodeName(p, a.target)));

hat('onLoad', T('ページが読み込まれたとき', 'When a page is shown'), [T('ページ', 'When page'), E('page'), T('が表示されたとき', 'is shown')],
  { page: { t: 'page', required: true } }, { page: '' },
  (b, g, body) => [`onPage(${q(b.args.page)}, async () => {`, ...ind(body), '});'],
  (a, p) => tf('ページ「{0}」表示時', p.pages.find((x) => x.id === a.page)?.name || '?'));

hat('onTimer', T('タイマー', 'Timer'), [T('', 'Every'), E('ms'), T('ミリ秒ごとに', 'ms')],
  { ms: { t: 'expr', ph: '1000' } }, { ms: '1000' },
  (b, g, body) => [`every(${g.expr(b.args.ms)}, async () => {`, ...ind(body), '});'],
  (a) => tf('タイマー {0}ms', a.ms));

hat('onDataChanged', T('データが変更されたとき', 'When data changes'), [T('データ', 'When data'), E('model'), T('が変更されたとき', 'changes')],
  { model: { t: 'model' } }, { model: '' },
  (b, g, body) => [`onData(${q(b.args.model)}, async () => {`, ...ind(body), '});'],
  (a) => tf('データ {0} 変更', a.model || '?'));

hat('onFunction', T('関数を定義', 'Define function'), [T('関数', 'Define function'), E('name'), T('を定義', '')],
  { name: { t: 'text', ph: '駅を検索する' } }, { name: '' },
  (b, g, body) => [`fns[${q(b.args.name)}] = async () => {`, ...ind(body), '};'],
  (a) => tf('関数 {0}', a.name || '(無名)'));

// ---------------- Variables ----------------
stmt('set_var', 'Variables', '＝', T('変数に値を設定', 'Set variable'), [T('変数', 'Set variable'), E('name'), T('を', 'to'), E('value'), T('にする', '')],
  { name: { t: 'var' }, value: { t: 'expr', ph: 'count + 1 / "text"' } }, { name: '', value: '' },
  (b, g) => [`setVar(${q(b.args.name)}, ${g.expr(b.args.value)});`]);

stmt('change_var', 'Variables', '±', T('変数を増減', 'Change variable'), [T('変数', 'Change variable'), E('name'), T('を', 'by'), E('by'), T('増やす', '')],
  { name: { t: 'var' }, by: { t: 'expr', ph: '1' } }, { name: '', by: '1' },
  (b, g) => [`changeVar(${q(b.args.name)}, ${g.expr(b.args.by)});`]);

// ---------------- Control / Conditions ----------------
stmt('if', 'Conditions', '？', T('条件分岐', 'If / else'), [T('もし', 'If'), E('cond')],
  { cond: { t: 'cond' } }, { cond: defaultCond() },
  (b, g) => {
    const out = [`if (${g.cond(b.args.cond)}) {`, ...ind(g.stack(b.slots.then)), '}'];
    if (b.slots.else.length) out.push('else {', ...ind(g.stack(b.slots.else)), '}');
    return out;
  },
  [{ key: 'then', label: T('なら', 'then') }, { key: 'else', label: T('そうでなければ', 'else') }]);

stmt('repeat', 'Control', '↻', T('繰り返し', 'Repeat'), [E('times'), T('回繰り返す', 'times')],
  { times: { t: 'expr', ph: '10' } }, { times: '10' },
  (b, g) => { const i = g.uid('i'); return [`for (let ${i} = 0; ${i} < Number(${g.expr(b.args.times)}); ${i}++) {`, ...ind(g.loop(() => g.stack(b.slots.body))), '}']; },
  [{ key: 'body', label: T('繰り返す内容', 'Repeat') }]);

stmt('foreach', 'Control', '∀', T('各行に対して処理', 'For each row'), [T('データ', 'For each row of'), E('model'), T('の各行を', 'as'), E('item'), T('として', '')],
  { model: { t: 'model' }, item: { t: 'ident', ph: 'item' } }, { model: '', item: 'item' },
  (b, g) => {
    const it = b.args.item || 'item';
    return [`for (const ${it} of [...(data[${q(b.args.model)}] || [])]) {`, ...ind(g.loop(() => g.scoped([it], () => g.stack(b.slots.body)))), '}'];
  },
  [{ key: 'body', label: T('各行に対して', 'For each row') }]);

stmt('wait', 'Control', '⏱', T('待つ', 'Wait'), [T('', 'Wait'), E('ms'), T('ミリ秒待つ', 'ms')],
  { ms: { t: 'expr', ph: '1000' } }, { ms: '1000' },
  (b, g) => [`await sleep(${g.expr(b.args.ms)});`]);

stmt('call_fn', 'Control', 'ƒ', T('関数を実行', 'Call function'), [T('関数', 'Call function'), E('name'), T('を実行する', '')],
  { name: { t: 'fn' } }, { name: '' },
  (b, g) => [`await callFn(${q(b.args.name)});`]);

// ---------------- Data ----------------
stmt('add_row', 'Data', '＋', T('行を追加 (Create)', 'Add row (Create)'), [T('データ', 'Add to'), E('model'), T('に行を追加:', ':'), E('values')],
  { model: { t: 'model' }, values: { t: 'values' } }, { model: '', values: {} },
  (b, g) => {
    const pairs = Object.entries(b.args.values || {}).filter(([, v]) => String(v).trim() !== '')
      .map(([k, v]) => `${/^[\p{L}_$][\p{L}\p{N}_$]*$/u.test(k) ? k : q(k)}: ${g.expr(v)}`);
    return [`addRow(${q(b.args.model)}, { ${pairs.join(', ')} });`];
  });

stmt('delete_rows', 'Data', '✕', T('行を削除 (Delete)', 'Delete rows (Delete)'), [T('データ', 'From'), E('model'), T('から', ': delete rows where'), E('cond'), T('の行を削除', '')],
  { model: { t: 'model' }, cond: { t: 'cond', scope: ['item'] } }, { model: '', cond: { rows: [{ l: 'item.id', op: '==', r: '' }], join: 'and', not: false } },
  (b, g) => [`deleteWhere(${q(b.args.model)}, (item) => ${g.scoped(['item'], () => g.cond(b.args.cond))});`]);

stmt('clear_rows', 'Data', '⌫', T('全行を削除', 'Clear all rows'), [T('データ', 'Delete all rows of'), E('model'), T('の全ての行を削除', '')],
  { model: { t: 'model' } }, { model: '' },
  (b, g) => [`clearRows(${q(b.args.model)});`]);

stmt('update_rows', 'Data', '✎', T('行を更新 (Update)', 'Update rows (Update)'), [T('データ', 'In'), E('model'), T('で', ': rows where'), E('cond'), T('の行の', ', set'), E('field'), T('を', 'to'), E('value'), T('にする', '')],
  { model: { t: 'model' }, cond: { t: 'cond', scope: ['item'] }, field: { t: 'fieldname' }, value: { t: 'expr' } },
  { model: '', cond: { rows: [{ l: 'item.id', op: '==', r: '' }], join: 'and', not: false }, field: '', value: '' },
  (b, g) => [`updateWhere(${q(b.args.model)}, (item) => ${g.scoped(['item'], () => g.cond(b.args.cond))}, ${q(b.args.field)}, ${g.expr(b.args.value)});`]);

stmt('find_row', 'Data', '⌕', T('行を検索 (Find)', 'Find row (Find)'), [T('変数', 'Set'), E('var'), T('に', 'to the'), E('model'), T('で', 'value of'), E('cond'), T('の最初の行の', 'in the first row where'), E('field'), T('を入れる', '')],
  { var: { t: 'var' }, model: { t: 'model' }, cond: { t: 'cond', scope: ['item'] }, field: { t: 'fieldname' } },
  { var: '', model: '', cond: { rows: [{ l: 'item.id', op: '==', r: '' }], join: 'and', not: false }, field: '' },
  (b, g) => [`{ const row = findRow(${q(b.args.model)}, (item) => ${g.scoped(['item'], () => g.cond(b.args.cond))}); setVar(${q(b.args.var)}, row ? row[${q(b.args.field)}] : ""); }`]);

stmt('sort_rows', 'Data', '⇅', T('並べ替え (Sort)', 'Sort rows (Sort)'), [T('データ', 'Sort'), E('model'), T('を', 'by'), E('field'), T('で', ','), E('order'), T('に並べ替える', '')],
  { model: { t: 'model' }, field: { t: 'fieldname' }, order: { t: 'select', opts: [['asc', T('昇順', 'ascending')], ['desc', T('降順', 'descending')]] } }, { model: '', field: '', order: 'asc' },
  (b, g) => [`sortRows(${q(b.args.model)}, ${q(b.args.field)}, ${b.args.order === 'desc'});`]);

// ---------------- UI ----------------
const uiStmt = (type, icon, title, parts, fields, defaults, gen) => stmt(type, 'UI', icon, title, parts, fields, defaults, gen);
uiStmt('set_text', 'T', T('テキストを設定', 'Set text'), [E('target'), T('の表示を', ': set text to'), E('value'), T('にする', '')],
  { target: { t: 'comp' }, value: { t: 'expr', ph: 'count' } }, { target: '', value: '' },
  (b, g) => [`setText(${g.comp(b.args.target)}, ${g.expr(b.args.value)});`]);
uiStmt('set_value', '✎', T('値を設定', 'Set value'), [E('target'), T('の値を', ': set value to'), E('value'), T('にする', '')],
  { target: { t: 'comp' }, value: { t: 'expr' } }, { target: '', value: '' },
  (b, g) => [`setValue(${g.comp(b.args.target)}, ${g.expr(b.args.value)});`]);
uiStmt('show', '👁', T('表示する', 'Show'), [E('target'), T('を表示する', ': show')], { target: { t: 'comp' } }, { target: '' },
  (b, g) => [`setVisible(${g.comp(b.args.target)}, true);`]);
uiStmt('hide', '🚫', T('非表示にする', 'Hide'), [E('target'), T('を非表示にする', ': hide')], { target: { t: 'comp' } }, { target: '' },
  (b, g) => [`setVisible(${g.comp(b.args.target)}, false);`]);
uiStmt('alert', '💬', T('メッセージを表示', 'Show message'), [T('メッセージ', 'Show message'), E('value'), T('を表示する', '')],
  { value: { t: 'expr', ph: '"保存しました"' } }, { value: '"こんにちは"' },
  (b, g) => [`showMessage(${g.expr(b.args.value)});`]);
uiStmt('navigate', '➜', T('ページ移動', 'Go to page'), [T('ページ', 'Go to page'), E('page'), T('へ移動する', '')],
  { page: { t: 'page', required: true } }, { page: '' },
  (b, g) => [`showPage(${q(b.args.page)});`]);
uiStmt('open_modal', '❏', T('モーダルを開く', 'Open modal'), [T('モーダル', 'Open modal'), E('target'), T('を開く', '')],
  { target: { t: 'comp', types: ['modal'] } }, { target: '' },
  (b, g) => [`setVisible(${g.comp(b.args.target)}, true);`]);
uiStmt('close_modal', '⨯', T('モーダルを閉じる', 'Close modal'), [T('モーダル', 'Close modal'), E('target'), T('を閉じる', '')],
  { target: { t: 'comp', types: ['modal'] } }, { target: '' },
  (b, g) => [`setVisible(${g.comp(b.args.target)}, false);`]);

export { blocks };

// Block definitions. Each block knows how to describe itself (parts/fields) and how to
// generate readable JavaScript (gen). Plugins can register more via registerBlock().
import { registerBlock, blocks } from './registry.js';
import { allNodes } from './model.js';

export const COND_OPS = [
  ['==', '＝'], ['!=', '≠'], ['>', '＞'], ['<', '＜'], ['>=', '≧'], ['<=', '≦'],
  ['contains', '含む'], ['empty', '空'], ['notempty', '空でない'], ['js', '式(JS)'],
];
export const defaultCond = () => ({ rows: [{ l: '', op: '==', r: '' }], join: 'and', not: false });

const nodeName = (project, id) => allNodes(project).find((x) => x.node.id === id)?.node.name || '(未選択)';
const q = (s) => JSON.stringify(String(s ?? ''));
const ind = (lines) => lines.map((l) => '  ' + l);

const E = (key) => ({ f: key });
const hat = (type, title, parts, fields, defaults, gen, summary) =>
  registerBlock({ type, cat: 'Events', kind: 'hat', icon: '⚡', title, parts, fields, defaults, gen, summary });
const stmt = (type, cat, icon, title, parts, fields, defaults, gen, slots) =>
  registerBlock({ type, cat, kind: 'stmt', icon, title, parts, fields, defaults, gen, slots });

// ---------------- Events ----------------
hat('onClick', 'ボタンがクリックされたとき', ['クリックされたとき:', E('target')],
  { target: { t: 'comp' } }, { target: '' },
  (b, g, body) => [`on(${g.comp(b.args.target)}, "click", async () => {`, ...ind(body), '});'],
  (a, p) => `${nodeName(p, a.target)} クリック`);

hat('onChange', '入力が変更されたとき', ['変更されたとき:', E('target')],
  { target: { t: 'comp' } }, { target: '' },
  (b, g, body) => [`on(${g.comp(b.args.target)}, "change", async () => {`, ...ind(body), '});'],
  (a, p) => `${nodeName(p, a.target)} 変更`);

hat('onLoad', 'ページが読み込まれたとき', ['ページ', E('page'), 'が表示されたとき'],
  { page: { t: 'page', required: true } }, { page: '' },
  (b, g, body) => [`onPage(${q(b.args.page)}, async () => {`, ...ind(body), '});'],
  (a, p) => `ページ「${p.pages.find((x) => x.id === a.page)?.name || '?'}」表示時`);

hat('onTimer', 'タイマー', ['', E('ms'), 'ミリ秒ごとに'],
  { ms: { t: 'expr', ph: '1000' } }, { ms: '1000' },
  (b, g, body) => [`every(${g.expr(b.args.ms)}, async () => {`, ...ind(body), '});'],
  (a) => `タイマー ${a.ms}ms`);

hat('onDataChanged', 'データが変更されたとき', ['データ', E('model'), 'が変更されたとき'],
  { model: { t: 'model' } }, { model: '' },
  (b, g, body) => [`onData(${q(b.args.model)}, async () => {`, ...ind(body), '});'],
  (a) => `データ ${a.model || '?'} 変更`);

hat('onFunction', '関数を定義', ['関数', E('name'), 'を定義'],
  { name: { t: 'text', ph: '駅を検索する' } }, { name: '' },
  (b, g, body) => [`fns[${q(b.args.name)}] = async () => {`, ...ind(body), '};'],
  (a) => `関数 ${a.name || '(無名)'}`);

// ---------------- Variables ----------------
stmt('set_var', 'Variables', '＝', '変数に値を設定', ['変数', E('name'), 'を', E('value'), 'にする'],
  { name: { t: 'var' }, value: { t: 'expr', ph: 'count + 1 / "text"' } }, { name: '', value: '' },
  (b, g) => [`setVar(${q(b.args.name)}, ${g.expr(b.args.value)});`]);

stmt('change_var', 'Variables', '±', '変数を増減', ['変数', E('name'), 'を', E('by'), '増やす'],
  { name: { t: 'var' }, by: { t: 'expr', ph: '1' } }, { name: '', by: '1' },
  (b, g) => [`changeVar(${q(b.args.name)}, ${g.expr(b.args.by)});`]);

// ---------------- Control / Conditions ----------------
stmt('if', 'Conditions', '？', '条件分岐', ['もし', E('cond')],
  { cond: { t: 'cond' } }, { cond: defaultCond() },
  (b, g) => {
    const out = [`if (${g.cond(b.args.cond)}) {`, ...ind(g.stack(b.slots.then)), '}'];
    if (b.slots.else.length) out.push('else {', ...ind(g.stack(b.slots.else)), '}');
    return out;
  },
  [{ key: 'then', label: 'なら' }, { key: 'else', label: 'そうでなければ' }]);

stmt('repeat', 'Control', '↻', '繰り返し', [E('times'), '回繰り返す'],
  { times: { t: 'expr', ph: '10' } }, { times: '10' },
  (b, g) => { const i = g.uid('i'); return [`for (let ${i} = 0; ${i} < Number(${g.expr(b.args.times)}); ${i}++) {`, ...ind(g.stack(b.slots.body)), '}']; },
  [{ key: 'body', label: '繰り返す内容' }]);

stmt('foreach', 'Control', '∀', '各行に対して処理', ['データ', E('model'), 'の各行を', E('item'), 'として'],
  { model: { t: 'model' }, item: { t: 'ident', ph: 'item' } }, { model: '', item: 'item' },
  (b, g) => {
    const it = b.args.item || 'item';
    return [`for (const ${it} of [...(data[${q(b.args.model)}] || [])]) {`, ...ind(g.scoped([it], () => g.stack(b.slots.body))), '}'];
  },
  [{ key: 'body', label: '各行に対して' }]);

stmt('wait', 'Control', '⏱', '待つ', [E('ms'), 'ミリ秒待つ'],
  { ms: { t: 'expr', ph: '1000' } }, { ms: '1000' },
  (b, g) => [`await sleep(${g.expr(b.args.ms)});`]);

stmt('call_fn', 'Control', 'ƒ', '関数を実行', ['関数', E('name'), 'を実行する'],
  { name: { t: 'fn' } }, { name: '' },
  (b, g) => [`await callFn(${q(b.args.name)});`]);

// ---------------- Data ----------------
stmt('add_row', 'Data', '＋', '行を追加 (Create)', ['データ', E('model'), 'に行を追加:', E('values')],
  { model: { t: 'model' }, values: { t: 'values' } }, { model: '', values: {} },
  (b, g) => {
    const pairs = Object.entries(b.args.values || {}).filter(([, v]) => String(v).trim() !== '')
      .map(([k, v]) => `${/^[\p{L}_$][\p{L}\p{N}_$]*$/u.test(k) ? k : q(k)}: ${g.expr(v)}`);
    return [`addRow(${q(b.args.model)}, { ${pairs.join(', ')} });`];
  });

stmt('delete_rows', 'Data', '✕', '行を削除 (Delete)', ['データ', E('model'), 'から', E('cond'), 'の行を削除'],
  { model: { t: 'model' }, cond: { t: 'cond', scope: ['item'] } }, { model: '', cond: { rows: [{ l: 'item.id', op: '==', r: '' }], join: 'and', not: false } },
  (b, g) => [`deleteWhere(${q(b.args.model)}, (item) => ${g.scoped(['item'], () => g.cond(b.args.cond))});`]);

stmt('clear_rows', 'Data', '⌫', '全行を削除', ['データ', E('model'), 'の全ての行を削除'],
  { model: { t: 'model' } }, { model: '' },
  (b, g) => [`clearRows(${q(b.args.model)});`]);

stmt('update_rows', 'Data', '✎', '行を更新 (Update)', ['データ', E('model'), 'で', E('cond'), 'の行の', E('field'), 'を', E('value'), 'にする'],
  { model: { t: 'model' }, cond: { t: 'cond', scope: ['item'] }, field: { t: 'fieldname' }, value: { t: 'expr' } },
  { model: '', cond: { rows: [{ l: 'item.id', op: '==', r: '' }], join: 'and', not: false }, field: '', value: '' },
  (b, g) => [`updateWhere(${q(b.args.model)}, (item) => ${g.scoped(['item'], () => g.cond(b.args.cond))}, ${q(b.args.field)}, ${g.expr(b.args.value)});`]);

stmt('find_row', 'Data', '⌕', '行を検索 (Find)', ['変数', E('var'), 'に', E('model'), 'で', E('cond'), 'の最初の行の', E('field'), 'を入れる'],
  { var: { t: 'var' }, model: { t: 'model' }, cond: { t: 'cond', scope: ['item'] }, field: { t: 'fieldname' } },
  { var: '', model: '', cond: { rows: [{ l: 'item.id', op: '==', r: '' }], join: 'and', not: false }, field: '' },
  (b, g) => [`{ const row = findRow(${q(b.args.model)}, (item) => ${g.scoped(['item'], () => g.cond(b.args.cond))}); setVar(${q(b.args.var)}, row ? row[${q(b.args.field)}] : ""); }`]);

stmt('sort_rows', 'Data', '⇅', '並べ替え (Sort)', ['データ', E('model'), 'を', E('field'), 'で', E('order'), 'に並べ替える'],
  { model: { t: 'model' }, field: { t: 'fieldname' }, order: { t: 'select', opts: [['asc', '昇順'], ['desc', '降順']] } }, { model: '', field: '', order: 'asc' },
  (b, g) => [`sortRows(${q(b.args.model)}, ${q(b.args.field)}, ${b.args.order === 'desc'});`]);

// ---------------- UI ----------------
const uiStmt = (type, icon, title, parts, fields, defaults, gen) => stmt(type, 'UI', icon, title, parts, fields, defaults, gen);
uiStmt('set_text', 'T', 'テキストを設定', [E('target'), 'の表示を', E('value'), 'にする'],
  { target: { t: 'comp' }, value: { t: 'expr', ph: 'count' } }, { target: '', value: '' },
  (b, g) => [`setText(${g.comp(b.args.target)}, ${g.expr(b.args.value)});`]);
uiStmt('set_value', '✎', '値を設定', [E('target'), 'の値を', E('value'), 'にする'],
  { target: { t: 'comp' }, value: { t: 'expr' } }, { target: '', value: '' },
  (b, g) => [`setValue(${g.comp(b.args.target)}, ${g.expr(b.args.value)});`]);
uiStmt('show', '👁', '表示する', [E('target'), 'を表示する'], { target: { t: 'comp' } }, { target: '' },
  (b, g) => [`setVisible(${g.comp(b.args.target)}, true);`]);
uiStmt('hide', '🚫', '非表示にする', [E('target'), 'を非表示にする'], { target: { t: 'comp' } }, { target: '' },
  (b, g) => [`setVisible(${g.comp(b.args.target)}, false);`]);
uiStmt('alert', '💬', 'メッセージを表示', ['メッセージ', E('value'), 'を表示する'],
  { value: { t: 'expr', ph: '"保存しました"' } }, { value: '"こんにちは"' },
  (b, g) => [`showMessage(${g.expr(b.args.value)});`]);
uiStmt('navigate', '➜', 'ページ移動', ['ページ', E('page'), 'へ移動する'],
  { page: { t: 'page', required: true } }, { page: '' },
  (b, g) => [`showPage(${q(b.args.page)});`]);
uiStmt('open_modal', '❏', 'モーダルを開く', ['モーダル', E('target'), 'を開く'],
  { target: { t: 'comp', types: ['modal'] } }, { target: '' },
  (b, g) => [`setVisible(${g.comp(b.args.target)}, true);`]);
uiStmt('close_modal', '⨯', 'モーダルを閉じる', ['モーダル', E('target'), 'を閉じる'],
  { target: { t: 'comp', types: ['modal'] } }, { target: '' },
  (b, g) => [`setVisible(${g.comp(b.args.target)}, false);`]);

export { blocks };

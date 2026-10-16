// Value blocks (round / hexagon "reporters") that are not simply a statement with a result variable.
// They can be dropped into any expression slot, so no temporary variable is needed.
import { registerBlock } from './registry.js';
import { E, q, defaultCond } from './blocks.js';
import { J } from './i18n-helpers.js';

const X = (ph) => ({ t: 'expr', ph });
/** R(type, cat, icon, ja, en, partsJA/EN, fields, defaults, rep, {bool}) */
export const R = (type, cat, icon, ja, en, parts, fields, defaults, rep, opts = {}) =>
  registerBlock({ type, cat, kind: 'reporter', icon, title: ja, en, repParts: parts, fields, defaults, rep, bool: !!opts.bool });

R('r_var', 'Variables', '𝑥', '変数の値', 'Variable value', [J('変数', 'variable'), E('name')],
  { name: { t: 'var' } }, { name: '' }, (b, g) => (b.args.name ? g.v(b.args.name) : '""'));

R('r_ui', 'UI', '⌗', 'UI部品の値', 'Component value', [E('target'), J('の', ':'), E('kind')],
  { target: { t: 'comp' }, kind: { t: 'select', opts: [['value', J('入力値', 'input value')], ['text', J('表示テキスト', 'text')], ['checked', J('チェック状態', 'checked')], ['visible', J('表示中か', 'visible?')]] } },
  { target: '', kind: 'value' }, (b, g) => `readUi(${g.comp(b.args.target)}, ${q(b.args.kind)})`);

const CMP = [['==', '＝'], ['!=', '≠'], ['>', '＞'], ['<', '＜'], ['>=', '≧'], ['<=', '≦'], ['contains', J('含む', 'contains')]];
R('b_cmp', 'Conditions', '？', '比較', 'Compare', [E('a'), E('op'), E('b')],
  { a: X('count'), op: { t: 'select', opts: CMP }, b: X('10') }, { a: '', op: '>', b: '' },
  (b, g) => g.cond({ rows: [{ l: b.args.a, op: b.args.op, r: b.args.b }], join: 'and', not: false }), { bool: true });

R('b_and', 'Conditions', '？', 'かつ (AND)', 'AND', [E('a'), J('かつ', 'and'), E('b')],
  { a: X(), b: X() }, { a: '', b: '' }, (b, g) => `(Boolean(${g.expr(b.args.a)}) && Boolean(${g.expr(b.args.b)}))`, { bool: true });
R('b_or', 'Conditions', '？', 'または (OR)', 'OR', [E('a'), J('または', 'or'), E('b')],
  { a: X(), b: X() }, { a: '', b: '' }, (b, g) => `(Boolean(${g.expr(b.args.a)}) || Boolean(${g.expr(b.args.b)}))`, { bool: true });
R('b_not', 'Conditions', '？', '〜でない (NOT)', 'NOT', [J('でない:', 'not'), E('a')],
  { a: X() }, { a: '' }, (b, g) => `!Boolean(${g.expr(b.args.a)})`, { bool: true });
R('r_if', 'Conditions', '？', '条件で値を選ぶ', 'If-then-else value', [J('もし', 'if'), E('cond'), J('なら', 'then'), E('a'), J('、でなければ', 'else'), E('b')],
  { cond: { t: 'cond' }, a: X(), b: X() }, { cond: defaultCond(), a: '', b: '' }, (b, g) => `(${g.cond(b.args.cond)} ? ${g.expr(b.args.a)} : ${g.expr(b.args.b)})`);

R('r_count', 'Data', '#', '行数', 'Row count', [J('データ', 'rows in'), E('model'), J('の行数', '')],
  { model: { t: 'model' } }, { model: '' }, (b, g) => `(data[${q(b.args.model)}] || []).length`);
R('r_row_field', 'Data', '⌗', '行の値', 'Row value', [J('データ', ''), E('model'), J('の', ': row'), E('index'), J('行目(0から)の', ','), E('field')],
  { model: { t: 'model' }, index: X('0'), field: { t: 'fieldname' } }, { model: '', index: '0', field: '' },
  (b, g) => `((data[${q(b.args.model)}] || [])[Number(${g.expr(b.args.index)})] || {})[${q(b.args.field)}]`);
R('r_find_row', 'Data', '⌕', '条件に合う行の値', 'Find row value', [J('データ', ''), E('model'), J('で', ': where'), E('cond'), J('の最初の行の', ', first row\'s'), E('field')],
  { model: { t: 'model' }, cond: { t: 'cond', scope: ['item'] }, field: { t: 'fieldname' } },
  { model: '', cond: { rows: [{ l: 'item.id', op: '==', r: '' }], join: 'and', not: false }, field: '' },
  (b, g) => `((data[${q(b.args.model)}] || []).find((item) => ${g.scoped(['item'], () => g.cond(b.args.cond))}) || {})[${q(b.args.field)}]`);

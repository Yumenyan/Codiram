// Extended block library: math, text, list, object, time, control, UI, animation, system.
// Strings are registered with their English counterpart via J(ja, en) so the UI can switch language.
import { stmt, hat, E, q, ind, defaultCond } from './blocks.js';
import { blocks } from './registry.js';


import { J } from './i18n-helpers.js';
const opts = (arr) => arr.map(([v, ja, en]) => [v, J(ja, en)]);
/** Register a statement whose title is bilingual. */
const B = (type, cat, icon, ja, en, parts, fields, defaults, gen, slots) => {
  stmt(type, cat, icon, ja, parts, fields, defaults, gen, slots);
  const d = blocks.get(type);
  d.en = en;
  d.reporter = !!(fields.to && !fields.to.opt && !slots); // single-result blocks double as value blocks
};
const H = (type, ja, en, parts, fields, defaults, gen, summary) => { hat(type, ja, parts, fields, defaults, gen, summary); blocks.get(type).en = en; };

const to = { t: 'var' };
const LV = { t: 'var', vt: 'Array' }, OV = { t: 'var', vt: 'Object' };
const X = (ph) => ({ t: 'expr', ph });
const num = (g, x) => `Number(${g.expr(x)})`;
const str = (g, x) => `String(${g.expr(x)})`;
const out = (b, g, js) => [`setVar(${q(b.args.to)}, ${js});`];
const outOpt = (b, g, js) => (b.args.to ? out(b, g, js) : [`${js};`]);
const LIST = (g, b, key = 'list') => `listOf(${q(b.args[key])})`;
const useList = (g) => g.use('list');
const sel = (o) => ({ t: 'select', opts: o });
const condDefault = () => ({ rows: [{ l: 'item', op: '==', r: '' }], join: 'and', not: false });
const pred = (g, c) => `(item) => ${g.scoped(['item'], () => g.cond(c))}`;

// =============================================================== Events
H('onDblClick', 'ダブルクリックされたとき', 'When double-clicked', [J('ダブルクリックされたとき:', 'When double-clicked:'), E('target')],
  { target: { t: 'comp' } }, { target: '' },
  (b, g, body) => [`on(${g.comp(b.args.target)}, "dblclick", async () => {`, ...ind(body), '});']);
H('onHover', 'マウスが乗ったとき', 'When hovered', [J('マウスが乗ったとき:', 'When mouse enters:'), E('target')],
  { target: { t: 'comp' } }, { target: '' },
  (b, g, body) => [`on(${g.comp(b.args.target)}, "mouseenter", async () => {`, ...ind(body), '});']);
H('onEnter', 'Enterキーが押されたとき', 'When Enter is pressed', [J('Enterキーが押されたとき:', 'When Enter is pressed in:'), E('target')],
  { target: { t: 'comp' } }, { target: '' },
  (b, g, body) => [`on(${g.comp(b.args.target)}, "keydown", async (ev) => {`, '  if (ev.key !== "Enter") return;', ...ind(body), '});']);
H('onKey', 'キーが押されたとき', 'When a key is pressed', [J('キー', 'Key'), E('key'), J('が押されたとき', 'is pressed')],
  { key: { t: 'text', ph: 'Enter / a / ArrowUp' } }, { key: 'Enter' },
  (b, g, body) => [`onKey(${q(b.args.key)}, async () => {`, ...ind(body), '});']);

// =============================================================== Math
const MATH_OPS = { '+': '+', '-': '-', '*': '*', '/': '/', '%': '%', '^': '**' };
B('math_calc', 'Math', '±', '四則演算', 'Arithmetic',
  [J('変数', 'Set'), E('to'), J('に', 'to'), E('a'), E('op'), E('b'), J('の結果を入れる', '')],
  { to, a: X('count'), op: sel(opts([['+', '＋ 足す', '+ add'], ['-', '－ 引く', '− subtract'], ['*', '× 掛ける', '× multiply'], ['/', '÷ 割る', '÷ divide'], ['%', '％ 余り', '% remainder'], ['^', '^ べき乗', '^ power']])), b: X('1') },
  { to: '', a: '', op: '+', b: '1' },
  (b, g) => out(b, g, `(${num(g, b.args.a)} ${MATH_OPS[b.args.op] || '+'} ${num(g, b.args.b)})`));

B('math_fn', 'Math', 'ƒ', '数学関数', 'Math function',
  [J('変数', 'Set'), E('to'), J('に', 'to'), E('fn'), J('(', '('), E('a'), J(') を入れる', ')')],
  { to, fn: sel(opts([['round', '四捨五入', 'round'], ['ceil', '切り上げ', 'ceil'], ['floor', '切り捨て', 'floor'], ['trunc', '整数部分', 'trunc'], ['abs', '絶対値', 'abs'], ['sqrt', '平方根', 'sqrt'], ['cbrt', '立方根', 'cbrt'], ['sign', '符号', 'sign'], ['sin', 'sin', 'sin'], ['cos', 'cos', 'cos'], ['tan', 'tan', 'tan'], ['asin', 'asin', 'asin'], ['acos', 'acos', 'acos'], ['atan', 'atan', 'atan'], ['log', '自然対数 ln', 'ln'], ['log10', '常用対数 log10', 'log10'], ['log2', 'log2', 'log2'], ['exp', 'e の累乗', 'exp']])), a: X('x') },
  { to: '', fn: 'round', a: '' },
  (b, g) => out(b, g, `Math.${/^[a-z0-9]+$/.test(b.args.fn) ? b.args.fn : 'round'}(${num(g, b.args.a)})`));

B('math_minmax', 'Math', '⇵', '大きい方/小さい方', 'Max / Min',
  [J('変数', 'Set'), E('to'), J('に', 'to'), E('a'), J('と', 'and'), E('b'), J('の', ':'), E('fn'), J('を入れる', '')],
  { to, a: X(), b: X(), fn: sel(opts([['max', '大きい方', 'larger'], ['min', '小さい方', 'smaller']])) }, { to: '', a: '', b: '', fn: 'max' },
  (b, g) => out(b, g, `Math.${b.args.fn === 'min' ? 'min' : 'max'}(${num(g, b.args.a)}, ${num(g, b.args.b)})`));

B('math_clamp', 'Math', '⇔', '範囲に収める', 'Clamp',
  [J('変数', 'Set'), E('to'), J('に', 'to'), E('a'), J('を', 'limited to'), E('min'), J('〜', '–'), E('max'), J('に収めた値を入れる', '')],
  { to, a: X(), min: X('0'), max: X('100') }, { to: '', a: '', min: '0', max: '100' },
  (b, g) => out(b, g, `Math.min(Math.max(${num(g, b.args.a)}, ${num(g, b.args.min)}), ${num(g, b.args.max)})`));

B('math_random', 'Math', '🎲', '乱数(整数)', 'Random integer',
  [J('変数', 'Set'), E('to'), J('に', 'to a random integer'), E('min'), J('〜', '–'), E('max'), J('の乱数を入れる', '')],
  { to, min: X('1'), max: X('6') }, { to: '', min: '1', max: '6' },
  (b, g) => out(b, g, `(Math.floor(Math.random() * (${num(g, b.args.max)} - ${num(g, b.args.min)} + 1)) + ${num(g, b.args.min)})`));

B('math_randf', 'Math', '🎲', '乱数(0以上1未満)', 'Random 0–1',
  [J('変数', 'Set'), E('to'), J('に 0以上1未満の乱数を入れる', 'to a random number from 0 to 1')], { to }, { to: '' },
  (b, g) => out(b, g, 'Math.random()'));

B('math_round_to', 'Math', '≈', '小数点以下を丸める', 'Round to decimals',
  [J('変数', 'Set'), E('to'), J('に', 'to'), E('a'), J('を小数第', 'rounded to'), E('d'), J('位で丸めた値を入れる', 'decimals')],
  { to, a: X(), d: X('2') }, { to: '', a: '', d: '2' },
  (b, g) => out(b, g, `Number(${num(g, b.args.a)}.toFixed(${num(g, b.args.d)}))`));

B('math_const', 'Math', 'π', '定数', 'Constant',
  [J('変数', 'Set'), E('to'), J('に定数', 'to constant'), E('name'), J('を入れる', '')],
  { to, name: sel(opts([['PI', 'π (円周率)', 'π (pi)'], ['E', 'e (ネイピア数)', 'e'], ['SQRT2', '√2', '√2'], ['LN2', 'ln 2', 'ln 2'], ['Infinity', '∞ (無限大)', '∞ (infinity)']])) },
  { to: '', name: 'PI' },
  (b, g) => out(b, g, ['PI', 'E', 'SQRT2', 'LN2'].includes(b.args.name) ? `Math.${b.args.name}` : 'Infinity'));

B('math_convert', 'Math', '⇄', '型変換', 'Convert type',
  [J('変数', 'Set'), E('to'), J('に', 'to'), E('a'), J('を', 'converted to'), E('kind'), J('にした値を入れる', '')],
  { to, a: X(), kind: sel(opts([['Number', '数値', 'number'], ['int', '整数', 'integer'], ['float', '小数', 'float'], ['String', '文字列', 'text'], ['Boolean', '真偽値', 'boolean']])) },
  { to: '', a: '', kind: 'Number' },
  (b, g) => out(b, g, ({ Number: `Number(${g.expr(b.args.a)})`, int: `parseInt(${g.expr(b.args.a)}, 10)`, float: `parseFloat(${g.expr(b.args.a)})`, String: str(g, b.args.a), Boolean: `Boolean(${g.expr(b.args.a)})` })[b.args.kind] || `Number(${g.expr(b.args.a)})`));

B('math_is', 'Math', '❓', '数値の判定', 'Number test',
  [J('変数', 'Set'), E('to'), J('に', 'to whether'), E('a'), J('が', 'is'), E('test'), J('かどうか(真偽)を入れる', '(true/false)')],
  { to, a: X(), test: sel(opts([['nan', '数値でない(NaN)', 'not a number'], ['int', '整数', 'an integer'], ['even', '偶数', 'even'], ['odd', '奇数', 'odd'], ['pos', '正の数', 'positive'], ['neg', '負の数', 'negative']])) },
  { to: '', a: '', test: 'int' },
  (b, g) => out(b, g, ({ nan: `Number.isNaN(Number(${g.expr(b.args.a)}))`, int: `Number.isInteger(${num(g, b.args.a)})`, even: `(${num(g, b.args.a)} % 2 === 0)`, odd: `(Math.abs(${num(g, b.args.a)} % 2) === 1)`, pos: `(${num(g, b.args.a)} > 0)`, neg: `(${num(g, b.args.a)} < 0)` })[b.args.test]));

B('math_format', 'Math', '１,２', '数値の整形', 'Format number',
  [J('変数', 'Set'), E('to'), J('に', 'to'), E('a'), J('を', 'formatted as'), E('kind'), J('で整形した文字列を入れる', '')],
  { to, a: X(), kind: sel(opts([['comma', '桁区切り (1,234)', 'thousands separator'], ['yen', '円 (¥1,234)', 'Japanese yen'], ['usd', 'ドル ($1,234.00)', 'US dollars'], ['percent', 'パーセント (12%)', 'percent'], ['pad', '3桁ゼロ埋め (007)', 'zero-pad to 3 digits']])) },
  { to: '', a: '', kind: 'comma' },
  (b, g) => out(b, g, ({ comma: `${num(g, b.args.a)}.toLocaleString()`, yen: `${num(g, b.args.a)}.toLocaleString("ja-JP", { style: "currency", currency: "JPY" })`, usd: `${num(g, b.args.a)}.toLocaleString("en-US", { style: "currency", currency: "USD" })`, percent: `${num(g, b.args.a)}.toLocaleString(undefined, { style: "percent" })`, pad: `String(${g.expr(b.args.a)}).padStart(3, "0")` })[b.args.kind]));

// =============================================================== Text
B('text_join', 'Text', '＋', '文字列の連結', 'Join text',
  [J('変数', 'Set'), E('to'), J('に', 'to'), E('a'), J('と', '+'), E('b'), J('と', '+'), E('c'), J('を連結して入れる', 'joined')],
  { to, a: X('"こんにちは"'), b: X('name'), c: X() }, { to: '', a: '', b: '', c: '' },
  (b, g) => out(b, g, `${str(g, b.args.a)} + ${str(g, b.args.b)}${String(b.args.c).trim() ? ' + ' + str(g, b.args.c) : ''}`));

B('text_len', 'Text', '#', '文字数', 'Text length',
  [J('変数', 'Set'), E('to'), J('に', 'to the length of'), E('a'), J('の文字数を入れる', '')],
  { to, a: X() }, { to: '', a: '' }, (b, g) => out(b, g, `${str(g, b.args.a)}.length`));

B('text_sub', 'Text', '✂', '部分文字列', 'Substring',
  [J('変数', 'Set'), E('to'), J('に', 'to'), E('a'), J('の', 'characters'), E('from'), J('文字目から', 'from index'), E('end'), J('文字目の手前までを入れる', 'up to (blank = end)')],
  { to, a: X(), from: X('0'), end: X('') }, { to: '', a: '', from: '0', end: '' },
  (b, g) => out(b, g, `${str(g, b.args.a)}.slice(${num(g, b.args.from)}${String(b.args.end).trim() ? ', ' + num(g, b.args.end) : ''})`));

B('text_replace', 'Text', '⇄', '文字列の置換', 'Replace text',
  [J('変数', 'Set'), E('to'), J('に', 'to'), E('a'), J('の', ': replace'), E('find'), J('を', 'with'), E('repl'), J('に置換して', ''), E('mode'), J('入れる', '')],
  { to, a: X(), find: X(), repl: X(), mode: sel(opts([['all', 'すべて', 'all'], ['first', '最初の1つ', 'first only']])) }, { to: '', a: '', find: '', repl: '', mode: 'all' },
  (b, g) => out(b, g, b.args.mode === 'first' ? `${str(g, b.args.a)}.replace(${str(g, b.args.find)}, () => ${str(g, b.args.repl)})` : `${str(g, b.args.a)}.split(${str(g, b.args.find)}).join(${str(g, b.args.repl)})`));

B('text_case', 'Text', 'Aa', '文字列の変換', 'Transform text',
  [J('変数', 'Set'), E('to'), J('に', 'to'), E('a'), J('を', 'transformed:'), E('op'), J('した文字列を入れる', '')],
  { to, a: X(), op: sel(opts([['toUpperCase', '大文字に', 'UPPERCASE'], ['toLowerCase', '小文字に', 'lowercase'], ['trim', '前後の空白を除去', 'trim spaces'], ['trimStart', '先頭の空白を除去', 'trim start'], ['trimEnd', '末尾の空白を除去', 'trim end'], ['cap', '先頭を大文字に', 'Capitalize'], ['reverse', '逆順に', 'reverse'], ['normalize', '正規化(全角→半角など)', 'Unicode normalize (NFKC)']])) },
  { to: '', a: '', op: 'toUpperCase' },
  (b, g) => out(b, g, ({ cap: `(${str(g, b.args.a)}.charAt(0).toUpperCase() + ${str(g, b.args.a)}.slice(1))`, reverse: `[...${str(g, b.args.a)}].reverse().join("")`, normalize: `${str(g, b.args.a)}.normalize("NFKC")` })[b.args.op] || `${str(g, b.args.a)}.${/^[A-Za-z]+$/.test(b.args.op) ? b.args.op : 'trim'}()`));

B('text_find', 'Text', '⌕', '文字列の検索', 'Search in text',
  [J('変数', 'Set'), E('to'), J('に', 'to'), E('a'), J('の中で', ': in'), E('find'), J('の', ''), E('op'), J('を入れる', '')],
  { to, a: X(), find: X(), op: sel(opts([['indexOf', '最初の位置(なければ -1)', 'first index (-1 if none)'], ['lastIndexOf', '最後の位置', 'last index'], ['includes', '含むか(真偽)', 'contains? (true/false)'], ['startsWith', '先頭が一致するか', 'starts with?'], ['endsWith', '末尾が一致するか', 'ends with?']])) },
  { to: '', a: '', find: '', op: 'includes' },
  (b, g) => out(b, g, `${str(g, b.args.a)}.${['indexOf', 'lastIndexOf', 'includes', 'startsWith', 'endsWith'].includes(b.args.op) ? b.args.op : 'includes'}(${str(g, b.args.find)})`));

B('text_char', 'Text', '⁝', '文字の取り出し', 'Character at',
  [J('変数', 'Set'), E('to'), J('に', 'to'), E('a'), J('の', ': character'), E('i'), J('文字目を入れる(負の数は末尾から)', '(negative counts from the end)')],
  { to, a: X(), i: X('0') }, { to: '', a: '', i: '0' }, (b, g) => out(b, g, `${str(g, b.args.a)}.at(${num(g, b.args.i)}) ?? ""`));

B('text_split', 'Text', '⑂', '文字列を分割して配列に', 'Split text to list',
  [J('配列', 'List'), E('to'), J('に', 'to'), E('a'), J('を区切り文字', 'split by'), E('sep'), J('で分割して入れる', '')],
  { to: { t: 'var', vt: 'Array' }, a: X(), sep: X('","') }, { to: '', a: '', sep: '","' },
  (b, g) => out(b, g, `${str(g, b.args.a)}.split(${str(g, b.args.sep)})`));

B('text_repeat', 'Text', '×', '文字列の繰り返し', 'Repeat text',
  [J('変数', 'Set'), E('to'), J('に', 'to'), E('a'), J('を', 'repeated'), E('n'), J('回繰り返した文字列を入れる', 'times')],
  { to, a: X('"★"'), n: X('5') }, { to: '', a: '', n: '3' }, (b, g) => out(b, g, `${str(g, b.args.a)}.repeat(Math.max(0, ${num(g, b.args.n)}))`));

B('text_pad', 'Text', '▭', '文字列の埋め', 'Pad text',
  [J('変数', 'Set'), E('to'), J('に', 'to'), E('a'), J('を', 'padded to'), E('len'), J('文字になるまで', 'chars with'), E('ch'), J('で', ''), E('side'), J('を埋めて入れる', '')],
  { to, a: X(), len: X('3'), ch: X('"0"'), side: sel(opts([['start', '前', 'start'], ['end', '後ろ', 'end']])) }, { to: '', a: '', len: '3', ch: '"0"', side: 'start' },
  (b, g) => out(b, g, `${str(g, b.args.a)}.${b.args.side === 'end' ? 'padEnd' : 'padStart'}(${num(g, b.args.len)}, ${str(g, b.args.ch)})`));

B('regex_test', 'Text', '.*', '正規表現:一致判定', 'Regex: test',
  [J('変数', 'Set'), E('to'), J('に', 'to whether'), E('a'), J('が正規表現', 'matches /'), E('pat'), J('/', '/'), E('flags'), J('に一致するか(真偽)を入れる', '')],
  { to, a: X(), pat: { t: 'text', ph: '^\\d+$' }, flags: { t: 'text', ph: 'i' } }, { to: '', a: '', pat: '', flags: '' },
  (b, g) => out(b, g, `new RegExp(${q(b.args.pat)}, ${q(b.args.flags)}).test(${str(g, b.args.a)})`));

B('regex_match', 'Text', '.*', '正規表現:一致を抽出', 'Regex: extract matches',
  [J('配列', 'List'), E('to'), J('に', 'to all matches of /'), E('pat'), J('/g を', '/g in'), E('a'), J('から抽出して入れる', '')],
  { to: { t: 'var', vt: 'Array' }, a: X(), pat: { t: 'text', ph: '\\d+' } }, { to: '', a: '', pat: '' },
  (b, g) => out(b, g, `(${str(g, b.args.a)}.match(new RegExp(${q(b.args.pat)}, "g")) || [])`));

B('regex_replace', 'Text', '.*', '正規表現:置換', 'Regex: replace',
  [J('変数', 'Set'), E('to'), J('に', 'to'), E('a'), J('の正規表現', ': replace /'), E('pat'), J('/g を', '/g with'), E('repl'), J('に置換して入れる', '')],
  { to, a: X(), pat: { t: 'text', ph: '\\s+' }, repl: X('" "') }, { to: '', a: '', pat: '', repl: '""' },
  (b, g) => out(b, g, `${str(g, b.args.a)}.replace(new RegExp(${q(b.args.pat)}, "g"), ${str(g, b.args.repl)})`));

B('text_encode', 'Text', '％', 'エンコード/デコード', 'Encode / decode',
  [J('変数', 'Set'), E('to'), J('に', 'to'), E('a'), J('を', 'with'), E('kind'), J('した結果を入れる', '')],
  { to, a: X(), kind: sel(opts([['encodeURIComponent', 'URLエンコード', 'URL encode'], ['decodeURIComponent', 'URLデコード', 'URL decode'], ['btoa', 'Base64エンコード(ASCII)', 'Base64 encode (ASCII)'], ['atob', 'Base64デコード(ASCII)', 'Base64 decode (ASCII)'], ['code', '先頭の文字コード', 'char code of first char'], ['fromcode', '文字コードから文字', 'char from code']])) },
  { to: '', a: '', kind: 'encodeURIComponent' },
  (b, g) => out(b, g, ({ code: `${str(g, b.args.a)}.charCodeAt(0)`, fromcode: `String.fromCharCode(${num(g, b.args.a)})` })[b.args.kind] || `${['encodeURIComponent', 'decodeURIComponent', 'btoa', 'atob'].includes(b.args.kind) ? b.args.kind : 'encodeURIComponent'}(${str(g, b.args.a)})`));

// =============================================================== List
B('list_new', 'List', '▤', '配列を作る', 'Create list',
  [J('配列', 'List'), E('list'), J('を', 'is'), E('items'), J('で初期化する', '')],
  { list: LV, items: { t: 'text', ph: '1, 2, 3 / りんご, みかん' } }, { list: '', items: '' },
  (b, g) => { useList(g); return [`setVar(${q(b.args.list)}, ${g.exprList(b.args.items)});`]; });

B('list_add', 'List', '＋', '配列に追加', 'Add to list',
  [J('配列', 'List'), E('list'), J('の', ':'), E('where'), J('に', 'add'), E('item'), J('を追加', '')],
  { list: LV, where: sel(opts([['end', '末尾', 'end'], ['start', '先頭', 'start']])), item: X() }, { list: '', where: 'end', item: '' },
  (b, g) => { useList(g); return [`listOp(${q(b.args.list)}, (l) => l.${b.args.where === 'start' ? 'unshift' : 'push'}(${g.expr(b.args.item)}));`]; });

B('list_remove_end', 'List', '－', '先頭/末尾を取り出す', 'Take from list',
  [J('配列', 'List'), E('list'), J('の', ':'), E('where'), J('を取り出して', 'remove and put into'), E('to'), J('に入れる', '')],
  { list: LV, where: sel(opts([['end', '末尾', 'last item'], ['start', '先頭', 'first item']])), to: { t: 'var', opt: true } }, { list: '', where: 'end', to: '' },
  (b, g) => { useList(g); return outOpt(b, g, `listOp(${q(b.args.list)}, (l) => l.${b.args.where === 'start' ? 'shift' : 'pop'}())`); });

B('list_insert', 'List', '↧', '指定位置に挿入', 'Insert at index',
  [J('配列', 'List'), E('list'), J('の', ': at index'), E('i'), J('番目に', 'insert'), E('item'), J('を挿入', '')],
  { list: LV, i: X('0'), item: X() }, { list: '', i: '0', item: '' },
  (b, g) => { useList(g); return [`listOp(${q(b.args.list)}, (l) => l.splice(${num(g, b.args.i)}, 0, ${g.expr(b.args.item)}));`]; });

B('list_remove_at', 'List', '✕', '指定位置を削除', 'Remove at index',
  [J('配列', 'List'), E('list'), J('の', ': remove index'), E('i'), J('番目から', 'count'), E('n'), J('個を削除', '')],
  { list: LV, i: X('0'), n: X('1') }, { list: '', i: '0', n: '1' },
  (b, g) => { useList(g); return [`listOp(${q(b.args.list)}, (l) => l.splice(${num(g, b.args.i)}, ${num(g, b.args.n)}));`]; });

B('list_set', 'List', '✎', '指定位置を書き換え', 'Set item at index',
  [J('配列', 'List'), E('list'), J('の', ': set index'), E('i'), J('番目を', 'to'), E('item'), J('にする', '')],
  { list: LV, i: X('0'), item: X() }, { list: '', i: '0', item: '' },
  (b, g) => { useList(g); return [`listOp(${q(b.args.list)}, (l) => { l[${num(g, b.args.i)}] = ${g.expr(b.args.item)}; });`]; });

B('list_get', 'List', '⌗', '要素の取得', 'Get item',
  [J('変数', 'Set'), E('to'), J('に', 'to'), E('list'), J('の', ': item'), E('i'), J('番目を入れる(負の数は末尾から)', '(negative counts from end)')],
  { to, list: LV, i: X('0') }, { to: '', list: '', i: '0' },
  (b, g) => { useList(g); return out(b, g, `${LIST(g, b)}.at(${num(g, b.args.i)})`); });

B('list_info', 'List', '#', '配列の情報', 'List info',
  [J('変数', 'Set'), E('to'), J('に', 'to'), E('list'), J('の', ':'), E('kind'), J('を入れる', '')],
  { to, list: LV, kind: sel(opts([['len', '要素数', 'length'], ['sum', '合計', 'sum'], ['avg', '平均', 'average'], ['max', '最大', 'max'], ['min', '最小', 'min'], ['first', '先頭の要素', 'first item'], ['last', '末尾の要素', 'last item'], ['empty', '空か(真偽)', 'is empty?']])) },
  { to: '', list: '', kind: 'len' },
  (b, g) => { useList(g); const L = LIST(g, b); return out(b, g, ({ len: `${L}.length`, first: `${L}[0]`, last: `${L}.at(-1)`, empty: `(${L}.length === 0)` })[b.args.kind] || `stat(${L}, ${q(b.args.kind)})`); });

B('list_find', 'List', '⌕', '要素の検索', 'Find in list',
  [J('変数', 'Set'), E('to'), J('に', 'to'), E('list'), J('の中の', ': in list,'), E('item'), J('の', ''), E('op'), J('を入れる', '')],
  { to, list: LV, item: X(), op: sel(opts([['indexOf', '最初の位置(なければ -1)', 'first index (-1 if none)'], ['lastIndexOf', '最後の位置', 'last index'], ['includes', '含まれるか(真偽)', 'included? (true/false)']])) },
  { to: '', list: '', item: '', op: 'includes' },
  (b, g) => { useList(g); return out(b, g, `${LIST(g, b)}.${['indexOf', 'lastIndexOf', 'includes'].includes(b.args.op) ? b.args.op : 'includes'}(${g.expr(b.args.item)})`); });

B('list_join', 'List', '⋯', '配列を文字列に結合', 'Join list to text',
  [J('変数', 'Set'), E('to'), J('に', 'to'), E('list'), J('を区切り文字', 'joined by'), E('sep'), J('で結合して入れる', '')],
  { to, list: LV, sep: X('", "') }, { to: '', list: '', sep: '", "' },
  (b, g) => { useList(g); return out(b, g, `${LIST(g, b)}.join(${str(g, b.args.sep)})`); });

B('list_slice', 'List', '✂', '配列の一部を切り出す', 'Slice list',
  [J('配列', 'List'), E('to'), J('に', 'to'), E('list'), J('の', ': from'), E('from'), J('番目から', ''), E('end'), J('番目の手前までを入れる', 'to (blank = end)')],
  { to: { t: 'var', vt: 'Array' }, list: LV, from: X('0'), end: X() }, { to: '', list: '', from: '0', end: '' },
  (b, g) => { useList(g); return out(b, g, `${LIST(g, b)}.slice(${num(g, b.args.from)}${String(b.args.end).trim() ? ', ' + num(g, b.args.end) : ''})`); });

B('list_concat', 'List', '⧺', '配列を連結', 'Concatenate lists',
  [J('配列', 'List'), E('to'), J('に', 'to'), E('a'), J('と', '+'), E('b'), J('を連結して入れる', 'joined')],
  { to: { t: 'var', vt: 'Array' }, a: LV, b: LV }, { to: '', a: '', b: '' },
  (b, g) => { useList(g); return out(b, g, `[...listOf(${q(b.args.a)}), ...listOf(${q(b.args.b)})]`); });

B('list_op', 'List', '⇅', '配列の並べ替え・整理', 'Sort / arrange list',
  [J('配列', 'List'), E('list'), J('を', ':'), E('op'), J('する', '')],
  { list: LV, op: sel(opts([['sort', '昇順に並べ替え', 'sort ascending'], ['sortdesc', '降順に並べ替え', 'sort descending'], ['sortnum', '数値として昇順に並べ替え', 'sort numerically'], ['reverse', '逆順に', 'reverse'], ['unique', '重複を削除', 'remove duplicates'], ['shuffle', 'シャッフル', 'shuffle'], ['clear', '空にする', 'clear']])) },
  { list: '', op: 'sort' },
  (b, g) => { useList(g); const L = q(b.args.list); return [({ sort: `listOp(${L}, (l) => l.sort());`, sortdesc: `listOp(${L}, (l) => l.sort().reverse());`, sortnum: `listOp(${L}, (l) => l.sort((x, y) => Number(x) - Number(y)));`, reverse: `listOp(${L}, (l) => l.reverse());`, unique: `setVar(${L}, unique(listOf(${L})));`, shuffle: `listOp(${L}, (l) => shuffle(l));`, clear: `setVar(${L}, []);` })[b.args.op] || `listOp(${L}, (l) => l.sort());`]; });

B('list_range', 'List', '…', '連番の配列', 'Number range',
  [J('配列', 'List'), E('to'), J('に', 'to'), E('from'), J('から', 'from'), E('end'), J('まで', 'to'), E('step'), J('刻みの連番を入れる', 'step')],
  { to: { t: 'var', vt: 'Array' }, from: X('1'), end: X('10'), step: X('1') }, { to: '', from: '1', end: '10', step: '1' },
  (b, g) => { useList(g); return out(b, g, `range(${num(g, b.args.from)}, ${num(g, b.args.end)}, ${num(g, b.args.step)})`); });

B('list_filter', 'List', '⧩', '条件で絞り込む(filter)', 'Filter list',
  [J('配列', 'List'), E('to'), J('に', 'to'), E('list'), J('の要素 item のうち', ': items where'), E('cond'), J('を満たすものを入れる', '')],
  { to: { t: 'var', vt: 'Array' }, list: LV, cond: { t: 'cond', scope: ['item'] } }, { to: '', list: '', cond: condDefault() },
  (b, g) => { useList(g); return out(b, g, `${LIST(g, b)}.filter(${pred(g, b.args.cond)})`); });

B('list_map', 'List', '↦', '各要素を変換(map)', 'Map list',
  [J('配列', 'List'), E('to'), J('に', 'to'), E('list'), J('の各要素 item を', ': each item →'), E('expr'), J('に変換して入れる', '')],
  { to: { t: 'var', vt: 'Array' }, list: LV, expr: X('item * 2') }, { to: '', list: '', expr: 'item' },
  (b, g) => { useList(g); return out(b, g, `${LIST(g, b)}.map((item) => ${g.scoped(['item'], () => g.expr(b.args.expr))})`); });

B('list_first', 'List', '⌕', '条件に合う最初の要素(find)', 'Find first match',
  [J('変数', 'Set'), E('to'), J('に', 'to'), E('list'), J('の要素 item のうち', ': first item where'), E('cond'), J('を満たす最初のものを入れる', '')],
  { to, list: LV, cond: { t: 'cond', scope: ['item'] } }, { to: '', list: '', cond: condDefault() },
  (b, g) => { useList(g); return out(b, g, `${LIST(g, b)}.find(${pred(g, b.args.cond)})`); });

B('list_test', 'List', '∃', '条件の判定(some/every)', 'Test list (some / every)',
  [J('変数', 'Set'), E('to'), J('に', 'to'), E('list'), J('の', ': whether'), E('mode'), J('要素が', 'items satisfy'), E('cond'), J('を満たすか(真偽)を入れる', '')],
  { to, list: LV, mode: sel(opts([['some', 'いずれかの', 'any'], ['every', 'すべての', 'all']])), cond: { t: 'cond', scope: ['item'] } }, { to: '', list: '', mode: 'some', cond: condDefault() },
  (b, g) => { useList(g); return out(b, g, `${LIST(g, b)}.${b.args.mode === 'every' ? 'every' : 'some'}(${pred(g, b.args.cond)})`); });

B('list_sortby', 'List', '⇅', 'キーで並べ替え', 'Sort by key',
  [J('配列', 'List'), E('list'), J('を各要素 item の', 'by'), E('key'), J('で', ''), E('order'), J('に並べ替える', '')],
  { list: LV, key: X('item.name'), order: sel(opts([['asc', '昇順', 'ascending'], ['desc', '降順', 'descending']])) }, { list: '', key: 'item', order: 'asc' },
  (b, g) => { useList(g); const k = g.scoped(['item'], () => g.expr(b.args.key)); return [`listOp(${q(b.args.list)}, (l) => l.sort((x, y) => { const f = (item) => ${k}; return (f(x) > f(y) ? 1 : f(x) < f(y) ? -1 : 0) * ${b.args.order === 'desc' ? -1 : 1}; }));`]; });

B('list_foreach', 'List', '∀', '配列の各要素に対して', 'For each item in list',
  [J('配列', 'List'), E('list'), J('の各要素を', ': each item as'), E('item'), J('、番号を', ', index as'), E('index'), J('として', '')],
  { list: LV, item: { t: 'ident', ph: 'item' }, index: { t: 'ident', ph: 'i' } }, { list: '', item: 'item', index: 'i' },
  (b, g) => { useList(g); const it = b.args.item || 'item', ix = b.args.index || 'i'; return [`for (const [${ix}, ${it}] of [...${LIST(g, b)}].entries()) {`, ...ind(g.loop(() => g.scoped([it, ix], () => g.stack(b.slots.body)))), '}']; },
  [{ key: 'body', label: J('各要素に対して', 'For each item') }]);

B('model_rows', 'List', '▦', 'データの全行を配列に', 'Rows to list',
  [J('配列', 'List'), E('to'), J('に データ', 'to rows of'), E('model'), J('の全行のコピーを入れる', '')],
  { to: { t: 'var', vt: 'Array' }, model: { t: 'model' } }, { to: '', model: '' },
  (b, g) => out(b, g, `(data[${q(b.args.model)}] || []).map((r) => ({ ...r }))`));

// =============================================================== Object / JSON
B('obj_set', 'Object', '✎', 'オブジェクトのプロパティを設定', 'Set object property',
  [J('オブジェクト', 'Object'), E('obj'), J('の', ': set'), E('key'), J('を', 'to'), E('value'), J('にする', '')],
  { obj: OV, key: X('"name"'), value: X() }, { obj: '', key: '"name"', value: '' },
  (b, g) => { g.use('list'); return [`objOp(${q(b.args.obj)}, (o) => { o[${str(g, b.args.key)}] = ${g.expr(b.args.value)}; });`]; });

B('obj_get', 'Object', '⌗', 'オブジェクトのプロパティを取得', 'Get object property',
  [J('変数', 'Set'), E('to'), J('に', 'to'), E('obj'), J('の', ':'), E('key'), J('を入れる', '')],
  { to, obj: OV, key: X('"name"') }, { to: '', obj: '', key: '"name"' },
  (b, g) => { g.use('list'); return out(b, g, `objOf(${q(b.args.obj)})[${str(g, b.args.key)}]`); });

B('obj_delete', 'Object', '✕', 'プロパティを削除', 'Delete property',
  [J('オブジェクト', 'Object'), E('obj'), J('から', ': remove'), E('key'), J('を削除', '')],
  { obj: OV, key: X('"name"') }, { obj: '', key: '"name"' },
  (b, g) => { g.use('list'); return [`objOp(${q(b.args.obj)}, (o) => { delete o[${str(g, b.args.key)}]; });`]; });

B('obj_info', 'Object', '#', 'オブジェクトの情報', 'Object info',
  [J('変数', 'Set'), E('to'), J('に', 'to'), E('obj'), J('の', ':'), E('kind'), J('を入れる', '')],
  { to, obj: OV, kind: sel(opts([['keys', 'キーの配列', 'keys'], ['values', '値の配列', 'values'], ['entries', '[キー,値]の配列', '[key, value] pairs'], ['len', 'プロパティ数', 'number of properties']])) },
  { to: '', obj: '', kind: 'keys' },
  (b, g) => { g.use('list'); const O = `objOf(${q(b.args.obj)})`; return out(b, g, ({ keys: `Object.keys(${O})`, values: `Object.values(${O})`, entries: `Object.entries(${O})`, len: `Object.keys(${O}).length` })[b.args.kind]); });

B('obj_merge', 'Object', '⧺', 'オブジェクトを結合', 'Merge objects',
  [J('オブジェクト', 'Object'), E('to'), J('に', 'to'), E('a'), J('と', '+'), E('b'), J('を結合して入れる', 'merged')],
  { to: { t: 'var', vt: 'Object' }, a: OV, b: OV }, { to: '', a: '', b: '' },
  (b, g) => { g.use('list'); return out(b, g, `{ ...objOf(${q(b.args.a)}), ...objOf(${q(b.args.b)}) }`); });

B('json_encode', 'Object', '{ }', 'JSON文字列にする', 'To JSON text',
  [J('変数', 'Set'), E('to'), J('に', 'to'), E('a'), J('のJSON文字列を入れる', 'as JSON text')],
  { to, a: X() }, { to: '', a: '' }, (b, g) => out(b, g, `JSON.stringify(${g.expr(b.args.a)}, null, 2)`));

B('json_decode', 'Object', '{ }', 'JSON文字列を読み取る', 'Parse JSON text',
  [J('変数', 'Set'), E('to'), J('に', 'to'), E('a'), J('をJSONとして読み取った値を入れる', 'parsed as JSON')],
  { to, a: X() }, { to: '', a: '' }, (b, g) => out(b, g, `JSON.parse(${str(g, b.args.a)})`));

// =============================================================== Time
const TIME_KINDS = [['local', '日時(ローカル表記)', 'date & time (local)'], ['date', '日付 YYYY-MM-DD', 'date YYYY-MM-DD'], ['time', '時刻 HH:MM:SS', 'time HH:MM:SS'], ['iso', 'ISO文字列', 'ISO string'], ['ts', 'タイムスタンプ(ms)', 'timestamp (ms)'], ['year', '年', 'year'], ['month', '月', 'month'], ['day', '日', 'day'], ['weekday', '曜日(0=日)', 'weekday (0=Sun)'], ['hour', '時', 'hour'], ['minute', '分', 'minute'], ['second', '秒', 'second'], ['ms', 'ミリ秒', 'millisecond']];
const UNITS = [['second', '秒', 'seconds'], ['minute', '分', 'minutes'], ['hour', '時間', 'hours'], ['day', '日', 'days'], ['week', '週', 'weeks'], ['month', 'か月', 'months'], ['year', '年', 'years']];
B('time_get', 'Time', '◷', '日付・時刻の取得', 'Get date / time',
  [J('変数', 'Set'), E('to'), J('に', 'to'), E('a'), J('(空=現在)の', '(blank = now):'), E('kind'), J('を入れる', '')],
  { to, a: X('(空=現在)'), kind: sel(opts(TIME_KINDS)) }, { to: '', a: '', kind: 'local' },
  (b, g) => { g.use('date'); return out(b, g, `dateGet(${g.expr(b.args.a)}, ${q(b.args.kind)})`); });

B('time_add', 'Time', '＋', '日付の加算', 'Add to date',
  [J('変数', 'Set'), E('to'), J('に', 'to'), E('a'), J('(空=現在)に', '(blank = now) plus'), E('n'), E('unit'), J('を足した日時(ISO)を入れる', '')],
  { to, a: X(), n: X('1'), unit: sel(opts(UNITS)) }, { to: '', a: '', n: '1', unit: 'day' },
  (b, g) => { g.use('date'); return out(b, g, `dateAdd(${g.expr(b.args.a)}, ${num(g, b.args.n)}, ${q(b.args.unit)})`); });

B('time_diff', 'Time', '−', '日付の差', 'Date difference',
  [J('変数', 'Set'), E('to'), J('に', 'to'), E('a'), J('−', '−'), E('b'), J('の差を', 'in'), E('unit'), J('単位で入れる', '')],
  { to, a: X(), b: X(), unit: sel(opts(UNITS)) }, { to: '', a: '', b: '', unit: 'day' },
  (b, g) => { g.use('date'); return out(b, g, `dateDiff(${g.expr(b.args.a)}, ${g.expr(b.args.b)}, ${q(b.args.unit)})`); });

B('time_format', 'Time', '▤', '日付の書式化', 'Format date',
  [J('変数', 'Set'), E('to'), J('に', 'to'), E('a'), J('(空=現在)を書式', '(blank = now) with pattern'), E('fmt'), J('で整形して入れる', '')],
  { to, a: X(), fmt: { t: 'text', ph: 'YYYY/MM/DD HH:mm (W)' } }, { to: '', a: '', fmt: 'YYYY/MM/DD HH:mm' },
  (b, g) => { g.use('date'); return out(b, g, `dateFmt(${g.expr(b.args.a)}, ${q(b.args.fmt)})`); });

// =============================================================== Control
B('while', 'Control', '↻', '条件の間繰り返す', 'While',
  [J('もし', 'While'), E('cond'), J('の間繰り返す', 'repeat')],
  { cond: { t: 'cond' } }, { cond: defaultCond() },
  (b, g) => { const n = g.uid('n'); return [`let ${n} = 0;`, `while (${g.cond(b.args.cond)}) {`, `  if (++${n} > 100000) throw new Error("繰り返しが多すぎます(無限ループの可能性)");`, ...ind(g.loop(() => g.stack(b.slots.body))), '}']; },
  [{ key: 'body', label: J('繰り返す内容', 'Repeat') }]);

B('for_range', 'Control', '∑', '数え上げ繰り返し', 'Count loop',
  [E('i'), J('を', 'Count'), E('from'), J('から', 'from'), E('end'), J('まで', 'to'), E('step'), J('ずつ増やしながら', 'by')],
  { i: { t: 'ident', ph: 'i' }, from: X('1'), end: X('10'), step: X('1') }, { i: 'i', from: '1', end: '10', step: '1' },
  (b, g) => { const i = b.args.i || 'i', s = g.uid('s'), e = g.uid('e'); return [`const ${s} = ${num(g, b.args.step)} || 1, ${e} = ${num(g, b.args.end)};`, `for (let ${i} = ${num(g, b.args.from)}; ${s} > 0 ? ${i} <= ${e} : ${i} >= ${e}; ${i} += ${s}) {`, ...ind(g.loop(() => g.scoped([i], () => g.stack(b.slots.body)))), '}']; },
  [{ key: 'body', label: J('繰り返す内容', 'Repeat') }]);

B('break', 'Control', '⏹', 'ループを抜ける', 'Break loop', [J('ループを抜ける', 'Break out of the loop')], {}, {},
  (b, g) => (g.inLoop() ? ['break;'] : ['// (ループの外では使えません)']));
B('continue', 'Control', '⏭', '次の繰り返しへ', 'Continue loop', [J('次の繰り返しへ進む', 'Skip to the next iteration')], {}, {},
  (b, g) => (g.inLoop() ? ['continue;'] : ['// (ループの外では使えません)']));
B('return', 'Control', '⏏', '処理を終了', 'Stop script', [J('この処理を終了する', 'Stop this script')], {}, {}, () => ['return;']);

B('try_catch', 'Control', '🛟', 'エラー処理', 'Try / catch',
  [J('エラーが起きても止めない。エラー内容は', 'Catch errors. Error message variable:'), E('err')],
  { err: { t: 'ident', ph: 'error' } }, { err: 'error' },
  (b, g) => { const e = b.args.err || 'error'; return ['try {', ...ind(g.stack(b.slots.body)), `} catch (${e}) {`, ...ind(g.scoped([e], () => g.stack(b.slots.catch))), '}']; },
  [{ key: 'body', label: J('実行する', 'Try') }, { key: 'catch', label: J('エラーのとき', 'On error') }]);

B('delay_run', 'Control', '⏲', '一定時間後に実行', 'Run after delay',
  [E('ms'), J('ミリ秒後に実行する', 'ms later, run')],
  { ms: X('1000') }, { ms: '1000' },
  (b, g) => [`later(${num(g, b.args.ms)}, async () => {`, ...ind(g.stack(b.slots.body)), '});'],
  [{ key: 'body', label: J('後で実行', 'Later') }]);

B('timer_start', 'Control', '⏱', 'タイマーを開始', 'Start timer',
  [J('タイマー', 'Timer'), E('name'), J('を', ': every'), E('ms'), J('ミリ秒ごとに実行', 'ms, run')],
  { name: { t: 'text', ph: 'clock' }, ms: X('1000') }, { name: 'timer1', ms: '1000' },
  (b, g) => [`startTimer(${q(b.args.name)}, ${num(g, b.args.ms)}, async () => {`, ...ind(g.stack(b.slots.body)), '});'],
  [{ key: 'body', label: J('毎回実行', 'Every tick') }]);
B('timer_stop', 'Control', '⏹', 'タイマーを停止', 'Stop timer',
  [J('タイマー', 'Timer'), E('name'), J('を停止する', 'stop')], { name: { t: 'text', ph: 'clock' } }, { name: 'timer1' },
  (b, g) => [`stopTimer(${q(b.args.name)});`]);

B('note', 'Control', '✎', 'メモ(注釈)', 'Comment', [J('メモ:', 'Note:'), E('text')], { text: { t: 'text', ph: '説明を書く…' } }, { text: '' },
  (b) => [`// ${String(b.args.text).replace(/[\r\n]+/g, ' ')}`]);

// =============================================================== UI
B('ui_style', 'UI', '🎨', 'スタイルを変更', 'Set style',
  [E('target'), J('の', ':'), E('prop'), J('を', 'to'), E('value'), J('にする', '')],
  { target: { t: 'comp' }, prop: sel(opts([['color', '文字色', 'text color'], ['background', '背景', 'background'], ['font-size', '文字サイズ', 'font size'], ['font-weight', '太さ', 'font weight'], ['width', '幅', 'width'], ['height', '高さ', 'height'], ['opacity', '不透明度(0〜1)', 'opacity (0–1)'], ['border-radius', '角丸', 'border radius'], ['border', '枠線', 'border'], ['margin', '余白(外)', 'margin'], ['padding', '余白(内)', 'padding'], ['transform', '変形', 'transform'], ['display', '表示方式', 'display']])), value: X('"red"') },
  { target: '', prop: 'color', value: '"red"' },
  (b, g) => [`setStyle(${g.comp(b.args.target)}, ${q(b.args.prop)}, ${g.expr(b.args.value)});`]);

B('ui_attr', 'UI', '⚑', '属性を設定', 'Set attribute',
  [E('target'), J('の', ':'), E('attr'), J('を', 'to'), E('value'), J('にする', '')],
  { target: { t: 'comp' }, attr: sel(opts([['src', '画像/動画のURL (src)', 'image / video URL (src)'], ['alt', '代替テキスト (alt)', 'alt text'], ['placeholder', 'プレースホルダ', 'placeholder'], ['title', 'ツールチップ (title)', 'tooltip (title)'], ['href', 'リンク先 (href)', 'link (href)']])), value: X() },
  { target: '', attr: 'src', value: '' },
  (b, g) => [`setAttr(${g.comp(b.args.target)}, ${q(b.args.attr)}, ${g.expr(b.args.value)});`]);

B('ui_disable', 'UI', '⛔', '有効/無効の切り替え', 'Enable / disable',
  [E('target'), J('を', ':'), E('state')],
  { target: { t: 'comp' }, state: sel(opts([['1', '無効にする', 'disable'], ['0', '有効にする', 'enable']])) }, { target: '', state: '1' },
  (b, g) => [`setDisabled(${g.comp(b.args.target)}, ${b.args.state === '0' ? 'false' : 'true'});`]);

B('ui_focus', 'UI', '◎', 'フォーカス/スクロール', 'Focus / scroll to',
  [E('target'), J('へ', ':'), E('mode')],
  { target: { t: 'comp' }, mode: sel(opts([['focus', 'フォーカスを移す', 'move focus'], ['scroll', 'スクロールして表示', 'scroll into view']])) }, { target: '', mode: 'focus' },
  (b, g) => [`${b.args.mode === 'scroll' ? 'scrollToEl' : 'focusEl'}(${g.comp(b.args.target)});`]);

B('ui_get', 'UI', '⌗', 'UIの状態を取得', 'Read UI state',
  [J('変数', 'Set'), E('to'), J('に', 'to'), E('target'), J('の', ':'), E('kind'), J('を入れる', '')],
  { to, target: { t: 'comp' }, kind: sel(opts([['value', '入力値', 'input value'], ['text', '表示テキスト', 'text'], ['checked', 'チェック状態', 'checked'], ['visible', '表示中か', 'visible?']])) }, { to: '', target: '', kind: 'value' },
  (b, g) => out(b, g, `readUi(${g.comp(b.args.target)}, ${q(b.args.kind)})`));

// =============================================================== Animation
B('anim_play', 'Animation', '✦', 'アニメーションを再生', 'Play animation',
  [E('target'), J('を', ':'), E('name'), J('で', 'for'), E('ms'), J('ミリ秒再生', 'ms'), E('wait')],
  { target: { t: 'comp' }, name: { t: 'anim' }, ms: X('600'), wait: sel(opts([['0', '(終わりを待たない)', '(don\'t wait)'], ['1', '終わるまで待つ', 'wait until done']])) },
  { target: '', name: 'bounceIn', ms: '600', wait: '0' },
  (b, g) => { g.use('anim'); return [`${b.args.wait === '1' ? 'await ' : ''}playAnim(${g.comp(b.args.target)}, ${q(b.args.name)}, ${num(g, b.args.ms)}, ${b.args.wait === '1'});`]; });

B('anim_tween', 'Animation', '⇢', '滑らかに動かす(トゥイーン)', 'Tween (smooth move)',
  [E('target'), J('の', ':'), E('prop'), J('を', 'to'), E('value'), J('へ', ''), E('ms'), J('ミリ秒かけて変化(終わるまで待つ)', 'ms (waits until done)')],
  { target: { t: 'comp' }, prop: sel(opts([['x', '横位置 X(px)', 'X offset (px)'], ['y', '縦位置 Y(px)', 'Y offset (px)'], ['scale', '拡大率', 'scale'], ['rotate', '回転(度)', 'rotation (deg)'], ['opacity', '不透明度(0〜1)', 'opacity (0–1)']])), value: X('100'), ms: X('500') },
  { target: '', prop: 'x', value: '100', ms: '500' },
  (b, g) => { g.use('anim'); const p = ['x', 'y', 'scale', 'rotate', 'opacity'].includes(b.args.prop) ? b.args.prop : 'x'; return [`await tween(${g.comp(b.args.target)}, ${q(p)}, ${num(g, b.args.value)}, ${num(g, b.args.ms)});`]; });

B('anim_stop', 'Animation', '⏹', 'アニメーションを停止', 'Stop animation',
  [E('target'), J('のアニメーションを停止する', ': stop animation')], { target: { t: 'comp' } }, { target: '' },
  (b, g) => { g.use('anim'); return [`stopAnim(${g.comp(b.args.target)});`]; });
B('anim_reset', 'Animation', '↺', '見た目を元に戻す', 'Reset appearance',
  [E('target'), J('の位置・透明度・アニメーションを初期状態に戻す', ': reset position, opacity and animation')], { target: { t: 'comp' } }, { target: '' },
  (b, g) => { g.use('anim'); return [`resetAnim(${g.comp(b.args.target)});`]; });

// =============================================================== System
B('sys_log', 'System', '›_', 'コンソールに出力', 'Log to console', [J('コンソールに', 'Log'), E('value'), J('を出力', 'to console')],
  { value: X() }, { value: '' }, (b, g) => [`console.log(${g.expr(b.args.value)});`]);
B('sys_prompt', 'System', '⌨', '入力ダイアログ', 'Ask for input',
  [J('変数', 'Set'), E('to'), J('に', 'to'), E('msg'), J('と尋ねて入力された文字列を入れる', 'asked in a dialog')],
  { to, msg: X('"名前は?"') }, { to: '', msg: '"入力してください"' }, (b, g) => out(b, g, `(prompt(${str(g, b.args.msg)}) ?? "")`));
B('sys_confirm', 'System', '✔', '確認ダイアログ', 'Confirm dialog',
  [J('変数', 'Set'), E('to'), J('に', 'to'), E('msg'), J('と確認してOKなら true を入れる', 'confirmed (true if OK)')],
  { to, msg: X('"よろしいですか?"') }, { to: '', msg: '"よろしいですか?"' }, (b, g) => out(b, g, `confirm(${str(g, b.args.msg)})`));
B('store_set', 'System', '💾', 'ブラウザに保存', 'Save to browser',
  [J('ブラウザに', 'Save'), E('key'), J('として', 'as key, value'), E('value'), J('を保存', 'to browser storage')],
  { key: { t: 'text', ph: 'settings' }, value: X() }, { key: 'key1', value: '' },
  (b, g) => { g.use('sys'); return [`storeSet(${q(b.args.key)}, ${g.expr(b.args.value)});`]; });
B('store_get', 'System', '📂', 'ブラウザから読み込み', 'Load from browser',
  [J('変数', 'Set'), E('to'), J('に保存済みの', 'to saved'), E('key'), J('を読み込む(なければ', '(default if none:'), E('def'), J(')', ')')],
  { to, key: { t: 'text', ph: 'settings' }, def: X() }, { to: '', key: 'key1', def: '""' },
  (b, g) => { g.use('sys'); return out(b, g, `storeGet(${q(b.args.key)}, ${g.expr(b.args.def)})`); });
B('store_del', 'System', '🗑', '保存を削除', 'Delete saved value',
  [J('保存済みの', 'Delete saved'), E('key'), J('を削除', '')], { key: { t: 'text' } }, { key: 'key1' },
  (b, g) => { g.use('sys'); return [`storeDel(${q(b.args.key)});`]; });
B('sys_copy', 'System', '⧉', 'クリップボードにコピー', 'Copy to clipboard',
  [E('value'), J('をクリップボードにコピー', 'Copy to clipboard')], { value: X() }, { value: '' },
  (b, g) => { g.use('sys'); return [`await copyText(${str(g, b.args.value)});`]; });
B('sys_open', 'System', '↗', 'URLを開く', 'Open URL',
  [E('url'), J('を', ''), E('tab'), J('で開く', 'open')], { url: X('"https://example.com"'), tab: sel(opts([['1', '新しいタブ', 'in a new tab'], ['0', 'このタブ', 'in this tab']])) }, { url: '', tab: '1' },
  (b, g) => { g.use('sys'); return [`openUrl(${str(g, b.args.url)}, ${b.args.tab !== '0'});`]; });
B('sys_download', 'System', '⬇', 'テキストをファイル保存', 'Download text file',
  [J('ファイル名', 'File name'), E('name'), J('で', ', content'), E('value'), J('をダウンロード', 'download')],
  { name: X('"memo.txt"'), value: X() }, { name: '"memo.txt"', value: '' },
  (b, g) => { g.use('sys'); return [`downloadText(${str(g, b.args.name)}, ${str(g, b.args.value)});`]; });
B('sys_fetch', 'System', '🌐', 'Web API を呼ぶ(fetch)', 'Call web API (fetch)',
  [J('変数', 'Set'), E('to'), J('に', 'to the JSON from'), E('method'), E('url'), J('の結果を入れる', ''), E('body')],
  { to, method: sel(opts([['GET', 'GET', 'GET'], ['POST', 'POST(本文JSON→)', 'POST (JSON body →)']])), url: X('"https://api.example.com/data"'), body: X() }, { to: '', method: 'GET', url: '', body: '' },
  (b, g) => { g.use('sys'); return out(b, g, `await fetchJson(${str(g, b.args.url)}, ${q(b.args.method)}${String(b.args.body).trim() ? ', ' + g.expr(b.args.body) : ''})`); });
B('sys_info', 'System', 'ℹ', '環境情報の取得', 'Get environment info',
  [J('変数', 'Set'), E('to'), J('に', 'to'), E('kind'), J('を入れる', '')],
  { to, kind: sel(opts([['width', '画面の幅', 'window width'], ['height', '画面の高さ', 'window height'], ['url', '現在のURL', 'current URL'], ['lang', 'ブラウザの言語', 'browser language'], ['online', 'オンラインか', 'online?'], ['dark', 'ダークモードか', 'dark mode?']])) }, { to: '', kind: 'width' },
  (b, g) => { g.use('sys'); return out(b, g, `sysInfo(${q(b.args.kind)})`); });
B('sys_title', 'System', '🏷', 'ページタイトルを設定', 'Set page title', [J('ページタイトルを', 'Set page title to'), E('value'), J('にする', '')],
  { value: X() }, { value: '' }, (b, g) => [`document.title = ${str(g, b.args.value)};`]);
B('sys_reload', 'System', '⟳', 'ページを再読み込み', 'Reload page', [J('ページを再読み込みする', 'Reload the page')], {}, {}, () => ['location.reload();']);

// Blocks whose value is true/false are hexagonal when used as value blocks.
['math_is', 'regex_test', 'list_test', 'sys_confirm'].forEach((t) => { blocks.get(t).bool = true; });

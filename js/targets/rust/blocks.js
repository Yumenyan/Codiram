// Blocks only the command-line generators understand (program start, console / file I/O).
// They have no Web implementation (`gen` is a stub); the Rust CLI generator reads them through `ir` / `irHat` / `irExpr`.
import { stmt, hat, E } from '../../blocks.js';
import { blocks } from '../../registry.js';
import { R } from '../../blocks-reporters.js';
import { J } from '../../i18n-helpers.js';

const CLI = ['rust-cli'];
const X = (ph) => ({ t: 'expr', ph });
const sel = (o) => ({ t: 'select', opts: o });
const cliStmt = (type, icon, ja, en, parts, fields, defaults, caps, ir) => {
  stmt(type, 'System', icon, ja, parts, fields, defaults, () => [], undefined);
  Object.assign(blocks.get(type), { targets: CLI, portable: true, en, caps, ir });
};
const cliVal = (type, icon, ja, en, parts, fields, defaults, caps, irExpr, bool = false) => {
  R(type, 'System', icon, ja, en, parts, fields, defaults, () => '""', { bool });
  Object.assign(blocks.get(type), { targets: CLI, portable: true, caps, irExpr });
};

hat('cli_main', J('プログラムが開始されたとき', 'When the program starts'), [J('プログラムが開始されたとき', 'When the program starts')], {}, {}, () => []);
Object.assign(blocks.get('cli_main'), { targets: CLI, portable: true, en: 'When the program starts', caps: ['entry'], irHat: () => ({ kind: 'main' }) });

cliStmt('cli_print', '🖨', '画面に出力', 'Print', [E('value'), J('を', 'Print'), E('nl'), J('出力', '')],
  { value: X('"Hello, world!"'), nl: sel([['1', J('改行つきで', 'with a newline')], ['0', J('改行なしで', 'without a newline')]]) }, { value: '"Hello, world!"', nl: '1' }, ['io'],
  (b, c) => ({ op: 'cli.print', value: c.expr(b.args.value), newline: b.args.nl !== '0' }));
cliStmt('cli_exit', '⏹', 'プログラムを終了', 'Exit program', [J('終了コード', 'Exit with code'), E('code'), J('でプログラムを終了', '')],
  { code: X('0') }, { code: '0' }, ['cli'], (b, c) => ({ op: 'cli.exit', code: c.expr(b.args.code) }));
cliStmt('cli_write_file', '💾', 'ファイルに書き込む', 'Write file', [J('ファイル', 'Write to file'), E('path'), J('に', ''), E('text'), J('を', ''), E('mode'), J('', '')],
  { path: X('"out.txt"'), text: X('"text"'), mode: sel([['write', J('上書き保存', 'overwrite')], ['append', J('末尾に追記', 'append')]]) }, { path: '"out.txt"', text: '"text"', mode: 'write' }, ['filesystem'],
  (b, c) => ({ op: 'cli.write_file', path: c.expr(b.args.path), text: c.expr(b.args.text), append: b.args.mode === 'append' }));

cliVal('r_cli_input', '⌨', '入力された1行', 'Line typed by the user', [J('キーボードから入力された1行', 'a line typed on the keyboard')], {}, {}, ['input'],
  () => ({ k: 'cli', fn: 'readLine', type: 'str' }));
cliVal('r_cli_arg', '🧾', 'コマンドライン引数', 'Command-line argument', [J('コマンドライン引数', 'command-line argument'), E('n'), J('番目(1から)', '(starting at 1)')],
  { n: X('1') }, { n: '1' }, ['cli'], (b, c) => ({ k: 'cli', fn: 'arg', type: 'str', args: [c.expr(b.args.n)] }));
cliVal('r_cli_read_file', '📄', 'ファイルの内容', 'File contents', [J('ファイル', 'contents of file'), E('path'), J('の内容', '')],
  { path: X('"in.txt"') }, { path: '"in.txt"' }, ['filesystem'], (b, c) => ({ k: 'cli', fn: 'readFile', type: 'str', args: [c.expr(b.args.path)] }));
cliVal('b_cli_file_exists', '❔', 'ファイルが存在するか', 'File exists', [J('ファイル', 'file'), E('path'), J('が存在する', 'exists')],
  { path: X('"in.txt"') }, { path: '"in.txt"' }, ['filesystem'], (b, c) => ({ k: 'cli', fn: 'fileExists', type: 'bool', args: [c.expr(b.args.path)] }), true);

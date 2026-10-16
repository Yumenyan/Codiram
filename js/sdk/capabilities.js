// Capabilities: what a generator can do. A generator lists them in `supports`; blocks need some of them
// (explicit `def.caps`, or by category - see blockCaps in registry.js). Blocks that need none are "common" blocks.
import { J } from '../i18n-helpers.js';

export const CAPABILITIES = {
  ui: J('UI(画面部品)', 'UI'),
  events: J('イベント', 'Events'),
  entry: J('プログラム開始', 'Program entry point'),
  variables: J('変数', 'Variables'),
  conditions: J('条件分岐', 'Conditions'),
  loops: J('繰り返し', 'Loops'),
  functions: J('関数', 'Functions'),
  arrays: J('配列', 'Arrays'),
  objects: J('オブジェクト', 'Objects'),
  data: J('データモデル', 'Data models'),
  localstorage: J('ローカル保存', 'Local storage'),
  canvas: J('描画(Canvas)', 'Canvas drawing'),
  audio: J('サウンド', 'Audio'),
  game: J('ゲーム', 'Game'),
  animation: J('アニメーション', 'Animation'),
  http: J('HTTP', 'HTTP'),
  websocket: J('WebSocket', 'WebSocket'),
  cli: J('コマンドライン', 'Command line'),
  io: J('出力(print)', 'Output (print)'),
  input: J('キーボード入力', 'Keyboard input'),
  server: J('サーバー/API', 'Server / API'),
  database: J('データベース', 'Database'),
  bot: J('チャットボット', 'Chat bot'),
  extension: J('エディタ拡張', 'Editor extension'),
  ci: J('CI/CD', 'CI/CD'),
  filesystem: J('ファイル', 'Filesystem'),
  clipboard: J('クリップボード', 'Clipboard'),
  notification: J('通知', 'Notifications'),
  window: J('ウィンドウ操作', 'Window control'),
  dialog: J('ファイル選択ダイアログ', 'File dialogs'),
  minecraft: J('Minecraft', 'Minecraft'),
};
export const capLabel = (id) => CAPABILITIES[id] || { ja: id, en: id };

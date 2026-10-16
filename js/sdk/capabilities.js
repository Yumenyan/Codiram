// Capabilities: what a generator can do. A generator lists them in `supports`; blocks need some of them
// (explicit `def.caps`, or by category - see blockCaps in registry.js). Blocks that need none are "common" blocks.
import { J } from '../i18n-helpers.js';

export const CAPABILITIES = {
  ui: J('UI(画面部品)', 'UI'),
  events: J('イベント', 'Events'),
  variables: J('変数', 'Variables'),
  conditions: J('条件分岐', 'Conditions'),
  loops: J('繰り返し', 'Loops'),
  functions: J('関数', 'Functions'),
  data: J('データモデル', 'Data models'),
  canvas: J('描画(Canvas)', 'Canvas drawing'),
  audio: J('サウンド', 'Audio'),
  game: J('ゲーム', 'Game'),
  animation: J('アニメーション', 'Animation'),
  http: J('HTTP', 'HTTP'),
  websocket: J('WebSocket', 'WebSocket'),
  cli: J('コマンドライン', 'Command line'),
  io: J('標準入出力', 'Standard I/O'),
  filesystem: J('ファイル', 'Filesystem'),
  clipboard: J('クリップボード', 'Clipboard'),
  notification: J('通知', 'Notifications'),
  window: J('ウィンドウ操作', 'Window control'),
  dialog: J('ファイル選択ダイアログ', 'File dialogs'),
  minecraft: J('Minecraft', 'Minecraft'),
};
export const capLabel = (id) => CAPABILITIES[id] || { ja: id, en: id };

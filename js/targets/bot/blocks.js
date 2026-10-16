// Chat-bot blocks (Discord). A hat plus reply / value blocks; the Discord generator maps them with
// extensions.customStatements / customValues / events.eventHandlers in its Definition.
import { stmt, hat, E } from '../../blocks.js';
import { blocks } from '../../registry.js';
import { R } from '../../blocks-reporters.js';
import { J } from '../../i18n-helpers.js';

const BOT = ['discord-bot'];
const X = (ph) => ({ t: 'expr', ph });

hat('bot_on_command', J('コマンドを受け取ったとき', 'When a command is received'), [J('メッセージが', 'When a message starts with'), E('command'), J('で始まるとき', '')],
  { command: { t: 'text', ph: '!hello' } }, { command: '!hello' }, () => []);
Object.assign(blocks.get('bot_on_command'), { targets: BOT, caps: ['bot'], en: 'When a command is received',
  irHat: (b, c) => { c.state.event = 'bot.command'; return { kind: 'event', event: 'bot.command', args: { command: String(b.args.command || '!cmd').replace(/["\\\n\r]/g, '') } }; } });

stmt('bot_reply', 'System', '💬', '返信する', [E('text'), J('と返信する', 'Reply with')], { text: X('"Hello!"') }, { text: '"Hello!"' }, () => [], undefined);
Object.assign(blocks.get('bot_reply'), { targets: BOT, caps: ['bot'], en: 'Reply', ir: (b, c) => ({ op: 'bot.reply', text: c.expr(b.args.text) }) });

const val = (type, icon, ja, en, fn, ty) => {
  R(type, 'System', icon, ja, en, [J(ja, en)], {}, {}, () => '""');
  Object.assign(blocks.get(type), { targets: BOT, caps: ['bot'], irExpr: () => ({ k: 'bot', fn, type: ty }) });
};
val('r_bot_author', '🙋', '送信者の名前', 'Sender name', 'bot.author', 'str');
val('r_bot_args', '📝', 'コマンドの後ろの文字', 'Text after the command', 'bot.args', 'str');
val('r_bot_content', '✉', 'メッセージ全体', 'Whole message', 'bot.content', 'str');

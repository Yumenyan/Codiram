// Minecraft (Fabric) blocks. Events/actions are Minecraft-only; a small set of Common blocks is
// also enabled for this target by giving it an `ir` (block -> IR) implementation.
import { stmt, hat, E, q } from '../../blocks.js';
import { blocks } from '../../registry.js';
import { R } from '../../blocks-reporters.js';
import { J } from '../../i18n-helpers.js';

const X = (ph) => ({ t: 'expr', ph });
const MC = ['minecraft'];
const sel = (o) => ({ t: 'select', opts: o });
const opts = (arr) => arr.map(([v, ja, en]) => [v, J(ja, en)]);

import { eventHas } from './events.js';

/** reports a problem when the current event cannot provide `what` ('player' | 'block' | 'entity') */
function needs(c, what, blockId) {
  const ev = c.state.event;
  if (ev === 'function' && what === 'player') return true; // null-safe in functions
  if (eventHas(ev, what)) return true;
  const msg = { player: 'このブロックは「プレイヤー」のいるイベントでのみ使えます(サーバー開始/停止・Tick・関数では使えません)',
    block: 'このブロックは ブロックのイベント(右クリック/壊す/置く)でのみ使えます', entity: 'このブロックは エンティティのイベント(攻撃/右クリック)でのみ使えます' }[what];
  c.problem(msg, blockId);
  return false;
}

const mcStmt = (type, icon, ja, en, parts, fields, defaults, ir, need = 'player') => {
  stmt(type, 'Minecraft', icon, ja, parts, fields, defaults, () => [], undefined);
  Object.assign(blocks.get(type), { targets: MC, en, ir: (b, c) => { if (need && typeof need === 'string') needs(c, need, b.id); else if (typeof need === 'function' && need(b)) needs(c, 'player', b.id); return ir(b, c); } });
};
const mcHat = (type, ja, en, parts, fields, defaults, event, argsOf) => {
  hat(type, ja, parts, fields, defaults, () => []);
  Object.assign(blocks.get(type), { targets: MC, en, irHat: (b, c) => { c.state.event = event; return { kind: 'event', event, args: argsOf ? argsOf(b.args, c) : {} }; } });
};
const mcVal = (type, icon, ja, en, parts, fields, defaults, irExpr, bool = false, need = null) => {
  R(type, 'Minecraft', icon, ja, en, parts, fields, defaults, () => '""', { bool });
  Object.assign(blocks.get(type), { targets: MC, irExpr: (b, c) => { if (need) needs(c, need, null); return irExpr(b, c); } });
};

// ------------------------------------------------------------------ events
mcHat('mc_on_join', 'プレイヤーが参加したとき', 'When a player joins', [J('プレイヤーがワールドに参加したとき', 'When a player joins the world')], {}, {}, 'player_join');
mcHat('mc_on_leave', 'プレイヤーが退出したとき', 'When a player leaves', [J('プレイヤーがワールドから退出したとき', 'When a player leaves the world')], {}, {}, 'player_leave');
mcHat('mc_on_respawn', 'プレイヤーがリスポーンしたとき', 'When a player respawns', [J('プレイヤーがリスポーンしたとき', 'When a player respawns')], {}, {}, 'player_respawn');
mcHat('mc_on_death', 'プレイヤーが死亡したとき', 'When a player dies', [J('プレイヤーが死亡したとき', 'When a player dies')], {}, {}, 'player_death');
mcHat('mc_on_dimension', 'ディメンションを移動したとき', 'When a player changes dimension', [J('プレイヤーがディメンションを移動したとき', 'When a player changes dimension')], {}, {}, 'dimension_change');
mcHat('mc_on_right_click', 'ブロックを右クリックしたとき', 'When a player right-clicks a block', [J('プレイヤーがブロックを右クリックしたとき', 'When a player right-clicks a block')], {}, {}, 'right_click_block');
mcHat('mc_on_block_break', 'ブロックを壊したとき', 'When a player breaks a block', [J('プレイヤーがブロックを壊したとき', 'When a player breaks a block')], {}, {}, 'block_break');
mcHat('mc_on_block_place', 'ブロックを置いたとき', 'When a player places a block', [J('プレイヤーがブロックを置いたとき(右クリック時)', 'When a player places a block (on right-click)')], {}, {}, 'block_place');
mcHat('mc_on_item_use', 'アイテムを使ったとき', 'When a player uses an item', [J('プレイヤーがアイテムを使ったとき(右クリック)', 'When a player uses an item (right-click)')], {}, {}, 'item_use');
mcHat('mc_on_attack', 'エンティティを攻撃したとき', 'When a player attacks an entity', [J('プレイヤーがエンティティを攻撃したとき', 'When a player attacks an entity')], {}, {}, 'attack_entity');
mcHat('mc_on_use_entity', 'エンティティを右クリックしたとき', 'When a player right-clicks an entity', [J('プレイヤーがエンティティを右クリックしたとき', 'When a player right-clicks an entity')], {}, {}, 'use_entity');
mcHat('mc_on_command', 'コマンドが実行されたとき', 'When a custom command runs', [J('コマンド /', 'When command /'), E('name'), J('が実行されたとき', 'is run')],
  { name: { t: 'text', ph: 'hello' } }, { name: 'hello' }, 'command', (a) => ({ name: String(a.name || '').replace(/[^a-z0-9_]/gi, '').toLowerCase() || 'cmd' }));
mcHat('mc_on_server_start', 'サーバーが起動したとき', 'When the server starts', [J('サーバーが起動したとき', 'When the server has started')], {}, {}, 'server_start');
mcHat('mc_on_server_stop', 'サーバーが停止するとき', 'When the server stops', [J('サーバーが停止するとき', 'When the server is stopping')], {}, {}, 'server_stop');
mcHat('mc_on_tick', '一定時間ごと(Tick)', 'Every N ticks', [J('', 'Every'), E('ticks'), J('ティックごと(20ティック=1秒)', 'ticks (20 ticks = 1 second)')],
  { ticks: { t: 'text', ph: '20' } }, { ticks: '20' }, 'server_tick', (a) => ({ ticks: Math.max(1, Math.round(Number(a.ticks) || 20)) }));

// ------------------------------------------------------------------ actions
const ITEM = { t: 'text', ph: 'minecraft:diamond', list: 'dl-mc-items' };
const BLOCK = { t: 'text', ph: 'minecraft:stone', list: 'dl-mc-blocks' };
const SOUND = { t: 'text', ph: 'minecraft:entity.player.levelup', list: 'dl-mc-sounds' };
const ENTITY = { t: 'text', ph: 'minecraft:zombie', list: 'dl-mc-entities' };
const EFFECT = { t: 'text', ph: 'minecraft:speed', list: 'dl-mc-effects' };
const POSMODE = sel(opts([['relative', 'プレイヤーからの相対', 'relative to the player'], ['absolute', 'ワールド座標', 'world coordinates']]));

mcStmt('mc_send_message', '💬', 'メッセージを送る', 'Send message', [J('メッセージ', 'Send'), E('text'), J('を', 'to'), E('to'), J('に', 'as'), E('where'), J('で送る', '')],
  { text: X('"Hello Minecraft!"'), to: sel(opts([['player', 'プレイヤー', 'the player'], ['all', '全員', 'everyone']])), where: sel(opts([['chat', 'チャット', 'chat'], ['actionbar', 'アクションバー', 'action bar']])) },
  { text: '"Hello Minecraft!"', to: 'player', where: 'chat' },
  (b, c) => ({ op: 'mc.send_message', to: b.args.to === 'all' ? 'all' : 'player', overlay: b.args.where === 'actionbar', text: c.expr(b.args.text) }), (b) => b.args.to !== 'all');
mcStmt('mc_run_command', '⌨', 'コマンドを実行', 'Run command', [J('コマンド /', 'Run /'), E('cmd'), J('を', 'as'), E('as'), J('として実行', '')],
  { cmd: X('"time set day"'), as: sel(opts([['server', 'サーバー(OP権限)', 'the server (op)'], ['player', 'プレイヤー', 'the player']])) }, { cmd: '"time set day"', as: 'server' },
  (b, c) => ({ op: 'mc.command', as: b.args.as === 'player' ? 'player' : 'server', cmd: c.expr(b.args.cmd) }), (b) => b.args.as === 'player');
mcStmt('mc_give_item', '🎁', 'アイテムを与える', 'Give item', [J('アイテム', 'Give'), E('item'), J('を', ''), E('count'), J('個 プレイヤーに与える', 'to the player')],
  { item: ITEM, count: X('1') }, { item: 'minecraft:diamond', count: '1' },
  (b, c) => { if (!String(b.args.item).trim()) c.problem('アイテムIDが空です', b.id); return { op: 'mc.give_item', item: String(b.args.item).trim(), count: c.expr(b.args.count) }; });
mcStmt('mc_remove_item', '🗑', 'アイテムを取り上げる', 'Remove item', [J('アイテム', 'Remove'), E('item'), J('を', ''), E('count'), J('個 プレイヤーから取り上げる', 'from the player')],
  { item: ITEM, count: X('1') }, { item: 'minecraft:diamond', count: '1' },
  (b, c) => { if (!String(b.args.item).trim()) c.problem('アイテムIDが空です', b.id); return { op: 'mc.remove_item', item: String(b.args.item).trim(), count: c.expr(b.args.count) }; });
mcStmt('mc_set_block', '🧱', 'ブロックを置く', 'Set block', [J('位置', 'At'), E('mode'), J('の x', 'x'), E('x'), J('y', 'y'), E('y'), J('z', 'z'), E('z'), J('に', 'place'), E('block'), J('を置く', '')],
  { mode: sel(opts([['relative', 'プレイヤーからの相対', 'relative to the player'], ['absolute', 'ワールド座標', 'world coordinates'], ['event', 'イベントのブロック位置からの相対', 'relative to the event block']])), x: X('0'), y: X('0'), z: X('0'), block: BLOCK },
  { mode: 'relative', x: '0', y: '1', z: '0', block: 'minecraft:glass' },
  (b, c) => {
    if (!String(b.args.block).trim()) c.problem('ブロックIDが空です', b.id);
    if (b.args.mode === 'event') needs(c, 'block', b.id);
    return { op: 'mc.set_block', mode: b.args.mode, x: c.expr(b.args.x), y: c.expr(b.args.y), z: c.expr(b.args.z), block: String(b.args.block).trim() };
  });
mcStmt('mc_teleport', '🌀', 'テレポート', 'Teleport', [J('プレイヤーを', 'Teleport the player'), E('mode'), J('の x', 'x'), E('x'), J('y', 'y'), E('y'), J('z', 'z'), E('z'), J('へテレポート', '')],
  { mode: POSMODE, x: X('0'), y: X('0'), z: X('0') }, { mode: 'relative', x: '0', y: '10', z: '0' },
  (b, c) => ({ op: 'mc.teleport', mode: b.args.mode, x: c.expr(b.args.x), y: c.expr(b.args.y), z: c.expr(b.args.z) }));
mcStmt('mc_play_sound', '🔊', '音を鳴らす', 'Play sound', [J('サウンド', 'Play'), E('sound'), J('を音量', 'volume'), E('volume'), J('ピッチ', 'pitch'), E('pitch'), J('で鳴らす', '')],
  { sound: SOUND, volume: X('1'), pitch: X('1') }, { sound: 'minecraft:entity.player.levelup', volume: '1', pitch: '1' },
  (b, c) => ({ op: 'mc.play_sound', sound: String(b.args.sound).trim(), volume: c.expr(b.args.volume), pitch: c.expr(b.args.pitch) }));
mcStmt('mc_set_health', '❤', '体力を設定', 'Set health', [J('プレイヤーの体力を', 'Set health to'), E('v'), J('にする(20=ハート10個)', '(20 = 10 hearts)')],
  { v: X('20') }, { v: '20' }, (b, c) => ({ op: 'mc.health', value: c.expr(b.args.v) }));
mcStmt('mc_set_food', '🍖', '満腹度を設定', 'Set food level', [J('プレイヤーの満腹度を', 'Set food level to'), E('v'), J('にする(0〜20)', '(0–20)')],
  { v: X('20') }, { v: '20' }, (b, c) => ({ op: 'mc.food', value: c.expr(b.args.v) }));
mcStmt('mc_add_xp', '✨', '経験値を与える', 'Give experience', [J('プレイヤーに経験値', 'Give'), E('v'), J('ポイントを与える', 'experience points')],
  { v: X('10') }, { v: '10' }, (b, c) => ({ op: 'mc.xp', value: c.expr(b.args.v) }));
mcStmt('mc_effect', '🧪', 'ポーション効果を与える', 'Give status effect', [J('効果', 'Give'), E('effect'), J('を', 'for'), E('secs'), J('秒、強さ', 'seconds, level'), E('amp'), J('(0=Ⅰ)で与える', '(0 = I)')],
  { effect: EFFECT, secs: X('30'), amp: X('0') }, { effect: 'minecraft:speed', secs: '30', amp: '0' },
  (b, c) => ({ op: 'mc.effect', effect: String(b.args.effect).trim(), secs: c.expr(b.args.secs), amp: c.expr(b.args.amp) }));
mcStmt('mc_clear_effects', '🧼', 'ポーション効果を消す', 'Clear effects', [J('プレイヤーのポーション効果をすべて消す', 'Clear all status effects of the player')], {}, {}, () => ({ op: 'mc.clear_effects' }));
mcStmt('mc_game_mode', '🎮', 'ゲームモードを変更', 'Set game mode', [J('プレイヤーのゲームモードを', 'Set game mode to'), E('mode')],
  { mode: sel(opts([['SURVIVAL', 'サバイバル', 'survival'], ['CREATIVE', 'クリエイティブ', 'creative'], ['ADVENTURE', 'アドベンチャー', 'adventure'], ['SPECTATOR', 'スペクテイター', 'spectator']])) }, { mode: 'CREATIVE' },
  (b) => ({ op: 'mc.game_mode', mode: ['SURVIVAL', 'CREATIVE', 'ADVENTURE', 'SPECTATOR'].includes(b.args.mode) ? b.args.mode : 'SURVIVAL' }));
mcStmt('mc_spawn', '👾', 'エンティティを出現', 'Spawn entity', [J('位置', 'At'), E('mode'), J('の x', 'x'), E('x'), J('y', 'y'), E('y'), J('z', 'z'), E('z'), J('に', 'spawn'), E('entity'), J('を出現させる', '')],
  { mode: POSMODE, x: X('0'), y: X('0'), z: X('0'), entity: ENTITY }, { mode: 'relative', x: '2', y: '0', z: '0', entity: 'minecraft:zombie' },
  (b, c) => { if (!String(b.args.entity).trim()) c.problem('エンティティIDが空です', b.id); return { op: 'mc.spawn', mode: b.args.mode, x: c.expr(b.args.x), y: c.expr(b.args.y), z: c.expr(b.args.z), entity: String(b.args.entity).trim() }; },
  (b) => b.args.mode !== 'absolute');
mcStmt('mc_kill', '☠', 'プレイヤーを倒す', 'Kill player', [J('プレイヤーを倒す', 'Kill the player')], {}, {}, () => ({ op: 'mc.kill' }));

// ------------------------------------------------------------------ value blocks
const mcExpr = (fn, type, extra) => ({ k: 'mc', fn, type, ...(extra || {}) });
const AXIS = sel([['x', 'x'], ['y', 'y'], ['z', 'z']]);
const axisOf = (a) => (['x', 'y', 'z'].includes(a) ? a : 'x');
mcVal('r_mc_player_name', '🧑', 'プレイヤー名', 'Player name', [J('プレイヤー名', 'player name')], {}, {}, () => mcExpr('playerName', 'str'), false, 'player');
mcVal('r_mc_player_pos', '📍', 'プレイヤーの座標', 'Player position', [J('プレイヤーの', 'player'), E('axis'), J('座標', 'coordinate')],
  { axis: AXIS }, { axis: 'x' }, (b) => mcExpr('player_' + axisOf(b.args.axis), 'num'), false, 'player');
mcVal('r_mc_health', '❤', 'プレイヤーの体力', 'Player health', [J('プレイヤーの体力', 'player health')], {}, {}, () => mcExpr('health', 'num'), false, 'player');
mcVal('r_mc_food', '🍖', 'プレイヤーの満腹度', 'Player food level', [J('プレイヤーの満腹度', 'player food level')], {}, {}, () => mcExpr('food', 'num'), false, 'player');
mcVal('r_mc_xp_level', '✨', 'プレイヤーの経験値レベル', 'Player XP level', [J('プレイヤーの経験値レベル', 'player XP level')], {}, {}, () => mcExpr('xpLevel', 'num'), false, 'player');
mcVal('r_mc_dimension', '🌍', 'いるディメンション', 'Current dimension', [J('プレイヤーがいるディメンションのID', 'id of the dimension the player is in')], {}, {}, () => mcExpr('dimension', 'str'), false, 'player');
mcVal('r_mc_held_item', '✋', '手に持っているアイテム', 'Held item', [J('手に持っているアイテムのID', 'held item id')], {}, {}, () => mcExpr('heldItem', 'str'), false, 'player');
mcVal('r_mc_held_count', '✋', '手に持っている個数', 'Held item count', [J('手に持っているアイテムの個数', 'held item count')], {}, {}, () => mcExpr('heldCount', 'num'), false, 'player');
mcVal('r_mc_time', '☀', 'ワールドの時刻', 'World time', [J('ワールドの時刻(ティック)', 'world time (ticks)')], {}, {}, () => mcExpr('worldTime', 'num'), false, 'player');
mcVal('r_mc_players', '👥', 'オンライン人数', 'Players online', [J('オンラインのプレイヤー数', 'number of players online')], {}, {}, () => mcExpr('playersOnline', 'num'));
mcVal('r_mc_block_id', '🧱', 'イベントのブロックID', 'Event block id', [J('イベントのブロックID', 'event block id')], {}, {}, () => mcExpr('blockId', 'str'), false, 'block');
mcVal('r_mc_block_pos', '📍', 'イベントのブロック座標', 'Event block position', [J('イベントのブロックの', 'event block'), E('axis'), J('座標', 'coordinate')],
  { axis: AXIS }, { axis: 'x' }, (b) => mcExpr('block_' + axisOf(b.args.axis), 'num'), false, 'block');
mcVal('r_mc_block_at', '🔎', '指定位置のブロックID', 'Block id at position', [J('位置', 'block id at'), E('mode'), J('の x', 'x'), E('x'), J('y', 'y'), E('y'), J('z', 'z'), E('z'), J('のブロックID', '')],
  { mode: POSMODE, x: X('0'), y: X('-1'), z: X('0') }, { mode: 'relative', x: '0', y: '-1', z: '0' },
  (b, c) => mcExpr('blockAt', 'str', { mode: b.args.mode, x: c.expr(b.args.x), y: c.expr(b.args.y), z: c.expr(b.args.z) }), false, 'player');
mcVal('r_mc_entity_id', '👾', 'イベントのエンティティID', 'Event entity id', [J('イベントのエンティティのID', 'event entity id')], {}, {}, () => mcExpr('entityId', 'str'), false, 'entity');
mcVal('b_mc_has_item', '🎒', 'アイテムを持っているか', 'Has item', [J('インベントリに', 'inventory has'), E('item'), J('を', ''), E('count'), J('個以上持っている', 'or more')],
  { item: ITEM, count: X('1') }, { item: 'minecraft:diamond', count: '1' },
  (b, c) => mcExpr('hasItem', 'bool', { item: String(b.args.item).trim(), count: c.expr(b.args.count) }), true, 'player');
mcVal('b_mc_sneaking', '🥷', 'スニーク中か', 'Is sneaking', [J('プレイヤーがスニーク中', 'player is sneaking')], {}, {}, () => mcExpr('sneaking', 'bool'), true, 'player');

// ------------------------------------------------------------------ Common blocks enabled for Minecraft
const common = (type, patch) => {
  const d = blocks.get(type);
  d.targets = ['web', 'minecraft'];
  Object.assign(d, patch);
};
const parseParams = (src) => String(src || '').split(',').map((x) => x.trim()).filter((x) => /^[\p{L}_$][\p{L}\p{N}_$]*$/u.test(x));
const splitArgs = (src) => {
  const items = []; let depth = 0, cur = '', quote = '';
  for (const ch of String(src ?? '')) {
    if (quote) { cur += ch; if (ch === quote) quote = ''; continue; }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if ('(['.includes(ch)) depth++;
    if (')]'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { items.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim() !== '') items.push(cur);
  return items;
};
const num = (e) => ({ k: 'call', fn: 'num', args: [e], type: 'num' });

common('set_var', { ir: (b, c) => { const v = c.varRef(b.args.name, b.id); if (!v) return null; if (v.scope === 'local') { c.problem('関数の引数には代入できません', b.id); return null; } return { op: 'set', var: v, value: c.expr(b.args.value) }; } });
common('change_var', { ir: (b, c) => { const v = c.varRef(b.args.name, b.id); if (!v) return null; if (v.scope === 'local') { c.problem('関数の引数には代入できません', b.id); return null; } return { op: 'set', var: v, value: { k: 'bin', op: '+', a: num(v), b: num(c.expr(b.args.by)) } }; } });
common('if', { ir: (b, c) => ({ op: 'if', cond: c.cond(b.args.cond), then: c.nested(() => c.stack(b.slots.then)), else: c.nested(() => c.stack(b.slots.else)) }) });
common('repeat', { ir: (b, c) => ({ op: 'repeat', count: c.expr(b.args.times), body: c.nested(() => c.stack(b.slots.body)) }) });
common('wait', { ir: (b, c) => { if (c.state.depth > 0) { c.problem('「待つ」は処理の一番外側(ループ・条件分岐の中ではなく)でのみ使えます', b.id); return null; } return { op: 'wait', ms: c.expr(b.args.ms) }; } });
common('call_fn', { ir: (b, c) => {
  if (!b.args.name) { c.problem('関数が未選択です', b.id); return null; }
  if (b.args.to) c.problem('関数の戻り値は Minecraft ではまだ使えません', b.id);
  return { op: 'call', fn: b.args.name, args: splitArgs(b.args.args).map((a) => c.expr(a)), block: b.id };
} });
common('onFunction', { irHat: (b, c) => {
  if (!b.args.name) return null;
  const params = parseParams(b.args.params);
  params.forEach((p) => c.state.scope.set(p, 'any'));
  c.state.event = 'function';
  return { kind: 'function', fnName: b.args.name, params };
} });
common('note', { ir: (b) => ({ op: 'comment', text: String(b.args.text || '') }) });
common('sys_log', { ir: (b, c) => ({ op: 'log', value: c.expr(b.args.value) }) });
common('math_calc', { irExpr: (b, c) => {
  const a = num(c.expr(b.args.a)), z = num(c.expr(b.args.b));
  return b.args.op === '^' ? { k: 'call', fn: 'pow', args: [a, z], type: 'num' } : { k: 'bin', op: ['+', '-', '*', '/', '%'].includes(b.args.op) ? b.args.op : '+', a, b: z };
} });
common('text_join', { irExpr: (b, c) => ({ k: 'call', fn: 'concat', type: 'str', args: [c.expr(b.args.a), c.expr(b.args.b), ...(String(b.args.c).trim() || (b.args.c && typeof b.args.c === 'object') ? [c.expr(b.args.c)] : [])] }) });
common('math_random', { irExpr: (b, c) => ({ k: 'call', fn: 'random', type: 'num', args: [num(c.expr(b.args.min)), num(c.expr(b.args.max))] }) });
common('r_var', { irExpr: (b, c) => c.varRef(b.args.name) || { k: 'str', v: '' } });
common('b_cmp', { irExpr: (b, c) => c.cond({ rows: [{ l: b.args.a, op: b.args.op, r: b.args.b }], join: 'and', not: false }) });
common('b_and', { irExpr: (b, c) => ({ k: 'bin', op: '&&', a: c.expr(b.args.a), b: c.expr(b.args.b) }) });
common('b_or', { irExpr: (b, c) => ({ k: 'bin', op: '||', a: c.expr(b.args.a), b: c.expr(b.args.b) }) });
common('b_not', { irExpr: (b, c) => ({ k: 'un', op: '!', a: c.expr(b.args.a) }) });
common('r_if', { irExpr: (b, c) => ({ k: 'call', fn: 'ternary', type: 'any', args: [c.cond(b.args.cond), c.expr(b.args.a), c.expr(b.args.b)] }) });

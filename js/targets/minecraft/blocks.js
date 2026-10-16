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

/** events that expose a block (blockPos / blockState) to the handler body */
export const EVENT_HAS_BLOCK = new Set(['right_click_block', 'block_break', 'block_place']);

const mcStmt = (type, icon, ja, en, parts, fields, defaults, ir) => {
  stmt(type, 'Minecraft', icon, ja, parts, fields, defaults, () => [], undefined);
  Object.assign(blocks.get(type), { targets: MC, en, ir });
};
const mcHat = (type, ja, en, parts, fields, defaults, event) => {
  hat(type, ja, parts, fields, defaults, () => []);
  Object.assign(blocks.get(type), { targets: MC, en, irHat: (b, c) => { c.state.event = event; return { kind: 'event', event }; } });
};
const mcVal = (type, icon, ja, en, parts, fields, defaults, irExpr, bool = false) => {
  R(type, 'Minecraft', icon, ja, en, parts, fields, defaults, () => '""', { bool });
  Object.assign(blocks.get(type), { targets: MC, irExpr });
};

// ------------------------------------------------------------------ events
mcHat('mc_on_join', 'プレイヤーが参加したとき', 'When a player joins', [J('プレイヤーがワールドに参加したとき', 'When a player joins the world')], {}, {}, 'player_join');
mcHat('mc_on_right_click', 'ブロックを右クリックしたとき', 'When a player right-clicks a block', [J('プレイヤーがブロックを右クリックしたとき', 'When a player right-clicks a block')], {}, {}, 'right_click_block');
mcHat('mc_on_block_break', 'ブロックを壊したとき', 'When a player breaks a block', [J('プレイヤーがブロックを壊したとき', 'When a player breaks a block')], {}, {}, 'block_break');
mcHat('mc_on_block_place', 'ブロックを置いたとき', 'When a player places a block', [J('プレイヤーがブロックを置いたとき(右クリック時)', 'When a player places a block (on right-click)')], {}, {}, 'block_place');
mcHat('mc_on_item_use', 'アイテムを使ったとき', 'When a player uses an item', [J('プレイヤーがアイテムを使ったとき(右クリック)', 'When a player uses an item (right-click)')], {}, {}, 'item_use');

// ------------------------------------------------------------------ actions
const ITEM = { t: 'text', ph: 'minecraft:diamond', list: 'dl-mc-items' };
const BLOCK = { t: 'text', ph: 'minecraft:stone', list: 'dl-mc-blocks' };
const SOUND = { t: 'text', ph: 'minecraft:entity.player.levelup', list: 'dl-mc-sounds' };
const POSMODE = sel(opts([['relative', 'プレイヤーからの相対', 'relative to the player'], ['absolute', 'ワールド座標', 'world coordinates']]));

mcStmt('mc_send_message', '💬', 'メッセージを送る', 'Send message', [J('メッセージ', 'Send'), E('text'), J('を', 'to'), E('to'), J('に送る', '')],
  { text: X('"Hello Minecraft!"'), to: sel(opts([['player', 'プレイヤー', 'the player'], ['all', '全員', 'everyone']])) }, { text: '"Hello Minecraft!"', to: 'player' },
  (b, c) => ({ op: 'mc.send_message', to: b.args.to === 'all' ? 'all' : 'player', text: c.expr(b.args.text) }));
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
    if (b.args.mode === 'event' && !EVENT_HAS_BLOCK.has(c.state.event)) c.problem('「イベントのブロック位置」は ブロックのイベント(右クリック/壊す/置く)でのみ使えます', b.id);
    return { op: 'mc.set_block', mode: b.args.mode, x: c.expr(b.args.x), y: c.expr(b.args.y), z: c.expr(b.args.z), block: String(b.args.block).trim() };
  });
mcStmt('mc_teleport', '🌀', 'テレポート', 'Teleport', [J('プレイヤーを', 'Teleport the player'), E('mode'), J('の x', 'x'), E('x'), J('y', 'y'), E('y'), J('z', 'z'), E('z'), J('へテレポート', '')],
  { mode: POSMODE, x: X('0'), y: X('0'), z: X('0') }, { mode: 'relative', x: '0', y: '10', z: '0' },
  (b, c) => ({ op: 'mc.teleport', mode: b.args.mode, x: c.expr(b.args.x), y: c.expr(b.args.y), z: c.expr(b.args.z) }));
mcStmt('mc_play_sound', '🔊', '音を鳴らす', 'Play sound', [J('サウンド', 'Play'), E('sound'), J('を音量', 'volume'), E('volume'), J('ピッチ', 'pitch'), E('pitch'), J('で鳴らす', '')],
  { sound: SOUND, volume: X('1'), pitch: X('1') }, { sound: 'minecraft:entity.player.levelup', volume: '1', pitch: '1' },
  (b, c) => ({ op: 'mc.play_sound', sound: String(b.args.sound).trim(), volume: c.expr(b.args.volume), pitch: c.expr(b.args.pitch) }));

// ------------------------------------------------------------------ value blocks
const mcExpr = (fn, type, extra) => ({ k: 'mc', fn, type, ...(extra || {}) });
mcVal('r_mc_player_name', '🧑', 'プレイヤー名', 'Player name', [J('プレイヤー名', 'player name')], {}, {}, () => mcExpr('playerName', 'str'));
mcVal('r_mc_player_pos', '📍', 'プレイヤーの座標', 'Player position', [J('プレイヤーの', 'player'), E('axis'), J('座標', 'coordinate')],
  { axis: sel([['x', 'x'], ['y', 'y'], ['z', 'z']]) }, { axis: 'x' }, (b) => mcExpr('player_' + (['x', 'y', 'z'].includes(b.args.axis) ? b.args.axis : 'x'), 'num'));
mcVal('r_mc_held_item', '✋', '手に持っているアイテム', 'Held item', [J('手に持っているアイテムのID', 'held item id')], {}, {}, () => mcExpr('heldItem', 'str'));
mcVal('r_mc_block_id', '🧱', 'イベントのブロックID', 'Event block id', [J('イベントのブロックID', 'event block id')], {}, {},
  (b, c) => { if (!EVENT_HAS_BLOCK.has(c.state.event)) { c.problem('ブロックIDは ブロックのイベント(右クリック/壊す/置く)でのみ使えます'); return { k: 'str', v: '' }; } return mcExpr('blockId', 'str'); });
mcVal('r_mc_block_pos', '📍', 'イベントのブロック座標', 'Event block position', [J('イベントのブロックの', 'event block'), E('axis'), J('座標', 'coordinate')],
  { axis: sel([['x', 'x'], ['y', 'y'], ['z', 'z']]) }, { axis: 'x' },
  (b, c) => { if (!EVENT_HAS_BLOCK.has(c.state.event)) { c.problem('ブロック座標は ブロックのイベントでのみ使えます'); return { k: 'num', v: 0 }; } return mcExpr('block_' + (['x', 'y', 'z'].includes(b.args.axis) ? b.args.axis : 'x'), 'num'); });
mcVal('b_mc_has_item', '🎒', 'アイテムを持っているか', 'Has item', [J('インベントリに', 'inventory has'), E('item'), J('を', ''), E('count'), J('個以上持っている', 'or more')],
  { item: ITEM, count: X('1') }, { item: 'minecraft:diamond', count: '1' },
  (b, c) => mcExpr('hasItem', 'bool', { item: String(b.args.item).trim(), count: c.expr(b.args.count) }), true);
mcVal('b_mc_sneaking', '🥷', 'スニーク中か', 'Is sneaking', [J('プレイヤーがスニーク中', 'player is sneaking')], {}, {}, () => mcExpr('sneaking', 'bool'), true);

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

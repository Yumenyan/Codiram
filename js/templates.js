// Project templates. New ones can be appended here (or registered by plugins later).
import { emptyProject, createNode, newScript, newBlock, newModel } from './model.js';

const add = (p, parent, type, props = {}, style = {}) => {
  const n = createNode(p, type);
  Object.assign(n.props, props);
  Object.assign(n.style, style);
  parent.children.push(n);
  return n;
};

const blk = (type, args, slots) => { const b = newBlock(type, args); if (slots) Object.assign(b.slots, slots); return b; };
const cond = (l, op, r) => ({ rows: [{ l, op, r }], join: 'and', not: false });
const rep = (type, args) => ({ $b: { id: 'r' + Math.random().toString(36).slice(2, 8), type, args } });
const sprite = (p, parent, name, emoji, w, left, top, extra = {}) => {
  const n = add(p, parent, 'sprite', { emoji, ...extra }, { width: String(w), height: String(w), left: String(left), top: String(top) });
  n.name = name;
  return n;
};

export const TEMPLATES = [
  {
    id: 'blank', name: 'Blank App', desc: '空のプロジェクト',
    build: () => emptyProject('Untitled Project'),
  },
  {
    id: 'counter', name: 'Counter', desc: 'ボタンで count を増やして表示 (最初の成功条件)',
    build() {
      const p = emptyProject('Counter');
      p.variables.push({ name: 'count', type: 'Number', initial: '0' });
      const root = p.pages[0].root;
      add(p, root, 'text', { text: 'カウンター' }, { fontSize: '24', bold: true });
      add(p, root, 'text', { text: '{count}' }, { fontSize: '48' });
      const btn = add(p, root, 'button', { text: '＋1' }, { width: '120' });
      const s = newScript(p, 'main', 'onClick', { target: btn.id });
      s.body.push(newBlock('change_var', { name: 'count', by: '1' }));
      p.scripts.push(s);
      return p;
    },
  },
  {
    id: 'memo', name: 'Memo (Input → List)', desc: '入力 → 保存 → テーブル表示のデータアプリ',
    build() {
      const p = emptyProject('Memo');
      const m = newModel(p, 'Memo');
      m.fields = [{ name: 'id', type: 'Number' }, { name: 'text', type: 'String' }];
      m.rows = [{ _id: 1, id: 1, text: '牛乳を買う' }, { _id: 2, id: 2, text: 'Codiramを試す' }];
      p.models.push(m);
      p.variables.push({ name: 'newText', type: 'String', initial: '' });
      const root = p.pages[0].root;
      add(p, root, 'text', { text: 'メモ帳' }, { fontSize: '24', bold: true });
      const row = add(p, root, 'row');
      add(p, row, 'input', { placeholder: 'メモを入力', bind: 'newText' }, { width: '260' });
      const btn = add(p, row, 'button', { text: '保存' });
      add(p, root, 'table', { source: 'Memo', cols: 'text', deleteBtn: true });
      const s = newScript(p, 'main', 'onClick', { target: btn.id });
      s.body.push(
        newBlock('add_row', { model: 'Memo', values: { text: 'newText' } }),
        newBlock('set_var', { name: 'newText', value: '""' }),
      );
      p.scripts.push(s);
      return p;
    },
  },
  {
    id: 'catch', name: 'Game: Star Catcher', desc: '矢印キーでカゴを動かして星をキャッチ(スプライト・クローン・衝突・効果音)',
    build() {
      const p = emptyProject('Star Catcher');
      p.variables.push({ name: 'score', type: 'Number', initial: '0' }, { name: 'lives', type: 'Number', initial: '3' });
      const root = p.pages[0].root;
      add(p, root, 'text', { text: '⭐ スターキャッチ  ←→キーで動かす' }, { fontSize: '22', bold: true });
      add(p, root, 'text', { text: 'スコア: {score}    ライフ: {lives}' }, { fontSize: '18' });
      const stage = add(p, root, 'stage', {}, { width: '640', height: '400', background: '#0f172a' });
      const player = sprite(p, stage, 'Player', '🧺', 64, 288, 330);
      const star = sprite(p, stage, 'Star', '⭐', 40, 20, -60, { hiddenInitially: true });
      star.props.hiddenInitially = true;
      const over = add(p, stage, 'text', { text: 'GAME OVER' }, { color: '#fecaca', fontSize: '48', bold: true, left: '170', top: '150' });
      over.name = 'GameOver'; over.props.hiddenInitially = true;
      const again = add(p, root, 'button', { text: 'もう一度あそぶ' });
      again.name = 'Restart';

      // start: reset + spawn stars every 0.9s
      const load = newScript(p, 'main', 'onLoad', { page: 'main' });
      load.name = 'ゲーム開始';
      load.body.push(
        blk('set_var', { name: 'score', value: '0' }), blk('set_var', { name: 'lives', value: '3' }),
        blk('timer_start', { name: 'spawn', ms: '900' }, { body: [
          blk('spr_clone', { t: star.id, x: rep('math_random', { min: '30', max: '610' }), y: '-20' }, { body: [
            blk('spr_vel', { t: '@it', vx: '0', vy: rep('math_random', { min: '120', max: '260' }) }),
          ] }),
        ] }));
      // game loop
      const loop = newScript(p, 'main', 'onFrame', {});
      loop.name = 'ゲームループ';
      loop.body.push(
        blk('if', { cond: { rows: [{ l: rep('g_key', { k: 'ArrowLeft' }), op: 'true', r: '' }], join: 'and', not: false } }, { then: [blk('spr_move', { t: player.id, dx: '-420 * dt', dy: '0' })], else: [] }),
        blk('if', { cond: { rows: [{ l: rep('g_key', { k: 'ArrowRight' }), op: 'true', r: '' }], join: 'and', not: false } }, { then: [blk('spr_move', { t: player.id, dx: '420 * dt', dy: '0' })], else: [] }),
        blk('spr_edge', { t: player.id, mode: 'clamp' }),
        blk('spr_foreach_clone', { t: star.id }, { body: [
          blk('if', { cond: cond(rep('g_touch', { a: '@it', b: player.id }), 'true', '') }, { then: [
            blk('change_var', { name: 'score', by: '1' }),
            blk('sound_sfx', { name: 'coin', vol: '0.3' }),
            blk('game_burst', { x: rep('g_x', { t: '@it' }), y: rep('g_y', { t: '@it' }), t: '"✨"', n: '8' }),
            blk('spr_delete', { t: '@it' }),
          ], else: [] }),
          blk('if', { cond: cond(rep('g_y', { t: '@it' }), '>', '420') }, { then: [
            blk('change_var', { name: 'lives', by: '-1' }),
            blk('sound_sfx', { name: 'hit', vol: '0.3' }),
            blk('spr_delete', { t: '@it' }),
          ], else: [] }),
        ] }),
        blk('if', { cond: cond('lives', '<=', '0') }, { then: [
          blk('show', { target: over.id }), blk('game_pause', { v: '1' }), blk('timer_stop', { name: 'spawn' }), blk('sound_sfx', { name: 'gameover', vol: '0.3' }),
        ], else: [] }));
      const rs = newScript(p, 'main', 'onClick', { target: again.id });
      rs.name = 'リスタート';
      rs.body.push(blk('sys_reload', {}));
      p.scripts.push(load, loop, rs);
      return p;
    },
  },
  {
    id: 'pong', name: 'Game: Bounce', desc: 'マウスでパドルを動かしてボールを打ち返す(物理・衝突イベント・サウンド)',
    build() {
      const p = emptyProject('Bounce');
      p.variables.push({ name: 'score', type: 'Number', initial: '0' }, { name: 'lives', type: 'Number', initial: '3' });
      const root = p.pages[0].root;
      add(p, root, 'text', { text: '🏓 バウンス  マウスでパドルを動かす' }, { fontSize: '22', bold: true });
      add(p, root, 'text', { text: 'スコア: {score}    ライフ: {lives}' }, { fontSize: '18' });
      const stage = add(p, root, 'stage', {}, { width: '640', height: '420', background: '#111827' });
      const paddle = add(p, stage, 'sprite', { kind: 'shape' }, { width: '110', height: '16', left: '265', top: '385', background: '#38bdf8', radius: '8' });
      paddle.name = 'Paddle';
      const ball = sprite(p, stage, 'Ball', '⚽', 28, 306, 200);
      const load = newScript(p, 'main', 'onLoad', { page: 'main' });
      load.name = 'ゲーム開始';
      load.body.push(blk('set_var', { name: 'score', value: '0' }), blk('set_var', { name: 'lives', value: '3' }),
        blk('spr_goto', { t: ball.id, x: '320', y: '200' }), blk('spr_vel', { t: ball.id, vx: '200', vy: '240' }));
      const loop = newScript(p, 'main', 'onFrame', {});
      loop.name = 'ゲームループ';
      loop.body.push(
        blk('spr_goto', { t: paddle.id, x: rep('g_mouse_x', {}), y: '393' }),
        blk('spr_edge', { t: paddle.id, mode: 'clamp' }),
        blk('if', { cond: cond(rep('g_y', { t: ball.id }), '>', '415') }, { then: [
          blk('change_var', { name: 'lives', by: '-1' }), blk('sound_sfx', { name: 'hit', vol: '0.3' }),
          blk('spr_goto', { t: ball.id, x: '320', y: '150' }), blk('spr_vel', { t: ball.id, vx: '200', vy: '240' }),
        ], else: [] }),
        blk('spr_edge', { t: ball.id, mode: 'bounce' }),
        blk('if', { cond: cond('lives', '<=', '0') }, { then: [blk('game_pause', { v: '1' }), blk('sound_sfx', { name: 'gameover', vol: '0.3' }), blk('alert', { value: '"GAME OVER  スコア: " + score' }), blk('sys_reload', {})], else: [] }));
      const hit = newScript(p, 'main', 'onCollide', { a: ball.id, b: paddle.id });
      hit.name = 'パドルに当たった';
      hit.body.push(blk('spr_vel', { t: ball.id, vx: rep('g_vx', { t: ball.id }), vy: '-260 - score * 10' }),
        blk('spr_goto', { t: ball.id, x: rep('g_x', { t: ball.id }), y: '368' }),
        blk('change_var', { name: 'score', by: '1' }), blk('sound_sfx', { name: 'click', vol: '0.4' }));
      p.scripts.push(load, loop, hit);
      return p;
    },
  },
];

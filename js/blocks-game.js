// Game, Sound and Draw blocks (sprites, input, collisions, clones, synth sound effects, canvas drawing).
import { stmt, hat, E, q, ind } from './blocks.js';
import { blocks } from './registry.js';
import { J } from './i18n-helpers.js';
import { R } from './blocks-reporters.js';

const X = (ph) => ({ t: 'expr', ph });
const S = { t: 'comp', sprite: true };
const to = { t: 'var' };
const opts = (arr) => arr.map(([v, ja, en]) => [v, J(ja, en)]);
const sel = (o) => ({ t: 'select', opts: o });
const B = (type, cat, icon, ja, en, parts, fields, defaults, gen, slots) => {
  stmt(type, cat, icon, ja, parts, fields, defaults, gen, slots);
  const d = blocks.get(type);
  d.en = en;
  d.reporter = !!(fields.to && !fields.to.opt && !slots);
  return d;
};
const H = (type, ja, en, parts, fields, defaults, gen, extra = {}) => { hat(type, ja, parts, fields, defaults, gen); Object.assign(blocks.get(type), { en }, extra); };
const G = (g) => g.use('game');
const A = (g) => g.use('audio');
const num = (g, x) => `Number(${g.expr(x)})`;

// ======================================================== hats
H('onFrame', '毎フレーム(ゲームループ)', 'Every frame (game loop)', [J('毎フレーム(1秒に約60回)実行', 'Every frame (about 60 times a second)')], {}, {},
  (b, g, body) => { G(g); return ['onFrame(async () => {', ...ind(body), '});']; });
H('onCollide', 'スプライトが衝突したとき', 'When sprites collide', [J('スプライト', 'When sprite'), E('a'), J('が', 'touches'), E('b'), J('に触れたとき(クローンも含む)', '(clones included)')],
  { a: { t: 'comp' }, b: { t: 'comp' } }, { a: '', b: '' },
  (b, g, body) => { G(g); return [`onCollide(${g.comp(b.args.a)}, ${g.comp(b.args.b)}, async (_a, _b) => {`, ...ind(body), '});']; },
  { bodyScope: { it: '_b', me: '_a' } });
H('onKeyUp', 'キーが離されたとき', 'When a key is released', [J('キー', 'Key'), E('key'), J('が離されたとき', 'is released')],
  { key: { t: 'text', ph: 'Space / a / ArrowUp' } }, { key: 'Space' },
  (b, g, body) => [`onKey(${q(b.args.key)}, async () => {`, ...ind(body), '}, true);']);
H('onPress', '押された瞬間(タッチ/マウス)', 'When pressed', [E('target'), J('が押されたとき(ボタンを押している間の操作に)', 'is pressed (touch / mouse down)')],
  { target: { t: 'comp' } }, { target: '' },
  (b, g, body) => [`on(${g.comp(b.args.target)}, "pointerdown", async () => {`, ...ind(body), '});']);
H('onRelease', '離された瞬間(タッチ/マウス)', 'When released', [E('target'), J('が離されたとき', 'is released')],
  { target: { t: 'comp' } }, { target: '' },
  (b, g, body) => [`on(${g.comp(b.args.target)}, "pointerup", async () => {`, ...ind(body), '});']);

// ======================================================== sprite commands
const gm = (type, icon, ja, en, parts, fields, defaults, gen) => B(type, 'Game', icon, ja, en, parts, fields, defaults, (b, g) => { G(g); return gen(b, g); });
gm('spr_goto', '⌖', '位置を指定', 'Go to x, y', [S_('t'), J('を x', ': go to x'), E('x'), J('y', 'y'), E('y'), J('へ移動 (中心座標)', '(centre)')],
  { t: S, x: X('320'), y: X('200') }, { t: '', x: '0', y: '0' }, (b, g) => [`setPos(${g.comp(b.args.t)}, ${num(g, b.args.x)}, ${num(g, b.args.y)});`]);
gm('spr_move', '↔', '動かす', 'Move by', [S_('t'), J('を x方向に', ': move by x'), E('dx'), J('、y方向に', ', y'), E('dy'), J('動かす', '')],
  { t: S, dx: X('5'), dy: X('0') }, { t: '', dx: '5', dy: '0' }, (b, g) => [`moveBy(${g.comp(b.args.t)}, ${num(g, b.args.dx)}, ${num(g, b.args.dy)});`]);
gm('spr_vel', '➤', '速度を設定', 'Set velocity', [S_('t'), J('の速度を x', ': velocity x'), E('vx'), J('y', 'y'), E('vy'), J('(px/秒)にする', '(px/s)')],
  { t: S, vx: X('120'), vy: X('0') }, { t: '', vx: '0', vy: '0' }, (b, g) => [`setVel(${g.comp(b.args.t)}, ${num(g, b.args.vx)}, ${num(g, b.args.vy)});`]);
gm('spr_gravity', '⬇', '重力を設定', 'Set gravity', [S_('t'), J('の重力加速度を', ': gravity'), E('gy'), J('(px/秒²)にする', '(px/s²)')],
  { t: S, gy: X('900') }, { t: '', gy: '900' }, (b, g) => [`setGravity(${g.comp(b.args.t)}, ${num(g, b.args.gy)});`]);
gm('spr_dir', '⟳', '向きを設定', 'Set direction', [S_('t'), J('の動く向きを', ': direction'), E('v'), J('度に', 'degrees'), E('op')],
  { t: S, v: X('0'), op: sel(opts([['set', 'する(0=右, 90=下)', 'set (0 = right, 90 = down)'], ['turn', '回転させる', 'turn by']])) }, { t: '', v: '0', op: 'set' },
  (b, g) => [`setDir(${g.comp(b.args.t)}, ${q(b.args.op)}, ${num(g, b.args.v)});`]);
gm('spr_forward', '⇥', '向きに進む', 'Move forward', [S_('t'), J('を向いている方向へ', ': move'), E('n'), J('px進める', 'px forward')],
  { t: S, n: X('5') }, { t: '', n: '5' }, (b, g) => [`moveForward(${g.comp(b.args.t)}, ${num(g, b.args.n)});`]);
gm('spr_toward', '◎', '向きを合わせる', 'Point toward', [S_('t'), J('の向きを', ': point toward'), E('what'), J('に向ける', ''), E('o')],
  { t: S, what: sel(opts([['sprite', '別のスプライト', 'another sprite'], ['mouse', 'マウス', 'the mouse']])), o: S }, { t: '', what: 'mouse', o: '' },
  (b, g) => [b.args.what === 'sprite' ? `pointToSprite(${g.comp(b.args.t)}, ${g.comp(b.args.o)});` : `pointToward(${g.comp(b.args.t)}, mouseX(), mouseY());`]);
gm('spr_look', '🎭', '見た目を設定', 'Set look', [S_('t'), J('の', ':'), E('prop'), J('を', 'to'), E('v'), J('にする', '')],
  { t: S, prop: sel(opts([['rotate', '見た目の回転(度)', 'rotation (deg)'], ['scale', '拡大率', 'scale'], ['flipx', '左右反転(1/0)', 'flip horizontally (1/0)'], ['opacity', '不透明度(0〜1)', 'opacity (0–1)'], ['visible', '表示(1/0)', 'visible (1/0)']])), v: X('1') },
  { t: '', prop: 'rotate', v: '0' }, (b, g) => [`setLook(${g.comp(b.args.t)}, ${q(b.args.prop)}, ${g.expr(b.args.v)});`]);
gm('spr_edge', '▣', '画面の端の処理', 'Edge behavior', [S_('t'), J('が端に来たら', ': at the edge'), E('mode')],
  { t: S, mode: sel(opts([['bounce', '跳ね返る(速度を反転)', 'bounce'], ['wrap', '反対側から出る', 'wrap around'], ['clamp', '外に出ないようにする', 'stay inside'], ['stop', '止まる(速度0)', 'stop']])) }, { t: '', mode: 'bounce' },
  (b, g) => [`edge(${g.comp(b.args.t)}, ${q(b.args.mode)});`]);
B('spr_clone', 'Game', '⧉', 'クローンを作る', 'Create clone', [J('スプライト', 'Clone sprite'), E('t'), J('のクローンを x', 'at x'), E('x'), J('y', 'y'), E('y'), J('に作る(中の処理では「現在のクローン」でそのクローンを操作)', '(inside, "current clone" is the new clone)')],
  { t: S, x: X(''), y: X('') }, { t: '', x: '', y: '' },
  (b, g) => {
    G(g);
    const v = g.uid('c');
    const arg = (a) => (typeof a === 'object' || String(a).trim() ? g.expr(a) : '""');
    return ['{', `  const ${v} = cloneSprite(${g.comp(b.args.t)}, ${arg(b.args.x)}, ${arg(b.args.y)});`, ...ind(g.withClone(v, () => g.stack(b.slots.body))), '}'];
  },
  [{ key: 'body', label: J('作ったクローンに対して', 'For the new clone') }]);
gm('spr_delete', '🗑', 'スプライトを消す', 'Delete sprite', [S_('t'), J('を消す(クローンは削除、元は非表示)', ': delete (clone removed, original hidden)')],
  { t: S }, { t: '' }, (b, g) => [`deleteSprite(${g.comp(b.args.t)});`]);
gm('spr_delete_clones', '🧹', 'クローンをすべて消す', 'Delete all clones', [J('スプライト', 'Sprite'), E('t'), J('のクローンをすべて消す', ': delete all clones')],
  { t: S }, { t: '' }, (b, g) => [`deleteClones(${g.comp(b.args.t)});`]);
B('spr_foreach_clone', 'Game', '∀', 'クローンごとに処理', 'For each clone', [J('スプライト', 'For each clone of'), E('t'), J('のクローンそれぞれについて', '')],
  { t: S }, { t: '' },
  (b, g) => { G(g); const v = g.uid('c'); return [`for (const ${v} of clonesOf(${g.comp(b.args.t)})) {`, ...ind(g.loop(() => g.withClone(v, () => g.stack(b.slots.body)))), '}']; },
  [{ key: 'body', label: J('各クローンに対して(「現在のクローン」で操作)', 'For each clone (use "current clone")') }]);
gm('game_pause', '⏸', '一時停止/再開', 'Pause / resume', [J('ゲームを', 'Game:'), E('v')],
  { v: sel(opts([['1', '一時停止する', 'pause'], ['0', '再開する', 'resume']])) }, { v: '1' }, (b, g) => [`setPaused(${b.args.v === '1'});`]);
gm('game_burst', '✨', 'パーティクル', 'Particle burst', [J('x', 'At x'), E('x'), J('y', 'y'), E('y'), J('に', ''), E('t'), J('を', ''), E('n'), J('個ばらまく', 'particles')],
  { x: X('320'), y: X('200'), t: X('"✨"'), n: X('10') }, { x: '320', y: '200', t: '"✨"', n: '10' },
  (b, g) => [`burst(${num(g, b.args.x)}, ${num(g, b.args.y)}, ${g.expr(b.args.t)}, ${num(g, b.args.n)});`]);

// ======================================================== sprite / input value blocks
function S_(k) { return E(k); }
const rg = (type, icon, ja, en, parts, fields, defaults, rep, bool) => R(type, 'Game', icon, ja, en, parts, fields, defaults, (b, g) => { G(g); return rep(b, g); }, { bool });
const PROP = (n, ja, en, p) => rg(n, '⌖', ja, en, [S_('t'), J('の' + ja.replace('スプライトの', ''), en)], { t: S }, { t: '' }, (b, g) => `spriteProp(${g.comp(b.args.t)}, ${q(p)})`);
PROP('g_x', 'x座標', 'x position', 'x'); PROP('g_y', 'y座標', 'y position', 'y');
PROP('g_vx', 'x速度', 'x velocity', 'vx'); PROP('g_vy', 'y速度', 'y velocity', 'vy'); PROP('g_dir', '動く向き(度)', 'direction', 'dir');
rg('g_key', '⌨', 'キーが押されているか', 'Key is down', [J('キー', 'key'), E('k'), J('が押されている', 'is down')], { k: { t: 'text', ph: 'ArrowLeft / a / Space' } }, { k: 'ArrowLeft' }, (b) => `keyDown(${q(b.args.k)})`, true);
rg('g_touch', '◈', 'スプライトが触れているか', 'Sprites touching', [S_('a'), J('が', 'touches'), S_('b'), J('に触れている', '')], { a: S, b: S }, { a: '', b: '' }, (b, g) => `touching(${g.comp(b.args.a)}, ${g.comp(b.args.b)})`, true);
rg('g_touch_any', '◈', 'いずれかのクローンに触れているか', 'Touching any clone', [S_('a'), J('が', 'touches any'), S_('b'), J('(クローン含む)のどれかに触れている', '(incl. clones)')], { a: S, b: S }, { a: '', b: '' }, (b, g) => `touchingAny(${g.comp(b.args.a)}, ${g.comp(b.args.b)})`, true);
rg('g_edge', '▣', '端に触れているか', 'Touching edge', [S_('a'), J('が画面の端に触れている', 'touches the edge')], { a: S }, { a: '' }, (b, g) => `touchingEdge(${g.comp(b.args.a)})`, true);
rg('g_dist', '↔', '距離', 'Distance', [J('距離', 'distance'), S_('a'), J('〜', 'to'), S_('b')], { a: S, b: S }, { a: '', b: '' }, (b, g) => `dist(${g.comp(b.args.a)}, ${g.comp(b.args.b)})`);
rg('g_angle', '∠', '相手への角度', 'Angle to', [J('角度', 'angle'), S_('a'), J('→', 'to'), S_('b')], { a: S, b: S }, { a: '', b: '' }, (b, g) => `angleTo(${g.comp(b.args.a)}, ${g.comp(b.args.b)})`);
rg('g_mouse_x', '🖱', 'マウスのx座標(ステージ内)', 'Mouse x', [J('マウスのx', 'mouse x')], {}, {}, () => 'mouseX()');
rg('g_mouse_y', '🖱', 'マウスのy座標(ステージ内)', 'Mouse y', [J('マウスのy', 'mouse y')], {}, {}, () => 'mouseY()');
rg('g_mouse_down', '🖱', 'マウス/タッチ中か', 'Mouse is down', [J('マウス(タッチ)が押されている', 'mouse / touch is down')], {}, {}, () => 'mouse.down', true);
rg('g_stage_w', '▭', 'ステージの幅', 'Stage width', [J('ステージの幅', 'stage width')], {}, {}, () => 'stageBox().width');
rg('g_stage_h', '▭', 'ステージの高さ', 'Stage height', [J('ステージの高さ', 'stage height')], {}, {}, () => 'stageBox().height');
rg('g_dt', '⏱', '前フレームからの秒数', 'Delta time', [J('前フレームからの秒数(dt)', 'seconds since last frame (dt)')], {}, {}, () => 'dt');
rg('g_elapsed', '⏱', '経過秒数', 'Elapsed seconds', [J('ゲーム開始からの経過秒', 'seconds since start')], {}, {}, () => '((performance.now() - startedAt) / 1000)');
rg('g_clone_count', '#', 'クローンの数', 'Clone count', [J('クローンの数', 'number of clones of'), S_('t')], { t: S }, { t: '' }, (b, g) => `clonesOf(${g.comp(b.args.t)}).length`);

// ======================================================== sound
const sn = (type, icon, ja, en, parts, fields, defaults, gen) => B(type, 'Sound', icon, ja, en, parts, fields, defaults, (b, g) => { A(g); return gen(b, g); });
const WAVES = sel(opts([['square', '矩形波(ファミコン風)', 'square (chiptune)'], ['sine', '正弦波(やわらかい)', 'sine (soft)'], ['triangle', '三角波', 'triangle'], ['sawtooth', 'のこぎり波', 'sawtooth']]));
sn('sound_play', '▶', '音声ファイルを再生', 'Play audio file', [J('音声', 'Play'), E('src'), J('を音量', 'at volume'), E('vol'), J('で再生', ''), E('loop')],
  { src: { t: 'asset', kind: 'audio' }, vol: X('1'), loop: sel(opts([['0', '(1回)', '(once)'], ['1', 'ループ', 'loop']])) }, { src: '', vol: '1', loop: '0' },
  (b, g) => [`playSound(${q(b.args.src)}, ${g.expr(b.args.vol)}, ${b.args.loop === '1'});`]);
sn('sound_url', '▶', 'URLの音声を再生', 'Play audio URL', [J('音声URL', 'Play URL'), E('src'), J('を音量', 'at volume'), E('vol'), J('で再生', '')],
  { src: X('"https://..."'), vol: X('1') }, { src: '', vol: '1' }, (b, g) => [`playSound(String(${g.expr(b.args.src)}), ${g.expr(b.args.vol)}, false);`]);
sn('sound_stop', '■', '音声を停止', 'Stop audio', [E('src'), J('を停止', 'Stop')], { src: { t: 'asset', kind: 'audio' } }, { src: '' }, (b, g) => [`stopSound(${q(b.args.src)});`]);
sn('sound_stop_all', '■', 'すべての音声を停止', 'Stop all audio', [J('すべての音声と読み上げを停止', 'Stop all sounds and speech')], {}, {}, () => ['stopSound();', 'stopSpeak();']);
sn('sound_volume', '🔈', '全体の音量', 'Master volume', [J('全体の音量を', 'Master volume'), E('v'), J('にする (0〜1)', '(0–1)')], { v: X('0.5') }, { v: '0.5' }, (b, g) => [`setVolume(${num(g, b.args.v)});`]);
sn('sound_mute', '🔇', 'ミュート', 'Mute', [J('音を', 'Sound:'), E('v')], { v: sel(opts([['1', '消す(ミュート)', 'mute'], ['0', '出す', 'unmute']])) }, { v: '1' }, (b, g) => [`setMuted(${b.args.v === '1'});`]);
sn('sound_beep', '♪', 'ビープ音(周波数)', 'Beep', [J('周波数', 'Beep'), E('f'), J('Hzを', 'Hz for'), E('ms'), J('ms、波形', 'ms, wave'), E('w')],
  { f: X('440'), ms: X('200'), w: WAVES }, { f: '440', ms: '200', w: 'square' }, (b, g) => [`beep(${num(g, b.args.f)}, ${num(g, b.args.ms)}, ${q(b.args.w)});`]);
sn('sound_note', '♫', '音階を鳴らす', 'Play note', [J('音', 'Note'), E('n'), J('を', 'for'), E('ms'), J('ms、波形', 'ms, wave'), E('w')],
  { n: X('"C4"'), ms: X('300'), w: WAVES }, { n: '"C4"', ms: '300', w: 'square' }, (b, g) => [`playNote(${g.expr(b.args.n)}, ${num(g, b.args.ms)}, ${q(b.args.w)});`]);
sn('sound_melody', '🎼', 'メロディを演奏', 'Play melody', [J('メロディ', 'Melody'), E('seq'), J('を テンポ', 'tempo'), E('bpm'), J('で演奏', 'bpm'), E('w'), J('(終わるまで待つ)', '(waits)')],
  { seq: { t: 'text', ph: 'C4 E4 G4:2 - C5:2' }, bpm: X('140'), w: WAVES }, { seq: 'C4 E4 G4 C5:2', bpm: '140', w: 'square' },
  (b, g) => [`await playMelody(${q(b.args.seq)}, ${num(g, b.args.bpm)}, ${q(b.args.w)});`]);
sn('sound_sfx', '🔔', '効果音(ゲーム用)', 'Sound effect', [J('効果音', 'Sound effect'), E('name'), J('を音量', 'at volume'), E('vol'), J('で鳴らす', '')],
  { name: sel(opts([['coin', 'コイン', 'coin'], ['jump', 'ジャンプ', 'jump'], ['hit', 'ヒット/ダメージ', 'hit / damage'], ['explosion', '爆発', 'explosion'], ['powerup', 'パワーアップ', 'power-up'], ['laser', 'レーザー', 'laser'], ['click', 'クリック', 'click'], ['gameover', 'ゲームオーバー', 'game over'], ['win', 'クリア/勝利', 'win']])), vol: X('0.3') },
  { name: 'coin', vol: '0.3' }, (b, g) => [`sfx(${q(b.args.name)}, ${g.expr(b.args.vol)});`]);
sn('sound_speak', '🗣', 'テキストを読み上げ', 'Speak text', [E('text'), J('を言語', 'Speak'), E('lang'), J('・速さ', ', language'), E('rate'), J('で読み上げる', ', rate')],
  { text: X('"こんにちは"'), lang: sel(opts([['ja-JP', '日本語', 'Japanese'], ['en-US', '英語(米)', 'English (US)'], ['zh-CN', '中国語', 'Chinese'], ['ko-KR', '韓国語', 'Korean'], ['fr-FR', 'フランス語', 'French'], ['de-DE', 'ドイツ語', 'German'], ['es-ES', 'スペイン語', 'Spanish']])), rate: X('1') },
  { text: '"こんにちは"', lang: 'ja-JP', rate: '1' }, (b, g) => [`speak(${g.expr(b.args.text)}, ${q(b.args.lang)}, ${g.expr(b.args.rate)});`]);

// ======================================================== canvas drawing
const dr = (type, icon, ja, en, parts, fields, defaults, gen) => B(type, 'Draw', icon, ja, en, parts, fields, defaults, (b, g) => { g.use('canvas'); return gen(b, g); });
const CV = { t: 'comp', types: ['canvas'] };
const FS = sel(opts([['0', '塗りつぶし', 'fill'], ['1', '枠線のみ', 'outline']]));
dr('cv_clear', '⌫', 'キャンバスを消去/塗る', 'Clear canvas', [E('c'), J('を色', ': clear / fill with'), E('col'), J('で塗る(空欄=透明に消去)', '(blank = clear)')], { c: CV, col: X('"#ffffff"') }, { c: '', col: '' },
  (b, g) => [`cvClear(${g.comp(b.args.c)}, ${g.expr(b.args.col)});`]);
dr('cv_rect', '▭', '四角を描く', 'Draw rectangle', [E('c'), J('に x', ': rectangle x'), E('x'), J('y', 'y'), E('y'), J('幅', 'w'), E('w'), J('高さ', 'h'), E('h'), J('色', 'color'), E('col'), E('m')],
  { c: CV, x: X('10'), y: X('10'), w: X('50'), h: X('50'), col: X('"red"'), m: FS }, { c: '', x: '10', y: '10', w: '50', h: '50', col: '"red"', m: '0' },
  (b, g) => [`cvRect(${g.comp(b.args.c)}, ${num(g, b.args.x)}, ${num(g, b.args.y)}, ${num(g, b.args.w)}, ${num(g, b.args.h)}, ${g.expr(b.args.col)}, ${b.args.m === '1'});`]);
dr('cv_circle', '●', '円を描く', 'Draw circle', [E('c'), J('に x', ': circle x'), E('x'), J('y', 'y'), E('y'), J('半径', 'radius'), E('r'), J('色', 'color'), E('col'), E('m')],
  { c: CV, x: X('100'), y: X('100'), r: X('30'), col: X('"blue"'), m: FS }, { c: '', x: '100', y: '100', r: '30', col: '"blue"', m: '0' },
  (b, g) => [`cvCircle(${g.comp(b.args.c)}, ${num(g, b.args.x)}, ${num(g, b.args.y)}, ${num(g, b.args.r)}, ${g.expr(b.args.col)}, ${b.args.m === '1'});`]);
dr('cv_line', '／', '線を描く', 'Draw line', [E('c'), J('に (', ': line ('), E('x1'), J(',', ','), E('y1'), J(')→(', ')→('), E('x2'), J(',', ','), E('y2'), J(') 色', ') color'), E('col'), J('太さ', 'width'), E('w')],
  { c: CV, x1: X('0'), y1: X('0'), x2: X('100'), y2: X('100'), col: X('"black"'), w: X('2') }, { c: '', x1: '0', y1: '0', x2: '100', y2: '100', col: '"black"', w: '2' },
  (b, g) => [`cvLine(${g.comp(b.args.c)}, ${num(g, b.args.x1)}, ${num(g, b.args.y1)}, ${num(g, b.args.x2)}, ${num(g, b.args.y2)}, ${g.expr(b.args.col)}, ${num(g, b.args.w)});`]);
dr('cv_text', 'T', '文字を描く', 'Draw text', [E('c'), J('に文字', ': text'), E('t'), J('を x', 'at x'), E('x'), J('y', 'y'), E('y'), J('色', 'color'), E('col'), J('サイズ', 'size'), E('s')],
  { c: CV, t: X('"Score: 0"'), x: X('10'), y: X('20'), col: X('"black"'), s: X('20') }, { c: '', t: '"Hello"', x: '10', y: '20', col: '"black"', s: '20' },
  (b, g) => [`cvText(${g.comp(b.args.c)}, ${g.expr(b.args.t)}, ${num(g, b.args.x)}, ${num(g, b.args.y)}, ${g.expr(b.args.col)}, ${num(g, b.args.s)});`]);
dr('cv_image', '🖼', '画像を描く', 'Draw image', [E('c'), J('に画像', ': image'), E('src'), J('を x', 'at x'), E('x'), J('y', 'y'), E('y'), J('幅', 'w'), E('w'), J('高さ', 'h'), E('h')],
  { c: CV, src: { t: 'asset', kind: 'image' }, x: X('0'), y: X('0'), w: X('64'), h: X('64') }, { c: '', src: '', x: '0', y: '0', w: '64', h: '64' },
  (b, g) => [`cvImage(${g.comp(b.args.c)}, ${q(b.args.src)}, ${num(g, b.args.x)}, ${num(g, b.args.y)}, ${num(g, b.args.w)}, ${num(g, b.args.h)});`]);

// Project templates. New ones can be appended here (or registered by plugins later).
import { emptyProject, createNode, newScript, newBlock, newModel } from './model.js';
import { defaultMcConfig } from './targets/minecraft/index.js';

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
  {
    id: 'todo', name: 'App: To-Do', desc: 'タスクの追加・チェック・削除(編集できる Data Grid + Enterキーで追加)',
    build() {
      const p = emptyProject('To-Do');
      const m = newModel(p, 'Todo');
      m.fields = [{ name: 'id', type: 'Number' }, { name: 'text', type: 'String' }, { name: 'done', type: 'Boolean' }, { name: 'category', type: 'Relation', ref: 'Category' }];
      m.rows = [{ _id: 1, id: 1, text: 'Codiramを触ってみる', done: true, category: 1 }, { _id: 2, id: 2, text: 'アプリをExportする', done: false, category: 2 }];
      const cat = newModel(p, 'Category');
      cat.fields = [{ name: 'name', type: 'String' }];
      cat.rows = [{ _id: 1, name: '仕事' }, { _id: 2, name: 'プライベート' }];
      p.models.push(cat, m);
      p.variables.push({ name: 'newTask', type: 'String', initial: '' });
      const root = p.pages[0].root;
      add(p, root, 'text', { text: '✅ To-Do' }, { fontSize: '26', bold: true });
      const row = add(p, root, 'row');
      const input = add(p, row, 'input', { placeholder: 'やることを入力して Enter', bind: 'newTask' }, { width: '300' });
      const btn = add(p, row, 'button', { text: '追加' });
      add(p, root, 'datagrid', { source: 'Todo', cols: 'done, text, category', deleteBtn: true, addBtn: false });
      add(p, root, 'text', { text: '全 {Todo.length} 件' }, { color: '#6b7280' });
      const addBlocks = () => [blk('if', { cond: cond('newTask', 'notempty', '') }, { then: [
        blk('add_row', { model: 'Todo', values: { text: 'newTask', done: 'false' } }), blk('set_var', { name: 'newTask', value: '""' }), blk('sound_sfx', { name: 'click', vol: '0.2' })], else: [] })];
      const s1 = newScript(p, 'main', 'onClick', { target: btn.id }); s1.name = '追加ボタン'; s1.body.push(...addBlocks());
      const s2 = newScript(p, 'main', 'onEnter', { target: input.id }); s2.name = 'Enterで追加'; s2.body.push(...addBlocks());
      p.scripts.push(s1, s2);
      return p;
    },
  },
  {
    id: 'contacts', name: 'App: Data Manager', desc: '連絡先の登録・編集・検索・CSV入出力',
    build() {
      const p = emptyProject('Contacts');
      const m = newModel(p, 'Contact');
      m.fields = [{ name: 'id', type: 'Number' }, { name: 'name', type: 'String' }, { name: 'email', type: 'String' }, { name: 'age', type: 'Number' }];
      m.rows = [{ _id: 1, id: 1, name: 'Alice', email: 'alice@example.com', age: 20 }, { _id: 2, id: 2, name: 'Bob', email: 'bob@example.com', age: 25 }];
      p.models.push(m);
      for (const v of ['name', 'email', 'age']) p.variables.push({ name: 'f_' + v, type: v === 'age' ? 'Number' : 'String', initial: v === 'age' ? '0' : '' });
      p.variables.push({ name: 'fileText', type: 'String', initial: '' });
      const root = p.pages[0].root;
      add(p, root, 'text', { text: '📇 連絡先マネージャ' }, { fontSize: '26', bold: true });
      const tabs = add(p, root, 'tabs');
      const t1 = add(p, tabs, 'column'); t1.name = 'ひとり追加'; t1.props.title = '追加';
      const t2 = add(p, tabs, 'column'); t2.name = '一覧'; t2.props.title = '一覧・編集';
      const t3 = add(p, tabs, 'column'); t3.name = 'CSV'; t3.props.title = 'CSV';
      const form = add(p, t1, 'form');
      add(p, form, 'input', { placeholder: '名前', bind: 'f_name' }); add(p, form, 'input', { placeholder: 'メールアドレス', bind: 'f_email', inputType: 'email' });
      add(p, form, 'input', { placeholder: '年齢', bind: 'f_age', inputType: 'number' });
      const submit = add(p, form, 'button', { text: '登録', submit: true });
      add(p, t2, 'datagrid', { source: 'Contact', cols: 'name, email, age', deleteBtn: true, addBtn: true });
      add(p, t2, 'text', { text: '登録数: {Contact.length}' }, { color: '#6b7280' });
      const dl = add(p, t3, 'button', { text: '⬇ CSVをダウンロード' });
      const file = add(p, t3, 'fileinput', { accept: '.csv,.txt' });
      add(p, t3, 'text', { text: 'CSVを選ぶと、先頭行が項目名(id,name,email,age)なら自動で読み込みます。' }, { color: '#6b7280', fontSize: '13' });
      const s1 = newScript(p, 'main', 'onSubmit', { target: form.id }); s1.name = '登録';
      s1.body.push(blk('if', { cond: cond('f_name', 'notempty', '') }, { then: [
        blk('add_row', { model: 'Contact', values: { name: 'f_name', email: 'f_email', age: 'f_age' } }),
        blk('form_reset', { t: form.id }), blk('tab_select', { t: tabs.id, i: '1' }), blk('sound_sfx', { name: 'coin', vol: '0.2' }),
      ], else: [blk('alert', { value: '"名前を入力してください"' })] }));
      const s2 = newScript(p, 'main', 'onClick', { target: dl.id }); s2.name = 'CSV出力'; s2.body.push(blk('csv_download', { model: 'Contact' }));
      const s3 = newScript(p, 'main', 'onChange', { target: file.id }); s3.name = 'CSV取込';
      s3.body.push(blk('file_read', { to: 'fileText', t: file.id, mode: 'text' }), blk('csv_import', { model: 'Contact', text: 'fileText' }), blk('tab_select', { t: tabs.id, i: '1' }));
      p.scripts.push(s1, s2, s3);
      return p;
    },
  },
  {
    id: 'dashboard', name: 'App: Dashboard', desc: '売上データを集計してカード・棒グラフ・円グラフで表示',
    build() {
      const p = emptyProject('Dashboard');
      const m = newModel(p, 'Sales');
      m.fields = [{ name: 'month', type: 'String' }, { name: 'amount', type: 'Number' }];
      m.rows = ['1月:120', '2月:150', '3月:90', '4月:180', '5月:210', '6月:170'].map((x, i) => ({ _id: i + 1, month: x.split(':')[0], amount: Number(x.split(':')[1]) }));
      p.models.push(m);
      for (const v of ['total', 'average', 'best']) p.variables.push({ name: v, type: 'Number', initial: '0' });
      p.variables.push({ name: 'rows', type: 'Array', initial: '[]' }, { name: 'amounts', type: 'Array', initial: '[]' });
      const root = p.pages[0].root;
      add(p, root, 'text', { text: '📊 売上ダッシュボード' }, { fontSize: '26', bold: true });
      const cards = add(p, root, 'row', {}, { gap: '16' });
      for (const [label, v] of [['合計', 'total'], ['平均', 'average'], ['最高', 'best']]) {
        const c = add(p, cards, 'card', {}, { width: '160' });
        add(p, c, 'text', { text: label }, { color: '#6b7280', fontSize: '13' });
        add(p, c, 'text', { text: `{${v}}` }, { fontSize: '32', bold: true, color: '#2563eb' });
      }
      const charts = add(p, root, 'row', {}, { gap: '16', align: 'flex-start' });
      add(p, charts, 'chart', { kind: 'bar', source: 'Sales', labelField: 'month', valueField: 'amount', title: '月別売上' }, { width: '420', height: '280' });
      add(p, charts, 'chart', { kind: 'pie', source: 'Sales', labelField: 'month', valueField: 'amount', title: '構成比' }, { width: '380', height: '280' });
      add(p, root, 'datagrid', { source: 'Sales', cols: 'month, amount', addBtn: true, deleteBtn: true });
      const calc = () => [
        blk('model_rows', { to: 'rows', model: 'Sales' }), blk('list_map', { to: 'amounts', list: 'rows', expr: 'item.amount' }),
        blk('list_info', { to: 'total', list: 'amounts', kind: 'sum' }), blk('list_info', { to: 'average', list: 'amounts', kind: 'avg' }),
        blk('math_round_to', { to: 'average', a: 'average', d: '1' }), blk('list_info', { to: 'best', list: 'amounts', kind: 'max' }),
      ];
      const s1 = newScript(p, 'main', 'onLoad', { page: 'main' }); s1.name = '集計'; s1.body.push(...calc());
      const s2 = newScript(p, 'main', 'onDataChanged', { model: 'Sales' }); s2.name = 'データ変更時に再集計'; s2.body.push(...calc());
      p.scripts.push(s1, s2);
      return p;
    },
  },
  {
    id: 'apiclient', name: 'App: API Client', desc: 'Web API(JSON)を取得して一覧表示(fetch・配列ループ)',
    build() {
      const p = emptyProject('API Client');
      const m = newModel(p, 'Post');
      m.fields = [{ name: 'id', type: 'Number' }, { name: 'title', type: 'String' }];
      p.models.push(m);
      p.variables.push({ name: 'items', type: 'Array', initial: '[]' }, { name: 'status', type: 'String', initial: '「取得」を押してください' });
      const root = p.pages[0].root;
      add(p, root, 'text', { text: '🌐 API クライアント' }, { fontSize: '26', bold: true });
      const row = add(p, root, 'row');
      const btn = add(p, row, 'button', { text: '投稿を取得' });
      add(p, row, 'text', { text: '{status}' }, { color: '#6b7280' });
      add(p, root, 'table', { source: 'Post', cols: 'id, title' });
      const s = newScript(p, 'main', 'onClick', { target: btn.id }); s.name = '取得';
      s.body.push(blk('set_var', { name: 'status', value: '"取得中…"' }),
        blk('try_catch', { err: 'error' }, { body: [
          blk('sys_fetch', { to: 'items', method: 'GET', url: '"https://jsonplaceholder.typicode.com/posts?_limit=8"', body: '' }),
          blk('clear_rows', { model: 'Post' }),
          blk('list_foreach', { list: 'items', item: 'item', index: 'i' }, { body: [blk('add_row', { model: 'Post', values: { id: 'item.id', title: 'item.title' } })] }),
          blk('set_var', { name: 'status', value: '"取得しました: " + items.length + " 件"' }),
        ], catch: [blk('set_var', { name: 'status', value: '"エラー: " + error.message' })] }));
      p.scripts.push(s);
      return p;
    },
  },
  {
    id: 'stopwatch', name: 'App: Stopwatch', desc: 'タイマー開始・停止・リセット(タイマーブロック)',
    build() {
      const p = emptyProject('Stopwatch');
      p.variables.push({ name: 'ms', type: 'Number', initial: '0' }, { name: 'display', type: 'Number', initial: '0' });
      const root = p.pages[0].root;
      add(p, root, 'text', { text: '⏱ ストップウォッチ' }, { fontSize: '26', bold: true });
      add(p, root, 'text', { text: '{display} 秒' }, { fontSize: '56', bold: true, color: '#2563eb' });
      const row = add(p, root, 'row');
      const start = add(p, row, 'button', { text: '▶ スタート' }), stop = add(p, row, 'button', { text: '■ ストップ' }), reset = add(p, row, 'button', { text: '↺ リセット' });
      const s1 = newScript(p, 'main', 'onClick', { target: start.id }); s1.name = 'スタート';
      s1.body.push(blk('timer_start', { name: 'sw', ms: '100' }, { body: [blk('change_var', { name: 'ms', by: '100' }), blk('math_calc', { to: 'display', a: 'ms', op: '/', b: '1000' })] }));
      const s2 = newScript(p, 'main', 'onClick', { target: stop.id }); s2.name = 'ストップ'; s2.body.push(blk('timer_stop', { name: 'sw' }));
      const s3 = newScript(p, 'main', 'onClick', { target: reset.id }); s3.name = 'リセット';
      s3.body.push(blk('timer_stop', { name: 'sw' }), blk('set_var', { name: 'ms', value: '0' }), blk('set_var', { name: 'display', value: '0' }));
      p.scripts.push(s1, s2, s3);
      return p;
    },
  },
  {
    id: 'quiz', name: 'App: Quiz', desc: '3択クイズ(データモデル・関数・条件分岐・効果音)',
    build() {
      const p = emptyProject('Quiz');
      const m = newModel(p, 'Quiz');
      m.fields = [{ name: 'q', type: 'String' }, { name: 'a1', type: 'String' }, { name: 'a2', type: 'String' }, { name: 'a3', type: 'String' }, { name: 'answer', type: 'Number' }];
      m.rows = [
        { _id: 1, q: '日本の首都は?', a1: '大阪', a2: '東京', a3: '京都', answer: 2 },
        { _id: 2, q: '1 + 2 × 3 = ?', a1: '9', a2: '7', a3: '5', answer: 2 },
        { _id: 3, q: 'Webページの構造を書く言語は?', a1: 'HTML', a2: 'CSS', a3: 'SQL', answer: 1 },
      ];
      p.models.push(m);
      p.variables.push({ name: 'idx', type: 'Number', initial: '0' }, { name: 'score', type: 'Number', initial: '0' });
      const root = p.pages[0].root;
      add(p, root, 'text', { text: '🧠 クイズ   スコア: {score}' }, { fontSize: '22', bold: true });
      const q = add(p, root, 'text', { text: '…' }, { fontSize: '24' }); q.name = 'Question';
      const btns = [1, 2, 3].map((n) => { const b = add(p, root, 'button', { text: '…' }, { width: '320' }); b.name = 'Choice' + n; return b; });
      const showQ = newScript(p, 'main', 'onFunction', { name: '問題を表示', params: '' }); showQ.name = '問題を表示';
      showQ.body.push(
        blk('set_text', { target: q.id, value: rep('r_row_field', { model: 'Quiz', index: 'idx', field: 'q' }) }),
        ...btns.map((b, i) => blk('set_text', { target: b.id, value: rep('r_row_field', { model: 'Quiz', index: 'idx', field: 'a' + (i + 1) }) })));
      const load = newScript(p, 'main', 'onLoad', { page: 'main' }); load.name = '開始';
      load.body.push(blk('set_var', { name: 'idx', value: '0' }), blk('set_var', { name: 'score', value: '0' }), blk('call_fn', { name: '問題を表示', args: '', to: '' }));
      const answer = newScript(p, 'main', 'onFunction', { name: '回答', params: 'n' }); answer.name = '回答する(n番目の選択肢)';
      answer.body.push(
        blk('if', { cond: { rows: [{ l: 'n', op: '==', r: rep('r_row_field', { model: 'Quiz', index: 'idx', field: 'answer' }) }], join: 'and', not: false } }, {
          then: [blk('change_var', { name: 'score', by: '1' }), blk('sound_sfx', { name: 'coin', vol: '0.3' })], else: [blk('sound_sfx', { name: 'hit', vol: '0.3' })] }),
        blk('change_var', { name: 'idx', by: '1' }),
        blk('if', { cond: { rows: [{ l: 'idx', op: '>=', r: rep('r_count', { model: 'Quiz' }) }], join: 'and', not: false } }, {
          then: [blk('alert', { value: '"おしまい! スコア: " + score + " / " + ' + 'idx' }), blk('set_var', { name: 'idx', value: '0' }), blk('set_var', { name: 'score', value: '0' })], else: [] }),
        blk('call_fn', { name: '問題を表示', args: '', to: '' }));
      const hooks = btns.map((b, i) => { const sc = newScript(p, 'main', 'onClick', { target: b.id }); sc.name = `選択肢${i + 1}`; sc.body.push(blk('call_fn', { name: '回答', args: String(i + 1), to: '' })); return sc; });
      p.scripts.push(showQ, load, answer, ...hooks);
      return p;
    },
  },
  {
    id: 'contactform', name: 'App: Form', desc: 'お問い合わせフォーム(入力チェック・送信・一覧)',
    build() {
      const p = emptyProject('Contact Form');
      const m = newModel(p, 'Inquiry');
      m.fields = [{ name: 'id', type: 'Number' }, { name: 'name', type: 'String' }, { name: 'email', type: 'String' }, { name: 'message', type: 'String' }];
      p.models.push(m);
      for (const v of ['name', 'email', 'message']) p.variables.push({ name: 'in_' + v, type: 'String', initial: '' });
      const root = p.pages[0].root;
      add(p, root, 'text', { text: '✉️ お問い合わせ' }, { fontSize: '26', bold: true });
      const card = add(p, root, 'card', {}, { width: '420' });
      const form = add(p, card, 'form');
      add(p, form, 'input', { placeholder: 'お名前', bind: 'in_name' }); add(p, form, 'input', { placeholder: 'メールアドレス', bind: 'in_email', inputType: 'email' });
      add(p, form, 'textarea', { placeholder: 'お問い合わせ内容', bind: 'in_message' });
      add(p, form, 'button', { text: '送信', submit: true });
      add(p, root, 'text', { text: '受信済み: {Inquiry.length} 件' }, { color: '#6b7280' });
      add(p, root, 'table', { source: 'Inquiry', cols: 'name, email, message', deleteBtn: true });
      const s = newScript(p, 'main', 'onSubmit', { target: form.id }); s.name = '送信';
      s.body.push(blk('if', { cond: { rows: [{ l: 'in_name', op: 'notempty', r: '' }, { l: 'in_email', op: 'contains', r: '"@"' }], join: 'and', not: false } }, {
        then: [blk('add_row', { model: 'Inquiry', values: { name: 'in_name', email: 'in_email', message: 'in_message' } }), blk('form_reset', { t: form.id }), blk('alert', { value: '"送信しました。ありがとうございます!"' })],
        else: [blk('alert', { value: '"名前と正しいメールアドレスを入力してください"' })] }));
      p.scripts.push(s);
      return p;
    },
  },
  {
    id: 'mapapp', name: 'App: Map', desc: '場所を選ぶと地図が移動(Map部品・データ検索・値ブロック)',
    build() {
      const p = emptyProject('Map App');
      const m = newModel(p, 'Place');
      m.fields = [{ name: 'name', type: 'String' }, { name: 'lat', type: 'Number' }, { name: 'lon', type: 'Number' }];
      m.rows = [{ _id: 1, name: '東京駅', lat: 35.6812, lon: 139.7671 }, { _id: 2, name: '大阪城', lat: 34.6873, lon: 135.5262 }, { _id: 3, name: '札幌時計台', lat: 43.0626, lon: 141.3535 }, { _id: 4, name: '福岡タワー', lat: 33.5934, lon: 130.3515 }];
      p.models.push(m);
      p.variables.push({ name: 'place', type: 'String', initial: '東京駅' });
      const root = p.pages[0].root;
      add(p, root, 'text', { text: '🗺 マップ: {place}' }, { fontSize: '26', bold: true });
      const sel = add(p, root, 'select', { options: '東京駅, 大阪城, 札幌時計台, 福岡タワー', bind: 'place' }, { width: '240' });
      const map = add(p, root, 'map', { lat: '35.6812', lon: '139.7671', zoom: '14', marker: true }, { height: '360' });
      add(p, root, 'table', { source: 'Place', cols: 'name, lat, lon' });
      const find = (f) => rep('r_find_row', { model: 'Place', cond: cond('item.name', '==', 'place'), field: f });
      const sc = newScript(p, 'main', 'onChange', { target: sel.id }); sc.name = '場所が選ばれた';
      sc.body.push(blk('map_set', { t: map.id, lat: find('lat'), lon: find('lon'), z: '14' }));
      p.scripts.push(sc);
      return p;
    },
  },
  {
    id: 'mc_hello', target: 'minecraft', name: 'Hello Minecraft', desc: 'プレイヤーが参加したらメッセージを表示(最初の成功ルート)',
    build(opts = {}) {
      const p = emptyProject(opts.modName || 'Hello Mod', { ...defaultMcConfig(opts.modId, opts.modName), ...(opts.config || {}) });
      const s = newScript(p, 'main', 'mc_on_join', {}); s.name = 'プレイヤー参加時';
      s.body.push(blk('mc_send_message', { to: 'player', text: '"Hello Minecraft!"' }));
      p.scripts.push(s);
      return p;
    },
  },
  {
    id: 'mc_kit', target: 'minecraft', name: 'Welcome Kit', desc: '参加メッセージ+パン配布 / スニーク右クリックでジャンプ台 / ダイヤ鉱石を壊すと報酬',
    build(opts = {}) {
      const p = emptyProject(opts.modName || 'Welcome Kit', { ...defaultMcConfig(opts.modId || 'welcome_kit', opts.modName || 'Welcome Kit'), ...(opts.config || {}) });
      p.variables.push({ name: 'visitors', type: 'Number', initial: '0' }, { name: 'bonus', type: 'String', initial: 'ダイヤ発見!' });
      const join = newScript(p, 'main', 'mc_on_join', {}); join.name = '参加時';
      join.body.push(
        blk('change_var', { name: 'visitors', by: '1' }),
        blk('mc_send_message', { to: 'player', text: '"ようこそ " + ' + 'visitors' + ' + " 人目のプレイヤーさん!"' }),
        blk('mc_give_item', { item: 'minecraft:bread', count: '5' }),
        blk('mc_play_sound', { sound: 'minecraft:entity.player.levelup', volume: '1', pitch: '1' }),
        blk('wait', { ms: '3000' }),
        blk('mc_send_message', { to: 'player', text: '"ゆっくりしていってね!"' }));
      const use = newScript(p, 'main', 'mc_on_item_use', {}); use.name = '右クリック(アイテム使用)';
      use.body.push(blk('if', { cond: { rows: [{ l: rep('b_mc_sneaking', {}), op: 'true', r: '' }, { l: rep('r_mc_held_item', {}), op: '==', r: '"minecraft:stick"' }], join: 'and', not: false } }, {
        then: [blk('mc_teleport', { mode: 'relative', x: '0', y: '10', z: '0' }), blk('mc_play_sound', { sound: 'minecraft:entity.firework_rocket.launch', volume: '1', pitch: '1' })], else: [] }));
      const brk = newScript(p, 'main', 'mc_on_block_break', {}); brk.name = 'ブロックを壊した';
      brk.body.push(blk('if', { cond: cond(rep('r_mc_block_id', {}), '==', '"minecraft:diamond_ore"') }, {
        then: [blk('mc_send_message', { to: 'all', text: rep('text_join', { a: rep('r_mc_player_name', {}), b: '" が " + bonus', c: '' }) }), blk('mc_give_item', { item: 'minecraft:diamond', count: '2' })], else: [] }));
      p.scripts.push(join, use, brk);
      return p;
    },
  },
  {
    id: 'mc_ruby', target: 'minecraft', name: 'Ruby Mod', desc: '新しいアイテム・ブロック・レシピを追加(テクスチャも自動生成)+ ルビーを持って右クリックで効果',
    build(opts = {}) {
      const p = emptyProject(opts.modName || 'Ruby Mod', { ...defaultMcConfig(opts.modId || 'ruby_mod', opts.modName || 'Ruby Mod'), ...(opts.config || {}) });
      const mod = p.targets[0].modId;
      p.content.items.push(
        { id: 'ruby', name: 'Ruby', maxStack: 64, hunger: 0, saturation: 0.3, color: '#e0115f', texture: '' },
        { id: 'ruby_apple', name: 'Ruby Apple', maxStack: 64, hunger: 6, saturation: 0.8, color: '#ff4d6d', texture: '' });
      p.content.blocks.push({ id: 'ruby_block', name: 'Block of Ruby', material: 'METAL', hardness: 3, resistance: 6, light: 4, color: '#e0115f', texture: '' });
      p.content.recipes.push(
        { id: 'ruby_block_from_rubies', kind: 'shaped', result: 'ruby_block', count: 1, grid: Array(9).fill('ruby'), ingredients: '', ingredient: '', xp: 0, time: 200 },
        { id: 'rubies_from_block', kind: 'shapeless', result: 'ruby', count: 9, grid: Array(9).fill(''), ingredients: 'ruby_block', ingredient: '', xp: 0, time: 200 },
        { id: 'ruby_apple', kind: 'shaped', result: 'ruby_apple', count: 1, grid: ['', 'ruby', '', 'ruby', 'minecraft:apple', 'ruby', '', 'ruby', ''], ingredients: '', ingredient: '', xp: 0, time: 200 },
        { id: 'ruby_from_redstone', kind: 'smelting', result: 'ruby', count: 1, grid: Array(9).fill(''), ingredients: '', ingredient: 'minecraft:redstone_block', xp: 1, time: 200 });
      const join = newScript(p, 'main', 'mc_on_join', {}); join.name = '参加時';
      join.body.push(blk('mc_give_item', { item: `${mod}:ruby`, count: '3' }), blk('mc_send_message', { to: 'player', where: 'chat', text: '"ルビーを3個プレゼント!"' }));
      const use = newScript(p, 'main', 'mc_on_item_use', {}); use.name = 'ルビーを使った';
      use.body.push(blk('if', { cond: cond(rep('r_mc_held_item', {}), '==', `"${mod}:ruby"`) }, { then: [
        blk('mc_effect', { effect: 'minecraft:regeneration', secs: '10', amp: '1' }), blk('mc_remove_item', { item: `${mod}:ruby`, count: '1' }),
        blk('mc_play_sound', { sound: 'minecraft:entity.player.levelup', volume: '1', pitch: '1' }), blk('mc_send_message', { to: 'player', where: 'actionbar', text: '"ルビーのちから!"' })], else: [] }));
      p.scripts.push(join, use);
      return p;
    },
  },
];

// Desktop blocks: file dialogs, clipboard, notifications, window control.
// They generate plain JavaScript that calls `Desktop.*`; the small Desktop runtime (below) uses Tauri when the app
// runs as a desktop app and falls back to browser features otherwise, so the Preview keeps working.
import { stmt, E, q } from '../../blocks.js';
import { blocks, pluginModules } from '../../registry.js';
import { J } from '../../i18n-helpers.js';

const X = (ph) => ({ t: 'expr', ph });
const to = { t: 'var' };
const out = (b, js) => [`setVar(${q(b.args.to)}, ${js});`];
const str = (g, x) => `String(${g.expr(x)})`;

const D = (type, icon, ja, en, parts, fields, defaults, caps, gen, { web = false, value = false } = {}) => {
  stmt(type, 'System', icon, ja, parts, fields, defaults, (b, g) => { g.use('sys'); g.use('desktop'); return gen(b, g); }, undefined);
  Object.assign(blocks.get(type), { en, caps, targets: web ? ['desktop', 'web'] : ['desktop'], reporter: value });
};

D('desk_open_file', '📂', 'ファイルを開く', 'Open file', [J('変数', 'Set'), E('to'), J('に「ファイルを開く」で選んだファイルの内容を入れる', 'to the contents of a file picked in an Open dialog')],
  { to }, { to: '' }, ['dialog', 'filesystem'], (b) => out(b, 'await Desktop.openFile()'), { value: true });
D('desk_save_file', '💾', 'ファイルに保存', 'Save file', [E('text'), J('を「名前を付けて保存」で保存(ファイル名', 'Save as… (file name'), E('name'), J(')', ')')],
  { text: X(), name: X('"memo.txt"') }, { text: '', name: '"memo.txt"' }, ['dialog', 'filesystem'], (b, g) => [`await Desktop.saveFile(${str(g, b.args.text)}, ${str(g, b.args.name)});`]);
D('desk_pick_folder', '🗂', 'フォルダを選ぶ', 'Pick folder', [J('変数', 'Set'), E('to'), J('に「フォルダを選択」で選んだフォルダのパスを入れる', 'to the path of a folder picked in a dialog')],
  { to }, { to: '' }, ['dialog', 'filesystem'], (b) => out(b, 'await Desktop.pickFolder()'), { value: true });
D('desk_clipboard_read', '📋', 'クリップボードから読み込み', 'Read clipboard', [J('変数', 'Set'), E('to'), J('にクリップボードの文字列を入れる', 'to the clipboard text')],
  { to }, { to: '' }, ['clipboard'], (b) => out(b, 'await Desktop.readClipboard()'), { web: true, value: true });
D('desk_notify', '🔔', '通知を表示', 'Show notification', [J('通知', 'Notify'), E('title'), J('/', '/'), E('body'), J('を表示', '')],
  { title: X('"お知らせ"'), body: X('"完了しました"') }, { title: '"お知らせ"', body: '"完了しました"' }, ['notification'],
  (b, g) => [`await Desktop.notify(${str(g, b.args.title)}, ${str(g, b.args.body)});`], { web: true });
D('desk_window_title', '🪟', 'ウィンドウのタイトルを変更', 'Set window title', [J('ウィンドウのタイトルを', 'Set the window title to'), E('title'), J('にする', '')],
  { title: X('"My App"') }, { title: '"My App"' }, ['window'], (b, g) => [`await Desktop.setTitle(${str(g, b.args.title)});`]);
D('desk_fullscreen', '⛶', '全画面表示', 'Fullscreen', [J('全画面表示を', 'Fullscreen:'), E('on')],
  { on: { t: 'select', opts: [['1', J('オンにする', 'on')], ['0', J('オフにする', 'off')]] } }, { on: '1' }, ['window'], (b) => [`await Desktop.setFullscreen(${b.args.on !== '0'});`]);

pluginModules.desktop = String.raw`// ---- Desktop runtime: Tauri when running as a desktop app, browser fallbacks otherwise ----
const Desktop = (() => {
  const T = window.__TAURI__;
  const pickText = () => new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = () => (input.files[0] ? input.files[0].text().then(resolve) : resolve(""));
    input.click();
  });
  return {
    async openFile() {
      if (!T) return pickText();
      const path = await T.dialog.open({ multiple: false });
      return path ? T.fs.readTextFile(path) : "";
    },
    async saveFile(text, name) {
      if (!T) { downloadText(name, text); return; }
      const path = await T.dialog.save({ defaultPath: name });
      if (path) await T.fs.writeTextFile(path, text);
    },
    async pickFolder() {
      if (!T) return prompt("Folder path") || "";
      return (await T.dialog.open({ directory: true })) || "";
    },
    async readClipboard() {
      if (T) return T.clipboard.readText();
      try { return await navigator.clipboard.readText(); } catch (e) { return ""; }
    },
    async notify(title, body) {
      if (T) {
        let ok = await T.notification.isPermissionGranted();
        if (!ok) ok = (await T.notification.requestPermission()) === "granted";
        if (ok) T.notification.sendNotification({ title, body });
      } else if ("Notification" in window && (await Notification.requestPermission()) === "granted") {
        new Notification(title, { body });
      } else {
        alert(title + "\n" + body);
      }
    },
    async setTitle(title) {
      document.title = title;
      if (T) await T.window.appWindow.setTitle(title);
    },
    async setFullscreen(on) {
      if (T) await T.window.appWindow.setFullscreen(on);
      else if (on) document.documentElement.requestFullscreen?.();
      else if (document.fullscreenElement) document.exitFullscreen();
    },
  };
})();`;

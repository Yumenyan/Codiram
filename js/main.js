// Codiram — entry point: top bar, view switching, global shortcuts.
import './components.js';
import './blocks.js';
import './blocks-extra.js';
import './blocks-reporters.js';
import './blocks-game.js';
import './blocks-more.js';
import './targets/index.js';
import { loadUserGenerators } from './sdk/external.js';
import { h, download, isTypingTarget, fmtDate } from './util.js';
import { store, ui, subscribe, emit, undo, redo, jumpTo, saveNow, nav, saveAs, newProject, listProjects, openProject, setActiveTarget, commit } from './store.js';
import { targets, GeneratorRegistry, activeTarget, activeTargetId } from './registry.js';
import { lint } from './model.js';
import { menu, toast, dialog, promptText, confirmDlg } from './ui-kit.js';
import { renderStart, newDialog, importFile } from './views/start.js';
import { renderDesign, designKey } from './views/design.js';
import { renderData } from './views/data.js';
import { renderLogic, logicKey } from './views/logic.js';
import { renderPreview, run as runPreview } from './views/preview.js';
import { openExport } from './export.js';
import { matchAction } from './shortcuts.js';
import { openShortcuts, openPlugins, openTargetSettings } from './views/prefs.js';
import { renderOutput } from './views/output.js';
import { loadInstalledPlugins } from './plugins.js';
import { openSearch } from './views/search.js';
import { openPalette } from './views/palette.js';
import { buildAiPack } from './sdk/ai-export.js';
import { makeZip } from './zip.js';
import { LANGS, getLang, setLang, tf, t, L } from './i18n.js';
import './i18n-dict.js';
import { fontSelect, colorField } from './views/fontpicker.js';

const topbar = document.getElementById('topbar');
const main = document.getElementById('main');
const ALL_VIEWS = ['design', 'data', 'logic', 'preview', 'output'];
/** views the active target offers (Web: design/data/logic/preview, Minecraft: data/logic/output) */
const viewsOf = () => (store.project ? activeTarget(store.project)?.views : null) || ['design', 'data', 'logic', 'preview'];
const viewLabel = (v) => ({ design: 'Design', data: 'Data', logic: 'Logic', preview: 'Preview', output: 'Output' }[v]);
let viewRoot = null;

// ---------- theme ----------
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('codiram.theme', t); } catch { /* ignore */ }
}
let theme = 'light';
try { theme = localStorage.getItem('codiram.theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); } catch { /* ignore */ }
applyTheme(theme);

// ---------- views ----------
function mount() {
  main.textContent = '';
  viewRoot = h('div', { class: 'view' });
  main.append(viewRoot);
  draw();
}

function draw(origin) {
  if (ui.view === 'start' || !store.project) renderStart(viewRoot);
  else if (ui.view === 'design') renderDesign(viewRoot, origin);
  else if (ui.view === 'data') renderData(viewRoot, origin);
  else if (ui.view === 'logic') renderLogic(viewRoot, origin);
  else if (ui.view === 'preview' && !origin) renderPreview(viewRoot);
  else if (ui.view === 'output') renderOutput(viewRoot);
}

nav.go = (view) => {
  if (view !== 'start' && !store.project) view = 'start';
  if (view !== 'start' && !viewsOf().includes(view)) view = view === 'preview' ? 'output' : viewsOf().includes('logic') ? 'logic' : viewsOf()[0];
  ui.view = view;
  mount();
  renderTopbar();
};
nav.run = () => {
  if (viewsOf().includes('preview')) { if (ui.view === 'preview') runPreview(); else nav.go('preview'); } else nav.go('output');
};
nav.undo = () => doUndo();

const histLabel = (l) => { const m = /^(Add|Edit|Delete|Insert|Rename|Create|Duplicate) (.+)$/.exec(l); return m ? t(m[1] + ' ') + t(m[2]) : t(l); };
function doUndo() { const l = undo(); if (l === false) toast('これ以上戻せません'); else toast(tf('↶ 元に戻しました: {0}', histLabel(l))); }
function doRedo() { const l = redo(); if (l === false) toast('やり直す操作がありません'); else toast(tf('↷ やり直しました: {0}', histLabel(l))); }

subscribe((origin) => {
  if (origin === 'status') { updateStatus(); return; }
  renderTopbar();
  draw(origin);
});
document.addEventListener('codiram-errors', renderTopbar);

// ---------- top bar ----------
function updateStatus() {
  const el = document.getElementById('save-status');
  if (!el) return;
  const m = { saved: ['✓ Saved', ''], saving: ['保存中…', ''], error: ['⚠ 保存に失敗', 'bad'] }[store.status];
  el.textContent = t(m[0]); el.className = 'status ' + m[1];
}

function renderTopbar() {
  const p = store.project;
  const inProject = ui.view !== 'start' && !!p;
  topbar.textContent = '';
  topbar.append(
    h('button', { class: 'brand', title: 'プロジェクト一覧へ', onclick: () => { if (store.project) saveNow(); nav.go('start'); } },
      h('span', { class: 'logo', html: '<svg viewBox="0 0 24 24" width="22" height="22"><rect x="2" y="2" width="9" height="9" rx="2" fill="currentColor"/><rect x="13" y="2" width="9" height="9" rx="2" fill="currentColor" opacity=".55"/><rect x="2" y="13" width="9" height="9" rx="2" fill="currentColor" opacity=".55"/><rect x="13" y="13" width="9" height="9" rx="2" fill="currentColor" opacity=".3"/></svg>' }),
      h('b', {}, 'Codiram')),
  );
  if (!inProject) {
    topbar.append(h('span', { class: 'sp' }), ...toolBtns(), langBtn(), themeBtn());
    return;
  }
  const probs = lint(p).length + ui.errors.length;
  topbar.append(
    h('button', { class: 'proj-btn', onclick: (e) => projectMenu(e.currentTarget) }, h('span', {}, p.name), h('small', {}, ' ▾')),
    h('span', { id: 'save-status', class: 'status' }),
    h('button', { class: 'icon-btn', title: 'Undo (Ctrl+Z)', disabled: !store.undoStack.length, onclick: doUndo }, '↶'),
    h('button', { class: 'icon-btn', title: 'Redo (Ctrl+Y)', disabled: !store.redoStack.length, onclick: doRedo }, '↷'),
    h('button', { class: 'icon-btn', title: '履歴 History', onclick: (e) => historyMenu(e.currentTarget) }, '🕘'),
    targetChip(),
    h('nav', { class: 'nav', role: 'tablist' }, viewsOf().map((v) => h('button', { class: 'nav-tab' + (ui.view === v ? ' on' : ''), role: 'tab', 'aria-selected': ui.view === v, onclick: () => nav.go(v) },
      viewLabel(v), v === 'logic' && probs ? h('b', { class: 'warn', title: tf('{0} 件の問題', probs) }, ' ⚠' + probs) : null))),
    h('span', { class: 'sp' }),
    h('button', { class: 'btn run', title: 'Run (F5)', onclick: () => nav.run() }, viewsOf().includes('preview') ? '▶ Run' : '▶ Output'),
    h('button', { class: 'btn', title: 'Export', onclick: () => { saveNow(); openExport(store.project); } }, '⬇ Export'),
    ...toolBtns(), langBtn(), themeBtn());
  updateStatus();
}

function targetChip() {
  const p = store.project, t = activeTarget(p);
  return h('button', { class: 'btn small target-chip', title: 'Target — 生成する実行環境', onclick: (e) => {
    const others = GeneratorRegistry.list().filter((x) => !p.targets.some((c) => c.type === x.id));
    menu(e.currentTarget, [
      ...p.targets.map((c) => { const d = targets.get(c.type); return { label: (c.type === activeTargetId(p) ? '✓ ' : '　') + d.icon + ' ' + L(d.name), onClick: () => { setActiveTarget(c.type); nav.go(viewsOf().includes(ui.view) ? ui.view : 'logic'); renderTopbar(); } }; }),
      { sep: true },
      ...(t.configFields.length || t.supports?.length ? [{ label: 'Target Settings…', onClick: () => openTargetSettings(t.id, { onDone: () => nav.go(ui.view) }) }] : []),
      ...others.map((d) => ({ label: tf('＋ {0} を追加…', d.icon + ' ' + L(d.name)), onClick: async () => { if (await openTargetSettings(d.id, { isNew: true })) { setActiveTarget(d.id); nav.go('logic'); } } })),
      { label: '🛠 Generator Builder…', onClick: async () => { const { openBuilder } = await import('./views/builder.js'); await openBuilder(); renderTopbar(); } },
      ...(p.targets.length > 1 ? [{ label: 'このターゲットを削除', onClick: async () => { if (await confirmDlg('ターゲットを削除', tf('{0} の設定を削除します(ロジックは残ります / Undoで戻せます)。', L(t.name)), '削除')) { const id = t.id; commit('Remove target', (pp) => { pp.targets = pp.targets.filter((x) => x.type !== id); }); setActiveTarget(p.targets[0].type); nav.go('logic'); } } }] : []),
    ]);
  } }, t.icon, h('span', {}, L(t.name)), h('small', {}, '▾'));
}

/** every action of the app as a command (palette + Tools menu) */
function commands() {
  const p = store.project, inProject = ui.view !== 'start' && !!p;
  const lazy = (path, fn) => async () => { const m = await import(path); await m[fn](); renderTopbar(); };
  const list = [];
  if (inProject) {
    viewsOf().forEach((v) => list.push({ label: tf('{0} 画面へ移動', viewLabel(v)), keywords: v, run: () => nav.go(v) }));
    list.push(
      { label: '実行 / プレビュー', hint: 'F5', keywords: 'run preview', run: () => nav.run() },
      { label: '保存', hint: 'Ctrl+S', keywords: 'save', run: () => { saveNow(); toast('✓ 保存しました'); } },
      { label: '元に戻す', hint: 'Ctrl+Z', keywords: 'undo', run: doUndo }, { label: 'やり直し', hint: 'Ctrl+Y', keywords: 'redo', run: doRedo },
      { label: 'Export(書き出し)', keywords: 'export zip download', run: () => { saveNow(); openExport(store.project); } },
      { label: 'プロジェクト全体を検索', hint: 'Ctrl+Shift+F', keywords: 'search find grep', run: () => openSearch() },
      { label: 'Snippets(実装テンプレ)を開く', keywords: 'snippet template テンプレ', run: lazy('./views/snippets.js', 'openSnippets') },
      { label: '処理データを読み込む(AI の JSON)', keywords: 'import process json ai', run: lazy('./views/process.js', 'openProcessImport') },
      { label: '処理データを書き出す(読みやすい JSON)', keywords: 'export process json', run: lazy('./views/process.js', 'openProcessExport') },
      { label: 'プロジェクト設定', keywords: 'settings', run: settings },
      { label: 'プロジェクトファイル(.json)を書き出し', run: () => download((p.name || 'project') + '.codiram.json', JSON.stringify(p, null, 2), 'application/json') });
    GeneratorRegistry.list().filter((g) => p.targets.some((c) => c.type === g.id) && g.id !== activeTargetId(p)).forEach((g) => list.push({ label: tf('ターゲットを {0} に切り替え', L(g.name)), keywords: 'target generator ' + g.id, run: () => { setActiveTarget(g.id); nav.go(viewsOf().includes(ui.view) ? ui.view : 'logic'); renderTopbar(); } }));
  }
  list.push(
    { label: '新しいプロジェクト', keywords: 'new project', run: () => { if (store.project) saveNow(); newDialog(); } },
    { label: 'プロジェクト一覧', keywords: 'projects start home', run: () => { if (store.project) saveNow(); nav.go('start'); } },
    { label: 'Generator Library(Generator の一覧・管理)', keywords: 'generator library import export validate', run: lazy('./views/library.js', 'openLibrary') },
    { label: 'Generator Builder(Generator を作る)', keywords: 'generator builder definition', run: lazy('./views/builder.js', 'openBuilder') },
    { label: 'AI Export(AI 向け参考資料 ZIP)', keywords: 'ai export pack', run: () => { download('codiram-ai-pack.zip', makeZip(buildAiPack({ generatorId: store.project ? activeTargetId(store.project) : 'web', project: store.project })), 'application/zip'); toast('AI パックを書き出しました'); } },
    { label: 'プラグイン', keywords: 'plugins', run: () => openPlugins(() => mount()) },
    { label: 'キーボードショートカット', keywords: 'keyboard shortcuts', run: () => openShortcuts() },
    { label: '言語を切り替え(日本語 / English)', keywords: 'language', run: () => { setLang(getLang() === 'ja' ? 'en' : 'ja'); mount(); renderTopbar(); } },
    { label: 'ライト / ダークを切り替え', keywords: 'theme dark light', run: () => { theme = theme === 'dark' ? 'light' : 'dark'; applyTheme(theme); renderTopbar(); } });
  return list;
}
const toolsMenu = (e) => { const cmds = commands(); menu(e.currentTarget, [{ label: 'コマンドパレット…', hint: 'Ctrl+K', onClick: () => openPalette(commands()) }, { sep: true }, ...cmds.filter((c) => !/切り替え|画面へ移動|^保存|やり直し|元に戻す/.test(L(c.label))).map((c) => ({ label: L(c.label), hint: c.hint, onClick: c.run }))]); };

const toolBtns = () => [
  h('button', { class: 'icon-btn', title: 'Search (Ctrl+Shift+F)', disabled: !store.project || ui.view === 'start', onclick: () => openSearch() }, '🔎'),
  h('button', { class: 'icon-btn', title: 'Tools / Command palette (Ctrl+K)', onclick: toolsMenu }, '🧰'),
  h('button', { class: 'icon-btn', title: 'Plugins', onclick: () => openPlugins(() => { mount(); }) }, '🧩'),
  h('button', { class: 'icon-btn', title: 'Keyboard Shortcuts', onclick: () => openShortcuts() }, '⌨'),
];

const langBtn = () => h('button', { class: 'btn small lang-btn', title: 'Language / 言語', onclick: (e) => menu(e.currentTarget, LANGS.map((l) => ({ label: (l.id === getLang() ? '✓ ' : '　') + l.label, onClick: () => { setLang(l.id); mount(); renderTopbar(); } }))) }, '🌐 ' + (LANGS.find((l) => l.id === getLang())?.label || ''));

const themeBtn = () => h('button', { class: 'icon-btn', title: 'ライト/ダーク切替', onclick: () => { theme = theme === 'dark' ? 'light' : 'dark'; applyTheme(theme); renderTopbar(); } }, theme === 'dark' ? '☀' : '☾');

function historyMenu(anchor) {
  const st = store.undoStack;
  if (!st.length) { toast('履歴はまだありません'); return; }
  menu(anchor, st.map((e, i) => ({ label: e.label, hint: '', i })).reverse().slice(0, 25)
    .map((it) => ({ label: `${it.i + 1}. ${histLabel(it.label)}`, hint: it.i === st.length - 1 ? '最新' : '', onClick: () => { jumpTo(it.i); toast('履歴を戻しました'); } })));
}

function projectMenu(anchor) {
  const recent = listProjects().filter((x) => x.id !== store.project.id).slice(0, 5);
  menu(anchor, [
    { label: 'New…', onClick: () => { saveNow(); newDialog(); } },
    { label: 'Open (一覧)', onClick: () => { saveNow(); nav.go('start'); } },
    { label: 'Save', hint: 'Ctrl+S', onClick: () => { saveNow(); toast('✓ 保存しました'); } },
    { label: 'Save As…', onClick: async () => { const n = await promptText('名前を付けて保存', store.project.name + ' (copy)'); if (n) { saveAs(n); renderTopbar(); toast('保存しました'); nav.go(ui.view); } } },
    { label: 'Project Settings…', onClick: settings },
    { sep: true },
    { label: 'プロジェクトファイル(.json)を書き出し', onClick: () => download((store.project.name || 'project') + '.codiram.json', JSON.stringify(store.project, null, 2), 'application/json') },
    { label: 'プロジェクトファイルを読み込み…', onClick: importFile },
    ...(recent.length ? [{ sep: true }, ...recent.map((r) => ({ label: r.name, hint: fmtDate(r.updated), onClick: () => { saveNow(); openProject(r.id); nav.go('design'); } }))] : []),
  ]);
}

async function settings() {
  const p = store.project;
  if (activeTargetId(p) !== 'web') { openTargetSettings(activeTargetId(p), { onDone: () => nav.go(ui.view) }); return; }
  const st = { ...(p.settings || {}) };
  const name = h('input', { class: 'inp', value: p.name }), title = h('input', { class: 'inp', value: st.title || p.name });
  const desc = h('input', { class: 'inp', value: st.description || '' }), fav = h('input', { class: 'inp', value: st.favicon || '', placeholder: '🎮' });
  const fontHolder = h('div', {});
  const drawFont = () => { fontHolder.textContent = ''; fontHolder.append(fontSelect(st.font || '', (v) => { st.font = v; drawFont(); })); };
  drawFont();
  const langSel = h('select', { class: 'sel', onchange: (e) => { st.appLang = e.target.value; } }, LANGS.map((l) => h('option', { value: l.id, selected: l.id === (st.appLang || 'ja') }, l.label)));
  const cmSel = h('select', { class: 'sel', onchange: (e) => { st.commentLang = e.target.value; } }, [['auto', '自動(表示言語に合わせる)'], ['ja', '日本語'], ['en', 'English']].map(([v, l]) => h('option', { value: v, selected: (st.commentLang || 'auto') === v }, l)));
  const css = h('textarea', { class: 'inp mono', rows: 5, placeholder: '/* 例: .cx-button { letter-spacing: 1px } */' }); css.value = st.customCss || '';
  const js = h('textarea', { class: 'inp mono', rows: 5, placeholder: '// 例: document.title = "Hello";  (vars / data / setVar() が使えます)' }); js.value = st.customJs || '';
  const sec = (title, open, ...kids) => h('details', { class: 'pgroup', open }, h('summary', {}, title), h('div', { class: 'form', style: { padding: '8px 4px 12px' } }, kids));
  const ok = await dialog({ title: 'Project Settings', wide: true, body: h('div', {},
    sec('General', true, h('label', {}, 'プロジェクト名', name), h('label', {}, 'アプリのタイトル (HTML <title>)', title), h('label', {}, 'アプリの説明 (meta description)', desc),
      h('label', {}, 'ファビコン(絵文字1文字)', fav), h('label', {}, '完成アプリの言語 (<html lang>)', langSel), h('label', {}, '生成コードのコメントの言語', cmSel)),
    sec('Appearance', true, h('label', {}, 'アプリ全体のフォント (Google Fonts / 内蔵フォント)', fontHolder),
      h('label', {}, '背景色', colorField(st.bg, (v) => { st.bg = v; })), h('label', {}, '文字色', colorField(st.textColor, (v) => { st.textColor = v; })),
      h('label', {}, 'メインカラー(ボタン・タブ)', colorField(st.primary, (v) => { st.primary = v; }))),
    sec('Advanced', false, h('p', { class: 'muted small' }, 'GUIでは難しい特殊処理のためのコード挿入口です。Export したファイルにそのまま追記されます。'),
      h('label', {}, 'カスタム CSS (style.css の末尾に追加)', css), h('label', {}, 'カスタム JavaScript (app.js の末尾に追加)', js))),
    actions: [{ label: 'キャンセル', value: false }, { label: 'OK', primary: true, value: 'ok' }] });
  if (ok !== 'ok') return;
  const { commit } = await import('./store.js');
  commit('Project settings', (pp) => {
    pp.name = name.value.trim() || pp.name;
    pp.settings = { ...pp.settings, ...st, title: title.value.trim(), description: desc.value.trim(), favicon: fav.value.trim(), customCss: css.value, customJs: js.value };
  });
}

// ---------- keyboard ----------
document.addEventListener('keydown', (e) => {
  if (matchAction(e, 'save')) { e.preventDefault(); if (store.project) { saveNow(); toast('✓ 保存しました'); } return; }
  if (matchAction(e, 'run')) { e.preventDefault(); if (store.project) nav.run(); return; }
  if (matchAction(e, 'palette')) { e.preventDefault(); openPalette(commands()); return; }
  if (matchAction(e, 'globalsearch')) { e.preventDefault(); if (store.project && ui.view !== 'start') openSearch(); return; }
  if (matchAction(e, 'search')) {
    const s = document.querySelector('[data-search]');
    if (s) { e.preventDefault(); s.focus(); s.select(); }
    return;
  }
  if (isTypingTarget(e.target) || document.querySelector('.overlay')) return;
  if (!store.project || ui.view === 'start') return;
  for (const v of ['design', 'data', 'logic', 'preview']) if (matchAction(e, v)) { e.preventDefault(); nav.go(v); return; }
  if (matchAction(e, 'redo')) { e.preventDefault(); doRedo(); return; }
  if (matchAction(e, 'undo')) { e.preventDefault(); doUndo(); return; }
  let handled = false;
  if (ui.view === 'design') handled = designKey(e);
  else if (ui.view === 'logic') handled = logicKey(e);
  if (handled) e.preventDefault();
});

// drop a file anywhere: project (.json) / process data / generator definition / snippets are recognised by their content
addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
addEventListener('drop', async (e) => {
  const file = e.dataTransfer?.files?.[0];
  if (!file || !/\.json$/i.test(file.name)) return;
  e.preventDefault();
  try {
    const text = await file.text(), d = JSON.parse(text);
    if (d.format === 'codiram-process') { if (store.project && ui.view !== 'start') { const { openProcessImport } = await import('./views/process.js'); await openProcessImport(text); } else toast('先にプロジェクトを開いてください'); }
    else if (d.format === 'codiram-generator') { const { importIntoLibrary } = await import('./sdk/library.js'); const r = importIntoLibrary([text]); toast(`Generator「${r.id}」を ${r.action} しました`); renderTopbar(); }
    else if (d.format === 'codiram-snippets') { const { importSnippets } = await import('./snippets.js'); toast(`${importSnippets(text)} 件のテンプレを読み込みました`); }
    else if (d.pages && d.models) { const { importProject } = await import('./store.js'); importProject(text); nav.go('design'); toast('プロジェクトを読み込みました'); }
    else toast('Codiram のファイルとして認識できませんでした');
  } catch (err) { toast('読み込めません: ' + err.message); }
});

addEventListener('beforeunload', () => { if (store.project) saveNow(); });

loadUserGenerators().forEach((f) => console.warn('Generator not loaded:', f.id, f.error));
loadInstalledPlugins().finally(() => { mount(); renderTopbar(); });
ui.settingsHook = settings;
window.__codiram = { store, ui, nav, emit };

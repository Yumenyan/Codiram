// Codiram — entry point: top bar, view switching, global shortcuts.
import './components.js';
import './blocks.js';
import { h, download, isTypingTarget, fmtDate } from './util.js';
import { store, ui, subscribe, emit, undo, redo, jumpTo, saveNow, nav, saveAs, newProject, listProjects, openProject } from './store.js';
import { lint } from './model.js';
import { menu, toast, dialog, promptText } from './ui-kit.js';
import { renderStart, newDialog, importFile } from './views/start.js';
import { renderDesign, designKey } from './views/design.js';
import { renderData } from './views/data.js';
import { renderLogic, logicKey } from './views/logic.js';
import { renderPreview, run as runPreview } from './views/preview.js';
import { openExport } from './export.js';

const topbar = document.getElementById('topbar');
const main = document.getElementById('main');
const VIEWS = ['design', 'data', 'logic', 'preview'];
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
}

nav.go = (view) => {
  if (view !== 'start' && !store.project) view = 'start';
  ui.view = view;
  mount();
  renderTopbar();
};
nav.run = () => { if (ui.view === 'preview') runPreview(); else nav.go('preview'); };
nav.undo = () => doUndo();

function doUndo() { const l = undo(); if (l === false) toast('これ以上戻せません'); else toast('↶ 元に戻しました: ' + l); }
function doRedo() { const l = redo(); if (l === false) toast('やり直す操作がありません'); else toast('↷ やり直しました: ' + l); }

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
  el.textContent = m[0]; el.className = 'status ' + m[1];
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
    topbar.append(h('span', { class: 'sp' }), themeBtn());
    return;
  }
  const probs = lint(p).length + ui.errors.length;
  topbar.append(
    h('button', { class: 'proj-btn', onclick: (e) => projectMenu(e.currentTarget) }, h('span', {}, p.name), h('small', {}, ' ▾')),
    h('span', { id: 'save-status', class: 'status' }),
    h('button', { class: 'icon-btn', title: 'Undo (Ctrl+Z)', disabled: !store.undoStack.length, onclick: doUndo }, '↶'),
    h('button', { class: 'icon-btn', title: 'Redo (Ctrl+Y)', disabled: !store.redoStack.length, onclick: doRedo }, '↷'),
    h('button', { class: 'icon-btn', title: '履歴 History', onclick: (e) => historyMenu(e.currentTarget) }, '🕘'),
    h('nav', { class: 'nav', role: 'tablist' }, VIEWS.map((v) => h('button', { class: 'nav-tab' + (ui.view === v ? ' on' : ''), role: 'tab', 'aria-selected': ui.view === v, onclick: () => nav.go(v) },
      v[0].toUpperCase() + v.slice(1), v === 'logic' && probs ? h('b', { class: 'warn', title: probs + ' 件の問題' }, ' ⚠' + probs) : null))),
    h('span', { class: 'sp' }),
    h('button', { class: 'btn run', title: 'Run (F5)', onclick: () => nav.run() }, '▶ Run'),
    h('button', { class: 'btn', title: 'Export', onclick: () => { saveNow(); openExport(store.project); } }, '⬇ Export'),
    themeBtn());
  updateStatus();
}

const themeBtn = () => h('button', { class: 'icon-btn', title: 'ライト/ダーク切替', onclick: () => { theme = theme === 'dark' ? 'light' : 'dark'; applyTheme(theme); renderTopbar(); } }, theme === 'dark' ? '☀' : '☾');

function historyMenu(anchor) {
  const st = store.undoStack;
  if (!st.length) { toast('履歴はまだありません'); return; }
  menu(anchor, st.map((e, i) => ({ label: `${i + 1}. ${e.label}`, hint: '', i })).reverse().slice(0, 25)
    .map((it) => ({ label: it.label, hint: it.i === st.length - 1 ? '最新' : '', onClick: () => { jumpTo(it.i); toast('履歴を戻しました'); } })));
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
  const name = h('input', { class: 'inp', value: p.name }), title = h('input', { class: 'inp', value: p.settings?.title || p.name });
  const ok = await dialog({ title: 'Project Settings', body: h('div', { class: 'form' }, h('label', {}, 'プロジェクト名', name), h('label', {}, 'アプリのタイトル (HTML <title>)', title)),
    actions: [{ label: 'キャンセル', value: false }, { label: 'OK', primary: true, value: 'ok' }] });
  if (ok !== 'ok') return;
  const { commit } = await import('./store.js');
  commit('Project settings', (pp) => { pp.name = name.value.trim() || pp.name; pp.settings = { ...pp.settings, title: title.value.trim() }; });
}

// ---------- keyboard ----------
document.addEventListener('keydown', (e) => {
  const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (ctrl && k === 's') { e.preventDefault(); if (store.project) { saveNow(); toast('✓ 保存しました'); } return; }
  if (e.key === 'F5') { e.preventDefault(); if (store.project) nav.run(); return; }
  if (ctrl && k === 'f') {
    const s = document.querySelector('[data-search]');
    if (s) { e.preventDefault(); s.focus(); s.select(); }
    return;
  }
  if (isTypingTarget(e.target) || document.querySelector('.overlay')) return;
  if (!store.project || ui.view === 'start') return;
  if (ctrl && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); doRedo(); return; }
  if (ctrl && k === 'z') { e.preventDefault(); doUndo(); return; }
  let handled = false;
  if (ui.view === 'design') handled = designKey(e);
  else if (ui.view === 'logic') handled = logicKey(e);
  if (handled) e.preventDefault();
});

addEventListener('beforeunload', () => { if (store.project) saveNow(); });

mount();
renderTopbar();
window.__codiram = { store, ui, nav, emit };

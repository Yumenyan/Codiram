// Start screen: My Projects + templates.
import { h, fmtDate } from '../util.js';
import { listProjects, openProject, newProject, deleteProject, duplicateProject, importProject, nav } from '../store.js';
import { TEMPLATES } from '../templates.js';
import { confirmDlg, dialog, toast } from '../ui-kit.js';

export function renderStart(root) {
  root.className = 'view start';
  root.textContent = '';
  const projects = listProjects();
  const open = (id) => { if (openProject(id)) nav.go('design'); else toast('プロジェクトを開けませんでした'); };
  root.append(h('div', { class: 'start-inner' },
    h('h1', {}, 'My Projects'),
    h('p', { class: 'muted' }, 'データ → UI → ロジック → 完成したWebアプリ。すべてGUIで、Exportすれば普通のWebアプリとして使えます。'),
    h('div', { class: 'cards' },
      h('button', { class: 'card new', onclick: newDialog }, h('span', { class: 'plus' }, '＋'), 'New Project'),
      projects.map((p) => h('div', { class: 'card', tabindex: 0, onclick: () => open(p.id), onkeydown: (e) => { if (e.key === 'Enter') open(p.id); } },
        h('b', {}, p.name), h('span', { class: 'muted small' }, fmtDate(p.updated)),
        h('span', { class: 'card-actions' },
          h('button', { class: 'mini', title: '複製', onclick: (e) => { e.stopPropagation(); duplicateProject(p.id); renderStart(root); } }, '⧉'),
          h('button', { class: 'mini', title: '削除', onclick: async (e) => { e.stopPropagation(); if (await confirmDlg('プロジェクトを削除', `「${p.name}」を完全に削除します。`, '削除')) { deleteProject(p.id); renderStart(root); } } }, '🗑'))))),
    h('div', { class: 'row-gap' }, h('button', { class: 'btn', onclick: importFile }, '⬆ プロジェクトファイル(.json)を読み込む'))));
}

export async function newDialog() {
  let chosen = 'blank';
  const box = h('div', { class: 'tpl-list' });
  const draw = () => { box.textContent = ''; TEMPLATES.forEach((t) => box.append(h('button', { class: 'tpl' + (t.id === chosen ? ' on' : ''), onclick: () => { chosen = t.id; draw(); } }, h('b', {}, t.name), h('span', { class: 'muted small' }, t.desc)))); };
  draw();
  const ok = await dialog({ title: 'New Project — テンプレートを選択', body: box, actions: [{ label: 'キャンセル', value: false }, { label: '作成', primary: true, value: 'ok' }] });
  if (ok === 'ok') { newProject(TEMPLATES.find((t) => t.id === chosen)); nav.go('design'); }
}

export function importFile() {
  const inp = h('input', { type: 'file', accept: '.json,application/json' });
  inp.onchange = async () => {
    try { importProject(await inp.files[0].text()); nav.go('design'); } catch (e) { toast('読み込みに失敗: ' + e.message); }
  };
  inp.click();
}

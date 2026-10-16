// Start screen: My Projects + templates.
import { h, fmtDate } from '../util.js';
import { listProjects, openProject, newProject, deleteProject, duplicateProject, importProject, nav } from '../store.js';
import { TEMPLATES } from '../templates.js';
import { emptyProject } from '../model.js';
import { confirmDlg, dialog, toast } from '../ui-kit.js';
import { tf, L } from '../i18n.js';
import { targets, GeneratorRegistry } from '../registry.js';

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
        h('b', {}, (targets.get(p.target)?.icon || '🌐') + ' ' + p.name), h('span', { class: 'muted small' }, fmtDate(p.updated)),
        h('span', { class: 'card-actions' },
          h('button', { class: 'mini', title: '複製', onclick: (e) => { e.stopPropagation(); duplicateProject(p.id); renderStart(root); } }, '⧉'),
          h('button', { class: 'mini', title: '削除', onclick: async (e) => { e.stopPropagation(); if (await confirmDlg('プロジェクトを削除', tf('「{0}」を完全に削除します。', p.name), '削除')) { deleteProject(p.id); renderStart(root); } } }, '🗑'))))),
    h('div', { class: 'row-gap' }, h('button', { class: 'btn', onclick: importFile }, '⬆ プロジェクトファイル(.json)を読み込む'),
      h('button', { class: 'btn', onclick: async () => { const { openBuilder } = await import('./builder.js'); await openBuilder(); } }, '🛠 Generator Builder'))));
}

export async function newDialog() {
  let target = 'web', chosen = null, name = '', nameTouched = false;
  const box = h('div', {});
  /** templates written for the generator itself, or Web templates for generators that wrap the Web app (Desktop) */
  const list = () => {
    const gen = targets.get(target);
    const fit = TEMPLATES.filter((t) => (t.target || 'web') === target || (gen?.inherits === (t.target || 'web') && (t.target || 'web') === 'web')
      || (t.requires && gen && t.requires.every((c) => gen.supports.includes(c))));
    return fit.length ? fit : [{ id: 'blank-' + target, name: 'Blank', desc: '空のプロジェクト', build: () => emptyProject('Untitled Project', { ...gen.defaultConfig('my_app', 'My App') }) }];
  };
  const draw = () => {
    box.textContent = '';
    if (!list().some((t) => t.id === chosen)) chosen = list()[0]?.id;
    if (!nameTouched) name = list().find((t) => t.id === chosen)?.name || '';
    box.append(h('div', { class: 'target-cards' }, GeneratorRegistry.list().map((t) => h('button', { class: 'target-card' + (t.id === target ? ' on' : ''), onclick: () => { target = t.id; draw(); } },
      h('b', {}, t.icon + ' ' + L(t.name)), h('span', { class: 'muted small' }, L(t.desc))))));
    box.append(h('div', { class: 'form', style: { marginBottom: '12px' } }, h('label', {}, 'プロジェクト名', h('input', { class: 'inp', value: name, oninput: (e) => { name = e.target.value; nameTouched = true; } }))));
    const tl = h('div', { class: 'tpl-list' });
    list().forEach((t) => tl.append(h('button', { class: 'tpl' + (t.id === chosen ? ' on' : ''), onclick: () => { chosen = t.id; draw(); } }, h('b', {}, t.name), h('span', { class: 'muted small' }, t.desc))));
    box.append(tl);
  };
  draw();
  const ok = await dialog({ title: 'New Project — ターゲットとテンプレートを選択', wide: true, body: box, actions: [{ label: 'キャンセル', value: false }, { label: '作成', primary: true, value: 'ok' }] });
  if (ok === 'ok') {
    newProject(list().find((t) => t.id === chosen), { name, targetId: target });
    nav.go(targets.get(target)?.views.includes('design') ? 'design' : 'logic');
  }
}

export function importFile() {
  const inp = h('input', { type: 'file', accept: '.json,application/json' });
  inp.onchange = async () => {
    try { importProject(await inp.files[0].text()); nav.go('design'); } catch (e) { toast('読み込みに失敗: ' + e.message); }
  };
  inp.click();
}

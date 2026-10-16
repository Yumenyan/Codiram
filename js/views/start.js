// Start screen: My Projects + templates.
import { h, fmtDate } from '../util.js';
import { listProjects, openProject, newProject, deleteProject, duplicateProject, importProject, nav } from '../store.js';
import { TEMPLATES } from '../templates.js';
import { confirmDlg, dialog, toast } from '../ui-kit.js';
import { tf, L } from '../i18n.js';
import { targets } from '../registry.js';
import { validateMcConfig, defaultMcConfig } from '../targets/minecraft/index.js';

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
    h('div', { class: 'row-gap' }, h('button', { class: 'btn', onclick: importFile }, '⬆ プロジェクトファイル(.json)を読み込む'))));
}

export async function newDialog() {
  let target = 'web', chosen = null;
  const cfg = { modId: 'hello_mod', modName: 'Hello Mod' };
  let idTouched = false;
  const box = h('div', {});
  const errs = h('div', { class: 'errs' });
  const list = () => TEMPLATES.filter((t) => (t.target || 'web') === target);
  const draw = () => {
    box.textContent = '';
    if (!list().some((t) => t.id === chosen)) chosen = list()[0]?.id;
    box.append(h('div', { class: 'target-cards' }, [...targets.values()].map((t) => h('button', { class: 'target-card' + (t.id === target ? ' on' : ''), onclick: () => { target = t.id; draw(); } },
      h('b', {}, t.icon + ' ' + L(t.name)), h('span', { class: 'muted small' }, L(t.desc))))));
    if (target === 'minecraft') {
      const name = h('input', { class: 'inp', value: cfg.modName, oninput: (e) => { cfg.modName = e.target.value; if (!idTouched) { cfg.modId = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'my_mod'; id.value = cfg.modId; } } });
      const id = h('input', { class: 'inp mono', value: cfg.modId, oninput: (e) => { idTouched = true; cfg.modId = e.target.value; } });
      box.append(h('div', { class: 'form', style: { marginBottom: '12px' } }, h('label', {}, 'Mod 名', name), h('label', {}, 'Mod ID(半角英小文字・数字・_ / ファイル名やゲーム内IDになります)', id)), errs);
    }
    const tl = h('div', { class: 'tpl-list' });
    list().forEach((t) => tl.append(h('button', { class: 'tpl' + (t.id === chosen ? ' on' : ''), onclick: () => { chosen = t.id; draw(); } }, h('b', {}, t.name), h('span', { class: 'muted small' }, t.desc))));
    box.append(tl);
  };
  draw();
  const ok = await dialog({ title: 'New Project — ターゲットとテンプレートを選択', wide: true, body: box, actions: [{ label: 'キャンセル', value: false }, { label: '作成', primary: true, value: 'ok', onClick: () => {
    if (target !== 'minecraft') return true;
    const problems = validateMcConfig({ ...defaultMcConfig(cfg.modId, cfg.modName), modId: cfg.modId, modName: cfg.modName, package: 'com.example.' + cfg.modId.replace(/_/g, '') });
    errs.textContent = problems.join(' / ');
    return problems.length ? false : true;
  } }] });
  if (ok === 'ok') {
    newProject(TEMPLATES.find((t) => t.id === chosen), { modId: cfg.modId, modName: cfg.modName });
    nav.go(target === 'minecraft' ? 'logic' : 'design');
  }
}

export function importFile() {
  const inp = h('input', { type: 'file', accept: '.json,application/json' });
  inp.onchange = async () => {
    try { importProject(await inp.files[0].text()); nav.go('design'); } catch (e) { toast('読み込みに失敗: ' + e.message); }
  };
  inp.click();
}

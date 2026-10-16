// Global search dialog (Ctrl+Shift+F).
import { h, debounce } from '../util.js';
import { dialog } from '../ui-kit.js';
import { store, ui, nav } from '../store.js';
import { searchProject, KIND_ICON } from '../search.js';
import { gotoBlock } from './logic.js';

/** jump to a search result */
export function goTo(where) {
  if (where.view === 'design') { ui.pageId = where.page; ui.selNode = where.node || null; nav.go('design'); }
  else if (where.view === 'logic') gotoBlock(where.script, where.block || null);
  else if (where.view === 'data') { ui.selModel = where.model; nav.go('data'); }
  else if (where.view === 'settings') ui.settingsHook?.();
}

export async function openSearch(initial = '') {
  const input = h('input', { class: 'inp', placeholder: 'プロジェクト全体を検索(部品・ブロック・変数・データ・設定)/ Search the whole project', value: initial, style: { width: '100%' } });
  const list = h('div', { class: 'search-results' });
  let results = [], sel = 0, resolve;
  const jump = (r) => { if (!r) return; document.querySelector('.overlay .dialog-head button')?.click(); goTo(r.where); };
  const draw = () => {
    list.textContent = '';
    if (!input.value.trim()) { list.append(h('div', { class: 'muted pad' }, '文字を入力すると、部品・スクリプト・ブロックの中身・変数・データ・設定をまとめて探します。')); return; }
    if (!results.length) { list.append(h('div', { class: 'muted pad' }, '見つかりません')); return; }
    let lastKind = '';
    results.forEach((r, i) => {
      list.append(h('button', { class: 'sr' + (i === sel ? ' on' : ''), onclick: () => jump(r), onmousemove: () => { sel = i; } },
        h('span', { class: 'sr-ico' }, KIND_ICON[r.kind] || '·'), h('b', {}, r.label), h('span', { class: 'muted small' }, r.detail)));
      lastKind = r.kind;
    });
    void lastKind;
    list.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  };
  const run = debounce(() => { results = searchProject(store.project, input.value); sel = 0; draw(); }, 80);
  input.addEventListener('input', run);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(results.length - 1, sel + 1); draw(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
    else if (e.key === 'Enter') { e.preventDefault(); jump(results[sel]); }
  });
  void resolve;
  if (initial) run(); else draw();
  await dialog({ title: '🔎 Search', wide: true, body: h('div', { class: 'search' }, input, list), actions: [] });
}

// Snippet dialog: insert common processing, save the selected blocks as your own, import / export.
import { h, download } from '../util.js';
import { dialog, toast, promptText, confirmDlg } from '../ui-kit.js';
import { L } from '../i18n.js';
import { store, ui, commit } from '../store.js';
import { allSnippets, insertSnippet, saveSnippet, deleteSnippet, exportSnippets, importSnippets, outline, userSnippets } from '../snippets.js';
import { findBlock } from '../model.js';

export async function openSnippets({ onInsert } = {}) {
  let sel = allSnippets()[0]?.id, filter = '';
  const body = h('div', { class: 'snippets' });
  const selectedBlocks = () => {
    const sc = store.project.scripts.find((x) => x.id === ui.selScript);
    return sc ? [...ui.selBlocks].map((id) => findBlock(sc, id)?.block).filter(Boolean) : [];
  };
  const close = () => document.querySelector('.overlay .dialog-head button')?.click();
  const draw = () => {
    const list = allSnippets().filter((s) => !filter || (L(s.name) + L(s.desc)).toLowerCase().includes(filter.toLowerCase()));
    const cur = list.find((s) => s.id === sel) || list[0];
    body.textContent = '';
    body.append(
      h('div', { class: 'sn-top' },
        h('input', { class: 'inp', placeholder: '検索 / Filter', value: filter, oninput: (e) => { filter = e.target.value; draw(); body.querySelector('input').focus(); } }),
        h('button', { class: 'btn small', title: 'Logic で選択中のブロックをテンプレとして登録', onclick: async () => {
          const blocksSel = selectedBlocks();
          if (!blocksSel.length) { toast('Logic でブロックを選んでから開いてください(Ctrl+クリックで複数選択)'); return; }
          const name = await promptText('テンプレに登録', '', '名前');
          if (name) { saveSnippet(name, blocksSel, store.project); toast('テンプレに登録しました'); draw(); }
        } }, '＋ 選択中のブロックを登録'),
        h('button', { class: 'btn small', onclick: () => { const u = userSnippets(); if (!u.length) { toast('自作のテンプレがありません'); return; } download('codiram-snippets.json', exportSnippets(u), 'application/json'); } }, '⬇ Export'),
        h('button', { class: 'btn small', onclick: () => { const i = h('input', { type: 'file', accept: '.json' }); i.onchange = async () => { try { toast(`${importSnippets(await i.files[0].text())} 件のテンプレを読み込みました`); draw(); } catch (e) { toast('読み込めません: ' + e.message); } }; i.click(); } }, '⬆ Import')),
      h('div', { class: 'sn-cols' },
        h('div', { class: 'sn-list' }, list.map((s) => h('button', { class: 'sn-item' + (s === cur ? ' on' : ''), onclick: () => { sel = s.id; draw(); } }, h('b', {}, (s.user ? '★ ' : '') + L(s.name)), h('span', { class: 'muted small' }, L(s.desc))))),
        cur ? h('div', { class: 'sn-detail' },
          h('h4', {}, L(cur.name)), h('p', { class: 'muted' }, L(cur.desc)),
          cur.vars?.length ? h('p', { class: 'small' }, '必要な変数(なければ自動作成): ', cur.vars.map((v) => `${v.name}:${v.type}`).join(', ')) : null,
          h('pre', { class: 'code' }, outline(cur.blocks).join('\n')),
          h('div', { class: 'sn-actions' },
            h('button', { class: 'btn primary', onclick: () => { insert(cur); } }, '↳ いまのスクリプトに追加'),
            cur.user ? h('button', { class: 'btn', onclick: async () => { if (await confirmDlg('テンプレを削除', `「${L(cur.name)}」を削除します。`, '削除')) { deleteSnippet(cur.id); sel = null; draw(); } } }, '🗑 削除') : null)) : h('div', { class: 'muted pad' }, '該当なし')));
  };
  const insert = (s) => {
    const last = [...ui.selBlocks].pop() || null;
    let id = null;
    commit('Insert snippet', (p) => { id = insertSnippet(p, s, ui.selScript, last); });
    if (!id) { toast('先に Logic でスクリプトを作成・選択してください'); return; }
    ui.selScript = id; ui.selBlocks.clear();
    close(); onInsert?.();
    toast(`「${L(s.name)}」を追加しました`);
  };
  draw();
  await dialog({ title: '📋 Snippets(実装テンプレ)', wide: true, body, actions: [{ label: '閉じる', primary: true, value: true }] });
}

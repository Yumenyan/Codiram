// Dialogs: keyboard shortcut customisation and plugin manager.
import { h } from '../util.js';
import { L } from '../i18n.js';
import { dialog, toast, confirmDlg } from '../ui-kit.js';
import { ACTIONS, bindings, setBinding, resetBindings, isCustom, comboOf } from '../shortcuts.js';
import { PACKS, packEnabled, setPackEnabled, installPlugin, uninstallPlugin, userPlugins } from '../plugins.js';
import { components, blocks } from '../registry.js';

export async function openShortcuts(onChange) {
  const body = h('div', {});
  const draw = () => {
    body.textContent = '';
    body.append(h('p', { class: 'muted small' }, 'ショートカットを変更するには「変更」を押して、割り当てたいキーの組み合わせを押します(Escでキャンセル)。'),
      h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, h('th', {}, '操作'), h('th', {}, 'キー'), h('th', {}))),
        h('tbody', {}, ACTIONS.map((a) => h('tr', {}, h('td', {}, L(a.label)), h('td', { class: 'mono' }, bindings(a.id).join('  /  ')),
          h('td', {}, h('button', { class: 'btn small', onclick: (e) => capture(e.currentTarget, a.id) }, '変更'),
            isCustom(a.id) ? h('button', { class: 'btn small', onclick: () => { setBinding(a.id, undefined); import('../shortcuts.js').then(() => draw()); } }, '既定') : null))))));
  };
  const capture = (btn, id) => {
    btn.textContent = 'キーを押してください…';
    const on = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (e.key === 'Escape') { cleanup(); draw(); return; }
      const c = comboOf(e);
      if (!c) return;
      setBinding(id, [c]);
      cleanup(); draw(); onChange?.();
    };
    const cleanup = () => document.removeEventListener('keydown', on, true);
    document.addEventListener('keydown', on, true);
  };
  draw();
  await dialog({ title: 'Keyboard Shortcuts', wide: true, body, actions: [
    { label: 'すべて既定に戻す', onClick: () => { resetBindings(); draw(); return false; } },
    { label: '閉じる', primary: true, value: true }] });
}

const EXAMPLE = `// my-plugin.js  — "プラグインを追加" で読み込みます
export default {
  id: 'hello', name: 'Hello Plugin',
  blocks: [{
    type: 'hello_alert', cat: 'UI', kind: 'stmt', icon: '👋', title: 'Helloを表示', en: 'Say hello',
    parts: ['Hello を表示する'], fields: {}, defaults: {},
    gen: () => ['showMessage("Hello!");'],       // 生成されるJavaScript(行の配列)
  }],
  // components: [{ type, label, cat, icon, defaults, props, render(node, ctx, kids) }],
  // modules: { name: 'function helper() {}' },   // 実行時に追加するコード(g.use('name') で有効化)
};`;

export async function openPlugins(onChange) {
  const body = h('div', {});
  const draw = () => {
    body.textContent = '';
    body.append(h('p', { class: 'muted small' }, '機能のまとまり(パック)をオン/オフできます。オフにしてもプロジェクト内の既存のブロック・部品は動作し続けます。'));
    PACKS.forEach((p) => body.append(h('label', { class: 'pack' },
      h('input', { type: 'checkbox', checked: packEnabled(p.id), onchange: (e) => { setPackEnabled(p.id, e.target.checked); onChange?.(); } }),
      h('span', {}, h('b', {}, L(p.name)), h('br'), h('span', { class: 'muted small' }, L(p.desc))))));
    body.append(h('h4', {}, 'インストール済みプラグイン'));
    const mine = userPlugins();
    if (!mine.length) body.append(h('div', { class: 'muted small' }, 'まだありません。'));
    mine.forEach((p) => body.append(h('div', { class: 'row-between' }, h('span', {}, h('b', {}, p.name || p.id), h('span', { class: 'muted small' }, ` (${(p.components || []).length} components, ${(p.blocks || []).length} blocks)`)),
      h('button', { class: 'btn small danger', onclick: () => { uninstallPlugin(p.id); toast('次回の起動時に無効になります'); draw(); } }, 'アンインストール'))));
    const input = h('input', { type: 'file', accept: '.js,.mjs', style: { display: 'none' }, onchange: async () => {
      const f = input.files[0];
      if (!f) return;
      if (!(await confirmDlg('プラグインの追加', 'プラグインは任意のJavaScriptを実行できます。信頼できるものだけを追加してください。', '追加'))) return;
      try { const p = await installPlugin(f.name, await f.text()); toast(`プラグイン「${p.name || p.id}」を追加しました`); onChange?.(); draw(); } catch (e) { toast('読み込みに失敗: ' + e.message); }
    } });
    body.append(h('div', { class: 'row-gap' }, h('button', { class: 'btn', onclick: () => input.click() }, '＋ プラグイン(.js)を追加'), input),
      h('details', {}, h('summary', {}, 'プラグインの書き方'), h('pre', { class: 'code' }, EXAMPLE)));
  };
  draw();
  await dialog({ title: 'Plugins', wide: true, body, actions: [{ label: '閉じる', primary: true, value: true }] });
}

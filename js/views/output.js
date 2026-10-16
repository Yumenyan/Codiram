// Output view: shows the code the active target generates, live. Used by targets without a Preview (e.g. Minecraft).
import { h, download } from '../util.js';
import { tf, L } from '../i18n.js';
import { store } from '../store.js';
import { activeTarget } from '../registry.js';
import { toast } from '../ui-kit.js';
import { openExport } from '../export.js';
import { gotoBlock } from './logic.js';

let cur = '';

export function renderOutput(root) {
  root.className = 'view output';
  root.textContent = '';
  const target = activeTarget(store.project);
  const res = target.generate(store.project);
  const names = Object.keys(res.files).filter((n) => typeof res.files[n] === 'string');
  if (!names.includes(cur)) cur = names.find((n) => n.endsWith('Handlers.java')) || names[0];
  const code = h('pre', { class: 'code out-code' }, res.files[cur] || '');
  const list = h('div', { class: 'file-list' }, names.map((n) => h('button', { class: 'layer' + (n === cur ? ' on' : ''), title: n, onclick: () => { cur = n; renderOutput(root); } }, n.split('/').pop())));
  const probs = res.problems.filter((p) => p.level !== 'info');
  const infos = res.problems.filter((p) => p.level === 'info');
  root.append(
    h('div', { class: 'toolbar' }, h('b', {}, tf('Output — {0}', L(target.name))), h('span', { class: 'sp' }),
      h('span', { class: 'muted small' }, 'Logic を編集すると、ここのコードが更新されます(読み取り専用)'),
      h('button', { class: 'btn small', onclick: async () => { await navigator.clipboard?.writeText(res.files[cur]); toast('コピーしました'); } }, 'コピー'),
      h('button', { class: 'btn small primary', onclick: () => openExport(store.project) }, '⬇ Export')),
    h('div', { class: 'output-body' },
      h('aside', { class: 'out-side' }, h('div', { class: 'panel-title' }, 'Files'), list,
        h('div', { class: 'panel-title' }, 'Problems', h('span', { class: probs.length ? 'badge warn' : 'badge' }, probs.length)),
        h('div', { class: 'problems' }, probs.length ? probs.map((p) => h('button', { class: 'problem', onclick: () => p.script && gotoBlock(p.script, p.block) }, h('span', {}, '⚠'), h('span', {}, p.msg))) : h('div', { class: 'muted pad small' }, '✓ 問題は見つかりません'),
          infos.map((p) => h('div', { class: 'muted pad small' }, 'ℹ ' + p.msg)))),
      code));
}

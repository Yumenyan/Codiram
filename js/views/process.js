// Process data: import (AI / hand written JSON -> blocks) and export (blocks -> readable JSON).
import { h, download } from '../util.js';
import { dialog, toast } from '../ui-kit.js';
import { store, commit, nav } from '../store.js';
import { readProcess, applyProcess, exportProcess, PROCESS_DOC } from '../process.js';

export async function openProcessImport(initialText = '') {
  const area = h('textarea', { class: 'inp mono', rows: 14, spellcheck: 'false', placeholder: '{ "format": "codiram-process", "version": 1, "scripts": [ ... ] }', style: { width: '100%' } });
  const status = h('div', { class: 'proc-status' });
  const replace = h('input', { type: 'checkbox' });
  let parsed = null;
  const check = () => {
    status.textContent = ''; parsed = null;
    if (!area.value.trim()) return;
    let data;
    try { data = JSON.parse(area.value); } catch (e) { status.append(h('div', { class: 'bad' }, '✗ JSON として読めません: ' + e.message)); return; }
    const r = readProcess(data, store.project);
    r.errors.forEach((m) => status.append(h('div', { class: 'bad' }, '✗ ' + m)));
    r.warnings.forEach((m) => status.append(h('div', { class: 'warn' }, '⚠ ' + m)));
    if (r.result) {
      parsed = r.result;
      status.append(h('div', { class: 'ok' }, `✓ 取り込めます: スクリプト ${r.result.scripts.length} / 変数 ${r.result.variables.length} / データモデル ${r.result.models.length}`));
    }
  };
  area.addEventListener('input', check);
  if (initialText) { area.value = initialText; check(); }
  const file = () => { const i = h('input', { type: 'file', accept: '.json,application/json' }); i.onchange = async () => { area.value = await i.files[0].text(); check(); }; i.click(); };
  const ok = await dialog({
    title: '⬆ 処理データを読み込む(AI が書いた JSON など)', wide: true,
    body: h('div', { class: 'process' },
      h('p', { class: 'muted small' }, 'AI や人が書いた「処理データ(JSON)」を貼り付けると、Codiram がブロックに変換して読みやすく並べます。書き方は AI Export の reference/process-format.md にあります。'),
      area, h('label', { class: 'cap' }, replace, '同じ名前のスクリプトは置き換える'), status,
      h('details', {}, h('summary', {}, '書き方の例'), h('pre', { class: 'code' }, PROCESS_DOC))),
    actions: [
      { label: 'ファイルを選ぶ', onClick: () => { file(); return false; } },
      { label: '閉じる', value: false },
      { label: '読み込む', primary: true, value: 'ok', onClick: () => { check(); if (!parsed) { toast('エラーを直してください'); return false; } } },
    ],
  });
  if (ok !== 'ok' || !parsed) return false;
  commit('Import process data', (p) => applyProcess(p, parsed, { replace: replace.checked }));
  toast(`スクリプト ${parsed.scripts.length} 件を読み込みました`, { label: '元に戻す', fn: () => nav.undo() });
  nav.go('logic');
  return true;
}

export async function openProcessExport() {
  const text = JSON.stringify(exportProcess(store.project), null, 2) + '\n';
  await dialog({
    title: '⬇ 処理データを書き出す(読みやすい JSON)', wide: true,
    body: h('div', {}, h('p', { class: 'muted small' }, '部品やページは名前で書かれた JSON です。AI に渡して修正してもらい、読み込み直せます。'), h('pre', { class: 'code', style: { maxHeight: '55vh', overflow: 'auto' } }, text)),
    actions: [
      { label: 'コピー', onClick: async () => { await navigator.clipboard?.writeText(text); toast('コピーしました'); return false; } },
      { label: '⬇ ファイルに保存', onClick: () => { download(`${store.project.name || 'process'}.process.json`, text, 'application/json'); return false; } },
      { label: '閉じる', primary: true, value: true },
    ],
  });
}

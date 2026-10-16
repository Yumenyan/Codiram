// Export dialog: shows generated files and downloads them as a ZIP.
import { h, download } from './util.js';
import { generate, bundleInline } from './generator.js';
import { makeZip } from './zip.js';
import { dialog, toast } from './ui-kit.js';

export async function openExport(project) {
  const files = generate(project);
  const names = Object.keys(files);
  let cur = 'index.html';
  const code = h('pre', { class: 'code' });
  const list = h('div', { class: 'file-list' });
  const show = (n) => {
    cur = n; code.textContent = typeof files[n] === 'string' ? (files[n] || '(empty)') : `(binary file, ${files[n].length} bytes)`;
    list.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.n === n));
  };
  names.forEach((n) => list.append(h('button', { class: 'layer', 'data-n': n, onclick: () => show(n) }, n)));
  show(cur);
  const slug = (project.name || 'app').replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-|-$/g, '') || 'app';
  await dialog({
    title: 'Export — 普通のWebプロジェクトとして書き出し', wide: true,
    body: h('div', { class: 'export' },
      h('p', { class: 'muted' }, 'HTML / CSS / JavaScript / JSON のみ。特定のエディタやサービスに依存しません。ZIP を展開して index.html を開くだけで動作します。'),
      h('div', { class: 'export-grid' }, list, code)),
    actions: [
      { label: '現在のファイルをコピー', onClick: async () => { if (typeof files[cur] === 'string') await navigator.clipboard?.writeText(files[cur]); toast('コピーしました'); return false; } },
      { label: '単一HTMLで保存', onClick: () => { download(`${slug}.html`, bundleInline(files, { assets: project.assets }), 'text/html'); toast('1ファイルのHTMLを書き出しました'); return false; } },
      { label: '閉じる', value: false },
      { label: '⬇ ZIP をダウンロード', primary: true, onClick: () => { download(`${slug}.zip`, makeZip(Object.fromEntries(Object.entries(files).map(([k, v]) => [`${slug}/${k}`, v])))); toast('ZIP を書き出しました'); } },
    ],
  });
}

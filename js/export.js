// Export dialog: shows generated files and downloads them as a ZIP.
import { h, download } from './util.js';
import { bundleInline } from './generator.js';
import { activeTarget } from './registry.js';
import { makeZip } from './zip.js';
import { dialog, toast } from './ui-kit.js';
import { tf } from './i18n.js';

export async function openExport(project) {
  const target = activeTarget(project);
  const res = target.generate(project);
  const files = res.files;
  const blocking = res.problems.filter((p) => p.level !== 'info');
  const names = Object.keys(files);
  let cur = names.includes('index.html') ? 'index.html' : (names.find((n) => n.endsWith('Handlers.java')) || names[0]);
  const code = h('pre', { class: 'code' });
  const list = h('div', { class: 'file-list' });
  const show = (n) => {
    cur = n; code.textContent = typeof files[n] === 'string' ? (files[n] || '(empty)') : `(binary file, ${files[n].length} bytes)`;
    list.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.n === n));
  };
  names.forEach((n) => list.append(h('button', { class: 'layer', 'data-n': n, onclick: () => show(n) }, n)));
  show(cur);
  const slug = res.root || (project.name || 'app').replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-|-$/g, '') || 'app';
  await dialog({
    title: target.id === 'web' ? 'Export — 普通のWebプロジェクトとして書き出し' : 'Export — 普通のプロジェクトとして書き出し', wide: true,
    body: h('div', { class: 'export' },
      target.id === 'web' ? h('p', { class: 'muted' }, 'HTML / CSS / JavaScript / JSON のみ。特定のエディタやサービスに依存しません。ZIP を展開して index.html を開くだけで動作します。')
        : h('p', { class: 'muted' }, '通常のプロジェクト(Gradle)として書き出します。Codiram 専用のランタイムには依存しません。README.md のビルド手順に従ってください。'),
      blocking.length ? h('div', { class: 'notice' }, tf('⚠ 未解決の問題が {0} 件あります(生成物が完全でない可能性): {1}', blocking.length, blocking.slice(0, 3).map((p) => p.msg).join(' / '))) : null,
      h('div', { class: 'export-grid' }, list, code)),
    actions: [
      { label: '現在のファイルをコピー', onClick: async () => { if (typeof files[cur] === 'string') await navigator.clipboard?.writeText(files[cur]); toast('コピーしました'); return false; } },
      ...(target.id === 'web' ? [{ label: '単一HTMLで保存', onClick: () => { download(`${slug}.html`, bundleInline(files, { assets: project.assets }), 'text/html'); toast('1ファイルのHTMLを書き出しました'); return false; } }] : []),
      { label: '閉じる', value: false },
      { label: '⬇ ZIP をダウンロード', primary: true, onClick: () => { download(`${slug}.zip`, makeZip(Object.fromEntries(Object.entries(files).map(([k, v]) => [`${slug}/${k}`, v])))); toast('ZIP を書き出しました'); } },
    ],
  });
}

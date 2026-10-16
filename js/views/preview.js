// Preview view: runs the generated app inside an iframe (separate from the editor).
import { h } from '../util.js';
import { store, ui, nav } from '../store.js';
import { generate, bundleInline } from '../generator.js';
import { findBlock } from '../model.js';
import { resolveErrors, gotoBlock } from './logic.js';

let root, frame, errBox, running = false, width = 'full';

export function renderPreview(container) {
  root = container;
  root.className = 'view preview';
  root.textContent = '';
  frame = h('iframe', { class: 'frame', title: 'Preview', sandbox: 'allow-scripts allow-modals' });
  errBox = h('div', { class: 'errbox' });
  root.append(
    h('div', { class: 'toolbar' },
      h('b', {}, 'Preview'),
      h('button', { class: 'btn small primary', onclick: run, title: 'F5' }, '▶ Restart'),
      h('button', { class: 'btn small', onclick: stop }, '■ Stop'),
      h('select', { class: 'sel', onchange: (e) => { width = e.target.value; sizeFrame(); } },
        [['full', 'Desktop'], ['768', 'Tablet 768'], ['390', 'Mobile 390']].map(([v, l]) => h('option', { value: v, selected: v === width }, l))),
      h('span', { class: 'sp' }),
      h('span', { class: 'muted small' }, 'Edit → Run → Use → Stop → Edit  (Preview のデータは保存されません)'),
      h('button', { class: 'btn small', onclick: () => nav.go('design') }, '✎ Edit')),
    h('div', { class: 'frame-wrap' }, frame),
    errBox);
  run();
}

function sizeFrame() { if (frame) frame.style.width = width === 'full' ? '100%' : width + 'px'; }

export function run() {
  if (!frame) return;
  ui.errors = [];
  const files = generate(store.project, { debug: true, persist: false });
  frame.srcdoc = bundleInline(files, { debug: true });
  running = true;
  sizeFrame();
  renderErrors();
}
export function stop() {
  if (!frame) return;
  frame.srcdoc = '<body style="font-family:sans-serif;color:#888;display:grid;place-items:center;height:100vh">■ Stopped</body>';
  running = false;
}

function renderErrors() {
  if (!errBox) return;
  errBox.textContent = '';
  if (!ui.errors.length) { errBox.style.display = 'none'; return; }
  errBox.style.display = 'block';
  errBox.append(h('b', {}, `⚠ ${ui.errors.length} 件のエラー`));
  ui.errors.forEach((e) => {
    const s = e.block ? store.project.scripts.find((x) => x.id === e.script) : null;
    errBox.append(h('div', { class: 'errrow' }, h('span', {}, e.message),
      e.block && e.script ? h('button', { class: 'btn small', onclick: () => gotoBlock(e.script, e.block) }, '該当ブロックへ移動') : null));
  });
}

addEventListener('message', (e) => {
  if (!e.data || e.data.codiram !== 'error') return;
  ui.errors.push({ block: e.data.block, message: e.data.message });
  resolveErrors();
  renderErrors();
  document.dispatchEvent(new CustomEvent('codiram-errors'));
});

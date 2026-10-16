// Preview view: runs the generated app inside an iframe (separate from the editor).
import { h } from '../util.js';
import { store, ui, nav } from '../store.js';
import { tf, t } from '../i18n.js';
import { generate, bundleInline } from '../generator.js';
import { findBlock } from '../model.js';
import { resolveErrors, gotoBlock } from './logic.js';

let root, frame, errBox, logBox, monBox, running = false, width = 'full';
const logs = [];
/** variable monitor: current values + history of changes (filled from the preview iframe) */
const watch = { current: new Map(), history: [], paused: false, started: 0 };

export function renderPreview(container) {
  root = container;
  root.className = 'view preview';
  root.textContent = '';
  frame = h('iframe', { class: 'frame', title: 'Preview', sandbox: 'allow-scripts allow-modals allow-forms allow-popups allow-downloads' });
  errBox = h('div', { class: 'errbox' });
  logBox = h('div', { class: 'logbox' });
  monBox = h('div', { class: 'monbox' });
  frame.addEventListener('load', () => { try { frame.contentWindow.focus(); } catch { /* ignore */ } }); // so keyboard games work immediately
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
    errBox,
    h('details', { class: 'console', open: true }, h('summary', {}, '変数モニター / Variables', h('button', { class: 'mini', onclick: (e) => { e.preventDefault(); watch.paused = !watch.paused; renderMonitor(); } }, watch.paused ? '▶ 再開' : '⏸ 一時停止'), h('button', { class: 'mini', onclick: (e) => { e.preventDefault(); watch.history.length = 0; watch.current.clear(); renderMonitor(); } }, 'クリア')), monBox),
    h('details', { class: 'console' }, h('summary', {}, 'Console', h('button', { class: 'mini', onclick: (e) => { e.preventDefault(); logs.length = 0; renderLogs(); } }, 'クリア')), logBox));
  renderLogs();
  renderMonitor();
  run();
}

function sizeFrame() { if (frame) frame.style.width = width === 'full' ? '100%' : width + 'px'; }

export function run() {
  if (!frame) return;
  ui.errors = [];
  watch.current.clear(); watch.history.length = 0; watch.started = Date.now(); renderMonitor();
  logs.length = 0;
  renderLogs();
  const files = generate(store.project, { debug: true, persist: false });
  frame.srcdoc = bundleInline(files, { debug: true, assets: store.project.assets });
  running = true;
  sizeFrame();
  renderErrors();
}
export function stop() {
  if (!frame) return;
  frame.srcdoc = '<body style="font-family:sans-serif;color:#888;display:grid;place-items:center;height:100vh">■ Stopped</body>';
  running = false;
}

function renderLogs() {
  if (!logBox) return;
  logBox.textContent = '';
  logs.slice(-200).forEach((l) => logBox.append(h('div', { class: 'logrow ' + l.level }, l.text)));
  logBox.parentElement.querySelector('summary').firstChild.textContent = t('Console') + ' (' + logs.length + ')';
  logBox.scrollTop = logBox.scrollHeight;
}

function renderErrors() {
  if (!errBox) return;
  errBox.textContent = '';
  if (!ui.errors.length) { errBox.style.display = 'none'; return; }
  errBox.style.display = 'block';
  errBox.append(h('b', {}, tf('⚠ {0} 件のエラー', ui.errors.length)));
  ui.errors.forEach((e) => {
    const s = e.block ? store.project.scripts.find((x) => x.id === e.script) : null;
    errBox.append(h('div', { class: 'errrow' }, h('span', {}, e.message),
      e.block && e.script ? h('button', { class: 'btn small', onclick: () => gotoBlock(e.script, e.block) }, '該当ブロックへ移動') : null));
  });
}

function renderMonitor() {
  if (!monBox) return;
  monBox.textContent = '';
  const cur = [...watch.current.entries()];
  monBox.append(
    h('div', { class: 'mon-vars' }, cur.length ? cur.map(([k, v]) => h('span', { class: 'mon-var', title: v }, h('b', {}, k), ' = ', h('code', {}, v.length > 40 ? v.slice(0, 40) + '…' : v))) : h('span', { class: 'muted small' }, '(変数がありません / 実行すると表示されます)')),
    h('div', { class: 'mon-hist' }, watch.history.slice(-100).reverse().map((c) => {
      const s = c.block && store.project.scripts.find((x) => c.block === 'hat:' + x.id || findBlock(x, c.block));
      return h('div', { class: 'mon-row' + (s ? ' link' : ''), onclick: () => s && gotoBlock(s.id, c.block.startsWith('hat:') ? null : c.block) },
        h('span', { class: 'muted small' }, ((c.t - watch.started) / 1000).toFixed(2) + 's'), h('b', {}, c.name), h('code', {}, (c.old === undefined ? '' : c.old + ' → ') + c.value), s ? h('span', { class: 'muted small' }, '↪ ' + (s.name || s.hat.type)) : null);
    })));
}

addEventListener('message', (e) => {
  if (e.data && e.data.codiram === 'var') {
    if (watch.paused) return;
    watch.current.set(e.data.name, e.data.value);
    if (e.data.old !== undefined) watch.history.push(e.data);
    if (watch.history.length > 500) watch.history.splice(0, 100);
    renderMonitor();
    return;
  }
  if (e.data && e.data.codiram === 'log') { logs.push({ level: e.data.level, text: e.data.text }); renderLogs(); return; }
  if (!e.data || e.data.codiram !== 'error') return;
  ui.errors.push({ block: e.data.block, message: e.data.message });
  resolveErrors();
  renderErrors();
  document.dispatchEvent(new CustomEvent('codiram-errors'));
});

// Design view: Components (left) | Canvas (center) | Properties (right)
import { h, esc, clone, sanitizeIdent } from '../util.js';
import { components } from '../registry.js';
import { CATS, COMING_SOON, renderNode, propSchema } from '../components.js';
import { store, ui, commit, nav, getLibrary, setLibrary } from '../store.js';
import { findNode, createNode, freshClone, isContainer, newPage, uniqueName, newScript, walk, allNodes, duplicatePage } from '../model.js';
import { promptText, menu, toast, confirmDlg } from '../ui-kit.js';
import { BASE_CSS } from '../components.js';
import { fontSelect } from './fontpicker.js';
import { fontStack, googleFontsUrl } from '../fonts.js';
import { keyframesCss, animationDecl } from '../animations.js';
import { L, tf, t } from '../i18n.js';
import { matchAction } from '../shortcuts.js';
import { componentVisible } from '../plugins.js';

let root, els = {}, search = '', device = 'full';
const proj = () => store.project;
const page = () => proj().pages.find((p) => p.id === ui.pageId) || proj().pages[0];

// ---------------------------------------------------------------- mount
export function renderDesign(container, origin) {
  if (container.dataset.v !== 'design') {
    root = container; root.dataset.v = 'design'; root.textContent = '';
    if (innerWidth < 1180) ui.navOpen = { left: false, right: false };
    build();
  }
  if (!proj().pages.some((p) => p.id === ui.pageId)) ui.pageId = proj().pages[0].id;
  if (ui.selNode && !findNode(proj(), ui.selNode)) ui.selNode = null;
  root.className = 'view design' + (ui.navOpen.left ? '' : ' hide-left') + (ui.navOpen.right ? '' : ' hide-right');
  renderToolbar();
  renderLeft();
  renderStage();
  if (origin !== 'props') renderProps();
}

function build() {
  if (!document.getElementById('cx-base-css')) document.head.append(h('style', { id: 'cx-base-css' }, BASE_CSS + '\n' + keyframesCss()));
  els.toolbar = h('div', { class: 'toolbar' });
  els.stageWrap = h('div', { class: 'stage-wrap' });
  els.left = h('aside', { class: 'panel left' });
  els.right = h('aside', { class: 'panel right' });
  root.append(els.left, h('section', { class: 'center' }, els.toolbar, els.stageWrap), els.right);
  els.stage = h('div', { class: 'stage' });
  els.surface = h('div', { class: 'canvas-surface' });
  els.layer = h('div', { class: 'ovl-layer' });
  els.selBox = h('div', { class: 'sel-box' },
    h('span', { class: 'sel-label' }),
    ...['e', 's', 'se'].map((d) => h('i', { class: 'handle h-' + d, 'data-h': d, onpointerdown: (e) => startResize(e, d) })));
  els.dropLine = h('div', { class: 'drop-line' });
  els.layer.append(els.selBox, els.dropLine);
  els.stage.append(els.surface, els.layer);
  els.stageWrap.append(els.stage);
  els.stageWrap.addEventListener('mousedown', (e) => {
    if (e.target.closest('.handle')) return;
    const tb = e.target.closest('[data-tab]');
    if (tb) { const owner = tb.closest('[data-nid]'); ui.tabs[owner.dataset.nid] = Number(tb.dataset.tab); ui.selNode = owner.dataset.nid; renderStage(); renderProps(); renderToolbar(); return; }
    const el = e.target.closest('[data-nid]');
    select(el ? el.dataset.nid : page().root.id);
  });
  els.surface.addEventListener('click', (e) => e.preventDefault());
  els.surface.addEventListener('dblclick', () => root.querySelector('[data-prop="text"]')?.focus());
  els.surface.addEventListener('dragstart', onDragStart);
  els.surface.addEventListener('dragend', clearDrop);
  els.stageWrap.addEventListener('dragover', onDragOver);
  els.stageWrap.addEventListener('dragleave', (e) => { if (!els.stageWrap.contains(e.relatedTarget)) clearDrop(); });
  els.stageWrap.addEventListener('drop', onDrop);
  addEventListener('resize', placeOverlay);
}

// ---------------------------------------------------------------- toolbar
function renderToolbar() {
  const p = page();
  const t = els.toolbar;
  t.textContent = '';
  t.append(
    h('button', { class: 'icon-btn', title: 'Components パネルの表示/非表示', onclick: () => { ui.navOpen.left = !ui.navOpen.left; renderDesign(root); } }, '☰'),
    h('div', { class: 'tabs' }, proj().pages.map((pg) =>
      h('button', { class: 'tab' + (pg.id === p.id ? ' on' : ''), onclick: () => { ui.pageId = pg.id; ui.selNode = null; renderDesign(root); } }, pg.name)),
      h('button', { class: 'tab add', title: 'ページを追加', onclick: addPage }, '＋'),
      h('button', { class: 'tab add', title: 'ページの操作', onclick: (e) => pageMenu(e.currentTarget) }, '⋯')),
    h('span', { class: 'sp' }),
    toolBtn('↑', '上へ移動 (Alt+↑)', () => moveSibling(-1)),
    toolBtn('↓', '下へ移動 (Alt+↓)', () => moveSibling(1)),
    toolBtn('⧉', '複製 (Ctrl+D)', duplicateSel, '複製'),
    toolBtn('★', 'My Components に保存', saveToLibrary, '保存'),
    toolBtn('🗑', '削除 (Delete)', deleteSel, '削除'),
    h('select', { class: 'sel', title: 'キャンバス幅', onchange: (e) => { device = e.target.value; renderStage(); } },
      [['full', 'Desktop'], ['768', 'Tablet 768'], ['390', 'Mobile 390']].map(([v, l]) => h('option', { value: v, selected: v === device }, l))),
    h('button', { class: 'icon-btn', title: 'Properties パネルの表示/非表示', onclick: () => { ui.navOpen.right = !ui.navOpen.right; renderDesign(root); } }, '⚙'),
  );
}
const toolBtn = (icon, title, fn, text) => h('button', { class: 'tool-btn', title, onclick: fn }, icon, text ? h('span', {}, text) : null);

async function addPage() {
  const name = await promptText('ページを追加', 'Page' + (proj().pages.length + 1));
  if (!name) return;
  const pg = newPage(name);
  commit('Add page', (p) => p.pages.push(pg));
  ui.pageId = pg.id; ui.selNode = null; renderDesign(root);
}
function pageMenu(anchor) {
  const pg = page();
  menu(anchor, [
    { label: 'ページ名を変更…', onClick: async () => { const n = await promptText('ページ名', pg.name); if (n) commit('Rename page', (p) => { p.pages.find((x) => x.id === pg.id).name = n; }); } },
    { label: 'ページを複製', onClick: () => { let id; commit('Duplicate page', (p) => { id = duplicatePage(p, pg.id).id; }); ui.pageId = id; ui.selNode = null; renderDesign(root); } },
    { label: 'ページを削除', disabled: proj().pages.length < 2, onClick: async () => {
      if (!(await confirmDlg('ページを削除', tf('「{0}」とそのロジックを削除します(Undoで戻せます)。', pg.name), '削除'))) return;
      commit('Delete page', (p) => { p.pages = p.pages.filter((x) => x.id !== pg.id); p.scripts = p.scripts.filter((s) => s.page !== pg.id); });
      ui.pageId = proj().pages[0].id; renderDesign(root);
    } },
  ]);
}

// ---------------------------------------------------------------- left: components / layers
function renderLeft() {
  const L = els.left;
  L.textContent = '';
  L.append(h('div', { class: 'seg' },
    ['components', 'layers'].map((k) => h('button', { class: ui.leftTab === k ? 'on' : '', onclick: () => { ui.leftTab = k; renderLeft(); } }, k === 'components' ? 'Components' : 'Layers'))));
  if (ui.leftTab === 'layers') { L.append(h('div', { class: 'scroll' }, layerTree(page().root, 0))); return; }
  const input = h('input', { class: 'inp search', placeholder: '🔍 Search components...', value: search, 'data-search': '1', oninput: (e) => { search = e.target.value; fillPalette(); } });
  els.palette = h('div', { class: 'scroll' });
  L.append(input, els.palette);
  fillPalette();
}

function fillPalette() {
  const q = search.trim().toLowerCase();
  els.palette.textContent = '';
  const match = (l) => !q || l.toLowerCase().includes(q);
  for (const cat of CATS) {
    const items = [...components.values()].filter((d) => d.cat === cat && !d.hidden && componentVisible(d) && match(d.label));
    const soon = COMING_SOON.filter((d) => d.cat === cat && match(d.label));
    if (!items.length && !soon.length) continue;
    els.palette.append(catSection(cat, [
      ...items.map((d) => h('div', { class: 'pal-item', draggable: 'true', title: tf('{0} — クリックで追加 / ドラッグで配置', t(d.label)),
        onclick: () => addComponent(d.type), ondragstart: (e) => { e.dataTransfer.setData('application/x-codiram-new', d.type); e.dataTransfer.effectAllowed = 'copy'; } },
        h('span', { class: 'pal-ico' }, d.icon), h('span', {}, d.label))),
      ...soon.map((d) => h('div', { class: 'pal-item disabled', title: 'プラグインで追加予定' }, h('span', { class: 'pal-ico' }, d.icon), h('span', {}, d.label), h('em', {}, 'soon'))),
    ]));
  }
  const lib = getLibrary().filter((l) => match(l.name));
  if (lib.length || !q) {
    els.palette.append(catSection('My Components', lib.length ? lib.map((l) =>
      h('div', { class: 'pal-item', draggable: 'true', title: 'クリックで追加 / ドラッグで配置',
        onclick: () => addFromLibrary(l.id), ondragstart: (e) => { e.dataTransfer.setData('application/x-codiram-lib', l.id); e.dataTransfer.effectAllowed = 'copy'; } },
        h('span', { class: 'pal-ico' }, '★'), h('span', {}, l.name),
        h('button', { class: 'mini', title: 'ライブラリから削除', onclick: (e) => { e.stopPropagation(); setLibrary(getLibrary().filter((x) => x.id !== l.id)); fillPalette(); } }, '✕'))) :
      [h('div', { class: 'muted pad' }, 'キャンバスで部品を選び ★ を押すとここに保存され、別プロジェクトでも使えます。')]));
  }
}

function catSection(name, kids) {
  const key = 'pal:' + name;
  const closed = ui.collapsed.has(key);
  return h('div', { class: 'cat' },
    h('button', { class: 'cat-head', onclick: () => { closed ? ui.collapsed.delete(key) : ui.collapsed.add(key); fillPalette(); } }, closed ? '▸ ' : '▾ ', name),
    closed ? null : h('div', { class: 'cat-body' }, kids));
}

function layerTree(node, depth) {
  const def = components.get(node.type);
  const row = h('div', { class: 'layer' + (ui.selNode === node.id ? ' on' : ''), style: { paddingLeft: 8 + depth * 14 + 'px' }, onclick: () => select(node.id) },
    h('span', { class: 'pal-ico' }, def?.icon || '?'), h('span', {}, node.type === 'page' ? tf('Page: {0}', page().name) : node.name), h('em', {}, node.type));
  return h('div', {}, row, (node.children || []).map((c) => layerTree(c, depth + 1)));
}

// ---------------------------------------------------------------- selection / stage
function select(id) {
  ui.selNode = id;
  ui.selBlocks.clear();
  markSelection();
  renderToolbar();
  if (ui.leftTab === 'layers') renderLeft();
  renderProps();
}

function renderStage() {
  const ctx = { project: proj(), editor: true, tabs: ui.tabs };
  els.surface.innerHTML = renderNode(page().root, ctx);
  els.surface.style.maxWidth = device === 'full' ? '' : device + 'px';
  syncFonts();
  markSelection();
}

function syncFonts() {
  const p = proj();
  const vals = [p.settings?.font, ...allNodes(p).map((x) => x.node.style?.fontFamily)].filter(Boolean);
  const url = googleFontsUrl(vals);
  let link = document.getElementById('cx-fonts');
  if (url && !link) { link = h('link', { id: 'cx-fonts', rel: 'stylesheet' }); document.head.append(link); }
  if (link && link.getAttribute('href') !== url) { if (url) link.setAttribute('href', url); else link.remove(); }
  els.surface.style.fontFamily = fontStack(p.settings?.font);
  els.surface.style.background = p.settings?.bg || '';
  els.surface.style.color = p.settings?.textColor || '';
  if (p.settings?.primary) els.surface.style.setProperty('--primary', p.settings.primary); else els.surface.style.removeProperty('--primary');
  // fonts may load late and change sizes
  document.fonts?.ready.then(() => placeOverlay());
}

function markSelection() {
  els.surface.querySelectorAll('.is-sel').forEach((e) => e.classList.remove('is-sel'));
  const el = ui.selNode && els.surface.querySelector(`[data-nid="${ui.selNode}"]`);
  el?.classList.add('is-sel');
  placeOverlay();
}

function placeOverlay() {
  if (!els.surface) return;
  const el = ui.selNode && els.surface.querySelector(`[data-nid="${ui.selNode}"]`);
  if (!el) { els.selBox.style.display = 'none'; return; }
  const node = findNode(proj(), ui.selNode)?.node;
  const r = el.getBoundingClientRect(), s = els.stage.getBoundingClientRect();
  Object.assign(els.selBox.style, { display: 'block', left: r.left - s.left + 'px', top: r.top - s.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  els.selBox.classList.toggle('no-handles', node?.type === 'page');
  els.selBox.firstChild.textContent = node ? `${node.name} · ${node.type}` : '';
}

// ---------------------------------------------------------------- resize
function startResize(e, dir) {
  e.preventDefault(); e.stopPropagation();
  const id = ui.selNode;
  const el = els.surface.querySelector(`[data-nid="${id}"]`);
  if (!el) return;
  const r0 = el.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY;
  let w = Math.round(r0.width), hgt = Math.round(r0.height);
  const move = (ev) => {
    if (dir.includes('e')) { w = Math.max(16, Math.round(r0.width + ev.clientX - x0)); el.style.width = w + 'px'; }
    if (dir.includes('s')) { hgt = Math.max(16, Math.round(r0.height + ev.clientY - y0)); el.style.height = hgt + 'px'; }
    placeOverlay();
  };
  const up = () => {
    removeEventListener('pointermove', move); removeEventListener('pointerup', up);
    commit('Resize', (p) => {
      const n = findNode(p, id).node;
      if (dir.includes('e')) n.style.width = String(w);
      if (dir.includes('s')) n.style.height = String(hgt);
    });
  };
  addEventListener('pointermove', move); addEventListener('pointerup', up);
}

// ---------------------------------------------------------------- drag & drop
function onDragStart(e) {
  const el = e.target.closest('[data-nid]');
  if (!el || el.dataset.type === 'page') { e.preventDefault(); return; }
  const gr = el.getBoundingClientRect();
  ui.grab = { dx: e.clientX - gr.left, dy: e.clientY - gr.top };
  e.dataTransfer.setData('application/x-codiram-node', el.dataset.nid);
  e.dataTransfer.effectAllowed = 'move';
  select(el.dataset.nid);
}

const hostOf = (el) => { const sel = components.get(el.dataset.type)?.childHost; return (sel && el.querySelector(':scope > ' + sel)) || el; };

/** Where would a drop at the pointer land? -> {containerEl, index, line:{x,y,w,h}} */
function dropTarget(e) {
  let hit = e.target.closest?.('[data-nid]') || els.surface.querySelector('[data-nid]');
  if (!hit) return null;
  let cont, ref = null, after = false;
  const node = findNode(proj(), hit.dataset.nid)?.node;
  if (node && isContainer(node)) cont = hit;
  else { cont = hit.parentElement.closest('[data-nid]'); ref = hit; }
  if (!cont) return null;
  const host = hostOf(cont);
  const kids = [...host.children].filter((c) => c.dataset?.nid);
  const cnode = findNode(proj(), cont.dataset.nid)?.node;
  if (cnode && components.get(cnode.type)?.freeLayout) {
    const r = host.getBoundingClientRect();
    return { cont, index: kids.length, free: true, pos: { x: e.clientX - r.left + host.scrollLeft, y: e.clientY - r.top + host.scrollTop }, line: null };
  }
  const horiz = getComputedStyle(host).flexDirection.startsWith('row');
  let index = kids.length;
  if (ref) {
    const r = ref.getBoundingClientRect();
    after = horiz ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2;
    index = kids.indexOf(ref) + (after ? 1 : 0);
  } else {
    for (let i = 0; i < kids.length; i++) {
      const r = kids[i].getBoundingClientRect();
      if (horiz ? e.clientX < r.left + r.width / 2 : e.clientY < r.top + r.height / 2) { index = i; break; }
    }
  }
  const s = els.stage.getBoundingClientRect();
  let line;
  if (!kids.length) { const r = host.getBoundingClientRect(); line = { x: r.left + 4, y: r.top + 4, w: r.width - 8, h: 3 }; }
  else {
    const r = (kids[index] || kids[kids.length - 1]).getBoundingClientRect();
    const atEnd = index >= kids.length;
    line = horiz ? { x: atEnd ? r.right + 2 : r.left - 3, y: r.top, w: 3, h: r.height } : { x: r.left, y: atEnd ? r.bottom + 2 : r.top - 3, w: r.width, h: 3 };
  }
  line.x -= s.left; line.y -= s.top;
  return { cont, index, line };
}

function onDragOver(e) {
  const types = [...e.dataTransfer.types];
  if (!types.some((t) => t.startsWith('application/x-codiram'))) return;
  const t = dropTarget(e);
  if (!t) return;
  e.preventDefault();
  els.surface.querySelectorAll('.drop-target').forEach((x) => x.classList.remove('drop-target'));
  t.cont.classList.add('drop-target');
  if (t.line) Object.assign(els.dropLine.style, { display: 'block', left: t.line.x + 'px', top: t.line.y + 'px', width: t.line.w + 'px', height: t.line.h + 'px' });
  else els.dropLine.style.display = 'none';
}
function clearDrop() {
  els.dropLine.style.display = 'none';
  els.surface.querySelectorAll('.drop-target').forEach((x) => x.classList.remove('drop-target'));
}

function placeFree(node, pos, grab) {
  const w = Number(node.style.width) || 56, h = Number(node.style.height) || 56;
  node.style.left = String(Math.round(pos.x - (grab ? grab.dx : w / 2)));
  node.style.top = String(Math.round(pos.y - (grab ? grab.dy : h / 2)));
}

function onDrop(e) {
  const t = dropTarget(e);
  clearDrop();
  if (!t) return;
  e.preventDefault();
  const contId = t.cont.dataset.nid;
  const newType = e.dataTransfer.getData('application/x-codiram-new');
  const libId = e.dataTransfer.getData('application/x-codiram-lib');
  const moveId = e.dataTransfer.getData('application/x-codiram-node');
  if (newType) insert(contId, t.index, (p) => { const n = createNode(p, newType); if (t.free) placeFree(n, t.pos); return n; }, 'Add ' + newType);
  else if (libId) addFromLibrary(libId, contId, t.index, t.free ? t.pos : null);
  else if (moveId) {
    const src = els.surface.querySelector(`[data-nid="${moveId}"]`);
    if (!src || src.contains(t.cont)) return; // cannot drop into itself
    commit('Move', (p) => {
      const f = findNode(p, moveId);
      f.parent.children.splice(f.index, 1);
      const c = findNode(p, contId).node;
      let idx = t.index;
      if (f.parent === c && f.index < idx) idx--;
      c.children.splice(idx, 0, f.node);
      if (t.free) placeFree(f.node, t.pos, ui.grab);
      else { delete f.node.style.left; delete f.node.style.top; }
    });
    select(moveId);
  }
}

function insert(parentId, index, make, label) {
  let id;
  commit(label, (p) => {
    const n = make(p);
    id = n.id;
    const par = findNode(p, parentId).node;
    par.children.splice(index ?? par.children.length, 0, n);
  });
  select(id);
}

function insertionPoint() {
  const f = ui.selNode && findNode(proj(), ui.selNode);
  if (!f) return { id: page().root.id };
  if (isContainer(f.node)) return { id: f.node.id };
  return { id: f.parent.id, index: f.index + 1 };
}

function addComponent(type) {
  const { id, index } = insertionPoint();
  insert(id, index, (p) => {
    const n = createNode(p, type);
    const par = findNode(p, id).node;
    if (components.get(par.type)?.freeLayout) { const k = par.children.length; n.style.left = String(30 + (k * 40) % 400); n.style.top = String(30 + (k * 30) % 240); }
    return n;
  }, 'Add ' + type);
}

function addFromLibrary(libId, contId, index, pos) {
  const item = getLibrary().find((l) => l.id === libId);
  if (!item) return;
  const ip = contId ? { id: contId, index } : insertionPoint();
  insert(ip.id, ip.index, (p) => { const n = freshClone(p, item.node); if (pos) placeFree(n, pos); return n; }, 'Insert ' + item.name);
}

// ---------------------------------------------------------------- node operations (also used by shortcuts)
function selNodeInfo() {
  const f = ui.selNode && findNode(proj(), ui.selNode);
  return f && f.node.type !== 'page' ? f : null;
}

export function deleteSel() {
  const f = selNodeInfo();
  if (!f) return;
  const id = f.node.id, name = f.node.name;
  commit('Delete ' + name, (p) => { const x = findNode(p, id); x.parent.children.splice(x.index, 1); });
  ui.selNode = null;
  renderDesign(root);
  toast(tf('「{0}」を削除しました', name), { label: '元に戻す', fn: () => nav.undo() });
}

export function duplicateSel() {
  const f = selNodeInfo();
  if (!f) return;
  let id;
  commit('Duplicate', (p) => {
    const x = findNode(p, f.node.id);
    const c = freshClone(p, x.node);
    id = c.id;
    x.parent.children.splice(x.index + 1, 0, c);
  });
  select(id);
}

export function copySel() {
  const f = selNodeInfo();
  if (!f) return false;
  ui.clip = { kind: 'node', data: clone(f.node) };
  toast('コピーしました');
  return true;
}

export function pasteSel() {
  if (ui.clip?.kind !== 'node') return false;
  const ip = insertionPoint();
  insert(ip.id, ip.index, (p) => freshClone(p, ui.clip.data), 'Paste');
  return true;
}

function moveSibling(dir) {
  const f = selNodeInfo();
  if (!f) return;
  const j = f.index + dir;
  if (j < 0 || j >= f.parent.children.length) return;
  commit('Reorder', (p) => { const x = findNode(p, f.node.id); const [n] = x.parent.children.splice(x.index, 1); x.parent.children.splice(j, 0, n); });
}
export const moveSel = moveSibling;

async function saveToLibrary() {
  const f = selNodeInfo();
  if (!f) { toast('保存する部品を選択してください'); return; }
  const name = await promptText('My Components に保存', f.node.name);
  if (!name) return;
  setLibrary([...getLibrary(), { id: 'l' + Date.now().toString(36), name, node: clone(f.node) }]);
  ui.leftTab = 'components'; renderLeft();
  toast(tf('★ 「{0}」を保存しました', name));
}

// ---------------------------------------------------------------- properties
function renderProps() {
  const R = els.right;
  R.textContent = '';
  const f = ui.selNode && findNode(proj(), ui.selNode);
  if (!f) { R.append(h('div', { class: 'muted pad' }, 'キャンバスで部品を選択すると、ここに設定が表示されます。')); return; }
  const node = f.node, def = components.get(node.type);
  R.append(h('div', { class: 'props-head' }, h('span', { class: 'pal-ico' }, def.icon), h('b', {}, node.type === 'page' ? tf('Page: {0}', page().name) : def.label), h('em', {}, node.type)));
  const groups = {};
  propSchema(node).forEach((pr) => (groups[pr.g] = groups[pr.g] || []).push(pr));
  const events = def.events || [];
  const order = ['General', 'Data', ...(events.length ? ['Action'] : []), 'Layout', 'Style', 'Animation'];
  const body = h('div', { class: 'scroll' });
  for (const g of order) {
    if (!groups[g] && g !== 'Action') continue;
    const key = 'prop:' + g;
    const det = h('details', { class: 'pgroup', open: !ui.collapsed.has(key), ontoggle: (e) => { e.target.open ? ui.collapsed.delete(key) : ui.collapsed.add(key); } },
      h('summary', {}, g));
    if (g === 'Action') events.forEach((ev) => det.append(h('div', { class: 'prow' }, h('label', {}, ev.label),
      h('button', { class: 'btn small', onclick: () => editLogic(node, ev) }, '▦ Edit Logic'))));
    else (groups[g] || []).forEach((pr) => det.append(propRow(node, pr)));
    body.append(det);
  }
  R.append(body);
}

function editLogic(node, ev) {
  let s = proj().scripts.find((x) => x.hat.type === ev.hat && x.hat.args.target === node.id);
  if (!s) {
    s = newScript(proj(), page().id, ev.hat, { target: node.id });
    commit('Create script', (p) => p.scripts.push(s));
  }
  ui.selScript = s.id;
  nav.go('logic');
}

function propRow(node, pr) {
  const val = pr.s ? node.style[pr.k] : pr.k === 'name' ? node.name : node.props[pr.k];
  const set = (v, opts) => commit('Edit ' + pr.label, (p) => {
    const n = findNode(p, node.id).node;
    if (pr.k === 'name') n.name = uniqueNameFor(p, n, v);
    else if (pr.s) { if (v === '' || v === false) delete n.style[pr.k]; else n.style[pr.k] = v; }
    else n.props[pr.k] = v;
  }, { coalesce: 'prop:' + node.id + ':' + pr.k, ...opts });
  let input;
  const live = { origin: 'props' };
  switch (pr.t) {
    case 'textarea': input = h('textarea', { class: 'inp', rows: 3, placeholder: pr.ph || '', 'data-prop': pr.k, oninput: (e) => set(e.target.value, live) }); input.value = val ?? ''; break;
    case 'bool': input = h('input', { type: 'checkbox', checked: !!val, 'data-prop': pr.k, onchange: (e) => set(e.target.checked) }); break;
    case 'select': input = h('select', { class: 'sel', 'data-prop': pr.k, onchange: (e) => set(e.target.value) },
      pr.opts.map((o) => { const [ov, ol] = Array.isArray(o) ? o : [o, o === '' ? '(default)' : o]; return h('option', { value: ov, selected: String(val ?? '') === ov }, ol); })); break;
    case 'chartsource': input = h('select', { class: 'sel', 'data-prop': pr.k, onchange: (e) => set(e.target.value) },
      h('option', { value: '' }, '(なし)'), proj().models.map((m) => h('option', { value: m.name, selected: val === m.name }, '▦ ' + m.name)),
      proj().variables.filter((v) => v.type === 'Array').map((v) => h('option', { value: v.name, selected: val === v.name }, '[ ] ' + v.name))); break;
    case 'font': input = fontSelect(val, (v) => set(v), { 'data-prop': pr.k }); break;
    case 'asset': {
      const list = (proj().assets || []).filter((a) => !pr.kind || a.kind === pr.kind);
      const txt = h('input', { class: 'inp', value: val ?? '', placeholder: pr.ph || 'URL', 'data-prop': pr.k, oninput: (e) => set(e.target.value, live) });
      const pick = h('select', { class: 'sel', title: 'アセットから選ぶ', onchange: (e) => { if (e.target.value) set(e.target.value); } }, h('option', { value: '' }, '▾'), list.map((a) => h('option', { value: 'assets/' + a.name }, a.name)));
      input = h('div', { class: 'colorf' }, pick, txt); break;
    }
    case 'playanim': input = h('button', { class: 'btn small', onclick: () => playOnCanvas(node) }, '▶ Play'); break;
    case 'model': input = h('select', { class: 'sel', 'data-prop': pr.k, onchange: (e) => set(e.target.value) },
      h('option', { value: '' }, '(なし)'), proj().models.map((m) => h('option', { value: m.name, selected: val === m.name }, m.name))); break;
    case 'var': input = h('select', { class: 'sel', 'data-prop': pr.k, onchange: async (e) => {
      if (e.target.value !== '__new') return set(e.target.value);
      const name = await promptText('新しい変数', '', '変数名 (英数字・日本語・_)');
      if (!name) { renderProps(); return; }
      const vn = sanitizeIdent(name);
      commit('Add variable', (p) => { if (!p.variables.some((v) => v.name === vn)) p.variables.push({ name: vn, type: 'String', initial: '' }); findNode(p, node.id).node.props[pr.k] = vn; });
    } }, h('option', { value: '' }, '(なし)'), proj().variables.map((v) => h('option', { value: v.name, selected: val === v.name }, v.name)), h('option', { value: '__new' }, '＋ 新規変数…')); break;
    case 'color': {
      const txt = h('input', { class: 'inp', value: val ?? '', placeholder: '(default)', 'data-prop': pr.k, oninput: (e) => { set(e.target.value, live); sw.value = toHex(e.target.value); } });
      const sw = h('input', { type: 'color', class: 'swatch', value: toHex(val), oninput: (e) => { txt.value = e.target.value; set(e.target.value, live); } });
      input = h('div', { class: 'colorf' }, sw, txt); break;
    }
    case 'name': input = h('input', { class: 'inp', value: val ?? '', 'data-prop': 'name', onchange: (e) => { set(e.target.value); } }); break;
    default: input = h('input', { class: 'inp', value: val ?? '', placeholder: pr.ph || '', 'data-prop': pr.k, oninput: (e) => set(e.target.value, live) });
  }
  if (node.type === 'text' && pr.k === 'text') {
    const refs = [...proj().variables.map((v) => v.name), ...proj().models.flatMap((m) => [m.name + '.length', ...m.fields.map((f) => m.name + '[0].' + f.name)])];
    const ins = h('select', { class: 'sel', title: 'データ・変数を挿入', onchange: (e) => { if (!e.target.value) return; set((node.props.text || '') + '{' + e.target.value + '}'); } },
      h('option', { value: '' }, '＋ {データを挿入}'), refs.map((r) => h('option', { value: r }, r)));
    return h('div', { class: 'prow' }, h('label', {}, pr.label), h('div', {}, input, ins));
  }
  return h('div', { class: 'prow' + (pr.t === 'bool' ? ' inline' : '') }, h('label', {}, pr.label), input);
}

function playOnCanvas(node) {
  const el = els.surface.querySelector(`[data-nid="${node.id}"]`);
  const decl = animationDecl(node.props);
  if (!el || !decl) { toast(L({ ja: '登場アニメーションまたは繰り返しアニメーションを選んでください', en: 'Choose an entrance or looping animation first' })); return; }
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = decl;
  if (!node.props.animLoop) el.addEventListener('animationend', () => { el.style.animation = ''; }, { once: true });
  else setTimeout(() => { el.style.animation = ''; }, 3200);
}

const toHex = (c) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : '#000000');

function uniqueNameFor(p, node, v) {
  const base = sanitizeIdent(v);
  const taken = allNodes(p).some((x) => x.node !== node && x.node.name === base);
  return taken ? uniqueName(p, base.replace(/\d+$/, '') || base) : base;
}

export function designKey(e) {
  if (matchAction(e, 'delete')) { deleteSel(); return true; }
  if (matchAction(e, 'duplicate')) { duplicateSel(); return true; }
  if (matchAction(e, 'copy')) { return copySel(); }
  if (matchAction(e, 'paste')) { return pasteSel(); }
  if (e.altKey && e.key === 'ArrowUp') { moveSibling(-1); return true; }
  if (e.altKey && e.key === 'ArrowDown') { moveSibling(1); return true; }
  if (e.key.startsWith('Arrow') && !e.altKey) {
    const f = selNodeInfo();
    if (f && f.parent && components.get(f.parent.type)?.freeLayout) {
      const d = e.shiftKey ? 10 : 1;
      const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0, dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0;
      commit('Nudge', (p) => { const n = findNode(p, f.node.id).node; n.style.left = String((Number(n.style.left) || 0) + dx); n.style.top = String((Number(n.style.top) || 0) + dy); }, { coalesce: 'nudge' + f.node.id });
      return true;
    }
  }
  if (e.key === 'Escape') { select(page().root.id); return true; }
  return false;
}

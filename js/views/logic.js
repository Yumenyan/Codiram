// Logic view: Scripts (left) | vertical block workspace (center) | Block palette (right)
import { h, clone, sanitizeIdent } from '../util.js';
import { blocks, BLOCK_CATS, catOf } from '../registry.js';
import { COND_OPS, defaultCond } from '../blocks.js';
import { store, ui, commit, nav } from '../store.js';
import { allNodes, newBlock, newScript, scriptTitle, findBlock, walkBlocks, freshBlockClone, fnNames, lint, findNode, scriptsFor, defaultInitial } from '../model.js';
import { blockSupports, activeTargetId, activeTarget } from '../registry.js';
import { ITEMS, BLOCKS, SOUNDS } from '../targets/minecraft/ids.js';
import { components } from '../registry.js';
import { promptText, menu, toast, confirmDlg, promptVariable } from '../ui-kit.js';
import { L, getLang, isBi, tf } from '../i18n.js';
import { J } from '../i18n-helpers.js';
import { matchAction } from '../shortcuts.js';
import { blockVisible } from '../plugins.js';
import { ANIMS } from '../animations.js';

const proj = () => store.project;
const catName = (c) => (getLang() === 'ja' ? c.ja : c.label);
const blockTitle = (d) => (getLang() === 'en' && d.en ? d.en : d.title);
let root, els = {}, search = '';
const script = () => proj().scripts.find((s) => s.id === ui.selScript);

export function renderLogic(container, origin) {
  if (origin === 'logic') return;
  if (container.dataset.v !== 'logic') {
    root = container; root.dataset.v = 'logic'; root.textContent = '';
    els.left = h('aside', { class: 'panel left' });
    els.work = h('section', { class: 'center scroll workspace', onmousedown: (e) => { if (e.target === els.work || e.target.classList.contains('script-card')) clearSel(); } });
    els.right = h('aside', { class: 'panel right' });
    els.names = h('datalist', { id: 'dl-names' });
    root.append(els.left, els.work, els.right, els.names);
    if (innerWidth < 1180) ui.navOpen = { left: false, right: false };
  }
  root.className = 'view logic' + (ui.navOpen.left ? '' : ' hide-left') + (ui.navOpen.right ? '' : ' hide-right');
  const p = proj();
  const mine = scriptsFor(p, activeTargetId(p));
  if (!mine.some((s) => s.id === ui.selScript)) ui.selScript = mine[0]?.id || null;
  fillNames();
  renderLeft();
  renderWorkspace();
  renderPalette();
}

function fillNames() {
  const p = proj();
  els.names.textContent = '';
  [...p.variables.map((v) => v.name), ...allNodes(p).filter((x) => x.node.type !== 'page').map((x) => x.node.name), ...p.models.map((m) => m.name), 'item']
    .forEach((n) => els.names.append(h('option', { value: n })));
  root.querySelectorAll('datalist[id^=dl-mc]').forEach((x) => x.remove());
  if (activeTargetId(p) === 'minecraft') {
    for (const [id, list] of [['dl-mc-items', ITEMS], ['dl-mc-blocks', BLOCKS], ['dl-mc-sounds', SOUNDS]]) {
      const dl = h('datalist', { id });
      list.forEach((n) => dl.append(h('option', { value: n })));
      els.names.parentElement.append(dl);
    }
  }
}

// ---------------------------------------------------------------- problems
function problems() {
  const list = lint(proj()).map((x) => ({ ...x, kind: 'static' }));
  ui.errors.forEach((e) => list.push({ script: e.script, block: e.block, msg: e.message, kind: 'runtime' }));
  return list;
}

function blockForRuntime(blockId) {
  for (const s of proj().scripts) { if (blockId === 'hat:' + s.id) return s.id; if (findBlock(s, blockId)) return s.id; }
  return null;
}
// attach script ids to runtime errors lazily
export function resolveErrors() { ui.errors.forEach((e) => { if (!e.script && e.block) e.script = blockForRuntime(e.block); }); }

export function gotoBlock(scriptId, blockId) {
  ui.selScript = scriptId; ui.focusBlock = blockId || null;
  nav.go('logic');
}

// ---------------------------------------------------------------- left: script tree
function renderLeft() {
  const p = proj(), L = els.left;
  L.textContent = '';
  const probs = problems();
  L.append(h('div', { class: 'panel-title' }, 'Scripts', h('button', { class: 'btn small', onclick: (e) => newScriptMenu(e.currentTarget) }, '＋ New')));
  const tree = h('div', { class: 'scroll' });
  const tid = activeTargetId(p), flat = !activeTarget(p).views.includes('design');
  const groups = flat ? [{ id: '_all', name: 'Logic' }] : p.pages;
  for (const pg of groups) {
    const key = 'sp:' + pg.id, closed = ui.collapsed.has(key);
    const ss = scriptsFor(p, tid).filter((s) => flat || s.page === pg.id);
    tree.append(h('button', { class: 'cat-head', onclick: () => { closed ? ui.collapsed.delete(key) : ui.collapsed.add(key); renderLeft(); } }, closed ? '▸ ' : '▾ ', flat ? 'Logic' : tf('Page: {0}', pg.name), h('em', {}, ss.length)));
    if (!closed) ss.forEach((s) => {
      const n = probs.filter((x) => x.script === s.id).length;
      tree.append(h('div', { class: 'layer script-item' + (s.id === ui.selScript ? ' on' : ''), onclick: () => { ui.selScript = s.id; ui.selBlocks.clear(); renderLogic(root); } },
        h('span', { class: 'pal-ico' }, catOf('Events').icon), h('span', { class: 'grow' }, scriptTitle(p, s)), n ? h('b', { class: 'warn', title: n + ' 件の問題' }, '⚠' + n) : null));
    });
    if (!closed && !ss.length) tree.append(h('div', { class: 'muted pad small' }, '(スクリプトなし)'));
  }
  L.append(tree);
  const pr = h('div', { class: 'problems' }, h('div', { class: 'panel-title' }, 'Problems', h('span', { class: probs.length ? 'badge warn' : 'badge' }, probs.length)));
  probs.slice(0, 30).forEach((x) => pr.append(h('button', { class: 'problem' + (x.kind === 'runtime' ? ' rt' : ''), onclick: () => gotoBlock(x.script, x.block) },
    h('span', {}, x.kind === 'runtime' ? '✖' : '⚠'), h('span', {}, x.msg))));
  if (!probs.length) pr.append(h('div', { class: 'muted pad small' }, '✓ 問題は見つかりません'));
  L.append(pr);
}

function newScriptMenu(anchor) {
  const hats = [...blocks.values()].filter((d) => d.kind === 'hat' && blockSupports(d, activeTargetId(proj())) && blockVisible(d));
  menu(anchor, hats.map((d) => ({ label: `${d.icon} ${blockTitle(d)}`, onClick: () => createScript(d.type) })));
}

const firstHat = () => [...blocks.values()].find((d) => d.kind === 'hat' && blockSupports(d, activeTargetId(proj())))?.type;

function createScript(hatType) {
  const p = proj();
  const def = blocks.get(hatType);
  const args = {};
  const pageId = p.pages.find((x) => x.id === ui.pageId)?.id || p.pages[0].id;
  if (def.fields.target) {
    const sel = ui.selNode && findNode(p, ui.selNode)?.node;
    const ok = (n) => n.type !== 'page' && (!def.fields.target.types || def.fields.target.types.includes(n.type));
    const want = (n) => (components.get(n.type)?.events || []).some((e) => e.hat === hatType);
    args.target = (sel && ok(sel) && want(sel) ? sel : allNodes(p).map((x) => x.node).find(want))?.id || '';
  }
  if (def.fields.page) args.page = pageId;
  if (def.fields.model) args.model = p.models[0]?.name || '';
  const s = newScript(p, pageId, hatType, args);
  commit('Create script', (pp) => pp.scripts.push(s));
  ui.selScript = s.id;
  renderLogic(root);
}

// ---------------------------------------------------------------- workspace
function renderWorkspace() {
  const W = els.work, s = script(), p = proj();
  W.textContent = '';
  const toolbar = h('div', { class: 'toolbar' },
    h('button', { class: 'icon-btn', title: 'Scripts パネル', onclick: () => { ui.navOpen.left = !ui.navOpen.left; renderLogic(root); } }, '☰'),
    h('b', {}, 'Logic'), h('span', { class: 'sp' }),
    h('span', { class: 'muted small' }, 'ブロックをドラッグ / クリックで追加 · Ctrl+クリックで複数選択'),
    h('button', { class: 'icon-btn', title: 'Blocks パネル', onclick: () => { ui.navOpen.right = !ui.navOpen.right; renderLogic(root); } }, '▤'));
  W.append(toolbar);
  if (!s) {
    W.append(h('div', { class: 'empty' }, h('p', {}, 'スクリプトがありません。'), h('p', { class: 'muted' }, '左の「＋ New」からイベントを選んで作成するか、Design の部品プロパティから Edit Logic を押してください。'),
      h('button', { class: 'btn primary', onclick: () => createScript(firstHat()) }, '＋ 最初のスクリプトを作る')));
    return;
  }
  const probMap = {};
  problems().filter((x) => x.script === s.id).forEach((x) => { (probMap[x.block] = probMap[x.block] || []).push(x); });
  const ctx = { s, probMap };

  const card = h('div', { class: 'script-card' },
    h('div', { class: 'script-head' },
      h('input', { class: 'inp name', value: s.name, placeholder: scriptTitle(p, s), title: 'スクリプト名(任意)', onchange: (e) => commit('Rename script', (pp) => { pp.scripts.find((x) => x.id === s.id).name = e.target.value.trim(); }) }),
      h('button', { class: 'tool-btn', title: 'スクリプトを複製', onclick: () => dupScript(s) }, '⧉'),
      h('button', { class: 'tool-btn', title: 'スクリプトを削除', onclick: () => delScript(s) }, '🗑')),
    hatEl(ctx),
    stackEl(ctx, s.body, '', 'body', 0));
  W.append(card);

  if (ui.focusBlock) {
    const t = W.querySelector(`[data-bid="${ui.focusBlock}"]`);
    if (t) { t.scrollIntoView({ block: 'center' }); t.classList.add('flash'); }
    ui.focusBlock = null;
  }
}

function dupScript(s) {
  const c = clone(s); c.id = 's' + Date.now().toString(36); c.name = (s.name || scriptTitle(proj(), s)) + ' (copy)';
  const re = (arr) => arr.forEach((b) => { b.id = 'b' + Math.random().toString(36).slice(2, 8); Object.values(b.slots || {}).forEach(re); });
  re(c.body);
  commit('Duplicate script', (p) => p.scripts.push(c));
  ui.selScript = c.id; renderLogic(root);
}
async function delScript(s) {
  if (!(await confirmDlg('スクリプトを削除', 'このスクリプトを削除します(Undoで戻せます)。', '削除'))) return;
  commit('Delete script', (p) => { p.scripts = p.scripts.filter((x) => x.id !== s.id); });
  ui.selScript = proj().scripts[0]?.id || null; renderLogic(root);
}

// ---- blocks ----
function target(ctx, id) {
  const sc = proj().scripts.find((x) => x.id === ctx.s.id);
  return id.startsWith('hat:') ? sc.hat : findBlock(sc, id).block;
}

function hatEl(ctx) {
  const def = blocks.get(ctx.s.hat.type);
  return blockShell(ctx, 'hat:' + ctx.s.id, def, ctx.s.hat, true, []);
}

function blockEl(ctx, b) {
  const def = blocks.get(b.type);
  if (!def) return h('div', { class: 'block err' }, '不明なブロック ' + b.type);
  const slots = (def.slots || []).map((sl, i) => h('div', { class: 'slot' }, h('div', { class: 'slot-label' }, sl.label), stackEl(ctx, b.slots[sl.key], b.id, sl.key, 1)));
  return blockShell(ctx, b.id, def, b, false, slots);
}

function partEl(ctx, id, def, part, b) {
  if (isBi(part)) return L(part) === '' ? null : h('span', { class: 'b-txt' }, part);
  if (typeof part === 'string') return h('span', { class: 'b-txt' }, part);
  return fieldEl(ctx, id, def, part.f, b.args, []);
}

function blockShell(ctx, id, def, b, isHat, slots) {
  const cat = catOf(def.cat);
  const probs = ctx.probMap[id] || [];
  const rt = probs.filter((x) => x.kind === 'runtime');
  const el = h('div', { class: 'block' + (isHat ? ' hat' : '') + (probs.length ? ' err' : '') + (ui.selBlocks.has(id) ? ' sel' : ''), 'data-bid': id, 'data-cat': def.cat,
    style: { '--cat': cat.color, '--pat': cat.pattern }, title: probs.map((x) => x.msg).join('\n') });
  const head = h('div', { class: 'b-head', draggable: isHat ? null : 'true',
    onmousedown: (e) => { if (!e.target.closest('input,select,button,textarea')) selectBlock(e, id); },
    ondragstart: (e) => { e.dataTransfer.setData('application/x-codiram-block', JSON.stringify({ kind: 'move', id })); e.dataTransfer.effectAllowed = 'move'; document.body.classList.add('dragging-blocks'); selectBlockOnly(id); },
    ondragend: () => document.body.classList.remove('dragging-blocks') },
    isHat ? null : h('span', { class: 'grip', title: 'ドラッグで移動' }, '⠿'),
    h('span', { class: 'b-cat', title: catName(cat) }, h('span', { class: 'b-ico shape-' + cat.shape }, def.icon), h('span', { class: 'b-cat-name' }, catName(cat))),
    h('span', { class: 'b-parts' }, def.parts.map((part) => partEl(ctx, id, def, part, b))),
    probs.length ? h('span', { class: 'b-warn' }, '⚠') : null,
    isHat ? null : h('span', { class: 'b-actions' },
      h('button', { class: 'mini', title: '複製 (Ctrl+D)', onclick: () => { selectBlockOnly(id); duplicateSel(); } }, '⧉'),
      h('button', { class: 'mini', title: '削除 (Delete)', onclick: () => { selectBlockOnly(id); deleteSel(); } }, '✕')));
  el.append(head);
  if (rt.length) el.append(h('div', { class: 'b-error' }, '⚠ ', rt.map((x) => x.msg).join(' / ')));
  const stat = probs.filter((x) => x.kind === 'static');
  if (stat.length) el.append(h('div', { class: 'b-error soft' }, '⚠ ', stat.map((x) => x.msg).join(' / ')));
  slots.forEach((s) => el.append(s));
  return el;
}

function stackEl(ctx, arr, parentId, slot, depth) {
  const st = h('div', { class: 'stack' + (arr.length ? '' : ' is-empty') });
  const dz = (i) => h('div', { class: 'dz', 'data-parent': parentId, 'data-slot': slot, 'data-index': i,
    ondragover: (e) => { if ([...e.dataTransfer.types].includes('application/x-codiram-block')) { e.preventDefault(); e.currentTarget.classList.add('over'); } },
    ondragleave: (e) => e.currentTarget.classList.remove('over'),
    ondrop: (e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove('over'); dropAt(ctx, e, parentId, slot, i); } });
  st.append(dz(0));
  arr.forEach((b, i) => { st.append(blockEl(ctx, b), dz(i + 1)); });
  if (!arr.length) st.append(h('div', { class: 'stack-hint' }, 'ここにブロックをドロップ'));
  return st;
}

function slotArr(sc, parentId, slot) {
  if (!parentId) return sc.body;
  return findBlock(sc, parentId).block.slots[slot];
}

function dropAt(ctx, e, parentId, slot, index) {
  document.body.classList.remove('dragging-blocks');
  const raw = e.dataTransfer.getData('application/x-codiram-block');
  if (!raw) return;
  const d = JSON.parse(raw);
  let newId;
  if (d.kind === 'new') {
    commit('Add block', (p) => {
      const sc = p.scripts.find((x) => x.id === ctx.s.id);
      const b = newBlock(d.type, d.args);
      newId = b.id;
      slotArr(sc, parentId, slot).splice(index, 0, b);
    });
  } else {
    const cur = script();
    const src = findBlock(cur, d.id);
    if (!src) return;
    // can't drop into own subtree
    if (parentId) { let inside = false; walkBlocks(src.block.slots ? Object.values(src.block.slots).flat() : [], (x) => { if (x.id === parentId) inside = true; }); if (parentId === d.id || inside) return; }
    commit('Move block', (p) => {
      const sc = p.scripts.find((x) => x.id === ctx.s.id);
      const f = findBlock(sc, d.id);
      const dest = slotArr(sc, parentId, slot);
      f.arr.splice(f.idx, 1);
      dest.splice(f.arr === dest && f.idx < index ? index - 1 : index, 0, f.block);
    });
    newId = d.id;
  }
  ui.selBlocks = new Set([newId]);
  renderLogic(root);
}

// ---------------------------------------------------------------- field widgets
// Values live in block.args. An expression field holds either a string or { $b: reporterBlock },
// so round / hexagon "value blocks" can be dropped into any expression slot (nested path editing).
const rootOf = (sc, id) => (id.startsWith('hat:') ? sc.hat : findBlock(sc, id).block);
const getPath = (o, path) => path.reduce((x, k) => x?.[k], o);
function setIn(o, path, value) {
  for (let i = 0; i < path.length - 1; i++) o = o[path[i]];
  o[path[path.length - 1]] = value;
}
function setPath(ctx, id, path, value, typing) {
  commit('Edit block', (p) => {
    const sc = p.scripts.find((x) => x.id === ctx.s.id);
    setIn(rootOf(sc, id).args, path, value);
  }, { coalesce: 'blk:' + id + ':' + path.join('.'), origin: typing ? 'logic' : undefined });
}
const isRep = (v) => !!v && typeof v === 'object' && !!v.$b;
export const repCapable = (d) => !!d && d.kind !== 'hat' && (d.rep || d.reporter);
const repParts = (d) => d.repParts || [{ ja: d.title, en: d.en || d.title }, ...Object.keys(d.fields || {}).filter((k) => k !== 'to').map((k) => E(k))];
const E = (k) => ({ f: k });
export function newRep(type, args) {
  const d = blocks.get(type);
  return { id: 'r' + Math.random().toString(36).slice(2, 8), type, args: { ...clone(d.defaults || {}), ...(args || {}) } };
}
let lastFocus = null;

const sizeFor = (v, min = 3) => Math.max(min, Math.min(40, String(v ?? '').length + 1));

function textInput(v, ph, onType, cls = 'f f-expr', list, onFocus) {
  const i = h('input', { class: cls, value: v ?? '', placeholder: ph || '', size: sizeFor(v, ph ? Math.max(5, Math.min(ph.length + 1, 10)) : 3), spellcheck: 'false', list: list ? (typeof list === 'string' ? list : 'dl-names') : null });
  i.addEventListener('input', () => { i.size = sizeFor(i.value); onType(i.value); });
  if (onFocus) i.addEventListener('focus', onFocus);
  return i;
}

function sel(options, value, onChange, placeholder = '(選択)') {
  return h('select', { class: 'f f-sel', onchange: (e) => onChange(e.target.value) },
    h('option', { value: '' }, placeholder), options.map(([v, l]) => h('option', { value: v, selected: v === value }, l)));
}

/** expression slot: text input, or an embedded value block; accepts dropped value blocks */
function exprSlot(ctx, id, vpath, v, ph) {
  const wrap = h('span', { class: 'rslot' });
  if (isRep(v)) wrap.append(repEl(ctx, id, vpath, v.$b));
  else {
    const inp = textInput(v, ph, (x) => setPath(ctx, id, vpath, x, true), 'f f-expr', true, () => { lastFocus = { sid: ctx.s.id, id, vpath }; });
    // Ctrl+V pastes a copied value block instead of text
    inp.addEventListener('keydown', (e) => { if (ui.clip?.kind === 'rep' && matchAction(e, 'paste')) { e.preventDefault(); lastFocus = { sid: ctx.s.id, id, vpath }; pasteRep(); } });
    wrap.append(inp);
  }
  wrap.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('application/x-codiram-rep')) { e.preventDefault(); e.stopPropagation(); wrap.classList.add('over'); } });
  wrap.addEventListener('dragleave', () => wrap.classList.remove('over'));
  wrap.addEventListener('drop', (e) => { wrap.classList.remove('over'); dropRep(ctx, e, id, vpath); });
  return wrap;
}

function repEl(ctx, id, vpath, rb) {
  const def = blocks.get(rb.type);
  if (!def) return h('span', { class: 'rep err' }, '?');
  const cat = catOf(def.cat), inner = [...vpath, '$b', 'args'];
  return h('span', { class: 'rep' + (def.bool ? ' hex' : ''), style: { '--cat': cat.color }, draggable: 'true', title: blockTitle(def),
    ondragstart: (e) => {
      e.stopPropagation();
      const copy = e.altKey || e.ctrlKey || e.metaKey; // Alt / Ctrl + drag duplicates
      e.dataTransfer.setData('application/x-codiram-rep', JSON.stringify(copy ? { kind: 'copy', block: rb } : { kind: 'move', id, path: vpath }));
      e.dataTransfer.effectAllowed = 'copyMove'; document.body.classList.add('dragging-blocks');
    },
    ondragend: () => document.body.classList.remove('dragging-blocks') },
  h('span', { class: 'b-ico shape-' + cat.shape }, def.icon),
  repParts(def).map((part) => (part.f !== undefined && !isBi(part) ? fieldEl(ctx, id, def, part.f, rb.args, inner) : L(part) === '' ? null : h('span', { class: 'b-txt' }, part))),
  h('button', { class: 'rep-x rep-dup', title: '複製(クリップボードへ。入力欄を選んで Ctrl+V / Alt+ドラッグでも複製)', onclick: (e) => { e.stopPropagation(); ui.clip = { kind: 'rep', data: clone(rb) }; toast('値ブロックをコピーしました。入力欄を選んで Ctrl+V で貼り付け'); } }, '⧉'),
  h('button', { class: 'rep-x', title: '値ブロックを外す', onclick: (e) => { e.stopPropagation(); setPath(ctx, id, vpath, ''); } }, '✕'));
}

function dropRep(ctx, e, id, vpath) {
  const raw = e.dataTransfer.getData('application/x-codiram-rep');
  if (!raw) return;
  e.preventDefault(); e.stopPropagation();
  document.body.classList.remove('dragging-blocks');
  const d = JSON.parse(raw);
  if (d.kind === 'new') { setPath(ctx, id, vpath, { $b: newRep(d.type, d.args) }); return; }
  if (d.kind === 'copy') { setPath(ctx, id, vpath, { $b: freshRep(d.block) }); return; }
  if (d.id === id && vpath.join('.').startsWith(d.path.join('.'))) return; // not into itself
  commit('Move value block', (p) => {
    const sc = p.scripts.find((x) => x.id === ctx.s.id);
    const sroot = rootOf(sc, d.id).args;
    const val = getPath(sroot, d.path);
    setIn(sroot, d.path, '');
    setIn(rootOf(sc, id).args, vpath, val);
  });
}

/** deep copy of a value block with new ids (nested value blocks too) */
function freshRep(rb) {
  const c = clone(rb);
  const re = (x) => { if (x && typeof x === 'object') { if (x.$b) { x.$b.id = 'r' + Math.random().toString(36).slice(2, 8); } Object.values(x).forEach(re); } };
  c.id = 'r' + Math.random().toString(36).slice(2, 8);
  re(c.args);
  return c;
}

export function pasteRep() {
  if (ui.clip?.kind !== 'rep') return false;
  const lf = lastFocus, s = script();
  if (!lf || !s || lf.sid !== s.id || (!lf.id.startsWith('hat:') && !findBlock(s, lf.id))) { toast('貼り付ける式の入力欄を先に選んでください'); return true; }
  setPath({ s }, lf.id, lf.vpath, { $b: freshRep(ui.clip.data) });
  return true;
}

export function insertRepAtFocus(type) {
  const lf = lastFocus;
  const s = script();
  if (!lf || !s || lf.sid !== s.id || (!lf.id.startsWith('hat:') && !findBlock(s, lf.id))) { toast('値ブロックは、式の入力欄にドラッグするか、入力欄を選んでからクリックしてください'); return; }
  setPath({ s }, lf.id, lf.vpath, { $b: newRep(type) });
}

function fieldEl(ctx, id, def, key, args, path) {
  const f = def.fields[key], v = args[key], p = proj();
  const vpath = [...path, key];
  const set = (val, typing) => setPath(ctx, id, vpath, val, typing);
  switch (f.t) {
    case 'expr': return exprSlot(ctx, id, vpath, v, f.ph);
    case 'text': return textInput(v, f.ph, (x) => set(x, true), 'f', f.list);
    case 'ident': return textInput(v, f.ph, (x) => set(sanitizeIdent(x), true), 'f f-expr');
    case 'comp': {
      const opts = allNodes(p).filter((x) => x.node.type !== 'page' && (!f.types || f.types.includes(x.node.type))).map((x) => [x.node.id, `${x.node.name} (${x.node.type})`]);
      if (!f.types || f.sprite) {
        if (f.sprite) opts.unshift(['@me', J('(衝突イベントの自分側)', '(collision: this one)')]);
        opts.unshift(['@it', J('(現在のクローン/衝突の相手)', '(current clone / collision partner)')]);
      }
      return sel(opts, v, set, '(部品を選択)');
    }
    case 'model': return sel(p.models.map((m) => [m.name, m.name]), v, (x) => { set(x); }, '(モデル)');
    case 'page': return sel(p.pages.map((x) => [x.id, x.name]), v, set, '(ページ)');
    case 'fn': return sel(fnNames(p).map((n) => [n, n]), v, set, '(関数)');
    case 'select': return sel(f.opts, v, set);
    case 'code': {
      const ta = h('textarea', { class: 'f f-expr code', rows: 3, placeholder: f.ph || '', spellcheck: 'false' });
      ta.value = v ?? '';
      ta.addEventListener('input', () => set(ta.value, true));
      return ta;
    }
    case 'asset': return sel((p.assets || []).filter((a) => !f.kind || a.kind === f.kind).map((a) => ['assets/' + a.name, a.name]), v, set, '(アセット)');
    case 'fieldname': {
      const m = p.models.find((x) => x.name === args.model);
      return sel((m?.fields || []).map((x) => [x.name, x.name]), v, set, '(フィールド)');
    }
    case 'var': {
      const vt = f.vt;
      const list = p.variables.filter((x) => !vt || x.type === vt || x.name === v);
      return h('select', { class: 'f f-sel', onchange: async (e) => {
        if (e.target.value !== '__new') return set(e.target.value);
        const nv = await promptVariable(vt);
        if (!nv) { renderLogic(root); return; }
        const vn = sanitizeIdent(nv.name);
        commit('Add variable', (pp) => {
          if (!pp.variables.some((x) => x.name === vn)) pp.variables.push({ name: vn, type: nv.type, initial: defaultInitial(nv.type) });
          const sc = pp.scripts.find((x) => x.id === ctx.s.id);
          setIn(rootOf(sc, id).args, vpath, vn);
        });
      } }, h('option', { value: '' }, '(変数)'), list.map((x) => h('option', { value: x.name, selected: x.name === v }, x.name)), h('option', { value: '__new' }, '＋ 新規変数…'));
    }
    case 'anim': return h('select', { class: 'f f-sel', onchange: (e) => set(e.target.value) }, h('option', { value: '' }, '(選択)'),
      ['in', 'loop', 'once'].map((k) => h('optgroup', { label: L({ in: { ja: '登場', en: 'Entrance' }, loop: { ja: '繰り返し', en: 'Looping' }, once: { ja: '単発・強調・退場', en: 'One-shot / exit' } }[k]) },
        Object.entries(ANIMS).filter(([, a]) => a.kind === k).map(([n, a]) => h('option', { value: n, selected: n === v }, L({ ja: a.ja, en: a.en }))))));
    case 'cond': return condEl(ctx, id, vpath, v || defaultCond());
    case 'values': return valuesEl(ctx, id, vpath, args, v || {});
    default: return h('span', {}, String(v ?? ''));
  }
}

function condEl(ctx, id, cpath, c) {
  const upd = (fn) => { const n = clone(c); fn(n); setPath(ctx, id, cpath, n); };
  const wrap = h('span', { class: 'cond' });
  c.rows.forEach((r, i) => {
    const rp = [...cpath, 'rows', i];
    wrap.append(h('span', { class: 'cond-row' },
      exprSlot(ctx, id, [...rp, 'l'], r.l, 'left'),
      h('select', { class: 'f f-sel op', onchange: (e) => upd((n) => { n.rows[i].op = e.target.value; }) }, COND_OPS.map(([v, l]) => h('option', { value: v, selected: v === r.op }, l))),
      ['empty', 'notempty', 'js', 'true'].includes(r.op) ? null : exprSlot(ctx, id, [...rp, 'r'], r.r, 'right'),
      c.rows.length > 1 ? h('button', { class: 'mini', title: '条件を削除', onclick: () => upd((n) => n.rows.splice(i, 1)) }, '✕') : null,
      i < c.rows.length - 1 ? h('select', { class: 'f f-sel join', onchange: (e) => upd((n) => { n.join = e.target.value; }) }, [['and', 'かつ'], ['or', 'または']].map(([v, l]) => h('option', { value: v, selected: c.join === v }, l))) : null));
  });
  wrap.append(h('button', { class: 'mini', title: '条件を追加 (AND/OR)', onclick: () => upd((n) => n.rows.push({ l: '', op: '==', r: '' })) }, '＋'),
    h('label', { class: 'not', title: '条件全体を否定 (NOT)' }, h('input', { type: 'checkbox', checked: !!c.not, onchange: (e) => upd((n) => { n.not = e.target.checked; }) }), 'NOT'));
  return wrap;
}

function valuesEl(ctx, id, vpath, args, vals) {
  const m = proj().models.find((x) => x.name === args.model);
  if (!m) return h('span', { class: 'muted' }, '(先にモデルを選択)');
  return h('span', { class: 'values' }, m.fields.map((f) => h('span', { class: 'val' }, h('span', { class: 'b-txt' }, f.name + ' ='),
    exprSlot(ctx, id, [...vpath, f.name], vals[f.name], f.name === 'id' ? '自動' : ''))));
}

// ---------------------------------------------------------------- selection & operations
function selectBlockOnly(id) { ui.selBlocks = new Set([id]); markSel(); }
function clearSel() { ui.selBlocks.clear(); markSel(); }
let lastSel = null;
function selectBlock(e, id) {
  if (e.ctrlKey || e.metaKey) ui.selBlocks.has(id) ? ui.selBlocks.delete(id) : ui.selBlocks.add(id);
  else if (e.shiftKey && lastSel && lastSel !== id) {
    const all = [...els.work.querySelectorAll('.block[data-bid]')].map((x) => x.dataset.bid);
    const a = all.indexOf(lastSel), b = all.indexOf(id);
    if (a >= 0 && b >= 0) ui.selBlocks = new Set(all.slice(Math.min(a, b), Math.max(a, b) + 1).filter((x) => !x.startsWith('hat:')));
  } else ui.selBlocks = new Set([id]);
  lastSel = id;
  markSel();
}
function markSel() { els.work?.querySelectorAll('.block[data-bid]').forEach((b) => b.classList.toggle('sel', ui.selBlocks.has(b.dataset.bid))); }

/** selected ids in document order, dropping blocks whose ancestor is also selected */
function selectedTop() {
  const s = script(); if (!s) return [];
  const out = [];
  const visit = (arr, ancestorSel) => arr.forEach((b) => {
    const sel = ui.selBlocks.has(b.id);
    if (sel && !ancestorSel) out.push(b.id);
    Object.values(b.slots || {}).forEach((x) => visit(x, ancestorSel || sel));
  });
  visit(s.body, false);
  return out;
}

export function deleteSel() {
  const ids = selectedTop();
  if (!ids.length) return false;
  commit(`Delete ${ids.length} block(s)`, (p) => {
    const sc = p.scripts.find((x) => x.id === ui.selScript);
    ids.forEach((id) => { const f = findBlock(sc, id); if (f) f.arr.splice(f.idx, 1); });
  });
  ui.selBlocks.clear();
  renderLogic(root);
  toast(tf('{0} 個のブロックを削除しました', ids.length), { label: '元に戻す', fn: () => nav.undo() });
  return true;
}

export function copySel() {
  const ids = selectedTop();
  if (!ids.length) return false;
  const s = script();
  ui.clip = { kind: 'blocks', data: ids.map((id) => clone(findBlock(s, id).block)) };
  toast(tf('{0} 個のブロックをコピーしました', ids.length));
  return true;
}

export function pasteSel() {
  if (ui.clip?.kind !== 'blocks') return false;
  const ids = selectedTop();
  const added = [];
  commit('Paste blocks', (p) => {
    const sc = p.scripts.find((x) => x.id === ui.selScript);
    if (!sc) return;
    let arr = sc.body, at = sc.body.length;
    if (ids.length) { const f = findBlock(sc, ids[ids.length - 1]); if (f) { arr = f.arr; at = f.idx + 1; } }
    ui.clip.data.forEach((b, i) => { const c = freshBlockClone(b); added.push(c.id); arr.splice(at + i, 0, c); });
  });
  ui.selBlocks = new Set(added);
  renderLogic(root);
  return true;
}

export function duplicateSel() { if (copySel()) pasteSel(); }

export function logicKey(e) {
  if (matchAction(e, 'delete')) return deleteSel();
  if (matchAction(e, 'copy')) return copySel();
  if (matchAction(e, 'paste')) return ui.clip?.kind === 'rep' ? pasteRep() : pasteSel();
  if (matchAction(e, 'duplicate')) { duplicateSel(); return true; }
  if (matchAction(e, 'selectall')) { const s = script(); if (!s) return false; const all = new Set(); walkBlocks(s.body, (b) => all.add(b.id)); ui.selBlocks = all; markSel(); return true; }
  if (e.key === 'Escape') { clearSel(); return true; }
  return false;
}

// ---------------------------------------------------------------- palette
let palMode = 'all'; // all | cmd | rep
function renderPalette() {
  const R = els.right;
  R.textContent = '';
  R.append(h('div', { class: 'panel-title' }, 'Blocks'),
    h('div', { class: 'seg' }, [['all', J('すべて', 'All')], ['cmd', J('命令', 'Commands')], ['rep', J('値(丸・六角)', 'Values')]].map(([k, l]) =>
      h('button', { class: palMode === k ? 'on' : '', onclick: () => { palMode = k; renderPalette(); } }, l))),
    h('input', { class: 'inp search', placeholder: '🔍 Search blocks...', value: search, 'data-search': '1', oninput: (e) => { search = e.target.value; fillBlocks(); } }));
  els.pal = h('div', { class: 'scroll' });
  R.append(els.pal);
  fillBlocks();
}

function paletteItem(cat, d, title, make, asRep) {
  const isHat = d.kind === 'hat';
  const kind = asRep ? 'rep' : 'block';
  return h('div', { class: 'blk-item' + (asRep ? ' rep-item' + (d.bool ? ' hex' : '') : ''), style: { '--cat': cat.color }, draggable: isHat ? null : 'true',
    title: isHat ? 'クリックで新規スクリプトを作成' : asRep ? '式の入力欄へドラッグ(または入力欄を選んでクリック)' : 'クリックで追加 / ドラッグで配置',
    ondragstart: (e) => { const m = make(); e.dataTransfer.setData(asRep ? 'application/x-codiram-rep' : 'application/x-codiram-block', JSON.stringify({ kind: 'new', type: m.type, args: m.args })); e.dataTransfer.effectAllowed = 'copy'; document.body.classList.add('dragging-blocks'); },
    ondragend: () => document.body.classList.remove('dragging-blocks'),
    onclick: () => (isHat ? createScript(d.type) : asRep ? insertRepAtFocus(make().type) : addBlock(make())) },
  h('span', { class: 'b-ico shape-' + cat.shape }, d.icon), h('span', {}, title), asRep ? h('em', { class: 'rep-tag' }, d.bool ? '⬡' : '◯') : null);
}

function fillBlocks() {
  const q = search.trim().toLowerCase();
  els.pal.textContent = '';
  const fns = fnNames(proj());
  const match = (x, cat) => !q || (x.title + (x.d.en || '') + x.d.title + cat.label + cat.ja + x.d.type).toLowerCase().includes(q);
  for (const cat of BLOCK_CATS) {
    const tid = activeTargetId(proj());
    const all = [...blocks.values()].filter((d) => d.cat === cat.id && blockVisible(d) && (blockSupports(d, tid) || blockSupports(d, tid, true)));
    let cmds = palMode === 'rep' ? [] : all.filter((d) => d.kind !== 'reporter').map((d) => ({ d, title: blockTitle(d), make: () => ({ type: d.type }) }));
    if (cat.id === 'Control' && palMode !== 'rep') fns.forEach((n) => cmds.push({ d: blocks.get('call_fn'), title: tf('ƒ {0} を実行', n), make: () => ({ type: 'call_fn', args: { name: n } }) }));
    const reps = palMode === 'cmd' ? [] : all.filter((d) => repCapable(d) && blockSupports(d, activeTargetId(proj()), true)).map((d) => ({ d, title: blockTitle(d), make: () => ({ type: d.type }) }));
    const rc = cmds.filter((x) => match(x, cat)), rr = reps.filter((x) => match(x, cat));
    if (!rc.length && !rr.length) continue;
    const key = 'bpal:' + cat.id, closed = ui.collapsed.has(key) && !q;
    els.pal.append(h('div', { class: 'cat' },
      h('button', { class: 'cat-head', style: { '--cat': cat.color }, onclick: () => { closed ? ui.collapsed.delete(key) : ui.collapsed.add(key); fillBlocks(); } },
        closed ? '▸ ' : '▾ ', h('span', { class: 'b-ico shape-' + cat.shape }, cat.icon), ' ' + catName(cat)),
      closed ? null : h('div', { class: 'cat-body' },
        rc.map(({ d, title, make }) => paletteItem(cat, d, title, make, false)),
        rr.length ? h('div', { class: 'cat-sub' }, J('値ブロック(式に入れる)', 'Value blocks (drop into a field)')) : null,
        rr.map(({ d, title, make }) => paletteItem(cat, d, title, make, true)))));
  }
}

function addBlock(m) {
  const s = script();
  if (!s) { toast('先にスクリプト(イベント)を作成してください'); return; }
  const ids = selectedTop();
  let newId;
  commit('Add block', (p) => {
    const sc = p.scripts.find((x) => x.id === s.id);
    const b = newBlock(m.type, m.args);
    newId = b.id;
    let arr = sc.body, at = sc.body.length;
    if (ids.length) { const f = findBlock(sc, ids[ids.length - 1]); if (f) { arr = f.arr; at = f.idx + 1; } }
    arr.splice(at, 0, b);
  });
  ui.selBlocks = new Set([newId]);
  renderLogic(root);
}

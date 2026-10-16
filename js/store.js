// Project store: current project, Undo/Redo history, autosave (localStorage), UI state.
import { emptyProject, normalizeProject } from './model.js';
import { clone, uid } from './util.js';

const KEY_INDEX = 'codiram.projects';
const KEY_P = 'codiram.project.';

/** Non-persistent UI state shared between views. */
export const ui = {
  view: 'start', pageId: null, selNode: null, selScript: null, selModel: null,
  selBlocks: new Set(), clip: null,
  collapsed: new Set(['Math', 'Text', 'List', 'Object', 'Time', 'Data', 'Animation', 'System'].map((c) => 'bpal:' + c)), leftTab: 'components',
  navOpen: { left: true, right: true }, errors: [], focusBlock: null,
};

export const store = { project: null, undoStack: [], redoStack: [], status: 'saved' };

const listeners = new Set();
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const emit = (origin) => listeners.forEach((f) => f(origin));

// ---------- history ----------
export function commit(label, fn, opts = {}) {
  const snap = JSON.stringify(store.project);
  fn(store.project);
  const now = Date.now();
  const last = store.undoStack[store.undoStack.length - 1];
  if (opts.coalesce && last && last.key === opts.coalesce && now - last.t < 1500) last.t = now;
  else {
    store.undoStack.push({ label, snap, key: opts.coalesce, t: now });
    if (store.undoStack.length > 200) store.undoStack.shift();
  }
  store.redoStack = [];
  store.project.updated = now;
  markDirty();
  emit(opts.origin);
}

function restore(snap) {
  store.project = JSON.parse(snap);
  markDirty();
  emit();
}

export function undo() {
  const e = store.undoStack.pop();
  if (!e) return false;
  store.redoStack.push({ label: e.label, snap: JSON.stringify(store.project) });
  restore(e.snap);
  return e.label;
}

export function redo() {
  const e = store.redoStack.pop();
  if (!e) return false;
  store.undoStack.push({ label: e.label, snap: JSON.stringify(store.project) });
  restore(e.snap);
  return e.label;
}

/** Jump back so that undoStack has `n` entries left. */
export function jumpTo(n) { while (store.undoStack.length > n && undo() !== false); }

// ---------- persistence ----------
let timer;
function setStatus(s) { store.status = s; emit('status'); }

export function markDirty() {
  setStatus('saving');
  clearTimeout(timer);
  timer = setTimeout(saveNow, 500);
}

export function saveNow() {
  clearTimeout(timer);
  if (!store.project) return true;
  try {
    localStorage.setItem(KEY_P + store.project.id, JSON.stringify(store.project));
    const idx = listProjects().filter((p) => p.id !== store.project.id);
    idx.push({ id: store.project.id, name: store.project.name, updated: store.project.updated });
    localStorage.setItem(KEY_INDEX, JSON.stringify(idx));
    setStatus('saved');
    return true;
  } catch (e) {
    setStatus('error');
    return false;
  }
}

export function listProjects() {
  try { return JSON.parse(localStorage.getItem(KEY_INDEX) || '[]').sort((a, b) => b.updated - a.updated); } catch { return []; }
}

function reset(project) {
  store.project = project;
  store.undoStack = [];
  store.redoStack = [];
  Object.assign(ui, { pageId: project.pages[0]?.id, selNode: null, selScript: project.scripts[0]?.id || null, selModel: project.models[0]?.id || null, errors: [] });
  ui.selBlocks.clear();
}

export function openProject(id) {
  const raw = localStorage.getItem(KEY_P + id);
  if (!raw) return false;
  reset(normalizeProject(JSON.parse(raw)));
  store.status = 'saved';
  return true;
}

export function newProject(template) {
  const p = template ? template.build() : emptyProject();
  reset(p);
  saveNow();
}

export function saveAs(name) {
  const p = clone(store.project);
  p.id = uid('p'); p.name = name; p.created = p.updated = Date.now();
  p.settings = { ...p.settings, title: name };
  reset(p);
  saveNow();
}

export function importProject(json) {
  const p = typeof json === 'string' ? JSON.parse(json) : json;
  if (!p.pages || !p.models || !p.scripts) throw new Error('Codiramのプロジェクトファイルではありません');
  normalizeProject(p);
  p.id = uid('p'); p.updated = Date.now();
  reset(p);
  saveNow();
}

export function deleteProject(id) {
  localStorage.removeItem(KEY_P + id);
  localStorage.setItem(KEY_INDEX, JSON.stringify(listProjects().filter((p) => p.id !== id)));
}

export function duplicateProject(id) {
  const raw = localStorage.getItem(KEY_P + id);
  if (!raw) return;
  const p = JSON.parse(raw);
  p.id = uid('p'); p.name += ' (copy)'; p.updated = Date.now();
  localStorage.setItem(KEY_P + p.id, JSON.stringify(p));
  localStorage.setItem(KEY_INDEX, JSON.stringify([...listProjects(), { id: p.id, name: p.name, updated: p.updated }]));
}

// ---------- My Components (reusable UI parts, shared by all projects) ----------
const KEY_LIB = 'codiram.library';
export const getLibrary = () => { try { return JSON.parse(localStorage.getItem(KEY_LIB) || '[]'); } catch { return []; } };
export const setLibrary = (l) => { try { localStorage.setItem(KEY_LIB, JSON.stringify(l)); } catch { /* ignore */ } };

/** Navigation hook, assigned by main.js (avoids circular imports from views). */
export const nav = { go: () => {}, run: () => {}, undo: () => {} };

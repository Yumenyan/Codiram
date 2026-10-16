// Customisable keyboard shortcuts. Bindings are stored per action in localStorage.
import { J } from './i18n-helpers.js';

export const ACTIONS = [
  { id: 'save', label: J('保存', 'Save'), def: ['Ctrl+S'] },
  { id: 'undo', label: J('元に戻す', 'Undo'), def: ['Ctrl+Z'] },
  { id: 'redo', label: J('やり直し', 'Redo'), def: ['Ctrl+Y', 'Ctrl+Shift+Z'] },
  { id: 'run', label: J('実行 (Preview)', 'Run (Preview)'), def: ['F5'] },
  { id: 'search', label: J('検索欄へ移動', 'Focus search'), def: ['Ctrl+F'] },
  { id: 'copy', label: J('コピー', 'Copy'), def: ['Ctrl+C'] },
  { id: 'paste', label: J('貼り付け', 'Paste'), def: ['Ctrl+V'] },
  { id: 'duplicate', label: J('複製', 'Duplicate'), def: ['Ctrl+D'] },
  { id: 'delete', label: J('削除', 'Delete'), def: ['Delete', 'Backspace'] },
  { id: 'selectall', label: J('すべて選択(Logic)', 'Select all blocks (Logic)'), def: ['Ctrl+A'] },
  { id: 'design', label: J('Design 画面へ', 'Go to Design'), def: ['Alt+1'] },
  { id: 'data', label: J('Data 画面へ', 'Go to Data'), def: ['Alt+2'] },
  { id: 'logic', label: J('Logic 画面へ', 'Go to Logic'), def: ['Alt+3'] },
  { id: 'preview', label: J('Preview 画面へ', 'Go to Preview'), def: ['Alt+4'] },
];

const KEY = 'codiram.shortcuts';
let custom = {};
try { custom = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { custom = {}; }

export function comboOf(e) {
  const k = e.key;
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(k)) return '';
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  parts.push(k.length === 1 ? k.toUpperCase() : k);
  return parts.join('+');
}
// Alt+digit reports a different e.key on some layouts; fall back to e.code
const comboOfCode = (e) => (/^Digit\d$/.test(e.code) && e.altKey ? ['Alt', e.code.slice(5)].join('+') : '');

export const bindings = (id) => custom[id] || ACTIONS.find((a) => a.id === id)?.def || [];
export function matchAction(e, id) {
  const c = comboOf(e);
  return !!c && (bindings(id).includes(c) || (comboOfCode(e) !== '' && bindings(id).includes(comboOfCode(e))));
}
export function setBinding(id, combos) {
  custom[id] = combos;
  try { localStorage.setItem(KEY, JSON.stringify(custom)); } catch { /* ignore */ }
}
export function resetBindings() {
  custom = {};
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
export const isCustom = (id) => !!custom[id];

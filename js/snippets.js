// Implementation templates ("snippets"): common processing as ready-made block groups, plus your own.
// A snippet = { id, name:{ja,en}, desc:{ja,en}, vars:[{name,type,initial}], hat?:{type,args}, blocks:[block trees] }.
import { blocks } from './registry.js';
import { newBlock, newScript, freshBlockClone } from './model.js';
import { uid, clone } from './util.js';

const KEY = 'codiram.snippets';
const b = (type, args, slots) => { const x = newBlock(type, args); if (slots) Object.assign(x.slots, slots); return x; };
const cond = (l, op, r) => ({ rows: [{ l, op, r }], join: 'and', not: false });
const rep = (type, args) => ({ $b: { id: uid('r'), type, args } });
const J = (ja, en) => ({ ja, en });

/** built-in snippets (blocks use only common blocks, so they work for every block-based generator) */
export const BUILTIN = [
  { id: 'count-up', name: J('カウントアップ', 'Count up'), desc: J('変数 count を 1 増やす', 'Adds 1 to the variable count'),
    vars: [{ name: 'count', type: 'Number', initial: '0' }], blocks: [b('change_var', { name: 'count', by: '1' })] },
  { id: 'sum-loop', name: J('合計を求める(繰り返し)', 'Sum with a loop'), desc: J('1 から n までを total に足していく', 'Adds 1…n into total'),
    vars: [{ name: 'total', type: 'Number', initial: '0' }, { name: 'n', type: 'Number', initial: '10' }, { name: 'i', type: 'Number', initial: '0' }],
    blocks: [b('set_var', { name: 'total', value: '0' }), b('set_var', { name: 'i', value: '0' }), b('repeat', { times: 'n' }, { body: [b('change_var', { name: 'i', by: '1' }), b('change_var', { name: 'total', by: 'i' })] })] },
  { id: 'validate-empty', name: J('入力チェック(空ならメッセージ)', 'Validate: message when empty'), desc: J('変数 text が空なら警告を出す', 'Warns when the variable text is empty'),
    vars: [{ name: 'text', type: 'String', initial: '' }], blocks: [b('if', { cond: cond('text', 'empty', '') }, { then: [b('alert', { value: '"入力してください"' })], else: [] })] },
  { id: 'delay-run', name: J('少し待ってから実行', 'Wait, then continue'), desc: J('1 秒待ってからメッセージを表示', 'Waits 1 second, then shows a message'),
    vars: [], blocks: [b('wait', { ms: '1000' }), b('alert', { value: '"時間になりました"' })] },
  { id: 'save-load', name: J('ブラウザに保存 / 読み込み', 'Save / load in the browser'), desc: J('変数 note を保存し、次回起動時に読み込む', 'Saves the variable note and loads it again'),
    vars: [{ name: 'note', type: 'String', initial: '' }], blocks: [b('store_set', { key: 'note', value: 'note' }), b('store_get', { to: 'note', key: 'note', def: '""' })] },
  { id: 'fetch-json', name: J('Web API から取得して変数へ', 'Fetch from a web API into a variable'), desc: J('URL の JSON を data に入れる', 'Puts the JSON from a URL into data'),
    vars: [{ name: 'data', type: 'Object', initial: '{}' }], blocks: [b('sys_fetch', { to: 'data', method: 'GET', url: '"https://api.example.com/data"', body: '' })] },
  { id: 'random-pick', name: J('ランダムに選ぶ', 'Pick randomly'), desc: J('1〜6 の乱数が 3 以上なら "当たり"', 'A number 1–6; 3 or more means a win'),
    vars: [{ name: 'dice', type: 'Number', initial: '0' }, { name: 'result', type: 'String', initial: '' }],
    blocks: [b('math_random', { to: 'dice', min: '1', max: '6' }), b('if', { cond: cond('dice', '>=', '3') }, { then: [b('set_var', { name: 'result', value: '"当たり"' })], else: [b('set_var', { name: 'result', value: '"はずれ"' })] })] },
  { id: 'join-text', name: J('文字を組み立てる', 'Build a text'), desc: J('"こんにちは、" + name + "さん"', 'Joins texts and a variable'),
    vars: [{ name: 'name', type: 'String', initial: '' }, { name: 'message', type: 'String', initial: '' }],
    blocks: [b('set_var', { name: 'message', value: rep('text_join', { a: '"こんにちは、"', b: 'name', c: '"さん"' }) })] },
  { id: 'copy-notify', name: J('コピーして知らせる', 'Copy and notify'), desc: J('message をクリップボードにコピーして表示', 'Copies message and shows it'),
    vars: [{ name: 'message', type: 'String', initial: '' }], blocks: [b('sys_copy', { value: 'message' }), b('alert', { value: '"コピーしました"' })] },
];

/** replaceable storage (localStorage in the browser, memory in tests) */
export const snippetStorage = { mem: '[]', get() { try { return localStorage.getItem(KEY) ?? this.mem; } catch { return this.mem; } }, set(v) { this.mem = v; try { localStorage.setItem(KEY, v); } catch { /* ignore */ } } };
export const userSnippets = () => { try { return JSON.parse(snippetStorage.get() || '[]'); } catch { return []; } };
const saveUser = (list) => snippetStorage.set(JSON.stringify(list));

/** variable names a block tree refers to (fields of type var) */
function usedVars(list, project, out = new Map()) {
  for (const x of list) {
    const def = blocks.get(x.type);
    for (const [k, f] of Object.entries(def?.fields || {})) if (f.t === 'var' && x.args[k]) { const v = project.variables.find((y) => y.name === x.args[k]); if (v) out.set(v.name, { name: v.name, type: v.type, initial: v.initial }); }
    Object.values(x.slots || {}).forEach((s) => usedVars(s, project, out));
  }
  return out;
}

/** register your own snippet from blocks (e.g. the selected blocks) */
export function saveSnippet(name, blockList, project, desc = '') {
  const s = { id: 'u-' + uid('s'), user: true, name: { ja: name, en: name }, desc: { ja: desc, en: desc }, vars: [...usedVars(blockList, project).values()], blocks: blockList.map((x) => clone(x)) };
  saveUser([...userSnippets(), s]);
  return s;
}
export const deleteSnippet = (id) => saveUser(userSnippets().filter((s) => s.id !== id));
export const allSnippets = () => [...BUILTIN, ...userSnippets()];

/** import / export snippets as JSON (share them, or let an AI write some) */
export const exportSnippets = (list) => JSON.stringify({ format: 'codiram-snippets', version: 1, snippets: list.map((s) => ({ ...s, user: undefined })) }, null, 2) + '\n';
export function importSnippets(text) {
  const d = JSON.parse(text);
  if (d.format !== 'codiram-snippets' || !Array.isArray(d.snippets)) throw new Error('format must be "codiram-snippets"');
  const bad = d.snippets.flatMap((s) => (s.blocks || []).filter((x) => !blocks.get(x.type)).map((x) => x.type));
  if (bad.length) throw new Error('unknown block types: ' + [...new Set(bad)].join(', '));
  const list = d.snippets.map((s) => ({ ...s, id: 'u-' + uid('s'), user: true, name: s.name || { ja: 'snippet', en: 'snippet' }, desc: s.desc || { ja: '', en: '' }, vars: s.vars || [] }));
  saveUser([...userSnippets(), ...list]);
  return list.length;
}

/** add the snippet to a project draft (inside commit()): variables it needs are created, blocks appended to the script or a new script is made */
export function insertSnippet(project, snippet, scriptId, afterBlockId = null) {
  for (const v of snippet.vars || []) if (!project.variables.some((x) => x.name === v.name)) project.variables.push({ ...v });
  const fresh = snippet.blocks.map((x) => freshBlockClone(x));
  if (snippet.hat) {
    const s = newScript(project, project.pages[0].id, snippet.hat.type, snippet.hat.args);
    s.body = fresh; project.scripts.push(s);
    return s.id;
  }
  const sc = project.scripts.find((x) => x.id === scriptId);
  if (!sc) return null;
  let arr = sc.body, at = sc.body.length;
  if (afterBlockId) {
    const find = (list) => { for (let i = 0; i < list.length; i++) { if (list[i].id === afterBlockId) return { list, i }; for (const sl of Object.values(list[i].slots || {})) { const r = find(sl); if (r) return r; } } return null; };
    const f = find(sc.body);
    if (f) { arr = f.list; at = f.i + 1; }
  }
  arr.splice(at, 0, ...fresh);
  return sc.id;
}

/** one-line-per-block outline for the preview */
export function outline(list, depth = 0, out = []) {
  for (const x of list) {
    const def = blocks.get(x.type);
    const args = Object.entries(x.args).filter(([, v]) => typeof v === 'string' && v).map(([k, v]) => `${k}=${v}`).join(', ');
    out.push('  '.repeat(depth) + (def?.title || x.type) + (args ? `  (${args.slice(0, 60)})` : ''));
    for (const [k, s] of Object.entries(x.slots || {})) if (s.length) { out.push('  '.repeat(depth + 1) + k + ':'); outline(s, depth + 2, out); }
  }
  return out;
}

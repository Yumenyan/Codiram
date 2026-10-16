// Plugin packs: built-in feature groups that can be switched on/off, plus user-installed plugins (.js modules).
// A plugin is { id, name, desc, components:[], blocks:[], modules:{ name: 'runtime code' }, install(api) }.
import { components, blocks, plugins, registerPlugin } from './registry.js';
import { J } from './i18n-helpers.js';

export const PACKS = [
  { id: 'game', name: J('ゲーム', 'Game toolkit'), desc: J('ステージ・スプライト・物理・衝突・クローン・キャンバス描画', 'Stage, sprites, physics, collisions, clones, canvas drawing'),
    components: ['stage', 'sprite', 'canvas'], cats: ['Game', 'Draw'], blocks: ['onFrame', 'onCollide', 'onKeyUp', 'onPress', 'onRelease'] },
  { id: 'sound', name: J('サウンド', 'Sound'), desc: J('音声再生・効果音・メロディ・読み上げ', 'Audio playback, sound effects, melodies, speech'), components: ['audio'], cats: ['Sound'], blocks: [] },
  { id: 'chartmap', name: J('グラフ・地図', 'Charts & Map'), desc: J('Chart / Map 部品', 'Chart and Map components'), components: ['chart', 'map'], cats: [], blocks: ['map_set'] },
  { id: 'net', name: J('通信・ファイル', 'Network & files'), desc: J('Web API (fetch)・WebSocket・CSV・ファイル入力', 'fetch, WebSocket, CSV and file input'), components: ['fileinput'],
    cats: [], blocks: ['sys_fetch', 'ws_connect', 'ws_send', 'ws_close', 'onWsMessage', 'r_ws_message', 'csv_download', 'csv_text', 'csv_import', 'file_read'] },
  { id: 'anim', name: J('アニメーション', 'Animation'), desc: J('アニメーションブロック(再生・トゥイーン)', 'Animation blocks (play, tween)'), components: [], cats: ['Animation'], blocks: [] },
];

const KEY = 'codiram.packs.off';
let off = new Set();
try { off = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { /* ignore */ }

const packOfType = new Map(), packOfCat = new Map();
function index() {
  PACKS.forEach((p) => {
    p.components.forEach((t) => packOfType.set('c:' + t, p.id));
    p.blocks.forEach((t) => packOfType.set('b:' + t, p.id));
    p.cats.forEach((c) => packOfCat.set(c, p.id));
  });
}
index();

export const packEnabled = (id) => !off.has(id);
export function setPackEnabled(id, on) {
  on ? off.delete(id) : off.add(id);
  try { localStorage.setItem(KEY, JSON.stringify([...off])); } catch { /* ignore */ }
}
export const componentVisible = (d) => !off.has(packOfType.get('c:' + d.type)) && !off.has(d.plugin);
export const blockVisible = (d) => !off.has(packOfType.get('b:' + d.type)) && !off.has(packOfCat.get(d.cat)) && !off.has(d.plugin);

// ---- user-installed plugins (code is kept in localStorage and re-loaded at start-up)
const CODE_KEY = 'codiram.plugin.code';
export const installedCode = () => { try { return JSON.parse(localStorage.getItem(CODE_KEY) || '[]'); } catch { return []; } };
const saveCode = (list) => { try { localStorage.setItem(CODE_KEY, JSON.stringify(list)); } catch { /* ignore */ } };

export async function loadPluginSource(code) {
  const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  try {
    const mod = await import(/* @vite-ignore */ url);
    const p = mod.default || mod.plugin;
    if (!p || !p.id) throw new Error('export default { id, name, … } が見つかりません');
    (p.components || []).forEach((d) => { d.plugin = p.id; });
    (p.blocks || []).forEach((d) => { d.plugin = p.id; });
    registerPlugin(p);
    return p;
  } finally { URL.revokeObjectURL(url); }
}
export async function installPlugin(name, code) {
  const p = await loadPluginSource(code);
  saveCode([...installedCode().filter((x) => x.id !== p.id), { id: p.id, name, code }]);
  return p;
}
export function uninstallPlugin(id) { saveCode(installedCode().filter((x) => x.id !== id)); }
export async function loadInstalledPlugins() {
  for (const x of installedCode()) { try { await loadPluginSource(x.code); } catch (e) { console.warn('plugin failed', x.name, e); } }
}
export const userPlugins = () => plugins.filter((p) => installedCode().some((x) => x.id === p.id));
export { components, blocks };

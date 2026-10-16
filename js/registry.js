// Central registries. Components, blocks and exporters are all registered here,
// so a plugin only has to call registerPlugin({ components, blocks, ... }).

export const components = new Map();
export const blocks = new Map();
export const exporters = new Map();
export const plugins = [];

export const registerComponent = (def) => components.set(def.type, def);
export const registerBlock = (def) => blocks.set(def.type, def);
export const registerExporter = (def) => exporters.set(def.id, def);

/**
 * Plugin shape (all keys optional):
 * { id, name, components: [], blocks: [], exporters: [], install(api) }
 * Future: dataTypes, dataSources, templates.
 */
export function registerPlugin(plugin) {
  plugins.push(plugin);
  (plugin.components || []).forEach(registerComponent);
  (plugin.blocks || []).forEach(registerBlock);
  (plugin.exporters || []).forEach(registerExporter);
  plugin.install?.({ registerComponent, registerBlock, registerExporter });
}

// color + shape + icon + label are all used so categories never rely on colour alone.
export const BLOCK_CATS = [
  { id: 'Events', label: 'Events', ja: 'イベント', icon: '⚡', color: '#d97706', shape: 'hex' },
  { id: 'Variables', label: 'Variables', ja: '変数', icon: '𝑥', color: '#2563eb', shape: 'circle' },
  { id: 'Conditions', label: 'Conditions', ja: '条件', icon: '？', color: '#7c3aed', shape: 'diamond' },
  { id: 'Control', label: 'Control', ja: '制御', icon: '↻', color: '#0d9488', shape: 'square' },
  { id: 'Math', label: 'Math', ja: '演算', icon: '∑', color: '#0284c7', shape: 'circle' },
  { id: 'Text', label: 'Text', ja: '文字列', icon: 'Aa', color: '#c026d3', shape: 'pill' },
  { id: 'List', label: 'List', ja: '配列', icon: '▤', color: '#4f46e5', shape: 'square' },
  { id: 'Object', label: 'Object', ja: 'オブジェクト', icon: '{}', color: '#78716c', shape: 'pill' },
  { id: 'Time', label: 'Time', ja: '日付・時刻', icon: '◷', color: '#92400e', shape: 'circle' },
  { id: 'Data', label: 'Data', ja: 'データ', icon: '▦', color: '#be185d', shape: 'square' },
  { id: 'UI', label: 'UI', ja: 'UI', icon: '▢', color: '#4d7c0f', shape: 'tri' },
  { id: 'Game', label: 'Game', ja: 'ゲーム', icon: '🎮', color: '#16a34a', shape: 'hex' },
  { id: 'Sound', label: 'Sound', ja: 'サウンド', icon: '♪', color: '#db2777', shape: 'circle' },
  { id: 'Draw', label: 'Draw', ja: '描画', icon: '✎', color: '#0891b2', shape: 'diamond' },
  { id: 'Animation', label: 'Animation', ja: 'アニメーション', icon: '✦', color: '#ea580c', shape: 'diamond' },
  { id: 'System', label: 'System', ja: 'システム', icon: '⚙', color: '#334155', shape: 'hex' },
];
export const catOf = (id) => BLOCK_CATS.find((c) => c.id === id) || BLOCK_CATS[0];

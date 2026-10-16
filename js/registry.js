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

export const BLOCK_CATS = [
  { id: 'Events', label: 'Events', ja: 'イベント', icon: '⚡', color: '#d97706', pattern: 'solid' },
  { id: 'Variables', label: 'Variables', ja: '変数', icon: '𝑥', color: '#2563eb', pattern: 'dashed' },
  { id: 'Conditions', label: 'Conditions', ja: '条件', icon: '？', color: '#7c3aed', pattern: 'double' },
  { id: 'Control', label: 'Control', ja: '制御', icon: '↻', color: '#0d9488', pattern: 'dotted' },
  { id: 'Data', label: 'Data', ja: 'データ', icon: '▦', color: '#be185d', pattern: 'groove' },
  { id: 'UI', label: 'UI', ja: 'UI', icon: '▢', color: '#4d7c0f', pattern: 'ridge' },
];
export const catOf = (id) => BLOCK_CATS.find((c) => c.id === id) || BLOCK_CATS[0];

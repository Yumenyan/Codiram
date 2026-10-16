// Central registries. Components, blocks and exporters are all registered here,
// so a plugin only has to call registerPlugin({ components, blocks, ... }).

export const components = new Map();
export const blocks = new Map();
export const exporters = new Map();
export const plugins = [];
export const pluginModules = {}; // extra runtime code from plugins (name -> JS source)

export const registerComponent = (def) => components.set(def.type, def);
/** Every block declares which targets it can be used for ('web', 'minecraft', …). Default: web only. */
export const registerBlock = (def) => { def.targets = def.targets || ['web']; blocks.set(def.type, def); };
/**
 * Can this block be used for the generator `targetId`?
 *  1. the block lists the generator in `targets`, or is `portable` and the generator accepts portable blocks,
 *     or the generator `inherits` another generator's blocks (Desktop = Web blocks + desktop blocks);
 *  2. every capability the block needs (`caps`, default: by category) is offered by the generator (`supports`);
 *  3. generators that work from the IR (engine 'ir') also need an `ir` / `irHat` / `irExpr` implementation.
 */
export function blockSupports(def, targetId, asValue = false) {
  if (!def) return false;
  const gen = targets.get(targetId);
  const listed = (def.targets || ['web']).includes(targetId);
  const inherited = !!gen?.inherits && blockSupports(def, gen.inherits, asValue);
  if (!listed && !inherited && !(def.portable && gen?.portable)) return false;
  if (gen?.supports && !blockCaps(def).every((c) => gen.supports.includes(c))) return false;
  if (targetId === 'web' || gen?.engine === 'blocks') return true;
  return asValue ? !!def.irExpr : def.kind === 'hat' ? !!def.irHat : def.kind === 'reporter' ? false : !!def.ir;
}

/** Capabilities a block needs. Explicit `def.caps` wins; otherwise they follow from its category. Common blocks need none. */
const CAT_CAPS = { UI: ['ui'], Draw: ['canvas'], Sound: ['audio'], Game: ['game'], Animation: ['animation'], Data: ['data'], Minecraft: ['minecraft'] };
export const blockCaps = (def) => def.caps || CAT_CAPS[def.cat] || [];

/**
 * Generators (execution environments / languages Codiram can generate for). See docs/GENERATOR_SDK.md.
 * Use `defineGenerator()` from js/sdk to build one; the registry only needs { id, name, ... generate }.
 */
export const targets = new Map();
export const GeneratorRegistry = {
  register(def) {
    targets.set(def.id, def);
    const sorted = [...targets.values()].sort((a, b) => (a.order ?? 9) - (b.order ?? 9));
    targets.clear();
    sorted.forEach((t) => targets.set(t.id, t));
    return def;
  },
  unregister: (id) => targets.delete(id),
  get: (id) => targets.get(id),
  /** hidden/paused generators are only listed on request (they still work for projects that already use them) */
  list: ({ includeHidden = false } = {}) => [...targets.values()].filter((t) => includeHidden || !t.hidden),
  findByCapability: (cap) => [...targets.values()].filter((t) => (t.supports || []).includes(cap)),
};
export const registerTarget = (def) => GeneratorRegistry.register(def);
export const activeTargetId = (project) => project?.activeTarget || project?.targets?.[0]?.type || 'web';
export const activeTarget = (project) => targets.get(activeTargetId(project));
export const registerExporter = (def) => exporters.set(def.id, def);

/**
 * Plugin shape (all keys optional):
 * { id, name, components: [], blocks: [], exporters: [], generators: [], install(api) }
 * Future: dataTypes, dataSources, templates.
 */
/** Filled in by the Generator SDK (registry.js must not import it): lets plugins ship generators. */
export const hooks = {};

export function registerPlugin(plugin) {
  plugins.push(plugin);
  (plugin.components || []).forEach(registerComponent);
  (plugin.blocks || []).forEach(registerBlock);
  (plugin.exporters || []).forEach(registerExporter);
  Object.assign(pluginModules, plugin.modules || {});
  // generators: full specs for defineGenerator(), or declarative generator specs (pure data, format 'codiram-generator')
  (plugin.generators || []).forEach((g) => (g.format === 'codiram-generator' ? hooks.defineDeclarativeGenerator(g) : hooks.defineGenerator(g)));
  plugin.install?.({ registerComponent, registerBlock, registerExporter, defineGenerator: (g) => hooks.defineGenerator(g), defineDeclarativeGenerator: (g) => hooks.defineDeclarativeGenerator(g) });
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
  { id: 'Minecraft', label: 'Minecraft', ja: 'Minecraft', icon: '⛏', color: '#5b8c2a', shape: 'square' },
  { id: 'System', label: 'System', ja: 'システム', icon: '⚙', color: '#334155', shape: 'hex' },
];
export const catOf = (id) => BLOCK_CATS.find((c) => c.id === id) || BLOCK_CATS[0];

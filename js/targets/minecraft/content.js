// Content definitions (Items / Blocks / Recipes) -> Fabric registration code + data/asset JSON (+ generated textures).
import { texturePng } from '../../png.js';
import { dataUrlToBytes } from '../../generator.js';
import { javaIdent } from './java.js';

export const MATERIALS = [['STONE', '石', 'stone'], ['METAL', '金属', 'metal'], ['WOOD', '木', 'wood'], ['GLASS', 'ガラス', 'glass'], ['SOIL', '土', 'dirt']];
const ID = /^[a-z][a-z0-9_]*$/;

export const emptyContent = () => ({ items: [], blocks: [], recipes: [] });
export const hasContent = (p) => !!p.content && (p.content.items.length || p.content.blocks.length || p.content.recipes.length);
/** full id ("ruby" -> "mymod:ruby"; ids that already have a namespace are kept) */
export const fullId = (modId, id) => (String(id).includes(':') ? String(id).trim() : `${modId}:${String(id).trim()}`);
export const contentIds = (project, modId) => ({
  items: [...project.content.items.map((i) => `${modId}:${i.id}`), ...project.content.blocks.map((b) => `${modId}:${b.id}`)],
  blocks: project.content.blocks.map((b) => `${modId}:${b.id}`),
});

export function validateContent(project) {
  const c = project.content || emptyContent(), out = [];
  const seen = new Set();
  const num = (v) => v !== '' && !Number.isNaN(Number(v));
  for (const [kind, list] of [['アイテム', c.items], ['ブロック', c.blocks]]) {
    for (const x of list) {
      if (!ID.test(x.id || '')) out.push({ msg: `${kind}のID「${x.id || ''}」は 小文字英字で始まり、小文字・数字・_ のみで指定してください`, content: true });
      else if (seen.has(x.id)) out.push({ msg: `ID「${x.id}」が重複しています(アイテムとブロックで共通)`, content: true });
      seen.add(x.id);
      if (!String(x.name || '').trim()) out.push({ msg: `${kind}「${x.id}」の表示名が空です`, content: true });
    }
  }
  for (const b of c.blocks) for (const k of ['hardness', 'resistance', 'light']) if (!num(b[k])) out.push({ msg: `ブロック「${b.id}」の ${k} は数値で指定してください`, content: true });
  const rseen = new Set();
  for (const r of c.recipes) {
    if (!ID.test(r.id || '')) out.push({ msg: `レシピのID「${r.id || ''}」は 小文字英字で始まり、小文字・数字・_ のみで指定してください`, content: true });
    else if (rseen.has(r.id)) out.push({ msg: `レシピID「${r.id}」が重複しています`, content: true });
    rseen.add(r.id);
    if (!String(r.result || '').trim()) out.push({ msg: `レシピ「${r.id}」の完成品が空です`, content: true });
    if (r.kind === 'shaped' && !(r.grid || []).some((g) => String(g || '').trim())) out.push({ msg: `レシピ「${r.id}」の材料が空です`, content: true });
    if (r.kind === 'shapeless' && !String(r.ingredients || '').trim()) out.push({ msg: `レシピ「${r.id}」の材料が空です`, content: true });
    if (r.kind === 'smelting' && !String(r.ingredient || '').trim()) out.push({ msg: `レシピ「${r.id}」の材料が空です`, content: true });
  }
  return out;
}

const json = (o) => JSON.stringify(o, null, 2) + '\n';
const constName = (id) => javaIdent(id.toUpperCase(), 'C_');

/** -> { java, files, hasAny } */
export function generateContent(project, cfg) {
  const c = project.content || emptyContent(), mod = cfg.modId, pkg = cfg.package;
  const files = {}, items = [], blocks = [], lang = {};
  const res = `src/main/resources/assets/${mod}`, dat = `src/main/resources/data/${mod}`;
  const assetBytes = (path) => { const a = (project.assets || []).find((x) => 'assets/' + x.name === path); return a ? dataUrlToBytes(a.data) : null; };

  for (const it of c.items) {
    const name = constName(it.id);
    let settings = 'new FabricItemSettings().group(ItemGroup.MISC)';
    const stack = Math.max(1, Math.min(64, Math.round(Number(it.maxStack) || 64)));
    if (stack !== 64) settings += `.maxCount(${stack})`;
    if (Number(it.hunger) > 0) settings += `.food(new FoodComponent.Builder().hunger(${Math.round(Number(it.hunger))}).saturationModifier(${Number(it.saturation ?? 0.3)}f).build())`;
    items.push(`    public static final Item ${name} = Registry.register(Registry.ITEM, new Identifier("${mod}", "${it.id}"), new Item(${settings}));`);
    lang[`item.${mod}.${it.id}`] = it.name;
    files[`${res}/models/item/${it.id}.json`] = json({ parent: 'item/generated', textures: { layer0: `${mod}:item/${it.id}` } });
    files[`${res}/textures/item/${it.id}.png`] = (it.texture && assetBytes(it.texture)) || texturePng(it.color, 'item', it.id);
  }
  for (const b of c.blocks) {
    const name = constName(b.id);
    const mat = MATERIALS.some((m) => m[0] === b.material) ? b.material : 'STONE';
    items.push(`    public static final Block ${name} = Registry.register(Registry.BLOCK, new Identifier("${mod}", "${b.id}"), new Block(FabricBlockSettings.of(Material.${mat}).strength(${Number(b.hardness)}f, ${Number(b.resistance)}f).luminance(state -> ${Math.max(0, Math.min(15, Math.round(Number(b.light) || 0)))})));`);
    items.push(`    public static final Item ${name}_ITEM = Registry.register(Registry.ITEM, new Identifier("${mod}", "${b.id}"), new BlockItem(${name}, new FabricItemSettings().group(ItemGroup.BUILDING_BLOCKS)));`);
    lang[`block.${mod}.${b.id}`] = b.name;
    files[`${res}/blockstates/${b.id}.json`] = json({ variants: { '': { model: `${mod}:block/${b.id}` } } });
    files[`${res}/models/block/${b.id}.json`] = json({ parent: 'block/cube_all', textures: { all: `${mod}:block/${b.id}` } });
    files[`${res}/models/item/${b.id}.json`] = json({ parent: `${mod}:block/${b.id}` });
    files[`${res}/textures/block/${b.id}.png`] = (b.texture && assetBytes(b.texture)) || texturePng(b.color, 'block', b.id);
    files[`${dat}/loot_tables/blocks/${b.id}.json`] = json({ type: 'minecraft:block', pools: [{ rolls: 1.0, bonus_rolls: 0.0, entries: [{ type: 'minecraft:item', name: `${mod}:${b.id}` }], conditions: [{ condition: 'minecraft:survives_explosion' }] }] });
  }
  if (Object.keys(lang).length) files[`${res}/lang/en_us.json`] = json(lang);

  for (const r of c.recipes) {
    const result = fullId(mod, r.result), count = Math.max(1, Math.round(Number(r.count) || 1));
    const ing = (id) => ({ item: fullId(mod, id) });
    let body;
    if (r.kind === 'shaped') {
      const letters = {}, key = {};
      const rows = [0, 1, 2].map((row) => [0, 1, 2].map((col) => {
        const id = String((r.grid || [])[row * 3 + col] || '').trim();
        if (!id) return ' ';
        if (!letters[id]) { letters[id] = String.fromCharCode(65 + Object.keys(letters).length); key[letters[id]] = ing(id); }
        return letters[id];
      }).join(''));
      // trim empty rows/columns so the pattern is as small as possible
      let pat = rows.filter((x) => x.trim());
      const cols = [0, 1, 2].filter((i) => pat.some((rw) => rw[i] !== ' '));
      if (cols.length) pat = pat.map((rw) => cols.map((i) => rw[i]).join(''));
      body = { type: 'minecraft:crafting_shaped', pattern: pat, key, result: { item: result, count } };
    } else if (r.kind === 'shapeless') {
      body = { type: 'minecraft:crafting_shapeless', ingredients: String(r.ingredients).split(',').map((x) => x.trim()).filter(Boolean).slice(0, 9).map(ing), result: { item: result, count } };
    } else {
      body = { type: 'minecraft:smelting', ingredient: ing(r.ingredient), result, experience: Number(r.xp) || 0, cookingtime: Math.max(1, Math.round(Number(r.time) || 200)) };
    }
    files[`${dat}/recipes/${r.id}.json`] = json(body);
  }

  const any = c.items.length + c.blocks.length > 0;
  const java = `package ${pkg};

import net.fabricmc.fabric.api.item.v1.FabricItemSettings;
import net.fabricmc.fabric.api.object.builder.v1.block.FabricBlockSettings;
import net.minecraft.block.Block;
import net.minecraft.block.Material;
import net.minecraft.item.BlockItem;
import net.minecraft.item.FoodComponent;
import net.minecraft.item.Item;
import net.minecraft.item.ItemGroup;
import net.minecraft.util.Identifier;
import net.minecraft.util.registry.Registry;

/**
 * Items and blocks defined in Codiram ("Content"). Models, textures, language, loot tables and recipes are generated as JSON / PNG
 * under src/main/resources. Generated — re-exporting overwrites this file.
 */
public final class ModContent {
    private ModContent() {}

${items.length ? items.join('\n') : '    // (no items or blocks yet)'}

    /** Touching this class registers everything above. */
    public static void init() {}
}
`;
  return { java, files, any };
}

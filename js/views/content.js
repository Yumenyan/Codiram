// Data view panels for Minecraft "Content": Items, Blocks, Recipes.
import { h, sanitizeIdent } from '../util.js';
import { store, commit } from '../store.js';
import { MATERIALS, contentIds } from '../targets/minecraft/content.js';
import { ITEMS } from '../targets/minecraft/ids.js';
import { targetConfig } from '../model.js';
import { L } from '../i18n.js';

const proj = () => store.project;
const modId = () => targetConfig(proj(), 'minecraft')?.modId || 'mod';
const edit = (label, fn, opts) => commit(label, (p) => fn(p.content), opts);
const typing = (key) => ({ coalesce: key, origin: 'grid' });
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');

function idList() {
  const dl = h('datalist', { id: 'dl-content-ids' });
  [...new Set([...contentIds(proj(), modId()).items, ...ITEMS])].forEach((x) => dl.append(h('option', { value: x })));
  return dl;
}
function textureSelect(row, key, kind) {
  const pngs = proj().assets.filter((a) => a.kind === 'image');
  return h('select', { class: 'sel', title: 'テクスチャ(未選択=自動生成)', onchange: (e) => edit('Edit ' + kind, (c) => { c[kind][row.__i].texture = e.target.value; }) },
    h('option', { value: '' }, '(自動生成)'), pngs.map((a) => h('option', { value: 'assets/' + a.name, selected: row.texture === 'assets/' + a.name }, a.name)));
}
const col = (c, onInput) => h('input', { type: 'color', class: 'swatch', value: /^#[0-9a-f]{6}$/i.test(c || '') ? c : '#888888', oninput: (e) => onInput(e.target.value) });

export function contentEditor(kind) {
  const c = proj().content;
  const box = h('div', {}, idList());
  if (kind === 'items') {
    box.append(h('h3', {}, 'Items'), h('p', { class: 'muted' }, '新しいアイテムを追加します。IDは小文字英数字と _。「満腹回復」を 1 以上にすると食べ物になります。テクスチャを選ばないと、色から16×16の絵が自動生成されます。'));
    box.append(h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['ID', '表示名', '最大スタック', '満腹回復', '色', 'テクスチャ', ''].map((x) => h('th', {}, x)))),
      h('tbody', {}, c.items.map((it, i) => { it.__i = i; return h('tr', {},
        h('td', {}, h('input', { class: 'inp mono', value: it.id, onchange: (e) => edit('Edit item', (cc) => { cc.items[i].id = slug(e.target.value); }) })),
        h('td', {}, h('input', { class: 'inp', value: it.name, oninput: (e) => edit('Edit item', (cc) => { cc.items[i].name = e.target.value; }, typing('in' + i)) })),
        h('td', {}, h('input', { class: 'inp', type: 'number', min: 1, max: 64, value: it.maxStack, oninput: (e) => edit('Edit item', (cc) => { cc.items[i].maxStack = e.target.value; }, typing('is' + i)) })),
        h('td', {}, h('input', { class: 'inp', type: 'number', min: 0, max: 20, value: it.hunger, oninput: (e) => edit('Edit item', (cc) => { cc.items[i].hunger = e.target.value; }, typing('ih' + i)) })),
        h('td', {}, col(it.color, (v) => edit('Edit item', (cc) => { cc.items[i].color = v; }, typing('ic' + i)))),
        h('td', {}, textureSelect(it, 'texture', 'items')),
        h('td', {}, h('button', { class: 'icon-btn', title: '削除', onclick: () => edit('Delete item', (cc) => cc.items.splice(i, 1)) }, '✕'))); }))));
    box.append(h('button', { class: 'btn small', onclick: () => edit('Add item', (cc) => { let n = 1; while (cc.items.some((x) => x.id === 'item_' + n) || cc.blocks.some((x) => x.id === 'item_' + n)) n++; cc.items.push({ id: 'item_' + n, name: 'Item ' + n, maxStack: 64, hunger: 0, saturation: 0.3, color: '#4f8cff', texture: '' }); }) }, '＋ Item'));
  } else if (kind === 'blocks') {
    box.append(h('h3', {}, 'Blocks'), h('p', { class: 'muted' }, 'ブロックを追加します(ブロック自身をドロップし、ブロックアイテムも自動で作られます)。硬さ: 石=1.5 / 黒曜石=50、発光: 0〜15。'));
    box.append(h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['ID', '表示名', '素材', '硬さ', '爆発耐性', '発光', '色', 'テクスチャ', ''].map((x) => h('th', {}, x)))),
      h('tbody', {}, c.blocks.map((b, i) => { b.__i = i; return h('tr', {},
        h('td', {}, h('input', { class: 'inp mono', value: b.id, onchange: (e) => edit('Edit block', (cc) => { cc.blocks[i].id = slug(e.target.value); }) })),
        h('td', {}, h('input', { class: 'inp', value: b.name, oninput: (e) => edit('Edit block', (cc) => { cc.blocks[i].name = e.target.value; }, typing('bn' + i)) })),
        h('td', {}, h('select', { class: 'sel', onchange: (e) => edit('Edit block', (cc) => { cc.blocks[i].material = e.target.value; }) }, MATERIALS.map(([v, ja, en]) => h('option', { value: v, selected: b.material === v }, L({ ja, en }))))),
        ...['hardness', 'resistance', 'light'].map((k) => h('td', {}, h('input', { class: 'inp', type: 'number', step: 'any', value: b[k], oninput: (e) => edit('Edit block', (cc) => { cc.blocks[i][k] = e.target.value; }, typing('b' + k + i)) }))),
        h('td', {}, col(b.color, (v) => edit('Edit block', (cc) => { cc.blocks[i].color = v; }, typing('bc' + i)))),
        h('td', {}, textureSelect(b, 'texture', 'blocks')),
        h('td', {}, h('button', { class: 'icon-btn', title: '削除', onclick: () => edit('Delete block', (cc) => cc.blocks.splice(i, 1)) }, '✕'))); }))));
    box.append(h('button', { class: 'btn small', onclick: () => edit('Add block', (cc) => { let n = 1; while (cc.items.some((x) => x.id === 'block_' + n) || cc.blocks.some((x) => x.id === 'block_' + n)) n++; cc.blocks.push({ id: 'block_' + n, name: 'Block ' + n, material: 'STONE', hardness: 2, resistance: 6, light: 0, color: '#7a8aa0', texture: '' }); }) }, '＋ Block'));
  } else {
    box.append(h('h3', {}, 'Recipes'), h('p', { class: 'muted' }, '材料・完成品は「mymod:ruby」のように書きます(自分のModのIDは名前だけでも可)。作業台(形あり/形なし)とかまど(精錬)に対応。'));
    c.recipes.forEach((r, i) => {
      const set = (fn, k) => edit('Edit recipe', (cc) => fn(cc.recipes[i]), k ? typing(k + i) : undefined);
      const ing = (value, on, ph = 'minecraft:stick') => h('input', { class: 'inp mono', list: 'dl-content-ids', value: value || '', placeholder: ph, oninput: (e) => on(e.target.value) });
      box.append(h('div', { class: 'asset-card', style: { marginBottom: '10px' } },
        h('div', { class: 'row-gap' },
          h('input', { class: 'inp mono', value: r.id, title: 'レシピID', onchange: (e) => set((x) => { x.id = slug(e.target.value); }) }),
          h('select', { class: 'sel', onchange: (e) => set((x) => { x.kind = e.target.value; }) }, [['shaped', '作業台(形あり)'], ['shapeless', '作業台(形なし)'], ['smelting', 'かまど(精錬)']].map(([v, l]) => h('option', { value: v, selected: r.kind === v }, l))),
          h('span', {}, '→'), ing(r.result, (v) => set((x) => { x.result = v; }, 'rr'), 'mymod:ruby'),
          h('input', { class: 'inp', type: 'number', min: 1, max: 64, style: { width: '64px' }, value: r.count, title: '個数', oninput: (e) => set((x) => { x.count = e.target.value; }, 'rc') }),
          h('button', { class: 'icon-btn', title: '削除', onclick: () => edit('Delete recipe', (cc) => cc.recipes.splice(i, 1)) }, '✕')),
        r.kind === 'shaped' ? h('div', { class: 'recipe-grid' }, [...Array(9)].map((_, k) => ing((r.grid || [])[k], (v) => set((x) => { x.grid = [...(x.grid || Array(9).fill(''))]; x.grid[k] = v; }, 'rg' + k), '(空)')))
          : r.kind === 'shapeless' ? ing(r.ingredients, (v) => set((x) => { x.ingredients = v; }, 'ri'), 'minecraft:stick, minecraft:coal')
          : h('div', { class: 'row-gap' }, ing(r.ingredient, (v) => set((x) => { x.ingredient = v; }, 'rs'), 'minecraft:iron_ore'),
            h('input', { class: 'inp', type: 'number', step: 'any', style: { width: '80px' }, value: r.xp, title: '経験値', oninput: (e) => set((x) => { x.xp = e.target.value; }, 'rx') }),
            h('input', { class: 'inp', type: 'number', style: { width: '90px' }, value: r.time, title: '調理時間(ティック)', oninput: (e) => set((x) => { x.time = e.target.value; }, 'rt') }))));
    });
    box.append(h('button', { class: 'btn small', onclick: () => edit('Add recipe', (cc) => { let n = 1; while (cc.recipes.some((x) => x.id === 'recipe_' + n)) n++; cc.recipes.push({ id: 'recipe_' + n, kind: 'shaped', result: '', count: 1, grid: Array(9).fill(''), ingredients: '', ingredient: '', xp: 0, time: 200 }); }) }, '＋ Recipe'));
  }
  return box;
}

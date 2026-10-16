// UI component definitions + HTML/CSS rendering shared by the Design canvas and the generated app.
import { registerComponent, components } from './registry.js';
import { esc } from './util.js';
import { fontStack, BUILTIN_FONTS, GOOGLE_FONTS } from './fonts.js';
import { ANIMS, HOVERS, EASINGS } from './animations.js';
import { J } from './i18n-helpers.js';
import { assetUrl } from './model.js';

export const BASE_CSS = `/* Base styles for Codiram components */
*, *::before, *::after { box-sizing: border-box; }
.cx { font-family: inherit; }
.cx-page, .cx-container, .cx-row, .cx-column, .cx-card, .cx-modal-box { display: flex; flex-direction: column; }
.cx-row { flex-direction: row; flex-wrap: wrap; align-items: center; }
.cx-text { white-space: pre-wrap; word-break: break-word; }
.cx-button { padding: 8px 16px; font: inherit; font-size: 14px; border: 1px solid #2563eb; background: #2563eb; color: #fff; border-radius: 6px; cursor: pointer; }
.cx-button:hover { filter: brightness(1.1); }
.cx-input, .cx-textarea, .cx-select { padding: 7px 10px; font: inherit; font-size: 14px; border: 1px solid #c4c9d4; border-radius: 6px; background: #fff; color: #1f2328; min-width: 0; }
.cx-textarea { min-height: 72px; resize: vertical; }
.cx-checkbox { display: flex; align-items: center; gap: 8px; font-size: 14px; }
.cx-card { border: 1px solid #d9dde5; border-radius: 10px; padding: 16px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
.cx-table { border-collapse: collapse; font-size: 14px; width: 100%; }
.cx-table th, .cx-table td { border: 1px solid #d9dde5; padding: 6px 10px; text-align: left; }
.cx-table th { background: #f3f5f8; }
.cx-list { margin: 0; padding-left: 20px; }
.cx-image { max-width: 100%; display: block; }
.cx-icon { font-size: 24px; line-height: 1; }
.cx-modal { position: fixed; inset: 0; background: rgba(15,23,42,.45); display: flex; align-items: center; justify-content: center; z-index: 100; }
.cx-modal-box { background: #fff; border-radius: 12px; padding: 20px; min-width: 280px; max-width: 90vw; max-height: 90vh; overflow: auto; box-shadow: 0 10px 40px rgba(0,0,0,.25); }
[hidden] { display: none !important; }
.cx-stage { position: relative; overflow: hidden; touch-action: none; user-select: none; }
.cx-sprite { position: absolute; display: grid; place-items: center; user-select: none; touch-action: none; line-height: 1; }
.cx-sprite img { width: 100%; height: 100%; object-fit: contain; pointer-events: none; }
.cx-sprite > span { pointer-events: none; }
.cx-canvas { display: block; max-width: 100%; }
.cx-audio { width: 100%; }
.cx-page { position: relative; }
.cx-round { border-radius: 50%; overflow: hidden; }
.cx-sprite[data-kind=shape] { background: #38bdf8; }
.cx-fake-select { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
`;

const px = (v) => (/^-?\d+(\.\d+)?$/.test(String(v).trim()) ? v + 'px' : v);

/** Style object -> array of CSS declarations. */
export function cssDecls(node) {
  const s = node.style || {};
  const d = [];
  const add = (k, v) => { if (v !== undefined && v !== '' && v !== null) d.push(`${k}: ${v}`); };
  if (s.left !== undefined || s.top !== undefined) { add('position', 'absolute'); add('left', px(s.left ?? 0)); add('top', px(s.top ?? 0)); }
  if (s.width) add('width', px(s.width));
  if (s.height) add('height', px(s.height));
  if (s.margin) add('margin', String(s.margin).split(/\s+/).map(px).join(' '));
  if (s.padding) add('padding', String(s.padding).split(/\s+/).map(px).join(' '));
  if (s.gap) add('gap', px(s.gap));
  if (s.direction) add('flex-direction', s.direction);
  if (s.align) add('align-items', s.align);
  if (s.justify) add('justify-content', s.justify);
  if (s.wrap) add('flex-wrap', 'wrap');
  if (s.grow) add('flex', '1 1 0');
  if (s.color) add('color', s.color);
  if (s.background) add('background', s.background);
  if (s.fontSize) add('font-size', px(s.fontSize));
  if (s.fontFamily) add('font-family', fontStack(s.fontFamily));
  if (s.fontWeight) add('font-weight', s.fontWeight);
  else if (s.bold) add('font-weight', '700');
  if (s.radius !== undefined && s.radius !== '') add('border-radius', px(s.radius));
  if (Number(s.border) > 0) add('border', `${px(s.border)} solid ${s.borderColor || 'currentColor'}`);
  if (s.textAlign) add('text-align', s.textAlign);
  return d;
}

const PLACEHOLDER_IMG = "data:image/svg+xml;utf8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100"><rect width="160" height="100" fill="#e5e7eb"/><path d="M30 75l30-35 22 25 14-14 34 24z" fill="#9ca3af"/><circle cx="50" cy="30" r="8" fill="#9ca3af"/></svg>');

const sel = (project, name) => project.models.find((m) => m.name === name);
const splitList = (s) => String(s || '').split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
const bindAttr = (n) => (n.props.bind ? ` data-bind="${esc(n.props.bind)}"` : '');
const ro = (c) => (c.editor ? ' readonly tabindex="-1"' : '');

const EVENT_CLICK = [
  { key: 'click', label: 'On Click', hat: 'onClick' },
  { key: 'dblclick', label: 'On Double Click', hat: 'onDblClick' },
  { key: 'hover', label: 'On Hover', hat: 'onHover' },
];
const EVENT_CHANGE = [
  { key: 'change', label: 'On Change', hat: 'onChange' },
  { key: 'enter', label: 'On Enter key', hat: 'onEnter' },
];
const bindProp = { k: 'bind', label: 'Bind to variable', t: 'var', g: 'Data' };

const container = (cls, label, icon, extra = {}) => ({
  type: extra.type, label, cat: 'Layout', icon, container: true, events: EVENT_CLICK,
  defaults: { props: {}, style: { gap: '8', ...(extra.style || {}) } },
  props: [],
  render: (n, c, kids) => `<div${c.attrs(n, 'cx cx-' + cls)}>${kids}</div>`,
});

const defs = [
  {
    type: 'text', label: 'Text', cat: 'Basic', icon: 'T', events: EVENT_CLICK,
    defaults: { props: { text: 'Text' }, style: {} },
    props: [{ k: 'text', label: 'Text', t: 'textarea', g: 'General', ph: '{変数名} で変数の値を表示' }],
    render: (n, c) => `<div${c.attrs(n, 'cx cx-text', `data-text="${esc(n.props.text)}"`)}>${esc(n.props.text)}</div>`,
  },
  {
    type: 'button', label: 'Button', cat: 'Basic', icon: '▭', events: EVENT_CLICK,
    defaults: { props: { text: 'Button' }, style: {} },
    props: [{ k: 'text', label: 'Text', t: 'text', g: 'General' }],
    render: (n, c) => `<button${c.attrs(n, 'cx cx-button', 'type="button"')}>${esc(n.props.text)}</button>`,
  },
  {
    type: 'input', label: 'Input', cat: 'Basic', icon: '▁', events: EVENT_CHANGE,
    defaults: { props: { placeholder: '入力してください', inputType: 'text' }, style: {} },
    props: [
      { k: 'placeholder', label: 'Placeholder', t: 'text', g: 'General' },
      { k: 'inputType', label: 'Type', t: 'select', g: 'General', opts: ['text', 'number', 'email', 'password', 'date'] },
      bindProp,
    ],
    render: (n, c) => `<input${c.attrs(n, 'cx cx-input', `type="${esc(n.props.inputType || 'text')}" placeholder="${esc(n.props.placeholder)}"${bindAttr(n)}${ro(c)}`)}>`,
  },
  {
    type: 'textarea', label: 'Textarea', cat: 'Basic', icon: '≣', events: EVENT_CHANGE,
    defaults: { props: { placeholder: '' }, style: {} },
    props: [{ k: 'placeholder', label: 'Placeholder', t: 'text', g: 'General' }, bindProp],
    render: (n, c) => `<textarea${c.attrs(n, 'cx cx-textarea', `placeholder="${esc(n.props.placeholder)}"${bindAttr(n)}${ro(c)}`)}></textarea>`,
  },
  {
    type: 'checkbox', label: 'Checkbox', cat: 'Basic', icon: '☑', events: EVENT_CHANGE,
    defaults: { props: { text: 'Check me' }, style: {} },
    props: [{ k: 'text', label: 'Label', t: 'text', g: 'General' }, bindProp],
    render: (n, c) => `<label${c.attrs(n, 'cx cx-checkbox')}><input type="checkbox"${bindAttr(n)}> <span>${esc(n.props.text)}</span></label>`,
  },
  {
    type: 'select', label: 'Select', cat: 'Basic', icon: '▾', events: EVENT_CHANGE,
    defaults: { props: { options: '選択肢A, 選択肢B, 選択肢C' }, style: {} },
    props: [{ k: 'options', label: 'Options (カンマ区切り)', t: 'textarea', g: 'General' }, bindProp],
    render: (n, c) => c.editor
      ? `<div${c.attrs(n, 'cx cx-select cx-fake-select')}><span>${esc(splitList(n.props.options)[0] || '')}</span><span>▾</span></div>`
      : `<select${c.attrs(n, 'cx cx-select', bindAttr(n))}>${splitList(n.props.options).map((o) => `<option>${esc(o)}</option>`).join('')}</select>`,
  },
  container('container', 'Container', '▢', { type: 'container' }),
  container('row', 'Row', '↔', { type: 'row' }),
  container('column', 'Column', '↕', { type: 'column' }),
  container('card', 'Card', '▣', { type: 'card' }),
  {
    type: 'modal', label: 'Modal', cat: 'Layout', icon: '❏', container: true, childHost: '.cx-modal-box', cssTarget: ' .cx-modal-box',
    defaults: { props: { initiallyOpen: false }, style: { gap: '8' } },
    props: [],
    render: (n, c, kids) => `<div${c.attrs(n, 'cx cx-modal', c.editor ? '' : 'hidden')}><div class="cx-modal-box">${kids}</div></div>`,
  },
  {
    type: 'table', label: 'Table', cat: 'Data', icon: '▦',
    defaults: { props: { source: '', cols: '', deleteBtn: false, deleteLabel: '削除' }, style: {} },
    props: [
      { k: 'source', label: 'Data source (model)', t: 'model', g: 'Data' },
      { k: 'cols', label: 'Columns (空=全て)', t: 'text', g: 'Data', ph: 'name, email' },
      { k: 'deleteBtn', label: '行の削除ボタン', t: 'bool', g: 'Data' },
      { k: 'deleteLabel', label: '削除ボタンの文字', t: 'text', g: 'Data' },
    ],
    render: (n, c) => {
      const m = sel(c.project, n.props.source);
      const attrs = `data-source="${esc(n.props.source)}" data-cols="${esc(n.props.cols)}"${n.props.deleteBtn ? ` data-delete="${esc(n.props.deleteLabel || '削除')}"` : ''}`;
      let inner = '';
      if (c.editor) {
        if (!m) inner = '<tbody><tr><td>データモデルを選択してください</td></tr></tbody>';
        else {
          const cols = splitList(n.props.cols).length ? splitList(n.props.cols) : m.fields.map((f) => f.name);
          inner = `<thead><tr>${cols.map((x) => `<th>${esc(x)}</th>`).join('')}${n.props.deleteBtn ? '<th></th>' : ''}</tr></thead><tbody>` +
            m.rows.slice(0, 8).map((r) => `<tr>${cols.map((x) => `<td>${esc(r[x] ?? '')}</td>`).join('')}${n.props.deleteBtn ? `<td>${esc(n.props.deleteLabel || '削除')}</td>` : ''}</tr>`).join('') + '</tbody>';
        }
      }
      return `<table${c.attrs(n, 'cx cx-table', attrs)}>${inner}</table>`;
    },
  },
  {
    type: 'list', label: 'List', cat: 'Data', icon: '☰',
    defaults: { props: { source: '', template: '' }, style: {} },
    props: [
      { k: 'source', label: 'Data source (model)', t: 'model', g: 'Data' },
      { k: 'template', label: 'Item template', t: 'text', g: 'Data', ph: '{name} ({email})' },
    ],
    render: (n, c) => {
      const m = sel(c.project, n.props.source);
      const attrs = `data-source="${esc(n.props.source)}" data-template="${esc(n.props.template)}"`;
      let inner = '';
      if (c.editor) {
        if (!m) inner = '<li>データモデルを選択してください</li>';
        else {
          const tpl = n.props.template || `{${m.fields[0]?.name || 'id'}}`;
          inner = m.rows.slice(0, 8).map((r) => `<li>${esc(tpl.replace(/\{([^{}]+)\}/g, (x, k) => r[k.trim()] ?? x))}</li>`).join('');
        }
      }
      return `<ul${c.attrs(n, 'cx cx-list', attrs)}>${inner}</ul>`;
    },
  },
  {
    type: 'image', label: 'Image', cat: 'Media', icon: '🖼', events: EVENT_CLICK,
    defaults: { props: { src: '', alt: '' }, style: { width: '160' } },
    props: [{ k: 'src', label: 'Image URL', t: 'asset', g: 'General', kind: 'image', ph: 'https://... / assets/photo.png' }, { k: 'alt', label: 'Alt text', t: 'text', g: 'General' }],
    render: (n, c) => `<img${c.attrs(n, 'cx cx-image', `src="${esc((c.editor ? assetUrl(c.project, n.props.src) : n.props.src) || PLACEHOLDER_IMG)}" alt="${esc(n.props.alt)}"`)}>`,
  },
  {
    type: 'icon', label: 'Icon', cat: 'Media', icon: '★', events: EVENT_CLICK,
    defaults: { props: { icon: '⭐' }, style: {} },
    props: [{ k: 'icon', label: 'Icon', t: 'select', g: 'General', opts: ['⭐', '❤️', '✅', '❌', '⚠️', '🔍', '⚙️', '🏠', '📅', '📍', '🚃', '📊', '✉️', '🔔', '➕', '🗑️'] }],
    render: (n, c) => `<span${c.attrs(n, 'cx cx-icon')}>${esc(n.props.icon)}</span>`,
  },
  {
    type: 'video', label: 'Video', cat: 'Media', icon: '▶',
    defaults: { props: { src: '' }, style: { width: '320' } },
    props: [{ k: 'src', label: 'Video URL', t: 'asset', g: 'General', kind: 'video' }],
    render: (n, c) => `<video${c.attrs(n, 'cx cx-video', `controls src="${esc(c.editor ? assetUrl(c.project, n.props.src) : n.props.src)}"`)}></video>`,
  },
  // ---- game / media components ----
  {
    type: 'stage', label: 'Stage', cat: 'Game', icon: '🎮', container: true, freeLayout: true, events: EVENT_CLICK,
    defaults: { props: {}, style: { width: '640', height: '400', background: '#0f172a', radius: '8' } },
    props: [],
    render: (n, c, kids) => `<div${c.attrs(n, 'cx cx-stage')}>${kids}</div>`,
  },
  {
    type: 'sprite', label: 'Sprite', cat: 'Game', icon: '👾', events: [...EVENT_CLICK, { key: 'press', label: 'On Press', hat: 'onPress' }, { key: 'release', label: 'On Release', hat: 'onRelease' }],
    defaults: { props: { kind: 'emoji', emoji: '🚀', src: '', circle: false }, style: { width: '56', height: '56' } },
    props: [
      { k: 'kind', label: 'Look', t: 'select', g: 'General', opts: [['emoji', J('絵文字/文字', 'Emoji / text')], ['image', J('画像', 'Image')], ['shape', J('図形(塗りつぶし)', 'Shape (filled)')]] },
      { k: 'emoji', label: 'Emoji / text', t: 'text', g: 'General' },
      { k: 'src', label: 'Image', t: 'asset', g: 'General', ph: 'assets/player.png' },
      { k: 'circle', label: 'Round shape', t: 'bool', g: 'General' },
    ],
    render: (n, c) => {
      const w = Number(n.style.width) || 56, h = Number(n.style.height) || 56, kind = n.props.kind;
      const inner = kind === 'image' ? `<img src="${esc(c.editor ? assetUrl(c.project, n.props.src) : n.props.src)}" alt="">` : kind === 'shape' ? '' : `<span style="font-size:${Math.round(Math.min(w, h) * 0.8)}px">${esc(n.props.emoji)}</span>`;
      return `<div${c.attrs(n, 'cx cx-sprite' + (n.props.circle ? ' cx-round' : ''), `data-kind="${esc(kind)}"`)}>${inner}</div>`;
    },
  },
  {
    type: 'canvas', label: 'Canvas', cat: 'Game', icon: '🖌', events: EVENT_CLICK,
    defaults: { props: {}, style: { width: '480', height: '320', background: '#ffffff' } },
    props: [],
    render: (n, c) => `<canvas${c.attrs(n, 'cx cx-canvas', `width="${Number(n.style.width) || 480}" height="${Number(n.style.height) || 320}"`)}></canvas>`,
  },
  {
    type: 'audio', label: 'Audio', cat: 'Media', icon: '🔊',
    defaults: { props: { src: '', controls: true, loop: false, autoplay: false }, style: {} },
    props: [
      { k: 'src', label: 'Audio file', t: 'asset', g: 'General', kind: 'audio', ph: 'assets/bgm.mp3' },
      { k: 'controls', label: 'Show controls', t: 'bool', g: 'General' },
      { k: 'loop', label: 'Loop', t: 'bool', g: 'General' },
      { k: 'autoplay', label: 'Autoplay', t: 'bool', g: 'General' },
    ],
    render: (n, c) => `<audio${c.attrs(n, 'cx cx-audio', `src="${esc(c.editor ? assetUrl(c.project, n.props.src) : n.props.src)}"${n.props.controls ? ' controls' : ''}${n.props.loop ? ' loop' : ''}${n.props.autoplay && !c.editor ? ' autoplay' : ''}`)}></audio>`,
  },
  // Page root (not shown in palette)
  {
    type: 'page', label: 'Page', cat: null, icon: '▭', container: true, hidden: true,
    defaults: { props: {}, style: {} }, props: [],
    render: (n, c, kids) => `<div${c.attrs(n, 'cx cx-page')}>${kids}</div>`,
  },
];
defs.forEach(registerComponent);

// Placeholders for future plugins (shown disabled in the palette).
export const COMING_SOON = [
  { label: 'Map', icon: '🗺', cat: 'Advanced' },
  { label: 'Chart', icon: '📈', cat: 'Advanced' },
  { label: 'Custom Component', icon: '🧩', cat: 'Advanced' },
];

export const CATS = ['Basic', 'Layout', 'Data', 'Media', 'Game', 'Advanced'];

/** Common property schema (layout/style) appended to each component's own props. */
export function propSchema(node) {
  const def = components.get(node.type);
  const isC = !!def.container;
  const out = [{ k: 'name', label: 'Name', t: 'name', g: 'General', top: true }];
  out.push(...def.props);
  if (node.type !== 'page') out.push({ k: 'hiddenInitially', label: '最初は非表示', t: 'bool', g: 'General', hide: node.type === 'modal' });
  out.push(
    { k: 'width', label: 'Width', t: 'text', g: 'Layout', s: true, ph: 'auto / 200 / 50%' },
    { k: 'height', label: 'Height', t: 'text', g: 'Layout', s: true, ph: 'auto' },
    { k: 'margin', label: 'Margin', t: 'text', g: 'Layout', s: true, ph: '8 / 8 16' },
    { k: 'padding', label: 'Padding', t: 'text', g: 'Layout', s: true, ph: '8 / 8 16' },
  );
  if (node.type !== 'page') out.push({ k: 'grow', label: '余白を埋める (flex:1)', t: 'bool', g: 'Layout', s: true });
  if (isC) {
    out.push(
      { k: 'direction', label: 'Direction', t: 'select', g: 'Layout', s: true, opts: ['', ['column', J('縦並び', 'Vertical')], ['row', J('横並び', 'Horizontal')]] },
      { k: 'gap', label: 'Gap', t: 'text', g: 'Layout', s: true },
      { k: 'align', label: 'Align items', t: 'select', g: 'Layout', s: true, opts: ['', ['flex-start', J('開始側', 'Start')], ['center', J('中央', 'Center')], ['flex-end', J('終了側', 'End')], ['stretch', J('引き伸ばし', 'Stretch')]] },
      { k: 'justify', label: 'Justify', t: 'select', g: 'Layout', s: true, opts: ['', ['flex-start', J('開始側', 'Start')], ['center', J('中央', 'Center')], ['flex-end', J('終了側', 'End')], ['space-between', J('両端揃え', 'Space between')]] },
      { k: 'wrap', label: 'Wrap', t: 'bool', g: 'Layout', s: true },
    );
  }
  out.push(
    { k: 'color', label: 'Text color', t: 'color', g: 'Style', s: true },
    { k: 'background', label: 'Background', t: 'color', g: 'Style', s: true },
    { k: 'fontFamily', label: 'Font', t: 'font', g: 'Style', s: true },
    { k: 'fontSize', label: 'Font size', t: 'text', g: 'Style', s: true, ph: '16' },
    { k: 'fontWeight', label: 'Font weight', t: 'select', g: 'Style', s: true, opts: ['', ['300', J('細字 (300)', 'Light (300)')], ['400', J('標準 (400)', 'Regular (400)')], ['500', J('中太 (500)', 'Medium (500)')], ['700', J('太字 (700)', 'Bold (700)')], ['900', J('極太 (900)', 'Black (900)')]] },
    { k: 'bold', label: 'Bold', t: 'bool', g: 'Style', s: true },
    { k: 'textAlign', label: 'Text align', t: 'select', g: 'Style', s: true, opts: ['', ['left', J('左', 'Left')], ['center', J('中央', 'Center')], ['right', J('右', 'Right')]] },
    { k: 'radius', label: 'Border radius', t: 'text', g: 'Style', s: true, ph: '6' },
    { k: 'border', label: 'Border width', t: 'text', g: 'Style', s: true },
    { k: 'borderColor', label: 'Border color', t: 'color', g: 'Style', s: true },
  );
  const animOpts = (kind) => ['', ...Object.entries(ANIMS).filter(([, a]) => a.kind === kind).map(([k, a]) => [k, J(a.ja, a.en)])];
  out.push(
    { k: 'anim', label: 'Entrance animation', t: 'select', g: 'Animation', opts: animOpts('in') },
    { k: 'animDur', label: 'Duration (ms)', t: 'text', g: 'Animation', ph: '600' },
    { k: 'animDelay', label: 'Delay (ms)', t: 'text', g: 'Animation', ph: '0' },
    { k: 'animEase', label: 'Easing', t: 'select', g: 'Animation', opts: EASINGS.map((e) => [e, e]) },
    { k: 'animLoop', label: 'Looping animation', t: 'select', g: 'Animation', opts: animOpts('loop') },
    { k: 'hover', label: 'Hover effect', t: 'select', g: 'Animation', opts: ['', ...Object.entries(HOVERS).map(([k, a]) => [k, J(a.ja, a.en)])] },
    { k: '__play', label: 'Preview', t: 'playanim', g: 'Animation' },
  );
  return out.filter((p) => !p.hide && !(node.type === 'page' && p.g === 'Animation' && p.k !== 'anim' && p.k !== 'animDur'));
}

/**
 * Render a node (and its children) to HTML.
 * ctx: { project, editor:boolean }
 * Editor mode: inline styles + data-nid. App mode: id + class, CSS emitted separately (see generator).
 */
export function renderNode(node, ctx) {
  const def = components.get(node.type);
  if (!def) return `<!-- unknown component ${esc(node.type)} -->`;
  const kids = (node.children || []).map((c) => renderNode(c, ctx)).join('');
  const attrs = (n, cls, extra = '') => {
    let a = ` id="${n.id}" class="${cls}${ctx.editor && def.container && !n.children.length ? ' cx-empty' : ''}"`;
    if (ctx.editor) {
      a += ` data-nid="${n.id}" data-type="${n.type}"`;
      if (n.type !== 'page') a += ' draggable="true"';
      const decl = def.cssTarget ? '' : cssDecls(n).join('; ');
      if (decl) a += ` style="${esc(decl)}"`;
      if (n.props.hiddenInitially) a += ' data-hidden="1"';
    } else if (n.props.hiddenInitially) a += ' hidden';
    return a + (extra ? ' ' + extra : '');
  };
  return def.render(node, { ...ctx, attrs }, kids);
}

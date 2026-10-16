// Data view: models (schema + spreadsheet-like rows) and variables.
import { h, sanitizeIdent, uid } from '../util.js';
import { blocks } from '../registry.js';
import { store, ui, commit } from '../store.js';
import { FIELD_TYPES, VAR_TYPES, newModel, nextRowId, defaultFor, walkBlocks, allNodes } from '../model.js';
import { dialog, confirmDlg, toast } from '../ui-kit.js';

const proj = () => store.project;
let root;

export function renderData(container, origin) {
  root = container;
  if (origin === 'grid') return;
  root.className = 'view data';
  root.textContent = '';
  const p = proj();
  if (ui.selModel !== '__vars' && !p.models.some((m) => m.id === ui.selModel)) ui.selModel = p.models[0]?.id || '__vars';

  const left = h('aside', { class: 'panel left' },
    h('div', { class: 'panel-title' }, 'Models'),
    h('div', { class: 'scroll' },
      p.models.map((m) => h('div', { class: 'layer' + (ui.selModel === m.id ? ' on' : ''), onclick: () => { ui.selModel = m.id; renderData(root); } },
        h('span', { class: 'pal-ico' }, '▦'), h('span', {}, m.name), h('em', {}, m.rows.length + ' rows'))),
      h('button', { class: 'btn small wide', onclick: addModel }, '＋ New Model'),
      h('div', { class: 'panel-title' }, 'Variables'),
      h('div', { class: 'layer' + (ui.selModel === '__vars' ? ' on' : ''), onclick: () => { ui.selModel = '__vars'; renderData(root); } },
        h('span', { class: 'pal-ico' }, '𝑥'), h('span', {}, 'App variables'), h('em', {}, p.variables.length + ''))));
  const main = h('section', { class: 'center scroll data-main' }, ui.selModel === '__vars' ? varsEditor() : modelEditor(p.models.find((m) => m.id === ui.selModel)));
  root.append(left, main);
}

function addModel() {
  let id;
  commit('Add model', (p) => { const m = newModel(p); id = m.id; p.models.push(m); });
  ui.selModel = id; renderData(root);
}

// ---------- rename propagation (blocks + component bindings keep working) ----------
function renameRefs(p, kind, from, to) {
  const fix = (args, defFields) => { for (const [k, f] of Object.entries(defFields || {})) if (f.t === kind && args[k] === from) args[k] = to; };
  for (const s of p.scripts) {
    fix(s.hat.args, blocks.get(s.hat.type)?.fields);
    walkBlocks(s.body, (b) => fix(b.args, blocks.get(b.type)?.fields));
  }
  for (const { node } of allNodes(p)) {
    if (kind === 'var' && node.props.bind === from) node.props.bind = to;
    if (kind === 'model' && node.props.source === from) node.props.source = to;
  }
}

// ---------- model editor ----------
function modelEditor(m) {
  if (!m) return h('div', { class: 'empty' }, h('p', {}, 'データモデルがありません。'), h('button', { class: 'btn primary', onclick: addModel }, '＋ New Model'));
  const edit = (label, fn, opts) => commit(label, (p) => fn(p.models.find((x) => x.id === m.id)), opts);

  const nameInp = h('input', { class: 'inp title-inp', value: m.name, onchange: (e) => {
    const nn = sanitizeIdent(e.target.value);
    if (proj().models.some((x) => x.id !== m.id && x.name === nn)) { toast('同名のモデルが既にあります'); e.target.value = m.name; return; }
    commit('Rename model', (p) => { renameRefs(p, 'model', m.name, nn); p.models.find((x) => x.id === m.id).name = nn; });
  } });

  const fields = h('table', { class: 'tbl' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Field'), h('th', {}, 'Type'), h('th', {}))),
    h('tbody', {}, m.fields.map((f, i) => h('tr', {},
      h('td', {}, h('input', { class: 'inp', value: f.name, onchange: (e) => {
        const nn = sanitizeIdent(e.target.value);
        if (m.fields.some((x, j) => j !== i && x.name === nn)) { toast('同名のフィールドがあります'); e.target.value = f.name; return; }
        edit('Rename field', (mm) => { const old = mm.fields[i].name; mm.fields[i].name = nn; mm.rows.forEach((r) => { if (old in r) { r[nn] = r[old]; delete r[old]; } }); });
      } })),
      h('td', {}, h('select', { class: 'sel', onchange: (e) => edit('Change type', (mm) => { mm.fields[i].type = e.target.value; }) },
        FIELD_TYPES.map((t) => h('option', { selected: t === f.type }, t)))),
      h('td', {}, h('button', { class: 'icon-btn', title: 'フィールドを削除', onclick: () => edit('Delete field', (mm) => { const [d] = mm.fields.splice(i, 1); mm.rows.forEach((r) => delete r[d.name]); }) }, '✕'))))));

  const addField = h('button', { class: 'btn small', onclick: () => edit('Add field', (mm) => {
    let n = 1; while (mm.fields.some((x) => x.name === 'field' + n)) n++;
    mm.fields.push({ name: 'field' + n, type: 'String' });
  }) }, '＋ Field');

  return h('div', {},
    h('div', { class: 'row-between' }, nameInp,
      h('button', { class: 'btn small danger', onclick: async () => {
        if (!(await confirmDlg('モデルを削除', `「${m.name}」とそのデータを削除します(Undoで戻せます)。`, '削除'))) return;
        commit('Delete model', (p) => { p.models = p.models.filter((x) => x.id !== m.id); }); renderData(root);
      } }, 'Delete model')),
    h('h4', {}, 'Schema'), fields, addField,
    h('h4', {}, 'Data'), grid(m, edit),
    h('div', { class: 'row-gap' },
      h('button', { class: 'btn small', onclick: () => { edit('Add row', (mm) => { const r = { _id: nextRowId(mm) }; mm.fields.forEach((f) => { r[f.name] = f.name === 'id' && f.type === 'Number' ? mm.rows.reduce((a, x) => Math.max(a, Number(x.id) || 0), 0) + 1 : defaultFor(f.type); }); mm.rows.push(r); });
        setTimeout(() => root.querySelector('.grid tbody tr:last-child input')?.focus()); } }, '＋ Row'),
      h('button', { class: 'btn small', onclick: () => pasteDialog(m, edit) }, '📋 貼り付け (CSV/TSV)')));
}

function grid(m, edit) {
  if (!m.fields.length) return h('div', { class: 'muted' }, 'フィールドを追加してください');
  const cell = (r, ri, f, ci) => {
    const set = (v, label = 'Edit cell') => edit(label, (mm) => { mm.rows[ri][f.name] = v; }, { coalesce: `cell:${m.id}:${ri}:${f.name}`, origin: 'grid' });
    const key = (e) => {
      const move = e.key === 'ArrowDown' || e.key === 'Enter' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
      if (!move || e.target.tagName === 'TEXTAREA') return;
      const t = root.querySelector(`[data-r="${ri + move}"][data-c="${ci}"]`);
      if (t) { e.preventDefault(); t.focus(); t.select?.(); }
    };
    const common = { 'data-r': ri, 'data-c': ci, onkeydown: key };
    const v = r[f.name];
    if (f.type === 'Boolean') return h('input', { type: 'checkbox', ...common, checked: !!v, onchange: (e) => set(e.target.checked) });
    if (f.type === 'Number') return h('input', { class: 'cell', type: 'number', step: 'any', ...common, value: v ?? '', oninput: (e) => set(e.target.value === '' ? '' : Number(e.target.value)) });
    if (f.type === 'Date') return h('input', { class: 'cell', type: 'date', ...common, value: v ?? '', oninput: (e) => set(e.target.value) });
    if (f.type === 'Array' || f.type === 'Object') {
      return h('input', { class: 'cell mono', ...common, value: JSON.stringify(v ?? defaultFor(f.type)), oninput: (e) => {
        try { const j = JSON.parse(e.target.value); e.target.classList.remove('err'); set(j); } catch { e.target.classList.add('err'); }
      } });
    }
    return h('input', { class: 'cell', ...common, value: v ?? '', oninput: (e) => set(e.target.value) });
  };
  return h('div', { class: 'grid-wrap' }, h('table', { class: 'tbl grid' },
    h('thead', {}, h('tr', {}, h('th', { class: 'rn' }, '#'), m.fields.map((f) => h('th', {}, f.name, h('small', {}, ' ' + f.type))), h('th', {}))),
    h('tbody', {}, m.rows.map((r, ri) => h('tr', {}, h('td', { class: 'rn' }, ri + 1),
      m.fields.map((f, ci) => h('td', {}, cell(r, ri, f, ci))),
      h('td', {}, h('button', { class: 'icon-btn', title: '行を削除', onclick: () => edit('Delete row', (mm) => { mm.rows.splice(ri, 1); }) }, '✕')))))));
}

async function pasteDialog(m, edit) {
  const ta = h('textarea', { class: 'inp mono', rows: 10, style: { width: '100%' }, placeholder: 'Excel / スプレッドシートからコピーした内容を貼り付け(先頭行がフィールド名ならヘッダとして扱います)' });
  const ok = await dialog({ title: '貼り付けで行を追加', wide: true, body: ta, actions: [{ label: 'キャンセル', value: false }, { label: '追加', primary: true, value: 'ok' }] });
  if (ok !== 'ok' || !ta.value.trim()) return;
  const lines = ta.value.replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '');
  const split = (l) => l.split(l.includes('\t') ? '\t' : ',').map((x) => x.trim());
  let cols = m.fields.map((f) => f.name);
  const first = split(lines[0]);
  if (first.some((c) => cols.includes(c))) { cols = first; lines.shift(); }
  edit('Paste rows', (mm) => {
    for (const l of lines) {
      const cells = split(l);
      const r = { _id: nextRowId(mm) };
      mm.fields.forEach((f) => { r[f.name] = defaultFor(f.type); });
      cols.forEach((c, i) => {
        const f = mm.fields.find((x) => x.name === c); if (!f || cells[i] === undefined) return;
        r[c] = f.type === 'Number' ? Number(cells[i]) || 0 : f.type === 'Boolean' ? /^(true|1|yes|はい)$/i.test(cells[i]) : cells[i];
      });
      mm.rows.push(r);
    }
  });
}

// ---------- variables ----------
function varsEditor() {
  const p = proj();
  const edit = (label, fn, opts) => commit(label, (pp) => fn(pp.variables), opts);
  return h('div', {},
    h('h3', {}, 'App variables'),
    h('p', { class: 'muted' }, 'ブロックや UI の {変数名} 表示・入力部品のバインドで使う値です。'),
    h('table', { class: 'tbl' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Name'), h('th', {}, 'Type'), h('th', {}, 'Initial value'), h('th', {}))),
      h('tbody', {}, p.variables.map((v, i) => h('tr', {},
        h('td', {}, h('input', { class: 'inp', value: v.name, onchange: (e) => {
          const nn = sanitizeIdent(e.target.value);
          if (p.variables.some((x, j) => j !== i && x.name === nn)) { toast('同名の変数があります'); e.target.value = v.name; return; }
          commit('Rename variable', (pp) => { renameRefs(pp, 'var', v.name, nn); pp.variables[i].name = nn; });
        } })),
        h('td', {}, h('select', { class: 'sel', onchange: (e) => edit('Variable type', (vs) => { vs[i].type = e.target.value; }) }, VAR_TYPES.map((t) => h('option', { selected: t === v.type }, t)))),
        h('td', {}, h('input', { class: 'inp', value: v.initial, oninput: (e) => edit('Variable initial', (vs) => { vs[i].initial = e.target.value; }, { coalesce: 'vi' + i, origin: 'grid' }) })),
        h('td', {}, h('button', { class: 'icon-btn', title: '削除', onclick: () => edit('Delete variable', (vs) => vs.splice(i, 1)) }, '✕')))))),
    h('button', { class: 'btn small', onclick: () => edit('Add variable', (vs) => { let n = 1; while (vs.some((x) => x.name === 'var' + n)) n++; vs.push({ name: 'var' + n, type: 'Number', initial: '0' }); }) }, '＋ Variable'));
}

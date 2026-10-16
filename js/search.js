// Global search: one function that looks through the whole project (pure, testable).
import { blocks } from './registry.js';
import { allNodes } from './model.js';

const text = (v) => (v === null || v === undefined ? '' : typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : '');
/** every string inside a value (args may hold nested value blocks) */
function strings(v, out = []) {
  if (typeof v === 'string') out.push(v);
  else if (typeof v === 'number' || typeof v === 'boolean') out.push(String(v));
  else if (v && typeof v === 'object') {
    if (v.$b) { out.push(v.$b.type, ...[blocks.get(v.$b.type)?.title || '']); strings(v.$b.args, out); } else for (const x of Array.isArray(v) ? v : Object.values(v)) strings(x, out);
  }
  return out;
}

/**
 * results: { kind, label, detail, where } — where tells the UI how to jump there
 * kinds: page, component, script, block, variable, model, field, row, asset, setting, content
 */
export function searchProject(project, query, { limit = 300 } = {}) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const out = [];
  const hit = (s) => String(s ?? '').toLowerCase().includes(q);
  const add = (r) => { if (out.length < limit) out.push(r); };
  const snippet = (s) => { const t = String(s); const i = t.toLowerCase().indexOf(q); const a = Math.max(0, i - 20); return (a > 0 ? '…' : '') + t.slice(a, i + q.length + 40).replace(/\s+/g, ' ') + (t.length > i + q.length + 40 ? '…' : ''); };

  for (const pg of project.pages) if (hit(pg.name)) add({ kind: 'page', label: pg.name, detail: 'Page', where: { view: 'design', page: pg.id } });
  for (const { node, page } of allNodes(project)) {
    if (node.type === 'page') continue;
    if (hit(node.name) || hit(node.type)) add({ kind: 'component', label: node.name, detail: `${node.type} · ${page.name}`, where: { view: 'design', page: page.id, node: node.id } });
    for (const [k, v] of Object.entries(node.props || {})) if (typeof v === 'string' && hit(v) && !hit(node.name)) { add({ kind: 'component', label: node.name, detail: `${k}: ${snippet(v)}`, where: { view: 'design', page: page.id, node: node.id } }); break; }
  }
  for (const s of project.scripts) {
    const title = s.name || blocks.get(s.hat.type)?.title || s.hat.type;
    if (hit(title) || hit(s.hat.type)) add({ kind: 'script', label: title, detail: 'Script', where: { view: 'logic', script: s.id } });
    const visit = (list) => list.forEach((b) => {
      const def = blocks.get(b.type);
      const hay = [def?.title, def?.en, b.type, ...strings(b.args)].filter(Boolean);
      const m = hay.find(hit);
      if (m !== undefined) add({ kind: 'block', label: def?.title || b.type, detail: `${title} · ${snippet(m)}`, where: { view: 'logic', script: s.id, block: b.id } });
      Object.values(b.slots || {}).forEach(visit);
    });
    const hatHit = strings(s.hat.args).find(hit);
    if (hatHit !== undefined && !hit(title)) add({ kind: 'block', label: blocks.get(s.hat.type)?.title || s.hat.type, detail: `${title} · ${snippet(hatHit)}`, where: { view: 'logic', script: s.id } });
    visit(s.body);
  }
  for (const v of project.variables) if (hit(v.name) || hit(v.initial)) add({ kind: 'variable', label: v.name, detail: `${v.type} = ${text(v.initial)}`, where: { view: 'data', model: '__vars' } });
  for (const m of project.models) {
    if (hit(m.name)) add({ kind: 'model', label: m.name, detail: `Model · ${m.fields.length} fields · ${m.rows.length} rows`, where: { view: 'data', model: m.id } });
    for (const f of m.fields) if (hit(f.name) || hit(f.options)) add({ kind: 'field', label: `${m.name}.${f.name}`, detail: f.type, where: { view: 'data', model: m.id } });
    let rowHits = 0;
    for (const [i, r] of m.rows.entries()) {
      const cell = Object.entries(r).find(([k, v]) => k !== '_id' && hit(strings(v).join(' ')));
      if (cell && rowHits++ < 20) add({ kind: 'row', label: `${m.name} #${i + 1}`, detail: `${cell[0]}: ${snippet(strings(cell[1]).join(' '))}`, where: { view: 'data', model: m.id } });
    }
  }
  for (const a of project.assets || []) if (hit(a.name)) add({ kind: 'asset', label: a.name, detail: 'Asset', where: { view: 'data', model: '__assets' } });
  const st = project.settings || {};
  for (const k of ['title', 'description', 'customCss', 'customJs']) if (hit(st[k])) add({ kind: 'setting', label: k, detail: snippet(st[k]), where: { view: 'settings' } });
  for (const [group, list] of Object.entries(project.content || {})) for (const c of list || []) if (hit(c.id) || hit(c.name)) add({ kind: 'content', label: c.name || c.id, detail: group, where: { view: 'data', model: group } });
  return out;
}

export const KIND_ICON = { page: '📄', component: '▢', script: '⚡', block: '▤', variable: '𝑥', model: '▦', field: '·', row: '≡', asset: '🖼', setting: '⚙', content: '⛏' };

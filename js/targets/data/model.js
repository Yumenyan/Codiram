// Shared by the data-driven generators (SQL, SQLite, JSON pipeline, REST API): the project's data models in a plain form.
import { snakeCase } from '../../sdk/emit.js';

export const tableName = (model) => snakeCase(model.name) || 'table';
export const columnName = (field) => snakeCase(field.name) || 'col';
const isInt = (v) => typeof v === 'number' && Number.isInteger(v);

/** [{ name, table, fields:[{ name, column, type, options?, ref?, refTable?, allInt }], rows }] — models in dependency order */
export function modelsOf(project) {
  const byName = new Map(project.models.map((m) => [m.name, m]));
  const list = project.models.map((m) => ({
    name: m.name, table: tableName(m), rows: m.rows || [],
    fields: m.fields.map((f) => ({
      name: f.name, column: columnName(f), type: f.type,
      options: f.type === 'Enum' ? String(f.options || '').split(',').map((x) => x.trim()).filter(Boolean) : null,
      ref: f.type === 'Relation' ? f.ref : null, refTable: f.type === 'Relation' && byName.get(f.ref) ? tableName(byName.get(f.ref)) : null,
      allInt: (m.rows || []).length > 0 && (m.rows || []).every((r) => r[f.name] == null || isInt(r[f.name])),
    })),
  }));
  // referenced tables first (so FOREIGN KEY targets exist); cycles keep model order
  const done = new Set(), out = [];
  const visit = (m, stack = new Set()) => {
    if (done.has(m.name) || stack.has(m.name)) return;
    stack.add(m.name);
    for (const f of m.fields) if (f.ref && f.ref !== m.name) { const d = list.find((x) => x.name === f.ref); if (d) visit(d, stack); }
    done.add(m.name); out.push(m);
  };
  list.forEach((m) => visit(m));
  return out;
}

/** problems every data generator reports: no models, duplicate table names, unusable field types */
export function checkModels(project) {
  const out = [];
  if (!project.models.length) out.push({ msg: 'データモデルがありません(Data 画面でモデルを追加してください)', level: 'info' });
  const seen = new Set();
  for (const m of project.models) {
    const t = tableName(m);
    if (seen.has(t)) out.push({ msg: `モデル名「${m.name}」が他のモデルと同じテーブル名(${t})になります` });
    seen.add(t);
    const cols = new Set();
    for (const f of m.fields) { const c = columnName(f); if (cols.has(c)) out.push({ msg: `モデル「${m.name}」の項目名「${f.name}」が他の項目と同じ列名(${c})になります` }); cols.add(c); }
  }
  return out;
}

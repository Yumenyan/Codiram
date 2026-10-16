// Project templates: the standard file layout of a target, written once.
// A template is a map  path -> content  where content is a string with {{placeholders}} or a function (vars) => string|Uint8Array.
//   {{name}}      the value as is
//   {{json name}} the value as a JSON string literal ("..."), also valid TOML
// A generator renders the template with its config and then adds the generated source files on top.
export const ProjectTemplates = new Map();

export function defineProjectTemplate(id, files, description = '') {
  ProjectTemplates.set(id, { id, files, description });
  return ProjectTemplates.get(id);
}

export function renderProjectTemplate(id, vars) {
  const tpl = ProjectTemplates.get(id);
  if (!tpl) throw new Error('Unknown project template: ' + id);
  const fill = (s) => s.replace(/\{\{\s*(json\s+)?([\w.]+)\s*\}\}/g, (_, j, key) => {
    if (!(key in vars)) throw new Error(`Template ${id}: no value for {{${key}}}`);
    return j ? JSON.stringify(String(vars[key] ?? '')) : String(vars[key] ?? '');
  });
  const out = {};
  for (const [path, content] of Object.entries(tpl.files)) {
    const v = typeof content === 'function' ? content(vars) : content;
    if (v == null) continue; // a function may skip an optional file
    out[fill(path)] = typeof v === 'string' ? fill(v) : v;
  }
  return out;
}

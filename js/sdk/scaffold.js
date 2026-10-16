// Scaffold: the formal asset of a project generator. A scaffold ZIP holds
//   generator.definition.json        the Definition (schema v2) — importable again in the Generator Builder
//   scaffold/<path>                  the project skeleton (templates.files with {{placeholders}}): edit as plain files
//   js/targets/<id>/index.js         loader that registers the generator with the SDK (+ custom.js for code extensions)
//   js/targets/<id>/README.md        what to do next
//   Definition + scaffold/ + SDK  ->  Generated Project
import { json } from './emit.js';
import { toDefinition, importDefinitions } from './definition.js';
import { readZip } from '../zip.js';

const js = (v) => JSON.stringify(v, null, 2);
const DEF = 'generator.definition.json';

export function scaffoldGenerator(spec, kind = 'declarative') {
  const id = spec.id, dir = `js/targets/${id}`;
  const files = {};
  const definition = toDefinition(spec);
  files[DEF] = json(definition);
  for (const [path, text] of Object.entries(spec.files || {})) files[`scaffold/${path}`] = text;
  files[`${dir}/generator.definition.json`] = json(definition);
  if (kind === 'declarative') {
    files[`${dir}/index.js`] = `// ${spec.name.en || id}: generated from generator.definition.json (data). Edit the JSON (or re-import it in the Generator Builder).
import { defineDeclarativeGenerator } from '../../sdk/declarative.js';
import { normalizeDefinition } from '../../sdk/definition.js';

defineDeclarativeGenerator(normalizeDefinition(${js(definition)}));
`;
  } else {
    files[`${dir}/index.js`] = `// ${spec.name.en || id}: definition (data) + custom code. Keep as much as possible in the definition; code only for what it cannot say.
import { defineDeclarativeGenerator } from '../../sdk/declarative.js';
import { normalizeDefinition } from '../../sdk/definition.js';
import custom from './custom.js';

defineDeclarativeGenerator(normalizeDefinition(${js(definition)}), custom);
`;
    files[`${dir}/custom.js`] = `// Code extension points of a declarative generator (all optional).
export default {
  // IR statements no rule can express: 'my.op': (stmt, { x, str, num, bool, fill, q, R }) => 'line' | ['lines']
  statements: {},
  // post-process the generated project: files is { path: text }; add / change / remove entries
  files(files, { project, cfg, spec }) {
    void files; void project; void cfg; void spec;
  },
};
`;
  }
  files[`${dir}/README.md`] = `# ${spec.name.en || id} generator (scaffold)

Next steps
1. Add \`import './${id}/index.js';\` to \`js/targets/index.js\`.
2. Add it to a golden project in \`tests/golden/projects.mjs\` and run \`npm test\` — every generator needs a golden project.
3. To change the generator, edit \`generator.definition.json\` / \`scaffold/\` and import the ZIP (or the JSON) in the Generator Builder;
   put code only in \`custom.js\` (see docs/GENERATOR_SDK.md).

Plugin form: \`export default { id, name, generators: [definition] }\` (data only).
`;
  return files;
}

/**
 * Read a scaffold ZIP: returns a Definition text list for importDefinitions(); files under scaffold/ override templates.files.
 * Works with ZIPs made by scaffoldGenerator or any ZIP containing generator.definition.json (+ scaffold/).
 */
export async function readScaffoldZip(bytes, resolve) {
  const all = await readZip(bytes), dec = new TextDecoder();
  const defName = Object.keys(all).find((n) => n === DEF) || Object.keys(all).find((n) => n.endsWith('/' + DEF));
  if (!defName) throw new Error(`${DEF} not found in the ZIP`);
  const spec = importDefinitions([dec.decode(all[defName])], resolve);
  const prefix = defName.slice(0, defName.length - DEF.length) + 'scaffold/';
  spec.files = { ...spec.files };
  for (const [n, data] of Object.entries(all)) {
    if (!n.startsWith(prefix)) continue;
    const text = dec.decode(data);
    if (text.includes('�')) continue; // binary files are not part of a text scaffold
    spec.files[n.slice(prefix.length)] = text;
  }
  return spec;
}

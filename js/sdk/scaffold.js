// Scaffold generator: turns a generator spec into the files of a new generator inside the Codiram source tree.
//   kind 'declarative': index.js is one call (the spec stays data)
//   kind 'custom'     : index.js uses the SDK pieces directly (template, mapping, emitter hook) so code can replace the rules
import { json } from './emit.js';

const js = (v) => JSON.stringify(v, null, 2);

export function scaffoldGenerator(spec, kind = 'declarative') {
  const id = spec.id, dir = `js/targets/${id}`;
  const files = {};
  files[`${dir}/generator.spec.json`] = json(spec);
  if (kind === 'declarative') {
    files[`${dir}/index.js`] = `// ${spec.name.en || id}: a declarative generator (data only). Edit generator.spec.json (or the object below) to change it.
import { defineDeclarativeGenerator } from '../../sdk/declarative.js';

defineDeclarativeGenerator(${js(spec)});
`;
  } else {
    const { rules, program, files: extra, ...meta } = spec;
    files[`${dir}/index.js`] = `// ${spec.name.en || id}: generator built from SDK pieces. Replace \`emitProgram\` with your own emitter when the rules are not enough.
import { defineGenerator, defineProjectTemplate, renderProjectTemplate, buildSemanticModel, emit } from '../../sdk/index.js';
import { emitProgram } from '../../sdk/declarative.js';
import { targetConfig } from '../../model.js';

const SPEC = ${js(spec)};

// 1. project layout (see sdk/template.js)
defineProjectTemplate('${id}-basic', { ...SPEC.files, [SPEC.program.file]: SPEC.program.template });

// 2. project -> semantic model -> source (rules = mapping table, see sdk/mapping.js; TODO: custom emitter for what rules cannot say)
function generate(project, cfg) {
  const ir = buildSemanticModel(project, '${id}');
  const { pieces, problems } = emitProgram(ir, SPEC, project);
  const files = renderProjectTemplate('${id}-basic', { ...SPEC.config, ...cfg, name: project.name, slug: emit.slug(project.name, '_') || 'app', ...pieces });
  files['codiram.project.json'] = emit.projectFile(project);
  return { files, problems: [...ir.problems.filter((p) => !p.unsupported), ...problems], root: emit.slug(project.name, '-') || 'app', entry: SPEC.program.file };
}

defineGenerator({
  id: SPEC.id, order: 5, portable: true,
  name: SPEC.name, icon: SPEC.icon, desc: SPEC.desc,
  version: SPEC.version, language: SPEC.language, platforms: SPEC.platforms, supports: SPEC.supports,
  views: ['data', 'logic', 'output'],
  defaultConfig: () => ({ type: SPEC.id, ...SPEC.config }),
  configFields: SPEC.configFields.map((f) => ({ key: f.key, label: { ja: f.label, en: f.label } })),
  generate,
  verify: SPEC.verify,
});
`;
    void meta;
  }
  files[`${dir}/README.md`] = `# ${spec.name.en || id} generator (scaffold)

Next steps
1. Add \`import './${id}/index.js';\` to \`js/targets/index.js\`.
2. Add it to a golden project in \`tests/golden/projects.mjs\` (for example the \`cli-golden\` entry:
   \`['${id}', () => cliGolden().project]\`) and run \`npm test\` — every generator must have a golden project.
3. Fill in what the rules cannot express (see docs/GENERATOR_SDK.md, "Add a generator").

The same \`generator.spec.json\` can also be loaded in the Generator Builder (Import) or shipped in a plugin: \`export default { id, name, generators: [spec] }\`.
`;
  return files;
}

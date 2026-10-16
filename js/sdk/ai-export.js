// AI Export: reference material so an AI can write Generator Definitions (and process JSON) without reading Codiram's source.
import { GeneratorRegistry, blocks, blockSupports, blockCaps } from '../registry.js';
import { toDefinition, buildJsonSchema, RULE_SECTIONS } from './definition.js';
import { CAPABILITIES } from './capabilities.js';
import { PRESETS } from './presets.js';
import { PROCESS_DOC } from '../process.js';
import { exportGenerator, kindOf } from './library.js';
import { getLang } from '../i18n.js';

const L = (x) => (typeof x === 'string' ? x : x?.en || x?.ja || '');
const REFERENCE = ['python', 'nodejs', 'discord', 'viteWeb'];

export const IR_DOC = `# Semantic model (what a Definition's rules receive)

Blocks are converted to operations; a Definition only says how each one is written in the target language.

Statements: comment, log, set (variable = value), if (cond / then / else), repeat (count / body), wait (ms), call (function / args),
cli.print / cli.exit / cli.write_file, plus target-specific ones named "<ns>.<op>" (map them with extensions.customStatements).
Expressions: num, str, bool, var (global / local), un (! -), bin (+ - * / % == != < > <= >= && ||), call (concat contains isEmpty pow random ternary bool num),
cli (readLine arg readFile fileExists), plus target-specific values (map them with extensions.customValues).

Rule templates use {slots}: set → {target} {value}; ifOpen → {cond}; repeatOpen → {i} {count}; call → {fn} {args}; fnOpen → {name} {params};
globalDecl → {name} {value} {type}; print → {value}; comment → {text}. Program template slots: {{imports}} {{helpers}} {{globals}} {{functions}} {{main}} {{name}} {{note}}.
`;

export function capabilitiesDoc() {
  return '# Capabilities\n\nUse these ids in "capabilities". A capability needs the rules that implement it (io → print, input → readLine, cli → arg + exit, filesystem → readFile / writeFile / appendFile / fileExists).\n\n'
    + Object.entries(CAPABILITIES).map(([id, l]) => `- \`${id}\` — ${l.en} / ${l.ja}`).join('\n') + '\n';
}

export function rulesDoc() {
  const py = toDefinition(PRESETS.python);
  const lines = ['# Rule reference', '', 'Sections and keys of a Definition (see the JSON Schema). Example values come from the Python definition.', ''];
  for (const [section, keys] of Object.entries(RULE_SECTIONS)) {
    lines.push(`## ${section}`);
    for (const k of keys) { const v = py[section]?.[k]; lines.push(`- \`${k}\`${v !== undefined ? ' — e.g. `' + JSON.stringify(v).slice(0, 120) + '`' : ''}`); }
    lines.push('');
  }
  return lines.join('\n');
}

/** the blocks a generator supports, for writing process JSON */
export function blocksDoc(genId) {
  const rows = [];
  for (const d of blocks.values()) {
    if (!(blockSupports(d, genId) || blockSupports(d, genId, true))) continue;
    const fields = Object.entries(d.fields || {}).map(([k, f]) => `${k}:${f.t}`).join(', ');
    const slots = (d.slots || []).map((s) => s.key).join(', ');
    rows.push(`- \`${d.type}\` (${d.kind || 'stmt'}, ${d.cat}) ${d.en || d.title}${fields ? ' — fields: ' + fields : ''}${slots ? ' — slots: ' + slots : ''}${blockCaps(d).length ? ' — needs: ' + blockCaps(d).join(', ') : ''}`);
  }
  return `# Blocks of "${genId}"\n\nField types: expr = expression text, text = plain text, var / fn / comp / page / model = a name, select = one of the options.\n\n${rows.join('\n')}\n`;
}

const README = (ja, genId) => (ja ? `# Codiram AI パック

Codiram の Generator Definition(または処理データ)を AI に書かせるための資料です。Codiram のソースコードを渡す必要はありません。

## 使い方
1. この ZIP の中身(README 以外は \`schema/\` と \`reference/\`)を AI に渡す
2. 下のプロンプトの <...> を埋めて送る
3. AI が返した JSON を Codiram で読み込む
   - Generator: Generator Builder → Import(複数ファイル可) → プレビューで確認 → 保存
   - 処理データ: Tools → 処理データを読み込む

## プロンプト例(Generator)
> 添付の generator-definition.schema.json に従って、<言語/ターゲット> 向けの Codiram Generator Definition(schemaVersion 2, kind "syntax")を JSON 1 ファイルで作ってください。
> reference/definitions/python.json をお手本にして、すべてのルールを埋めてください。コードは書かず JSON だけを返してください。

## プロンプト例(処理データ)
> reference/process-format.md の形式で、<やりたいこと> の Codiram 処理データ JSON を作ってください。使えるブロックは reference/blocks-${genId}.md にあります。

大きな言語は \`<名前>-core.json\`(完全な定義)と \`<名前>-io.json\` などの部品(\`"fragment": true\`、同じ generator.id)に分けて Import できます。
` : `# Codiram AI pack

Reference material for having an AI write Codiram Generator Definitions (or process data). You do not need to hand over Codiram's source code.

## How to use
1. Give the AI the contents of this ZIP (\`schema/\` and \`reference/\`)
2. Fill in the <...> of a prompt below and send it
3. Load what the AI returns in Codiram
   - Generator: Generator Builder → Import (several files at once) → check the preview → Save
   - Process data: Tools → Import process data

## Prompt (generator)
> Following the attached generator-definition.schema.json, create a Codiram Generator Definition (schemaVersion 2, kind "syntax") for <language / target> as one JSON file.
> Use reference/definitions/python.json as the model and fill in every rule. Return JSON only, no code.

## Prompt (process data)
> In the format of reference/process-format.md, create Codiram process data JSON that does <what you want>. The available blocks are listed in reference/blocks-${genId}.md.

Large languages can be split into \`<name>-core.json\` (a full definition) and parts such as \`<name>-io.json\` (\`"fragment": true\`, same generator.id) and imported together.
`);

/** files of the AI pack: { path: text } */
export function buildAiPack({ generatorId = 'web', project = null, lang = getLang() } = {}) {
  const files = {};
  files['README.md'] = README(lang === 'ja', generatorId);
  files['schema/generator-definition.schema.json'] = JSON.stringify(buildJsonSchema(), null, 2) + '\n';
  const refs = new Set(REFERENCE.map((k) => PRESETS[k].id));
  const chosen = GeneratorRegistry.get(generatorId);
  if (chosen?.spec) refs.add(chosen.id);
  for (const id of refs) { const g = GeneratorRegistry.get(id); if (g) files[`reference/definitions/${id}.json`] = exportGenerator(id).text; }
  if (chosen && !chosen.spec) files[`reference/manifests/${chosen.id}.manifest.json`] = exportGenerator(chosen.id).text;
  files['reference/capabilities.md'] = capabilitiesDoc();
  files['reference/rules.md'] = rulesDoc();
  files['reference/semantic-model.md'] = IR_DOC;
  files['reference/process-format.md'] = PROCESS_DOC;
  files[`reference/blocks-${generatorId}.md`] = blocksDoc(generatorId);
  files['reference/generators.md'] = '# Generators in this Codiram\n\n' + GeneratorRegistry.list({ includeHidden: true }).map((g) => `- \`${g.id}\` — ${L(g.name)} (${kindOf(g)}; ${(g.language || []).join('/')}; supports: ${(g.supports || []).join(', ')})`).join('\n') + '\n';
  if (project) files['example/project.json'] = JSON.stringify(project, null, 2) + '\n';
  return files;
}

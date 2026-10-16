// Minecraft target ("Modiram"): Fabric 1.19.2 / Java 17. MVP: a handful of events and actions.
import './blocks.js';
import { defineGenerator } from '../../sdk/index.js';
import '../../sdk/common-ir.js';
import { buildIR } from '../../ir.js';
import { J } from '../../i18n-helpers.js';
import { generateJava } from './java.js';
import { fabricProject, MC_VERSIONS, DEFAULT_MC_VERSION } from './project.js';
import { targetConfig } from '../../model.js';
import { validateContent } from './content.js';

const MOD_ID = /^[a-z][a-z0-9_]{1,63}$/;
const PACKAGE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

export const defaultMcConfig = (modId = 'hello_mod', modName = 'Hello Mod') => ({
  type: 'minecraft', loader: 'fabric', minecraftVersion: DEFAULT_MC_VERSION, javaVersion: MC_VERSIONS[DEFAULT_MC_VERSION].java, generatorVersion: '1',
  modId, modName, modVersion: '1.0.0', author: '', description: '', license: 'MIT', package: 'com.example.' + modId.replace(/_/g, ''),
});

export function validateMcConfig(cfg) {
  const out = [];
  if (!MOD_ID.test(cfg.modId || '')) out.push('Mod ID は 小文字英字で始まり、小文字・数字・_ のみ(2〜64文字)で指定してください');
  if (!PACKAGE.test(cfg.package || '')) out.push('パッケージ名は com.example.mymod のように小文字・数字・_ を . で区切って指定してください');
  if (!(cfg.modName || '').trim()) out.push('Mod 名が空です');
  if (!MC_VERSIONS[cfg.minecraftVersion]) out.push('未対応の Minecraft バージョンです');
  if (!/^\d+\.\d+\.\d+/.test(cfg.modVersion || '')) out.push('Mod バージョンは 1.0.0 の形式で指定してください');
  return out;
}

function generate(project, cfg) {
  cfg = cfg || targetConfig(project, 'minecraft') || defaultMcConfig();
  const ir = buildIR(project, 'minecraft');
  const problems = [...ir.problems];
  validateMcConfig(cfg).forEach((msg) => problems.push({ msg, config: true }));
  problems.push(...validateContent(project));
  const gen = generateJava(ir, cfg);
  problems.push(...gen.problems);
  if (project.models.length) problems.push({ msg: 'データモデルはまだ Minecraft では使えません(変数のみ対応)', level: 'info' });
  return { files: fabricProject(cfg, gen, project), problems, ir, root: cfg.modId };
}

defineGenerator({
  id: 'minecraft', order: 9, hidden: true, portable: true, // paused: kept for existing projects; planned as a future SDK generator
  version: '0.3.0', language: ['java'], platforms: ['minecraft-fabric'],
  supports: ['events', 'variables', 'conditions', 'loops', 'functions', 'minecraft'],
  name: J('Minecraft Mod (Modiram)', 'Minecraft Mod (Modiram)'),
  icon: '⛏',
  desc: J('Fabric 1.19.2 の Mod(Java)を生成します', 'Generates a Fabric 1.19.2 mod (Java)'),
  views: ['data', 'logic', 'output'],
  defaultConfig: defaultMcConfig,
  validateConfig: validateMcConfig,
  configFields: [
    { key: 'modId', label: J('Mod ID (半角英小文字・数字・_)', 'Mod ID (a-z, 0-9, _)'), ph: 'hello_mod' },
    { key: 'modName', label: J('Mod 名', 'Mod name') },
    { key: 'package', label: J('Java パッケージ', 'Java package'), ph: 'com.example.hellomod' },
    { key: 'modVersion', label: J('Mod バージョン', 'Mod version') },
    { key: 'author', label: J('作者', 'Author') },
    { key: 'description', label: J('説明', 'Description') },
    { key: 'minecraftVersion', label: J('Minecraft バージョン', 'Minecraft version'), opts: Object.keys(MC_VERSIONS) },
  ],
  generate,
  lint: (project) => {
    const cfg = targetConfig(project, 'minecraft');
    const out = buildIR(project, 'minecraft').problems.filter((p) => !p.unsupported).map((p) => ({ script: p.script, block: p.block, msg: p.msg }));
    if (cfg) validateMcConfig(cfg).forEach((msg) => out.push({ script: null, block: null, msg }));
    validateContent(project).forEach((p) => out.push({ script: null, block: null, msg: p.msg }));
    return out;
  },
});

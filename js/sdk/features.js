// Which capabilities does a project actually use? Compared with a generator's `supports` before generating.
import { blocks, blockCaps } from '../registry.js';
import { allNodes } from '../model.js';
import { walkBlocks } from './validate.js';

/** { capability -> [where] } */
export function usedCapabilities(project) {
  const used = new Map();
  const add = (cap, where) => { if (!used.has(cap)) used.set(cap, []); used.get(cap).push(where); };
  walkBlocks(project, (b, script) => { const d = blocks.get(b.type); if (d) blockCaps(d).forEach((c) => add(c, b.type)); });
  if (allNodes(project).length > project.pages.length) add('ui', 'components');
  if (project.models.length) add('data', 'models');
  for (const v of project.variables) {
    if (v.type === 'Array') add('arrays', v.name);
    if (v.type === 'Object') add('objects', v.name);
  }
  return used;
}

/** capabilities the project uses that the generator does not offer: [{ capability, where }] */
export function missingCapabilities(project, gen) {
  const out = [];
  for (const [cap, where] of usedCapabilities(project)) if (!gen.supports.includes(cap)) out.push({ capability: cap, where: [...new Set(where)].slice(0, 3).join(', ') });
  return out;
}

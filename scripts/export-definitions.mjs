// Writes the reference Definition JSON files and the JSON Schema into docs/ (they are checked in; tests keep them in sync).
//   node scripts/export-definitions.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../js/generator.js';
import { PRESETS } from '../js/sdk/presets.js';
import { toDefinition, buildJsonSchema, splitDefinition } from '../js/sdk/definition.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs');
const write = (rel, data) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), JSON.stringify(data, null, 2) + '\n'); };

write('schemas/generator-definition.schema.json', buildJsonSchema());
for (const spec of Object.values(PRESETS)) write(`definitions/${spec.id}.json`, toDefinition(spec));
// the same Python definition split into parts: import python-core.json + python-io.json together (or one after the other)
const { core, parts } = splitDefinition(toDefinition(PRESETS.python), { 'python-io': ['io'], 'python-types': ['types'] });
write('definitions/split/python-core.json', core);
for (const p of parts) write(`definitions/split/${p.comment}.json`, p);
console.log('definitions written to docs/');

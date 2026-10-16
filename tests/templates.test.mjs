// Every template must build, lint clean and generate valid JavaScript. Run: node tests/templates.test.mjs
import assert from 'node:assert/strict';
import { generate, compileExpr, buildEnv } from '../js/generator.js';
import { lint, emptyProject } from '../js/model.js';
import { TEMPLATES } from '../js/templates.js';

for (const t of TEMPLATES) {
  const p = t.build();
  assert.deepEqual(lint(p), [], `${t.id}: lint problems`);
  const f = generate(p, { debug: true });
  assert.doesNotThrow(() => new Function(f['app.js']), `${t.id}: invalid app.js`);
  assert.ok(f['index.html'].includes('<!DOCTYPE html>'));
}

// expression compiler: variables are rewritten, free text stays text
const p = emptyProject('x');
p.variables.push({ name: 'count', type: 'Number', initial: '0' });
const env = buildEnv(p);
assert.equal(compileExpr('count + 1', env), 'vars.count + 1');
assert.equal(compileExpr('Hello world', env), '"Hello world"');
assert.equal(compileExpr('', env), '""');
console.log(`OK: ${TEMPLATES.length} templates + expression compiler`);

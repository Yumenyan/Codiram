// Generates a script for every registered block type and checks the output is valid JavaScript.
// Run: node tests/all-blocks.test.mjs
import { generate } from '../js/generator.js';
import { emptyProject, createNode, newScript, newBlock, newModel, lint } from '../js/model.js';
import { blocks } from '../js/registry.js';
const p = emptyProject('T');
const m = newModel(p, 'M'); m.fields=[{name:'id',type:'Number'},{name:'name',type:'String'}]; p.models.push(m);
for (const n of ['v1','lst','obj']) p.variables.push({name:n,type:n==='lst'?'Array':n==='obj'?'Object':'Number',initial:n==='lst'?'[1,2,3]':n==='obj'?'{}':'0'});
const btn = createNode(p,'button'); p.pages[0].root.children.push(btn);
const modal = createNode(p,'modal'); p.pages[0].root.children.push(modal);
const fill = (b) => {
  const def = blocks.get(b.type);
  for (const [k,f] of Object.entries(def.fields||{})) {
    if (f.t==='var') b.args[k] = f.vt==='Array'?'lst':f.vt==='Object'?'obj':'v1';
    else if (f.t==='comp') b.args[k] = f.types?.includes('modal')? modal.id : btn.id;
    else if (f.t==='model') b.args[k]='M'; else if (f.t==='fieldname') b.args[k]='name';
    else if (f.t==='page') b.args[k]='main'; else if (f.t==='fn') b.args[k]='f1';
    else if (f.t==='anim') b.args[k]='bounceIn';
    else if (f.t==='expr' && !b.args[k]) b.args[k]='1';
    else if (f.t==='text' && !b.args[k]) b.args[k]='x';
    else if (f.t==='select') b.args[k] = Array.isArray(f.opts[0]) ? f.opts[0][0] : f.opts[0];
  }
  Object.values(b.slots).forEach(()=>{});
};
let n=0;
const fnScript = newScript(p,'main','onFunction',{name:'f1'}); p.scripts.push(fnScript);
for (const [type,def] of blocks) {
  let s;
  if (def.kind==='hat') { const h=newBlock(type); fill(h); s = newScript(p,'main',type,h.args); }
  else { s = newScript(p,'main','onClick',{target:btn.id}); const b=newBlock(type); fill(b);
    // loops: also test break inside
    s.body.push(b);
    for (const sl of Object.keys(b.slots)) b.slots[sl].push(newBlock('break'), newBlock('set_var',{name:'v1',value:'1'}));
  }
  p.scripts.push(s); n++;
}
const f = generate(p, {debug:true});
import assert from 'node:assert/strict';
assert.doesNotThrow(() => new Function(f['app.js']), 'generated app.js must be valid JavaScript');
assert.deepEqual(lint(p), [], 'no lint problems expected');
console.log(`OK: ${n} block types generate valid JavaScript`);


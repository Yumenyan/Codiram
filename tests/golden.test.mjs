// Generic regression harness. For every (golden project, generator): validate -> generate -> verify (files / JSON / syntax)
// -> compare the file list with the stored snapshot -> run the generator's build hook when its tool is installed.
// UPDATE_SNAPSHOTS=1 rewrites tests/golden/snapshots.json.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import '../js/generator.js';
import { GeneratorRegistry, runGenerator, verifyGenerated } from '../js/sdk/index.js';
import { GOLDEN } from './golden/projects.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const snapFile = path.join(here, 'golden', 'snapshots.json');
const snaps = fs.existsSync(snapFile) ? JSON.parse(fs.readFileSync(snapFile, 'utf8')) : {};
const next = {};
const syntax = { js: (src) => new vm.Script(src) };
const has = (tool) => { try { execFileSync(tool, ['--version'], { stdio: 'ignore' }); return true; } catch { return false; } };

let built = 0, checked = 0;
for (const g of GOLDEN) {
  for (const [genId, make] of g.generators) {
    const gen = GeneratorRegistry.get(genId);
    const project = make();
    const v = gen.validate(project);
    assert.ok(v.ok, `${g.id}/${genId}: validation failed: ${v.problems.map((p) => p.msg).join('; ')}`);
    const res = runGenerator(project, genId);
    const errors = verifyGenerated(res, gen.verify, { syntax });
    assert.deepEqual(errors, [], `${g.id}/${genId}`);
    const key = `${g.id}/${genId}`;
    next[key] = Object.keys(res.files).sort();
    if (snaps[key] && !process.env.UPDATE_SNAPSHOTS) assert.deepEqual(next[key], snaps[key], `${key}: generated file list changed (UPDATE_SNAPSHOTS=1 to accept)`);
    checked++;
    const b = gen.verify.build;
    if (b && !b.optional && has(b.tool)) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codiram-golden-'));
      for (const [n, c] of Object.entries(res.files)) { fs.mkdirSync(path.dirname(path.join(dir, n)), { recursive: true }); fs.writeFileSync(path.join(dir, n), c); }
      const env = { ...process.env, CARGO_TARGET_DIR: path.join(os.tmpdir(), 'codiram-rust-target') };
      execFileSync(b.tool, b.args, { cwd: dir, env, stdio: 'pipe' });
      built++;
    }
    const r = gen.verify.run;
    if (r && g.stdout != null && has(r.tool)) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codiram-golden-'));
      for (const [n, c] of Object.entries(res.files)) { fs.mkdirSync(path.dirname(path.join(dir, n)), { recursive: true }); fs.writeFileSync(path.join(dir, n), c); }
      const env = { ...process.env, CARGO_TARGET_DIR: path.join(os.tmpdir(), 'codiram-rust-target') };
      assert.equal(execFileSync(r.tool, r.args, { cwd: dir, env, encoding: 'utf8' }), g.stdout, `${key}: program output`);
      built++;
    }
  }
}
if (process.env.UPDATE_SNAPSHOTS || !Object.keys(snaps).length) fs.writeFileSync(snapFile, JSON.stringify(next, null, 2) + '\n');
// every registered generator must be covered by at least one golden project (Minecraft is paused and excluded)
const covered = new Set(GOLDEN.flatMap((g) => g.generators.map(([id]) => id)));
for (const gen of GeneratorRegistry.list()) assert.ok(covered.has(gen.id), `generator ${gen.id} has no golden project`);
console.log(`OK: golden projects — ${checked} generations verified, ${built} built with the real toolchain`);

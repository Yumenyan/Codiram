# Codiram Generator SDK

Codiram Core does not know any target by name. A **generator** is a module that registers itself with the
`GeneratorRegistry`; adding a new execution environment means adding a generator, not changing the core.

```
Visual blocks ──► Validate ──► (IR) ──► Generator ──► project files (ZIP)
```

## Pieces (`js/sdk/`, `js/registry.js`)

| | |
|---|---|
| `defineGenerator(spec)` | builds and registers a generator (fills manifest defaults, checks capability ids) |
| `GeneratorRegistry` | `register / unregister / get / list / findByCapability` (`list()` hides paused generators) |
| Capabilities (`sdk/capabilities.js`) | what a generator can do (`ui`, `events`, `variables`, `filesystem`, `cli`, `dialog` …) |
| `blockSupports(def, genId)` | block ↔ generator compatibility; used by the palette, lint and export |
| `validateBlocks(project, genId)` / `runGenerator(project, genId)` | validation ("Rust CLI does not support: Button Clicked") then generation, problems merged |
| `sdk/common-ir.js` | `ir` implementations of the common blocks (variables, if, loops, functions, math, text …), shared by every IR generator |

## A generator

```js
defineGenerator({
  id: 'rust-cli', name: { ja, en }, icon, desc, order,
  version, language: ['rust'], platforms: ['windows','macos','linux'],       // manifest
  supports: ['variables','conditions','loops','functions','filesystem','cli','io'],   // capabilities
  engine: 'ir',        // 'blocks' = generate straight from the blocks (Web), 'ir' = blocks -> IR -> code
  portable: true,      // accept the common blocks
  inherits: 'web',     // (optional) also accept everything another generator accepts (Desktop = Web + desktop blocks)
  hidden: false,       // paused generators are not offered for new projects but still open existing ones
  views, defaultConfig, validateConfig, configFields,    // UI
  validate?(project, cfg), generate(project, cfg) -> { files, problems, root, entry },
});
```

Block ↔ generator rules (`blockSupports`): the block lists the generator in `targets` (default `['web']`), is `portable`
and the generator is portable, or the generator `inherits` a generator that supports it; **and** every capability the block
needs (`def.caps`, default by category) is in the generator's `supports`; IR generators additionally need `ir` / `irHat` / `irExpr`.

The IR (`js/ir.js`) is deliberately small: statements `{ op: set|if|repeat|wait|call|log|comment|<generator>.<action> }`
and expressions `{ k: num|str|bool|var|bin|un|call|<generator> }`. Generator-specific ops are namespaced.

## Built in

| Generator | Output | Verified |
|---|---|---|
| `web` | HTML / CSS / JS | Playwright + Node tests |
| `desktop` | Web app in `src/` + Tauri 1.x project (`src-tauri/`), `Desktop.*` runtime with browser fallbacks | structure / JSON / JS syntax (a real `tauri build` needs system libraries and is **not** run in CI here) |
| `rust-cli` | Cargo project, std only | `cargo run` is executed in `npm test` when cargo exists |
| `minecraft` | Fabric 1.19.2 mod (Java) | paused — kept for existing projects, hidden from the target list |

## Rules

* Exported projects must stay ordinary, readable projects that build without Codiram.
* No Universal IR up front: add IR nodes only when a generator needs them.
* Generator-specific code lives under `js/targets/<id>/`; `js/targets/index.js` is the only place listing them.

## Contract and shared parts (cost of the next generator)

```
Generator = manifest + capabilities + validate(project) + generate(project)   // defineGenerator()
GeneratedProject = { files, problems, root, entry, generator }                // runGenerator()
```

| Part | File | What you write for a new generator |
|---|---|---|
| Contract / registry | `sdk/index.js`, `registry.js` | one `defineGenerator({...})` call. `validate()` (block support + capability check of what the project really uses) is built in; add rules with `check()` |
| Capabilities | `sdk/capabilities.js`, `sdk/features.js` | a list of ids. `usedCapabilities(project)` / `missingCapabilities()` do the checking, no per-generator error code |
| Semantic model | `ir.js` (`buildSemanticModel`) + `sdk/common-ir.js` | nothing for common blocks (variables, if, loops, functions, math, text); only `ir` for blocks specific to your target. Not a universal IR: target-only concepts stay `<target>.<op>` |
| Project template | `sdk/template.js` | `defineProjectTemplate(id, { path: 'text with {{vars}}' })`; `renderProjectTemplate(id, cfg)` then add generated sources |
| Mapping | `sdk/mapping.js` | `defineMapping({ op: 'target code with {slots}' })` for one-line operations; complex ones stay code |
| Emitter utilities | `sdk/emit.js` | reuse `identifierNamer`, `snakeCase`, `escapeString`, `unparen`, `indent`, `json`, `projectFile` instead of copying |
| Verification | `sdk/verify.js` + `generator.verify` | declare required files / patterns / JSON / syntax / optional build command (data, no code) |
| Tests | `tests/golden/projects.mjs`, `tests/golden.test.mjs` | add the generator to a golden project (or add a golden project); the harness validates, generates, verifies, snapshots the file list and runs the build when the tool is installed. A generator without a golden project fails the test |

### Add a generator — checklist
1. `js/targets/<id>/index.js`: `defineGenerator` (copy `targets/web.js` for the shape, `targets/rust/index.js` for an IR generator), add it to `js/targets/index.js`.
2. Project layout → `defineProjectTemplate`; simple operations → `defineMapping`; the rest → emitter code using `sdk/emit.js`.
3. Target-only blocks: `targets: ['<id>']`, `caps: [...]`, plus `ir` / `irHat` / `irExpr` (see `targets/rust/blocks.js`).
4. Add a `verify` spec and a golden project entry; run `npm test`.
5. Move code that a *second* generator also needs into `js/sdk/` (not before).

### Future (not implemented, structure is ready)
The manifest, capability list, project template, mapping table and verify spec are all plain data, so a Generator Builder
can later scaffold `js/targets/<id>/` from a form (target, language, capabilities, template, mappings, build command).

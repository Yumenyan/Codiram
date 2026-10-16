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

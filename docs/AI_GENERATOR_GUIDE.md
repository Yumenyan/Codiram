# Writing a generator with AI (Definition JSON)

Give the AI **only** these files, not the Codiram source:
1. `docs/schemas/generator-definition.schema.json` — the format
2. one reference definition: `docs/definitions/python.json` (language) or `docs/definitions/vite-web.json` (project)

Prompt skeleton:

> Create a Codiram Generator Definition (schemaVersion 2, kind "syntax") for **<Language>** command-line programs that follows the
> attached schema. Use `python.json` as the model for every rule. Output one JSON file, no code.
> For a project generator (kind "project") list the scaffold files in `templates.files` and, to wrap a web app, set `scaffold.source`.

Then: Generator Builder → **Import** (several files at once for core + parts, or a scaffold ZIP) → read the preview and fix rules →
**Save** (use it now) / **Export** (share the JSON) / **Scaffold (ZIP)** (put it into `js/targets/`).

Large languages: split into `<lang>-core.json` (full definition) and `<lang>-io.json`, `<lang>-types.json` … (`"fragment": true`,
same `generator.id`). Check that the preview of the sample program matches the expected output, then add a golden project entry.

Anything the rules cannot express (static typing details, project formats with generated binaries, new IR operations) belongs in
`custom.js` (see GENERATOR_SDK.md) — do not force it into the JSON.

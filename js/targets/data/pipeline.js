// JSON / data pipeline generator: the data models as JSON + CSV + JSON Schema, and a small pipeline runner (Python, stdlib only).
import { defineGenerator } from '../../sdk/index.js';
import { J } from '../../i18n-helpers.js';
import { cm } from '../../comments.js';
import { json, projectFile } from '../../sdk/emit.js';
import { modelsOf, checkModels } from './model.js';

const jsonType = (f) => ({ Number: f.allInt ? 'integer' : 'number', Boolean: 'boolean', Array: 'array', Object: 'object', Relation: 'integer' }[f.type] || 'string');
const csvCell = (v) => { const s = v !== null && typeof v === 'object' ? JSON.stringify(v) : v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

const PIPELINE_PY = (t) => `#!/usr/bin/env python3
"""${t('data/ の JSON を schemas/ で検証し、pipeline.json の手順(filter / sort / select / limit)を順に適用して out/ に書き出します。標準ライブラリのみ。', 'Validates the JSON in data/ against schemas/, applies the steps of pipeline.json (filter / sort / select / limit) and writes the result to out/. Standard library only.')}"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
TYPES = {"integer": int, "number": (int, float), "string": str, "boolean": bool, "array": list, "object": dict}


def load(path):
    with open(os.path.join(HERE, path), encoding="utf-8") as f:
        return json.load(f)


def validate(table, rows, schema):
    """${t('各行の型を確認し、問題を文字列のリストで返す', 'Checks the type of every value; returns a list of problems')}"""
    problems = []
    for i, row in enumerate(rows):
        for name, spec in schema["properties"].items():
            value = row.get(name)
            expected = TYPES[spec["type"]]
            if value is not None and (not isinstance(value, expected) or (spec["type"] != "boolean" and isinstance(value, bool))):
                problems.append("%s[%d].%s: expected %s" % (table, i, name, spec["type"]))
    return problems


COMPARE = {
    "==": lambda a, b: a == b, "!=": lambda a, b: a != b,
    ">": lambda a, b: a > b, "<": lambda a, b: a < b, ">=": lambda a, b: a >= b, "<=": lambda a, b: a <= b,
    "contains": lambda a, b: str(b) in str(a),
}


def apply_step(rows, step):
    op = step["op"]
    if op == "filter":
        compare = COMPARE[step.get("cmp", "==")]
        return [r for r in rows if r.get(step["field"]) is not None and compare(r[step["field"]], step["value"])]
    if op == "sort":
        return sorted(rows, key=lambda r: (r.get(step["field"]) is None, r.get(step["field"])), reverse=bool(step.get("desc")))
    if op == "select":
        return [{k: r.get(k) for k in step["fields"]} for r in rows]
    if op == "limit":
        return rows[: int(step["count"])]
    raise ValueError("unknown step: " + op)


def main():
    config = load("pipeline.json")
    os.makedirs(os.path.join(HERE, "out"), exist_ok=True)
    failed = False
    for table in config["tables"]:
        rows = load("data/%s.json" % table)
        problems = validate(table, rows, load("schemas/%s.schema.json" % table))
        for p in problems:
            print("problem:", p)
        failed = failed or bool(problems)
        for step in config.get("steps", {}).get(table, []):
            rows = apply_step(rows, step)
        with open(os.path.join(HERE, "out", table + ".json"), "w", encoding="utf-8") as f:
            json.dump(rows, f, ensure_ascii=False, indent=2)
        print("%s: %d rows" % (table, len(rows)))
    raise SystemExit(1 if failed else 0)


if __name__ == "__main__":
    main()
`;

defineGenerator({
  id: 'data-pipeline', order: 6.2, engine: 'data',
  name: J('JSON / データパイプライン', 'JSON / data pipeline'), icon: '🔀',
  desc: J('データモデルを JSON・CSV・JSON Schema にし、検証と変換のパイプライン(Python)を付けます', 'Data models as JSON, CSV and JSON Schema, plus a validate-and-transform pipeline (Python)'),
  version: '0.1.0', language: ['json', 'python'], platforms: ['windows', 'macos', 'linux'], supports: ['data'], views: ['data', 'output'],
  defaultConfig: () => ({ type: 'data-pipeline' }),
  generate(project) {
    const t = cm(project), models = modelsOf(project), files = {};
    for (const m of models) {
      files[`data/${m.table}.json`] = json(m.rows.map((r) => Object.fromEntries([['_id', r._id], ...m.fields.map((f) => [f.name, r[f.name] ?? null])])));
      files[`data/${m.table}.csv`] = [m.fields.map((f) => csvCell(f.name)).join(','), ...m.rows.map((r) => m.fields.map((f) => csvCell(r[f.name])).join(','))].join('\n') + '\n';
      files[`schemas/${m.table}.schema.json`] = json({
        $schema: 'http://json-schema.org/draft-07/schema#', title: m.name, type: 'object',
        properties: Object.fromEntries([['_id', { type: 'integer' }], ...m.fields.map((f) => [f.name, { type: jsonType(f), ...(f.options?.length ? { enum: f.options } : {}) }])]),
      });
    }
    files['pipeline.json'] = json({ tables: models.map((m) => m.table), steps: Object.fromEntries(models.map((m) => [m.table, []])), comment: t('steps に { "op": "filter", "field": "age", "cmp": ">=", "value": 20 } / { "op": "sort", "field": "name" } / { "op": "select", "fields": [..] } / { "op": "limit", "count": 10 } を追加', 'add steps like { "op": "filter", "field": "age", "cmp": ">=", "value": 20 } / sort / select / limit') });
    files['pipeline.py'] = PIPELINE_PY(t);
    files['README.md'] = `# ${project.name}\n\n${t('Codiram のデータモデルから生成したデータパイプラインです。', 'A data pipeline generated from the Codiram data models.')}\n\n\`\`\`sh\npython3 pipeline.py\n\`\`\`\n\n| ${t('場所', 'Path')} | |\n|---|---|\n| \`data/*.json\`, \`data/*.csv\` | ${t('元データ', 'source data')} |\n| \`schemas/*.schema.json\` | JSON Schema |\n| \`pipeline.json\` | ${t('適用する手順', 'steps to apply')} |\n| \`out/\` | ${t('結果', 'results')} |\n`;
    files['.gitignore'] = 'out/\n';
    files['codiram.project.json'] = projectFile(project);
    return { files, problems: checkModels(project), root: 'data-pipeline', entry: 'pipeline.py' };
  },
  verify: { requiredFiles: ['pipeline.py', 'pipeline.json', 'README.md'], json: ['pipeline.json'], run: { tool: 'python3', args: ['pipeline.py'] } },
});

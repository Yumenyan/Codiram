// SQL / SQLite generator: the data models as CREATE TABLE + INSERT statements (SQLite, PostgreSQL or MySQL).
import { defineGenerator } from '../../sdk/index.js';
import { J } from '../../i18n-helpers.js';
import { cm, noteFor } from '../../comments.js';
import { projectFile } from '../../sdk/emit.js';
import { modelsOf, checkModels } from './model.js';
import { targetConfig } from '../../model.js';

const DIALECTS = ['sqlite', 'postgres', 'mysql'];
const q = (id, d) => (d === 'mysql' ? '`' + id + '`' : '"' + id + '"');
const lit = (v, f, d) => {
  if (v === undefined || v === null || v === '') return f.type === 'String' || f.type === 'Enum' || f.type === 'Date' ? (v === '' ? "''" : 'NULL') : 'NULL';
  if (f.type === 'Number') return String(Number(v));
  if (f.type === 'Boolean') return d === 'sqlite' ? (v ? '1' : '0') : (v ? 'TRUE' : 'FALSE');
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
};
const colType = (f, d) => {
  switch (f.type) {
    case 'Number': return f.allInt ? (d === 'postgres' ? 'BIGINT' : d === 'mysql' ? 'BIGINT' : 'INTEGER') : (d === 'postgres' ? 'DOUBLE PRECISION' : d === 'mysql' ? 'DOUBLE' : 'REAL');
    case 'Boolean': return d === 'sqlite' ? 'INTEGER' : 'BOOLEAN';
    case 'Array': case 'Object': return d === 'postgres' ? 'JSONB' : d === 'mysql' ? 'JSON' : 'TEXT';
    case 'Relation': return d === 'sqlite' ? 'INTEGER' : 'BIGINT';
    case 'Enum': return d === 'mysql' ? `ENUM(${f.options.map((o) => `'${o.replace(/'/g, "''")}'`).join(', ')})` : 'TEXT';
    case 'Date': return d === 'sqlite' ? 'TEXT' : 'TEXT';
    default: return d === 'mysql' ? 'VARCHAR(255)' : 'TEXT';
  }
};

export function sqlFiles(project, dialect, { sqlite = false } = {}) {
  const t = cm(project), models = modelsOf(project), files = {};
  const header = (what) => `-- ${project.name} — ${noteFor(project, what)}\n`;
  const schema = [header(`SQL (${dialect})`)];
  for (const m of models) {
    const cols = [`  ${q('_id', dialect)} ${dialect === 'postgres' ? 'BIGINT' : dialect === 'mysql' ? 'BIGINT' : 'INTEGER'} PRIMARY KEY`];
    for (const f of m.fields) {
      let c = `  ${q(f.column, dialect)} ${colType(f, dialect)}`;
      if (f.type === 'Enum' && dialect !== 'mysql' && f.options.length) c += ` CHECK (${q(f.column, dialect)} IN (${f.options.map((o) => `'${o.replace(/'/g, "''")}'`).join(', ')}))`;
      cols.push(c);
    }
    for (const f of m.fields) if (f.refTable) cols.push(`  FOREIGN KEY (${q(f.column, dialect)}) REFERENCES ${q(f.refTable, dialect)} (${q('_id', dialect)})`);
    schema.push(`${t('-- モデル「' + m.name + '」', '-- Model "' + m.name + '"')}\nCREATE TABLE ${q(m.table, dialect)} (\n${cols.join(',\n')}\n);\n`);
  }
  files['schema.sql'] = schema.join('\n');
  const seed = [header(`SQL (${dialect})`)];
  for (const m of models) {
    if (!m.rows.length) continue;
    const names = ['_id', ...m.fields.map((f) => f.column)].map((c) => q(c, dialect)).join(', ');
    seed.push(`${t('-- モデル「' + m.name + '」の初期データ', '-- Initial rows of "' + m.name + '"')}`);
    m.rows.forEach((r, i) => seed.push(`INSERT INTO ${q(m.table, dialect)} (${names}) VALUES (${[r._id ?? i + 1, ...m.fields.map((f) => lit(r[f.name], f, dialect))].join(', ')});`));
    seed.push('');
  }
  files['seed.sql'] = seed.join('\n');
  const run = { sqlite: 'sqlite3 app.db < schema.sql && sqlite3 app.db < seed.sql', postgres: 'psql -d mydb -f schema.sql -f seed.sql', mysql: 'mysql mydb < schema.sql && mysql mydb < seed.sql' }[dialect];
  files['README.md'] = `# ${project.name}\n\n${t('Codiram のデータモデルから生成した SQL(', 'SQL generated from the Codiram data models (')}${dialect}${t(')。Codiram なしで使えます。', '). Codiram is not needed.')}\n\n\`\`\`sh\n${run}\n\`\`\`\n\n| ${t('ファイル', 'File')} | |\n|---|---|\n| \`schema.sql\` | CREATE TABLE |\n| \`seed.sql\` | INSERT (${t('初期データ', 'initial rows')}) |\n`;
  if (sqlite) {
    files['create_db.py'] = `#!/usr/bin/env python3
"""${t('schema.sql と seed.sql から app.db(SQLite)を作ります。標準ライブラリのみ。', 'Creates app.db (SQLite) from schema.sql and seed.sql. Standard library only.')}"""
import os
import sqlite3

here = os.path.dirname(os.path.abspath(__file__))
path = os.environ.get("DB_PATH", os.path.join(here, "app.db"))
if os.path.exists(path):
    os.remove(path)
db = sqlite3.connect(path)
for name in ("schema.sql", "seed.sql"):
    with open(os.path.join(here, name), encoding="utf-8") as f:
        db.executescript(f.read())
db.commit()
tables = [r[0] for r in db.execute("select name from sqlite_master where type = 'table' order by name")]
for table in tables:
    print(table, db.execute('select count(*) from "%s"' % table).fetchone()[0])
db.close()
`;
    files['.gitignore'] = 'app.db\n';
  }
  files['codiram.project.json'] = projectFile(project);
  return files;
}

const generateFor = (genId, fixed) => (project, cfg) => {
  cfg = cfg || targetConfig(project, genId) || { type: genId, dialect: fixed || 'sqlite' };
  const dialect = fixed || (DIALECTS.includes(cfg.dialect) ? cfg.dialect : 'sqlite');
  const problems = checkModels(project);
  if (!DIALECTS.includes(dialect)) problems.push({ msg: 'dialect は sqlite / postgres / mysql のいずれかです', config: true });
  return { files: sqlFiles(project, dialect, { sqlite: dialect === 'sqlite' && genId === 'sqlite' }), problems, root: 'sql-' + dialect, entry: 'schema.sql' };
};

defineGenerator({
  id: 'sql', order: 6, engine: 'data',
  name: J('SQL', 'SQL'), icon: '🗃', desc: J('データモデルを CREATE TABLE / INSERT にします(SQLite・PostgreSQL・MySQL)', 'Data models as CREATE TABLE / INSERT (SQLite, PostgreSQL, MySQL)'),
  version: '0.1.0', language: ['sql'], platforms: ['sqlite', 'postgres', 'mysql'], supports: ['data', 'database'], views: ['data', 'output'],
  defaultConfig: () => ({ type: 'sql', dialect: 'sqlite' }),
  validateConfig: (cfg) => (DIALECTS.includes(cfg.dialect) ? [] : ['dialect は sqlite / postgres / mysql のいずれかです']),
  configFields: [{ key: 'dialect', label: J('SQL の種類', 'SQL dialect'), opts: DIALECTS }],
  generate: generateFor('sql'),
  verify: { requiredFiles: ['schema.sql', 'seed.sql', 'README.md'], contains: { 'schema.sql': ['CREATE TABLE'] } },
});
defineGenerator({
  id: 'sqlite', order: 6.1, engine: 'data',
  name: J('SQLite データベース', 'SQLite database'), icon: '🪶', desc: J('データモデルから SQLite のスキーマ・初期データ・作成スクリプト(create_db.py)を生成', 'SQLite schema, seed data and a create_db.py script from the data models'),
  version: '0.1.0', language: ['sql', 'python'], platforms: ['sqlite'], supports: ['data', 'database'], views: ['data', 'output'],
  defaultConfig: () => ({ type: 'sqlite' }),
  generate: generateFor('sqlite', 'sqlite'),
  verify: { requiredFiles: ['schema.sql', 'seed.sql', 'create_db.py'], contains: { 'schema.sql': ['CREATE TABLE'] }, run: { tool: 'python3', args: ['create_db.py'] } },
});

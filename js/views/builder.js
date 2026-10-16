// Generator Builder: edit a generator spec (data) with a live preview, then Save (install as external generator),
// Export (.codiram-generator.json) or Scaffold (source files for js/targets/<id>/).
import { h, download, clone, debounce } from '../util.js';
import { dialog, toast, confirmDlg } from '../ui-kit.js';
import { CAPABILITIES, capLabel } from '../sdk/capabilities.js';
import { PRESETS, blankSpec } from '../sdk/presets.js';
import { previewSpec } from '../sdk/declarative.js';
import { sampleProject } from '../sdk/sample.js';
import { installGeneratorSpec, uninstallGenerator, userGenerators, exportSpec, parseSpecFile } from '../sdk/external.js';
import { scaffoldGenerator } from '../sdk/scaffold.js';
import { makeZip } from '../zip.js';
import { L } from '../i18n.js';

/** rule key -> hint (what the template means). {slots} are filled by the engine. */
const RULE_FIELDS = [
  ['Statements', [
    ['comment', '{text}'], ['globalDecl', '{name} {value}'], ['set', '{target} {value}'], ['log', '{value}'],
    ['ifOpen', '{cond}'], ['elseOpen', ''], ['close', 'end of block ("" = indentation based)'], ['emptyBody', 'for an empty block (e.g. pass)'],
    ['repeatOpen', '{i} {count}'], ['wait', '{ms}'], ['call', '{fn} {args}'], ['fnOpen', '{name} {params}'], ['fnGlobals', '{names}'],
    ['mainOpen', 'wrapper of the program entry'], ['mainClose', ''], ['indent', 'one indentation level'],
  ]],
  ['Values', [
    ['true', ''], ['false', ''], ['null', ''], ['not', '{a}'], ['neg', '{a}'], ['toStr', '{a}'], ['toStrNum', '{a} (number → text)'], ['toNum', '{a}'], ['toBool', '{a}'], ['concat', 'text joiner'],
    ['globalRef', '{name}'], ['localRef', '{name}'],
  ]],
  ['Console / files / process', [
    ['print', '{value}'], ['printInline', '{value}'], ['readLine', ''], ['arg', '{a} (1-based)'], ['exit', '{code}'],
    ['readFile', '{a}'], ['fileExists', '{a}'], ['writeFile', '{path} {text}'], ['appendFile', '{path} {text}'],
  ]],
];
const JSON_RULES = [['ops', 'operator renames, e.g. {"&&":"and"}'], ['calls', 'contains / isEmpty / pow / random / ternary → {a} {b} {c}'], ['imports', 'use → import line'], ['helpers', 'use → helper code']];

const field = (label, input, hint) => h('label', { class: 'bld-field' }, h('span', {}, label, hint ? h('small', { class: 'muted' }, ' ' + hint) : null), input);
const txt = (get, set, mono = false, ph = '') => h('input', { class: 'inp' + (mono ? ' mono' : ''), value: get() ?? '', placeholder: ph, oninput: (e) => set(e.target.value) });
const area = (get, set, rows = 3) => h('textarea', { class: 'inp mono', rows, spellcheck: 'false', oninput: (e) => set(e.target.value) }, get() ?? '');

export async function openBuilder(start) {
  let spec = clone(start || PRESETS.python);
  if (!start) { spec = blankSpec(); }
  spec.rules = spec.rules || {};
  let cur = null, jsonErr = {};
  const body = h('div', { class: 'builder' });
  const preview = h('div', { class: 'bld-preview' });
  const status = h('div', { class: 'bld-status' });

  const redraw = debounce(() => {
    preview.textContent = '';
    const r = previewSpec(spec, sampleProject());
    const problems = [...Object.entries(jsonErr).map(([k, m]) => `rules.${k}: ${m}`), ...(r.errors || [])];
    status.className = 'bld-status' + (problems.length ? ' bad' : '');
    status.textContent = problems.length ? '⚠ ' + problems.join(' / ') : '✓ ' + 'この定義でサンプルプログラムを生成できます';
    if (r.errors?.length) return;
    const names = Object.keys(r.files).filter((n) => typeof r.files[n] === 'string' && n !== 'codiram.project.json');
    if (!names.includes(cur)) cur = r.entry;
    preview.append(
      h('div', { class: 'file-list' }, names.map((n) => h('button', { class: 'layer' + (n === cur ? ' on' : ''), onclick: () => { cur = n; redraw(); } }, n))),
      h('pre', { class: 'code' }, r.files[cur] || ''),
      ...(r.problems.length ? [h('div', { class: 'notice' }, r.problems.map((p) => p.msg).join(' / '))] : []));
  }, 150);

  const makeSections = () => {
    const caps = h('div', { class: 'cap-grid' }, Object.keys(CAPABILITIES).map((c) => h('label', { class: 'cap' },
      h('input', { type: 'checkbox', checked: (spec.supports || []).includes(c), onchange: (e) => { spec.supports = (spec.supports || []).filter((x) => x !== c); if (e.target.checked) spec.supports.push(c); redraw(); } }), L(capLabel(c)))));

    const csv = (key, root = spec) => txt(() => (root[key] || []).join(', '), (v) => { root[key] = v.split(',').map((x) => x.trim()).filter(Boolean); redraw(); });
    const sections = [
      h('details', { open: true }, h('summary', {}, '1. 基本情報 / Basics'),
        field('ID(半角英小文字・数字・-)', txt(() => spec.id, (v) => { spec.id = v; redraw(); }, true)),
        field('名前 (日本語)', txt(() => spec.name.ja, (v) => { spec.name.ja = v; redraw(); })),
        field('Name (English)', txt(() => spec.name.en, (v) => { spec.name.en = v; redraw(); })),
        field('アイコン / Icon', txt(() => spec.icon, (v) => { spec.icon = v; })),
        field('バージョン / Version', txt(() => spec.version, (v) => { spec.version = v; redraw(); })),
        field('言語 / Languages', csv('language')), field('プラットフォーム / Platforms', csv('platforms'))),
      h('details', {}, h('summary', {}, '2. Capabilities(対応機能)'), caps),
      ...RULE_FIELDS.map(([title, rows], i) => h('details', { open: i === 0 }, h('summary', {}, `${3 + i}. Rules — ${title}`),
        rows.map(([k, hint]) => field(k, txt(() => spec.rules[k], (v) => { if (v === '') delete spec.rules[k]; else spec.rules[k] = v; redraw(); }, true), hint)))),
      h('details', {}, h('summary', {}, '6. Rules — ops / calls / imports / helpers (JSON)'),
        JSON_RULES.map(([k, hint]) => field(k, area(() => JSON.stringify(spec.rules[k] || {}, null, 2), (v) => {
          try { spec.rules[k] = JSON.parse(v || '{}'); delete jsonErr[k]; } catch (e) { jsonErr[k] = e.message; }
          redraw();
        }, 4), hint))),
      h('details', {}, h('summary', {}, '7. プロジェクトテンプレート / Project template'),
        field('メインファイル名 / Program file', txt(() => spec.program.file, (v) => { spec.program.file = v; redraw(); }, true)),
        field('メインファイルの雛形(必須: {{functions}} {{main}} / 任意: {{imports}} {{helpers}} {{globals}} {{name}})', area(() => spec.program.template, (v) => { spec.program.template = v; redraw(); }, 8)),
        field('その他のファイル(JSON: パス → 内容、{{name}} {{slug}} {{version}} が使えます)', area(() => JSON.stringify(spec.files || {}, null, 2), (v) => {
          try { spec.files = JSON.parse(v || '{}'); delete jsonErr.files; } catch (e) { jsonErr.files = e.message; }
          redraw();
        }, 6))),
      h('details', {}, h('summary', {}, '8. 検証 / Verify'),
        field('必須ファイル(カンマ区切り)', csv('requiredFiles', spec.verify = spec.verify || {})),
        field('実行コマンド(任意: ツール 引数…)', txt(() => (spec.verify.run ? [spec.verify.run.tool, ...spec.verify.run.args].join(' ') : ''), (v) => {
          const [tool, ...args] = v.trim().split(/\s+/); if (tool) spec.verify.run = { tool, args }; else delete spec.verify.run;
        }, true, 'python3 main.py'))),
    ];
    return sections;
  };

  const mine = userGenerators();
  const startPick = h('select', { class: 'sel', onchange: async (e) => {
    const v = e.target.value;
    if (!v) return;
    spec = v === 'blank' ? blankSpec() : clone(v.startsWith('my:') ? mine.find((s) => s.id === v.slice(3)) : PRESETS[v]);
    if (v === 'python') { delete spec.builtin; spec.id = 'my-python'; spec.name = { ja: 'My Python', en: 'My Python' }; }
    cur = null; jsonErr = {}; build();
  } }, h('option', { value: '' }, '— 雛形から始める / Start from —'), h('option', { value: 'python' }, 'Python CLI'), h('option', { value: 'nodejs' }, 'Node.js CLI'), h('option', { value: 'blank' }, 'Blank'),
  mine.map((s) => h('option', { value: 'my:' + s.id }, '★ ' + (s.name.en || s.id))));
  const importBtn = h('button', { class: 'btn small', onclick: () => {
    const inp = h('input', { type: 'file', accept: '.json,application/json' });
    inp.onchange = async () => { try { spec = parseSpecFile(await inp.files[0].text()); cur = null; build(); } catch (e) { toast('読み込めません: ' + e.message); } };
    inp.click();
  } }, '⬆ Import');

  function build() {
    body.textContent = '';
    body.append(h('div', { class: 'bld-top' }, startPick, importBtn, h('span', { class: 'muted small' }, 'Generator の定義はデータだけ(コードは含まれません)。右のプレビューは同じサンプルプログラムを生成した結果です。')),
      h('div', { class: 'bld-cols' }, h('div', { class: 'bld-form' }, ...makeSections()), h('div', { class: 'bld-right' }, status, preview)));
    startPick.value = '';
    redraw();
  }
  build();

  const check = () => {
    const r = previewSpec(spec, sampleProject());
    const errs = [...Object.values(jsonErr), ...(r.errors || [])];
    if (errs.length) { toast('修正が必要です: ' + errs[0]); return false; }
    return true;
  };
  await dialog({
    title: '🛠 Generator Builder', wide: true, body,
    actions: [
      ...(mine.length ? [{ label: '保存済みを削除…', onClick: async () => {
        const id = spec.id; if (mine.some((s) => s.id === id) && await confirmDlg('Generator を削除', `「${id}」を削除します。`, '削除')) { uninstallGenerator(id); toast('削除しました'); }
        return false;
      } }] : []),
      { label: 'Scaffold (ZIP)', onClick: () => { if (!check()) return false; download(`${spec.id}-scaffold.zip`, makeZip(scaffoldGenerator(spec, 'custom'))); toast('js/targets/ に置くファイル一式を書き出しました'); return false; } },
      { label: 'Export', onClick: () => { if (!check()) return false; download(`${spec.id}.codiram-generator.json`, exportSpec(spec), 'application/json'); return false; } },
      { label: '閉じる', value: false },
      { label: '💾 保存して登録', primary: true, onClick: () => {
        if (!check()) return false;
        try { installGeneratorSpec(spec); toast(`Generator「${spec.name.en || spec.id}」を登録しました(New Project / Target から選べます)`); } catch (e) { toast(e.message); return false; }
      } },
    ],
  });
}

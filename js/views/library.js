// Generator Library dialog: list, validate, export, duplicate, update (import), delete, AI pack.
import { h, download } from '../util.js';
import { dialog, toast, confirmDlg, promptText } from '../ui-kit.js';
import { L } from '../i18n.js';
import { store } from '../store.js';
import { makeZip } from '../zip.js';
import { libraryEntries, exportGenerator, exportAll, duplicateGenerator, importIntoLibrary, validateGenerator, uninstallGenerator } from '../sdk/library.js';
import { buildAiPack } from '../sdk/ai-export.js';
import { activeTargetId } from '../registry.js';

const KIND = { syntax: 'Syntax', project: 'Project', data: 'Data', code: 'Code' };

export async function openLibrary() {
  const body = h('div', { class: 'library' });
  const report = h('div', { class: 'lib-report' });
  const draw = () => {
    body.textContent = '';
    const rows = libraryEntries().map((e) => h('tr', { class: e.paused ? 'paused' : '' },
      h('td', {}, e.icon + ' ' + L(e.name)), h('td', {}, h('code', {}, e.id)), h('td', {}, KIND[e.kind]), h('td', {}, 'v' + e.version),
      h('td', {}, e.paused ? '⏸ paused' : e.external ? '★ mine' : 'built-in'),
      h('td', { class: 'lib-actions' },
        h('button', { class: 'mini', title: 'Validate', onclick: () => check(e.id) }, '✔'),
        h('button', { class: 'mini', title: e.definition ? 'Export definition' : 'Export manifest (reference)', onclick: () => { const x = exportGenerator(e.id); download(x.file, x.text, 'application/json'); } }, '⬇'),
        h('button', { class: 'mini', title: 'Duplicate', disabled: !e.definition, onclick: () => copy(e) }, '⧉'),
        h('button', { class: 'mini', title: 'AI pack for this generator', onclick: () => aiPack(e.id) }, '🤖'),
        h('button', { class: 'mini', title: 'Delete', disabled: !e.external, onclick: () => remove(e) }, '🗑'))));
    body.append(
      h('div', { class: 'lib-bar' },
        h('button', { class: 'btn small', title: 'Definition JSON (複数可)', onclick: importFiles }, '⬆ Import / Update'),
        h('button', { class: 'btn small', onclick: () => { download('codiram-generators.zip', makeZip(exportAll()), 'application/zip'); } }, '⬇ Export all (ZIP)'),
        h('button', { class: 'btn small', onclick: () => aiPack(activeTargetId(store.project) || 'web') }, '🤖 AI Export'),
        h('button', { class: 'btn small', onclick: validateAll }, '✔ Validate all')),
      h('table', { class: 'lib-table' }, h('thead', {}, h('tr', {}, ['Generator', 'id', 'Kind', 'Version', '', ''].map((x) => h('th', {}, x)))), h('tbody', {}, rows)),
      report);
  };
  const show = (id, checks) => {
    report.textContent = '';
    report.append(h('b', {}, id), h('ul', {}, checks.map((c) => h('li', { class: c.ok ? 'ok' : 'bad' }, `${c.ok ? '✓' : '✗'} ${c.name}${c.msg ? ' — ' + c.msg : ''}`))));
  };
  const check = (id) => show(id, validateGenerator(id));
  const validateAll = () => {
    const bad = libraryEntries().map((e) => [e.id, validateGenerator(e.id).filter((c) => !c.ok)]).filter(([, b]) => b.length);
    report.textContent = '';
    report.append(h('b', {}, bad.length ? `${bad.length} generator(s) with problems` : '✓ all generators are healthy'), h('ul', {}, bad.map(([id, b]) => h('li', { class: 'bad' }, `✗ ${id} — ${b.map((c) => c.name + ': ' + c.msg).join('; ')}`))));
  };
  const copy = async (e) => {
    const id = await promptText('Duplicate', e.id + '-copy', 'New generator id (a-z, 0-9, -)');
    if (!id) return;
    try { duplicateGenerator(e.id, id); toast(`「${id}」を作成しました(Generator Builder で編集できます)`); draw(); } catch (err) { toast(err.message); }
  };
  const remove = async (e) => { if (await confirmDlg('Generator を削除', `「${e.id}」を削除します。`, '削除')) { uninstallGenerator(e.id); draw(); } };
  const importFiles = () => {
    const inp = h('input', { type: 'file', accept: '.json,application/json', multiple: true });
    inp.onchange = async () => {
      const texts = await Promise.all([...inp.files].map((f) => f.text()));
      try {
        let r;
        try { r = importIntoLibrary(texts); } catch (err) {
          if (err.code !== 'downgrade' || !(await confirmDlg('古いバージョン', err.message + '。上書きしますか?', '上書き'))) throw err;
          r = importIntoLibrary(texts, { allowDowngrade: true });
        }
        toast(`${r.id}: ${r.action}${r.from ? ` (v${r.from} → v${r.to})` : ` (v${r.to})`}`); draw(); check(r.id);
      } catch (err) { toast('読み込めません: ' + err.message); }
    };
    inp.click();
  };
  const aiPack = (id) => { download(`codiram-ai-pack-${id}.zip`, makeZip(buildAiPack({ generatorId: id })), 'application/zip'); toast('AI パックを書き出しました(README.md に使い方があります)'); };
  draw();
  await dialog({ title: '📚 Generator Library', wide: true, body, actions: [{ label: '閉じる', primary: true, value: true }] });
}

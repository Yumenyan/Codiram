// Project templates. New ones can be appended here (or registered by plugins later).
import { emptyProject, createNode, newScript, newBlock, newModel } from './model.js';

const add = (p, parent, type, props = {}, style = {}) => {
  const n = createNode(p, type);
  Object.assign(n.props, props);
  Object.assign(n.style, style);
  parent.children.push(n);
  return n;
};

export const TEMPLATES = [
  {
    id: 'blank', name: 'Blank App', desc: '空のプロジェクト',
    build: () => emptyProject('Untitled Project'),
  },
  {
    id: 'counter', name: 'Counter', desc: 'ボタンで count を増やして表示 (最初の成功条件)',
    build() {
      const p = emptyProject('Counter');
      p.variables.push({ name: 'count', type: 'Number', initial: '0' });
      const root = p.pages[0].root;
      add(p, root, 'text', { text: 'カウンター' }, { fontSize: '24', bold: true });
      add(p, root, 'text', { text: '{count}' }, { fontSize: '48' });
      const btn = add(p, root, 'button', { text: '＋1' }, { width: '120' });
      const s = newScript(p, 'main', 'onClick', { target: btn.id });
      s.body.push(newBlock('change_var', { name: 'count', by: '1' }));
      p.scripts.push(s);
      return p;
    },
  },
  {
    id: 'memo', name: 'Memo (Input → List)', desc: '入力 → 保存 → テーブル表示のデータアプリ',
    build() {
      const p = emptyProject('Memo');
      const m = newModel(p, 'Memo');
      m.fields = [{ name: 'id', type: 'Number' }, { name: 'text', type: 'String' }];
      m.rows = [{ _id: 1, id: 1, text: '牛乳を買う' }, { _id: 2, id: 2, text: 'Codiramを試す' }];
      p.models.push(m);
      p.variables.push({ name: 'newText', type: 'String', initial: '' });
      const root = p.pages[0].root;
      add(p, root, 'text', { text: 'メモ帳' }, { fontSize: '24', bold: true });
      const row = add(p, root, 'row');
      add(p, row, 'input', { placeholder: 'メモを入力', bind: 'newText' }, { width: '260' });
      const btn = add(p, row, 'button', { text: '保存' });
      add(p, root, 'table', { source: 'Memo', cols: 'text', deleteBtn: true });
      const s = newScript(p, 'main', 'onClick', { target: btn.id });
      s.body.push(
        newBlock('add_row', { model: 'Memo', values: { text: 'newText' } }),
        newBlock('set_var', { name: 'newText', value: '""' }),
      );
      p.scripts.push(s);
      return p;
    },
  },
];

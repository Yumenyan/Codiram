// UI dictionary: [English, 日本語]. Add a third element { zh: '…', ko: '…' } (and an entry in LANGS) to support more languages.
import { addPairs, alias } from './i18n.js';

addPairs([
  // top bar / nav / generic
  ['Design', 'デザイン'], ['Data', 'データ'], ['Logic', 'ロジック'], ['Preview', 'プレビュー'],
  ['Run', '実行'], ['▶ Run', '▶ 実行'], ['Export', 'エクスポート'], ['⬇ Export', '⬇ エクスポート'],
  ['Run (F5)', '実行 (F5)'], ['Undo (Ctrl+Z)', '元に戻す (Ctrl+Z)'], ['Redo (Ctrl+Y)', 'やり直し (Ctrl+Y)'],
  ['History', '履歴'],
  ['Language / 言語', 'Language / 言語'], ['Cancel', 'キャンセル'], ['OK', 'OK'], ['Close', '閉じる'], ['Delete', '削除'],
  ['Duplicate', '複製'], ['Save', '保存'], ['Add', '追加'], ['Create', '作成'], ['Undo', '元に戻す'],
  ['Save As…', '名前を付けて保存…'], ['New…', '新規作成…'], ['Open (list)', '開く (一覧)'], ['Project Settings…', 'プロジェクト設定…'], ['Project Settings', 'プロジェクト設定'],
  ['Project name', 'プロジェクト名'], ['App title (HTML <title>)', 'アプリのタイトル (HTML <title>)'],
  ['App-wide font (Google Fonts / built-in)', 'アプリ全体のフォント (Google Fonts / 内蔵フォント)'],
  ['Exported app language (<html lang>)', '完成アプリの言語 (<html lang>)'],
  ['Download project file (.json)', 'プロジェクトファイル(.json)を書き出し'], ['Import project file…', 'プロジェクトファイルを読み込み…'],
  ['Go to project list', 'プロジェクト一覧へ'], ['Toggle light / dark', 'ライト/ダーク切替'], ['✓ Saved', '✓ 保存済み'], ['Saving…', '保存中…'],
  ['⚠ Save failed', '⚠ 保存に失敗'], ['✓ Saved (manual)', '✓ 保存しました'], ['Nothing more to undo', 'これ以上戻せません'], ['Nothing to redo', 'やり直す操作がありません'],
  ['↶ Undone: {0}', '↶ 元に戻しました: {0}'], ['↷ Redone: {0}', '↷ やり直しました: {0}'], ['No history yet', '履歴はまだありません'], ['History restored', '履歴を戻しました'],
  ['latest', '最新'], ['Saved', '保存しました'], ['{0} problem(s)', '{0} 件の問題'], ['Copied', 'コピーしました'], ['Exported the ZIP', 'ZIP を書き出しました'],
  ['Select a component to save', '保存する部品を選択してください'],
  ['Could not open the project', 'プロジェクトを開けませんでした'], ['Failed to read: ', '読み込みに失敗: '], ['Not a Codiram project file', 'Codiramのプロジェクトファイルではありません'],
  // start
  ['My Projects', 'マイプロジェクト'], ['New Project', '新規プロジェクト'], ['New Project — choose a template', '新規プロジェクト — テンプレートを選択'],
  ['Data → UI → Logic → finished web app. Build it all with the GUI, then Export a plain web app.', 'データ → UI → ロジック → 完成したWebアプリ。すべてGUIで、Exportすれば普通のWebアプリとして使えます。'],
  ['⬆ Load a project file (.json)', '⬆ プロジェクトファイル(.json)を読み込む'], ['Delete project', 'プロジェクトを削除'], ['Permanently delete “{0}”.', '「{0}」を完全に削除します。'],
  ['Blank App', '空のアプリ'], ['An empty project', '空のプロジェクト'], ['Counter', 'カウンター'], ['A button increments count and shows it (the first success criterion)', 'ボタンで count を増やして表示 (最初の成功条件)'],
  ['Memo (Input → List)', 'メモ帳 (入力 → 一覧)'], ['A data app: input → save → table', '入力 → 保存 → テーブル表示のデータアプリ'], ['Memo', 'メモ'],
  ['Untitled Project', '無題のプロジェクト'], ['Main', 'メイン'], ['Type a memo', 'メモを入力'], ['Buy milk', '牛乳を買う'], ['Try Codiram', 'Codiramを試す'],
  // design
  ['Components', '部品'], ['Layers', 'レイヤー'], ['🔍 Search components...', '🔍 部品を検索...'], ['Basic', '基本'], ['Layout', 'レイアウト'], ['Media', 'メディア'], ['Advanced', '高度'], ['My Components', 'マイ部品'],
  ['Text', 'テキスト'], ['Button', 'ボタン'], ['Input', '入力欄'], ['Textarea', '複数行入力'], ['Checkbox', 'チェックボックス'], ['Select', 'セレクト'], ['Container', 'コンテナ'], ['Row', '横並び'], ['Column', '縦並び'], ['Card', 'カード'], ['Modal', 'モーダル'],
  ['Table', 'テーブル'], ['List', 'リスト'], ['Image', '画像'], ['Icon', 'アイコン'], ['Video', '動画'], ['Map', '地図'], ['Chart', 'グラフ'], ['Custom Component', 'カスタム部品'],
  ['Page', 'ページ'], ['Page: ', 'ページ: '], ['{0} — click to add / drag to place', '{0} — クリックで追加 / ドラッグで配置'], ['Click to add / drag to place', 'クリックで追加 / ドラッグで配置'], ['Coming via plugin', 'プラグインで追加予定'],
  ['Select a component on the canvas to see its settings here.', 'キャンバスで部品を選択すると、ここに設定が表示されます。'],
  ['Select a component and press ★ to save it here and reuse it in other projects.', 'キャンバスで部品を選び ★ を押すとここに保存され、別プロジェクトでも使えます。'],
  ['Remove from library', 'ライブラリから削除'], ['Toggle Components panel', 'Components パネルの表示/非表示'], ['Toggle Properties panel', 'Properties パネルの表示/非表示'],
  ['Add page', 'ページを追加'], ['Page actions', 'ページの操作'], ['Add page…', 'ページを追加'], ['Rename page…', 'ページ名を変更…'], ['Delete page', 'ページを削除'], ['Page name', 'ページ名'],
  ['Move up (Alt+↑)', '上へ移動 (Alt+↑)'], ['Move down (Alt+↓)', '下へ移動 (Alt+↓)'], ['Duplicate (Ctrl+D)', '複製 (Ctrl+D)'], ['Save to My Components', 'My Components に保存'], ['Delete (Delete)', '削除 (Delete)'],
  ['Canvas width', 'キャンバス幅'], ['Desktop', 'デスクトップ'], ['Tablet 768', 'タブレット 768'], ['Mobile 390', 'モバイル 390'], ['Save to My Components…', 'マイ部品に保存'],
  ['★ Saved “{0}”', '★ 「{0}」を保存しました'], ['Deleted “{0}”', '「{0}」を削除しました'], ['Delete “{0}” and its scripts? (Undo available)', '「{0}」とそのロジックを削除します(Undoで戻せます)。'],
  ['Undo', '元に戻す'], ['↶ Undo', '↶ 元に戻す'], ['{0} + logic will be deleted', '{0}'],
  // properties
  ['General', '一般'], ['Action', 'アクション'], ['Style', 'スタイル'], ['Animation', 'アニメーション'],
  ['Name', '名前'], ['Initially hidden', '最初は非表示'], ['Width', '幅'], ['Height', '高さ'], ['Margin', '外側の余白'], ['Padding', '内側の余白'], ['Fill space (flex:1)', '余白を埋める (flex:1)'],
  ['Direction', '方向'], ['Gap', '間隔'], ['Align items', '配置(交差軸)'], ['Justify', '配置(主軸)'], ['Wrap', '折り返し'],
  ['Text color', '文字色'], ['Background', '背景'], ['Font', 'フォント'], ['Font size', '文字サイズ'], ['Font weight', '文字の太さ'], ['Bold', '太字'], ['Text align', '文字揃え'], ['Border radius', '角丸'], ['Border width', '枠線の太さ'], ['Border color', '枠線の色'],
  ['Entrance animation', '登場アニメーション'], ['Duration (ms)', '時間 (ms)'], ['Delay (ms)', '遅延 (ms)'], ['Easing', 'イージング'], ['Looping animation', '繰り返しアニメーション'], ['Hover effect', 'ホバー効果'], ['Preview', 'プレビュー'], ['▶ Play', '▶ 再生'],
  ['(default)', '(既定)'], ['(none)', '(なし)'], ['Placeholder', 'プレースホルダ'], ['Type', '種類'], ['Label', 'ラベル'], ['Options (comma separated)', '選択肢 (カンマ区切り)'], ['Bind to variable', '変数にバインド'],
  ['Data source (model)', 'データソース (モデル)'], ['Columns (blank = all)', '列 (空=全て)'], ['Row delete button', '行の削除ボタン'], ['Delete button label', '削除ボタンの文字'], ['Item template', '項目テンプレート'],
  ['Image URL', '画像URL'], ['Alt text', '代替テキスト'], ['Video URL', '動画URL'], ['Show {variable} to display a variable value', '{変数名} で変数の値を表示'],
  ['On Click', 'クリック時'], ['On Double Click', 'ダブルクリック時'], ['On Hover', 'ホバー時'], ['On Change', '変更時'], ['On Enter key', 'Enterキー押下時'], ['▦ Edit Logic', '▦ ロジックを編集'],
  ['＋ New variable…', '＋ 新規変数…'], ['New variable', '新しい変数'], ['Variable name (letters, digits, _)', '変数名 (英数字・日本語・_)'], ['Variable name', '変数名'],
  ['Choose an entrance or looping animation first', '登場アニメーションまたは繰り返しアニメーションを選んでください'],
  ['Built-in fonts', '内蔵フォント'], ['Google Fonts (Japanese)', 'Google Fonts(日本語)'], ['＋ Enter a Google Fonts name…', '＋ Google Fonts 名を入力…'], [' (Google Fonts)', ' (Google Fonts)'],
  ['Google Fonts family name', 'Google Fonts のフォント名'], ['A font name from https://fonts.google.com (e.g. Kiwi Maru)', 'https://fonts.google.com にあるフォント名(例: Kiwi Maru)'],
  ['Light (300)', '細字 (300)'], ['Regular (400)', '標準 (400)'], ['Medium (500)', '中太 (500)'], ['Bold (700)', '太字 (700)'], ['Black (900)', '極太 (900)'],
  // data
  ['Models', 'モデル'], ['＋ New Model', '＋ 新規モデル'], ['Variables', '変数'], ['App variables', 'アプリ変数'], ['Delete model', 'モデルを削除'], ['Schema', 'スキーマ(項目定義)'], ['Field', '項目'], ['＋ Field', '＋ 項目'], ['＋ Row', '＋ 行'],
  ['📋 Paste (CSV/TSV)', '📋 貼り付け (CSV/TSV)'], ['Initial value', '初期値'], ['＋ Variable', '＋ 変数'], ['Add a field', 'フィールドを追加してください'], ['Delete field', 'フィールドを削除'], ['Delete row', '行を削除'], ['Delete variable', '変数を削除'],
  ['No data models yet.', 'データモデルがありません。'], ['Delete “{0}” and its data? (Undo available)', '「{0}」とそのデータを削除します(Undoで戻せます)。'],
  ['A model with that name already exists', '同名のモデルが既にあります'], ['A field with that name already exists', '同名のフィールドがあります'], ['A variable with that name already exists', '同名の変数があります'],
  ['Used by blocks, {variable} in text and input binding.', 'ブロックや UI の {変数名} 表示・入力部品のバインドで使う値です。'],
  ['Paste rows', '貼り付けで行を追加'], ['Paste from a spreadsheet (a first row of field names is treated as a header)', 'Excel / スプレッドシートからコピーした内容を貼り付け(先頭行がフィールド名ならヘッダとして扱います)'],
  ['Add row', '行を追加'], ['Add model', 'モデルを追加'], ['Add variable', '変数を追加'], ['Add field', '項目を追加'], ['Rename model', 'モデル名変更'], ['Rename field', '項目名変更'], ['Rename variable', '変数名変更'],
  ['Change type', '型を変更'], ['Edit cell', 'セルを編集'], ['Variable initial', '変数の初期値'], ['Variable type', '変数の型'], ['Delete model', 'モデルを削除'], ['Paste', '貼り付け'], ['Paste blocks', 'ブロックを貼り付け'],
  ['Rename page', 'ページ名変更'], ['Rename script', 'スクリプト名変更'], ['Project settings', 'プロジェクト設定'], ['Resize', 'リサイズ'], ['Move', '移動'], ['Reorder', '並べ替え'], ['Edit block', 'ブロックを編集'],
  ['Create script', 'スクリプト作成'], ['Delete script', 'スクリプト削除'], ['Duplicate script', 'スクリプト複製'], ['Add block', 'ブロック追加'], ['Move block', 'ブロック移動'],
  ['Add ', '追加: '], ['Edit ', '編集: '], ['Delete ', '削除: '], ['Insert ', '挿入: '], ['Rename ', '名前変更: '], ['Create ', '作成: '], ['Duplicate ', '複製: '],
  // logic UI
  ['Scripts', 'スクリプト'], ['＋ New', '＋ 新規'], ['Blocks', 'ブロック'], ['Problems', '問題'], ['(no scripts)', '(スクリプトなし)'], ['✓ No problems found', '✓ 問題は見つかりません'],
  ['Toggle Scripts panel', 'Scripts パネル'], ['Toggle Blocks panel', 'Blocks パネル'], ['No scripts yet.', 'スクリプトがありません。'],
  ['Create an event from “＋ New” on the left, or press Edit Logic in a component’s properties in Design.', '左の「＋ New」からイベントを選んで作成するか、Design の部品プロパティから Edit Logic を押してください。'],
  ['＋ Create a “page shown” script', '＋ ページ表示時のスクリプトを作る'], ['Drag blocks or click to add · Ctrl+click to multi-select', 'ブロックをドラッグ / クリックで追加 · Ctrl+クリックで複数選択'],
  ['Script name (optional)', 'スクリプト名(任意)'], ['Duplicate script', 'スクリプトを複製'], ['Delete script', 'スクリプトを削除'], ['This script will be deleted (Undo available).', 'このスクリプトを削除します(Undoで戻せます)。'],
  ['🔍 Search blocks...', '🔍 ブロックを検索...'], ['Drop blocks here', 'ここにブロックをドロップ'], ['Drag to move', 'ドラッグで移動'], ['Duplicate (Ctrl+D)', '複製 (Ctrl+D)'],
  ['Click to create a new script', 'クリックで新規スクリプトを作成'], ['Click to add / drag to place', 'クリックで追加 / ドラッグで配置'], ['Create a script (event) first', '先にスクリプト(イベント)を作成してください'],
  ['{0} block(s) deleted', '{0} 個のブロックを削除しました'], ['{0} block(s) copied', '{0} 個のブロックをコピーしました'], ['Add condition (AND/OR)', '条件を追加 (AND/OR)'], ['Remove condition', '条件を削除'], ['Negate the whole condition (NOT)', '条件全体を否定 (NOT)'],
  ['(select)', '(選択)'], ['(component)', '(部品を選択)'], ['(model)', '(モデル)'], ['(page)', '(ページ)'], ['(function)', '(関数)'], ['(variable)', '(変数)'], ['(field)', '(フィールド)'], ['(Select a model first)', '(先にモデルを選択)'], ['(unselected)', '(未選択)'],
  ['and', 'かつ'], ['or', 'または'], ['＝', '＝'],
  ['Entrance', '登場'], ['Looping', '繰り返し'], ['One-shot / exit', '単発・強調・退場'],
  ['Variable not selected', '変数が未選択です'], ['No data model selected', 'データモデルが未選択です'], ['Page not selected', 'ページが未選択です'], ['Function not selected', '関数が未選択です'],
  ['The target component is not selected', '対象のUI部品が未選択です'], ['The target component was not found (it may have been deleted)', '対象のUI部品が見つかりません(削除された可能性)'], ['The destination page was not found', '移動先のページが見つかりません'],
  ['Unknown block: {0}', '不明なブロック: {0}'], ['Data model “{0}” does not exist', 'データモデル「{0}」が存在しません'], ['Variable “{0}” does not exist', '変数「{0}」が存在しません'],
  ['Function “{0}” is not defined', '関数「{0}」が定義されていません'], ['Field “{0}” does not exist in {1}', 'フィールド「{0}」が {1} に存在しません'],
  ['ƒ {0} call', 'ƒ {0} を実行'],
  // old blocks (Japanese sources)
  ['{0} click', '{0} クリック'], ['{0} change', '{0} 変更'], ['Page “{0}” shown', 'ページ「{0}」表示時'], ['Timer {0}ms', 'タイマー {0}ms'], ['Data {0} changed', 'データ {0} 変更'], ['Function {0}', '関数 {0}'], ['(unnamed)', '(無名)'],
  ['{0} click', '{0} クリック'], ['{0} change', '{0} 変更'], ['Page “{0}” shown', 'ページ「{0}」表示時'], ['Timer {0}ms', 'タイマー {0}ms'], ['Data {0} changed', 'データ {0} 変更'], ['Function {0}', '関数 {0}'], ['(unnamed)', '(無名)'],
  ['Events', 'イベント'], ['Control', '制御'], ['Conditions', '条件'], ['Math', '演算'], ['Time', '日付・時刻'], ['Object', 'オブジェクト'], ['System', 'システム'], ['Array', '配列'], ['String', '文字列'], ['Number', '数値'], ['Boolean', '真偽値'], ['Date', '日付'],
  ['auto', '自動'], ['Tooltip', 'ツールチップ'],
  // preview / export / dialogs
  ['▶ Restart', '▶ 再実行'], ['■ Stop', '■ 停止'], ['✎ Edit', '✎ 編集'], ['Edit → Run → Use → Stop → Edit  (Preview data is not saved)', '編集 → 実行 → 使う → 停止 → 編集  (Preview のデータは保存されません)'],
  ['⚠ {0} error(s)', '⚠ {0} 件のエラー'], ['Go to the block', '該当ブロックへ移動'],
  ['Export — as an ordinary web project', 'Export — 普通のWebプロジェクトとして書き出し'],
  ['HTML / CSS / JavaScript / JSON only. No dependency on any editor or service. Unzip and open index.html.', 'HTML / CSS / JavaScript / JSON のみ。特定のエディタやサービスに依存しません。ZIP を展開して index.html を開くだけで動作します。'],
  ['Copy current file', '現在のファイルをコピー'], ['⬇ Download ZIP', '⬇ ZIP をダウンロード'], ['Close', '閉じる'], ['Cancel', 'キャンセル'],
  ['Language', '言語'], ['soon', '近日'], ['{0} rows', '{0} 行'], ['Page: {0}', 'ページ: {0}'],
]);

// Code strings that differ slightly from the canonical English key
alias('New Project — テンプレートを選択', 'New Project — choose a template');
alias('履歴 History', 'History');
alias('Open (一覧)', 'Open (list)');
alias('保存中…', 'Saving…');
alias('Edit → Run → Use → Stop → Edit  (Preview のデータは保存されません)', 'Edit → Run → Use → Stop → Edit  (Preview data is not saved)');
alias('Components パネルの表示/非表示', 'Toggle Components panel');
alias('Properties パネルの表示/非表示', 'Toggle Properties panel');

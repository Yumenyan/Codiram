# Codiram

GUI だけで実用的な Web アプリを作るための、自分専用の Web アプリ開発環境。

**データ → UI → ロジック → 外部連携 → 完成した Web アプリ** を、ブラウザ上の GUI で構築し、
最後は普通の HTML / CSS / JavaScript / JSON として Export できます(特定サービスへの依存なし)。

## 使い方

ビルド不要・依存ライブラリなしの静的アプリです。

```bash
python3 -m http.server 8000   # または任意の静的サーバ
# → http://localhost:8000/ を開く
```

(ES Modules を使うため `file://` ではなく HTTP サーバ経由で開いてください。)

## 画面

| 画面 | 内容 |
| --- | --- |
| **Design** | 左: Components(検索・カテゴリ折りたたみ・My Components)/ 中央: Canvas(ドラッグ配置・入れ子・リサイズ・複製・削除)/ 右: Properties |
| **Data** | データモデル(String/Number/Boolean/Date/Array/Object)、スプレッドシート風の行編集、アプリ変数 |
| **Logic** | Scratch/Blockly 型の縦ブロック。イベント/ページ単位でスクリプトを整理。Drag&Drop・複製・削除・コピー/貼り付け・複数選択・検索 |
| **Preview** | 生成した実アプリを iframe で実行(Edit → Run → Use → Stop → Edit)。エラーはブロック単位で表示しワンクリックで移動 |
| **Export** | `index.html / style.css / app.js / data/ / assets/ / README.md` を ZIP で書き出し |

* Undo / Redo(Ctrl+Z / Ctrl+Y)、履歴パネル、自動保存(localStorage、`✓ Saved` 表示)
* ライト/ダークテーマ、狭い画面ではサイドバーを折りたたみ
* ショートカット: Ctrl+S 保存 / Ctrl+Z,Y Undo,Redo / Ctrl+C,V,D コピー,貼り付け,複製 / Delete 削除 / Ctrl+F 検索 / F5 実行
* データバインド: Text に `{変数}`、Input/Select/Checkbox → 変数、Table/List → モデル
* 条件・式: `count + 1`、`Input1`(入力値)、`item.name`(各行) などを入力可。式として解釈できない文字列はそのまま文字列として扱います

## MVP の動作確認

* テンプレート **Counter**: Button → count を 1 増やす → 画面に count を表示
* テンプレート **Memo**: Input → 保存 → Table 表示(行の削除ボタン付き)

## アーキテクチャ

```
index.html            エントリ
css/app.css           IDE テーマ(ライト/ダーク)
js/main.js            トップバー・ビュー切替・ショートカット
js/store.js           プロジェクト状態 / Undo-Redo / 自動保存 / My Components
js/model.js           プロジェクトのデータ構造とヘルパ、静的チェック(Problems)
js/registry.js        components / blocks / exporters のレジストリ + registerPlugin()
js/components.js      UI 部品の定義とレンダリング(Canvas と Export で共用)
js/blocks.js          ブロック定義(表示パーツ + コード生成)
js/generator.js       プロジェクト → index.html / style.css / app.js / data/*(Node でも動作)
js/views/*.js         Design / Data / Logic / Preview / Start
js/export.js, zip.js  Export ダイアログと依存なし ZIP 生成
js/templates.js       テンプレート
```

Preview も Export と同じ生成コードを実行するため、「Preview で動いたものが Export でも動く」ことを保証します。

### 拡張(将来)

`registerPlugin({ components, blocks, exporters, install })` で部品・ブロック・エクスポータを追加できる構造です
(REST API / CSV / Map / Chart などは後から追加する想定)。関数ブロック(`関数を定義` / `関数を実行`)は自作ブロックの土台です。

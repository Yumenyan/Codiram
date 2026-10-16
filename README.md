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
| **Logic** | Scratch/Blockly 型の縦ブロック(カテゴリごとに色・形・アイコン・ラベルで識別)。イベント/ページ単位でスクリプトを整理。Drag&Drop・複製・削除・コピー/貼り付け・複数選択・検索 |
| **Preview** | 生成した実アプリを iframe で実行(Edit → Run → Use → Stop → Edit)。エラーはブロック単位で表示しワンクリックで移動 |
| **Export** | `index.html / style.css / app.js / data/ / assets/ / README.md` を ZIP で書き出し |

* Undo / Redo(Ctrl+Z / Ctrl+Y)、履歴パネル、自動保存(localStorage、`✓ Saved` 表示)
* ライト/ダークテーマ、狭い画面ではサイドバーを折りたたみ
* **多言語UI**: トップバーの 🌐 から 日本語 / English を切替(選択は保存されます)。辞書は `js/i18n-dict.js`、ブロックは `J('日本語','English')` で定義するので、言語の追加は `LANGS` と辞書に列を足すだけです
* **フォント**: Project Settings でアプリ全体、Properties › Style › Font で部品ごとに指定。内蔵フォント(游ゴシック・明朝など)と Google Fonts(Noto Sans JP、M PLUS Rounded 1c、Zen Maru Gothic … 任意の Google Fonts 名も入力可)に対応。Export した `index.html` に必要な `<link>` が自動で入ります
* **アニメーション**: Properties › Animation で 登場(フェード・スライド・ズーム・バウンド・フリップ…)/ 繰り返し(パルス・ふわふわ・回転・点滅…)/ ホバー効果(拡大・浮き上がり・発光…)を設定、▶ で即プレビュー。Logic の Animation ブロックで再生・トゥイーン(滑らかに移動/拡大/回転/透明度)・停止・リセットも可能(`prefers-reduced-motion` を尊重)
* ショートカット: Ctrl+S 保存 / Ctrl+Z,Y Undo,Redo / Ctrl+C,V,D コピー,貼り付け,複製 / Delete 削除 / Ctrl+F 検索 / F5 実行
* データバインド: Text に `{変数}`、Input/Select/Checkbox → 変数、Table/List → モデル
* 条件・式: `count + 1`、`Input1`(入力値)、`item.name`(各行) などを入力可。式として解釈できない文字列はそのまま文字列として扱います

## Logic ブロック一覧(約120種)

| カテゴリ | 主なブロック |
| --- | --- |
| イベント | クリック / ダブルクリック / ホバー / 入力変更 / Enter / キー / ページ表示 / タイマー / データ変更 / 関数定義 |
| 変数・条件・制御 | 設定 / 増減、IF-ELSE(AND/OR/NOT)、繰り返し / 数え上げ / while / 各行、break / continue / 終了、try-catch、遅延実行、タイマー開始・停止、関数 |
| 演算 | 四則演算・余り・べき乗、数学関数(round/floor/sqrt/sin/log…)、最大/最小、範囲に収める、乱数、丸め、定数、型変換、数値判定、整形(桁区切り・円・%) |
| 文字列 | 連結、長さ、部分文字列、置換、大文字/小文字/trim、検索、文字取得、分割、繰り返し、埋め、正規表現(判定/抽出/置換)、URL・Base64 |
| 配列 | 作成、追加/取り出し/挿入/削除/書き換え、取得、合計・平均・最大・最小、検索、結合、連結、並べ替え/重複削除/シャッフル、連番、filter / map / find / some・every、キー指定ソート、各要素ループ |
| オブジェクト | プロパティ設定/取得/削除、keys/values/entries、結合、JSON 変換 |
| 日付・時刻 | 取得(年月日・曜日・時刻・タイムスタンプ)、加算、差、書式化 |
| データ | 追加 / 削除 / 全削除 / 更新 / 検索 / 並べ替え、全行を配列へ |
| UI・アニメーション | テキスト・値・スタイル・属性・有効/無効・フォーカス・スクロール、表示/非表示、モーダル、ページ移動、再生/トゥイーン/停止/リセット |
| システム | ログ、入力/確認ダイアログ、ブラウザ保存(localStorage)、クリップボード、URLを開く、ファイル保存、Web API(fetch)、環境情報、タイトル |

結果を入れるブロックは「変数 ○ に … を入れる」形式です。式欄には `count + 1`、`Input1`、`item.name` のような式も書けます。

## テスト

```bash
npm test   # 全ブロック種別が有効な JavaScript を生成することを確認
```

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
js/blocks.js          基本ブロック定義(表示パーツ + コード生成)
js/blocks-extra.js    拡張ブロック(演算・文字列・配列・オブジェクト・日時・UI・アニメ・システム)
js/fonts.js           フォントカタログ(内蔵 / Google Fonts)
js/animations.js      アニメーションプリセット(@keyframes を Export に出力)
js/i18n.js, i18n-dict.js  多言語化(翻訳辞書)
js/generator.js       プロジェクト → index.html / style.css / app.js / data/*(Node でも動作)
js/views/*.js         Design / Data / Logic / Preview / Start
js/export.js, zip.js  Export ダイアログと依存なし ZIP 生成
js/templates.js       テンプレート
```

Preview も Export と同じ生成コードを実行するため、「Preview で動いたものが Export でも動く」ことを保証します。

### 拡張(将来)

`registerPlugin({ components, blocks, exporters, install })` で部品・ブロック・エクスポータを追加できる構造です
(REST API / CSV / Map / Chart などは後から追加する想定)。関数ブロック(`関数を定義` / `関数を実行`)は自作ブロックの土台です。

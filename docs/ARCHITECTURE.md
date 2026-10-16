# Codiram / Modiram — アーキテクチャと実装状況

Codiram を「1つのビジュアルなロジック・データ・UI定義から、異なる実行環境向けの成果物を生成する Visual Development Platform」へ
発展させるための設計メモ(計画書 Phase 0〜2 の実施結果)です。

## 1. Phase 0 — 既存コードの調査結果

| 領域 | 現在の実装 | 共通化できるか |
| --- | --- | --- |
| プロジェクト形式 | 1つの JSON(`pages`/`models`/`variables`/`scripts`/`assets`/`settings`)。`localStorage` に保存。Undo は JSON スナップショット | ほぼ全て共通。UI(`pages`)と `assets` は Web 寄り |
| Block 定義 | `js/blocks*.js` のレジストリ。各ブロックが **表示(parts/fields)** と **コード生成(`gen`)** を持つ | 表示と変数・条件・ループなどの意味は共通。`gen` は Target 固有(JavaScript) |
| 式 | 文字列(`count + 1`)または入れ子の値ブロック(`{ $b: … }`) | 構文は共通。変換は Target 側 |
| Logic 実行 | 実行時インタプリタは無い。**ブロック → JavaScript 生成** のみ(Preview も同じ生成物を iframe で実行) | 生成器を Target として切り出せる |
| State | `store.js`(プロジェクト・Undo/Redo・自動保存)と `ui`(選択状態など) | Target 非依存 |
| Preview / Export | `generator.js` が `index.html / style.css / app.js / data/…` を文字列生成。ZIP は自前の writer | Web Target 固有。ZIP と Export ダイアログは共通 |
| Asset | `project.assets`(data URL)。Export で `assets/` に書き出し | Web で使用。他 Target でも利用可 |
| ブラウザゲーム | `Game` ブロック群 + 実行時モジュール(`generator.js` の `MODULES.game`) | Web Target 固有 |

### 結論(Minecraft Generator を追加する位置)

```
Visual Blocks ──(Web: 直接 gen)────────────────► Web Generator   → HTML/CSS/JS
       │
       └──(def.ir)──► IR ──(Target Generator)──► Minecraft Gen.   → Fabric / Java
```

* 既存の Web 生成(ブロック → JS)は**そのまま維持**し、書き換えない(計画書 3.1 / 30)。
* 新しい Target(Minecraft 以降)は **ブロック → IR → コード** の経路を使う。IR は「必要な範囲から段階的に」導入し、
  Web を IR 経由に作り替えることは今は行わない。

## 2. Target 概念(Phase 1)

### プロジェクト形式 v2(後方互換)

```jsonc
{
  "version": 2,
  "targets": [
    { "type": "web" },
    { "type": "minecraft", "loader": "fabric", "minecraftVersion": "1.19.2", "javaVersion": 17,
      "generatorVersion": "1", "modId": "hello_mod", "modName": "Hello Mod", "package": "com.example.hellomod", … }
  ],
  "activeTarget": "minecraft",
  "pages": [...], "models": [...], "variables": [...], "scripts": [...], "assets": [...], "settings": {...}
}
```

* `version` 無し(v1)のプロジェクトは `normalizeProject()` が **Web プロジェクトとして**開く(`targets=[{type:'web'}]`)。
* `activeTarget` は「いま Design / Logic / Output が対象にしている Target」。1 プロジェクトに複数 Target を持てる(将来のマルチ Target の土台)。

### Target 定義(`js/registry.js` の `registerTarget`)

```js
registerTarget({
  id, order, name, icon, desc,
  views: ['design', 'data', 'logic', 'preview'],  // その Target が提供する画面(Minecraft は data/logic/output)
  defaultConfig(), validateConfig(cfg), configFields: [...],  // Target 設定(設定ダイアログを自動生成)
  generate(project, cfg) → { files, problems, root },          // 出力プロジェクト
  lint(project),                                                // Target 固有の問題チェック
});
```

* Web: `js/targets/web.js`(既存 Generator のラッパー)
* Minecraft: `js/targets/minecraft/`(`blocks.js` / `java.js` / `project.js` / `index.js`)

### Block と Target(計画書 22)

各ブロックは `targets: ['web', 'minecraft', …]` を持つ(省略時は `['web']`)。

* 共通ブロック(変数・IF・繰り返し・待つ・関数・比較・四則演算・文字列結合 …)は **複数 Target** を指定し、Target ごとの実装(Web=`gen`、他=`ir`/`irExpr`)を持つ
* 他 Target では **実装(`ir` / `irHat` / `irExpr`)が無いブロックは使えない**(`blockSupports()`)。パレットに出ず、Lint でも警告
* スクリプトの所属は **先頭のイベントブロック**で決まる(`scriptsFor(project, target)`)。Web のイベントは Minecraft の Generator に渡らない

## 3. IR(`js/ir.js`)

```
IR 文:  { op:'set'|'if'|'repeat'|'wait'|'call'|'comment'|'log'|'<target>.<action>' , … }
IR 式:  { k:'num'|'str'|'bool'|'var'|'bin'|'un'|'call'|'<target>' , … }
```

* ユーザーが書いた式(`count + 1`、`"Hi " + name`)は `parseExpr()` が IR に変換(数式・比較・論理・文字列・変数)。式として解釈できない文字列は文字列リテラル(Web と同じルール)
* 値ブロックは `def.irExpr`、コマンドは `def.ir`、イベントは `def.irHat` で IR を返す
* 型は `irType()` で `num / str / bool / any` を静的に推論し、Generator が型に合わせた Java を出す

## 4. Minecraft / Modiram MVP(Phase 2)

対象: **Fabric / Minecraft 1.19.2 / Java 17**(複数バージョン対応は後回し)。

| 種類 | ブロック |
| --- | --- |
| Events | プレイヤー参加 / ブロック右クリック / ブロック破壊 / ブロック設置 / アイテム使用 |
| Actions | メッセージ送信(本人/全員)/ アイテムを与える / 取り上げる / ブロックを置く / テレポート / 音を鳴らす |
| 値・条件 | プレイヤー名・座標 / 手持ちアイテム / イベントのブロックID・座標 / アイテムを持っているか / スニーク中か |
| 共通(Web と共用) | 変数の設定・増減、IF-ELSE、比較・かつ・または・でない、繰り返し、待つ(ティック)、関数(引数あり)、四則演算、文字列結合、乱数、メモ、ログ |

### 生成物(通常の Fabric プロジェクト)

```
<modid>/
  build.gradle  settings.gradle  gradle.properties  gradle/wrapper/gradle-wrapper.properties  .gitignore
  src/main/resources/fabric.mod.json
  src/main/java/<package>/
      <ModClass>.java   エントリポイント
      Handlers.java     ブロックから生成したイベント処理・関数   (再 Export で上書き)
      Vars.java         グローバル変数                         (再 Export で上書き)
      Cx.java           小さなランタイム(型変換・待つ・ID検索)   (再 Export で上書き)
      Custom.java       手書きコード用(空で生成)
  README.md   codiram.project.json (Codiram で再編集するためのプロジェクト)
```

* Codiram 専用ランタイムには依存しない(`Cx.java` は生成物に含まれる普通の Java)
* 「待つ」は `Cx.later(...)` による**ティック後実行**に変換(処理の一番外側でのみ使用可。ループ・条件分岐の中は Lint でエラー)

### 既知の制約(MVP)

* ブロック設置イベントは Fabric API に専用イベントが無いため、**ブロックアイテムを持って右クリックした時**に発火(Mixin は使わない)
* 変数は Number / String / Boolean のみ、全プレイヤー共通(プレイヤーごとの変数は未対応)
* 関数の戻り値は未対応、データモデル・UI は Minecraft Target では未対応
* **実際の Gradle ビルドと Minecraft 起動は、この開発環境では実行できていません**(Fabric/Mojang のリポジトリに接続不可)。
  代わりに `tests/minecraft.test.mjs` が、生成 Java を **API スタブに対して `javac` で型チェック**します。
  スタブは Fabric API / Yarn(1.19.2)のシグネチャを手で写したものなので、最終確認は実機での `gradle build` です。

## 5. ロードマップ(計画書の順序)と現在地

| 段階 | 状態 |
| --- | --- |
| 既存コード調査(Phase 0) | ✅ このドキュメント |
| Target 概念 / Generator 境界(Phase 1) | ✅ `version 2`・`targets`・Target レジストリ・ブロックの `targets` |
| Minecraft MVP(Phase 2) | ✅ 生成まで実装(ビルド・起動の実機確認は未実施) |
| Minecraft ブロック拡張(Phase 3) | ⏳ 次(Block/Item/Recipe、Tick・死亡・リスポーン等のイベント、GUI) |
| API / WebSocket 連携(Phase 4)→ Server(Phase 5)→ Web 強化 → Desktop → CLI/Bot → Game → IoT → Plugin SDK | ⏳ |

Plugin / Generator SDK は `registerTarget()` / `registerBlock()` / `registerPlugin()` が土台です。

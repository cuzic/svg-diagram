# ADR 0080: 帯のプラグイン — 外部パッケージが「汎用の新しい帯(band)」を足す仕組み(スパイク付き)

- 状態: 提案(Draft。2026-11-23。決める人の確認待ち。Q1〜Q14 は未決。設計と小さなスパイクで、`lib/` は変えていない)
- 日付: 2026-11-23
- 基点: `main`(74816524。ADR 0078 U0a まで)
- 関連: ADR 0079(マンガ風の顔のライブラリ。PR #454。この ADR が D1 の「別パッケージ」の渡し方を広げる)、ADR 0074(`comic()`、`CharacterManifest`、`loadCharacter`。**人物は図ごとに渡し、グローバルに持たない**)、ADR 0031(FCIS、`lib/` は純粋な core)、ADR 0007(Ports)、ADR 0045(`svg-diagram/browser`、`renderInBrowser`)、ADR 0077 / 0078(`balloon`、重ねの帯、`FlowBand`、内容の目録)、ADR 0012(id のスコープ)、ADR 0034(`data-node`)、ADR 0069(`partCatalog`)、ADR 0071(JSON Schema)
- 範囲外: 外部パッケージが**既存の**帯の描き方を差し替えること(上書き)。プラグインの配布の場(レジストリ、検索)。プラグインの課金。入れ子の帯を持つ帯(コンテナ)は v1 では対象外(D2、Q5)。コアの帯を全部プラグインに移すこと(D6 で「しない」と決める)
- 例のデータはすべてこの ADR のための作り話(星の評価の帯 `rating-demo:stars`、「使いやすさ」「新しい画面」など。顔の例は ADR 0079 の中立な作り話の範囲)

## 背景

決める人の言葉: 「汎用の新しい band を足すことができる plugin として考えたい」。

ADR 0079 は、マンガ風の顔のライブラリを**別のリポジトリ**に置き、出力を `CharacterManifest`(JSON)にして、svg-diagram は何も変えない案を推奨した。決める人は、それより一段広く、**外部パッケージが `comic` のような帯そのものを足せる**ことを求めている。顔を 1 つ描く帯(avatar)、顔の一覧の帯、そして `comic()` に渡す人物の提供元が、同じ 1 つのプラグインに入る。

今の帯の足し方は、コアの中の**約 10 の型つきの表と、約 8 か所の `switch` / `if` の連なり**に、手で 1 行ずつ足すことである(次の表)。外部のパッケージからは足せない。足せるようにしつつ、**コアの帯の「抜けがあればコンパイルが落ちる」性質は残したい**。

### コードで確かめたこと — 帯の種類をキーにする表と分岐の全部

`comic`(`lib/comic/`、`lib/dsl/comic.ts`)を端から端まで追い、`bowtie`・`valueChain` の名前を `lib/` 全体で検索して集めた。

**(A) 型で全部の帯を要求する表(抜けるとコンパイルが落ちる。10 個)**

| # | 表 | 場所 | キー | 役割 |
|---|---|---|---|---|
| 1 | `LAYOUT_HANDLERS` | `lib/layout-handlers.ts` | `Band['type']` | 配置(カーソルを進め、`ctx.register` で anchor を登録、`laidOut.push`)。`ALL_BANDS_HANDLED` |
| 2 | `MEASURE_HANDLERS` | `lib/layout-measure.ts` | `Band['type']` | 測定の依頼(1 回の `measureAll` にまとめる) |
| 3 | `REVEAL_HANDLERS` | `lib/reveal-handlers.ts` | `Band['type']` | クリックの段(`reveal` / `until`)。`UnrevealedBandTypes` |
| 4 | `CHILD_BANDS` | `lib/band-children.ts` | `Band['type']` | 入れ子の帯 |
| 5 | `STACK_WIDTH` | `lib/band-children.ts` | `Band['type']` | 入れ子を積む幅 |
| 6 | `EMIT_HANDLERS` | `lib/emit-handlers.ts` | `LaidOutType` | SVG。`selfDimming`。`ALL_BANDS_EMITTED` |
| 7 | `VERIFY_HANDLERS` | `lib/verify-handlers.ts` | `LaidOutType` | 検査の長方形(`rects`)、図形の検査(`check` の phase)、コントラスト。`ALL_BANDS_VERIFIED` |
| 8 | `FIT_HANDLERS` | `lib/fit-handlers.ts` | `LaidOutType` | 文字の大きさ(小さい文字の検査)。`ALL_BANDS_FITTED` |
| 9 | `INVENTORY_HANDLERS` | `lib/inventory.ts` | `LaidOutType` | ADR 0078 の中身の目録(`text` / `frame` / `whole` …) |
| 10 | `BAND_HANDLERS` | `lib/pptx/bands.ts` | `LaidOutType` | PPTX(ネイティブか `'image'`) |

`comic` の行は、2・4・5・7・8・9 では `fromTuples(comicMeasure)` / `none` / `noStack` / `{rects, check: {phase: 'comic'}}` / `texts` / `whole`、10 は `'image'`、1 は `placedBand(…)`、6 は `renderComicBand`、3 は `plain`。

**(B) 型で守られない表(キーが省略可、または `switch` / `if` の連なり)**

| # | 場所 | 中身 | プラグインの帯で要ること |
|---|---|---|---|
| 11 | `BandLayoutHandlers`(`lib/layout-ctx.ts`)の `layoutHandlerFor` | キーが省略可。**無い型は黙って box として配置される**(`?? layoutBoxLikeBand`) | `plugin` を明示。黙って箱になる経路を絶対に通さない |
| 12 | `TEXT_RUNS`(`lib/layout-text.ts`) | 省略可(`caption` / `box` / `banner` のみ) | 不要 |
| 13 | `itemIdsOf` / `bareNodeIds`(`lib/band-ids.ts`) | 配置**前**の帯から、節の id を `switch` で取る。reveal と anchor のスコープが使う | データから id を返す仕組み(下の `ids`) |
| 14 | `withNodeIdsBand`(`lib/emit-node-ids.ts`) | `data-node` を付ける `switch` | 共通の規約(`data-anchor`) |
| 15 | `drawsFrame` / `itemRect`(`lib/locations-map.ts`) | ソースの位置の地図 | 既定(枠なし、anchor の長方形) |
| 16 | スポットライトの `if` 連なり 2 か所(`lib/spotlight.ts`)、`lib/layout-metrics.ts` の連なり、`lib/focus.ts` | anchor を項目として数える帯の列挙 | `plugin` を anchor を持つ帯の側に足す |
| 17 | `lib/rules.ts` の帯別の規則(`comicRules`、`rcaRules`、`FIT_WHO`) | 帯の種類で findings を取り出す | プラグインの findings を取り出す 1 か所 |
| 18 | `RULE_DOCS` / `RULE_LOCATION`(`lib/rules.ts`)、`RuleId = keyof typeof RULE_DOCS` | 規則の id は**コンパイル時に閉じている**。`accept` もこの型 | プラグインの規則 id は開いた文字列(D2、D5) |
| 19 | `CHECK_PHASES`(`lib/verify-handlers.ts`) | 検査の phase の列(`'comic'` もここ) | `'plugin'` を 1 つ足す |
| 20 | spec: `PARTS`(`lib/spec.ts`、`lib/spec-parts/*.ts`)、`partCatalog()`、`specSchema`、`pnpm schema`(`lib/schema-files.ts`)、`validateOneOf` の `const` による分岐 | JSON の入口。MCP の `list_diagram_parts` はここを読む | 供給されたプラグインから部品とスキーマを作る |
| 21 | `IN_NO_SPEC_YET`(`test/spec.test.ts`)、`test/fixtures/untested-exports.json`、`test/fixtures/rule-locations.ts`、`test/band-registries.test.ts` | 「DSL にあるが spec に無い」の台帳と、表の実行時の網羅テスト | `plugin` の行。プラグイン用の適合テスト(U6) |
| 22 | 型: `Band` / `LaidOutBand`(`lib/types/index.ts`)、`Declares<Id>` / `Refers`(`lib/strict.ts`) | 合併型、`connect()` の id の型検査 | `PluginBand`(D4) |
| 23 | 公開 API: `lib/dsl-pure.ts`(`located(...)`)、`lib/web.ts`、`package.json` の `exports` | DSL の関数の置き場。ブラウザの入口は `node:*` を持たない(`test/web-entry.test.ts`) | `svg-diagram/plugin` の入口(D1、D8) |
| 24 | ドキュメント: `README.md`、`skills/svg-diagram/references/*.md`、`docs/chatgpt-code-interpreter.md`、MCP の `list_diagram_parts` | 部品の説明 | プラグインが自分の説明を持つ(D2) |

つまり、1 つの帯を足す作業は、(A) の 10 か所、(B) の十数か所、型とテストに及ぶ。ADR 0074 の `comic` はこれを全部やった実例で、`lib/comic/` に 14 ファイル、表への 1 行が 10 個、`rules.ts` と `verify-handlers.ts` への分岐がある。

### ADR 0074 と 0031 から引き継ぐ約束

- **人物は図ごとに渡し、グローバルに持たない**(ADR 0074 D3、`comic({characters})`)。→ プラグインも**呼び出しごと**に渡す(D3)。
- `lib/` は純粋(`fs`・`child_process` なし。ブラウザの入口は `node:*` なし)。→ プラグインの帯も、純粋な関数だけで作れること(D2 の保証)。
- 外部の SVG は `loadCharacter` が `sanitizeBody` で掃除する(図形・グループ・グラデーション・クリップパスだけ。`text`・`style`・`script`・`use`・`image`・`foreignObject`・外への参照・名前つきの色を拒む)。→ プラグインの SVG も同じ門を通す(D5)。
- 配置の結果は、プレーンな JSON(`structuredClone` できる)。→ プラグインの `laid` も同じ(D2)。

## スパイク(`spikes/band-plugin/`。`lib/` は触っていない)

約 210 行(`host.ts` 116、`rating-plugin.ts` 45、`run.ts` 51)で、**コアの帯の隣に新しい帯を 1 つ描き、`connect()` を受け、findings を出す**ところまで、ADR の API の形(`definePlugin`・`BandKind`・名前空間つきの型・呼び出しごとの登録)で試した。コアは、すでにある `raw` の帯(外のコードの描画を受ける唯一の帯)に、プラグインの封筒(`{type, data, id}`)を載せて通した。つまり**薄い変換器**で、コアの表には 1 行も足していない。

| ファイル | 内容 |
|---|---|
| `host.ts` | `definePlugin`、`PluginRegistry`(呼び出しごと。未供給は `PluginNotSuppliedError`)、`pluginBand`(検証 → `raw` の帯。`draw` の中で配置と描画)、`withPluginFindings`(配置後に verify を回し、verdict へ併合)、`buildPluginPart`(spec の部品 → 帯) |
| `rating-plugin.ts` | 新しい帯 `rating-demo:stars`(n / max の星)。`lib/` を import しない外部のプラグインの形 |
| `run.ts` | 描画、`connect()`、findings、spec、未供給、星への `connect()` の測定 |
| `typing.check.ts` | 型の全数性の実験(10 個の表に `'plugin'` を足したらどうなるか) |
| `out/` | `ok.svg`、`measurements.txt` |

測ったこと(Node 26。`node spikes/band-plugin/run.ts`、`node_modules/.bin/tsc --noEmit -p spikes/band-plugin/tsconfig.json`)。

| 測ったこと | 結果 |
|---|---|
| コアの帯(`caption`・`box`)の隣に描けるか | 描けた。`verdict.ok = true`。2 回の描画の SVG は**バイト単位で同じ**(2 回で 150〜170 ms) |
| `connect('item:bottom', 'rate:top')` | 通った(プラグインの帯の id で終点に使える)。コネクタ 2 本が描かれた。`Declares<Id>` を帯の型に交ぜるだけで、`diagram().add()` の型検査(存在しない id の拒否)がそのまま効く |
| 星への `connect('a:bottom', 'rate.s2:top')` | **失敗**(`unknown anchor id "rate.s2"`)。`raw` は anchor を登録しないため。**これが「配置の hook が要る」ことの実測**(D2 の `layout` が `anchors` を返し、ホストが `ctx.register` する) |
| findings | プラグインの検査が 2 件出た(`rating-demo/value-over-max` = 問題、`rating-demo/stars-wider-than-band` = 警告)。コアの `verifyDiagram` だけでは `ok = true` のまま。**併合した verdict は `ok = false`**。コアの verify に差し込む口が無いので、変換器は配置後に自分で回した(`verify` の hook が要る。D2) |
| 高さ | `raw` は高さが**構築時に固定**(幅を知らずに決める)。幅が違うと高さが変わる帯は、構築時の高さと配置時の高さがずれる(`height-drift` を警告にした)。**配置の hook(幅を受けて高さを返す)が要る** |
| 文字 | `raw` の `<text>` は測定を通らない。スパイクはサニタイザで `<text>` を拒み、ラベルを描いていない。**文字をコアの測定器に通すには、文字を「データ」で返す口が要る**(D2 の `texts`) |
| 未供給 | `PluginNotSuppliedError`: 「`"rating-demo:stars"` はプラグインの帯だが、プラグイン `"rating-demo"` が渡されていない: `diagram({plugins: [...]})` / `--plugin` で渡す(spec はコードを読み込まない)」 |
| 不正なデータ | `rating-demo:stars: label is the name of what is rated`(プラグインの名前が先頭に付く) |
| **コアの表に要る 1 行の数** | **10 個の型つきの表(上の A)に、各 1 行の汎用の入口が要る。** 型の実験(`typing.check.ts`)で、`Band | PluginBand` / `LaidOutBand | LaidOutPlugin` に広げると、**ちょうど 10 件のエラー**(各表で `Property 'plugin' is missing`)。それ以外のエラーは 0 件(既存のキーは 1 つも壊れない)。(B) のうち 11・13〜17・19 は、型が教えてくれない箇所なので、U1〜U4 で明示的に洗う |
| 型の全数性 | コアの帯は今までどおり**全部のキーが必須**。`'plugin'` が 1 つ増えるだけ(封筒)。プラグインの種類は型の合併型に入れない(D4) |

## 決定

### D1. 形と API のバージョン — `definePlugin`、`id:kind` の名前空間、プラグイン API の semver

**推奨(Q1、Q2、Q3):**

```ts
import {definePlugin, defineBand} from 'svg-diagram/plugin';   // 実行時の値は恒等関数。型のためだけ

export default definePlugin({
  id: 'rating-demo',                       // 小文字・数字・ハイフン。'core' 'svg-diagram' は予約
  apiVersion: '0.1',                       // プラグイン API の版(major.minor)。パッケージの版とは別
  requires: {svgDiagram: '>=0.10 <1'},     // 任意。合わなければ、両方の版を名指ししたエラー
  bands: {
    stars: defineBand({ /* D2 の hook */ }),
  },
  characters: {/* D7 */},                  // 任意
  expressions: [/* D7 */],                 // 任意
});
```

- **帯の型の名前は `プラグインの id:帯の名前`**(例 `rating-demo:stars`、将来の `manga-face:avatar`)。コアの型にはコロンが無いので**衝突しない**。spec の部品も同じ(`{type: 'rating-demo:stars', …}`)。規則の id は `プラグインの id/規則名`(`rating-demo/value-over-max`)で、コアの規則(スラッシュなし)と衝突しない。
- DSL の関数は、`definePlugin` が返すオブジェクトの `band.stars(data, {id})`(`plugin.band.stars(…)`)として公開する。返す型は `PluginBand<'rating-demo:stars'> & Declares<Id>`(D4)。
- **プラグインは svg-diagram の実行時の値を import しない**(`import type` だけ)。`definePlugin` / `defineBand` は恒等関数で、プラグインは**ただのオブジェクトと関数**。ホストが必要な道具(色、文字、id の接頭辞)は hook の引数の `env` で渡す。理由は D8(jsDelivr から 2 つのモジュールを読むとき、svg-diagram のコピーが 2 つになる問題を避ける)。
- **API の版は core のパッケージの版と別の semver。** `PLUGIN_API`(`{major, minor}`)をホストが公開する。プラグインの `apiVersion: '1.2'` は「API 1.2 までの機能を使う」の意味で、ホストの major が同じで minor が 1.2 以上なら受ける。minor は hook の追加(任意)だけ、major は必須の hook の変更・削除。**API は `0.x` の間は破壊的変更を許し、プラグインは厳密に版を固定する。`1.0` は D6 の試験(コアの帯を 1 つ載せる)を通ってから**(Q2)。

| 案 | 採らない理由 |
|---|---|
| (採用)`definePlugin` + `id:kind` + 別の semver | 衝突しない。実行時の依存が無い。版の約束が core のリリースと独立 |
| `id/kind`(スラッシュ) | 規則の id(`id/rule`)と、ファイルのパスに見える |
| `id.kind`(ドット) | id のスコープの区切り(ADR 0012 の `scope.id`)と衝突 |
| 名前空間なし(コアの型と同じ空間) | 衝突する。2 つのプラグインが `stars` を持てない |
| core の semver に API の版を含める(別にしない) | core の軽い更新でプラグインが壊れる(または、API を凍らせて core が動けなくなる) |

### D2. プラグインの帯が持つもの(必須・任意・既定)

今の表への対応。`defineBand({...})` の各 hook は、**純粋な関数**(同じ入力から同じ出力。`Date`・`Math.random`・グローバルの状態・I/O なし)。

| hook | 対応する表 | 必須か | 既定(無いとき) |
|---|---|---|---|
| `build(input) → data` | DSL の関数(`dsl-pure.ts`)、spec の `PARTS[].build / check` | **必須**。唯一の入力検査。投げるときは、フィールド名を言う。ホストがプラグインの名前を前に付ける | — |
| `schema`(JSON Schema の断片)、`description`、`example` | spec(20)、`partCatalog()`、MCP | spec に出すなら**必須**。出さないなら `spec: false`(`comic` が `IN_NO_SPEC_YET` にいるのと同じ) | `spec: false` なら、catalog にも出ない。`example` は適合テスト(U6)で「問題なく描ける」ことを見る |
| `ids(data) → string[]` | `bareNodeIds`(13)。reveal と anchor のスコープが**配置前**に使う | anchor を持つ帯は**必須** | `[]`。配置が返した anchor がこれに無いとき `plugin-anchor-undeclared`(エラー)。型は `Declares<Id \| 'band.item'>` でも運べる |
| `measure(data, m)` | `MEASURE_HANDLERS`(2) | 任意 | 文字なし。**文字は `m.atoms(text, size, weight, font)` だけ**(コアの測定器) |
| `layout(data, env) → {h, anchors, texts, laid}` | `LAYOUT_HANDLERS`(1)、`placedBand`、`ctx.register`、スコープ(13) | **必須**。`env` = `{x, y, w, widthOf, roles, theme, tones, wrap}`。`anchors`(`{id, x, y, w, h}`。裸の id)はホストが `scope.id` にして登録 | — |
| `emit(laid, env) → svg` | `EMIT_HANDLERS`(6) | **必須**。図形だけ。ホストが `sanitizeBody` を通し、id に接頭辞を付け、`<g data-plugin>` で包む。色は `env.color(key)`(トークン)。ダークモードはホストが `appearance` で解決 | — |
| `laid.texts` / `texts` の返し | `FIT_HANDLERS`(8)、`INVENTORY_HANDLERS`(9) | 文字があれば | `[]`。**文字は SVG の `<text>` で出さず、データ(`{x, y, size, weight, text, anchor, tone}`)で返し、ホストがコアの描画で描く**。すると、測定・フォント・ダークモード・小さい文字の検査・ADR 0078 の目録の `text` が**自動で正しくなる** |
| `verify.rects(laid)`、`verify.check(laid, ctx) → findings`、`verify.contrast` | `VERIFY_HANDLERS`(7)、`CHECK_PHASES`(19) | 任意 | `rects` は帯全体 1 つ(`ownRect` 相当)。`check` なし。findings は `{rule, severity: 'problem'\|'warn'\|'info', message, where?}`。`rule` はホストが `id/規則名` にする |
| `rules`(`{規則名: {doc, scope: 'band'\|'band-grouped'\|'diagram'}}`) | `RULE_DOCS` / `RULE_LOCATION`(18) | **出す規則は全部必須**。無い規則を出すと `plugin-rule-undocumented` | — |
| `inventory(laid) → items` | `INVENTORY_HANDLERS`(9) | 任意 | `texts` から `text` の項目、図形の全体を `whole` 1 つ(重ねの吹き出しが覆ってはいけない内容として、保守側) |
| `reveal` | `REVEAL_HANDLERS`(3) | 任意 | `{stage: true}`(帯の `reveal` / `until`。anchor もその段) |
| `children` | `CHILD_BANDS`(4)、`STACK_WIDTH`(5) | **v1 では不可**(Q5)。API の minor で足せるよう、名前だけ予約 | 子なし。`STACK_WIDTH` は `null` |
| `pptx` | `BAND_HANDLERS`(10) | 任意 | `'image'`(SVG を絵として貼る。コアの `image` の帯と同じ経路)。ネイティブは minor で |
| `docs`(`summary`、`usage`、`example`) | README、skills、`list_diagram_parts`(24) | 任意 | `description` と `example` から catalog の行を作る。**プラグイン自身が自分の README / skill を持つ**(core の docs に混ぜない) |

**プラグインの帯がコアと同じに守ること(ホストが強制する保証)**:

1. **決定性**: 同じ入力は同じバイト列。ホストの適合テスト(U6)が、2 回の実行、入力の深いコピー、`structuredClone` した `laid` で確かめる。
2. **純粋**: `node:*`・`fetch`・グローバルの状態を使わない。プラグインのコードはブラウザの入口にそのまま載る(`test/web-entry.test.ts` と同じ検査をプラグインの fixture にかける)。
3. **文字はコアの測定器**: 文字は `measure` の `m.atoms` と `texts` だけ。`emit` の SVG に `<text>` があれば、サニタイザが拒む(D5)。
4. **紙とダークモード**: 色はトークン(`env.color`)。生の `#rrggbb` は許すが、ホストが `rgb()` に直し(`loadCharacter` と同じ)、ダークモードで反転しない固定色は `plugin-fixed-color`(助言)。
5. **id は衝突しない**: anchor の id は帯のスコープで修飾。SVG の `id` は帯ごとの接頭辞(`prefixIds`、`characterSvg` と同じ)。
6. **大きさの上限**: 1 つの帯の SVG は 256 KB まで、anchor は 500 まで(超えたら `plugin-too-large`、エラー)。
7. **他の帯に触れない**: hook は帯の `data` と `env` だけを受け取り、他の帯・図の状態は渡さない。

### D3. 登録と範囲 — 呼び出しごと(グローバルにしない)

**推奨(Q4): 呼び出しごと。グローバルの登録簿は作らない**(ADR 0074 D3 と同じ理由。2 つの図が同じ id の別の版のプラグインを使える。テストが他のテストに漏れない。Artifact / MCP / CLI がそれぞれ許す物を決められる)。

| 入口 | 渡し方 |
|---|---|
| DSL(`.ts`) | `diagram({plugins: [ratingDemo]})`。帯は `ratingDemo.band.stars(…)`(プラグインの関数)で作るので、`plugins` に渡し忘れると**構築の時点で**(`add()` の検査で)エラー |
| JSON の spec(LLM が書く) | `{type: 'rating-demo:stars', …}`。`specToDiagram(spec, {plugins})` / `renderSpec(spec, {plugins})` / `validateSpec(spec, {plugins})`。**spec はプラグインの id を名指しするだけで、コードを読み込まない**(D5) |
| ブラウザ | `renderInBrowser(diagram({plugins}), {measure})`(図がプラグインを持つ)。DiagramData から直接描く場合は `renderInBrowser(data, {measure, plugins})` |
| `renderComic` | `renderComic(sheet, {measure, characters, plugins})`(D7) |
| CLI | `svg-diagram build spec.json --plugin ./manga-face.ts`(繰り返し可)。`.ts` の図の入口は、自分で `import` して `diagram({plugins})` に渡すので、フラグは spec 用 |
| MCP | サーバー側の**許可リスト**(D5、D8)。呼び出しの側からは渡せない |

**プラグインが渡されていないとき**: 黙って捨てない。黙って箱にもしない(`layoutHandlerFor` の既定を通さない)。次の形の**明確なエラー**。

```
the band type "rating-demo:stars" is a plugin band, but plugin "rating-demo" was not supplied:
pass it as diagram({plugins: [...]}) / --plugin (a spec never loads code)
```

(日本語の版も出す。「何が悪いか」と「どう直すか」を 1 行で。)`validateSpec` では `SpecIssue`(`path: parts[2].type`)として返り、LLM が直せる。許可リストに無いプラグインを spec が名指ししたとき(MCP)は、「このサーバーが使えるプラグインは: …」と**使えるものの一覧**を返す。

### D4. 型 — 封筒の 1 つの帯の種類で、コアの全数性を残す

**推奨(Q1): コアに帯の種類 `plugin` を **1 つだけ**足す(封筒)。** `Band` に `PluginBand`(`{type: 'plugin', plugin, kind, data, id?, scope?, reveal?, until?}`)、`LaidOutBand` に `LaidOutPlugin`(`{type: 'plugin', plugin, kind, x, y, w, h, anchors, texts, laid, findings}`)を足す。10 個の表(A)には、それぞれ**プラグインへ回す 1 行**(`plugin: (band, …) => host.kindOf(band).…(…)`)を足す。コアの帯のキーは全部必須のままなので、**コアの帯の抜けは今までどおりコンパイルで落ちる**。プラグインの帯の種類は型の合併型に入らない(コンパイル時に知らない)。

- **`connect()` の id の型**: プラグインの DSL の関数が `PluginBand<K> & Declares<Id | 'item…'>` を返す。`Declares` は幽霊の運び屋で、`diagram().add()` の既存の検査にそのまま乗る(スパイクで確認)。`ids` が静的に分かる帯は、型の id も与えられる。計算で決まる id は `string` にして、実行時のエラーで守る(`strict.ts` の「`string` は証明できないので通す」の約束と同じ)。
- `Diagram<Ids>` と `FlowBand`(ADR 0077 / 0078 の流れの帯)は、`PluginBand` を**流れの帯としては受けない**(v1)。重ねの帯(`overlay`)のプラグインは別の拡張(Q5)。

| 案 | 採らない理由 |
|---|---|
| (採用)封筒 `plugin` を 1 種類 | コアの全数性が残る。10 個の表に各 1 行。プラグインの追加で core の型が変わらない |
| モジュールの拡張(`declare module 'svg-diagram' { interface BandRegistry {…} }`) | 型が**グローバル**になる(2 つの版のプラグインが共存できない。ADR 0074 の「グローバルにしない」に反する)。コアの型がインストールされた物に依存する |
| `Band` を開いた型(`${string}:${string}` のテンプレート型)にする | 表が `Band['type']` をキーにするため、テンプレート型のキーを持てず、全数性が崩れる |
| プラグインごとに型の合併型へ足す(コードを生成してコアに入れる) | 別リポジトリに置く目的に反する。core のビルドがプラグインに依存する |
| 帯の種類ごとに core の表へ動的に登録(登録簿) | 全数性が実行時の検査だけになり、グローバルの状態も要る(D3) |

### D5. 安全 — プラグインはコード。JSON はコードを読み込まない

1. **spec(JSON)は、コードを読み込まない。** 呼び出す側(DSL を書く人、CLI の `--plugin`、サーバーの設定)だけが、プラグインを渡す。spec にできるのは、渡されたプラグインの id を名指しすること(D3)。`import()` の URL も、パスも、spec には書けない。
2. **MCP は、サーバー側の許可リスト**。サーバーは、ビルド時に**静的に** `import` したプラグインのうち、設定(`PLUGINS` の変数など)で有効にした物だけを使う。`specSchema` と `list_diagram_parts` は**許可した物から**作る(許可していないプラグインの部品は、LLM に見えない)。既定は**プラグインなし**。有効にするのは、権利と品質の確認のあと(Q10)。
3. **プラグインの SVG は、外部の SVG と同じ門を通る。** `emit` の出力を `sanitizeBody`(`loadCharacter` と同じ)に通す。図形・グループ・グラデーション・クリップパスだけ。`text`・`style`・`script`・`use`・`image`・`foreignObject`・外への参照・名前つきの色・`currentColor` の固定は拒む。**文字は `texts` の経路(D2)でコアが描く**。通らない出力は、`plugin-svg-rejected`(エラー)で、帯の場所にプレースホルダー(破線の長方形)を描く。
4. **id は衝突しない**(D2 の 5)。プラグインの anchor は `scope` を持てる(ADR 0012)。同じプラグインの帯が複数あっても、SVG の `id` は帯ごとの接頭辞で分かれる。
5. **プラグインの中の失敗は、壊れた出力にしない。** hook が投げたら、ホストが**プラグインの名前・帯の種類・段階(build / measure / layout / emit / verify)を付けて**包む(`PluginError`)。`check` / `renderDiagram` の経路では、投げずに `plugin-failed`(問題)として verdict に入れ、その帯はプレースホルダーで描く(他の帯の診断が続けられる)。DSL の構築の段階(`build`)は、今までの DSL と同じく投げる。
6. **資源**: 1 つの帯の SVG と anchor の上限(D2 の 6)、プラグインの hook の呼び出しは 1 つの帯につき各 1 回(ホストが回数を数え、無限ループは止められないが、上限を超える出力は拒む)。同期の関数だけ(`async` の hook は不可。ブラウザの描画の順序を崩さない)。
7. **プラグインの規則と `--strict`**: プラグインは、自分の `rules` に宣言した規則だけを出せる。重大度は宣言の範囲(`problem` を出せるのは、宣言で `problem` を許した規則だけ)。`diagram({accept: {'rating-demo/value-over-max': '理由'}})` で、コアの規則と同じく受け入れを書ける(`accept` の型は `RuleId \| `${string}/${string}``)。

### D6. 版と互換、コアの帯をプラグインに移すか

- **配置の結果(`laid`)はプラグインのもの**。ホストは中身を読まず、`structuredClone` で運ぶ。**コアの golden(`examples/out/`)は、プラグインがあっても動かない**(プラグインを使わない図は、今まで通り)。プラグインの出力の golden は、プラグインの側のリポジトリが持つ(適合テスト U6 が、プラグインの `example` を描いて固定する道具を出す)。
- プラグインの版は、(a)`apiVersion`(ホストとの契約)、(b)`requires.svgDiagram`(core の版の範囲。合わなければエラー)、(c)プラグイン自身の版(出力が変わるときの major)。ホストは、図の中にプラグインの id と版を**記録**する(SVG の `<metadata>` ではなく、`laidOut` と `verdict` の側。`data-plugin` に id だけ)。
- **コアの帯(例: `comic`)を、内側のプラグインとして移す案(自分で食べる)について。** 長所は、API が実物で鍛えられ、将来 10 個の表の行が減ること。短所は、(1)コアの帯が**コンパイル時の全数性を失う**(封筒の中は実行時の検査だけになる)、(2)`comic` は anchor の種類(コマ・ふきだし・穴)、幾何の地図、`renderComic` の断片の差し替え、`nodeIds`、規則の `where`、ADR 0077 / 0078 の重ねとの結びつきが深く、移すと同時に変える面が広すぎる、(3)golden のバイト一致を守りながらの大きな移行になる。
  - **推奨(Q7): 今は移さない。** コアの帯は型つきの表のまま。代わりに、(a)参照プラグインの fixture(U6)が実物の試験になり、(b)**API が 0.x の間に、小さくて単純なコアの帯を 1 つだけ(例: `people` か `dots` の葉の帯)プラグインとして書き直し、golden がバイト一致することを確かめる**(U9、任意)。それが通れば `1.0` にする。`comic` の移行は、ADR 0078 の重ねが安定したあとに、別の ADR で判断する。

### D7. 狭い拡張点 — 人物の提供元と、追加の表情(同じプラグインのオブジェクトの中)

**人物の提供元(`characters`)**。`characters: {face: {schema, make(params) → CharacterManifest}}`。`make` の結果は、**必ず `loadCharacter` を通る**(権利の必須、断片の掃除、箱とアンカーの検査。手で書いたマニフェストと同じ門)。使い方は 2 通り。

1. **関数として呼ぶ**(コアの変更なし。今でも使える): `comic(sheet, {characters: {peep: mf.characters.face.make({…})}})`。ADR 0079 の「別パッケージ + `CharacterManifest`」の形そのもの。プラグインの仕組みは要らない。
2. **spec に書く**(JSON、LLM 向け。U7): ワークシートの `cast.me.character = {provider: 'manga-face:face', params: {…}}`。`comic(sheet, {plugins})` / `renderComic(…, {plugins})` が、渡されたプラグインから解決し、`loadCharacter` に通す。**結果の人物は図ごと**(ADR 0074 D3 のまま。グローバルに持たない)。未供給なら D3 のエラー。

**追加の表情(`expressions`、任意、U8)**。`ComicExpression` は今 8 種の閉じた合併型(`EXPRESSIONS`)。プラグインは `expressions: ['manga-face:shy', …]` のように**名前空間つき**で足せる。ワークシートの舞台は `expression: 'manga-face:shy'` と書き、その表情の断片を持たない人物では `neutral` に落として `comic-expression-fallback`(助言)を出す。ADR 0079 の Q8(「追加の表情は後で」)と同じ時期に決める。コアの 8 種は変えない。

**ADR 0079 の manga-face がこれをどう使うか**: 別のリポジトリ `manga-face`(npm)が `definePlugin({id: 'manga-face', …})` を出す。

- 帯 `manga-face:avatar`: 顔 1 つ(パラメータ、表情、大きさ)。顔の生成(ADR 0079 の `face.ts`)をそのまま `layout`(大きさと anchor `head`)と `emit`(図形)に使う。
- 帯 `manga-face:faces`: 顔の一覧(見本帳、名前つき。名前は `texts`)。
- 人物の提供元 `face`: パラメータ → `CharacterManifest`(ADR 0079 の `faceManifest`)。`comic()` に渡す。
- 追加の表情(任意、U8)。

ADR 0079 は**中身の設計としてそのまま有効**(D2〜D7)。変わるのは D1 の「svg-diagram 側の変更はない」で、**svg-diagram 側に `svg-diagram/plugin` が入り、`manga-face` はそれを使う**。API が入る前でも、1. の関数呼びで `comic()` につながる(つまり ADR 0079 は、この ADR を待たずに進められる)。

### D8. 配布 — npm、jsDelivr の Artifact、MCP

- **npm**: プラグインは普通のパッケージ(`manga-face`)。`peerDependencies: {"svg-diagram": ">=… <1"}`。**実行時に svg-diagram を import しない**(型だけ。D1)ので、peer の版の食い違いで 2 つのコピーが動く問題が起きない。型は `svg-diagram/plugin`(新しい入口。純粋で、`svg-diagram/browser` からも再エクスポートする。`test/web-entry.test.ts` の対象)から `import type` で取る。
- **Artifact(jsDelivr)**: 
  ```js
  const [{diagram, renderInBrowser, svgMeasurer}, {default: mangaFace}] = await Promise.all([
    import('https://cdn.jsdelivr.net/npm/svg-diagram@X.Y.Z/dist/lib/web.js'),
    import('https://cdn.jsdelivr.net/npm/manga-face@A.B.C/dist/plugin.js'),
  ]);
  const out = await renderInBrowser(diagram({theme: 'blue', plugins: [mangaFace]}).add(mangaFace.band.avatar({…})), {measure: svgMeasurer()});
  ```
  プラグインは svg-diagram の値を import しないので、**2 つのモジュールは独立**で、渡し合うのはオブジェクトだけ。**注意: core の jsDelivr の動作確認(CDN のプローブ)は、まだ終わっていない。** Artifact での通し確認(U10)は、そのプローブが済んでから行う。生成済みの JSON(1 人分 48.7 KB、gzip 3.5 KB。ADR 0079)を貼る方法も、プラグインなしで引き続き使える。
- **MCP**: MCP のサーバー(別のリポジトリ `svg-diagram-mcp-plugin`)が、有効にするプラグインを**ビルド時に静的に import** して許可リストに入れる。設定で、バンドル済みのうち有効にする id を選ぶ。Workers は実行時に任意のコードを読み込めない(URL から `import` しない)ので、許可リストの方式は自然。`list_diagram_parts` は、許可したプラグインの部品を `plugin: 'manga-face'` つきで返す。`check_diagram` / `render_diagram` の spec の検査は、許可したプラグインのスキーマで行う。

## 代替案(全体)

| 案 | 採らない理由 |
|---|---|
| ADR 0079 のまま(別リポジトリ + `CharacterManifest` だけ) | 顔の**帯**(avatar、見本帳)が作れない。決める人の「汎用の新しい帯」の要求に足りない。ただし、人物の提供元としては残す(D7 の 1.) |
| core に `lib/manga-face/` として入れる | 出す周期と golden が core に結びつく(ADR 0079 D1)。他のパッケージ(別の帯)にも使えない |
| `raw()` の帯の拡張(今あるもの)で足す | 試した(スパイク)。anchor が登録されない、高さが構築時に固定、文字が測定を通らない、verify の口が無い。**足りない所が、この ADR の hook** |
| プラグインが core の表に自分で登録する(`registerBand(type, handlers)`、グローバル) | グローバル(ADR 0074 の約束に反する)。全数性が実行時だけ。テストが漏れる |
| 動的 `import(url)` を spec に書かせる | **安全でない**(D5 の 1)。MCP で任意のコードが走る |
| 全部のコアの帯を最初からプラグインにする | コンパイル時の全数性を失う。移行の面が広い(D6) |

## 影響

- `lib/` の変更は、U1 以降の別の PR。この PR(U0)は ADR とスパイクだけで、`lib/` と golden は変えない。`pnpm typecheck` は通る(スパイクは `tsc -p .` の対象外。スパイク用の `tsconfig` で別に確かめる)。
- コアに足すもの: `lib/plugin/`(型、`definePlugin`、登録簿、版の検査、`PluginError`)、帯の種類 `plugin`、10 個の表への各 1 行、(B) の十数か所の洗い出し、`svg-diagram/plugin` の入口(`package.json` の `exports`)。
- 変わらないもの: コアの帯の API、golden、`schema/*.schema.json`(プラグインを渡さない既存の経路。`specSchema()` はプラグインなしで今と同じ)。
- 公開の約束が増える: プラグイン API の semver(D1)。`0.x` の間は破壊的変更あり。

## 実装計画

U0 は、この PR。U1 以降は、どの単位も Opus のレビューで Blocker と Major がなくなってからマージする。U1 は、ADR 0078 U0b(同じ表を変える)のマージの後に着手する(Q13)。

| 単位 | 内容 | 完了の基準 | テスト |
|---|---|---|---|
| U0 | ADR とスパイク(この PR。`spikes/band-plugin/`) | スパイクの測定(上の表)。表の一覧。`typecheck` が通り、golden が不変 | `run.ts` の測定、`typing.check.ts` の 10 件 |
| U1 | 型と骨組み: `lib/plugin/`(`definePlugin` / `defineBand`、登録簿、`apiVersion` と `requires` の検査、`PluginError`、未供給のエラー)、`Band` / `LaidOutBand` に `plugin` の封筒、10 個の表に**未実装(明確なエラー)の入口**、`diagram({plugins})`、`svg-diagram/plugin` の入口 | `typecheck` が通る。プラグインを使わない図の出力が**バイト単位で不変**(golden)。`plugin` の帯を、プラグインなしで描くと D3 のエラー。`layoutHandlerFor` の既定(箱)を通らない | 未供給 / 未知の kind / id の重複 / `apiVersion` の食い違い / `requires` の不一致のエラー、`test/core-purity.test.ts` と `test/web-entry.test.ts` に `lib/plugin/` を足す、`@ts-expect-error` の型テスト(コアの帯の抜けは今までどおり落ちる) |
| U2 | 配置と anchor と測定: `measure`、`layout`(`ctx.register`、スコープ、`ids`)、`texts`、`connect()`、`fit`、`inventory`(既定)、`reveal`(既定) | 参照プラグイン(U6 の骨組み)の帯が、コアの帯の隣に描け、`connect()` の終点になり、星 1 つへの `connect('a:bottom', 'rate.s2:top')` が通る。文字がコアの測定器を通る | 参照プラグインの配置、anchor の重複(`claimed`)、`ids` にない anchor は `plugin-anchor-undeclared`、スコープつきの `connect()`、`inventory` の既定(`text` と `whole`) |
| U3 | 描画と掃除: `emit`、`sanitizeBody`、id の接頭辞、`data-anchor` → `data-node`、`selfDimming` と `dim`、ダークモード、PPTX の `'image'` | 描画が決定的(2 回、深いコピー)。禁止の要素を出すと `plugin-svg-rejected` と破線のプレースホルダー。PPTX が絵として出る | 掃除の拒否(`text` / `style` / `use` / `image` / `foreignObject` / 外への参照)、同じ帯が 2 回出ても `id` が衝突しない、ダークモード、PPTX の検証(`pnpm validate:pptx` に fixture) |
| U4 | verify と規則: `verify.rects` / `check`(`CHECK_PHASES` に `'plugin'`)、`rules`(`RULE_DOCS` 相当の登録簿)、`accept` の型の拡張、エラーの境界(`plugin-failed`)、`--strict` との関係 | プラグインの問題が verdict に入る。規則に説明が無いと `plugin-rule-undocumented`。hook が投げても他の帯の診断が続く(プレースホルダー)。`check --explain rating-demo/value-over-max` が説明を出す | 問題 / 警告 / 助言、`accept`、投げる hook、`rects` の衝突の検査、**変異**(`verify` を空にするとテストが落ちる) |
| U5 | spec と CLI: `specToDiagram` / `validateSpec` / `renderSpec` の `plugins`、`specSchema({plugins})`、`partCatalog({plugins})`、`--plugin`、`renderInBrowser` の `plugins` | spec の部品 `{type: 'rating-demo:stars'}` が描ける。未供給は `SpecIssue`。供給しない既存の `specSchema()` は**今と同じ**(`schema/*.schema.json` が不変) | spec の往復、未供給のエラー(「使えるプラグインは…」)、`schema-files` の不変、`--plugin` のテスト、`IN_NO_SPEC_YET` 相当の `spec: false` |
| U6 | **参照プラグインの fixture と適合テスト**: `test/fixtures/plugins/rating/`(`lib/` の**外**。`import type` だけ)に、小さい新しい帯を 1 つ、端から端まで(DSL、spec、配置、描画、verify、目録、reveal、PPTX の `'image'`)。適合テストの道具 `svg-diagram/plugin-testing`(`conformance(plugin)`: 決定性、純粋、掃除、規則の説明、anchor の一意、`example` が問題なく描ける、`structuredClone`) | 参照プラグインが適合テストを通る。**プラグインなしで `rating-demo:stars` を描くと、明確なエラー**。プラグインの作者が自分のリポジトリで `conformance(plugin)` を呼べる | 端から端のテスト、未供給のエラーの文言、**変異**(`emit` を非決定にする、`rules` の説明を消す、掃除を外す。それぞれ落ちる) |
| U7 | 人物の提供元: `characters` の hook、`comic(sheet, {plugins})` と `renderComic({plugins})`、spec の `cast.x.character = {provider, params}`、`loadCharacter` を必ず通す | 参照の人物の提供元の出力が `comic()` で描ける。権利の無い人物は `comic-license-missing`。**人物は図ごと**(別の図に漏れない) | 提供元 → `loadCharacter` の往復、未供給、権利なし、図をまたいだ漏れなし |
| U8(任意) | 追加の表情: `expressions`、`ComicExpression` の拡張、`comic-expression-fallback` | 名前空間つきの表情が描け、持たない人物は `neutral` に落ちて助言が出る。コアの 8 種の出力は不変 | 落ちる経路、コアの golden の不変 |
| U9(任意) | **試験**: 小さいコアの帯 1 つ(`people` か `dots`)をプラグインとして書き直す(D6) | golden が**バイト一致**。コードの行数が減る/同等。API を `1.0` にしてよいかの判断材料 | 同じ入力の出力の差分ゼロ |
| U10 | 配布: 参照プラグインか `manga-face` を jsDelivr から読む Artifact の通し確認(**core の CDN のプローブが済んでから**)、MCP の許可リスト(MCP のリポジトリ側の PR)、ドキュメント(README、skill) | Artifact が 2 つのモジュールを読み、プラグインの帯を描く。MCP が許可リストのプラグインの部品を `list_diagram_parts` に出し、許可外の名指しを拒む | Artifact の実機の確認(決める人)、MCP のテスト(別のリポジトリ) |

## テスト方針

- **コアの網羅**: 既存の `satisfies` と `ALL_BANDS_*` はそのまま。`plugin` が増えるので、10 個の表への入口は型で強制される(U0 の実験が、その 10 件を実証)。(B) の型で守られない箇所は、`test/band-registries.test.ts` に `plugin` の行を足し、参照プラグインが全部の経路(spotlight、reveal、`data-node`、位置の地図)を通ることで確かめる。
- **適合テスト**(U6)は、プラグインの作者が自分のリポジトリで走らせる。core の CI は参照プラグインだけを走らせる。
- **golden**: コアの golden は、プラグインを使わない限り**不変**(各単位の完了の基準)。プラグインの出力の golden は、プラグインの側。
- **変異**: 各単位で、新しいコードを壊す変異を 1 つ以上当て、落ちることを PR に書く(`AGENTS.md`)。

## 決める人への質問

| # | 質問 | 推奨 | 理由 |
|---|---|---|---|
| Q1 | 型の入れ方: コアに `plugin` の封筒を 1 種類足す方式で進めてよいか | **封筒を 1 種類**。表 10 個に各 1 行 | コアの帯の全数性が残る。モジュールの拡張はグローバルになる。スパイクで 10 件のエラーだけと実証 |
| Q2 | プラグイン API の版の方針 | **core の版とは別の semver。`0.x` の間は破壊的変更あり、`1.0` は U9 の試験の後** | 実際に 2 種類(外部の fixture と、コアの帯の書き直し)で試す前に約束しない |
| Q3 | 帯の名前空間の書き方 | **`プラグイン id:帯の名前`**(`manga-face:avatar`)。規則は `id/規則名` | コアの名前と衝突しない。`/` は規則、`.` はスコープと使い分ける |
| Q4 | 登録は呼び出しごとか、グローバルか | **呼び出しごと**(`diagram({plugins})` / `--plugin` / MCP の許可リスト) | ADR 0074 の約束。漏れない。サーバーが許す物を決められる |
| Q5 | v1 で、入れ子の帯を持つ帯(コンテナ)と、重ねの帯(ADR 0078 の `overlay`)をプラグインに許すか | **許さない**(葉の帯だけ。`children` の名前だけ予約) | 子の測定と積みは、ホストの再帰に深く結びつく。0078 が固まっていない。minor で足せる |
| Q6 | プラグインに `<text>` を出させるか | **出させない。文字は `texts` のデータで返し、コアが描く** | 測定、フォント、ダークモード、小さい文字の検査、0078 の目録が自動で正しくなる。掃除の規則(`text` なし)とも合う |
| Q7 | コアの帯(`comic`)を内側のプラグインに移すか | **移さない**。U9 で小さい葉の帯 1 つだけ試験し、`comic` は 0078 が安定した後に別の ADR | コンパイル時の全数性を失う。`comic` の結びつきが深い。golden のバイト一致を守る移行が大きい |
| Q8 | 人物の提供元は、関数として呼ぶ形(今でも可)と、spec に書く形(U7)の両方か | **両方**(関数は仕組みなしで ADR 0079 を進められる。spec は U7) | 0079 を待たせない。LLM / JSON の経路が要るときに仕組みが効く |
| Q9 | 追加の表情をプラグインで足せるようにするか | **後で(U8)。名前空間つき**、持たない人物は `neutral` に落として助言 | ADR 0079 の Q8 と同じ時期。コアの 8 種は動かさない |
| Q10 | 公開の MCP サーバーで、どのプラグインを有効にするか | **既定は 0 個。有効にするのは、権利と品質の確認の後(`manga-face` が最初の候補)** | 許可リストの方式は安全だが、見た目と権利は別の確認 |
| Q11 | `requires.svgDiagram` の不一致は、エラーか警告か | **エラー**(両方の版を名指し) | 黙って動いて壊れるより、早く止まる。`apiVersion` の食い違いと同じ扱い |
| Q12 | プラグインの規則は `--strict` と `accept` にコアの規則と同じように乗せるか | **乗せる**。重大度は宣言の範囲内、規則の説明は必須 | 利用者から見て、規則の扱いが 1 つ |
| Q13 | U1 に着手する順序: 今か、ADR 0078 U0b / ADR 0079 の判断の後か | **ADR 0078 U0b のマージの後**(同じ 10 個の表を変えるので、衝突を避ける)。ADR 0079 の U1 以降は、この ADR を待たず、関数呼びの形(D7 の 1.)で進める | 同じファイルを触る 2 本の PR の衝突を避ける |
| Q14 | 参照プラグインの置き場と、適合テストの道具の公開 | **`test/fixtures/plugins/rating/` に置き、`svg-diagram/plugin-testing` を公開**(U6) | プラグインの作者が同じ検査を自分のリポジトリで走らせられる。参照が core の CI に入り、API の変更で壊れたらすぐ分かる |

## スパイクの再現

```
node spikes/band-plugin/run.ts                                            # out/ok.svg, out/measurements.txt
node_modules/.bin/tsc --noEmit -p spikes/band-plugin/tsconfig.json        # typing.check.ts: ちょうど 10 件(各表で Property 'plugin' is missing)
```

`out/` は、U1 以降の PR で参照プラグインに置き換えて消す(ADR 0074 と同じ使い捨て)。スパイクの `host.ts` の変換器(`raw` に載せる)は**本実装ではない**。本実装は、10 個の表に直接入口を持つ(D4)。

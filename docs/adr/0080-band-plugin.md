# ADR 0080: 帯の定義(`BandDef`)とプラグイン — 1 つの定義の形で、コアの帯も外部の帯も作り、使う帯・出力形式・重い依存だけを束ねる(tree shaking)

- 状態: **一部実装済み**（U1a-1・U1a-2。帯の定義と構築、外部定義の凍結と構築結果の検査、composer の移動、境界・配布モジュールの副作用・バンドルサイズの検査。選択描画の文書幅と折り返しの検査を個別入口に分離し、選択 spec の所見に部品の位置を保持。TOC の凡例の所見を因果図の定義に接続し、表の警告の許容設定を帯のルール定義に接続。文書の検査に本文幅の許容案内、用語集、絵記号・縦長・文字量の所見を追加し、接続線の交差・ラベル不足・分断の検査と、文字のコントラスト検査、表の合計・構成比検査、自動配置の変更、ワイヤーフレームの注釈の所見、SVG の題名候補を帯の定義へ移行。HTML の箱系・表・SVG の変換と、PPTX の SVG → 編集可能な図形の変換を別入口に分離し、Edge の PPTX 出力で単独スライドとデッキの spec 部品・帯アダプターを選択可能にした）。2026-11-23 に承認され、Opus のレビュー 6 回を経て Q1〜Q18 はすべて推奨どおりに決定。帯に加え、PPTX・Excel などの出力形式と重いバックエンドも tree shaking の対象に含む。
- 日付: 2026-11-23
- 基点: `main`(74816524。ADR 0078 U0a まで)
- 関連: ADR 0079(マンガ風の顔のライブラリ。PR #454)、ADR 0074(`comic()`、`CharacterManifest`、`loadCharacter`。**人物は図ごとに渡し、グローバルに持たない**)、ADR 0031(FCIS、`lib/` は純粋な core)、ADR 0007(Ports)、ADR 0045(`svg-diagram/browser`、`renderInBrowser`)、ADR 0077 / 0078(`balloon`、重ねの帯、`FlowBand`、内容の目録)、ADR 0068(Excel への書き出し。PR #373、Draft)、ADR 0012(id のスコープ)、ADR 0034(`data-node`)、ADR 0069(`partCatalog`)、ADR 0071(JSON Schema)、ADR 0027 / 0054(PPTX)
- 範囲外: 外部パッケージが**既存の**帯の描き方を差し替えること(上書き)。プラグインの配布の場(レジストリ、検索)。他の帯を**持つ**帯(コンテナ)の**プラグイン**と、重ねの帯のプラグインは v1 では対象外(プラグインの帯が行・グループなどの**子になる**ことは許す。D5、Q9)。フォントのファイルを JS に埋め込むこと(今も埋め込んでいない。D7)
- 例のデータはすべてこの ADR のための作り話(星の評価の帯 `rating-demo:stars`、「使いやすさ」「新しい画面」、マンガは「ここが変更点です。」「要確認ですね。」など)

## 背景

決める人の言葉が 3 つある。

1. 「汎用の新しい band を足すことができる plugin として考えたい」(外部パッケージが `comic` のような帯を足せる)。
2. 「ユースケースに合わせてミニマムな band だけを bundle できる仕組み」。マンガのワークシートの Artifact は `renderComic` と `svgMeasurer` だけを束ねたのに、**約 1 MB** になった。
3. 「band だけでなくて、pptx とか excel 出力とかも含めて tree shaking できるようにしたい」。

3 つは同じ構造の問題で、**帯の種類をキーにする中央の表が、全部の帯(と、出力形式ごとの処理)を import している**ことが原因である(次の「測ったこと」)。表を、**帯自身が持つ定義(`BandDef`)に移し、呼び出しは帯の値から**行えば、import していない帯のコードは束ねられない。外部の帯(プラグイン)は、この `BandDef` に名前空間をつけただけのものにできる。

### 測ったこと — 今のバンドルの中身(esbuild の metafile。`spikes/band-plugin/bundle/`)

ブラウザ向け(minify、ESM、依存は束ねる)。

| 入口 | 大きさ | gzip | モジュール数 |
|---|---|---|---|
| 全部入り(`lib/web.ts`。`svg-diagram/browser`) | **1042.0 KB** | 368.8 KB | 186 |
| `renderComic` + `svgMeasurer` だけ | **1036.2 KB** | 368.0 KB | 185 |
| `box` + `row` + `diagram` + `renderInBrowser` + `svgMeasurer` | **1031.5 KB** | 365.0 KB | 183 |
| `svgMeasurer` だけ | 2.5 KB | 1.3 KB | 2 |

**どの入口も、ほぼ同じ大きさ(全部入りの 99%)で、tree shaking はほとんど効いていない。** マンガだけを使っても、`bowtie`・`fta`・`gantt`・`bpmn`・`charts`・`quadrant` などが全部入る(帯のモジュール 21 種が全部ある)。理由は、次の import の連鎖である(`comic-only` のバンドルの metafile から)。

| 引き込まれる物 | 連鎖 |
|---|---|
| 全部の帯の配置(`layout-handlers.ts` 23 KB と、各帯の `layout*.ts`) | `comic/render.ts → web.ts → layout.ts → layout-handlers.ts` |
| 全部の帯の測定(`bowtie`・`gantt`・`charts` ほか) | `comic/render.ts → web.ts → layout-measure.ts → bowtie.ts / gantt.ts / charts.ts …`(`MEASURE_HANDLERS`) |
| 全部の帯の描画(`emit-handlers.ts`、`emit-figures.ts` 29 KB ほか) | `comic/render.ts → dsl/diagram.ts → rules.ts → emit.ts → emit-handlers.ts` |
| 全部の帯の規則と検査(`rules.ts` **93 KB**、`verify-handlers.ts` 16 KB、`fta.ts`) | `dsl/diagram.ts → rules.ts → fta.ts …` |
| `box()` の DSL そのもの | `dsl/text-bands.ts` が `walkBands`(`rules.ts` の 93 KB)と `toc.ts` を import する。**帯を 1 つ使うだけで、規則の本体が付いてくる** |
| 小さな帯の道具が、別の帯を引く | `emit-boxes.ts → reveal.ts → band-ids.ts → quadrant.ts`(`visibleAt` を使うだけで `quadrant` と `reveal-handlers` が入る) |

ライブラリの外の依存(HarfBuzz、resvg、MathJax、Playwright)は、ブラウザ向けのバンドルには**入っていない**(上の 1 MB は全部自前のコード)。出力形式と重いバックエンドは別の節(D6、D7)。

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
| 10 | `BAND_HANDLERS` | `lib/pptx/bands.ts` | `LaidOutType` | **PPTX**(ネイティブか `'image'`)。出力形式の側の表 |

`comic` の行は、2・4・5・7・8・9 では `fromTuples(comicMeasure)` / `none` / `noStack` / `{rects, check: {phase: 'comic'}}` / `texts` / `whole`、10 は `'image'`、1 は `placedBand(…)`、6 は `renderComicBand`、3 は `plain`。

**(B) 型で守られない表(キーが省略可、または `switch` / `if` の連なり)**

| # | 場所 | 中身 | `BandDef` の世界での扱い |
|---|---|---|---|
| 11 | `BandLayoutHandlers`(`lib/layout-ctx.ts`)の `layoutHandlerFor` | キーが省略可。**無い型は黙って box として配置される**(`?? layoutBoxLikeBand`) | **フォールバックを削除し、帯の定義が無ければ投げる**(D4) |
| 12 | `TEXT_RUNS`(`lib/layout-text.ts`) | 省略可(`caption` / `box` / `banner` のみ) | `box` / `caption` / `banner` の帯の定義の中へ |
| 13 | `itemIdsOf` / `bareNodeIds`(`lib/band-ids.ts`) | 配置**前**の帯から、節の id を `switch` で取る。reveal と anchor のスコープが使う。**`quadrant.ts` などを import する** | 帯の定義の `ids(data)` |
| 14 | `withNodeIdsBand`(`lib/emit-node-ids.ts`) | `data-node` を付ける `switch` | ホストが `anchors` から書く(`sanitizeBody` は `data-*` を拒む。D8) |
| 15 | `drawsFrame` / `itemRect`(`lib/locations-map.ts`) | ソースの位置の地図 | 既定(枠なし、anchor の長方形)。帯の定義の任意の hook |
| 16 | スポットライトの `if` 連なり 2 か所(`lib/spotlight.ts`)、`lib/layout-metrics.ts`、`lib/focus.ts` | anchor を項目として数える帯の列挙 | 帯の定義の `anchors` から(列挙をやめる) |
| 17 | `lib/rules.ts` の帯別の規則(`comicRules`、`rcaRules`、`FIT_WHO`) | 帯の種類で findings を取り出す。**`rules.ts` が各帯のモジュールを import する(93 KB)** | 帯の定義の `verify` / `rules`。`rules.ts` は枠組みだけ |
| 18 | `RULE_DOCS` / `RULE_LOCATION`(`lib/rules.ts`)、`RuleId = keyof typeof RULE_DOCS` | 規則の id は**コンパイル時に閉じている**。`accept` もこの型 | 帯の定義が自分の規則の説明を持つ。`RuleId` は全部入りの入口で合成(D5) |
| 19 | `CHECK_PHASES`(`lib/verify-handlers.ts`) | 検査の phase の列(`'comic'` もここ) | phase を帯の定義が名乗る |
| 20 | spec: `PARTS`(`lib/spec.ts`、`lib/spec-parts/*.ts`)、`partCatalog()`、`specSchema`(**定数**)、`pnpm schema`(`lib/schema-files.ts`)、`validateOneOf` の `const` による分岐。検査器が理解するのはスキーマの部分集合(`const` / `enum` / `oneOf` / `type` / 大きさ / `items` / `properties` / `required`)で、`pattern` などは**黙って無視される**。`spec.ts` 単体で **483 KB** | JSON の入口。MCP の `list_diagram_parts` はここを読む。**65 部品 ↔ 約 45 の帯は多対多** | **`PartDef`**(帯の定義の外。`spec/parts/<名前>`)。`specSchemaFor({parts})` と `partCatalog({parts})`(既存の定数と API は変えない)。登録のとき、理解しないキーワードを拒む |
| 21 | `IN_NO_SPEC_YET`(`test/spec.test.ts`)、`test/fixtures/untested-exports.json`、`test/fixtures/rule-locations.ts`、`test/band-registries.test.ts` | 「DSL にあるが spec に無い」の台帳と、表の実行時の網羅テスト | `PartDef` が無い帯(`comic` など)の台帳、定義の網羅テスト |
| 22 | 型: `Band` / `LaidOutBand`(`lib/types/index.ts`)、`Declares<Id>` / `Refers`(`lib/strict.ts`) | 合併型、`connect()` の id の型検査 | D5 |
| 23 | 公開 API: `lib/dsl-pure.ts`(`located(...)`)、`lib/web.ts`、`package.json` の `exports` | DSL の関数の置き場。ブラウザの入口は `node:*` を持たない(`test/web-entry.test.ts`) | D3 |
| 24 | ドキュメント: `README.md`、`skills/svg-diagram/references/*.md`、`docs/chatgpt-code-interpreter.md`、MCP の `list_diagram_parts` | 部品の説明 | 帯の定義の `docs`。プラグインは自分の説明を持つ |
| 25 | `lib/dsl/rewrite.ts` の `KEYS` / `NO_REVEAL`、`lib/emit-html.ts` の `kindOf`(HTML の形。**16 か所**)、`lib/dsl/containers.ts` の `row()`(箱でない子を `group` に包む)、`lib/located.ts`(ソースの位置) | 帯の種類で reveal の書き換え、HTML の形、行の子を決める | 帯の定義の hook / HTML の adapter(D6)。構築関数は `located()` で包む |
| 26 | `lib/strict.ts` の `ElementCheck` / `Refers`、`lib/spec-edge.ts`(`renderSpecEdge`)、`lib/inventory.ts` の `whole` の `band: type` | 他の id の参照、MCP の Worker の入口、目録の帯の名前 | v1 に `Refers` の hook は無い。`bands` を `renderSpecEdge` に通す。`whole` に plugin / kind を記録 |
| 27 | `lib/located.ts:12`(`CHILD_BANDS` で入れ子の部品に、ソースの位置を付ける)、`lib/deck-load.ts:119-120`(`figureMinPt` が `planSlide` を呼ぶ。**デッキの読み込みが PPTX を引く**) | 入れ子の帯の列挙、デッキと PPTX の結びつき | `located.ts` は定義の `children` を使う(D4)。デッキの読み込みから PPTX を分ける(U1b) |
| 28 | `lib/layout-handlers.ts:63` の `OFF_GRID_BANDS`(格子に吸着しない帯の型の集合。`originOf`) | 帯の型で配置の原点を決める | 帯の定義の任意の項目 `offGrid`(D2a) |

つまり、1 つの帯を足す作業は、(A) の 10 か所、(B) の十数か所、型とテストに及ぶ。ADR 0074 の `comic` はこれを全部やった実例で、`lib/comic/` に 14 ファイル、表への 1 行が 10 個、`rules.ts` と `verify-handlers.ts` への分岐がある。**(A)(B) のどれもが、全部の帯を import するので、1 つの帯だけを束ねることができない。**

### ADR 0074 と 0031 から引き継ぐ約束

- **人物は図ごとに渡し、グローバルに持たない**(ADR 0074 D3、`comic({characters})`)。→ 帯の定義も**呼び出しごと**に渡す(D9)。
- `lib/` は純粋(`fs`・`child_process` なし。ブラウザの入口は `node:*` なし)。→ 帯の定義の hook は純粋な関数だけで作る(D2 の保証)。
- 外部の SVG は `loadCharacter` が `sanitizeBody` で掃除する。→ プラグインの SVG も同じ門を通す(D8)。
- 配置の結果は、プレーンな JSON(`structuredClone` できる)。→ `laid` も同じ(D2)。

## スパイク(`spikes/band-plugin/`。`lib/` は触っていない)

スパイクは 3 つの部分から成る。(1)プラグインの帯の変換器(ラウンド 1・2 で作った。`host.ts`、`rating-plugin.ts`、`run.ts`、`typing*.check.ts`)、(2)**`BandDef` の試作と、帯の値からの呼び出し**(`banddef/`)、(3)**バンドルの測定**(`bundle/`。esbuild の metafile と、Vite / Rollup)。

### (1) プラグインの帯の変換器(`raw` の帯に載せた薄い変換器。コアの表には 1 行も足していない)

**SVG の門は本物の `sanitizeBody`**。測ったこと(Node 26。`node spikes/band-plugin/run.ts`、`node_modules/.bin/tsc --noEmit -p spikes/band-plugin/tsconfig.json`)。

| 測ったこと | 結果 |
|---|---|
| コアの帯の隣 | 描けた。`verdict.ok = true`。2 回の描画の SVG は**バイト単位で同じ** |
| コンテナの中 | `group([…])`、`row([box, プラグインの帯])`、`areas('a b', {a: box, b: プラグインの帯})` のどれも描けた。`areas` の欄の帯は、`id` を**欄の名前と同じ**にできる(`containers.ts`)。**`grid` は箱だけを取る**ので、プラグインの帯は入れない |
| 構築関数 | `pluginBands(plugin)` が作る関数は `located()` で包まれ、帯に**ソースの位置**(ADR 0072)が付く。`pluginBands(p)` と `diagram({plugins: [p']})` の**コピー / 版の食い違いは、エラー**にした |
| `connect()` | 最上位・`group`・`row`・`areas` の中で、帯の id を終点にして**型が通る**(`Declares<Id>`)。裸の綴り間違いは拒まれる。**ドット付きの `r4.s99` は型で拒まれない**(`IdProblem` が `a.b` を通す。ADR 0012 と同じで、部品の id は**実行時だけ**の検査) |
| 星への `connect('a:bottom', 'rate.s2:top')` | **失敗**(`unknown anchor id`)。`raw` は anchor を登録しないため。配置の hook が要る(D2) |
| 本物の門 | `<text>`・`<style>`・`<image>`・`data-*`・`rgb()`・名前つきの色・帯の中の重複した id は**拒まれ**、素直な図形(3 桁を含む `#hex`)は通った。**`data-*` が拒まれる**ので、`data-node` はホストが `anchors` から書く |
| ダークモード | パレットのトークンの色は**暗い側へ置き換わる**(`#1d5fa8 → #7ab2ee`)。`paper` の帯は、門を通した**後で**、`fill` / `stroke` / `stop-color` の値だけ `#hex`(3〜8 桁)を `rgb()` にし、`PALETTE.bg` の下地を敷く。**門は `rgb()` を拒む**ので、変換は門の後 |
| id の接頭辞 | 帯の内容(型・id・データ)から決める(プロセスの中の構築の順に依らない)。本実装は、図の中の帯の位置から決める |
| 適合テストの試作 `conformance()` | **`layout` を、幅・文字の倍率・折り返しの方式を変えた環境で A, B, C, A, B, A の順に呼び**、(i)共有の(深く凍結した)データでの結果が、**毎回新しく複製したデータでの結果と同じ**、(ii)同じ環境の結果が後でも同じ、を確かめ、`emit` を 2 回呼ぶ。**壊れた 3 つのプラグイン(環境を無視して結果を覚える、4 回目から高さが変わる、データを書き換える)を、すべて落とす**ことを確かめた。素直なプラグインは通る |
| 配置の変種 | `canvas`、`width: 'fit'`、`width: 360` で描いても同じ。ただし `raw` は配置の通過のたびには呼ばないので、**コアの再配置の中で hook が何度も呼ばれることは、このスパイクでは再現できない**(U2 の後に、本物の `fill` / canvas / `width: 'fit'` の通過で確かめる) |
| findings | プラグインの検査が 2 件。コアの `verifyDiagram` だけでは `ok = true`、**併合すると `ok = false`**。コアの verify に差し込む口が無いので、変換器は配置後に自分で回した(`verify` の hook が要る) |
| 高さ・文字 | `raw` は高さが**構築時に固定**で、`<text>` が測定を通らない(門も拒む)。**配置の hook と、文字をデータで返す口(`texts`)が要る** |
| 型 | `Band | PluginBand` / `LaidOutBand | LaidOutPlugin` に広げると、**ちょうど 10 件のエラー**(各表で `Property 'plugin' is missing`)、他は 0 件。レビューが実際の合併型を広げて `tsc -p .` を回すと **22 件**の診断が出て、すべて 10 個の表・派生の行・`test/pptx-groups.test.ts:124` にあった |

### (2) `BandDef` の試作 — 帯の値から呼ぶ(`banddef/`。コアの表を通らない)

- `band-def.ts`: 1 つの定義の形 `BandDef<D, L>`(`measure` / `layout` / `emit` / `verify`)と、**定義への参照を持つ帯の値** `{def, data, id?}`。
- `mini-core.ts`(約 40 行): 測定 → 配置 → 検査 → 描画を、**`band.def.<hook>` を呼ぶだけ**で行う小さなパイプライン。帯を 1 つも import しない。測っていない文字は**エラー**(幅 0 で黙って通さない)。
- `comic.ts`: **本物の** `lib/comic/*` と `lib/dsl/comic.ts` を 1 つの `BandDef` に包んだもの。
- `box.ts`: **本物の** `layoutBoxContent` と `renderBox` を 1 つの `BandDef` に包んだもの(縮小版: アイコン・ステップ・タグ・スタンプの配置は含まない。DSL の `box()` は `rules.ts` を引くので使わない)。
- `smoke.ts`: マンガ(4 コマ)と箱を試作のパイプラインで描き、本物の `renderInBrowser` のマンガと**ふきだしの数(4)とコマの数(12)が一致**することを確かめた(**数だけの確認で、バイトの一致ではない**。同値は D10 の基準 1 のとおりバイト単位で見る)。

### (3) バンドルの測定(`bundle/`。esbuild の minify、ESM。依存は束ねるか外へ)

**今の入口**(`measure.ts`、`entries.ts`)は背景の表のとおり。パッケージの入口ごと(Node 向け、依存は外):

| 入口 | 自前のコード | 外部の依存 |
|---|---|---|
| `.`(`lib/dsl.ts`) | 1080.9 KB | `harfbuzzjs`、`playwright-chromium`、`node:*` |
| `./browser` | 1042.0 KB | なし |
| `./spec` | 483.0 KB | なし |
| `./spec/edge`(MCP の Worker) | 1213.5 KB | なし |
| `./pptx/edge` | 1301.1 KB | なし |
| `./pptx/deck/edge` | 1328.1 KB | なし |
| `./render` | 1254.8 KB | `harfbuzzjs`、`@resvg/resvg-js`、`playwright-chromium`、`node:*` |
| `./markdown` | 1210.6 KB | `harfbuzzjs`、`playwright-chromium`、`node:*` |

**出力形式と重いバックエンドの単体の大きさ**(`exporters.ts`。依存は外):

| 部品 | 自前のコード | 備考 |
|---|---|---|
| PPTX(`lib/pptx/emit.ts` 単体) | 212.4 KB | うち **PPTX 自身 101.6 KB**(`template.ts` 39 KB は埋め込みの XML)、**共有の SVG 描画 110.7 KB**(`emit-figures.ts` 28.6 KB、`emit-boxes.ts` 11.8 KB など。`'image'` の貼り付けが各帯の描画を使うため) |
| HTML(`lib/emit-html.ts` 単体) | 127.4 KB | `deck-html.ts` は 4.6 KB |
| Node の測定器(`lib/measure.ts`) | 83.4 KB | `harfbuzzjs`(WASM)、`playwright-chromium`、`node:child_process` ほかを import |
| ブラウザの測定器(`lib/web-measure.ts`) | 3.0 KB | 依存なし |
| PNG(`lib/raster.ts`) | 100.6 KB | `@resvg/resvg-js`(ネイティブ)、Node の測定器を import |
| フォントの箱(`lib/font-box.ts`) | 70.3 KB | HarfBuzz の測定を使う。**フォントのファイルは JS に埋め込まれていない**(`font-subset.ts` は 1.2 KB で、ファイルを読む) |
| SVG 描画の枠(`lib/emit.ts` 単体) / 配置の枠(`lib/layout.ts` 単体) | 107.8 KB / 504.5 KB | どちらも**全部の帯を引く**(表のため) |
| 検査(`verify.ts`)/ 規則(`rules.ts`) | 187.1 KB / 162.6 KB | 同上 |
| Excel(ADR 0068) | **未実装**(Draft。コードなし) | D6 で設計に織り込む |

**パッケージの入口 `.` の中身と理由**: `dsl/io.ts → pipeline.ts → emit-html.ts` で **HTML が 18.9 KB** 入る(`pipeline.ts` を単体で束ねると 306 KB。HTML・SVG の出力を全部持つため)。`dsl.ts → measure.ts` で **Node の測定器が入り**、`measure.ts → raster.ts` で PNG が少し入る(`harfbuzzjs`・`playwright-chromium` は外部の import として残る)。PPTX・spec・markdown は `.` には入らない。

**出力形式が帯の種類で分岐している箇所(今)**: `lib/pptx/bands.ts`(表 `BAND_HANDLERS`。**各帯ごとの対応が 1 行**で、表の形のまま adapter の表に移せる)、`lib/pptx/slide.ts`(3 か所: `group` と `swimlane` の**入れ子の枠**を、後ろに続く帯の数 `span` でまとめる特別扱い)、`lib/pptx/geom.ts`(5 か所。コネクタの**図形名**で、帯の種類ではない)、`lib/pptx/svg-shapes.ts`(1 か所。矢じりの種類)、`lib/emit-html.ts`(16 か所: `native(b)` と `box()`/`caption()`/`banner()`/`group()`/`table()`/`row()`/`grid()` の分岐と `kindOf`。**ネイティブでない帯は、既定で「インラインの SVG」になる**)。つまり、**PPTX は「表を adapter に分ける」作業(`slide.ts` の `group` / `swimlane` の特別扱いは、その帯の adapter の hook に移す)、HTML は同じ形で、既定がすでに SVG**で、構造の作り直しは要らない。Excel(ADR 0068 D2)は、帯の種類ごとの表(「シートにする / 子をたどる / しない」)を**まだ書く前**なので、最初から adapter の形で書ける。

**帯を使う側の最小のバンドル**(`prototype.ts`。試作のパイプライン。esbuild、ブラウザ向け、**`sideEffects` の指定なし**):

| 試作の入口 | 大きさ | gzip | モジュール数 |
|---|---|---|---|
| マンガだけ(試作のパイプライン + `comic`) | **51.3 KB** | 20.4 KB | 38 |
| 箱だけ | **29.2 KB** | 11.4 KB | 26 |
| 箱 + マンガ | 67.4 KB | 26.4 KB | 47 |

箱だけの 29.2 KB のうち、約 13 KB は**今の共有モジュールの付け根**による(`emit-boxes.ts → reveal.ts → band-ids.ts → quadrant.ts` の 7.3 KB と `reveal-handlers.ts` の 4.2 KB、`band-children.ts`)。**帯の定義の世界では、これらの付け根も切る**(`visibleAt` を小さなモジュールに出す、など。移行の基準 D10)。

**`sideEffects: false` と入口ごとの `exports` で、本当に tree shaking が効くか**(`shaking.ts`。`lib/` と試作を、プレーンな ESM の JS にコンパイルした一時のパッケージを作り、esbuild と、**Vite(中身は Rollup)**でバンドルして大きさを比べる。入口はどれも**帯を 1 つだけ**使う):

| ケース | esbuild | Rollup(Vite) |
|---|---|---|
| A. 全部の帯を再エクスポートする樽(barrel)、`sideEffects` の指定なし | 54.3 KB | 25.6 KB |
| B. 同じ樽、`"sideEffects": false` | **16.4 KB** | **21.1 KB** |
| C. 樽を使わず、帯ごとの入口を直接、`"sideEffects": false` | **16.4 KB** | **21.1 KB** |
| C2. 同じ、`sideEffects` の指定なし | 29.3 KB | 25.3 KB |
| F. マンガ 1 つだけ(帯ごとの入口、`sideEffects: false`) | 44.0 KB | 49.4 KB |
| G. 箱 + マンガ(同上) | 55.3 KB | 64.0 KB |
| D. **登録式**(帯のファイルを import すると自分を登録する)、指定なし | 54.4 KB | 54.0 KB |
| D2. 登録式、`sideEffects: false`(**登録のモジュールが落ち、16.5 KB は「登録された帯が 0」の値**) | 16.5 KB | 21.1 KB |
| E. **今のコード**: `renderComic` だけ、`sideEffects: false` | 821.0 KB | 1034.2 KB |
| E2. 今のコード、指定なし | 1035.0 KB | 1292.7 KB |

読み取れること。

1. **`sideEffects: false` は効く**(A→B で esbuild は 54 → 16 KB。Rollup も 26 → 21 KB)。付け根のモジュールを落とす。ただし**今の `package.json` には `sideEffects` の指定が無い**。
2. **今のコードでは、フラグだけでは足りない**(E: 821〜1034 KB)。中央の表が全部の帯を**使っている**ので、落とせない。**表を無くすことが本体で、フラグは仕上げ**。
3. **登録式(D)は、フラグの指定に結果が左右される**: 指定なしでは全部の帯が束ねられ(54 KB)、`sideEffects: false` にすると登録のモジュールが落ちる(これは `false` の**正しい意味**。登録のファイルを `"sideEffects": [...]` の配列に書けば残せる)。それでも**帯の値が定義を持つ方式を採る理由**は、(a)グローバルな状態を持たない(ADR 0074)、(b)同じ型の帯が 2 つの版で共存できる、(c)使う帯だけが import されるので、**どのフラグでも構造上正しい**、の 3 点。
4. 帯ごとの入口を直接 import すれば、樽が無くても、フラグがあれば同じ(B = C)。樽は、フラグがある限り害が少ないが、**Rollup(Vite)は樽の再エクスポートの分析が esbuild より弱い**(F / G の差)ので、**帯ごとの入口を主にする**。
5. Rollup(Vite)は、`package.json` の `sideEffects` を、**依存パッケージとして解決したとき**に読む(ケースはパッケージ内のファイルを直接指したので、同じ挙動の近似)。npm で配る版では、入口を `exports` に書き、`sideEffects: false` を入れた上で、**消費側のバンドラ(Vite / esbuild)で実際の入口をバンドルする試験**(下の予算の検査)を CI に入れる。

**見積もり**(新しい世界。最小のバンドル、minify、KB。**ラウンド 3 のレビューによる補正を入れた**。試作は縮小版なので下限で、**本物は幅で示す**)。

| 組み合わせ | 今(測った) | 見積もり(esbuild) | 根拠 |
|---|---|---|---|
| マンガ + ブラウザの測定器(Artifact) | **1036** | **230〜250**(`rules.ts` を分ければ 200〜215)。試作 51 | 枠組み(HTML・帯の DSL・表・`rules.ts` を除く)**約 144 KB** + `rules.ts` の一般の半分 約 46 KB = **約 190 KB**(D12 に内訳)+ マンガの帯 約 45 KB(試作で 37 KB + DSL・人物・`icon-store`)+ 測定器 3 KB。**以前の「130〜160」は、残るべき枠組みの一部(81 KB)しか数えておらず、楽観的だった** |
| 箱・行 + ブラウザの測定器 | **1032** | **約 260〜280**(試作の箱だけ 16〜29) | 枠組み 190 + 箱 約 16 + 行 約 10(見積もり)+ 3 |
| 箱・行 + PPTX(Node。依存は外) | **1301**(`./pptx/edge`) | **約 330〜380** | 枠組み 190 + 箱・行 26 + **PPTX 自身 101.6 KB**(`template.ts` 39 KB)+ adapter 約 10 + ports。**PPTX が今引いている共有の SVG 描画 110.7 KB は、使う帯の描画だけになる** |
| 箱・行 + Excel | なし(未実装) | **約 270〜300**(**コードが無いので根拠は弱い**) | 枠組み 190 + 箱・行 26 + Excel の書き出し 40〜60(zip は PPTX と共有。ADR 0068 D8) |
| 全部入りのブラウザ(`./browser`) | **1042** | **1042 以下**(互換) | 全部の帯を含める。増やさない(予算) |
| 全部入りの Node(`.`) | **1081** | 同じ | 同上 |

**Rollup(Vite)は esbuild より 10〜25% 大きい**(F 44.0 vs 49.4、G 55.3 vs 64.0、E 821 vs 1034 KB)ので、**予算はバンドラごとに別に置く**(D12)。**決める人への正直な見込み: 最初の成果は約 230〜250 KB(今の約 1/4)で、190 KB 台にするには `rules.ts` を規則の族ごとに分ける必要がある**(U15)。試作のパイプラインは縦の積みだけの縮小版(`connect()`・reveal・題・凡例・検査・規則を含まない)なので、**試作の大きさは本物の下限**。本物は U1b で測り直し、予算(D12)を置く。

## 決定

### D1. 帯の定義は 1 つの形 `BandDef`。コアの帯も外部の帯も同じ形で、呼び出しは**帯の値**から行う

**推奨(Q1、Q2):**

1. **`BandDef<D, L>` が、帯の種類 1 つの全部の振る舞い**を持つ。コアの帯(`box`、`comic` …)も、外部の帯(`rating-demo:stars`)も、**同じ形**。違いは名前(外部の帯は `プラグインの id:帯の名前`)と、安全の約束(D8)だけ。
2. **`BandDef` は出力形式に依らない hook だけを持つ**(Q5): `build`(構築と検査)、`measure`(測定の依頼)、`layout`(配置)、`emit`(**SVG**。SVG が基本の形式)、`verify` / `rules`(検査と規則)、`inventory`(ADR 0078 の目録)、`reveal`、`ids` / `anchors`、`docs`、帯をまたぐ処理のための任意の hook(D2b)。**spec の部品(`PartDef`)は帯の定義に入れない**(部品と帯は多対多。D9、Q6)。**PPTX・Excel・HTML のコードは `BandDef` に入れない。** 帯を import しても、出力形式のコードは付いてこない(D6)。
3. **呼び出しは帯の値を通す。** DSL の構築関数は、**定義への参照を持つ帯**を返す(`band[DEF]`。ソースの位置の `SOURCE` と同じ、`Symbol.for` のシンボル)。パイプラインは、中央の表を引かず、`band[DEF].layout(...)` のように**帯の値の定義を呼ぶ**。import していない帯のコードは、どこからも参照されないので、**束ねられない**。**何も登録しない**(登録式は、`sideEffects: false` で黙って消える。背景の測定 D)。
4. **コアの帯の移行が主線**(Q2。D10)。表は、移行の間は**帯の定義から作る派生の見え方**になり、移行が終わったら無くなる。

```ts
// svg-diagram/bands/box(コアの帯。外部の帯と同じ形)
import type {BandDef} from 'svg-diagram/core';
export const boxDef = {
  type: 'box',
  build: (input: BoxInput): BoxBand => { /* 検査と既定値 */ },
  measure: (d, m) => { /* m.atoms(text, size, weight, font) */ },
  layout: (d, env) => ({h, anchors, texts, laid}),
  emit: (laid, env) => '<g>…</g>',
  verify: {rects: laid => […]},
  ids: d => d.id ? [d.id] : [],
} satisfies BandDef<BoxBand, LaidOutBox>;
export const box = located((input: BoxInput) => band(boxDef, boxDef.build(input)));   // 帯の値 = データ + [DEF]
```

```ts
// 外部のプラグイン(rating-demo): 平らなデータ + 純粋な関数。svg-diagram からは型だけ
import type {PluginDef} from 'svg-diagram/plugin';
export default {id: 'rating-demo', apiVersion: '0.1', version: '1.0.0', requires: {svgDiagram: '>=0.10 <1'},
  bands: {stars: {/* BandDef(type は 'rating-demo:stars' になる) */}}} satisfies PluginDef;
// 使う側
import {pluginBands} from 'svg-diagram/core';
const rating = pluginBands(ratingDemo);   // コアが構築関数を作る(located() つき)
```

- **コアの帯の一部は、`core` が自分で作る**(題・出典の `caption`、`status`、自動の `legend`、`spacer`、`connect`、`group`)。これらは**コア所有の帯**として `core` が定義を持つ(D4)。また、**`BandDef` の `layout` には公開層と内部層の 2 つの形がある**(D2a): プラグインは純粋な公開層、コアの帯の多く(`box`、コンテナ、図式の帯)は内部層。
- **外部のプラグインは、名前空間つきの `BandDef` の集まり**にすぎない(Q8)。プラグインの `PluginDef` は**平らなデータ + 純粋な関数**で、実行時に svg-diagram から何も import しない(`import type` だけ。`satisfies PluginDef`)。構築関数は**コアが**プラグインのデータから作る(`pluginBands`。`located()` で包み、`Declares<Id>` の型を付ける)。理由は D12(jsDelivr から 2 つのモジュールを読むとき、コピーが 2 つになる問題を避ける)。
- **帯の型の名前**: コアの帯は今までどおり(`box`、`comic`)。外部の帯は `プラグインの id:帯の名前`(`rating-demo:stars`)。コアの型にはコロンが無いので衝突しない。規則の id は `プラグインの id/規則名`。コアの規則は、移行しても今の id のまま(golden が変わらない)。
- **版**: (a)`apiVersion` がホストとの契約で**権威**。`0.x` の間は minor まで同じでなければ受けない(`1.0` 以後は、major が同じでホストの minor ≥ プラグインの minor)。(b)`requires.svgDiagram` は core の版の範囲(合わなければ、両方の版を名指ししたエラー)。(c)`peerDependencies` は npm の案内。(d)プラグインの `version` は記録と、キャッシュのキー(D9)。**API の版は core のパッケージの版と別の semver**。`0.x` の間は破壊的変更を許す。**`1.0` の条件は D10。**
- 帯の値が定義を持つので、**同じ型の帯が 2 つの版で共存してもよい**(帯ごとに自分の定義を呼ぶ)。spec(JSON)から作る帯は、渡された定義を使う(D9)。**構築関数を作った定義と、`diagram({plugins})` に渡された定義が、同じ型で版が違うときはエラー**(コピーの食い違い。スパイクで確認)。

| 案 | 採らない理由 |
|---|---|
| (採用)`BandDef` を帯の値が参照し、パイプラインが帯の値から呼ぶ | 使う帯だけが束ねられる。登録が要らない。コアの帯と外部の帯が同じ形。出力形式のコードが `BandDef` に入らないので、帯の import が出力形式を引かない |
| 中央の表を残し、プラグインを封筒 `plugin` 1 種類で足す(ラウンド 1〜2 の案) | 外部の帯は足せるが、**コアの帯の束ねは直らない**(1 MB のまま)。決める人の要件 2・3 を満たさない |
| 登録式(`registerBand(def)`、帯のファイルを import すると自分を登録する) | 全部を import すると全部入る。`sideEffects: false` だと**黙って消える**(背景の D)。グローバルの状態(ADR 0074 に反する) |
| 帯の定義を出力形式の hook まで持つ(`pptx` / `xlsx` を `BandDef` に入れる) | 帯を 1 つ import すると PPTX・Excel のコードが付いてくる。出力形式ごとの tree shaking ができない |
| ビルド時にバンドラのプラグインで未使用の帯を削る | ツールへの依存を利用者に強いる。型のない取り除きになる。`sideEffects` と入口で足りる |

### D2. `BandDef` の hook(必須・任意・既定)

今の表への対応。各 hook は**純粋で冪等な関数**(同じ入力から同じ出力。`Date`・`Math.random`・グローバルの状態・I/O なし)。**hook は 1 回の描画の中で何度も呼ばれる**(`fitLineScale` と折り返しのやり直し、`fill` の `fontScale` の二分探索、canvas の拡大、`width: 'fit'` の最大 4 回の配置。`layout.ts`、`dsl/render.ts`、`web.ts`)。回数を数えたり、回数に頼ったりしてはいけない。

| hook | 対応する表(今) | 必須か | 既定(無いとき) |
|---|---|---|---|
| `build(input) → data` | DSL の関数、spec の `PARTS[].build / check` | **必須**。唯一の入力検査。投げるときはフィールド名を言う(外部の帯は、コアがプラグインの名前を前に付ける)。構築の時点で走る | — |
| (spec は帯の定義に入れない) | spec(20)、`partCatalog()`、MCP | — | **`PartDef`**(schema・example・`build(json) → BandValue[]`・使う帯の定義)が、`spec/parts/<名前>` の入口で別にある(D9)。部品と帯は多対多(`chart` の下に `lines` / `radar` / `pareto` …、`board` は `areas` / `box` / `group` / `caption` / `connect` を作る)。**登録のときに、spec の検査器が理解しないキーワード(`pattern`・`anyOf`・`$ref`・`format` など)があれば拒む**。`example` は適合テスト(U6)で「問題なく描ける」ことを見る |
| `ids(data) → string[]` | `bareNodeIds`(13)。reveal と anchor のスコープが**配置前**に使う | anchor を持つ帯は**必須** | `[]`。配置が返した anchor がこれに無いとき `band-anchor-undeclared`(エラー) |
| `measure(data, m)` | `MEASURE_HANDLERS`(2) | 文字があれば | 文字なし。**文字は `m.atoms(text, size, weight, font)` だけ**。大きさは `m.roles` から取る(下の「測定」) |
| `layout(data, env) → {h, anchors, texts, paper?, laid}` | `LAYOUT_HANDLERS`(1)、`placedBand`、`ctx.register`、スコープ(13) | **必須**。`env` = `{x, y, w, widthOf, roles, theme, tones, wrap, wrapText}`。`w` は**親の内容の幅**(最上位でも、`group` / `row` / `areas` の中でも)。`anchors`(`{id, x, y, w, h}`。帯の中の名前)はホストが登録する(下の「id」) | — |
| `emit(laid, env) → svg` | `EMIT_HANDLERS`(6) | **必須**。**SVG**(基本の形式)。外部の帯は図形だけ(ホストが**本物の `sanitizeBody`** を通し、id に接頭辞を付け、自分の包み(`data-node`)で包む。D8)。色は `env.color(key)`(パレットのトークン) | — |
| `texts`(`layout` の返す文字のデータ) | `FIT_HANDLERS`(8)、`INVENTORY_HANDLERS`(9) | 文字があれば | `[]`。各項目: `{x, y, text, size, weight?, font?, anchor?, tone?, lines?, w?, part?, reveal?}`。**外部の帯は文字を `<text>` で出さず、データで返し、コアが描く** |
| `verify.rects(laid)`、`verify.check(laid, ctx) → findings`、`verify.contrast` | `VERIFY_HANDLERS`(7)、`CHECK_PHASES`(19) | 任意 | `rects` は帯全体 1 つ(`ownRect` 相当)。`check` なし。findings は `{rule, severity: 'problem' \| 'warn' \| 'info', message, where?}`(コアの `advice` は `info`。ホストが `problem` → verdict の問題、`warn` / `info` → findings に写す) |
| `rules`(`{規則名: {doc, scope: 'band' \| 'band-grouped' \| 'diagram'}}`) | `RULE_DOCS` / `RULE_LOCATION`(18) | **出す規則は全部必須** | 無い規則を出すと `band-rule-undocumented` |
| `inventory(laid) → items` | `INVENTORY_HANDLERS`(9) | 任意 | `texts` から `text` の項目、図形の全体を `whole` 1 つ(`band` には型名を記録。外部の帯は plugin / kind も)。保守側(重ねの吹き出しが覆ってはいけない内容) |
| `reveal` | `REVEAL_HANDLERS`(3) | 任意 | `{stage: true}`(帯の `reveal` / `until`。anchor もその段)。**帯の部品ごとの reveal と、スポットライトの部品ごとの暗さは外部の帯では持たない**(帯全体で出入り、暗くなる)。`env.focus` と、anchor ごとの `reveal` の名前を予約 |
| `children` | `CHILD_BANDS`(4)、`STACK_WIDTH`(5) | コアの `group` / `row` / `areas` / `grid` / `grouprow` / `image` / `tree` は持つ。**外部の帯は v1 では不可**(Q9) | 子なし。`STACK_WIDTH` は `null` |
| `docs`(`summary`、`usage`、`example`) | README、skills、`list_diagram_parts`(24) | 任意 | `description` と `example` から catalog の行を作る。外部のプラグインは自分の README / skill を持つ |

**出力形式の hook は無い**(PPTX・Excel・HTML は D6 の adapter)。

**id(ADR 0012 に従う)**: 外部の帯の**スコープは、既定で帯の `id`**(明示の `scope` で上書きできる)。anchor を持つ帯は `id` が**必須**。帯全体を `<id>`、部品を `<スコープ>.<部品の id>`(`rate.s2`)として登録する。同じ種類の帯が 2 つあっても `s1…s5` が衝突しない(U2 のテスト)。部品の id は**型では検査されない**(`strict.ts` の `IdProblem` はドット付きの id を通す。スパイクで `rate.s99` が通ることを確認)ので、**実行時の検査**に頼る。`areas` の欄の帯は、**`id` を欄の名前と同じに**する(`containers.ts`)。帯は**他の id を参照しない**(`Refers` の hook は v1 に無い)。

**測定(コアの挙動に合わせた厳密な約束)**:

- コアは、測っていない文字を**幅 0 で黙って通す**(`widthOfMeasured`。`renderInBrowser` は strict でない)。外部の帯でそれを許さない: ホストは、`texts` の各項目と `widthOf` の呼び出しを、`measure` が登録した集合と照合し、**漏れは `band-text-unmeasured`(どの経路でもエラー)**(試作のパイプラインで確認)。
- 文字の大きさは、`measure` の `m.roles`(と `layout` の `env.roles`)から取る。`fill` と canvas は `roles` を拡大して測り直し、canvas は文字の最小(`minText`)を守らせるので、**固定の px は使わない**。
- 日本語の折り返しはコアのもの(禁則、文節)を使う。帯は折り返しを自分で書かず、`env.wrapText(text, {size, weight, font, w}) → lines` を呼ぶか、`texts` の項目に `w` を書いてコアに折り返させる。

**帯が守ること(適合テスト U6 が確かめる。ホストは実行時にすべては強制できない)**:

1. **決定性と冪等**: 同じ入力は同じバイト列。`layout` を、**幅・`roles` の倍率・折り返しの方式を変えた環境で A, B, C, A, B, A の順に**呼んでも、入力の深いコピーから呼んでも、同じ(試作の `conformance()` は、壊れた 3 つのプラグインを落とした。**本物の `fill` / canvas / `width: 'fit'` の通過での確認は U2 の後**。このスパイクでは再現できない)。`laid` は `structuredClone` できる。
2. **純粋**: `node:*`・`fetch`・グローバルの状態を使わない(ブラウザの入口にそのまま載る)。外部の配布物は、**import のない 1 つの自己完結した ESM**(D12)。
3. **文字はコアの測定器**: 外部の帯の文字は `measure` と `texts` だけ。`emit` の SVG に `<text>` があれば、門が拒む(D8)。
4. **色とダークモード**(コアの仕組みに合わせる): ダークモードは、出力の SVG の中の**パレットのトークンの `#rrggbb` を、暗い側の `#rrggbb` に置き換える**(`recolor`、`lib/tokens.ts`)。トークンでない色はそのまま残る。comic は、固定したい色を**門の後で `rgb()` にして**置き換えを避ける。
   - 既定: `env.color(key)` が返すパレットの色は**暗い側に置き換わる**(スパイクで確認)。
   - 固定の色(顔の肌色・輪郭など): **`layout` が `paper: true` を返した帯**は、門を**通した後**に、**`fill` / `stroke` / `stop-color` の値だけ**の `#hex`(3・4・6・8 桁。アルファは捨てる)を `rgb()` に直し(`url(#id)` や `href` は触らない)、**`PALETTE.bg` の `rgb()` の下地**を敷く(comic の `COLOR.paper` と同じ。明るい図に白い四角が出ない)。置き換えは起きない。
   - **`paper` の帯の `texts` は、ホストが凍結したインクの色(`rgb()`。トーンごとに明るいパレットの値)で描く**(comic が `<text>` を `COLOR.ink` / `COLOR.prompt` の `rgb()` にするのと同じ)。**そうしないと、暗い図でコアの文字だけが明るい色に置き換わり、白い下地の上で読めなくなる**(manga-face の `faces` の名前が該当)。U3 に、暗い図の `paper` の帯の**文字と下地のコントラスト**のテストを置く。
   - `paper` でない帯が、トークンでない `#hex`(3・4・6・8 桁のどれでも)を使うと、暗い図で `band-fixed-color`(助言)。
   - **門は `rgb()` を拒む**(`sanitizeBody` は、塗りに `#hex`・`none`・`currentColor`・`url(#…)` だけを認め、`#hex` は `allowColor` のときだけ)。だから変換は門の後で、帯は `#hex` で書く。
5. **id は衝突しない**: anchor の id は帯のスコープで修飾(上)。SVG の `id` は帯ごとの接頭辞(`prefixIds`)で、**接頭辞は図の中の帯の位置から決める**(プロセスの中の構築の順や、モジュールの大域の数え上げに依らない。スパイクは帯の内容から決めた)。**1 つの帯の出力の中の id の重複は `band-svg-rejected`**(`sanitizeBody` は重複を見ないので、ホストが調べる。例: ADR 0079 の顔が固定の `id="fc"` を使うなら、顔ごとに修飾して一意にする)。
6. **大きさの上限**: 1 つの帯の SVG と anchor の数の上限は**設定できる**(既定 SVG 1 MB、anchor 1000。顔 64 個の見本帳は、顔 1 つが 4.9〜5.8 KB(ADR 0079)なので約 370 KB で、既定に収まる)。超えたら `band-too-large`(エラー)。
7. **他の帯の `data` に触れない**: hook は帯自身の `data` と `env` を受け取り、**他の帯の `data`** は渡さない。図の状態は、**読み取り専用の一般のデータ**(`verify.check` の `ctx.connects: {fromId, toId, segments}[]`。コネクタの幾何)だけを渡す。

### D2a. 二層の環境 — 公開層(プラグイン)と内部層(コアの帯)

**推奨(Q8):** 上の hook の表は**公開層**(`PublicEnv`)の約束で、**プラグイン(外部の帯)が書けるもの**である: 純粋な `layout(data, env) → {h, anchors, texts, laid}`。**コアの帯は、これだけでは書けない**。今の配置の関数は `LayoutCtx` 全体を使う(`lib/layout-ctx.ts`、`layout.ts:369-372`): 共有のカーソル `ctx.y` を進め、`laidOut` に直接 push し、`ctx.register` / `setBox` / `claimed` / `placeBoxLike` / `gapForLabels` / `areasGapFor`、入れ子の再帰(`stack`)、先に来た `connect()` の保留(`deferred`)、`nodeBottoms`、`areaIds`、線の倍率の探索(`lines`)、`keepWords` を読み書きする。

| 層 | 環境 | 使えるもの | 書けるもの |
|---|---|---|---|
| **公開層**(プラグイン用。`svg-diagram/plugin` の型。API の semver に含める) | `PublicEnv` | `{x, y, w, widthOf, roles, theme, tones, wrap, wrapText}`。**純粋**。カーソルを持たない | 葉の帯、anchor を持つ帯、文字を持つ帯。`comic` の配置(`layoutComic(band, x, y, w, widthOf)` は純粋)も、ここで書ける |
| **内部層**(コアの帯とコア所有の帯用。`svg-diagram/core/internal`。**プラグインには出さず、semver に含めない**) | `CoreLayoutCtx`(今の `LayoutCtx`) | カーソル、`laidOut`、`register`、`setBox`、`claimed`、`placeBoxLike`、`stack`(再帰)、`deferred` の connect、`nodeBottoms`、`areaIds`、`lines`、`keepWords` | `box`(`placeBoxLike`)、コンテナ(`group` / `row` / `grid` / `areas` / `grouprow`)、`swimlane`、図式の帯(`tree` / `states` / `cause` / `classes` / `bpmn` / `fta` / `bowtie`) |

**`comic` を公開層で書くための追加(ラウンド 4 のレビュー)**: `comic` の配置(`layoutComic`)は純粋で公開層に収まるが、次の 4 つが帯の種類の分岐として残っているので、**一般の hook / 任意の項目にする**。

| 必要な物 | 今の場所 | 追加するもの(既定) |
|---|---|---|
| **検査がコネクタの幾何を読む**(ふきだしを横切るコネクタの検出) | `verify-handlers.ts:212-230`(`checkComic` が `d.connects` と `pathSegments`) | 公開層の `verify.check` に、**読み取り専用のコネクタの幾何** `ctx.connects: {fromId, toId, segments}[]` を渡す(一般のデータで、プラグインにも有用。既定は渡すだけで、使わなくてよい) |
| **長方形の名前の修飾** | `verify-handlers.ts:442-443`(`band.type === 'comic' ? undefined : scopeOf(band)`。comic の `rects` は修飾済みの名前を持つ) | 任意の項目 `rectsQualified?: boolean`(既定 `false`: ホストがスコープで修飾する) |
| **`data-node` の付け方** | `emit-node-ids.ts:22`(`case 'comic': return {...band, nodeIds: true}`)。`renderComic` が、帯の出力の**断片そのもの**を全体の SVG から探して差し替える(`replaceComicFragment`) | 任意の項目 `nodeIds?: 'host' \| 'self'`(既定 `'host'`: 外部の帯はホストが `anchors` から書く。**`'self'` のコアの帯は、自分で書き、ホストは出力を包まず・書き換えない**) |
| **格子への吸着** | `layout-handlers.ts:63`(`OFF_GRID_BANDS` と `originOf`) | 任意の項目 `offGrid?: boolean`(既定 `false`: 4px の格子に置く) |

**信頼は「出どころ」で決める。定義が自分で立てる印では決めない**(ラウンド 5 のレビュー):

1. **`PluginDef` を通って来た定義は、すべて外部**(`pluginBands`、`diagram({plugins})`、`{parts, plugins}`、プロジェクトの設定、`--plugin`、MCP の許可リスト)。**`type` に `:` を含む定義も外部**。
2. **`pluginBands` は、作った定義に `[EXTERNAL]` の印を付け**、ホストはその印で外部かを判断する。コアの定義は、**`type` に名前空間が無く、かつ `PluginDef` から作られていない**ときだけ信頼する。
3. **信頼する定義だけが使える項目(trusted-only fields)**: `internal`(内部層の環境)、`nodeIds: 'self'`、`rectsQualified: true`。**外部の定義がこれらを立てたら、ホストは `BandError` で拒む**(`internal: true` を拒むのと同じ)。
4. **ホストの包み・門・id の接頭辞は、外部の定義には常に掛ける**(D8 の 3)。**環境の層(公開 / 内部)とは独立**で、コアの定義は(公開層で書いても)出力を包まれない。これで `comic` は、公開層のまま、**バイト単位で同じ**に移せる(M1)。
5. **`ctx.connects` は、凍結した値(またはコピー)で渡す**。プラグインがコネクタの幾何を書き換え、後の検査が読む物を変えることを防ぐ。
6. **守る範囲**: これは**誤りと、データの混入**(LLM が書いた spec の文字列を、プラグインの `emit` がそのまま SVG に出して `<script>` や `<foreignObject>` が入る、など)を防ぐための物で、**悪意のあるプラグインのコードを防ぐ物ではない**(プラグインのコードは全権限で動く。D8)。
7. **作者が自分の `.ts` で、コアの `band(def, data)` の補助関数を使って直接作った定義は、作者自身のコードと同じに信頼する**(出どころが作者のコード)。**データの入口(spec、MCP、設定)からは、そのような定義を作れない**(それらは `PluginDef` を通り、外部になる)。

`BandDef` の `layout` は、公開層の形(`PublicEnv`)か、内部層の形(`internal: true` の定義だけが `CoreLayoutCtx` を受ける)のどちらか。`internal` は上の trusted-only fields の 1 つで、**外部の定義が立てたら `BandError` で拒む**。

**内部層から公開層へ移すもの(将来)と条件**: 内部層のうち、**純粋な関数に言い換えられるもの**だけを移す。条件は 3 つ: (1)**外部の実物(manga-face など)が、その機能を必要としている**、(2)**コアの帯が少なくとも 2 つ、その形で書き直せている**(1 つだけに合わせた形にしない)、(3)**冪等で、環境を変えた通過で同じ結果になる**(適合テストで確かめられる)。候補: 子の帯を積む再帰(`children` を持つ外部の帯。Q9)、anchor の保留した `connect()`(部品への接続)。**移さないもの**: カーソルの直接の操作、`laidOut` への直接の push、`placeBoxLike` の細部(箱の内部)。これらは内部層に留める。移すときは、API の minor を上げ、適合テストに項目を足す。

**1.0 の確認表には、内部層の実物(コンテナと図式の帯)を入れる**(D10): 内部層が実際にコアの帯を書ききれることを、1.0 の前に確かめる。

### D2b. 帯をまたぐ規則のための hook(一般のデータで書く)

`rect` / `anchors` / `texts` / `inventory` / `children` の 5 つの出力だけでは、今の帯をまたぐ処理を書けない。次の hook を足す。**どれも任意で、既定がある**(外部の帯が何も書かなくても動く)。出力が帯の種類ごとの `switch` だった所を、**帯の定義の hook の呼び出し**に置き換える(`.type === '…'` の数は、`rules.ts` 90、`spotlight.ts` 21、`layout.ts` 23、`layout-metrics.ts` 12、`locations-map.ts` 11、`emit.ts` 10)。

| hook | 今の場所 | 用途 | 既定 | 層 | 移す段階 |
|---|---|---|---|---|---|
| `uses(data) → {tones, lines, legendKeys}` | `rules.ts:333-371, 542-552, 657-659` | 凡例と色の使用の自動集計(箱のトーン、`connect` の線・矢じり・太さ、tree / classes / bpmn の節のトーン、cause の役割、fta の記号、emblem / 表の行のトーン) | 使わない | 公開 | 帯ごと(M1〜) |
| `edges(laid) → {from, to, points}[]` | `rules.ts:831-833`(`routedBands`)、`860`(`causeBandsOf`) | 経路・交差の規則 | 辺なし | 公開 | M6(図式) |
| `defsNeeded(laid) → {arrow?, dimArrow?, strongArrow?, mono?}` | `emit.ts:24-66` | 矢じりのマーカー、等幅フォントの宣言(cycle / concentric / legend / sequence / row の矢印、表のセル) | 何も要らない | 公開 | M1〜 |
| `prepare(data, io) → Promise<data>` | `image-file.ts`、`math`、`today-auto.ts`、`fillScaleLimit`(`text-bands.ts`) | 非同期の前処理(画像の読み込み、数式、`today: 'auto'`) | 何もしない | **内部**(ファイル・MathJax を使うため。プラグインの純粋の約束に反する) | M2(`image` / `math`)、M4(`gantt`) |
| `metrics(laid) → {…}` | `budget.ts:34-49`、`layout-metrics.ts:89-210` | スライドの予算と設計の指標(箱・グループ・行・grid・quadrant のセルの列挙) | 帯全体の長方形 1 つ | **内部** | M2〜M4 |
| `semantics(laid) → {headline?, stat?, title?}` | `rules.ts:802, 966-989` | 見出し・題・stat の意味 | なし | 公開 | M1(`caption` / `box` / `banner`) |
| `fitKnobs(laid)`(`fitApplied` / `densityRestored`) | `rules.ts:1034-1047` | 当てはめの調整の報告 | なし | 内部 | M2 |
| `parts(laid) → {id, rect, reveal?}[]` | `spotlight.ts:86-171`、`reveal` | **コアの帯の**部品ごとのスポットライトと reveal(bars / chart / quadrant / flowShape / 行)。外部の帯は帯全体(D2) | 部品なし(帯全体) | 内部(外部の帯には出さない。`env.focus` の予約はそのまま) | M2〜M4 |
| `locations(laid) → {item, rect}[]` | `locations-map.ts:56-121` | 部品ごとのソースの位置(gantt / screens / grid / areas) | 帯全体 | 内部 | M3〜M4 |
| `patchKeys` | `dsl/rewrite.ts:24-31`(`KEYS` / `NO_REVEAL`) | `rewrite()` が書き換えてよいキー | `['reveal', 'until']` | 公開 | M1〜 |
| `loopBack(laid)` | `loop-back`(row / chevron) | 戻りの矢印の規則 | なし | 内部 | M3〜M4 |
| `planSpan`(出力形式の adapter。D6) | `pptx/slide.ts:56-67` | 入れ子の枠を、後ろに続く帯の数 `span` でまとめる | なし | 出力形式の側 | U7 |

`.type === '<リテラル>'` が**帯のフォルダとコア所有の帯の外にある**ことを禁じる検査(grep のテスト)を、M7 で有効にする。それまでは、残っている数を PR ごとに減らす。

### D3. 入口とパッケージの構成 — 中核、帯ごと、出力形式、バックエンド

**推奨(Q4)**: `package.json` の `exports` に入口を足し、**`"sideEffects": false`** を入れる(今は指定なし)。既存の入口は**互換のため残す**(全部入り)。

| 入口 | 中身 | 備考 |
|---|---|---|
| `svg-diagram/core` | パイプライン(測定 → 配置 → 検査 → 描画)、`BandDef` と帯の値の型、`connect`、検査の枠組み、重ねの枠組み、トークン、文字の配置、`pluginBands`、**コア所有の帯の定義**(`caption`・`status`・`legend`・`spacer`・`connect`・`group`。D4) | **コア所有でない帯を import しない**。純粋(`node:*` なし)。**`[DEF]` だけを通して呼ぶ**(表のフォールバックは持たない) |
| `svg-diagram/core/internal` | 内部層の環境(`CoreLayoutCtx`。D2a)と、内部層の hook | **コアの帯だけが使う**。プラグインには出さず、semver に含めない |
| `svg-diagram/bands/<名前>`(`box`、`row`、`group`、`comic`、`gantt` …) | 帯の `BandDef` と DSL の構築関数 | 他の帯を import しない(共有は `core` か、小さな共有モジュールだけ)。**1 帯 1 入口** |
| `svg-diagram/compose/<名前>`(`versus`、`hero`、`icon-row`、`canvas`) | **自分の型でもコア所有の型でもない帯を作る関数**(composer。D4)。どの帯の入口を import してもよい | 帯は composer を import しない。`lib/compose/*.ts` に置く |
| `svg-diagram/bands`(まとめの入口) | 全部の帯の再エクスポート | `"sideEffects": false` の前提でのみ使う便宜の入口 |
| `svg-diagram/measure/browser`、`svg-diagram/measure/node` | 測定器(ブラウザの `svgMeasurer` / `canvasMeasurer` 3 KB、Node の HarfBuzz 83 KB ほか) | バックエンド(D7) |
| `svg-diagram/pptx`、`svg-diagram/pptx/bands/<名前>` | PPTX の書き出しの枠(zip、パッケージ、スライド、コネクタ、テンプレート)と、**帯ごとの adapter** | 出力形式(D6) |
| `svg-diagram/xlsx`、`svg-diagram/xlsx/bands/<名前>` | Excel の書き出し(ADR 0068)と、帯ごとの adapter | 同上 |
| `svg-diagram/html`、`svg-diagram/html/bands/<名前>` | HTML の書き出しと adapter | 同上 |
| `svg-diagram/png` | PNG(`resvg`) | バックエンド |
| `svg-diagram/spec`(`renderSpec(spec, {parts})`)、`svg-diagram/spec/edge` | JSON の spec の入口。**使う部品(`PartDef`)を渡す**(D9) | 全部入りの一覧も出す(下) |
| `svg-diagram/spec/parts/<名前>`(`chart`、`raci`、`board` …) | 部品の `PartDef`(schema、example、`build`、使う帯の定義)。**1 つの部品が複数の帯を使ってよい。1 つの帯を複数の部品が使ってよい** | 帯の入口とは別。部品を import すると、使う帯の入口を引く |
| `svg-diagram`、`svg-diagram/browser`、`./render`、`./pptx/edge` ほか(**今の入口**) | **全部入り**。全部の帯と、全部の adapter、全部の帯の一覧 | 互換。大きさは今と同じ(増やさない。予算) |

- **全部入りの入口は、`core` + 全部の帯 + 全部の adapter** を束ねる薄い入口として作る(中身は同じコード。重複しない)。
- 帯の入口と `core` の依存の向きは**一方向**(帯 → core)。`test/band-boundaries.test.ts`(新しい検査)が、`core` のモジュールが帯のモジュールを import していないこと、帯が**コア所有でない**他の帯を import していないことを見張る(`test/core-purity.test.ts` の仲間)。
- 型の互換: 全部入りの入口は、今の `Band` / `LaidOutBand` の合併型を**そのまま出す**(利用者の型は変わらない)。`core` の中は、帯を**型で列挙せず**、`BandValue` を一般に扱う(D5)。

### D4. 帯の値から呼ぶ — コア所有の帯、定義の付与、コピー、注入する派生の表

- **`core` は `[DEF]` だけを通して呼び、定義が無ければ投げる。表のフォールバックは `core` に置かない。** 移行の間の表(`LAYOUT_HANDLERS` など。未移行の帯用)は、**全部入りの入口が `withLegacyTables(corePipeline, tables)` で注入する**。**注入は純粋な関数**: **新しいパイプラインのオブジェクトを返し**、モジュールの最上位で `core` の状態を書き換えない(それは「import の副作用による登録」で、`sideEffects: false` で落ち、2 つのコピーや部分的な表を注入するテストが互いに漏れる。ADR 0074)。全部入りの入口は、**束縛した関数を export する**(`export const renderInBrowser = pipeline.renderInBrowser`)。**U1a のテスト: `svg-diagram/browser` を、`sideEffects: false` で esbuild と Rollup の両方で束ね、未移行の帯を描いて、描けること。**そうしないと、`core` が全部の表を import し、`core + bands/comic` の束が全部の未移行の帯を引き続ける(背景のケース E: 表が**使われている**と、`sideEffects: false` でも 821〜1034 KB)。**U1 のテスト: `core` を単体で束ね、metafile に帯のモジュールが 1 つも無い。**
- **コア所有の帯(core-owned bands)**: `core` が**自分で作る**、または他の帯が**中で作る**帯。`core` が定義を持ち、import してよい(`core` の大きさに数える):

  | 帯 | `core` が作る / 使う場所 |
  |---|---|
  | `caption` | 図の題と出典行(`withTitleLine` / `withSourceLine`、`layout-util.ts:212-217`、`layout.ts:89`、`layout-measure.ts:144`)、`group` の題(`groupTitleBand`、`layout-handlers.ts:196`) |
  | `status` | 状態の帯(`status.ts:16`) |
  | `legend` | 自動の凡例(`rules.ts:439`。`layout-handlers.ts:362` が新しい物を push する) |
  | `spacer` | 余白(`layout`) |
  | `connect` | `Band` の一員で、配置・描画の枠組みが直接扱う |
  | `group` | `row()` / `areas()` が、箱でない子を包む(`dsl/containers.ts:67, 212`)。入れ子の枠。**`bands/row`・`bands/areas` が `bands/group` を import する関係を、コア所有にして解く** |
  | `row`(**配置済みの行の包み**) | `grouprow` と `areas` が、箱の子ごとに `{type: 'row', …}` を push する(`layout-handlers.ts:409, 475`)。その要素の描画・検査・当てはめ・目録に `row` の定義が要る。**配置済みの行の包みを、コア所有の定義にする**(`bands/row` の DSL は、その定義を使う) |

  **箱の機構は `core` に残る**: `caption`(コア所有)は、`box` / `banner` と同じ `layoutBoxLikeBand` / `ctx.placeBoxLike` で配置され、`group` の題も `ctx.placeBoxLike(caption)` を通る(`layout-handlers.ts:136, 196, 858-860`)。**`placeBoxLike` と箱の文字の配置は、`core` の共有の内部の補助関数**(`box`・`caption`・`banner`・`group` の題が使う)として残し、`bands/box` は**薄い定義(内部層の hook でその補助を呼ぶ)+ DSL**になる。`core` の大きさの予算に、この補助を含める(D12)。

  **3 つ目の種類: composer(構成関数)**。**規則(機械的に言える)**: 「**自分の型でも、コア所有の型でもない帯を作る関数は、`compose/*` に置く**」。境界の検査が、import の関係(`compose/*` が帯の入口を import する)から確かめる。今の `dsl-pure.ts` の関数を、この規則で分けると次のとおり(ラウンド 5 のレビューで確認):

  | 関数 | 返す物 | 置き場 |
  |---|---|---|
  | `callout`・`bracket`・`branch`(`lib/dsl/connect.ts:37-63`) | 1 つの `ConnectBand`(コア所有の `connect`) | **`connect` の構築関数**(コア) |
  | `stat`(`dsl/text-bands.ts:71-72`) | `BoxBand` | **`bands/box`** の構築関数 |
  | `stateMatrix`(`dsl/sequence-table-swimlane.ts:201-206`) | `ScreensBand`(`type: 'screens'`) | **`bands/screens`** の構築関数 |
  | `versus`(`group`・`row`・`spacer`・`connect`。`lib/versus.ts`) | 複数の型の帯 | **`compose/versus`** |
  | `hero`(`banner`・`caption`・`stat`・`row`。`lib/hero.ts`) | 同上 | **`compose/hero`** |
  | `iconRow`(`dsl/containers.ts:146`。箱の子を持つ行) | `row` と `box` | **`compose/icon-row`** |
  | `canvas`(`dsl/qc-semantic.ts:136`、`canvas.ts:252`。`box` の格子) | `grid` と `box` | **`compose/canvas`** |

  **composer は `svg-diagram/compose/<名前>` の入口**に置き、**どの帯の入口を import してもよい**(依存は一方向: composer → 帯)。**tree shaking**: composer を import したときだけ、それが使う帯が束に入る(`hero` を使わなければ `banner` / `stat` の束への混入は無い)。**今は、composer が帯と同じファイルにある**(`iconRow` は `dsl/containers.ts`、`canvas` は `qc-semantic.ts`)ので、**境界の検査を有効にする前に、`lib/compose/*.ts` へ移す(M0a の「純粋な移動」。golden は不変)**。`PartDef`(D9)は composer の上に作ってよい。

  **境界の検査**: 「`core` は、コア所有でない帯を import しない」「帯は、**コア所有でない**他の帯を import しない」「**composer**(`compose/*`)は、どの帯を import してもよい。帯は composer を import しない」「**`spec/parts/*` は、帯ごとの入口と `compose/*` の入口を import し(全部入りの樽 `dsl-pure.ts` は import しない。`spec-parts/r5.ts:3` の現状を直す)、帯と composer は `spec/parts/*` を import しない**」「**パイプラインを内部で呼ぶ物**(`renderComic`、`pptx-edge`、`spec-edge`、`render-source`、markdown、デッキ)は、`web.ts` のパイプラインを import せず、**パイプライン(コア単体のもの、または表を注入したもの)を渡される**。**M1 までは、`comic` に `[DEF]` が無いので、`renderComic` には表を注入したパイプラインを渡す**」(`test/band-boundaries.test.ts`)。
- **配置した帯にも定義が付く**: ホストは、**帯の `layout` が push した配置済みの要素の全部に `[DEF]` を付ける**。帯の値をそのまま広げた物は引き継がれる。**新しく作った物**(例: `layout-handlers.ts:362` の `{type: 'legend', …}`)は、**コア所有の定義**(その型の定義)を付ける。プラグインの `laid` は、そのプラグインの定義。これで、`emit` は常に自分の定義を見つける(描画の段で「定義が無い」は起きない)。
- **`[DEF]` の持たせ方**: **列挙できるシンボルのプロパティ**(`SOURCE` と同じ。`Symbol.for` ではなく、**版つきのキー** `Symbol.for('svg-diagram.def/<core の API の版>')` にし、別の版の core の定義が混ざったら、両方の版を名指ししたエラー。**検出の方法**: 帯の `Object.getOwnPropertySymbols` を調べ、**説明が `svg-diagram.def/` で始まるシンボル**のうち、この core のキーと違う物があれば、その版を名指す。**同じ API の版で、パッケージの版だけが違う 2 つの core は、同じキーを共有する**が、これは**受け入れる**(契約は API の版)。理由: 帯のコピーは `{...band}` が **lib に 42 か所**あり、非列挙だと**黙って落ちる**(列挙なら引き継がれる)。代わりに、**`assert.deepEqual`(`node:assert/strict`)が列挙できるシンボルを比べる**ので、帯のリテラルと比べるテスト(`type: '…'` を含む `deepEqual` が **18 ファイル 153 行**)は、**`plain(value)` の補助関数**(`[DEF]` を除く)を通す。**`plain()` は再帰する**: 帯は `children`、`d.bands`、`laidOut` の配列に入れ子になり、`deepEqual(d.bands, […])` は入れ子のシンボルも比べるので、**入れ子の配列とオブジェクトの全部から `[DEF]` を除く**。帯に対する `deepEqual` が `plain()` を通していないものを検出する lint(またはテスト)を足す。この補助は U1a で足す。`cloneData` / `detachData` は、シンボルのキーを落とす(`dsl/diagram.ts:120-125`)ので、**`[DEF]` を `SOURCE` と同じく参照で引き継ぐ**ように直す。`structuredClone` と JSON は `[DEF]` を落とすので、**配置の結果は `[DEF]` を持たない plain データを別に出し**、描画の段は、**型の名前から定義を引き直す**(渡された一覧。D9)。1 つの `copyBand` に集め、U1a に「全部のコピー経路で `[DEF]` が残る」テストを置く。**`[DEF]` を持たない帯のリテラル**(利用者やテストが手で書くオブジェクト `add({type: 'box', …})`、JSON の `DiagramData`、`rich.ts:98` が書く `{type: 'box', ...opts}` の展開)は、**全部入りの入口の `add()` と描画の入口が、`type` から `ALL_BANDS` の定義を引いて `[DEF]` を補う**(互換)。**`core` 単体は、補わずに投げ、取り込むべき帯の入口の名前を言う**(「`box` の定義がありません。`svg-diagram/bands/box` を import して `box()` で作ってください」)。
- **帯の中身を見る帯をまたぐ処理は、`switch` をやめ、帯が返す一般のデータで書く**(D2b)。得るもの: `core` が帯を知らなくてよい。失うもの: **帯の種類ごとの網羅的な `switch`(コンパイラが抜けを教える)が、hook の呼び出しになる**(D5)。
- **`located.ts` は、`CHILD_BANDS` ではなく、定義の `children` を使う**(`located.ts:12`。(B) の表の 27 行目)。
- **移行の間の「注入する派生の表」**(D10): 移した帯を表から外し、全部入りの入口が、**定義の一覧から表を作り直して**注入する。**移した型が、表に行を残していたら落ちるテスト**を U1a に置く(二重の呼び出しと、ずれを防ぐ)。移行が終わったら、中央の表と `ALL_BANDS_*` と注入の仕組みを消す。

### D5. 型 — 全数性は表から `BandDef` へ移る。何を得て、何を失うか

**推奨(Q1)**:

- **帯ごとの全数性は `satisfies BandDef<D, L>`**: 必須の hook が 1 つでも抜けた帯は、その帯のファイルでコンパイルが落ちる。**表(A)の `satisfies {[T in …]}` と同じ強さが、帯の側に移る**。
- **全部入りの入口は、「`Band['type']` の全部に定義がある」を型で守る**: `const ALL_BANDS = {box: boxDef, …} satisfies {[T in Band['type']]: BandDef}`(全部入りの入口だけにある 1 つの表)。**コアの帯を足して定義を作り忘れると、全部入りの入口でコンパイルが落ちる**。`core` はこれを import しない。
- **失うもの**: (1)**`core` の中の網羅的な `switch`**は、hook の呼び出しになる。「この帯の種類にこの hook を足し忘れた」は、**型の必須の hook**と、**任意の hook の既定**(D2b)で守る。(2)**帯をまたぐ規則**は、他の帯の中身を型で見られない。**一般のデータと hook(D2b の `uses` / `edges` / `defsNeeded` / `parts` / `locations` ほか)で書く**。(3)`RuleId`(コンパイル時に閉じた規則の id)は、**全部入りの入口でだけ合成する**(`core` は規則の id を `string` で扱う)。
- **構築関数の戻り値の型は、今の帯の型に代入できる**: `BandValue<T> = Extract<Band, {type: T}> & {readonly [DEF]: BandDef}`(`T` はコアの帯の型の名前)。**`box()` の戻り値は、今までどおり `BoxBand` に代入できる**(利用者が `BoxBand` などの型で注釈している)。全部入りの入口は、**今の帯の型の名前(`BoxBand`、`RowBand` …)を全部そのまま出す**。`Declares<Id>` は戻り値の型で運ぶ: `BandValue<'box'> & Declares<Id>`。最上位・`group`・`row`・`areas` の中で通り、裸の綴り間違いは拒まれる(スパイクで確認)。**ドット付きの部品の id(`rate.s2`)は型では検査されず、実行時だけ**。
- **外部の帯の型**: 外部の帯は、**コンパイル時に知らない**。`Band` の合併型には入らず、`BandValue<string>` として流れる。コアの帯は今までどおり合併型にいる。ラウンド 1 の確認: 実際の合併型に封筒を足すと壊れるのは 10 個の表(と派生の行)だけだった。**`BandDef` の方式では封筒の帯の種類は不要**。
- **コンテナ**: 外部の帯は**他の帯を持てない**。**ただし `group` / `grouprow` / `areas` / `row`(箱でない子は `group` に包まれる)の子にはなれる**(スパイクで描け、型も通る)。**`grid` は箱だけ**なので入れない。ADR 0078 の `FlowBand`(`Exclude<Band, OverlayBand>`)に含まれ、重ねの帯にはならない(v1)。

| 案 | 採らない理由 |
|---|---|
| (採用)`satisfies BandDef` + 全部入りの入口の 1 つの表 | 帯ごとの全数性が残る。`core` が帯を知らない。全部入りでコアの帯の抜けを落とせる |
| 中央の表の全数性を残し、ただ入口で分ける | 表が全部の帯を import するので、束ねが分けられない(背景) |
| モジュールの拡張(`declare module` の `BandRegistry`) | 型が**グローバル**になる(2 つの版が共存できない) |
| `Band` を開いた型(`${string}:${string}` のテンプレート型) | 表が `Band['type']` をキーにするため、全数性が崩れる |

### D6. 出力形式(PPTX・Excel・HTML)は別の入口。帯ごとの adapter は出力形式の側に置く

**推奨(Q5)**:

- **`BandDef` に出力形式のコードを入れない。** `svg-diagram/pptx`、`svg-diagram/xlsx`、`svg-diagram/html` が書き出しの枠(zip、パッケージ、スライド、シート、コネクタ、テンプレート)を持ち、**帯ごとの adapter**が `svg-diagram/pptx/bands/box` のように隣に置かれる。**adapter は、定義への参照(`def`)をキーに、帯の値から選ばれる**。
  ```ts
  import {toPptx} from 'svg-diagram/pptx';
  import {pptxBox} from 'svg-diagram/pptx/bands/box';
  import {pptxRow} from 'svg-diagram/pptx/bands/row';
  const pptx = await toPptx(d, {bands: [pptxBox, pptxRow]});     // 使う adapter だけを渡す
  ```
  `adapter = {def: boxDef, toPptx(laid, ctx) → XML}`。出力の枠は、`Map<BandDef, adapter>` を呼び出しごとに作り、各帯で `band[DEF]` から引く。**adapter を import しなければ、その帯の PPTX のコードは束ねられない**。全部入りの入口(`./pptx/edge` ほか)は、**全部の adapter を渡す**(互換)。
- **adapter が無い帯の既定(帯ごとに決める。黙って落とさない)**:

  | 形式 | 既定 | 報告 |
  |---|---|---|
  | PPTX | **絵**(帯の `emit` の SVG を、画像として貼る。`'image'` と同じ経路) | `findings` に `pptx-band-fallback`(情報。帯の型名つき)。`strict: true` ならエラー |
  | HTML | **インラインの SVG**(今すでに `native` でない帯の既定) | `html-band-fallback`(情報) |
  | Excel | **シートにしない**(帯を飛ばし、「図のこの部分は表にできない」と言う)。ADR 0068 D2 の「しない」と同じ | `xlsx-band-skipped`(警告)。`strict` ならエラー |

  **「adapter 無し」は、帯の `emit` を通る**ので、PPTX の絵の経路は、**使われた帯の描画のコードだけ**を引く(今は PPTX が共有の SVG 描画 110.7 KB を全部引く。上の測定)。
- **今の分岐の移し方**(上の測定): `lib/pptx/bands.ts` の `BAND_HANDLERS` は帯ごとに 1 行の表で、**そのまま adapter の表に分けられる**。`slide.ts` の `group` と `swimlane` の入れ子の枠(後ろに続く帯の数 `span` でまとめる 3 か所)は、**その帯の adapter の hook**(`planSpan`)に移す。`geom.ts` と `svg-shapes.ts` は帯の種類で分岐していない(コネクタと矢じりの図形名)ので、出力の枠にそのまま残る。`emit-html.ts` の 16 か所(`native(b)` と各帯の変換)は、同じ形で adapter に分け、既定の「インライン SVG」はそのまま。**どれも構造の作り直しは要らない**。
- **絵のフォールバックは無料ではない**(ラウンド 3 のレビュー): PPTX の絵は、PNG の代替画像(`rasterize` の port。`pptx-edge.ts:20`、`pptx/emit.ts:25` の resvg)と、文字の輪郭化(`svg-outline.ts` と文字のエンジン。`pptx-edge.ts:68-70`)を要る。**`svg-diagram/pptx` はこれを ports として受け取り**(resvg と HarfBuzz を直接 import しない)、全部入りの入口が実装を渡す。「箱・行 + PPTX」の予算には、**ports の実装を含めるか**を明記する(Node では resvg と測定器は外部の依存で、束に入らない)。
- **共有の `boxXml` は `pptx` の中核**に置く(`pptx/tree.ts:120`、`states.ts:56`、`cause.ts:96` の書き出しも使うので、`pptx/bands/box` に入れると、他の adapter が `bands/box` の adapter を import することになる)。
- **デッキの読み込みが PPTX を引く**: `lib/deck-load.ts:119-120` の `figureMinPt` が `planSlide` を呼ぶので、`deck-load` を import すると PPTX が付いてくる。**文字の大きさの下限の計算を小さな共有モジュールに出し**、PPTX を引かないようにする(U1b)。
- **Excel(ADR 0068)**: 0068 の D2(帯の種類ごとに「シートにする / 子をたどる / しない」の表)は**コードがまだ無い**ので、**最初から adapter の形で書く**(`xlsx/bands/gantt` ほか)。0068 の D1(元は**入力のデータ**で、レイアウトの結果ではない)は変えない: `xlsx` の adapter は、`BandDef.build` の `data` を読む。0068 の D8(zip と圧縮は PPTX と共有)は、**共有の小さな入口**(`svg-diagram/zip`)にする。**0068 の改訂が要る**(Q13。0068 の PR #373 の後ろに、この方針を書く)。
- **プラグインの出力形式の adapter は、別に出せる**(`manga-face/pptx` など)。プラグイン本体は出力形式を引かない。利用者が `toPptx(d, {bands: [pptxBox, mangaFacePptx]})` のように渡す。adapter の無い外部の帯は、上の既定(絵)。
- **PNG**は出力形式ではなく、SVG の後段(`svg-diagram/png`。`resvg`)。

### D7. 重いバックエンドも入口の後ろ

**推奨(Q4)**: 上の測定の重い物は、**入口を分け、必要な利用者だけが引く**。

| 部品 | 今 | 新しい入口 / 扱い |
|---|---|---|
| ブラウザの測定器(3 KB) | `lib/web-measure.ts`(`./browser` から) | `svg-diagram/measure/browser` |
| Node の測定器(83 KB、`harfbuzzjs`、`playwright-chromium`、`node:child_process`) | `lib/measure.ts`。**パッケージの入口 `.` が引く** | `svg-diagram/measure/node`。**`.` は測定器を引かない**(CLI と `./render` は明示的に引く)。互換: `.` は今までどおり動かすため、全部入りの `.` は引き続き引く(予算の対象)。軽い入口を別名で出す(`svg-diagram/core`) |
| PNG(100 KB、`@resvg/resvg-js` ネイティブ) | `lib/raster.ts`(`measure.ts` から引かれる) | `svg-diagram/png`。測定器を引かない形に分ける |
| フォント | **JS には埋め込まれていない**(`font-subset.ts` はファイルを読む。`font-box.ts` は HarfBuzz で測る) | 変えない。埋め込み(base64)は、この ADR の範囲外。**入れるなら出力形式 / バックエンドの入口の後ろ**(`svg-diagram/fonts/<名前>`)の規則だけ決める |
| MathJax(peer、`math()` の帯) | `math` 帯が使う。ブラウザの入口では投げる | `bands/math` の中だけが引く(動的 import)。他の帯は引かない |
| Playwright(peer、スライドの予算の実測、`cdp-browser`) | 測定器とスライドの予算が引く | Node の入口の後ろ。ブラウザの入口には無い |
| `sixel`(端末の表示) | `show` の CLI | CLI の入口の後ろ |
| `harfbuzzjs`(WASM) | Node の測定器 | `measure/node` の依存 |

**ブラウザの Artifact でマンガだけを描くなら、`core` + `bands/comic` + `measure/browser` だけ**を引く(見積もり 230〜250 KB。`rules.ts` を分ければ 200〜215 KB。D12)。`pipeline.ts` が HTML の出力を全部引く問題(上の測定で 306 KB)は、**HTML を `svg-diagram/html` に出し、パイプラインは SVG だけ**にして直す(U の `core` の切り出しの一部)。

### D8. 安全 — 外部の帯(プラグイン)はコード。JSON はコードを読み込まない

コアの帯と外部の帯の**唯一の違い**は、この節の安全の約束(と `id:kind` の名前)である。

1. **spec(JSON)は、コードを読み込まない。** 呼び出す側(DSL を書く人、CLI の `--plugin`、プロジェクトの設定、サーバーの設定)だけが、帯の一覧(D9)を渡す。spec にできるのは、渡された帯の名前を名指しすること。`import()` の URL も、パスも、spec には書けない。
2. **MCP は、サーバー側の許可リスト**。サーバーは、ビルド時に**静的に** `import` したプラグインのうち、設定で有効にした物だけを `renderSpecEdge` に渡す(静的 import なので、使わないプラグインは Worker の束にも入らない)。`specSchemaFor({parts})` と `list_diagram_parts` は**許可した物から**作る。既定は**プラグインなし**(コアの帯だけ)。有効にするのは、権利と品質の確認のあと(Q12)。
3. **外部の帯の SVG は、外部の SVG と同じ門(本物の `sanitizeBody`)を通る。外部かどうかは「出どころ」で決まる**(D2a の信頼。定義が自分で立てる `nodeIds` などの項目では決まらず、外部が `nodeIds: 'self'` / `rectsQualified` / `internal` を立てれば拒まれる)。 ホストは `sanitizeBody(svg, where, /*allowColor*/ true)` を呼ぶ。`sanitizeBody` が認めるのは、図形(`path` / `circle` / `ellipse` / `rect` / `line` / `polyline` / `polygon`)、グループ、`defs`、グラデーション、クリップパスと、許可した属性だけ。**`data-*` 属性も拒む**ので、`data-node` はプラグインに書かせず、**ホストが `anchors` から書く**。`text`・`style`・`script`・`use`・`image`・`foreignObject`・`mask`・`filter`・外への参照・名前つきの色・`rgb()` は拒まれる(スパイクで確認)。加えて、ホストが **1 つの帯の中の id の重複**を拒む。通らない出力は、`band-svg-rejected`(エラー)で、帯の場所にプレースホルダー(破線の長方形)を描く。**文字は `texts` の経路(D2)でコアが描く**。**コアの帯は、今までどおり自分で `<text>` を出してよい**(信頼する)。
4. **id は衝突しない**(D2)。
5. **外部の帯の中の失敗は、壊れた出力にしない。** hook が投げたら、ホストが**プラグインの名前・帯の種類・段階(build / measure / layout / emit / verify)を付けて**包む(`BandError`)。**`layout` は、結果を最後まで求めてから** `ctx`(カーソル、anchor の登録)を変える。`check` / `renderDiagram` / `renderInBrowser` の経路では、投げずに `band-failed`(問題)として verdict に入れ、その帯は**高さ 48px の破線のプレースホルダー**で描く(今の `renderInBrowser` の「配置のエラーは投げる」を、外部の帯に限って変える。U4 で明記する)。DSL の構築(`build`)は、今までの DSL と同じく投げる。
6. **資源**: 1 つの帯の SVG と anchor の数に上限(D2 の 6)。同期の関数だけ(`async` の hook は不可)。**止まらない同期の hook は、コアには止められない**: Worker では CPU の上限で、Node では呼び出しの側のタイムアウトで終わる(サーバーに載せるプラグインを許可リストで限る理由の 1 つ)。
7. **規則と `--strict`**: 帯は、自分の `rules` に宣言した規則だけを出せる。`diagram({accept: {'rating-demo/value-over-max': '理由'}})` で、コアの規則と同じく受け入れを書ける。`check --explain rating-demo/value-over-max` は、プラグインが渡されている(`--plugin` か設定)ときに説明を出す。

### D9. 帯の渡し方 — 呼び出しごと(グローバルにしない)+ プロジェクトの設定。spec の入口

**推奨(Q6、Q7): 呼び出しごと。グローバルの登録簿は作らない**(ADR 0074 D3)。DSL では、**使う帯を import するだけ**(帯の値が定義を持つので、登録も一覧も要らない)。一覧が要るのは、**帯の値を持たない入口**(JSON の spec、`DiagramData` の JSON、デッキ、markdown の囲み)だけで、そこには**帯の一覧(`bands`)**を渡す。

- **spec(JSON)**: `renderSpec(spec, {parts: [flowchart, board, comicSheet]})`(最小の経路。**部品(`PartDef`)を渡す**。部品が使う帯の定義は、部品が連れてくる)。`parts` を渡さないときの既定は**空**(明示を要求する)。**全部入りの入口(`svg-diagram`、`./spec/edge`)は、65 部品を既定で渡す**(今までの呼び出しがそのまま動く)。外部のプラグインは、`parts` と `bands` を持ってよい(`{parts, plugins}`)。`DiagramData` の JSON は、`bands` の一覧から型の名前で定義を引き直す。
- **spec が名指しした帯が、渡されていないとき**は、**黙って捨てない。黙って箱にもしない**。次の形の**明確なエラー**(コアの帯も外部の帯も同じ)。
  ```
  the band type "rating-demo:stars" is not available: plugin "rating-demo" was not supplied
  (pass it as diagram({plugins: [...]}) / renderSpec(spec, {parts: [...]}) / --plugin / the project config; a spec never loads code).
  Available: box, row, group, comic
  ```
  (日本語の版も出す。)`validateSpec` では `SpecIssue`(`path: parts[2].type`)として返り、LLM が直せる。MCP では、**使えるものの一覧**を返す。
- **プロジェクトの設定の `plugins`**(`.svg-diagram.json`。`lib/config.ts`): 例 `{"plugins": ["./plugins/rating-demo.ts", "manga-face"]}`。呼び出しのコードを持たない入口が**読み込んで** core に `bands` / `plugins` として渡す(core は読まない。ADR 0031 の殻の仕事)。パスか npm の名前。読み込みの失敗はエラー。呼び出しの指定は設定を**上書き**する。設定は呼び出す側の持ち物で、spec ではない(D8 の 1)。

| 入口 | 渡し方 |
|---|---|
| DSL(`.ts`) | 使う帯を import する。外部の帯は `pluginBands(plugin)` で作り、`diagram({plugins: [plugin]})` に渡す(構築関数の定義と食い違えばエラー) |
| `renderSpec` / `specToDiagram` / `validateSpec` / **`renderSpecEdge`**(MCP の Worker) | `{parts, plugins}`。Worker は、ビルド時に静的に import した許可リストを渡す |
| ブラウザ | `renderInBrowser(diagram(…), {measure})`(図が帯の値を持つ)。`DiagramData` から直接なら `{measure, bands}` |
| `renderComic` | `renderComic(sheet, {measure, characters, plugins})`(D11) |
| CLI のうち `.ts` を読む物(`build` / `check` / `show` / `lint` / `notes` / `pptx`) | 図の `.ts` が自分で帯を import する |
| CLI のうち JSON / Markdown を読む物(**`pptx-deck`、`serve`、`site`、`md`、`deck`**) | `--plugin ./x.ts`(繰り返し可)と、設定の `plugins`。**帯の一覧は、全部入りを既定**にし、最小にしたいときは設定で `bands` を絞る |
| `check --drift --jobs N` の**子プロセス**(`drift-pool.ts`) | 親の `--plugin` と設定を**子に渡す**(渡さないと、子が未供給のエラーになる) |
| `./render`、`./markdown`、`./markdown-it`、`./remark`、`./vitepress` | オプションの `plugins` と設定。囲みのコードブロックは設定を使う |
| デッキ、`site`、PPTX の edge(`./pptx/edge`、`./pptx/deck/edge`)、VS Code の拡張のプレビュー | 設定の `plugins`。PPTX の edge には呼び出しの `plugins` も通す |
| 静的な `./schema/*.json` | **プラグインを含まない**(コアの帯だけ。生成物)。**プラグインを含むスキーマは `specSchemaFor({parts, plugins})` だけ** |
| `worker/`(発表の配信) | 描画しないので、何も要らない(ADR 0056) |

**キャッシュにはプラグインの版を入れる**: (1)デッキの描画のキャッシュ(`lib/present/render-deck.ts` の、スライドの JSON と設定の sha256)、(2)drift のキャッシュ(`drift-cache.ts`)、(3)`check --drift --jobs` の子プロセス。**プラグインの id と `version` を、キーに混ぜる**(混ぜないと、プラグインを更新しても古い出力が使われる)。

### D10. コアの帯を `BandDef` に移す — これが主線(以前の案の Q7「移さない」を**逆にする**)

**推奨(Q2、Q3):**

**以前の案(ラウンド 1〜2)は「コアの帯は移さない」(コンパイル時の全数性を失うため)だった。決める人の要件(使う帯だけを束ねる)は、中央の表が全部の帯を引くことが原因なので、移行が主線になる。** 全数性は `satisfies BandDef` と全部入りの入口の表(D5)で保つ。

**進め方(1 帯 1 PR。golden はバイト単位で同じ):**

| 段階 | 内容 | 帯 |
|---|---|---|
| M0a | **型と枠組み**(U1a)と、**composer の `lib/compose/*` への純粋な移動**(golden 不変): `BandDef`、帯の値と `[DEF]`(列挙できる、版つきのキー)、`copyBand`、`plain()`、**注入する派生の表**(純粋な `withLegacyTables(corePipeline, tables)`。新しいパイプラインを返し、最上位で状態を書き換えない。`sideEffects: false` の全部入りの束で描けるテスト)、`[DEF]` を持たない帯のリテラルの補い(全部入りの入口)、境界の検査、`sideEffects` の監査。**追加と、composer の純粋な移動のみ**(帯は移さない) | — |
| M0b | **`core` の切り出し**(U1b): `pipeline.ts` が HTML を引かない、`rules.ts` / `dsl/text-bands.ts` / `web.ts` / `located.ts` を表から切り離す、**コア所有の帯**(`caption`、`status`、`legend`、`spacer`、`connect`、`group`。D4)を `core` の定義にする。**この PR の後、`core` は表を持たない**。`core` 単体の束に帯のモジュールが無いことを検査 | コア所有の 7 つ |
| **M1(マンガ。最初の成果)** | **`comic`**。決める人の最初の用途(Artifact が 1 MB)。**配置が純粋で(`layoutComic(band, x, y, w, widthOf)`)、公開層だけで書ける**ので、内部層を待たない。**今の重なりのない経路のまま**移す(ADR 0078 の重ね `U4` は、移した帯の上に載せる。下の注)。**公開層に足すもの(D2a): コネクタの幾何を読む `verify.check`、`rectsQualified`、`nodeIds: 'self'`、`offGrid`**。出力はバイト単位で同じ | `comic` |
| M2 | **葉の帯**(公開層で書ける、子なし) | `raw`、`banner`、`curve`、`pyramid`、`people`、`dots`、`wordart`、`math` |
| M3 | **箱**(内部層)。**`placeBoxLike` と箱の文字の配置は `core` の共有の補助関数に残し**(`caption` と `group` の題が使う。D4)、`bands/box` はアイコン・ステップ・タグの扱いを含む薄い定義 + DSL。`core` の大きさに補助を含める | `box` |
| M4 | **コンテナ**(内部層。`children` の hook、`stack`、`row()` の包み、`areas`)。**`group` は M0b で済み** | `row`、`grid`、`areas`、`grouprow`、`image`(`children`) |
| M5 | **anchor・reveal・検査を持つ図形の帯** | `flowShape` の 7 種(1 つの PR。`flow-shapes.ts` を共有)、`quadrant`、`timeline`、`gantt`、`bars`、`plane`、`chart` |
| M6 | **表・列・画面の帯** | `sequence`、`table`、`swimlane`、`wireframe`、`screens` |
| M7 | **図式の帯**(重い。専用の配置の枠組み) | `tree`、`states`、`cause`、`cloud`、`classes`、`bpmn`、`fta`、`bowtie` |
| M8 | **後片付け**: 中央の表と `ALL_BANDS_*` と注入の仕組みを消す。`rules.ts` を族ごとに分ける(D12)。**`.type === '<リテラル>'` を帯のフォルダとコア所有の帯の外で禁じる検査**を有効にする | — |

**注(M1 の順序と ADR 0078)**: レビューの指摘のとおり、ADR 0078 で `lib/comic/` を触る単位は **U4**(重なり・z-order・`comic-bubble-covers-text`)で、U2 は `OverlayBand` / `FlowBand` を足す単位。**U2 を待っても U4 との衝突は避けられず、マンガの成果が 0077 U2 → 0078 U1 → U2 の後ろに回る**。選択肢: (A)**`comic` を先に、今の重なりのない経路のまま移す**(`lib/comic/` の中で閉じており、公開層で書ける)。0078 U4 は移した帯の上に載せる(merge で追従する。衝突は `lib/comic/` の中に限られる)。(B)0078 U4 を待ってから移す(マンガの成果が遅れる)。**推奨は (A)**(Q3)。`Band` の合併型に 0078 U2 が足す `OverlayBand` / `FlowBand` は、`BandValue` の型とは独立なので、(A) の妨げにならない。

**各 PR の基準(全部を満たす):**

1. **golden がバイト単位で同じ**(`examples/out/` の SVG、PPTX の golden、`pnpm schema` の出力)。移行の PR で見た目は変えない。
2. 移した帯の**表の行を消し**、**注入する派生の表**に載せ替える。**移した型が表に行を残していたら落ちる**テスト。**行を消す前に、同じ PR の中で**、表からの呼び出しと帯の値からの呼び出しが**同じ出力**になることを確かめる(テスト。確かめたら、古い表の行は消す。消した後は「同じ結果」を比べられないので、**golden のバイト一致**で守る)。
3. **帯の入口の大きさを記録**し、予算(D12。M0 の測定の後に置く)に収まる。**帯が、コア所有でない他の帯のモジュールを import しない**(境界の検査)。付け根(`reveal.ts → band-ids.ts → quadrant.ts` のような余計な import)を、その PR で切る。
4. `rules`・`RULE_DOCS`・`RULE_LOCATION` の中身は**今の規則の id のまま**。`check --explain` が同じ。
5. 適合テスト(D2 の保証)を、コアの帯にもかける。
6. **変異**を 1 つ以上当てて落ちることを PR に書く。
7. その帯の PPTX・HTML・(あれば)Excel の **adapter** を、同じ PR か、すぐ次の PR で分ける(D6)。**表の行が出力形式の側に残る間は、移行が終わったとは数えない**。
8. D2b の hook のうち、その帯が使う物を、`.type === '…'` の分岐から hook に移す。残りの分岐の数を PR 本文に書く(M8 で 0 にする)。

**1.0 の条件(Q10)**: 「**コアの帯を N 個、golden がバイト単位で同じまま移し終え**(N の推奨は少なくとも 12。**うち、コンテナを少なくとも 1 つ(`group` はコア所有なので、`row` か `areas`)と、図式の帯を少なくとも 1 つ(`tree` か `states`)を含める**。内部層が実際にコアの帯を書ききれることを確かめるため。D2a)、**かつ**、参照プラグイン(U6)が**公開層の全部の hook を通し**、**manga-face(外部の実物。別リポジトリ、npm、jsDelivr の Artifact)が動く**」。確認表:

| hook / 性質 | 確かめる実物 |
|---|---|
| `build` / `PartDef`(spec の往復)/ `example` | 参照プラグイン(U6)、移した帯 |
| `ids` / `anchors` / スコープ / `connect()`(最上位・`group`・`row`・`areas`) | 参照プラグイン(U2、U6)、`box`、`quadrant` |
| `measure` / `texts` / `wrapText` / `band-text-unmeasured` / `roles` の拡大(`fill`・canvas・`width: 'fit'`) | 参照プラグイン |
| `emit` / 門 / id の接頭辞 / ダークモード(トークンの色、`paper`、`paper` の文字) / `selfDimming` と `dim` | 参照プラグイン |
| `verify.rects` / `check` / `rules` / `accept` / `--strict` / `contrast` | 参照プラグイン、`quadrant` |
| `inventory` / `reveal` / `nodeIds` | 参照プラグイン、移した帯 |
| D2b の hook(`uses` / `edges` / `defsNeeded` / `semantics` / `patchKeys`) | 移した帯(`box`、`row`、`tree` または `states`) |
| **内部層**(コンテナ、図式の帯) | `row` か `areas`、`tree` か `states` |
| 出力形式の adapter(PPTX・HTML・Excel)と、adapter 無しの既定と報告 | 参照プラグイン、移した帯 |
| 実在の外部の制作物(別リポジトリ、npm、jsDelivr の Artifact) | `manga-face`(U18 と ADR 0079) |
| 入口ごとの大きさの予算(D12) | 移した帯の入口 |

確認表が埋まり、`1.0` の前に Opus のレビューが収束してから、API を `1.0` にする。

### D11. 狭い拡張点 — 人物の提供元と、追加の表情(同じプラグインのオブジェクトの中)

**人物の提供元(`characters`)**。`characters: {face: {schema, make(params) → CharacterManifest}}`。`make` の結果は、**必ず `loadCharacter` を通る**(権利の必須、断片の掃除、箱とアンカーの検査。手で書いたマニフェストと同じ門)。使い方は 2 通り。

1. **関数として呼ぶ**(コアの変更なし。今でも使える): `comic(sheet, {characters: {peep: mf.characters.face.make({…})}})`。ADR 0079 の「別パッケージ + `CharacterManifest`」の形そのもの。プラグインの仕組みは要らない。
2. **spec に書く**(JSON、LLM 向け。U16): ワークシートの `cast.me.character = {provider: 'manga-face:face', params: {…}}`。`comic(sheet, {plugins})` / `renderComic(…, {plugins})` が、渡されたプラグインから解決し、`loadCharacter` に通す。**結果の人物は図ごと**(ADR 0074 D3 のまま。グローバルに持たない)。未供給なら D3 のエラー。

**追加の表情(`expressions`、任意、U17)**。`ComicExpression` は今 8 種の閉じた合併型(`EXPRESSIONS`)。プラグインは `expressions: ['manga-face:shy', …]` のように**名前空間つき**で足せる。ワークシートの舞台は `expression: 'manga-face:shy'` と書き、その表情の断片を持たない人物では `neutral` に落として `comic-expression-fallback`(助言)を出す。ADR 0079 の Q8(「追加の表情は後で」)と同じ時期に決める。コアの 8 種は変えない。

**ADR 0079 の manga-face がこれをどう使うか**: 別のリポジトリ `manga-face`(npm)が、平らなデータの `PluginDef`(`id: 'manga-face'`。`BandDef` の集まり)を出す。出力形式の adapter は別の入口で出せる(`manga-face/pptx`。D6)。

- 帯 `manga-face:avatar`: 顔 1 つ(パラメータ、表情、大きさ)。顔の生成(ADR 0079 の `face.ts`)をそのまま `layout`(大きさと anchor `head`)と `emit`(図形)に使う。
- 帯 `manga-face:faces`: 顔の一覧(見本帳、名前つき。名前は `texts`)。
- 人物の提供元 `face`: パラメータ → `CharacterManifest`(ADR 0079 の `faceManifest`)。`comic()` に渡す。
- 追加の表情(任意、U17)。

ADR 0079 は**中身の設計としてそのまま有効**(D2〜D7)。変わるのは D1 の「svg-diagram 側の変更はない」で、**svg-diagram 側に `svg-diagram/plugin`(型)と `svg-diagram/core` が入り、`manga-face` はそれを使う**。API が入る前でも、1. の関数呼びで `comic()` につながる(つまり ADR 0079 は、この ADR を待たずに進められる)。

### D12. 配布と大きさの予算 — npm、jsDelivr の Artifact、MCP、CI の検査

- **npm**: 外部のプラグインは普通のパッケージ(`manga-face`)。`peerDependencies: {"svg-diagram": "…"}` は案内で、実行時の検査は `apiVersion` と `requires`(D1)。**実行時に svg-diagram を import しない**ので、peer の版の食い違いで 2 つのコピーが動く問題が起きない。型は `svg-diagram/plugin`(型のみ)から `import type` で取る。
- **Artifact(jsDelivr)**(マンガだけを描く例。見積もり 230〜250 KB、`rules.ts` を分ければ 200〜215 KB):
  ```js
  const [{renderInBrowser, diagram}, {comic}, {svgMeasurer}] = await Promise.all([
    import('https://cdn.jsdelivr.net/npm/svg-diagram@X.Y.Z/dist/lib/core.js'),
    import('https://cdn.jsdelivr.net/npm/svg-diagram@X.Y.Z/dist/lib/bands/comic.js'),
    import('https://cdn.jsdelivr.net/npm/svg-diagram@X.Y.Z/dist/lib/measure/browser.js'),
  ]);
  ```
  外部のプラグインを使うときは `import('…/manga-face@A.B.C/dist/plugin.js')` を加え、`pluginBands(mangaFace)` で構築関数を作り、`diagram({plugins: [mangaFace]})` に渡す。**帯ごとの入口は ES モジュールのファイル**なので、jsDelivr から**使う帯のファイルだけ**が読まれる(ブラウザ側の tree shaking)。**注意: core の jsDelivr の動作確認(CDN のプローブ)は、まだ終わっていない。** Artifact での通し確認(U18)は、そのプローブが済んでから行う。生成済みの JSON(1 人分 48.7 KB、gzip 3.5 KB。ADR 0079)を貼る方法も、プラグインなしで引き続き使える。
- **供給の安全**: `import()` は SRI(`integrity`)を持てない。(1)**版は完全に固定**(`@A.B.C`。範囲や `latest` は使わない)、(2)外部の配布物は**import の無い 1 つの自己完結した ESM**にする(適合テストが `import` / `require` の文を探して拒む。jsDelivr の `+esm` の依存の書き換えは使わない)、(3)任意の追加の防御として、ページが `<script type="importmap">` の `integrity` で固定してよい。許可リストと設定は、npm の名前と版を人が決める。
- **MCP**: MCP のサーバー(別のリポジトリ `svg-diagram-mcp-plugin`)が、有効にするプラグインを**ビルド時に静的に import** して許可リストに入れ、`renderSpecEdge(spec, {bands, plugins})` に渡す(D9)。使う帯だけを `bands` に渡せば、Worker の束も小さくなる(`./spec/edge` は今 1213.5 KB)。`list_diagram_parts` は、許可した帯の部品を(プラグインなら `plugin: 'manga-face'` つきで)返す。

**大きさの予算(入口ごと、組み合わせごと、バンドラごと。CI で検査する)**(Q11):

- **見積もりの内訳(ラウンド 3 のレビューによる補正。esbuild、minify)**: 背景の「中核に残るモジュールの 81.4 KB の束」は、**残るべき枠組みの一部**にすぎなかった。`lib/web.ts` の metafile を帯と枠組みに分けて数え直すと、枠組みから HTML・帯の DSL・表・`rules.ts` を除いても **約 144 KB** になる(`layout.ts` 9.5、`canvas.ts` 13.9、`layout-connect.ts` 9.0、`layout-metrics.ts` 8.3、`dsl/diagram.ts` 6.8、`verify.ts` 4.8 と `verify-handlers` の一般の部分、`emit.ts` 3.8、`fit-width.ts` 4.9、`polyline-metrics.ts` 4.1、`layer-order-search.ts` 2.9、`orthogonal-route.ts` 2.6、`text-rules.ts` 2.5、`xml-check.ts` 2.2、`inventory.ts` 2.6、コア所有の帯 など)。そこへ、**帯をまたぐ規則の本体(`rules.ts` の一般の半分。font floor、コントラスト、凡例、トーンの使用、見出し)**を足すと **約 190 KB**。`rules.ts` は 93.2 KB(`RULE_DOCS` だけでソース 23 KB、119 規則)で、帯ごとの規則(`comicRules`、`rcaRules` …)は帯へ移る。
- **したがって、最初の成果の見込みは「マンガ + ブラウザの測定器 ≈ 190(枠組み)+ 45(マンガ)+ 3 = 230〜250 KB」**(今の 1036 KB の約 1/4)。**以前の「130〜160 KB」は楽観的**だった(試作のパイプラインは縮小版で、`connect` の経路・検査・規則・題と凡例を含まない。下限)。
- **Rollup(Vite)は esbuild より 10〜25% 大きい**(背景の表: F 44.0 vs 49.4、G 55.3 vs 64.0、E 821 vs 1034 KB)。**予算は、バンドラごとに別に置く**(esbuild と Rollup)。esbuild の数だけを予算にすると、Vite の利用者の実際の大きさを過小に見る。
- **`rules.ts` を族ごとに分けると、さらに下がる**(M8 の後片付けの一部。U15): `rules/legend`、`rules/text`(font floor、見出し)、`rules/contrast`、`rules/routing`、`rules/tone` …に分け、**帯ごとの規則と `RULE_DOCS` の該当行は、その帯の入口へ**移す。**枠組みは約 150〜165 KB**(一般の規則の核 25〜45 KB を残す)に下がり、**マンガ + ブラウザの測定器は約 200〜215 KB**になる見込み。**これも見積もり**で、M0b の測定で置き換える。分けなければ、約 250 KB が下限。

- `scripts/bundle-size.ts` が、**入口と代表の組み合わせ**を esbuild と Vite(Rollup)の両方で束ね(ブラウザ向け、minify)、`bundle-budget.json` の上限と比べる。上限を超えたら **CI が落ちる**(PR に表を出す)。**上限は「下げる方向にだけ」更新する**(移行の PR ごとに、測った値に合わせて下げる。上げるには決める人の承認)。
- **上限の数字は、M0b(`core` の切り出し)の測定の後に、バンドラごとに置く**(測った値の +10%)。今の見積もりで、置くべき項目と、**まだ満たせない**ことが分かっている組み合わせ:

  | 入口 / 組み合わせ | 今 | 見積もり(esbuild) | 予算を有効にする時期 |
  |---|---|---|---|
  | `svg-diagram/core`(コア所有の帯を含む) | — | 約 190(`rules` を分けると 150〜165) | M0b |
  | `bands/comic` | — | 約 45 | **M1** |
  | `measure/browser` | 3.0 | 3〜5 | M0b |
  | マンガ + ブラウザの測定器 | 1036 | **230〜250**(分けると 200〜215) | **M1**(そこまでは、全部入りの上限だけ) |
  | `bands/box`、`bands/row` | — | 約 16、約 10 | M3、M4 |
  | 箱・行 + ブラウザの測定器 | 1032 | 約 260〜280 | M4 |
  | 箱・行 + PPTX(Node。依存は外) | 1301 | **約 330〜380**(中核 190 + 箱・行 26 + PPTX 自身 101.6 + adapter 10 + ports) | U7 の後、M4 |
  | 箱・行 + Excel | — | 約 270〜300(**コードが無いので根拠は弱い**) | 0068 の実装の後 |
  | 全部入りのブラウザ(`./browser`) | **1042** | 1042 以下 | **M0a から**(今の +5% 以内) |
  | 全部入りの Node(`.`、依存は外) | **1081** | 同じ(+5% 以内) | M0a から |

  **帯ごと・組み合わせごとの予算は、その帯が移った後にだけ有効**(移る前は、表を引く全部入りの束なので、満たせない)。
- **消費側のバンドラでの試験**: 予算の検査は、`package.json` の `exports` を通して(`dist/` を入口にして)束ね、`sideEffects` と入口の分け方が実際に効いていることを確かめる(背景のケース B・C・G の再現)。
- **`sideEffects` の指定(監査が先)**: **`"sideEffects": false` を一括で入れる前に、モジュールの最上位に副作用を持つ物を洗い出す**(例: **`lib/present/ui.ts:448-611` は最上位で DOM のイベントリスナーを足す**)。**配列の形**(`"sideEffects": ["./dist/lib/present/ui.js", …]`)で、副作用のあるファイルを列挙する(または、そのファイルが `import` されず埋め込みだけと確かめる)。**最上位に副作用を持つモジュールの一覧を持つテスト**を足し、一覧に無い副作用が入ったら落とす(U1a)。登録式を避ける理由は、「`false` だと登録が消える」ではなく(登録のファイルを配列に書けば残せる)、**グローバルの状態を持たない(ADR 0074)、2 つの版が共存できる、構造上安全**、の 3 点。

## 代替案(全体)

| 案 | 採らない理由 |
|---|---|
| ADR 0079 のまま(別リポジトリ + `CharacterManifest` だけ) | 顔の**帯**(avatar、見本帳)が作れない。ただし、人物の提供元としては残す(D11 の 1.) |
| 中央の表を残し、プラグインを封筒の帯 1 種類で足す(ラウンド 1〜2 の案) | 外部の帯は足せるが、**マンガだけで 1 MB のまま**。決める人の要件(使う帯・出力形式・重い依存だけを束ねる)を満たさない(D1) |
| 登録式(`registerBand`) | `sideEffects: false` で黙って消える。グローバルの状態(D1、背景の D) |
| 出力形式の hook を `BandDef` に入れる | 帯を import すると PPTX・Excel のコードが付いてくる(D6) |
| `core` に `lib/manga-face/` として入れる | 出す周期と golden が core に結びつく(ADR 0079 D1)。他のパッケージの帯にも使えない |
| `raw()` の帯の拡張で足す | 試した(スパイク)。anchor が登録されない、高さが構築時に固定、文字が測定を通らない、verify の口が無い |
| 動的 `import(url)` を spec に書かせる | **安全でない**(D8 の 1)。MCP で任意のコードが走る |
| 全部の帯を一度に `BandDef` へ移す | golden のバイト一致を守る移行が大きすぎる。1 帯 1 PR、派生の表で段階的に(D10) |
| バンドラのプラグインで未使用の帯を削る | 利用者にツールを強いる。`sideEffects` と入口で足りる(D1) |

## 影響

- `lib/` の変更は、U1 以降の別の PR。この PR(U0)は ADR とスパイクだけで、`lib/` と golden は変えない。`pnpm typecheck` は通る(スパイクは `tsc -p .` の対象外。スパイク用の `tsconfig` で別に確かめる)。
- コアに足すもの: `svg-diagram/core`(パイプライン、`BandDef`、帯の値、`pluginBands`、`copyBand`、コア所有の帯 7 つ)、`svg-diagram/core/internal`(内部層)、`spec/parts/<名前>`(`PartDef`)、帯ごとの入口、出力形式の入口と adapter、バックエンドの入口、`package.json` の `exports` と `sideEffects: false`、`test/band-boundaries.test.ts`、`scripts/bundle-size.ts` と `bundle-budget.json`。中央の表は移行の間は派生の表、終われば削除。`layoutHandlerFor` の箱のフォールバックの削除。
- 変わらないもの: 今の公開の入口(全部入り。大きさは増やさない)、コアの帯の API、golden(移行の各 PR で不変)、`schema/*.schema.json`(プラグインを渡さない既存の経路)、規則の id。
- 公開の約束が増える: `BandDef` / プラグイン API の semver(D1)。`0.x` の間は破壊的変更あり。入口の名前(`core`、`bands/*`、`pptx/bands/*` …)。
- ADR 0068(Excel)の D2 を改訂する(D6。Q13)。ADR 0078 の U4(`lib/comic/` の重なり)は、移した `comic` の帯の上に載せる(Q3)。

## 実装計画

U0 は、この PR。U1 以降は、どの単位も Opus のレビューで Blocker と Major がなくなってからマージする。**移行の PR(U8〜U15)は、帯ごとに 1 つで、D10 の基準を全部満たす。** U1a は ADR 0078 U2 の前でも始められる(追加と composer の移動のみ)。

| 単位 | 内容 | 完了の基準 | テスト |
|---|---|---|---|
| U0 | ADR とスパイク(この PR) | スパイクの測定。表の一覧。バンドルの測定。`typecheck` が通り、golden が不変 | `spikes/band-plugin/` の各スクリプト |
| U1a | **型と枠組み(追加と composer の `lib/compose/*` への純粋な移動のみ)。レビューしやすい大きさのため 2 つの PR に分ける**(U1a-1: `[DEF]`・`band()`・`defOf`・`copyBand`・`plain()`・`cloneData`・注入する派生の表・`layoutHandlerFor` の変更。U1a-2: composer の移動・境界の検査・`sideEffects` の監査・大きさの検査・`PluginDef` と `pluginBands` と `./plugin`): `BandDef` と帯の値(`[DEF]`。列挙できる、版つきのキー)、`BandValue<T>`(今の帯の型に代入できる)、`pluginBands`、**`copyBand`**(全部のコピー経路。`cloneData` / `detachData` も `[DEF]` を参照で引き継ぐ)、`plain()`(テスト用)、**注入する派生の表**(純粋な `withLegacyTables(corePipeline, tables)`。新しいパイプラインを返し、最上位で状態を書き換えない。`sideEffects: false` の全部入りの束で描けるテスト)、`[DEF]` を持たない帯のリテラルの補い(全部入りの入口)、`layoutHandlerFor` の箱のフォールバックの削除、`test/band-boundaries.test.ts`(コア所有の帯の一覧つき)、`package.json` の `exports`(**`plugin`**(型のみ)。`core` の入口は中身ができる U1b)、**`sideEffects` の監査と、最上位の副作用の一覧のテスト**、`scripts/bundle-size.ts`(全部入りの上限だけ有効) | `typecheck` が通る。**帯を移していない図の出力がバイト単位で不変**(golden)。全部入りの入口の大きさが今の +5% 以内 | 未知の `type: 'x:y'` が箱にならず投げる、**全部のコピー経路で `[DEF]` が残る**、**移した型が表に行を残したら落ちる**、型テスト(最上位・`group`・`row`・`areas` の `connect()`、裸の綴り間違いは `@ts-expect-error`、`box()` の戻り値が `BoxBand` に代入できる、コアの帯の抜けは落ちる)、`plain()` を通した 18 ファイル(153 行)の `deepEqual` |
| U1b | **`core` の切り出し**: `pipeline.ts` が HTML を引かない(`svg-diagram/html`)、`rules.ts` / `dsl/text-bands.ts`(`walkBands`)/ `web.ts` / `located.ts`(`CHILD_BANDS`)を表から切り離す、**コア所有の帯(`caption`・`status`・`legend`・`spacer`・`connect`・`group`)を `core` の定義にする**、**配置した要素に `[DEF]` を付ける**(新しく作る物はコア所有の定義)。`deck-load.ts` の PPTX への依存(`figureMinPt` → `planSlide`)を分ける | **`core` を単体で束ね、metafile に帯のモジュールが無い**(コア所有の 7 つ以外)。golden が不変。**`core` の大きさを測り、バンドラごとの予算を置く**(D12) | 上の束の検査、`core-purity`、`web-entry`、`pipeline` の段の順序、配置した要素の全部に定義がある(描画で「定義が無い」が起きない) |
| U2 | **公開層の hook**(プラグイン用): `ids`、`layout` の anchor 登録(**スコープは既定で帯の id**)、`texts` と `wrapText`、**`band-text-unmeasured`**、`inventory` の既定、`reveal` の既定、`connect()` の終点、親の幅 `w`、D2b の公開の hook(`uses`・`semantics`・`patchKeys`・`defsNeeded`・`edges`)、**内部層の定義をプラグインとして登録することの拒否**。参照プラグインの骨組み | 参照プラグインの帯が、**最上位・`group`・`row`・`areas` の中**で描け、部品への `connect('a:bottom', 'rate.s2:top')` が通る | **同じ種類の帯 2 つ**、各コンテナ内の部品への `connect()`、`band-anchor-undeclared`、`claimed`、`fill` / canvas / `width: 'fit'` / 折り返しのやり直しで hook を何度呼んでも同じ結果(冪等)、`band-text-unmeasured`、文字の大きさが `roles` の拡大に従う、日本語の折り返しがコアの帯と同じ |
| U3 | 外部の帯の描画と門: `sanitizeBody`、帯の中の id の重複、id の接頭辞(図の中の帯の位置から)、`data-node` をホストが `anchors` から書く、`selfDimming` と `dim`、**ダークモード(トークンの色、`paper`、`paper` の `texts` の凍結したインクの色)** | 描画が決定的。禁止の要素は `band-svg-rejected` と破線のプレースホルダー | 門の拒否一式、同じ帯が 2 回出ても `id` が衝突しない、`url(#id)` が壊れない、**暗い図で `paper` の帯の文字と下地のコントラスト**、トークンでない色、**`nodeIds: 'self'` / `rectsQualified: true` / `internal: true` を立てた外部の定義が `BandError` で拒まれる**、**それらを立てても `<script>` を出すプラグインは門で拒まれる**、`ctx.connects` が凍結されている |
| U4 | verify と規則とエラーの境界: `verify.rects` / `check`、`rules`、`accept` の型、`band-failed`(`layout` は結果を求めてから `ctx` を変える。48px のプレースホルダー)、`--strict`、`check --explain` | 外部の帯の問題が verdict に入る。規則に説明が無いと `band-rule-undocumented`。hook が投げても他の帯の診断が続く | 問題 / 警告 / 助言、`accept`、投げる hook、**変異**(`verify` を空にする) |
| U5 | **spec の部品と入口と設定**: **`PartDef`**(schema・example・`build(json) → BandValue[]`・使う帯の定義)と `spec/parts/<名前>` の入口(**部品と帯は多対多**: `chart` の部品が `lines` / `radar` / `pareto` / `sankey` …、`table` の部品が `raci` / `fmea` / `matrix` …、`board` が `areas` / `box` / `group` / `caption` / `connect` を作る)、**`renderSpec(spec, {parts})`**、`specToDiagram` / `validateSpec` / `renderSpecEdge` の `parts` と `plugins`、`specSchemaFor`、`partCatalog({parts})`、未対応キーワードの拒否、`--plugin` と設定の `plugins`、**`pptx-deck` / `serve` / `site` / `md` / `deck` / `check --drift --jobs` の子プロセス**への配線、**キャッシュ(デッキ、drift)にプラグインの版を入れる**、markdown 系・`./render`・PPTX の edge。**静的な `./schema/*.json` はプラグインを含まない** | spec の部品が描ける。**名指しされた部品 / 帯が渡されていないと、使える一覧つきのエラー**。`parts` を渡さない全部入りの入口は、**65 部品**が今と同じ。`schema/*.schema.json` が不変 | spec の往復、未供給のエラー、`schema-files` の不変、`--plugin` と設定、`pattern` などを含むスキーマの拒否、各入口に参照プラグインを通す、**プラグインの版を変えるとキャッシュが無効になる**、drift の子プロセスが `--plugin` を受ける、**部品 → 帯の対応(多対多)の表と、`IN_NO_SPEC_YET` の同値** |
| U6 | **参照プラグインと適合テスト(必須)**: `test/fixtures/plugins/rating/`(`lib/` の外。**`import type` と `satisfies PluginDef` だけ**)に、小さい帯を 1 つ、公開層の全部の hook を通るように端から端まで。`svg-diagram/plugin-testing` の `conformance(plugin)`: **幅・`roles` の倍率・折り返しの方式を変えて A, B, C, A, B, A の順に `layout`**、**深く凍結した入力**、**測定 → 配置の本物の周期**(厳密な測定済みの集合)、**毎回新しく複製したデータの結果と共有データの結果が同じ**、`structuredClone`、門、規則の説明、anchor の一意、`example` が描ける、2 つの帯が衝突しない、`group` / `row` / `areas` の中、**配布物に import が無い**。U2 の後に、本物の `fill` / canvas / `width: 'fit'` の通過でも回す | 参照プラグインが適合テストを通る。プラグインなしで描くと明確なエラー | 端から端のテスト、未供給のエラー、**変異**(`emit` を非決定、`rules` の説明を消す、門を外す、`measure` の登録を消す、**環境を無視して結果を覚える / 4 回目から高さが変わる壊れたプラグイン 2 つが落ちる**) |
| U7 | **出力形式の分離**: `svg-diagram/pptx`(`toPptx(d, {bands})`)、`html`、`zip`(PPTX と Excel で共有)、帯ごとの adapter の入口。**`BAND_HANDLERS` を adapter の表に分け**、`slide.ts` の `group` / `swimlane` の特別扱いを adapter の hook(`planSpan`)に移す。**共有の `boxXml`(`tree.ts` / `states.ts` / `cause.ts` が使う)は `pptx` の中核**に置く。**絵のフォールバックは、`rasterize` の port(PNG の代替。`pptx-edge.ts:20`、`pptx/emit.ts:25` の resvg)と、文字の輪郭化(`svg-outline.ts` と文字のエンジン。`pptx-edge.ts:68-70`)の port を受け取る**(`pptx` は resvg と HarfBuzz を直接 import しない)。**adapter 無しの既定(PPTX = 絵、HTML = SVG)と報告**。全部入りの `./pptx/edge` は全部の adapter と ports を渡す。**ADR 0068 の改訂**(D6) | **PPTX・HTML の golden がバイト単位で同じ**。「箱・行 + PPTX」の束の予算(ports の中身を明記)。adapter の無い帯は絵になり、報告される(`strict` ならエラー) | adapter の差し替え、既定の絵、報告、`strict`、`pnpm validate:pptx`、PPTX の golden(`pptx-golden.yml`)、`pptx` が resvg / HarfBuzz を直接 import しない検査、**変異**(adapter の表から 1 行を消すと既定の絵 + 報告) |
| U8 | **移行 M1: `comic`**(公開層。今の重なりのない経路のまま)。`lib/comic/` の `rules.ts` / `verify-handlers.ts` / 表の行を帯の定義へ。**マンガの組み合わせの予算を有効にする** | D10 の基準 1〜8。**マンガ + ブラウザの測定器の束が、予算内**(見込み 230〜250 KB。今 1036 KB)。ADR 0078 U4 は移した帯の上に載せる | golden、同値、境界、Artifact の束の測定(esbuild と Vite) |
| U9 | **移行 M2**: 葉の帯(`raw`、`banner`、`curve`、`pyramid`、`people`、`dots`、`wordart`、`math`) | D10 の基準 1〜8 | 同上 |
| U10 | **移行 M3**: `box`(内部層。`placeBoxLike`)。付け根(`reveal.ts → band-ids.ts → quadrant.ts`)を切る | 同上 | 同上 |
| U11 | **移行 M4**: コンテナ(`row`、`grid`、`areas`、`grouprow`、`image`)。`children` の hook、`stack`、`row()` の包み。**箱・行の組み合わせの予算を有効にする** | 同上 | 同上 + 箱・行の束 |
| U12 | **移行 M5**: 図形の帯(`flowShape` の 7 種、`quadrant`、`timeline`、`gantt`、`bars`、`plane`、`chart`) | 同上 | 同上 |
| U13 | **移行 M6**: `sequence`、`table`、`swimlane`、`wireframe`、`screens` | 同上 | 同上 |
| U14 | **移行 M7**: `tree`、`states`、`cause`、`cloud`、`classes`、`bpmn`、`fta`、`bowtie` | 同上 | 同上 |
| U15 | **後片付け(M8)**: 中央の表と `ALL_BANDS_*` と注入の仕組みを消す。**`rules.ts` を族ごとに分け**(D12)、帯ごとの規則と `RULE_DOCS` の行を帯へ。**`.type === '<リテラル>'` の検査を有効にする** | 中央の表が無い。golden が不変。`core` の大きさが予算内(`rules` を分けた値に更新) | 既存のテスト一式 + 分岐の検査 |
| U16 | **人物の提供元**(DSL と `renderComic` の経路): `characters` の hook、`comic(sheet, {plugins})`、`loadCharacter` を必ず通す。**spec の `cast.x.character = {provider, params}` は、comic が `PartDef` を持つ(ADR 0074 U4)まで待つ** | 参照の人物の提供元の出力が `comic()` で描ける。権利の無い人物は `comic-license-missing`。**人物は図ごと** | 提供元 → `loadCharacter` の往復、未供給、権利なし、図をまたいだ漏れなし |
| U17(任意) | 追加の表情: `expressions`、`ComicExpression` の拡張、`comic-expression-fallback` | 名前空間つきの表情が描け、持たない人物は `neutral` に落ちる。コアの 8 種は不変 | 落ちる経路、コアの golden の不変 |
| U18 | **1.0 の確認と配布**: D10 の確認表を埋める(コンテナと図式の帯を含む 12 個以上の帯の移行 + 参照プラグイン + manga-face)。jsDelivr から `core` と帯と(あれば)プラグインを読む Artifact の通し確認(**core の CDN のプローブが済んでから**)、MCP の許可リスト(MCP のリポジトリ側の PR)、README と skill。**予算の全部の行を有効にする** | 確認表のすべての行に実物がある。Opus のレビューが収束。`1.0` | Artifact の実機の確認(決める人)、MCP のテスト(別のリポジトリ) |

### U1b の実装メモ

- 選択的な SVG の入口に、箱を含む行・グリッドと接続線を配線した。従来の配置処理を共有し、接続線を import しない構成のバンドルからはルーティングのモジュールを外す。 行の戻り線は `connectDefinition` の明示供給で既存の展開を使う。キャプション、スペーサー、グループ、グループを含む行も個別に選択できる。 領域配置の `areas`、`banner`、`raw` も個別に選択でき、消費側の束で依存の除外を検証する。 `curve` と `pyramid` も、それぞれ単独の束で描画と依存除外を検証する。
- フロー図形 7 種類の個別入口は共通の配置と描画を使い、レイアウトと文字測定は図形ごとの関数を選ぶ。各図形を単独で束ね、他のフロー図形のレイアウトと測定が除外されることを検証する。
- `people`、`dots`、`timeline` も個別に選択できる。日付軸と数値軸の配置・ラベル検査を従来の入口と共有し、単独の束で人数図とドット図のレイアウト・測定の相互除外を検証する。
- 下書きバッジは `status('draft')` を配列の先頭に渡す。縦書き・横書きの `wordart` も個別の入口から従来の配置と描画を利用できる。
- `bands/math` は Node.js 専用で、TeX の変換時に MathJax を読み込む。コンストラクター・配置・描画を従来の入口と共有し、他の帯と MathJax 本体が Node の束に含まれないことを検証する。
- 明示指定の `legend` も個別に選択できる。因果図の役割スタイルと障害木の記号だけを共有し、両図の配置・描画を含めない。SVG のマーカーは各帯の定義から要求できる。
- `quadrant` はプリセット、項目アンカー、図形内の検査を個別入口でも利用できる。接続・重なり検査の矩形は帯の定義から取得し、スコープ付きの ID を従来と同じ規則で解決する。
- `plane` の個別入口は、従来版と同じラベル検査と、点・線・伸びる経路の段階表示を使う。ほかの帯の段階表示処理を取り込まず、個別の帯の定義から要素の最終段階と警告を受け取る。
- `bands/bars` は範囲棒、パレート、ヒストグラムのビルダーを同じ帯の定義に結び付ける。段階表示で置き換わる棒の表示期間は、その棒を参照する接続にも反映する。
- `sequence` と `table` は個別の文字測定・配置を選択する。メッセージの矢印と表の等幅フォントも帯の定義から要求する。
- `wireframe` と `screens` は共通の画面部品を利用し、個別入口の束には選んだ画面の配置だけを残す。接続先は従来と同じ画面枠を参照する。
- `bands/fta` と `bands/bowtie` は個別に配置・描画できる。障害木の事象アンカーと接続検査の矩形を従来の入口と共有する。
- `bands/cloud` の束は対立解消図の配置、前提の番号付けと検査だけを利用する。因果ツリーの層配置・交差処理は含めない。
- `bands/classes` と `bands/bpmn` はそれぞれの測定・配置・関連線検査を選択する。BPMN は横・縦の両方を同じ入口で扱う。
- `bands/states` は状態遷移図とフローチャートを同じ帯の定義に結び付ける。判断ノード、自己ループ、スコープ付きアンカーの接続と検査を従来の入口と共有する。
- `bands/tree` はツリーとマインドマップを個別に描ける。ノードに置く帯はツリー自身の定義から列挙し、そのノードの測定・配置・描画を各帯の定義に委ねる。
- `bands/cause` の因果ツリー、連関図、PDPC は同じ帯の定義を使う。AND 弧、連関図の入出本数、PDPC の枝を従来と同じ配置・描画で扱う。
- `bands/swimlane` はステップの文字測定・描画・検査を箱の定義と共有する。レーン間の `flows` を使う場合だけ `connectDefinition` を明示して渡す。
- `chart` は種類ごとに帯の定義を選べる。最初の `bands/radar` と `bands/waterfall` は共通の図枠・描画・検査を使い、相手のレイアウトを束から除外する。
- `bands/sankey` と `bands/heatmap` も種類ごとに測定・配置を選ぶ。フローの値ラベル、欠損セルと色の目盛りは従来と同じ描画を利用する。
- `bands/stacked` は積み上げ棒とメッコを共通の定義で扱う。`bands/treemap` は入れ子の面積計算を個別に読み込む。従来の SVG と照合し、個別バンドルで相互に除外されることを検証する。
- `bands/tornado`、`bands/butterfly`、`bands/bubble`、`bands/harvey` は個別に配置・描画する。比較の向き、バブルの基準線、評価表の欠損セルを従来と同じ描画で扱う。
- 統計グラフ 5 系統はそれぞれ個別の入口を持つ。多変量・回帰とカテゴリ図で使う点の記号を分け、カテゴリ図の配置を読み込まずに記号を共有する。
- 複合グラフ・比較表・PERT・因果ループ・依存ネットワークの個別入口を追加した。ネットワーク 3 種類は共通の経路配置を使い、文字測定と配置は種類ごとに読み込む。これで `chart` の全 20 種類に個別の SVG 入口がある。
- `bands/image` は data URI の画像を埋め込み、注釈・重ねた帯・マークへの接続を描く。Node.js でファイルを読む場合は `bands/image/node` の `imageFile` を追加で読み込む。両入口は同じ帯の定義を使う。

帯と入出力の進捗は [Tree shaking 移行チェックリスト](../tree-shaking-checklist.md) を参照。配置と測定は、既存の処理を共有したまま解決元を呼び出し側から受け取れるようにした。配置の共通処理は子の探索、スタック幅、スコープ、inventory も呼び出し側から受け取る。行とグリッドを内包する図で、ラベル付き接続線の配置と inventory の一致を確認した。 SVG の組み立てと共通の検査も、帯の描画・検査・規則を呼び出し側から受け取る。実行順と XML 検査を共有するパイプラインは従来の入口と選択的な入口の両方から組み立てられる。

- SVG のパイプラインから HTML の出力を分け、Node の `renderDiagram(d, {html: true})` が HTML を組み立てるようにした。HTML 出力は `svg-diagram/html`、ブラウザの測定器は `svg-diagram/measure/browser` から個別に利用できる。
- `html/selective` は選んだ帯と HTML アダプターを使い、未対応の帯と接続線は SVG として埋め込む。`fallbacks` で報告し、`strict` で拒否できる。従来の HTML 出力は同じアダプターと既存の SVG・テキスト変換を使う。
- `pptx` は箱系のアダプターを選択できる。アダプターのない帯は絵に変換し、PNG と文字輪郭化の処理は呼び出し側から渡す。箱・行の個別バンドルから従来の全帯テーブル、表・SVG 図形変換・Node の ZIP を除外できる。
- PPTX の表・ツリー・象限図・状態遷移図・因果図・凡例・フロー図形の専用描画を個別アダプターとして公開した。アダプターが図を扱えないときは絵への切り替えを報告する。
- PPTX のグループ化を `groupSpan` と `swimlaneSpan` に分け、必要な帯だけスライドプランナーに渡す。従来の入口は両方を渡す。
- PPTX のフロー図形・ピラミッド・タイムラインを分け、各入口の束で相互の描画コードが外れることを検証した。フロー図形は配置された図形を変換する共通処理を使う。
- `compose/canvas`、`compose/hero`、`compose/icon-row`、`compose/versus` は既存の合成関数を使い、生成した帯に各定義を付ける。個別入口の束に必要な帯だけが含まれることを検証する。
- ワイヤーフレームの状態表示・ロボットマーカー・ダイアログ・トーストは `createWireframe` のオプションで個別に登録する。
- 監視ウィジェットも `wireframe/renderers` から個別に選べる。描画時に組み立てる文字列は、その部品が測定対象として提供する。
- 画面遷移図と状態マトリクスは `createScreens` で描画・測定と装飾を選べる。2つのビルダーは帯の定義を共有し、従来の入口と同じ配置と所見を使う。
- ワイヤーフレームの基本部品は `wireframe/renderers` から使う描画と測定を選び、`createWireframe` に登録できる。
- ワイヤーフレームの `bands/wireframe/basic` は描画基盤と基本ウィジェットだけを組み込む。描画基盤は従来の入口と共有する。
- ワイヤーフレームの部品ビルダーは `wireframe/parts` から個別に読み込める。従来の `wf` は同じ関数を参照する。
- 表の派生ビルダーは `bands/table`、なぜなぜ分析の木は `compose/why-why-tree` を使う。DSL と JSON spec が同じ選択ビルダーを呼ぶ。
- 画面状態マトリクスを `bands/screens`、アロー・ダイヤグラムを `compose/arrow-diagram` から選択できる。既存のビルダーと描画を共有する。
- JSON 単体を描く `svg-diagram spec` は `--part` で許可した既存部品だけを読み込む。JSON に書かれた名前からモジュールのパスは組み立てない。
- Node.js の `spec/selective/node` は選択した帯とフォント測定を使う。測定と PNG 変換は `measure/node` と `png` から個別に利用できる。PPTX と同じ ZIP ライターは `zip` から個別に利用できる。
- Edge の選択描画は `spec/selective/edge` から部品と文字エンジンを渡す。輪郭化と検査結果の変換は従来入口と共有する。
- 枠の配置に関する所見は対象の帯から共通の `verify.diagramFindings` を登録して集計する。同じ関数は図ごとに一度だけ実行する。
- キャンバスの文字サイズは選択した帯の `textSizes` と共通のテキストランから集計する。選択入口は全帯の `FIT_HANDLERS` を読み込まず、従来入口と同じ下限・超過の所見を返す。
- 表とスイムレーンは帯定義から配置結果や接続を使う所見を返す。従来入口と所見の計算を共有する。
- 選択描画は帯定義の `verify.findings` から入力に基づく所見を集める。TOC と RCA の帯固有の所見は従来の検査と計算を共有する。
- 因果図は選択入口と従来入口で同じ配置を使う。キャンバス上の線間隔、収まらないときの再試行、アンカー登録を共有する。
- 図全体の左右の余白と幅は、選択描画と従来の入口で同じ内容範囲から計算する。固定キャンバスでは省き、帯の枠揃えの検査は該当する帯から読み込む。
- パッケージの spec 部品 65 入口を esbuild と Vite でそれぞれ単独バンドルする。各作例を実行し、必要な帯の集合と他の部品の除外を CI で確認する。
- JSON spec の自動凡例は `bands/legend` の `autoLegend` を渡した構成だけで有効になる。既存入口と記号の収集処理を共有する。
- `spec/selective` は最初の 3 部品（フローチャート、ファネル、ピラミッド）を個別に読み込み、登録した部品の schema・catalog・検査を提供する。全部入りの入口と部品の schema と入力検査を共有する。
- 表・ガント・スイムレーンなど 15 部品を追加し、カタログの例を既存の入口と照合した。表・RACI・ジャーニーマップは同じ表の定義を使う。
- 数量図とネットワークなどの 18 部品を追加した。各部品は既存の schema・検査を共用し、ヒートマップの選択構成でサンキー図・ツリーマップ・トルネード図の実装を除外できる。
- 品質・比較の 14 部品を追加し、個別化した spec 部品は 65 部品中 50 部品になった。箱ひげ図の単独構成から、回帰図・分布図・多変量図の実装が外れることを確認した。
- 障害木・関係図・なぜなぜ分析など 9 部品を追加した。障害木だけのバンドルに比較表・ボウタイ図・因果ループの実装が含まれないことを検証した。
- 残る 6 部品にも個別入口を追加し、既存カタログの全 65 部品と schema・作例を照合した。手順図の戻り線は部品が接続定義を渡す。
- 選択的 spec と従来の入口は図全体の schema を共有する。選択入口で言語・配色・密度・説明・キャンバスを指定できる。題名と出典は `captions` に帯の定義を渡した場合に描く。
- デッキのファイル読み込みから、PPTX の列探索に使う文字サイズの計測を分けた。
- 消費側の esbuild と Vite の検査を CI に追加した。配布用の `exports` から SVG・HTML・文字測定を束ね、出力に含まれるモジュールを調べる。文字測定のみの場合は両方で 4,000 バイトを上限にした。
- 選択的な SVG 描画の入口として `svg-diagram/core` の `renderBands` と `bands/box`・`bands/gantt` を公開した。配置・出力・検査を既存の帯と共有し、縦積みの処理は値が持つ定義から呼ぶ。esbuild と Vite の消費側の検査で、それぞれの帯を単独で描けることと、もう一方の帯および従来の全帯テーブルの除外を確認する。接続・入れ子と他の帯の移行は残っている。

## テスト方針

- **移行の同値**: 各 PR で、**golden(SVG、PPTX、スキーマ)がバイト単位で同じ**。移行の間は、**表からの呼び出しと帯の値からの呼び出しが同じ結果**になることを、その帯の例で確かめる(派生の表)。
- **境界**: `test/band-boundaries.test.ts` が、`core` が帯を import しないこと、帯が他の帯を import しないこと、出力形式の adapter が帯の入口以外を引かないことを見張る。
- **大きさ**: `scripts/bundle-size.ts` が、入口と代表の組み合わせの束の大きさを予算と比べる(esbuild と Vite の両方)。
- **適合テスト**(U6)は、プラグインの作者が自分のリポジトリで走らせる。core の CI は参照プラグインだけを走らせる。
- **変異**: 各単位で、新しいコードを壊す変異を 1 つ以上当て、落ちることを PR に書く(`AGENTS.md`)。

## 決める人への質問

| # | 質問 | 推奨 | 理由 |
|---|---|---|---|
| Q1 | 帯の定義は 1 つの形 `BandDef`。呼び出しは帯の値(`[DEF]`)から。`core` は `[DEF]` だけを通し、中央の表は無くす方向でよいか | **よい**。登録式にしない。`satisfies BandDef` と全部入りの入口の 1 つの表で全数性を保つ。**移行中の表は、全部入りの入口が注入する(`core` には置かない)** | 使う帯だけが束ねられる。表を `core` に置くと、未移行の帯が束に残る(測定 E)。登録式は、グローバルな状態を持ち(ADR 0074)、2 つの版が共存できない |
| Q2 | コアの帯の移行を主線にする(以前の案の「移さない」を逆にする) | **主線にする**。1 帯 1 PR、golden はバイト一致、注入する派生の表で段階的に | 束ねの問題の原因が中央の表。移行の途中でも同じ結果になるので、いつでも止められる |
| Q3 | 移行の順序と最初の成果 | **M0a(型と枠組み)→ M0b(`core` の切り出し)→ `comic`(最初の成果。重なりのない今の経路のまま)→ 葉の帯 → `box` → コンテナ → 図形 → 表 → 図式 → 後片付け**。`comic` は ADR 0078 U4 を待たず、U4 は移した帯の上に載せる | 決める人の最初の用途がマンガ。`comic` は配置が純粋で、公開層だけで書ける。0078 で `lib/comic/` を触る単位は U4(U2 ではない)で、U2 を待っても衝突は避けられず成果が遅れる。待つ案(B)も選べる |
| Q4 | 入口の構成(`core`、`bands/<名前>`、`spec/parts/<名前>`、`measure/*`、`pptx` と `pptx/bands/*`、`xlsx`、`html`、`png`、`zip`)。今の入口は全部入りとして残す。`sideEffects` は**監査の後に配列の形**で入れる | **そのとおり**。帯ごとの入口を主にする | `sideEffects` は効く(測定 B)が、`lib/present/ui.ts` のように最上位に副作用がある。Rollup は樽に弱い(F / G) |
| Q5 | 出力形式を `BandDef` に入れず、出力形式の入口に帯ごとの adapter を置く。adapter が無い帯の既定: PPTX = 絵、HTML = インライン SVG、Excel = 飛ばす。報告する(`strict` でエラー)。PPTX は `rasterize` と文字の輪郭化を ports で受け取り、共有の `boxXml` は `pptx` の中核 | **そのとおり** | 帯を import しても出力形式が付いてこない。絵のフォールバックには PNG と文字の輪郭化が要る |
| Q6 | 渡し方: 呼び出しごと + プロジェクトの設定の `plugins`。**spec の入口は `parts`(`PartDef`)を渡す**(部品と帯は多対多。全部入りの入口は 65 部品を既定) | **そのとおり** | ADR 0074 の約束。部品は帯の型ではない(`chart` の下に `lines` / `radar` / `pareto` …、`board` は複数の帯を作る)。コードの無い入口は設定 |
| Q7 | spec が名指しした部品 / 帯が無いときは、使える一覧つきのエラー | **そのとおり** | 黙って落とさない。LLM が直せる |
| Q8 | 外部のプラグインは「名前空間つきの `BandDef`」。**二層**: 公開層(プラグイン。純粋な `layout`)と内部層(コアの帯。`LayoutCtx` 全体)。内部層はプラグインに出さない。後で公開層へ移す条件は D2a | **そのとおり**。外部の帯は文字を `texts` で返す、他の帯を持てない | コアの `box` / コンテナ / 図式の帯は、カーソルと再帰を使うので純粋な形では書けない。プラグインには、純粋な約束だけを出す |
| Q9 | v1 で外部の帯に何を許すか | **他の帯を持つこと(コンテナ)と重ねの帯になることは許さない。行・グループ・`areas` の子になること、`FlowBand` に含まれることは許す。`grid` は箱だけ** | 子の測定と積みは内部層。スパイクで 3 つのコンテナとも描けた |
| Q10 | API の版と `1.0` の条件 | **別の semver。`0.x` の間は破壊的変更あり。`1.0` は「コアの帯を少なくとも 12 個(コンテナを 1 つ以上、図式の帯を 1 つ以上含む)、golden バイト一致で移し終え、参照プラグインが公開層の全部の hook を通し、manga-face が動く」(N は決める人が決める)。Opus のレビュー収束後** | 内部層が実際にコアの帯を書ききれることを、1.0 の前に確かめる |
| Q11 | 大きさの予算を、入口ごと・組み合わせごと・**バンドラごと**に CI で検査する。**数字は M0b の測定の後に置く**。`rules.ts` を族ごとに分ける(U15) | **そのとおり**。全部入りの入口は +5% 以内で M0a から。帯・組み合わせは、その帯が移った後に有効。**最初の成果は約 230〜250 KB(今の約 1/4)が見込み、`rules.ts` を分ければ 200〜215 KB** | 以前の 130〜160 KB は楽観的だった(枠組みは `rules.ts` なしで約 144 KB、一般の半分で約 190 KB)。Rollup は esbuild より 10〜25% 大きい |
| Q12 | 公開の MCP サーバーで、どのプラグインを有効にするか | **既定は 0 個。有効にするのは、権利と品質の確認の後(`manga-face` が最初の候補)** | 許可リストは安全だが、見た目と権利は別の確認 |
| Q13 | ADR 0068(Excel)を、adapter の形に改訂してから実装する(D2 の表を adapter に、D8 の zip を `svg-diagram/zip` に) | **そのとおり**。0068 の PR #373 に追記する | 0068 はコードが未実装。表を後で分けるより、最初から adapter で書く方が安い |
| Q14 | 人物の提供元(関数として呼ぶ形は今でも可、spec に書く形は ADR 0074 U4 の後)と、追加の表情(後で、名前空間つき) | **両方の経路。表情は後(U17)** | ADR 0079 を待たせない。0079 の Q8 と同じ時期 |
| Q15 | 版の門(`requires` の不一致はエラー。`apiVersion` が権威)、1 つの帯の上限(設定できる。既定 SVG 1 MB、anchor 1000) | **そのとおり** | 黙って動いて壊れるより、早く止まる。顔 64 個の見本帳が約 370 KB で収まる |
| Q16 | 全部入りの入口の「派生の表」を、移行後も互換のために残すか | **削除する**(U15)。公開 API として約束していない物は残さない | 残すと全部の帯を引く物が残る |
| Q17 | **コア所有の帯**(`caption`・`status`・`legend`・`spacer`・`connect`・`group`・**配置済みの `row` の包み**)を `core` の定義にし、`core` と他の帯が import してよい。**`placeBoxLike` と箱の文字の配置は `core` の共有の補助関数に残す**。**composer**(**自分の型でもコア所有の型でもない帯を作る関数**: `versus`・`hero`・`iconRow`・`canvas`)は `compose/<名前>` の入口でどの帯も import してよい(`callout`・`bracket`・`branch` は `connect`、`stat` は `box`、`stateMatrix` は `screens` の構築関数で、composer ではない)。**信頼は出どころで決める**(`[EXTERNAL]`) | **そのとおり** | `core` が題・出典・状態・凡例を自分で作り、`row()` / `areas()` / `grouprow` が `group` と `row` の包みを作る。`caption` と `group` の題が `placeBoxLike` を使う。composer は帯を組み立てるだけで、帯の境界の検査の外に置く |
| Q18 | `[DEF]` は列挙できるシンボルのプロパティ(版つきのキー)。`plain()` をテストに足す | **そのとおり** | 帯のコピーの `{...band}` が lib に 42 か所。非列挙だと黙って落ちる。代償は、帯のリテラルと比べる 18 ファイル 153 行のテスト |

## 決定済み(2026-11-23。決める人。Q1〜Q18 すべて推奨どおり)

**2026-11-23 に、決める人がすべて承認した**(上の「決める人への質問」の推奨を、そのまま採る)。Opus のレビュー 6 回で Blocker・Major がなくなって収束した。実装は U1a から、Codex に渡す(`[codex] ADR 0080 U1a …`)。

| Q | 決めたこと | 決定 | 根拠の節 |
|---|---|---|---|
| Q1 | 帯の定義は 1 つの `BandDef`。呼び出しは帯の値(`[DEF]`)から。`core` は `[DEF]` だけを通し、表は全部入りの入口が注入 | **推奨どおり** | D1・D4 |
| Q2 | コアの帯の移行を主線にする | **推奨どおり** | D10 |
| Q3 | 移行の順序: 枠組み → `core` の切り出し → `comic`(0078 U4 を待たない)→ 葉の帯 → `box` → コンテナ → 図形 → 表 → 図式 → 後片付け | **推奨どおり** | D10 |
| Q4 | 入口の構成(`core`、`bands/*`、`spec/parts/*`、`measure/*`、出力形式、`compose/*`)と、監査の後の `sideEffects` の配列 | **推奨どおり** | D3・D12 |
| Q5 | 出力形式は `BandDef` に入れず、形式側の adapter。adapter 無しの既定は報告つき。PPTX は ports | **推奨どおり** | D6 |
| Q6 | 渡し方は呼び出しごと + プロジェクトの設定。spec の入口は `parts` | **推奨どおり** | D9 |
| Q7 | 名指しされた部品 / 帯が無いときは、使える一覧つきのエラー | **推奨どおり** | D9 |
| Q8 | 外部のプラグインは名前空間つきの `BandDef`。二層(公開層 / 内部層) | **推奨どおり** | D2a |
| Q9 | 外部の帯は、他の帯を持てず、重ねの帯にもならない。行・グループ・`areas` の子にはなれ、`grid` は箱だけ | **推奨どおり** | D5 |
| Q10 | API の版は別の semver。1.0 は 12 個以上の帯の移行(コンテナと図式の帯を含む)+ 参照プラグイン + manga-face | **推奨どおり** | D10 |
| Q11 | 大きさの予算を、入口・組み合わせ・バンドラごとに CI で検査(数字は `core` の切り出しの後)。`rules.ts` を族ごとに分ける | **推奨どおり** | D12 |
| Q12 | 公開の MCP サーバーは、既定でプラグイン 0 個。有効にするのは権利と品質の確認の後 | **推奨どおり** | D8 |
| Q13 | ADR 0068(Excel)を adapter の形に改訂してから実装 | **推奨どおり** | D6 |
| Q14 | 人物の提供元は関数としても spec 経由でも(spec は ADR 0074 U4 の後)。追加の表情は後(U17) | **推奨どおり** | D11 |
| Q15 | 版の門は `requires` の不一致をエラー、`apiVersion` が権威。1 つの帯の上限は設定できる(既定 SVG 1 MB、anchor 1000) | **推奨どおり** | D1・D2 |
| Q16 | 派生の表は移行後に削除 | **推奨どおり** | D4・U15 |
| Q17 | コア所有の帯 7 つ、`placeBoxLike` は core、composer は `compose/*`、信頼は出どころで決める | **推奨どおり** | D4・D2a |
| Q18 | `[DEF]` は列挙できるシンボル(版つきのキー)+ 再帰する `plain()` | **推奨どおり** | D4 |

## スパイクの再現

```
node spikes/band-plugin/run.ts                                            # プラグインの変換器: out/ok.svg, out/measurements.txt
node_modules/.bin/tsc --noEmit -p spikes/band-plugin/tsconfig.json        # typing.check.ts: ちょうど 10 件。typing.containers.check.ts は通る
node spikes/band-plugin/banddef/smoke.ts                                  # BandDef の試作: マンガと箱を描き、本物とふきだし 4・コマ 12 が一致
node spikes/band-plugin/bundle/measure.ts                                 # 今のバンドル(out/bundle-today.txt)
node spikes/band-plugin/bundle/entries.ts                                 # 入口ごとの大きさ(out/entries-today.txt)
node spikes/band-plugin/bundle/exporters.ts                               # 出力形式とバックエンドの大きさ、引き込みの連鎖、分岐の場所(out/exporters-today.txt)
node spikes/band-plugin/bundle/pptx-modules.ts                            # PPTX の中身(自前と共有)
node spikes/band-plugin/bundle/prototype.ts                               # BandDef の試作のバンドル(out/bundle-prototype.txt)
node spikes/band-plugin/bundle/core-candidates.ts                         # `core` に残るモジュールの大きさ
node spikes/band-plugin/bundle/shaking.ts                                 # sideEffects と Vite / Rollup(out/shaking.txt)
```

`out/` は、U1 以降の PR で参照プラグインと予算の検査に置き換えて消す(ADR 0074 と同じ使い捨て)。スパイクの `host.ts` の変換器(`raw` に載せる)と `banddef/mini-core.ts` は**本実装ではない**。試作のパイプラインは縦の積みだけの縮小版なので、**大きさは本物の下限**(上の見積もりは幅で書いた)。

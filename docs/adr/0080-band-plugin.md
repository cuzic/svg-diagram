# ADR 0080: 帯の定義(`BandDef`)とプラグイン — 1 つの定義の形で、コアの帯も外部の帯も作り、使う帯・出力形式・重い依存だけを束ねる(tree shaking)

- 状態: 提案(Draft。2026-11-23。決める人の確認待ち。Q は下の表。設計と小さなスパイクで、`lib/` は変えていない。ラウンド 1・2 のレビューの指摘を反映。**決める人の追加の要件(帯だけでなく、PPTX・Excel などの出力形式と重いバックエンドも tree shaking の対象にする)を反映した改訂**)
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
| 20 | spec: `PARTS`(`lib/spec.ts`、`lib/spec-parts/*.ts`)、`partCatalog()`、`specSchema`(**定数**)、`pnpm schema`(`lib/schema-files.ts`)、`validateOneOf` の `const` による分岐。検査器が理解するのはスキーマの部分集合(`const` / `enum` / `oneOf` / `type` / 大きさ / `items` / `properties` / `required`)で、`pattern` などは**黙って無視される**。`spec.ts` 単体で **483 KB** | JSON の入口。MCP の `list_diagram_parts` はここを読む | 帯の定義の `spec`(schema / example / build / check)。`specSchemaFor({bands})` と `partCatalog({bands})`(既存の定数と API は変えない)。登録のとき、理解しないキーワードを拒む |
| 21 | `IN_NO_SPEC_YET`(`test/spec.test.ts`)、`test/fixtures/untested-exports.json`、`test/fixtures/rule-locations.ts`、`test/band-registries.test.ts` | 「DSL にあるが spec に無い」の台帳と、表の実行時の網羅テスト | 帯の定義の `spec: false`、定義の網羅テスト |
| 22 | 型: `Band` / `LaidOutBand`(`lib/types/index.ts`)、`Declares<Id>` / `Refers`(`lib/strict.ts`) | 合併型、`connect()` の id の型検査 | D5 |
| 23 | 公開 API: `lib/dsl-pure.ts`(`located(...)`)、`lib/web.ts`、`package.json` の `exports` | DSL の関数の置き場。ブラウザの入口は `node:*` を持たない(`test/web-entry.test.ts`) | D3 |
| 24 | ドキュメント: `README.md`、`skills/svg-diagram/references/*.md`、`docs/chatgpt-code-interpreter.md`、MCP の `list_diagram_parts` | 部品の説明 | 帯の定義の `docs`。プラグインは自分の説明を持つ |
| 25 | `lib/dsl/rewrite.ts` の `KEYS` / `NO_REVEAL`、`lib/emit-html.ts` の `kindOf`(HTML の形。**16 か所**)、`lib/dsl/containers.ts` の `row()`(箱でない子を `group` に包む)、`lib/located.ts`(ソースの位置) | 帯の種類で reveal の書き換え、HTML の形、行の子を決める | 帯の定義の hook / HTML の adapter(D6)。構築関数は `located()` で包む |
| 26 | `lib/strict.ts` の `ElementCheck` / `Refers`、`lib/spec-edge.ts`(`renderSpecEdge`)、`lib/inventory.ts` の `whole` の `band: type` | 他の id の参照、MCP の Worker の入口、目録の帯の名前 | v1 に `Refers` の hook は無い。`bands` を `renderSpecEdge` に通す。`whole` に plugin / kind を記録 |

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
- `smoke.ts`: マンガ(4 コマ)と箱を試作のパイプラインで描き、本物の `renderInBrowser` のマンガと**ふきだしの数(4)とコマの数(12)が一致**することを確かめた。

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
| D2. 登録式、`sideEffects: false` | 16.5 KB | 21.1 KB |
| E. **今のコード**: `renderComic` だけ、`sideEffects: false` | 821.0 KB | 1034.2 KB |
| E2. 今のコード、指定なし | 1035.0 KB | 1292.7 KB |

読み取れること。

1. **`sideEffects: false` は効く**(A→B で esbuild は 54 → 16 KB。Rollup も 26 → 21 KB)。付け根のモジュールを落とす。ただし**今の `package.json` には `sideEffects` の指定が無い**。
2. **今のコードでは、フラグだけでは足りない**(E: 821〜1034 KB)。中央の表が全部の帯を**使っている**ので、落とせない。**表を無くすことが本体で、フラグは仕上げ**。
3. **登録式(D)は危うい**: 指定なしでは全部の帯が束ねられ(54 KB)、`sideEffects: false` にすると**登録のモジュールが丸ごと落ちる**(import の結果を使わない import は消える)。登録に頼る帯が**黙って消える**。**帯の値が定義を持つ方式(この ADR の案)は、使う帯だけが import されるので、どちらのフラグでも正しい**。
4. 帯ごとの入口を直接 import すれば、樽が無くても、フラグがあれば同じ(B = C)。樽は、フラグがある限り害が少ないが、**Rollup(Vite)は樽の再エクスポートの分析が esbuild より弱い**(F / G の差)ので、**帯ごとの入口を主にする**。
5. Rollup(Vite)は、`package.json` の `sideEffects` を、**依存パッケージとして解決したとき**に読む(ケースはパッケージ内のファイルを直接指したので、同じ挙動の近似)。npm で配る版では、入口を `exports` に書き、`sideEffects: false` を入れた上で、**消費側のバンドラ(Vite / esbuild)で実際の入口をバンドルする試験**(下の予算の検査)を CI に入れる。

**見積もり**(新しい世界。最小のバンドル、minify、KB。試作は本物より小さい中核を使っているので、**本物は幅で示す**)。

| 組み合わせ | 今(測った) | 見積もり | 根拠 |
|---|---|---|---|
| マンガ + ブラウザの測定器(Artifact) | **1036** | **130〜160**(試作 51) | 中核(`svg-diagram/core`: パイプライン、測定、`connect`、検査と重ねの枠組み)は、そのまま残るモジュールを束ねて **81 KB**(`core-candidates.ts`。tokens、atoms、wrap、layout-text、layout-util、emit-common、スコープ、source-ref、`connect-rules`、`layout-connect`、経路探索、`verify-base`、svg-lint、appearance、located)+ reveal / spotlight / focus の表を切った後の約 20 KB ≈ **100 KB**。マンガの帯 ≈ 45 KB(試作で 37 KB + DSL・人物・`icon-store`)。ブラウザの測定器 3 KB |
| 箱・行 + ブラウザの測定器 | **1032** | **120〜150**(試作 箱だけ 16〜29) | 中核 ≈ 100 KB + 箱 ≈ 16 KB(試作。フラグあり) + 行 ≈ 10 KB(`renderRow` と配置。見積もり)+ 3 KB |
| 箱・行 + PPTX(Node。依存は外) | **1301**(`./pptx/edge`) | **240〜290** | 中核 100 + 箱・行 26 + **PPTX 自身 101.6 KB**(うち `template.ts` 39 KB)+ 箱・行の adapter ≈ 10 KB。**PPTX が今引いている共有の SVG 描画 110.7 KB は、「使う帯の描画」だけになる** |
| 箱・行 + Excel | なし(未実装) | **170〜210**(見積もり) | 中核 100 + 箱・行 26 + Excel の書き出し(シートと書式の XML、zip は PPTX と共有。ADR 0068 D8)40〜60 KB。**コードが無いので根拠は弱い**。U の最初の測定で置き換える |
| 全部入りのブラウザ(`./browser`) | **1042** | **1042 以下**(互換) | 全部の帯を含める。増やさない(予算) |
| 全部入りの Node(`.`) | **1081** | 同じ | 同上 |

**用心**: 「試作のパイプライン」は縮小版(縦の積みだけ、`connect()`・reveal・題・凡例なし)なので、**試作の大きさは本物の下限**で、見積もりは幅で書いた。本物は U1〜U5 で測り直し、予算(D12)を置く。

## 決定

### D1. 帯の定義は 1 つの形 `BandDef`。コアの帯も外部の帯も同じ形で、呼び出しは**帯の値**から行う

**推奨(Q1、Q2):**

1. **`BandDef<D, L>` が、帯の種類 1 つの全部の振る舞い**を持つ。コアの帯(`box`、`comic` …)も、外部の帯(`rating-demo:stars`)も、**同じ形**。違いは名前(外部の帯は `プラグインの id:帯の名前`)と、安全の約束(D8)だけ。
2. **`BandDef` は出力形式に依らない hook だけを持つ**(Q5): `build`(構築と検査)、`measure`(測定の依頼)、`layout`(配置)、`emit`(**SVG**。SVG が基本の形式)、`verify` / `rules`(検査と規則)、`inventory`(ADR 0078 の目録)、`reveal`、`ids` / `anchors`、`spec`(schema、example、spec からの構築)、`docs`。**PPTX・Excel・HTML のコードは `BandDef` に入れない。** 帯を import しても、出力形式のコードは付いてこない(D6)。
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
  spec: {schema, example, build, check},
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
| `spec`(`schema`、`example`、`build`、`check`) | spec(20)、`partCatalog()`、MCP | spec に出すなら**必須**。出さないなら `spec: false` | `spec: false` なら catalog にも出ない。**登録のときに、spec の検査器が理解しないキーワード(`pattern`・`anyOf`・`$ref`・`format` など)があれば拒む**。`example` は適合テスト(U6)で「問題なく描ける」ことを見る |
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

1. **決定性と冪等**: 同じ入力は同じバイト列。`layout` を、**幅・`roles` の倍率・折り返しの方式を変えた環境で A, B, C, A, B, A の順に**呼んでも、入力の深いコピーから呼んでも、同じ(試作の `conformance()` が確認。壊れた 3 つのプラグインを落とした)。`laid` は `structuredClone` できる。**本物の `fill` / canvas / `width: 'fit'` の通過での確認は U2 の後**(このスパイクでは再現できない)。
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
7. **他の帯に触れない**: hook は帯の `data` と `env` だけを受け取り、他の帯・図の状態は渡さない。

### D3. 入口とパッケージの構成 — 中核、帯ごと、出力形式、バックエンド

**推奨(Q4)**: `package.json` の `exports` に入口を足し、**`"sideEffects": false`** を入れる(今は指定なし)。既存の入口は**互換のため残す**(全部入り)。

| 入口 | 中身 | 備考 |
|---|---|---|
| `svg-diagram/core` | パイプライン(測定 → 配置 → 検査 → 描画)、`BandDef` と帯の値の型、`connect`、検査の枠組み、重ねの枠組み、トークン、文字の配置、`pluginBands` | **帯を 1 つも import しない**。純粋(`node:*` なし) |
| `svg-diagram/bands/<名前>`(`box`、`row`、`group`、`comic`、`gantt` …) | 帯の `BandDef` と DSL の構築関数 | 他の帯を import しない(共有は `core` か、小さな共有モジュールだけ)。**1 帯 1 入口** |
| `svg-diagram/bands`(まとめの入口) | 全部の帯の再エクスポート | `"sideEffects": false` の前提でのみ使う便宜の入口 |
| `svg-diagram/measure/browser`、`svg-diagram/measure/node` | 測定器(ブラウザの `svgMeasurer` / `canvasMeasurer` 3 KB、Node の HarfBuzz 83 KB ほか) | バックエンド(D7) |
| `svg-diagram/pptx`、`svg-diagram/pptx/bands/<名前>` | PPTX の書き出しの枠(zip、パッケージ、スライド、コネクタ、テンプレート)と、**帯ごとの adapter** | 出力形式(D6) |
| `svg-diagram/xlsx`、`svg-diagram/xlsx/bands/<名前>` | Excel の書き出し(ADR 0068)と、帯ごとの adapter | 同上 |
| `svg-diagram/html`、`svg-diagram/html/bands/<名前>` | HTML の書き出しと adapter | 同上 |
| `svg-diagram/png` | PNG(`resvg`) | バックエンド |
| `svg-diagram/spec`(`renderSpec(spec, {bands})`)、`svg-diagram/spec/edge` | JSON の spec の入口。**使う帯を渡す**(D9) | 全部入りの一覧も出す(下) |
| `svg-diagram`、`svg-diagram/browser`、`./render`、`./pptx/edge` ほか(**今の入口**) | **全部入り**。全部の帯と、全部の adapter、全部の帯の一覧 | 互換。大きさは今と同じ(増やさない。予算) |

- **全部入りの入口は、`core` + 全部の帯 + 全部の adapter** を束ねる薄い入口として作る(中身は同じコード。重複しない)。
- 帯の入口と `core` の依存の向きは**一方向**(帯 → core)。`test/band-boundaries.test.ts`(新しい検査)が、`core` のモジュールが帯のモジュールを import していないこと、帯が他の帯を import していないことを見張る(`test/core-purity.test.ts` の仲間)。
- 型の互換: 全部入りの入口は、今の `Band` / `LaidOutBand` の合併型を**そのまま出す**(利用者の型は変わらない)。`core` の中は、帯を**型で列挙せず**、`BandValue` を一般に扱う(D5)。

### D4. 帯の値から呼ぶ — パイプライン、コピー、移行中の派生の表

- **帯の値** = 今までの帯のオブジェクト(`type` と各フィールド)+ `[DEF]`(定義への参照。列挙できるシンボルのプロパティ)。`type` の文字列は残す(`b.type === 'group'` を使う既存の読み手、エラーメッセージ、`data-*` はそのまま)。JSON からの `DiagramData` にも `type` がある場合は、**渡された帯の一覧(D9)で `type` から定義を引き直す**(定義が無ければ D9 のエラー)。
- **パイプライン(`core`)**: 測定は `band[DEF].measure`、配置は `band[DEF].layout`、描画は `band[DEF].emit`、検査は `band[DEF].verify`、reveal は `band[DEF].reveal`、id は `band[DEF].ids`、子は `band[DEF].children`。`layoutHandlerFor` の**箱のフォールバックは削除**し、定義の無い帯は投げる(U1 のテスト: 未知の `type: 'x:y'` が箱にならない)。
- **コピーで定義を落とさない**: `detachData`、`rewrite`、`withNodeIdsBand`、`placedBand` などの**帯をコピーする関数**は `[DEF]` を引き継ぐ(`SOURCE` と同じ扱い。**1 つの `copyBand` に集める**)。U1 に「全部のコピー経路で `[DEF]` が残る」テストを置く。
- **配置の中で他の帯の中身を見る規則**(重なりの検査、スポットライト、reveal、目録)は、**`switch` をやめ、帯が返す一般のデータだけで書く**: `rects`(検査の長方形)、`anchors`、`texts`、`inventory`(0078 の目録)、`children`。得るもの: `core` が帯を知らなくてよい。失うもの: **帯の種類ごとの網羅的な `switch`(コンパイラが抜けを教えてくれる)が、hook の呼び出しになる**(D5)。帯をまたぐ規則は、`inventory` と `rects` のような**一般のデータ**で書く(今の ADR 0078 の目録が、その形)。
- **移行の間の「派生の表」**(D10): `LAYOUT_HANDLERS` などの表は、**移行した帯を表から外し**、`layoutHandlerFor(band) = band[DEF]?.layout ?? 表[band.type]` とする(移行していない帯は表のまま)。全部入りの入口は、**定義の一覧から表を作り直した「派生の表」を、互換のために出す**。移行が終わったら、中央の表と `ALL_BANDS_*` を消す。

### D5. 型 — 全数性は表から `BandDef` へ移る。何を得て、何を失うか

**推奨(Q1)**:

- **帯ごとの全数性は `satisfies BandDef<D, L>`**: 必須の hook が 1 つでも抜けた帯は、その帯のファイルでコンパイルが落ちる。**表(A)の `satisfies {[T in …]}` と同じ強さが、帯の側に移る**。
- **全部入りの入口は、「`Band['type']` の全部に定義がある」を型で守る**: `const ALL_BANDS = {box: boxDef, …} satisfies {[T in Band['type']]: BandDef}`(全部入りの入口だけにある 1 つの表)。**コアの帯を足して定義を作り忘れると、全部入りの入口でコンパイルが落ちる**。`core` はこれを import しない。
- **失うもの**: (1)**`core` の中の網羅的な `switch`**(帯の種類を列挙して、抜けをコンパイラが教える仕組み)は、**hook の呼び出しになる**。「この帯の種類にこの hook を足し忘れた」は、**型の必須の hook**(抜ければ帯のファイルで落ちる)と、**任意の hook の既定**で守る。(2)**帯をまたぐ規則**(重なりの検査、スポットライト、reveal など)は、他の帯の中身を型で見られない。**一般のデータ(`inventory`・`rects`・`anchors`・`texts`・`children`)で書く**。(3)`RuleId`(コンパイル時に閉じた規則の id)は、**全部入りの入口でだけ合成する**(`core` は規則の id を `string` で扱い、`accept` の型は全部入りでは今と同じ、`core` と外部の帯では `string`)。
- **`Declares<Id>`(`connect()` の id の型検査)は、構築関数の戻り値の型で運ぶ**: `BandValue<'box'> & Declares<Id>`。最上位・`group`・`row`・`areas` の中で通り、裸の綴り間違いは拒まれる(スパイクで確認)。**ドット付きの部品の id(`rate.s2`)は型では検査されず、実行時だけ**(ADR 0012 と同じ)。
- **外部の帯の型**: 外部の帯は、**コンパイル時に知らない**。`Band` の合併型には入らず、`BandValue<string>`(型の名前は文字列)として流れる。コアの帯は今までどおり合併型にいる。ラウンド 1 の確認: 実際の合併型に封筒を足すと壊れるのは 10 個の表(と派生の行)だけだった。**`BandDef` の方式では封筒の帯の種類は不要**(表が帯の値からの呼び出しに置き換わる)。
- **コンテナ**: 外部の帯は**他の帯を持てない**(`children` は外部の帯では不可)。**ただし `group` / `grouprow` / `areas` / `row`(箱でない子は `group` に包まれる)の子にはなれる**(スパイクで描け、型も通る)。**`grid` は箱だけ**なので入れない。ADR 0078 の `FlowBand`(`Exclude<Band, OverlayBand>`)に含まれ、重ねの帯にはならない(v1)。

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

**ブラウザの Artifact でマンガだけを描くなら、`core` + `bands/comic` + `measure/browser` だけ**を引く(見積もり 130〜160 KB)。`pipeline.ts` が HTML の出力を全部引く問題(上の測定で 306 KB)は、**HTML を `svg-diagram/html` に出し、パイプラインは SVG だけ**にして直す(U の `core` の切り出しの一部)。

### D8. 安全 — 外部の帯(プラグイン)はコード。JSON はコードを読み込まない

コアの帯と外部の帯の**唯一の違い**は、この節の安全の約束(と `id:kind` の名前)である。

1. **spec(JSON)は、コードを読み込まない。** 呼び出す側(DSL を書く人、CLI の `--plugin`、プロジェクトの設定、サーバーの設定)だけが、帯の一覧(D9)を渡す。spec にできるのは、渡された帯の名前を名指しすること。`import()` の URL も、パスも、spec には書けない。
2. **MCP は、サーバー側の許可リスト**。サーバーは、ビルド時に**静的に** `import` したプラグインのうち、設定で有効にした物だけを `renderSpecEdge` に渡す(静的 import なので、使わないプラグインは Worker の束にも入らない)。`specSchemaFor({bands})` と `list_diagram_parts` は**許可した物から**作る。既定は**プラグインなし**(コアの帯だけ)。有効にするのは、権利と品質の確認のあと(Q12)。
3. **外部の帯の SVG は、外部の SVG と同じ門(本物の `sanitizeBody`)を通る。** ホストは `sanitizeBody(svg, where, /*allowColor*/ true)` を呼ぶ。`sanitizeBody` が認めるのは、図形(`path` / `circle` / `ellipse` / `rect` / `line` / `polyline` / `polygon`)、グループ、`defs`、グラデーション、クリップパスと、許可した属性だけ。**`data-*` 属性も拒む**ので、`data-node` はプラグインに書かせず、**ホストが `anchors` から書く**。`text`・`style`・`script`・`use`・`image`・`foreignObject`・`mask`・`filter`・外への参照・名前つきの色・`rgb()` は拒まれる(スパイクで確認)。加えて、ホストが **1 つの帯の中の id の重複**を拒む。通らない出力は、`band-svg-rejected`(エラー)で、帯の場所にプレースホルダー(破線の長方形)を描く。**文字は `texts` の経路(D2)でコアが描く**。**コアの帯は、今までどおり自分で `<text>` を出してよい**(信頼する)。
4. **id は衝突しない**(D2)。
5. **外部の帯の中の失敗は、壊れた出力にしない。** hook が投げたら、ホストが**プラグインの名前・帯の種類・段階(build / measure / layout / emit / verify)を付けて**包む(`BandError`)。**`layout` は、結果を最後まで求めてから** `ctx`(カーソル、anchor の登録)を変える。`check` / `renderDiagram` / `renderInBrowser` の経路では、投げずに `band-failed`(問題)として verdict に入れ、その帯は**高さ 48px の破線のプレースホルダー**で描く(今の `renderInBrowser` の「配置のエラーは投げる」を、外部の帯に限って変える。U4 で明記する)。DSL の構築(`build`)は、今までの DSL と同じく投げる。
6. **資源**: 1 つの帯の SVG と anchor の数に上限(D2 の 6)。同期の関数だけ(`async` の hook は不可)。**止まらない同期の hook は、コアには止められない**: Worker では CPU の上限で、Node では呼び出しの側のタイムアウトで終わる(サーバーに載せるプラグインを許可リストで限る理由の 1 つ)。
7. **規則と `--strict`**: 帯は、自分の `rules` に宣言した規則だけを出せる。`diagram({accept: {'rating-demo/value-over-max': '理由'}})` で、コアの規則と同じく受け入れを書ける。`check --explain rating-demo/value-over-max` は、プラグインが渡されている(`--plugin` か設定)ときに説明を出す。

### D9. 帯の渡し方 — 呼び出しごと(グローバルにしない)+ プロジェクトの設定。spec の入口

**推奨(Q6、Q7): 呼び出しごと。グローバルの登録簿は作らない**(ADR 0074 D3)。DSL では、**使う帯を import するだけ**(帯の値が定義を持つので、登録も一覧も要らない)。一覧が要るのは、**帯の値を持たない入口**(JSON の spec、`DiagramData` の JSON、デッキ、markdown の囲み)だけで、そこには**帯の一覧(`bands`)**を渡す。

- **spec(JSON)**: `renderSpec(spec, {bands: [box, row, comic]})`(最小の経路)。`bands` を渡さないときの既定は**空**(明示を要求する)。**全部入りの入口(`svg-diagram`、`./spec/edge`)は、全部の帯の一覧を既定で渡す**(今までの呼び出しがそのまま動く)。外部のプラグインは、`bands` に加える(`[...allBands, ratingDemo]`、または `{bands, plugins}`)。
- **spec が名指しした帯が、渡されていないとき**は、**黙って捨てない。黙って箱にもしない**。次の形の**明確なエラー**(コアの帯も外部の帯も同じ)。
  ```
  the band type "rating-demo:stars" is not available: plugin "rating-demo" was not supplied
  (pass it as diagram({plugins: [...]}) / renderSpec(spec, {bands: [...]}) / --plugin / the project config; a spec never loads code).
  Available: box, row, group, comic
  ```
  (日本語の版も出す。)`validateSpec` では `SpecIssue`(`path: parts[2].type`)として返り、LLM が直せる。MCP では、**使えるものの一覧**を返す。
- **プロジェクトの設定の `plugins`**(`.svg-diagram.json`。`lib/config.ts`): 例 `{"plugins": ["./plugins/rating-demo.ts", "manga-face"]}`。呼び出しのコードを持たない入口が**読み込んで** core に `bands` / `plugins` として渡す(core は読まない。ADR 0031 の殻の仕事)。パスか npm の名前。読み込みの失敗はエラー。呼び出しの指定は設定を**上書き**する。設定は呼び出す側の持ち物で、spec ではない(D8 の 1)。

| 入口 | 渡し方 |
|---|---|
| DSL(`.ts`) | 使う帯を import する。外部の帯は `pluginBands(plugin)` で作り、`diagram({plugins: [plugin]})` に渡す(構築関数の定義と食い違えばエラー) |
| `renderSpec` / `specToDiagram` / `validateSpec` / **`renderSpecEdge`**(MCP の Worker) | `{bands, plugins}`。Worker は、ビルド時に静的に import した許可リストを渡す |
| ブラウザ | `renderInBrowser(diagram(…), {measure})`(図が帯の値を持つ)。`DiagramData` から直接なら `{measure, bands}` |
| `renderComic` | `renderComic(sheet, {measure, characters, plugins})`(D11) |
| CLI のうち `.ts` を読む物(`build` / `check` / `show` / `lint` / `notes` / `pptx`) | 図の `.ts` が自分で帯を import する |
| CLI のうち JSON / Markdown を読む物(**`pptx-deck`、`serve`、`site`、`md`、`deck`**) | `--plugin ./x.ts`(繰り返し可)と、設定の `plugins`。**帯の一覧は、全部入りを既定**にし、最小にしたいときは設定で `bands` を絞る |
| `check --drift --jobs N` の**子プロセス**(`drift-pool.ts`) | 親の `--plugin` と設定を**子に渡す**(渡さないと、子が未供給のエラーになる) |
| `./render`、`./markdown`、`./markdown-it`、`./remark`、`./vitepress` | オプションの `plugins` と設定。囲みのコードブロックは設定を使う |
| デッキ、`site`、PPTX の edge(`./pptx/edge`、`./pptx/deck/edge`)、VS Code の拡張のプレビュー | 設定の `plugins`。PPTX の edge には呼び出しの `plugins` も通す |
| 静的な `./schema/*.json` | **プラグインを含まない**(コアの帯だけ。生成物)。**プラグインを含むスキーマは `specSchemaFor({bands, plugins})` だけ** |
| `worker/`(発表の配信) | 描画しないので、何も要らない(ADR 0056) |

**キャッシュにはプラグインの版を入れる**: (1)デッキの描画のキャッシュ(`lib/present/render-deck.ts` の、スライドの JSON と設定の sha256)、(2)drift のキャッシュ(`drift-cache.ts`)、(3)`check --drift --jobs` の子プロセス。**プラグインの id と `version` を、キーに混ぜる**(混ぜないと、プラグインを更新しても古い出力が使われる)。

### D10. コアの帯を `BandDef` に移す — これが主線(ADR 0080 の以前の案の Q7 を**逆にする**)

**推奨(Q2、Q3):**

**以前の案(ラウンド 1〜2)は「コアの帯は移さない」(コンパイル時の全数性を失うため)だった。決める人の要件(使う帯だけを束ねる)は、中央の表が全部の帯を引くことが原因なので、移行が主線になる。** 全数性は `satisfies BandDef` と全部入りの入口の表(D5)で保つ。

**進め方(1 帯 1 PR。golden はバイト単位で同じ):**

| 段階 | 内容 | 帯 |
|---|---|---|
| M0 | **枠組み**(帯の値、`[DEF]`、`core` の切り出し、`copyBand`、派生の表、`test/band-boundaries.test.ts`、予算の検査、`sideEffects: false`)。追加のみで、どの帯も移さない。**ADR 0078 U2 の前でも始められる**(追加のみ。表は触らない) | — |
| M1 | **葉の帯**(anchor・子なし・reveal だけ)で、枠組みを実物で試す | `spacer`、`caption`、`status`、`raw`、`legend`、`banner` |
| M2 | **箱**(`box`。anchor、アイコン、ステップ、タグ。`placeBoxLike` を帯の中に移す。最も多くの帯が使う) と、その近く | `box`、`pyramid`、`curve`、`people`、`dots`、`wordart`、`math` |
| M3 | **コンテナ**(`children` の hook、`STACK_WIDTH`、`row()` の包み、`areas`) | `group`、`row`、`grid`、`areas`、`grouprow`、`image`(`children`) |
| **M2c(マンガ)** | **`comic`**。決める人の最初の用途(Artifact が 1 MB)。自分のフォルダ(`lib/comic/`)で閉じていて、純粋な配置を持つ。**M2 の `box` の次に移す**(M3 を待たない)。ADR 0078(重ね)が動いている間は、ふきだしの重ねの結合を壊さないよう、0078 の U2 を待つ(Q3) | `comic` |
| M4 | **anchor・reveal・spec・検査を持つ図形の帯** | `flowShape` の 7 種(1 つの PR にまとめる。`flow-shapes.ts` を共有)、`quadrant`、`timeline`、`gantt`、`bars`、`plane`、`chart` |
| M5 | **表・列・画面の帯** | `sequence`、`table`、`swimlane`、`wireframe`、`screens` |
| M6 | **図式の帯**(重い。専用の配置の枠組みを持つ) | `tree`、`states`、`cause`、`cloud`、`classes`、`bpmn`、`fta`、`bowtie` |
| M7 | **後片付け**: 中央の表と `ALL_BANDS_*` を消す。`rules.ts` を枠組みだけにする。`CHECK_PHASES` を帯の定義へ | — |

**各 PR の基準(全部を満たす):**

1. **golden がバイト単位で同じ**(`examples/out/` の SVG、PPTX の golden、`pnpm schema` の出力)。移行の PR で見た目は変えない。
2. 移した帯の**表の行を消し**(`satisfies BandDef` に置き換え)、**派生の表**(D4)に載せ替える。表からの呼び出しと帯の値からの呼び出しが、移行の間**同じ結果**になる(テスト)。
3. **帯の入口の大きさを記録**し、予算(D12)に収まる。**帯が他の帯のモジュールを import しない**(`test/band-boundaries.test.ts`)。付け根(`reveal.ts → band-ids.ts → quadrant.ts` のような帯の共有モジュールの余計な import)を、その PR で切る。
4. `rules`・`RULE_DOCS`・`RULE_LOCATION` の中身は**今の規則の id のまま**。`check --explain` が同じ。
5. 新しい検査: 帯の定義の適合テスト(D2 の保証 1・3・5・6 を、**コアの帯にも**かける)。
6. **変異**を 1 つ以上当てて落ちることを PR に書く。
7. その帯の PPTX・HTML・(あれば)Excel の **adapter** を、同じ PR か、すぐ次の PR で `bands/` の隣に分ける(D6)。**表の行が出力形式の側に残る間は、移行が終わったとは数えない**。

**1.0 の条件(Q10)**: 「**コアの帯を N 個、golden がバイト単位で同じまま移し終え**(N の推奨は、M1 の全部、M2 の `box`、M3 の `group`・`row`、`comic`、M4 から `quadrant` と `flowShape` の 1 種 = 少なくとも 12 個)、**かつ**、参照プラグイン(U6)が**全部の hook を通し**、**manga-face(外部の実物。別リポジトリ、npm、jsDelivr の Artifact)が動く」。確認表:

| hook / 性質 | 確かめる実物 |
|---|---|
| `build` / `spec` / spec の往復 / `example` | 参照プラグイン(U6)、移した帯 |
| `ids` / `anchors` / スコープ / `connect()`(最上位・`group`・`row`・`areas`) | 参照プラグイン(U2、U6)、`box`、`quadrant` |
| `measure` / `texts` / `wrapText` / `band-text-unmeasured` / `roles` の拡大(`fill`・canvas・`width: 'fit'`) | 参照プラグイン |
| `emit` / 門 / id の接頭辞 / ダークモード(トークンの色と `paper` と `paper` の文字) / `selfDimming` と `dim` | 参照プラグイン |
| `verify.rects` / `check` / `rules` / `accept` / `--strict` / `contrast` | 参照プラグイン、`quadrant` |
| `inventory` / `reveal` / `nodeIds` | 参照プラグイン、移した帯 |
| 出力形式の adapter(PPTX・HTML・Excel)と、adapter 無しの既定と報告 | 参照プラグイン、移した帯 |
| 実在の外部の制作物(別リポジトリ、npm、jsDelivr の Artifact) | `manga-face`(U17 と ADR 0079) |
| 入口ごとの大きさの予算(D12) | 移した帯の入口 |

確認表が埋まり、`1.0` の前に Opus のレビューが収束してから、API を `1.0` にする。

### D11. 狭い拡張点 — 人物の提供元と、追加の表情(同じプラグインのオブジェクトの中)

**人物の提供元(`characters`)**。`characters: {face: {schema, make(params) → CharacterManifest}}`。`make` の結果は、**必ず `loadCharacter` を通る**(権利の必須、断片の掃除、箱とアンカーの検査。手で書いたマニフェストと同じ門)。使い方は 2 通り。

1. **関数として呼ぶ**(コアの変更なし。今でも使える): `comic(sheet, {characters: {peep: mf.characters.face.make({…})}})`。ADR 0079 の「別パッケージ + `CharacterManifest`」の形そのもの。プラグインの仕組みは要らない。
2. **spec に書く**(JSON、LLM 向け。U15): ワークシートの `cast.me.character = {provider: 'manga-face:face', params: {…}}`。`comic(sheet, {plugins})` / `renderComic(…, {plugins})` が、渡されたプラグインから解決し、`loadCharacter` に通す。**結果の人物は図ごと**(ADR 0074 D3 のまま。グローバルに持たない)。未供給なら D3 のエラー。

**追加の表情(`expressions`、任意、U16)**。`ComicExpression` は今 8 種の閉じた合併型(`EXPRESSIONS`)。プラグインは `expressions: ['manga-face:shy', …]` のように**名前空間つき**で足せる。ワークシートの舞台は `expression: 'manga-face:shy'` と書き、その表情の断片を持たない人物では `neutral` に落として `comic-expression-fallback`(助言)を出す。ADR 0079 の Q8(「追加の表情は後で」)と同じ時期に決める。コアの 8 種は変えない。

**ADR 0079 の manga-face がこれをどう使うか**: 別のリポジトリ `manga-face`(npm)が `definePlugin({id: 'manga-face', …})` を出す。

- 帯 `manga-face:avatar`: 顔 1 つ(パラメータ、表情、大きさ)。顔の生成(ADR 0079 の `face.ts`)をそのまま `layout`(大きさと anchor `head`)と `emit`(図形)に使う。
- 帯 `manga-face:faces`: 顔の一覧(見本帳、名前つき。名前は `texts`)。
- 人物の提供元 `face`: パラメータ → `CharacterManifest`(ADR 0079 の `faceManifest`)。`comic()` に渡す。
- 追加の表情(任意、U16)。

ADR 0079 は**中身の設計としてそのまま有効**(D2〜D7)。変わるのは D1 の「svg-diagram 側の変更はない」で、**svg-diagram 側に `svg-diagram/plugin`(型)と `svg-diagram/core` が入り、`manga-face` はそれを使う**。API が入る前でも、1. の関数呼びで `comic()` につながる(つまり ADR 0079 は、この ADR を待たずに進められる)。

### D12. 配布と大きさの予算 — npm、jsDelivr の Artifact、MCP、CI の検査

- **npm**: 外部のプラグインは普通のパッケージ(`manga-face`)。`peerDependencies: {"svg-diagram": "…"}` は案内で、実行時の検査は `apiVersion` と `requires`(D1)。**実行時に svg-diagram を import しない**ので、peer の版の食い違いで 2 つのコピーが動く問題が起きない。型は `svg-diagram/plugin`(型のみ)から `import type` で取る。
- **Artifact(jsDelivr)**(マンガだけを描く例。見積もり 130〜160 KB):
  ```js
  const [{renderInBrowser, diagram}, {comic}, {svgMeasurer}] = await Promise.all([
    import('https://cdn.jsdelivr.net/npm/svg-diagram@X.Y.Z/dist/lib/core.js'),
    import('https://cdn.jsdelivr.net/npm/svg-diagram@X.Y.Z/dist/lib/bands/comic.js'),
    import('https://cdn.jsdelivr.net/npm/svg-diagram@X.Y.Z/dist/lib/measure/browser.js'),
  ]);
  ```
  外部のプラグインを使うときは `import('…/manga-face@A.B.C/dist/plugin.js')` を加え、`pluginBands(mangaFace)` で構築関数を作り、`diagram({plugins: [mangaFace]})` に渡す。**帯ごとの入口は ES モジュールのファイル**なので、jsDelivr から**使う帯のファイルだけ**が読まれる(ブラウザ側の tree shaking)。**注意: core の jsDelivr の動作確認(CDN のプローブ)は、まだ終わっていない。** Artifact での通し確認(U17)は、そのプローブが済んでから行う。生成済みの JSON(1 人分 48.7 KB、gzip 3.5 KB。ADR 0079)を貼る方法も、プラグインなしで引き続き使える。
- **供給の安全**: `import()` は SRI(`integrity`)を持てない。(1)**版は完全に固定**(`@A.B.C`。範囲や `latest` は使わない)、(2)外部の配布物は**import の無い 1 つの自己完結した ESM**にする(適合テストが `import` / `require` の文を探して拒む。jsDelivr の `+esm` の依存の書き換えは使わない)、(3)任意の追加の防御として、ページが `<script type="importmap">` の `integrity` で固定してよい。許可リストと設定は、npm の名前と版を人が決める。
- **MCP**: MCP のサーバー(別のリポジトリ `svg-diagram-mcp-plugin`)が、有効にするプラグインを**ビルド時に静的に import** して許可リストに入れ、`renderSpecEdge(spec, {bands, plugins})` に渡す(D9)。使う帯だけを `bands` に渡せば、Worker の束も小さくなる(`./spec/edge` は今 1213.5 KB)。`list_diagram_parts` は、許可した帯の部品を(プラグインなら `plugin: 'manga-face'` つきで)返す。

**大きさの予算(入口ごと、組み合わせごと。CI で検査する)**(Q11):

- `scripts/bundle-size.ts` が、**入口と代表の組み合わせ**を esbuild(ブラウザ向け、minify)で束ね、`bundle-budget.json` の上限と比べる。上限を超えたら **CI が落ちる**(PR に表を出す)。**上限は「下げる方向にだけ」更新する**(移行の PR ごとに、測った値に合わせて下げる。上げるには決める人の承認)。
- **最初の上限(見積もりの 20〜25% の余裕。M0 の測定で置き換える)**:

  | 入口 / 組み合わせ | 上限(KB。minify) | 今 |
  |---|---|---|
  | `svg-diagram/core` | 120 | — |
  | `bands/box` | 25 | — |
  | `bands/row` | 20 | — |
  | `bands/comic` | 60 | — |
  | `measure/browser` | 5 | 3.0 |
  | マンガ + ブラウザの測定器 | 190 | 1036 |
  | 箱・行 + ブラウザの測定器 | 170 | 1032 |
  | 箱・行 + PPTX | 300 | 1301(`./pptx/edge`) |
  | 箱・行 + Excel | 260 | — |
  | 全部入りのブラウザ(`./browser`) | **1100**(今の 1042 の +5%) | 1042 |
  | 全部入りの Node(`.`、依存は外) | **1150** | 1081 |

  移行前は、組み合わせの上限は**まだ満たせない**ので、M0 では「全部入りの上限(増やさない)」だけを CI に入れ、各組み合わせの上限は、**その帯が移った PR で有効にする**(例: マンガの組み合わせは M2c で)。
- **消費側のバンドラでの試験**: 予算の検査は、`package.json` の `exports` を通して(`dist/` を入口にして)**esbuild と Vite(Rollup)の両方**で束ね、`sideEffects: false` と入口の分け方が実際に効いていることを確かめる(上の測定のケース B・C・G の再現)。

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
- コアに足すもの: `svg-diagram/core`(パイプライン、`BandDef`、帯の値、`pluginBands`、`copyBand`)、帯ごとの入口、出力形式の入口と adapter、バックエンドの入口、`package.json` の `exports` と `sideEffects: false`、`test/band-boundaries.test.ts`、`scripts/bundle-size.ts` と `bundle-budget.json`。中央の表は移行の間は派生の表、終われば削除。`layoutHandlerFor` の箱のフォールバックの削除。
- 変わらないもの: 今の公開の入口(全部入り。大きさは増やさない)、コアの帯の API、golden(移行の各 PR で不変)、`schema/*.schema.json`(プラグインを渡さない既存の経路)、規則の id。
- 公開の約束が増える: `BandDef` / プラグイン API の semver(D1)。`0.x` の間は破壊的変更あり。入口の名前(`core`、`bands/*`、`pptx/bands/*` …)。
- ADR 0068(Excel)の D2 を改訂する(D6。Q11)。ADR 0078 の U2 以降が触る型と表は、移行の PR の順序で調整する(Q3)。

## 実装計画

U0 は、この PR。U1 以降は、どの単位も Opus のレビューで Blocker と Major がなくなってからマージする。**移行の PR(U8〜U14)は、帯ごとに 1 つで、D10 の基準を全部満たす。**

| 単位 | 内容 | 完了の基準 | テスト |
|---|---|---|---|
| U0 | ADR とスパイク(この PR) | スパイクの測定(上の表)。表の一覧。バンドルの測定。`typecheck` が通り、golden が不変 | `spikes/band-plugin/` の各スクリプト |
| U1 | **枠組み(M0)**: `svg-diagram/core` の切り出し(**`pipeline.ts` が HTML を引かないようにする**。`rules.ts` / `dsl/text-bands.ts` の `walkBands` の依存を切る)、`BandDef` と帯の値(`[DEF]`)、`pluginBands`、**`copyBand`**、**派生の表**(表からの呼び出しと帯の値からの呼び出しが同じ結果)、**`layoutHandlerFor` の箱のフォールバックの削除**、`test/band-boundaries.test.ts`、`package.json` の `exports`(`core`、`plugin`)と `"sideEffects": false`、`scripts/bundle-size.ts`(全部入りの上限だけ有効)。**どの帯も移さない** | `typecheck` が通る。**プラグインも移した帯も無い図の出力が、バイト単位で不変**(golden)。全部入りの入口の大きさが今の +5% 以内 | 未知の `type: 'x:y'` が箱にならず投げる、**全部のコピー経路で `[DEF]` が残る**、型テスト(最上位・`group`・`row`・`areas` の `connect()`、裸の綴り間違いは `@ts-expect-error`、コアの帯の抜けは今までどおり落ちる)、`core-purity` と `web-entry` に `core` を足す、`sideEffects: false` と入口を、esbuild と Vite で束ねる試験(背景のケース B・C の再現) |
| U2 | 外部の帯のための hook: `ids`、`layout` の anchor 登録(**スコープは既定で帯の id**)、`texts` と `wrapText`、**`band-text-unmeasured`**、`inventory` の既定(`band` に plugin / kind)、`reveal` の既定、`connect()` の終点、親の幅 `w`。参照プラグインの骨組み | 参照プラグインの帯が、**最上位・`group`・`row`・`areas` の中**で描け、部品への `connect('a:bottom', 'rate.s2:top')` が通る。文字がコアの測定器を通る | **同じ種類の帯 2 つ**、各コンテナ内の部品への `connect()`、`band-anchor-undeclared`、`claimed`、`fill` / canvas / `width: 'fit'` / 折り返しのやり直しで hook を何度呼んでも同じ結果(冪等)、測っていない文字は `band-text-unmeasured`、文字の大きさが `roles` の拡大に従う、日本語の折り返しがコアの帯と同じ |
| U3 | 外部の帯の描画と門: `sanitizeBody`、帯の中の id の重複、id の接頭辞(**図の中の帯の位置から**)、`data-node` を**ホストが `anchors` から**書く、`selfDimming` と `dim`、**ダークモード(トークンの色、`paper`(`fill` / `stroke` / `stop-color` の 3〜8 桁の hex だけ変換、`PALETTE.bg` の下地)、`paper` の `texts` の凍結したインクの色)** | 描画が決定的。禁止の要素を出すと `band-svg-rejected` と破線のプレースホルダー。暗い図で `paper` でない固定色は `band-fixed-color` | 門の拒否(`text` / `style` / `use` / `image` / `foreignObject` / `data-*` / `rgb()` / 名前つきの色 / 外への参照 / 重複 id)、同じ帯が 2 回出ても `id` が衝突しない、`url(#id)` が壊れない、**暗い図で `paper` の帯の文字と下地のコントラスト**、トークンでない色 |
| U4 | verify と規則とエラーの境界: `verify.rects` / `check`、`rules`、`accept` の型、`band-failed`(`layout` は結果を求めてから `ctx` を変える。48px のプレースホルダー)、`--strict`、`check --explain` | 外部の帯の問題が verdict に入る。規則に説明が無いと `band-rule-undocumented`。hook が投げても他の帯の診断が続く | 問題 / 警告 / 助言、`accept`、投げる hook(`ctx` が半端にならない)、**変異**(`verify` を空にするとテストが落ちる) |
| U5 | spec と入口と設定: `renderSpec(spec, {bands})`、`specToDiagram` / `validateSpec` / **`renderSpecEdge`** の `bands` と `plugins`、`specSchemaFor`、`partCatalog({bands})`、未対応キーワードの拒否、`--plugin` と設定の `plugins`、**`pptx-deck` / `serve` / `site` / `md` / `deck` / `check --drift --jobs` の子プロセス**への配線、**キャッシュ(デッキ、drift)にプラグインの版を入れる**、markdown 系・`./render`・PPTX の edge。**静的な `./schema/*.json` はプラグインを含まない**(明記) | spec の部品が描ける。**名指しされた帯が渡されていないと、使える帯の一覧つきのエラー**。`bands` を渡さない全部入りの入口は今と同じ。`schema/*.schema.json` が不変 | spec の往復、未供給のエラー、`schema-files` の不変、`--plugin` と設定(呼び出しが設定を上書き)、`pattern` などを含むスキーマの拒否、各入口に参照プラグインを通す、**プラグインの版を変えるとキャッシュが無効になる**、drift の子プロセスが `--plugin` を受ける |
| U6 | **参照プラグインと適合テスト(必須)**: `test/fixtures/plugins/rating/`(`lib/` の外。**`import type` と `satisfies PluginDef` だけで、`definePlugin` などの実行時の値は import しない**)に、小さい新しい帯を 1 つ、D10 の確認表の全 hook を通るように端から端まで。`svg-diagram/plugin-testing` の `conformance(plugin)`: **幅・`roles` の倍率・折り返しの方式を変えて A, B, C, A, B, A の順に `layout` を呼び、同じ環境で同じ結果**、**深く凍結した入力**(書き換えれば投げる)、**測定 → 配置の本物の周期**(厳密な測定済みの集合で `band-text-unmeasured`)、**毎回新しく複製したデータの結果と共有データの結果が同じ**(環境を無視する結果の保存を検出)、`structuredClone`、門、規則の説明、anchor の一意、`example` が描ける、**2 つの帯が衝突しない**、`group` / `row` / `areas` の中、**配布物に import が無い**。U2 の後に、本物の `fill` / canvas / `width: 'fit'` の通過でも回す | 参照プラグインが適合テストを通る。**プラグインなしで描くと明確なエラー**。プラグインの作者が自分のリポジトリで `conformance(plugin)` を呼べる | 端から端のテスト、未供給のエラーの文言、**変異**(`emit` を非決定にする、`rules` の説明を消す、門を外す、`measure` の登録を消す、**環境を無視して結果を覚える / 4 回目から高さが変わる壊れたプラグイン 2 つが `conformance()` で落ちる**) |
| U7 | **出力形式の分離**: `svg-diagram/pptx`(`toPptx(d, {bands})`)、`svg-diagram/html`、`svg-diagram/zip`(PPTX と Excel で共有)、帯ごとの adapter の入口(`pptx/bands/<名前>`、`html/bands/<名前>`)。**`BAND_HANDLERS` を adapter の表に分け**、`slide.ts` の `group` / `swimlane` の特別扱いを adapter の hook に移し、**adapter 無しの既定(PPTX = 絵、HTML = SVG)と `pptx-band-fallback` / `html-band-fallback` の報告**。全部入りの `./pptx/edge` は全部の adapter を渡す。**ADR 0068 の改訂**(Excel を adapter の形で書く。D6)。Excel の adapter の骨組み(コードが入るのは 0068 の実装の PR) | **PPTX・HTML の golden がバイト単位で同じ**(全部入り)。`toPptx` に箱・行の adapter だけを渡した束が予算内。adapter の無い帯は絵になり、`pptx-band-fallback` が報告される(`strict` ならエラー) | adapter の差し替え、既定の絵、報告、`strict`、`pnpm validate:pptx`、PPTX の golden(`pptx-golden.yml`)、**変異**(adapter の表から 1 行を消すと既定の絵になり報告が出る) |
| U8 | **移行 M1**: 葉の帯(`spacer`、`caption`、`status`、`raw`、`legend`、`banner`) | D10 の基準 1〜7 | golden、派生の表の同値、境界、予算 |
| U9 | **移行 M2 と M2c**: `box`(`placeBoxLike` を帯の中へ)、`pyramid`、`curve`、`people`、`dots`、`wordart`、`math`、**`comic`**。付け根(`reveal.ts → band-ids.ts → quadrant.ts`)を切る。**マンガの組み合わせの予算(190 KB)を有効にする** | D10 の基準 1〜7。**マンガ + ブラウザの測定器の束が、予算内**(今 1036 KB) | 同上 + マンガの Artifact の束の測定 |
| U10 | **移行 M3**: コンテナ(`group`、`row`、`grid`、`areas`、`grouprow`、`image`)。`children` の hook、`STACK_WIDTH`、`row()` の包み。**箱・行の組み合わせの予算(170 KB)を有効にする** | D10 の基準 1〜7 | 同上 + 箱・行の束 |
| U11 | **移行 M4**: 図形の帯(`flowShape` の 7 種、`quadrant`、`timeline`、`gantt`、`bars`、`plane`、`chart`) | 同上 | 同上 |
| U12 | **移行 M5**: `sequence`、`table`、`swimlane`、`wireframe`、`screens` | 同上 | 同上 |
| U13 | **移行 M6**: `tree`、`states`、`cause`、`cloud`、`classes`、`bpmn`、`fta`、`bowtie` | 同上 | 同上 |
| U14 | **後片付け(M7)**: 中央の表と `ALL_BANDS_*` を消す。`rules.ts` を枠組みだけにする。`CHECK_PHASES` を帯の定義へ。全部入りの入口の「派生の表」は互換のため残す(または削除。Q) | 中央の表が無い。golden が不変 | 既存のテスト一式 |
| U15 | **人物の提供元**(DSL と `renderComic` の経路): `characters` の hook、`comic(sheet, {plugins})`、`loadCharacter` を必ず通す。**spec の `cast.x.character = {provider, params}` は、comic が spec の部品を持つ(ADR 0074 U4)まで待つ** | 参照の人物の提供元の出力が `comic()` で描ける。権利の無い人物は `comic-license-missing`。**人物は図ごと** | 提供元 → `loadCharacter` の往復、未供給、権利なし、図をまたいだ漏れなし |
| U16(任意) | 追加の表情: `expressions`、`ComicExpression` の拡張、`comic-expression-fallback` | 名前空間つきの表情が描け、持たない人物は `neutral` に落ちて助言が出る。コアの 8 種は不変 | 落ちる経路、コアの golden の不変 |
| U17 | **1.0 の確認と配布**: D10 の確認表を埋める(N 個の帯の移行 + 参照プラグイン + manga-face)。jsDelivr から `core` と帯と(あれば)プラグインを読む Artifact の通し確認(**core の CDN のプローブが済んでから**)、MCP の許可リスト(MCP のリポジトリ側の PR)、README と skill。**予算の全部の行を有効にする** | 確認表のすべての行に実物がある。Opus のレビューが収束。`1.0` | Artifact の実機の確認(決める人)、MCP のテスト(別のリポジトリ) |

## テスト方針

- **移行の同値**: 各 PR で、**golden(SVG、PPTX、スキーマ)がバイト単位で同じ**。移行の間は、**表からの呼び出しと帯の値からの呼び出しが同じ結果**になることを、その帯の例で確かめる(派生の表)。
- **境界**: `test/band-boundaries.test.ts` が、`core` が帯を import しないこと、帯が他の帯を import しないこと、出力形式の adapter が帯の入口以外を引かないことを見張る。
- **大きさ**: `scripts/bundle-size.ts` が、入口と代表の組み合わせの束の大きさを予算と比べる(esbuild と Vite の両方)。
- **適合テスト**(U6)は、プラグインの作者が自分のリポジトリで走らせる。core の CI は参照プラグインだけを走らせる。
- **変異**: 各単位で、新しいコードを壊す変異を 1 つ以上当て、落ちることを PR に書く(`AGENTS.md`)。

## 決める人への質問

| # | 質問 | 推奨 | 理由 |
|---|---|---|---|
| Q1 | 帯の定義は 1 つの形 `BandDef` にし、呼び出しは帯の値(`[DEF]`)から行う。中央の表は無くす方向でよいか | **よい**。登録式にしない。`satisfies BandDef` と全部入りの入口の 1 つの表で全数性を保つ | 使う帯だけが束ねられる(マンガ 1036 → 130〜160 KB の見込み)。登録式は `sideEffects: false` で黙って消える(測定 D)。封筒の案は束ねを直さない |
| Q2 | コアの帯の移行を主線にする(以前の案の「移さない」を逆にする) | **主線にする**。1 帯 1 PR、golden はバイト一致、派生の表で段階的に | 束ねの問題の原因が中央の表。移行の途中でも、表と帯の値が同じ結果になるので、いつでも止められる |
| Q3 | 移行の順序と最初の成果 | **葉の帯 → `box` → `comic`(最初の成果。マンガの Artifact が 190 KB 以内)→ コンテナ → 図形 → 表 → 図式**。M0(枠組み)は ADR 0078 U2 の前でも始められる(追加のみ)。`comic` の移行は 0078 U2 を待つ | 決める人の最初の用途がマンガ。`comic` は自分のフォルダで閉じている。0078 が `Band` の合併型と重ねを動かしている間は、`comic` のふきだしの重ねを壊さない |
| Q4 | 入口の構成: `svg-diagram/core`、`bands/<名前>`、`measure/{browser,node}`、`pptx` と `pptx/bands/<名前>`、`xlsx`、`html`、`png`、`zip`。今の入口は全部入りとして残す。`"sideEffects": false` を入れる | **そのとおり**。帯ごとの入口を主にし、まとめの `bands` は便宜 | `sideEffects: false` で樽も効く(測定 B)が、Rollup は樽に弱い(F / G)。今の入口を壊さない |
| Q5 | 出力形式(PPTX・Excel・HTML)を `BandDef` に入れず、出力形式の入口に帯ごとの adapter を置く。adapter が無い帯の既定: PPTX = 絵、HTML = インライン SVG、Excel = 飛ばす。いずれも報告(`strict` でエラー) | **そのとおり** | 帯を import しても出力形式が付いてこない。PPTX / HTML は表を分けるだけで済む(測定)。黙って落とさない |
| Q6 | 帯の渡し方: 呼び出しごと + プロジェクトの設定の `plugins`。spec の入口は `bands` を渡す(全部入りの入口は全部を既定) | **そのとおり**。グローバルの登録簿は作らない | ADR 0074 の約束。コードの無い入口(デッキ、markdown、`pptx-deck`、`serve`、`site`、`md`、`deck`)は設定 |
| Q7 | spec が名指しした帯が無いときは、使える帯の一覧つきのエラー(コアの帯も外部も同じ) | **そのとおり** | 黙って落とさない。LLM が直せる |
| Q8 | 外部のプラグインは「名前空間つきの `BandDef`」。コアとの違いは `id:kind` の名前と安全の約束(門、呼び出しごと / 設定、許可リスト)だけ | **そのとおり**。外部の帯は文字を `texts` で返す(`<text>` は出さない)、他の帯を持てない | 測定、フォント、ダークモード、小さい文字の検査、0078 の目録が自動で正しくなる。コアの帯は今までどおり |
| Q9 | v1 で外部の帯に何を許すか | **他の帯を持つこと(コンテナ)と重ねの帯になることは許さない。行・グループ・`areas` の子になること、`FlowBand` に含まれることは許す。`grid` は箱だけ** | 子の測定と積みは、ホストの再帰に結びつく。スパイクで 3 つのコンテナとも描けた |
| Q10 | API の版と `1.0` の条件 | **別の semver。`0.x` の間は破壊的変更あり(minor まで同じでないと受けない)。`1.0` は「コアの帯を少なくとも 12 個、golden バイト一致で移し終え、参照プラグインが全部の hook を通し、manga-face が動く」(N は決める人が決める)。Opus のレビュー収束後** | 実物で試す前に約束しない。バイト一致の移行が、API の実地の試験になる |
| Q11 | 大きさの予算を、入口ごと・組み合わせごとに CI で検査する(上の最初の上限。下げる方向にだけ更新) | **そのとおり**。全部入りの入口は +5% 以内で、M0 から有効。組み合わせは、その帯が移った PR で有効 | 束ねの回帰を CI が止める。数字は見積もりなので M0 の測定で置き換える |
| Q12 | 公開の MCP サーバーで、どのプラグインを有効にするか | **既定は 0 個。有効にするのは、権利と品質の確認の後(`manga-face` が最初の候補)** | 許可リストは安全だが、見た目と権利は別の確認 |
| Q13 | ADR 0068(Excel)を、adapter の形に改訂してから実装する(D2 の表を adapter に、D8 の zip を `svg-diagram/zip` に) | **そのとおり**。0068 の PR #373 に追記する | 0068 はコードが未実装。表を後で分けるより、最初から adapter で書く方が安い |
| Q14 | 人物の提供元(関数として呼ぶ形は今でも可、spec に書く形は ADR 0074 U4 の後)と、追加の表情(後で、名前空間つき) | **両方の経路。表情は後(U16)** | ADR 0079 を待たせない。0079 の Q8 と同じ時期 |
| Q15 | 版の門(`requires` の不一致はエラー。`apiVersion` が権威)、1 つの帯の上限(設定できる。既定 SVG 1 MB、anchor 1000) | **そのとおり** | 黙って動いて壊れるより、早く止まる。顔 64 個の見本帳が約 370 KB で収まる |
| Q16 | 全部入りの入口の「派生の表」(`EMIT_HANDLERS` など)を、移行後も互換のために残すか | **削除する**(U14)。公開 API として約束していないので、README に書いた物だけ残す | 残すと全部の帯を引く物が残る |

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

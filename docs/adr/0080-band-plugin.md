# ADR 0080: 帯のプラグイン — 外部パッケージが「汎用の新しい帯(band)」を足す仕組み(スパイク付き)

- 状態: 提案(Draft。2026-11-23。決める人の確認待ち。Q1〜Q15 は未決。設計と小さなスパイクで、`lib/` は変えていない。ラウンド 1 のレビュー(Major 8)を反映)
- 日付: 2026-11-23
- 基点: `main`(74816524。ADR 0078 U0a まで)
- 関連: ADR 0079(マンガ風の顔のライブラリ。PR #454。この ADR が D1 の「別パッケージ」の渡し方を広げる)、ADR 0074(`comic()`、`CharacterManifest`、`loadCharacter`。**人物は図ごとに渡し、グローバルに持たない**)、ADR 0031(FCIS、`lib/` は純粋な core)、ADR 0007(Ports)、ADR 0045(`svg-diagram/browser`、`renderInBrowser`)、ADR 0077 / 0078(`balloon`、重ねの帯、`FlowBand`、内容の目録)、ADR 0012(id のスコープ)、ADR 0034(`data-node`)、ADR 0069(`partCatalog`)、ADR 0071(JSON Schema)
- 範囲外: 外部パッケージが**既存の**帯の描き方を差し替えること(上書き)。プラグインの配布の場(レジストリ、検索)。プラグインの課金。他の帯を**持つ**帯(コンテナ)と重ねの帯は v1 では対象外(プラグインの帯が行・グループなどの**子になる**ことは許す。D4、Q5)。コアの帯を全部プラグインに移すこと(D6 で「しない」と決める)
- 例のデータはすべてこの ADR のための作り話(星の評価の帯 `rating-demo:stars`、「使いやすさ」「新しい画面」など。顔の例は ADR 0079 の中立な作り話の範囲)

## 背景

決める人の言葉: 「汎用の新しい band を足すことができる plugin として考えたい」。

ADR 0079 は、マンガ風の顔のライブラリを**別のリポジトリ**に置き、出力を `CharacterManifest`(JSON)にして、svg-diagram は何も変えない案を推奨した。決める人は、それより一段広く、**外部パッケージが `comic` のような帯そのものを足せる**ことを求めている。顔を 1 つ描く帯(avatar)、顔の一覧の帯、そして `comic()` に渡す人物の提供元が、同じ 1 つのプラグインに入る。

今の帯の足し方は、コアの中の**約 10 の型つきの表と、十数か所の `switch` / `if` の連なり**に、手で 1 行ずつ足すことである(次の表)。外部のパッケージからは足せない。足せるようにしつつ、**コアの帯の「抜けがあればコンパイルが落ちる」性質は残したい**。

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
| 11 | `BandLayoutHandlers`(`lib/layout-ctx.ts`)の `layoutHandlerFor` | キーが省略可。**無い型は黙って box として配置される**(`?? layoutBoxLikeBand`) | **フォールバックを削除し、未知の型は投げる**(D3)。`plugin` を明示 |
| 12 | `TEXT_RUNS`(`lib/layout-text.ts`) | 省略可(`caption` / `box` / `banner` のみ) | 不要 |
| 13 | `itemIdsOf` / `bareNodeIds`(`lib/band-ids.ts`) | 配置**前**の帯から、節の id を `switch` で取る。reveal と anchor のスコープが使う | データから id を返す仕組み(下の `ids`) |
| 14 | `withNodeIdsBand`(`lib/emit-node-ids.ts`) | `data-node` を付ける `switch` | **ホストが `anchors` から書く**(`sanitizeBody` は `data-*` を拒む。D5) |
| 15 | `drawsFrame` / `itemRect`(`lib/locations-map.ts`) | ソースの位置の地図 | 既定(枠なし、anchor の長方形) |
| 16 | スポットライトの `if` 連なり 2 か所(`lib/spotlight.ts`)、`lib/layout-metrics.ts` の連なり、`lib/focus.ts` | anchor を項目として数える帯の列挙 | `plugin` を anchor を持つ帯の側に足す |
| 17 | `lib/rules.ts` の帯別の規則(`comicRules`、`rcaRules`、`FIT_WHO`) | 帯の種類で findings を取り出す | プラグインの findings を取り出す 1 か所 |
| 18 | `RULE_DOCS` / `RULE_LOCATION`(`lib/rules.ts`)、`RuleId = keyof typeof RULE_DOCS` | 規則の id は**コンパイル時に閉じている**。`accept` もこの型 | プラグインの規則 id は開いた文字列(D2、D5) |
| 19 | `CHECK_PHASES`(`lib/verify-handlers.ts`) | 検査の phase の列(`'comic'` もここ) | `'plugin'` を 1 つ足す |
| 20 | spec: `PARTS`(`lib/spec.ts`、`lib/spec-parts/*.ts`)、`partCatalog()`、`specSchema`(**定数**)、`pnpm schema`(`lib/schema-files.ts`)、`validateOneOf` の `const` による分岐。検査器が理解するのはスキーマの部分集合(`const` / `enum` / `oneOf` / `type` / 大きさ / `items` / `properties` / `required`)で、`pattern` などは**黙って無視される** | JSON の入口。MCP の `list_diagram_parts` はここを読む | 新しい関数 `specSchemaFor({plugins})` と `partCatalog({plugins})`(既存の定数と API は変えない)。登録のとき、理解しないキーワードを拒む |
| 21 | `IN_NO_SPEC_YET`(`test/spec.test.ts`)、`test/fixtures/untested-exports.json`、`test/fixtures/rule-locations.ts`、`test/band-registries.test.ts` | 「DSL にあるが spec に無い」の台帳と、表の実行時の網羅テスト | `plugin` の行。プラグイン用の適合テスト(U6) |
| 22 | 型: `Band` / `LaidOutBand`(`lib/types/index.ts`)、`Declares<Id>` / `Refers`(`lib/strict.ts`) | 合併型、`connect()` の id の型検査 | `PluginBand`(D4) |
| 23 | 公開 API: `lib/dsl-pure.ts`(`located(...)`)、`lib/web.ts`、`package.json` の `exports` | DSL の関数の置き場。ブラウザの入口は `node:*` を持たない(`test/web-entry.test.ts`) | `svg-diagram/plugin` の入口(D1、D8) |
| 24 | ドキュメント: `README.md`、`skills/svg-diagram/references/*.md`、`docs/chatgpt-code-interpreter.md`、MCP の `list_diagram_parts` | 部品の説明 | プラグインが自分の説明を持つ(D2) |
| 25 | `lib/dsl/rewrite.ts` の `KEYS` / `NO_REVEAL`、`lib/emit-html.ts` の `kindOf`(HTML の形)、`lib/dsl/containers.ts` の `row()`(箱でない子を `group` に包む)、`lib/located.ts`(ソースの位置。構築関数を包む) | 帯の種類で reveal の書き換え、HTML の形、行の子を決める | `plugin` の行。構築関数は `located()` で包む(D1) |
| 26 | `lib/strict.ts` の `ElementCheck` / `Refers`、`lib/spec-edge.ts`(`renderSpecEdge`)、`lib/inventory.ts` の `whole` の `band: type` | 他の id の参照、MCP の Worker の入口、目録の帯の名前 | v1 に `Refers` の hook は無い(プラグインの帯は他の id を参照しない)。`plugins` を `renderSpecEdge` に通す。`whole` に plugin / kind を記録 |

つまり、1 つの帯を足す作業は、(A) の 10 か所、(B) の十数か所、型とテストに及ぶ。ADR 0074 の `comic` はこれを全部やった実例で、`lib/comic/` に 14 ファイル、表への 1 行が 10 個、`rules.ts` と `verify-handlers.ts` への分岐がある。

### ADR 0074 と 0031 から引き継ぐ約束

- **人物は図ごとに渡し、グローバルに持たない**(ADR 0074 D3、`comic({characters})`)。→ プラグインも**呼び出しごと**に渡す(D3)。
- `lib/` は純粋(`fs`・`child_process` なし。ブラウザの入口は `node:*` なし)。→ プラグインの帯も、純粋な関数だけで作れること(D2 の保証)。
- 外部の SVG は `loadCharacter` が `sanitizeBody` で掃除する(図形・グループ・グラデーション・クリップパスだけ。`text`・`style`・`script`・`use`・`image`・`foreignObject`・外への参照・名前つきの色を拒む)。→ プラグインの SVG も同じ門を通す(D5)。
- 配置の結果は、プレーンな JSON(`structuredClone` できる)。→ プラグインの `laid` も同じ(D2)。

## スパイク(`spikes/band-plugin/`。`lib/` は触っていない。ラウンド 2 で作り直した)

約 350 行で、**コアの帯の隣と、`group` / `row` / `areas` の中に新しい帯を描き、`connect()` を受け、findings を出す**ところまで、ADR の API の形(**平らなデータの `PluginDef`**、コア側が作る DSL の関数 `pluginBands`、名前空間つきの型、呼び出しごとの登録)で試した。コアは、すでにある `raw` の帯(外のコードの描画を受ける唯一の帯)に、プラグインの封筒(`{type, data, id}`)を載せて通した。つまり**薄い変換器**で、コアの表には 1 行も足していない。**SVG の門は、本物の `sanitizeBody`(`lib/icon-store.ts`)を使った**(ラウンド 1 は正規表現の代用で、証拠にならなかった)。

| ファイル | 内容 |
|---|---|
| `host.ts` | コア側の代役: `PluginRegistry`(呼び出しごと。未供給は `PluginNotSuppliedError`。API の版の検査)、`pluginBands`(プラグインのデータから DSL の関数を作り、`located()` で包む)、`sanitizePluginSvg`(本物の `sanitizeBody` + 帯の中の id の重複 + `prefixIds` + `paper`)、`withPluginFindings`(配置後に verify を回し、verdict へ併合)、`conformance`(U6 の適合テストの試作) |
| `rating-plugin.ts` | 新しい帯 `rating-demo:stars`(n / max の星)。実行時に `lib/` を import しない。**文字を出す口が無いので、ラベルは描いていない** |
| `run.ts` | 描画、`connect()`、findings、門、ダークモード、コンテナ、配置の変種、spec、未供給、API の版 |
| `typing.check.ts` | 型の全数性の実験(10 個の表に `'plugin'` を足したらどうなるか) |
| `typing.containers.check.ts` | 構築関数の型(`Declares<Id>`)を、最上位・`group`・`row`・`areas` に置いた `connect()` の型検査(コンパイルが通る)。`@ts-expect-error` の 1 行(裸の綴り間違い)は誤りのまま |
| `out/` | `ok.svg`、`measurements.txt`(時間は書かない) |

測ったこと(Node 26。`node spikes/band-plugin/run.ts`、`node_modules/.bin/tsc --noEmit -p spikes/band-plugin/tsconfig.json`)。

| 測ったこと | 結果 |
|---|---|
| コアの帯の隣 | 描けた。`verdict.ok = true`。2 回の描画の SVG は**バイト単位で同じ** |
| コンテナの中 | `group([…])`、`row([box, プラグインの帯])`、`areas('a b', {a: box, b: プラグインの帯})` のどれも描けた(`verdict.ok = true`)。`areas` の欄に入れる帯は、`id` を持てない(0069 の規則: 欄の名前が id)。`row` は、箱でない子を `group` に包む(`containers.ts`) |
| 構築関数 | `pluginBands(plugin)` が作る関数は `located()` で包まれ、帯に**ソースの位置**(ADR 0072)が付く |
| `connect()` | 最上位・`group`・`row` の中で、プラグインの帯の id を終点にして**型が通る**(`Declares<Id>`)。裸の綴り間違い(`'r1x:right'`)は拒まれる。**ドット付きの `r4.s99` は型で拒まれない**(`IdProblem` が `a.b` を通す。ADR 0012 と同じで、部品の id は**実行時だけ**の検査。D4、D2) |
| 星への `connect('a:bottom', 'rate.s2:top')` | **失敗**(`unknown anchor id "rate.s2"`)。`raw` は anchor を登録しないため。**配置の hook が要る**(D2 の `layout` が `anchors` を返し、ホストが `ctx.register`) |
| 本物の門(`sanitizeBody` + 帯の中の id の重複) | `<text>`・`<style>`・`<image>`・`data-*`・`rgb()`・名前つきの色・重複した id は**すべて拒まれ**、素直な図形(`#hex` の `fill` / `stroke`)は通った。**`data-*` が拒まれる**ので、`data-anchor` のような規約は使えない: `data-node` はホストが `anchors` から書く(D2、D5) |
| ダークモード | パレットのトークンの色(`env.color`)は**暗い側へ置き換わる**(`#1d5fa8 → #7ab2ee`)。`paper` の帯は、門を通した**後で** `#hex` を `rgb()` にし(comic と同じ)、白い下地を敷くと、`#hex` が残らず置き換えられない。**門は `rgb()` を拒む**ので、変換は門の後(D2 の 4) |
| 配置の変種 | `canvas: 'slide'`、`width: 'fit'`、`width: 360` で描いても、同じ入力は同じ出力。ただし `raw` は配置の通過のたびには呼ばない(**スパイクでは、hook が配置の通過ごとに呼ばれることは再現できない**)。冪等であることは、`conformance()`(同じ `data` から 3 回の `layout`、深いコピー、`structuredClone`、`emit` の再実行が同じ)で確かめた |
| findings | プラグインの検査が 2 件(`rating-demo/value-over-max` = 問題、`rating-demo/stars-wider-than-band` = 警告)。コアの `verifyDiagram` だけでは `ok = true`、**併合すると `ok = false`**。コアの verify に差し込む口が無いので変換器は配置後に自分で回した(`verify` の hook が要る)。説明の無い規則を出すと `rule-undocumented` |
| 高さ | `raw` は高さが**構築時に固定**。幅で高さが変わる帯は、`height-drift` の警告になる。**配置の hook が要る** |
| 文字 | `raw` の `<text>` は測定を通らない。門が `<text>` を拒むので、ラベルを描けない。**文字をデータで返す口(`texts`)が要る**。測定の厳密さ(測っていない文字は 0 幅で黙って通る)は、コアの側の挙動で、D2 の 3 で扱う(スパイクでは再現できない) |
| 未供給 | `PluginNotSuppliedError`(使えるプラグインの一覧つき)。不正なデータ: `plugin rating-demo: rating-demo:stars: label is …` |
| API の版 | `0.x` では minor が同じでないと受けない(`0.2` を `0.1` のホストに渡すとエラー) |
| **コアの表に要る 1 行の数** | **10 個の型つきの表に各 1 行。** 型の実験(`typing.check.ts`)は、**ちょうど 10 件**(各表で `Property 'plugin' is missing`)、他は 0 件。**ラウンド 1 の確認**: レビューが実際に `lib/types/index.ts` の `Band` / `LaidOutBand` に封筒を足して `tsc -p .` を回すと **22 件**の診断が出て、すべて 10 個の表・派生の `ALL_BANDS_*` / 添字の行・`test/pptx-groups.test.ts:124` にあった。それ以外は壊れなかった |
| 型の全数性 | コアの帯は今までどおり**全部のキーが必須**。`'plugin'` が 1 つ増えるだけ。プラグインの種類は型の合併型に入れない(D4) |

## 決定

### D1. 形と API のバージョン — 平らなデータの `PluginDef`、コア側が DSL を作る、`id:kind`、別の semver

**推奨(Q1、Q2、Q3):**

**プラグインは「平らなデータ + 純粋な関数」。** 実行時に svg-diagram から何も import しない(`import type` だけ)。`definePlugin` / `defineBand` は**型のための恒等関数**で、返すのは入力のオブジェクトそのもの。DSL の関数は、**コアが**プラグインのデータから作る。

```ts
// プラグインのパッケージ(rating-demo)。svg-diagram からは型だけ
import type {PluginDef} from 'svg-diagram/plugin';

const plugin = {
  id: 'rating-demo',                       // 小文字・数字・ハイフン。'core' 'svg-diagram' は予約
  apiVersion: '0.1',                       // プラグイン API の版。パッケージの版とは別(下)
  version: '1.2.0',                        // このプラグイン自身の版(出力が変わるときに上げる)
  requires: {svgDiagram: '>=0.10 <1'},     // 任意。合わなければ、両方の版を名指したエラー
  bands: { stars: {/* D2 の hook。build / layout / emit / … */} },
  characters: {/* D7 */}, expressions: [/* D7 */],   // 任意
} satisfies PluginDef;
export default plugin;
```

```ts
// 使う側(コアが DSL の関数を作る)
import {diagram, pluginBands} from 'svg-diagram';
import ratingDemo from 'rating-demo';
const rating = pluginBands(ratingDemo);                // {stars(data, opts)}: コアが作った構築関数
diagram({theme: 'blue', plugins: [ratingDemo]}).add(rating.stars({label: '使いやすさ', value: 4}, {id: 'rate'}));
```

- **`pluginBands(plugin)`(と `diagram({plugins})` が内部で使う同じ関数)がコア側にあり**、帯ごとの構築関数を返す。構築関数は、(1)`build` を**構築の時点で**走らせ、投げたらプラグインの名前を前に付ける、(2)封筒(`{type: 'plugin', plugin, kind, data, id?, scope?, reveal?, until?}`)を返す、(3)**`located()` で包まれる**(ADR 0072 のソースの位置。スパイクで確認)、(4)型は `<const Id extends string>(data: D, opts?: {id?: Id; scope?: string; reveal?: number; until?: number}) => PluginBand<'rating-demo:stars'> & Declares<Id>`。
- 型 `PluginDef` は `svg-diagram/plugin` が出す(型のみ。実行時の値は無い)。封筒は**平らなデータ**(シンボル、クラス、`instanceof`、`WeakMap` の同一性に頼らない)。これが、jsDelivr から 2 つのモジュールを読んだときにコピーが 2 つになっても安全な理由(D8)。
- **帯の型の名前は `プラグインの id:帯の名前`**(例 `rating-demo:stars`、将来の `manga-face:avatar`)。コアの型にはコロンが無いので**衝突しない**。spec の部品も同じ。規則の id は `プラグインの id/規則名`(コアの規則はスラッシュなし)。
- **版の約束(権威の順)**: (a)`apiVersion` がホストとの契約で**権威**。`0.x` の間は **minor まで同じ**でなければ受けない(スパイクで確認。`1.0` 以後は、major が同じでホストの minor ≥ プラグインの minor)。(b)`requires.svgDiagram` は core の版の範囲(受け入れ側の semver 範囲の解釈器を純粋な `lib/` に置き、ホストの版をブラウザの束にも入れる。合わなければエラー)。(c)`peerDependencies` は npm の案内で、実行時の検査ではない。(d)プラグイン自身の `version` は記録と、ホスト側のキャッシュのキーに使う。
- **API の版は core のパッケージの版と別の semver。** `0.x` の間は破壊的変更を許し、プラグインは厳密に版を固定する。**`1.0` は D6 の「hook の網羅の確認表」を満たしてから**(Q2)。

| 案 | 採らない理由 |
|---|---|
| (採用)平らなデータ + コアが DSL を作る + `id:kind` + 別の semver | 衝突しない。実行時の依存が無い。`located()` と型(`Declares`)をコアが確実に付けられる。版の約束が core のリリースと独立 |
| プラグインが自分で構築関数を作って返す(`svg-diagram/plugin` を束ねて同梱) | `located()` のソースの位置と、`Declares` の型を、プラグイン側が正しく付ける保証が無い。コピーが 2 つになる(D8) |
| `id/kind`(スラッシュ) | 規則の id(`id/rule`)と、ファイルのパスに見える |
| `id.kind`(ドット) | id のスコープの区切り(ADR 0012 の `scope.id`)と衝突 |
| 名前空間なし | 衝突する。2 つのプラグインが `stars` を持てない |
| core の semver に API の版を含める | core の軽い更新でプラグインが壊れる(または API を凍らせて core が動けなくなる) |

### D2. プラグインの帯が持つもの(必須・任意・既定)

今の表への対応。`bands.<名前>` の各 hook は、**純粋で冪等な関数**(同じ入力から同じ出力。`Date`・`Math.random`・グローバルの状態・I/O なし)。**hook は 1 回の描画の中で何度も呼ばれる**(`fitLineScale` と折り返しのやり直し、`fill` の `fontScale` の二分探索、canvas の拡大、`width: 'fit'` の最大 4 回の配置。`layout.ts`、`dsl/render.ts`、`web.ts`)。呼ぶ回数を数えたり、回数に頼ったりしてはいけない。

| hook | 対応する表 | 必須か | 既定(無いとき) |
|---|---|---|---|
| `build(input) → data` | DSL の関数、spec の `PARTS[].build / check` | **必須**。唯一の入力検査。投げるときはフィールド名を言う(コアがプラグインの名前を前に付ける)。構築の時点で走る | — |
| `schema`(コアの `JsonSchema` の部分集合)、`description`、`example` | spec(20)、`partCatalog()`、MCP | spec に出すなら**必須**。出さないなら `spec: false` | `spec: false` なら catalog にも出ない。**登録のときに、spec の検査器が理解しないキーワード(`pattern`・`anyOf`・`$ref`・`format` など)があれば拒む**(黙って無視されるため)。`example` は適合テスト(U6)で「問題なく描ける」ことを見る |
| `ids(data) → string[]` | `bareNodeIds`(13)。reveal と anchor のスコープが**配置前**に使う | anchor を持つ帯は**必須** | `[]`。配置が返した anchor がこれに無いとき `plugin-anchor-undeclared`(エラー) |
| `measure(data, m)` | `MEASURE_HANDLERS`(2) | 文字があれば | 文字なし。**文字は `m.atoms(text, size, weight, font)` だけ**。大きさは `m.roles` から取る(下の「測定」) |
| `layout(data, env) → {h, anchors, texts, paper?, laid}` | `LAYOUT_HANDLERS`(1)、`placedBand`、`ctx.register`、スコープ(13) | **必須**。`env` = `{x, y, w, widthOf, roles, theme, tones, wrap, wrapText}`。`w` は**親の内容の幅**(最上位でも、`group` / `row` / `areas` の中でも)。`anchors`(`{id, x, y, w, h}`。帯の中の名前)はホストが登録する(下の「id」) | — |
| `emit(laid, env) → svg` | `EMIT_HANDLERS`(6) | **必須**。図形だけ。ホストが**本物の `sanitizeBody`** を通し、id に接頭辞を付け、自分の包み(`data-node`)で包む(D5)。色は `env.color(key)`(パレットのトークン) | — |
| `texts`(`layout` の返す文字のデータ) | `FIT_HANDLERS`(8)、`INVENTORY_HANDLERS`(9) | 文字があれば | `[]`。各項目: `{x, y, text, size, weight?, font?, anchor?, tone?, lines?, w?, part?, reveal?}`。**文字は `<text>` で出さず、データで返し、コアが描く** |
| `verify.rects(laid)`、`verify.check(laid, ctx) → findings`、`verify.contrast` | `VERIFY_HANDLERS`(7)、`CHECK_PHASES`(19) | 任意 | `rects` は帯全体 1 つ(`ownRect` 相当)。`check` なし。findings は `{rule, severity: 'problem' \| 'warn' \| 'info', message, where?}`(プラグインに見せる重大度はこの 3 つ。ホストが `problem` → verdict の問題、`warn` / `info` → findings の `warn` / `info` に写す。コアの `advice` は `info`) |
| `rules`(`{規則名: {doc, scope: 'band' \| 'band-grouped' \| 'diagram'}}`) | `RULE_DOCS` / `RULE_LOCATION`(18) | **出す規則は全部必須** | 無い規則を出すと `plugin-rule-undocumented` |
| `inventory(laid) → items` | `INVENTORY_HANDLERS`(9) | 任意 | `texts` から `text` の項目、図形の全体を `whole` 1 つ(`band` には `plugin` と `kind` も記録する。0078 の読み手が見分けられる)。保守側(重ねの吹き出しが覆ってはいけない内容) |
| `reveal` | `REVEAL_HANDLERS`(3) | 任意 | `{stage: true}`(帯の `reveal` / `until`。anchor もその段)。**帯の部品ごとの reveal と、スポットライトの部品ごとの暗さは v1 では持たない**(帯全体で出入り、暗くなる)。`env.focus` と、anchor ごとの `reveal` の名前を予約 |
| `children` | `CHILD_BANDS`(4)、`STACK_WIDTH`(5) | **v1 では不可**(他の帯を**持つ**ことはできない。Q5)。名前だけ予約 | 子なし。`STACK_WIDTH` は `null` |
| `pptx` | `BAND_HANDLERS`(10) | 任意 | `'image'`(SVG を絵として貼る。コアの `image` の帯と同じ経路)。ネイティブは minor で |
| `docs`(`summary`、`usage`、`example`) | README、skills、`list_diagram_parts`(24) | 任意 | `description` と `example` から catalog の行を作る。プラグイン自身が自分の README / skill を持つ |

**id(ADR 0012 に従う)**: プラグインの帯の**スコープは、既定で帯の `id`**(明示の `scope` で上書きできる)。anchor を持つ帯は `id` が**必須**(無いと構築でエラー)。帯全体を `<id>`、部品を `<スコープ>.<部品の id>`(`rate.s2`)として登録する。同じ種類の帯が 2 つあっても `s1…s5` が衝突しない(U2 のテスト)。部品の id は**型では検査されない**(`strict.ts` の `IdProblem` はドット付きの id を通す。スパイクで `rate.s99` が通ることを確認)ので、**実行時の検査**(今の `connect()` の `unknown anchor id`)に頼る。型で守れるのは帯の id まで。プラグインの帯は**他の id を参照しない**(`Refers` の hook は v1 に無い)。

**測定(コアの挙動に合わせた厳密な約束)**:

- コアは、測っていない文字を**幅 0 で黙って通す**(`widthOfMeasured`。`renderInBrowser` は strict でない)。プラグインでそれを許さない: ホストは、`texts` の各項目と `widthOf` の呼び出しを、`measure` が登録した集合と照合し、**漏れは `plugin-text-unmeasured`(どの経路でもエラー)**。
- 文字の大きさは、`measure` の `m.roles`(と `layout` の `env.roles`)から取る。`fill` と canvas は `roles` を拡大して測り直し、canvas は文字の最小(`minText`)を守らせるので、**固定の px は使わない**(コアの帯が `roles` から大きさを出すのと同じ)。
- 日本語の折り返しはコアのもの(禁則、文節)を使う。**プラグインは折り返しを自分で書かず**、`env.wrapText(text, {size, weight, font, w}) → lines` を呼ぶか、`texts` の項目に `w`(折り返す幅)を書いてコアに折り返させる(返った `lines` は `laid` に入れてよい)。

**プラグインの帯が守ること(適合テスト U6 が確かめる。ホストは実行時にすべては強制できない。2 と 3 は一部のみ強制)**:

1. **決定性と冪等**: 同じ入力は同じバイト列。`layout` / `emit` を続けて何度呼んでも、入力の深いコピーから呼んでも、同じ。`laid` は `structuredClone` できる(スパイクの `conformance()` が確認)。
2. **純粋**: `node:*`・`fetch`・グローバルの状態を使わない(ブラウザの入口にそのまま載る。`test/web-entry.test.ts` と同じ検査を fixture にかける)。プラグインの配布物は、**import のない 1 つの自己完結した ESM**(適合テストが `import` / `require` の文を探す。D8)。
3. **文字はコアの測定器**: 文字は `measure` と `texts` だけ。`emit` の SVG に `<text>` があれば、門が拒む(D5)。
4. **色とダークモード**(コアの仕組みに合わせる): ダークモードは、出力の SVG の中の**パレットのトークンの `#rrggbb` を、暗い側の `#rrggbb` に置き換える**(`recolor`、`lib/tokens.ts`)。トークンでない色はそのまま残る。comic は、固定したい色を**門の後で `rgb()` にして**置き換えを避ける。プラグインの帯もこれに合わせる。
   - 既定: `env.color(key)` が返すパレットの色を使うと、ダークモードで**暗い側に置き換わる**(スパイクで確認)。
   - 固定の色(顔の肌色・輪郭など): **`layout` が `paper: true` を返した帯**は、門を**通した後**に `#hex` を `rgb()` に直し(comic と同じ)、白い紙の下地を敷く。置き換えは起きず、暗い図でも読める。`paper` でない帯がトークンでない `#hex` を使うと、暗い図で `plugin-fixed-color`(助言)。
   - **門は `rgb()` を拒む**(`sanitizeBody` は、塗りに `#hex`・`none`・`currentColor`・`url(#…)` だけを認め、`#hex` は `allowColor` のときだけ)。だから変換は門の後(ホスト)で、プラグインは `#hex` で書く。`currentColor` を拒むのは `loadCharacter` の追加の検査で、`sanitizeBody` ではない(プラグインの帯の門は `currentColor` を通すが、ダークモードの動きは U3 で確かめるまで保証しない)。
5. **id は衝突しない**: anchor の id は帯のスコープで修飾(上)。SVG の `id` は帯ごとの接頭辞(`prefixIds`)。**1 つの帯の出力の中の id の重複は `plugin-svg-rejected`**(`sanitizeBody` は重複を見ないので、ホストが調べる。例: ADR 0079 の顔が固定の `id="fc"` を使うなら、顔ごとに修飾して一意にする)。
6. **大きさの上限**: 1 つの帯の SVG と anchor の数の上限は**設定できる**(既定 SVG 1 MB、anchor 1000。顔 64 個の見本帳は、顔 1 つが 4.9〜5.8 KB(ADR 0079)なので約 370 KB で、既定に収まる)。超えたら `plugin-too-large`(エラー)。
7. **他の帯に触れない**: hook は帯の `data` と `env` だけを受け取り、他の帯・図の状態は渡さない。

### D3. 登録と範囲 — 呼び出しごと(グローバルにしない)+ プロジェクトの設定

**推奨(Q4): 呼び出しごと。グローバルの登録簿は作らない**(ADR 0074 D3 と同じ理由)。ただし、呼び出しのコードを持たない入口(JSON のデッキ、markdown の囲み、エディタのプレビュー)のために、**プロジェクトの設定に `plugins` の一覧**を置く(下)。設定は**呼び出す側が書く物**(リポジトリの持ち主が決める)で、spec(データ)ではないから、D5 の 1 は守られる。呼び出しごとの渡し方は、設定を**上書き**する。

| 入口 | 渡し方 |
|---|---|
| DSL(`.ts`) | `diagram({plugins: [ratingDemo]})`。帯は `pluginBands(ratingDemo).stars(…)`(D1)で作る。`plugins` に渡し忘れると、`add()` の検査(構築の時点)でエラー |
| JSON の spec(LLM が書く) | `{type: 'rating-demo:stars', …}`。`specToDiagram(spec, {plugins})` / `validateSpec(spec, {plugins})` / `renderSpec(spec, {plugins})` |
| **`renderSpecEdge`**(`lib/spec-edge.ts`。MCP の Worker が呼ぶ) | `renderSpecEdge(spec, {plugins})`。**Worker は、ビルド時に静的に import した許可リストを渡す**(D5、D8) |
| ブラウザ | `renderInBrowser(diagram({plugins}), {measure})`。DiagramData から直接なら `renderInBrowser(data, {measure, plugins})` |
| `renderComic` | `renderComic(sheet, {measure, characters, plugins})`(D7) |
| CLI(`build` / `check` / `show` / `serve` …) | `--plugin ./x.ts`(繰り返し可)。`.ts` の図は自分で `import` して `diagram({plugins})` に渡す |
| `./render`、`./markdown`、`./markdown-it`、`./remark`、`./vitepress` | オプションの `plugins`。囲みのコードブロックは、設定の `plugins` を使う |
| デッキ(`deck.json`)、`svg-diagram site`、PPTX(`./pptx/edge`、`./pptx/deck/edge`)、VS Code の拡張のプレビュー | 設定の `plugins`(下)。PPTX の edge には、呼び出しの `plugins` も通す |
| MCP | サーバー側の**許可リスト**。呼び出しの側からは渡せない |

**設定の `plugins`**(`.svg-diagram.json` と同じ場所。`lib/config.ts`): 例 `{"plugins": ["./plugins/rating-demo.ts", "manga-face"]}`。CLI・エディタ・描画の殻が**読み込んで**から core に `plugins` として渡す(core は読まない。ADR 0031 の殻の仕事)。パスか npm の名前。読み込みの失敗はエラー(黙って無視しない)。

**プラグインが渡されていないとき**: 黙って捨てない。黙って箱にもしない。**`layoutHandlerFor` の `?? layoutBoxLikeBand` のフォールバックを削除し、未知の型は投げる**(`ALL_BANDS_HANDLED` が全数を証明するので、既定は要らない。JSON から来た `DiagramData` に `type: 'x:y'` が紛れても、黙って箱にならない。U1 のテスト)。次の形の**明確なエラー**。

```
the band type "rating-demo:stars" is a plugin band, but plugin "rating-demo" was not supplied:
pass it as diagram({plugins: [...]}) / --plugin / the project config (a spec never loads code). Available: none
```

(日本語の版も出す。)`validateSpec` では `SpecIssue`(`path: parts[2].type`)として返り、LLM が直せる。許可リストに無いプラグインを spec が名指ししたとき(MCP)は、**使えるものの一覧**を返す。

### D4. 型 — 封筒の 1 つの帯の種類で、コアの全数性を残す

**推奨(Q1): コアに帯の種類 `plugin` を **1 つだけ**足す(封筒)。** `Band` に `PluginBand`(`{type: 'plugin', plugin, kind, data, id?, scope?, reveal?, until?}`)、`LaidOutBand` に `LaidOutPlugin`(`{type: 'plugin', plugin, kind, x, y, w, h, anchors, texts, laid, findings}`)を足す。10 個の表(A)には、それぞれ**プラグインへ回す 1 行**を足す。コアの帯のキーは全部必須のままなので、**コアの帯の抜けは今までどおりコンパイルで落ちる**(ラウンド 1 のレビューが、実際の合併型を広げて確かめた: 診断 22 件はすべて 10 個の表と派生の行)。プラグインの帯の種類は型の合併型に入らない。

- **「葉」の意味**: プラグインの帯は**他の帯を持てない**(`children` は予約。`CHILD_BANDS` は空、`STACK_WIDTH` は `null`)。**ただし、`group` / `grouprow` / `areas` / `row`(箱でない子は `group` に包まれる)/ `grid` の子には、なれる**(スパイクで 3 つとも描け、型も通る。顔を文の横に置くのが主な使い方)。**ADR 0078 の `FlowBand`(`Exclude<Band, OverlayBand>`。0078 U2 で入る)は、`PluginBand` を流れの帯に含む**(`Band` の中にあるので自動で)。**重ねの帯(`overlay`)にはならない**(v1)。`Diagram<Ids>` は `PluginBand` を普通に受ける(`diagram().add(プラグインの帯)`)。
- **`connect()` の id の型**: 構築関数が `PluginBand<K> & Declares<Id>` を返す。`Declares` は幽霊の運び屋で、`diagram().add()` の既存の検査にそのまま乗る(最上位・`group`・`row`・`areas` の中で通り、裸の綴り間違いは拒まれることをスパイクで確認。U1 の `@ts-expect-error` のテストにする)。**ドット付きの部品の id(`rate.s2`)は型では検査されず、実行時だけ**(ADR 0012 と同じ。D2 の id)。計算で決まる id は `string` にして実行時で守る(`strict.ts` の約束と同じ)。

| 案 | 採らない理由 |
|---|---|
| (採用)封筒 `plugin` を 1 種類 | コアの全数性が残る。10 個の表に各 1 行。プラグインの追加で core の型が変わらない |
| モジュールの拡張(`declare module 'svg-diagram' { interface BandRegistry {…} }`) | 型が**グローバル**になる(2 つの版のプラグインが共存できない。ADR 0074 の「グローバルにしない」に反する)。コアの型がインストールされた物に依存する |
| `Band` を開いた型(`${string}:${string}` のテンプレート型)にする | 表が `Band['type']` をキーにするため、テンプレート型のキーを持てず、全数性が崩れる |
| プラグインごとに型の合併型へ足す(コードを生成してコアに入れる) | 別リポジトリに置く目的に反する。core のビルドがプラグインに依存する |
| 帯の種類ごとに core の表へ動的に登録(登録簿) | 全数性が実行時の検査だけになり、グローバルの状態も要る(D3) |

### D5. 安全 — プラグインはコード。JSON はコードを読み込まない

1. **spec(JSON)は、コードを読み込まない。** 呼び出す側(DSL を書く人、CLI の `--plugin`、プロジェクトの設定、サーバーの設定)だけが、プラグインを渡す。spec にできるのは、渡されたプラグインの id を名指しすること(D3)。`import()` の URL も、パスも、spec には書けない。
2. **MCP は、サーバー側の許可リスト**。サーバーは、ビルド時に**静的に** `import` したプラグインのうち、設定で有効にした物だけを `renderSpecEdge` に渡す。`specSchemaFor({plugins})`(新しい関数。`specSchema` は定数なので、既存の API は変えない)と `list_diagram_parts` は**許可した物から**作る。既定は**プラグインなし**。有効にするのは、権利と品質の確認のあと(Q10)。
3. **プラグインの SVG は、外部の SVG と同じ門(本物の `sanitizeBody`)を通る。** ホストは `sanitizeBody(svg, where, /*allowColor*/ true)` を呼ぶ。`sanitizeBody` が認めるのは、図形(`path` / `circle` / `ellipse` / `rect` / `line` / `polyline` / `polygon`)、グループ、`defs`、グラデーション、クリップパスと、許可した属性だけ。**`data-*` 属性も拒む**(`lenient` のときだけ黙って落とす)ので、`data-node` はプラグインに書かせず、**ホストが `anchors` から書く**(帯を包む要素と、anchor ごとの見えない長方形)。`text`・`style`・`script`・`use`・`image`・`foreignObject`・`mask`・`filter`・外への参照・名前つきの色・`rgb()` は拒まれる(スパイクで確認)。加えて、ホストが **1 つの帯の中の id の重複**を拒む。通らない出力は、`plugin-svg-rejected`(エラー)で、帯の場所にプレースホルダー(破線の長方形)を描く。**文字は `texts` の経路(D2)でコアが描く**。
4. **id は衝突しない**(D2)。
5. **プラグインの中の失敗は、壊れた出力にしない。** hook が投げたら、ホストが**プラグインの名前・帯の種類・段階(build / measure / layout / emit / verify)を付けて**包む(`PluginError`)。**`layout` は、結果を最後まで求めてから** `ctx`(カーソル、anchor の登録)を変える(途中で投げても、他の帯の状態が半端にならない)。`check` / `renderDiagram` / `renderInBrowser` の経路では、投げずに `plugin-failed`(問題)として verdict に入れ、その帯は**高さ 48px の破線のプレースホルダー**で描く(他の帯の診断が続けられる。今の `renderInBrowser` の「配置のエラーは投げる」を、プラグインの帯に限って変える。U4 で明記する)。DSL の構築(`build`)は、今までの DSL と同じく投げる。
6. **資源**: 1 つの帯の SVG と anchor の数に上限(D2 の 6)。同期の関数だけ(`async` の hook は不可)。**止まらない同期の hook は、コアには止められない**: Worker では CPU の上限で、Node では呼び出しの側のタイムアウトで終わる(サーバーに載せるプラグインを許可リストで限る理由の 1 つ)。
7. **プラグインの規則と `--strict`**: プラグインは、自分の `rules` に宣言した規則だけを出せる。重大度は宣言の範囲。`diagram({accept: {'rating-demo/value-over-max': '理由'}})` で、コアの規則と同じく受け入れを書ける(`accept` の型は `RuleId | `${string}/${string}``)。`check --explain rating-demo/value-over-max` は、プラグインが渡されている(`--plugin` か設定)ときに説明を出す。

### D6. 版と互換、コアの帯をプラグインに移すか、API を 1.0 にする条件

- **配置の結果(`laid`)はプラグインのもの**。ホストは中身を読まず、`structuredClone` で運ぶ。**コアの golden(`examples/out/`)は、プラグインがあっても動かない**。プラグインの出力の golden は、プラグインの側のリポジトリが持つ(適合テスト U6 が固定する道具を出す)。
- 版は D1 のとおり(`apiVersion` が権威、`requires`、プラグイン自身の `version`)。ホストは、図の中にプラグインの id と版を**記録**する(`laidOut` と `verdict` の側。SVG には `data-sd-plugin` の id だけを、ホストが書く)。
- **コアの帯(例: `comic`)を、内側のプラグインとして移す案(自分で食べる)について。** 長所は、API が実物で鍛えられること。短所は、(1)コアの帯が**コンパイル時の全数性を失う**、(2)`comic` は anchor の種類、幾何の地図、`renderComic` の断片の差し替え、`nodeIds`、規則の `where`、ADR 0077 / 0078 の重ねとの結びつきが深い、(3)**バイト一致は構造上できない**(ホストの包み、id の接頭辞、`texts` を図形の後に描く順。コアの `people` は `<text>` を自分の順に出す。`lib/emit-boxes.ts`)。**推奨(Q7): 今は移さない。** コアの帯は型つきの表のまま。`comic` の移行は、ADR 0078 の重ねが安定したあとに、別の ADR で判断する。
- **API を `1.0` にする条件は、バイト一致ではなく、「hook の網羅の確認表」(Q2)。** 次の hook を、**少なくとも 1 つの実物が通した**ことを、表で確かめる。1 つの参照プラグインで全部通せない hook は、他の実物で補う。

  | hook / 性質 | 確かめる実物 |
  |---|---|
  | `build` / `schema` / spec の往復 / `example` | 参照プラグイン(U6) |
  | `ids` / `anchors` / スコープ / `connect()`(最上位・`group`・`row`・`areas`) | 参照プラグイン(U2、U6) |
  | `measure` / `texts` / `wrapText` / `plugin-text-unmeasured` / `roles` の拡大(`fill`・canvas・`width: 'fit'`) | 参照プラグイン(U2、U6) |
  | `emit` / 門 / id の接頭辞 / ダークモード(トークンの色と `paper`) / `selfDimming` と `dim` | 参照プラグイン(U3、U6) |
  | `verify.rects` / `check` / `rules` / `accept` / `--strict` / `contrast` | 参照プラグイン(U4、U6) |
  | `inventory` / `reveal` / PPTX `'image'` / `nodeIds` | 参照プラグイン(U6) |
  | 実在の外部の制作物(別リポジトリ、npm、jsDelivr の Artifact) | `manga-face`(U10 と ADR 0079) |
  | コアの帯と同等の機能(anchor・reveal・spec・verify を持つ帯) | **コアの帯を 1 つ、並べて書き直す**(元の帯は残し、同じ入力で**描画が同等**であることを、ホストの包みと `texts` の順を除いて比べる。例: `quadrant` か、`chevron` などの `flowShape` の種類)。置き換えはしない |

  確認表が埋まり、`1.0` の前に Opus のレビューが収束してから、API を `1.0` にする。**この確認が U9(必須)**。

### D7. 狭い拡張点 — 人物の提供元と、追加の表情(同じプラグインのオブジェクトの中)

**人物の提供元(`characters`)**。`characters: {face: {schema, make(params) → CharacterManifest}}`。`make` の結果は、**必ず `loadCharacter` を通る**(権利の必須、断片の掃除、箱とアンカーの検査。手で書いたマニフェストと同じ門)。使い方は 2 通り。

1. **関数として呼ぶ**(コアの変更なし。今でも使える): `comic(sheet, {characters: {peep: mf.characters.face.make({…})}})`。ADR 0079 の「別パッケージ + `CharacterManifest`」の形そのもの。プラグインの仕組みは要らない。
2. **spec に書く**(JSON、LLM 向け。**comic が spec の部品を持つ(ADR 0074 U4。今は `IN_NO_SPEC_YET`)まで待つ**。U7): ワークシートの `cast.me.character = {provider: 'manga-face:face', params: {…}}`。`comic(sheet, {plugins})` / `renderComic(…, {plugins})` が、渡されたプラグインから解決し、`loadCharacter` に通す。**結果の人物は図ごと**(ADR 0074 D3 のまま。グローバルに持たない)。未供給なら D3 のエラー。

**追加の表情(`expressions`、任意、U8)**。`ComicExpression` は今 8 種の閉じた合併型(`EXPRESSIONS`)。プラグインは `expressions: ['manga-face:shy', …]` のように**名前空間つき**で足せる。ワークシートの舞台は `expression: 'manga-face:shy'` と書き、その表情の断片を持たない人物では `neutral` に落として `comic-expression-fallback`(助言)を出す。ADR 0079 の Q8(「追加の表情は後で」)と同じ時期に決める。コアの 8 種は変えない。

**ADR 0079 の manga-face がこれをどう使うか**: 別のリポジトリ `manga-face`(npm)が、平らなデータの `PluginDef`(`id: 'manga-face'`)を出す。

- 帯 `manga-face:avatar`: 顔 1 つ(パラメータ、表情、大きさ)。行・グループ・`areas` の中で、文の横に置ける(D4)。顔の生成(ADR 0079 の `face.ts`)をそのまま `layout`(大きさと anchor `head`)と `emit`(図形)に使う。
- 帯 `manga-face:faces`: 顔の一覧(見本帳、名前つき。名前は `texts`)。顔 64 個で SVG は約 370 KB(ADR 0079 の実測)なので、上限は既定で足りる(D2 の 6)。顔の `id`(0079 のスパイクは固定の `id="fc"`)は顔ごとに修飾して一意にする(D2 の 5)。固定の肌色・輪郭は `paper: true`(D2 の 4)。
- 人物の提供元 `face`: パラメータ → `CharacterManifest`(ADR 0079 の `faceManifest`)。`comic()` に渡す。
- 追加の表情(任意、U8)。

ADR 0079 は**中身の設計としてそのまま有効**(D2〜D7)。変わるのは D1 の「svg-diagram 側の変更はない」で、**svg-diagram 側に `svg-diagram/plugin` が入り、`manga-face` はそれを使う**。API が入る前でも、1. の関数呼びで `comic()` につながる(つまり ADR 0079 は、この ADR を待たずに進められる)。

### D8. 配布 — npm、jsDelivr の Artifact、MCP

- **npm**: プラグインは普通のパッケージ(`manga-face`)。`peerDependencies: {"svg-diagram": "…"}` は案内で、実行時の検査は `apiVersion` と `requires`(D1)。**実行時に svg-diagram を import しない**ので、peer の版の食い違いで 2 つのコピーが動く問題が起きない。型は `svg-diagram/plugin`(新しい入口。純粋で、`svg-diagram/browser` からも再エクスポートする。`test/web-entry.test.ts` の対象)から `import type` で取る。
- **Artifact(jsDelivr)**:
  ```js
  const [{diagram, pluginBands, renderInBrowser, svgMeasurer}, {default: mangaFace}] = await Promise.all([
    import('https://cdn.jsdelivr.net/npm/svg-diagram@X.Y.Z/dist/lib/web.js'),
    import('https://cdn.jsdelivr.net/npm/manga-face@A.B.C/dist/plugin.js'),
  ]);
  const face = pluginBands(mangaFace);
  const out = await renderInBrowser(diagram({theme: 'blue', plugins: [mangaFace]}).add(face.avatar({…}, {id: 'a'})), {measure: svgMeasurer()});
  ```
  構築関数は**コアが作る**(`pluginBands`)ので、プラグインは svg-diagram の値を import しない。2 つのモジュールは独立で、渡し合うのはオブジェクトだけ。**注意: core の jsDelivr の動作確認(CDN のプローブ)は、まだ終わっていない。** Artifact での通し確認(U10)は、そのプローブが済んでから行う。生成済みの JSON(1 人分 48.7 KB、gzip 3.5 KB。ADR 0079)を貼る方法も、プラグインなしで引き続き使える。
- **供給の安全(サプライチェーン)**: `import()` は SRI(`integrity`)を持てない。(1)**版は完全に固定**(`@A.B.C`。範囲や `latest` は使わない)、(2)プラグインの配布物は**import の無い 1 つの自己完結した ESM**にする(適合テストが `import` / `require` の文を探して拒む。jsDelivr の `+esm` の依存の書き換えは使わない)、(3)任意の追加の防御として、ページが**`<script type="importmap">` の `integrity`** で固定してよい。ホストの許可リストと設定は、npm の名前と版を人が決める。
- **MCP**: MCP のサーバー(別のリポジトリ `svg-diagram-mcp-plugin`)が、有効にするプラグインを**ビルド時に静的に import** して許可リストに入れ、`renderSpecEdge(spec, {plugins})` に渡す(D3)。Workers は実行時に任意のコードを読み込めないので、許可リストの方式は自然。`list_diagram_parts` は、許可したプラグインの部品を `plugin: 'manga-face'` つきで返す。`check_diagram` / `render_diagram` の spec の検査は、許可したプラグインのスキーマで行う。

## 代替案(全体)

| 案 | 採らない理由 |
|---|---|
| ADR 0079 のまま(別リポジトリ + `CharacterManifest` だけ) | 顔の**帯**(avatar、見本帳)が作れない。決める人の「汎用の新しい帯」の要求に足りない。ただし、人物の提供元としては残す(D7 の 1.) |
| core に `lib/manga-face/` として入れる | 出す周期と golden が core に結びつく(ADR 0079 D1)。他のパッケージ(別の帯)にも使えない |
| `raw()` の帯の拡張(今あるもの)で足す | 試した(スパイク)。anchor が登録されない、高さが構築時に固定、文字が測定を通らない、verify の口が無い。**足りない所が、この ADR の hook** |
| プラグインが core の表に自分で登録する(`registerBand(type, handlers)`、グローバル) | グローバル(ADR 0074 の約束に反する)。全数性が実行時だけ。テストが漏れる |
| プラグインが自分で構築関数を作る(`svg-diagram/plugin` を束ねる) | `located()` と `Declares` をプラグイン側が正しく付ける保証が無い。コピーが 2 つになる(D1) |
| 動的 `import(url)` を spec に書かせる | **安全でない**(D5 の 1)。MCP で任意のコードが走る |
| 全部のコアの帯を最初からプラグインにする | コンパイル時の全数性を失う。移行の面が広い(D6) |

## 影響

- `lib/` の変更は、U1 以降の別の PR。この PR(U0)は ADR とスパイクだけで、`lib/` と golden は変えない。`pnpm typecheck` は通る(スパイクは `tsc -p .` の対象外。スパイク用の `tsconfig` で別に確かめる)。
- コアに足すもの: `lib/plugin/`(型、`pluginBands`、登録簿、版の検査、`PluginError`)、`layoutHandlerFor` の箱のフォールバックの削除、帯の種類 `plugin`、10 個の表への各 1 行、(B) の十数か所の洗い出し、`svg-diagram/plugin` の入口(`package.json` の `exports`)。
- 変わらないもの: コアの帯の API、golden、`schema/*.schema.json`(プラグインを渡さない既存の経路。`specSchema()` はプラグインなしで今と同じ)。
- 公開の約束が増える: プラグイン API の semver(D1)。`0.x` の間は破壊的変更あり。

## 実装計画

U0 は、この PR。U1 以降は、どの単位も Opus のレビューで Blocker と Major がなくなってからマージする。**U1 は、ADR 0078 U2(`OverlayBand` と `FlowBand` を `Band` に入れる単位)のマージの後に着手する**(Q13)。0078 U0b(#448)は `inventory.ts` だけなので待たなくてよい。

| 単位 | 内容 | 完了の基準 | テスト |
|---|---|---|---|
| U0 | ADR とスパイク(この PR。`spikes/band-plugin/`) | スパイクの測定(上の表)。表の一覧。`typecheck` が通り、golden が不変 | `run.ts` の測定、`typing.check.ts` の 10 件、`typing.containers.check.ts` |
| U1 | 型と骨組み: `lib/plugin/`(`PluginDef` の型、`pluginBands`、登録簿、`apiVersion` / `requires` / `version` の検査と semver 範囲の解釈器、`PluginError`、未供給のエラー)、`Band` / `LaidOutBand` に `plugin` の封筒、10 個の表に**未実装(明確なエラー)の入口**、**`layoutHandlerFor` の箱のフォールバックの削除**、`diagram({plugins})`、`svg-diagram/plugin` の入口、`located()` との結合 | `typecheck` が通る。プラグインを使わない図の出力が**バイト単位で不変**(golden)。`plugin` の帯をプラグインなしで描くと D3 のエラー | 未供給 / 未知の kind / id の重複 / `apiVersion` の食い違い(`0.x` は minor まで)/ `requires` の不一致、**未知の `type: 'x:y'` の `DiagramData` が箱にならず投げる**、`core-purity` と `web-entry` に `lib/plugin/` を足す、**型テスト**(最上位・`group`・`row`・`areas` の `connect()`、裸の綴り間違いは `@ts-expect-error`、コアの帯の抜けは今までどおり落ちる)、構築関数の `located()` |
| U2 | 配置と anchor と測定: `measure`、`layout`(`ctx.register`、**スコープ = 既定で帯の id**、`ids`、親の幅 `w`)、`texts` と `wrapText`、**`plugin-text-unmeasured`**、`connect()`、`fit`、`inventory`(既定。`band` に plugin / kind)、`reveal`(既定) | 参照プラグイン(U6 の骨組み)の帯が、**最上位・`group`・`row`・`areas` の中**で描け、`connect()` の終点になり、部品への `connect('a:bottom', 'rate.s2:top')` が通る。文字がコアの測定器を通る | **同じ種類の帯 2 つ**(`s1…s5` が衝突しない)、各コンテナ内の部品への `connect()`、`plugin-anchor-undeclared`、`claimed`、`fill` / canvas / `width: 'fit'` / 折り返しのやり直しで hook を何度呼んでも同じ結果(冪等)、測っていない文字は `plugin-text-unmeasured`、文字の大きさが `roles` の拡大に従う、日本語の折り返しがコアの帯と同じ |
| U3 | 描画と門: `emit`、**本物の `sanitizeBody`**、帯の中の id の重複、id の接頭辞、`data-node` を**ホストが `anchors` から**書く、`selfDimming` と `dim`、**ダークモード(トークンの色と `paper`)**、PPTX の `'image'` | 描画が決定的。禁止の要素を出すと `plugin-svg-rejected` と破線のプレースホルダー。PPTX が絵として出る。暗い図で `paper` でない固定色は `plugin-fixed-color` | 門の拒否(`text` / `style` / `use` / `image` / `foreignObject` / `data-*` / `rgb()` / 名前つきの色 / 外への参照 / 重複 id)、同じ帯が 2 回出ても `id` が衝突しない、**ダークモードでトークンでない色**、`paper` の下地、PPTX の検証(`pnpm validate:pptx` に fixture) |
| U4 | verify と規則: `verify.rects` / `check`(`CHECK_PHASES` に `'plugin'`)、`rules`(登録簿)、`accept` の型の拡張、エラーの境界(`plugin-failed`。`layout` は結果を求めてから `ctx` を変える。48px のプレースホルダー)、`--strict` との関係、`check --explain` | プラグインの問題が verdict に入る。規則に説明が無いと `plugin-rule-undocumented`。hook が投げても他の帯の診断が続く | 問題 / 警告 / 助言、`accept`、投げる hook(`ctx` が半端にならない)、`rects` の衝突の検査、**変異**(`verify` を空にするとテストが落ちる) |
| U5 | spec と入口: `specToDiagram` / `validateSpec` / `renderSpec` / **`renderSpecEdge`** の `plugins`、**`specSchemaFor({plugins})`(新しい関数)** と `partCatalog({plugins})`、`schema` の未対応キーワードの拒否、`--plugin`、設定の `plugins`、`renderInBrowser` の `plugins`、markdown 系・`./render`・デッキ・`site`・PPTX の edge への配線 | spec の部品 `{type: 'rating-demo:stars'}` が描ける。未供給は `SpecIssue`(使えるプラグインの一覧)。**プラグインを渡さない既存の `specSchema` は今と同じ**(`schema/*.schema.json` が不変) | spec の往復、未供給のエラー、`schema-files` の不変、`--plugin` と設定のテスト(呼び出しの指定が設定を上書き)、`pattern` などを含むスキーマの拒否、各入口に参照プラグインを通す |
| U6 | **参照プラグインの fixture と適合テスト(必須)**: `test/fixtures/plugins/rating/`(`lib/` の**外**。`import type` だけ)に、小さい新しい帯を 1 つ、**D6 の確認表の全 hook** を通るように端から端まで(DSL、spec、配置、描画、verify、目録、reveal、PPTX、ダークモード、コンテナ)。`svg-diagram/plugin-testing` の `conformance(plugin)`: 決定性・冪等・`structuredClone`・門・規則の説明・anchor の一意・`example` が問題なく描ける・**測定した文字だけ**・**2 つの帯が衝突しない**・**`group` / `row` / `areas` の中**・**配布物に import が無い** | 参照プラグインが適合テストを通る。**プラグインなしで `rating-demo:stars` を描くと明確なエラー**。プラグインの作者が自分のリポジトリで `conformance(plugin)` を呼べる | 端から端のテスト、未供給のエラーの文言、**変異**(`emit` を非決定にする、`rules` の説明を消す、門を外す、`measure` の登録を消す。それぞれ落ちる) |
| U7 | 人物の提供元(DSL と `renderComic` の経路): `characters` の hook、`comic(sheet, {plugins})`、`renderComic({plugins})`、`loadCharacter` を必ず通す。**spec の `cast.x.character = {provider, params}` は、comic が spec の部品を持つ(ADR 0074 U4。今は `IN_NO_SPEC_YET`)まで待つ** | 参照の人物の提供元の出力が `comic()` で描ける。権利の無い人物は `comic-license-missing`。**人物は図ごと**(別の図に漏れない) | 提供元 → `loadCharacter` の往復、未供給、権利なし、図をまたいだ漏れなし |
| U8(任意) | 追加の表情: `expressions`、`ComicExpression` の拡張、`comic-expression-fallback` | 名前空間つきの表情が描け、持たない人物は `neutral` に落ちて助言が出る。コアの 8 種の出力は不変 | 落ちる経路、コアの golden の不変 |
| U9(**必須**) | **API を 1.0 にする確認**(D6 の確認表): コアの帯を 1 つ並べて書き直し(元の帯は残す)、描画が同等であることを比べる。確認表を埋める | 確認表のすべての行に実物がある。Opus のレビューが収束 | 並べた書き直しと元の帯の描画の比較(ホストの包みと `texts` の順を除く) |
| U10 | 配布: 参照プラグインか `manga-face` を jsDelivr から読む Artifact の通し確認(**core の CDN のプローブが済んでから**)、MCP の許可リスト(MCP のリポジトリ側の PR)、ドキュメント(README、skill) | Artifact が 2 つのモジュールを読み、プラグインの帯を描く。MCP が許可リストのプラグインの部品を `list_diagram_parts` に出し、許可外の名指しを拒む | Artifact の実機の確認(決める人)、MCP のテスト(別のリポジトリ) |

## テスト方針

- **コアの網羅**: 既存の `satisfies` と `ALL_BANDS_*` はそのまま。`plugin` が増えるので、10 個の表への入口は型で強制される(U0 の実験とレビューの実測が証明)。(B) の型で守られない箇所は、`test/band-registries.test.ts` に `plugin` の行を足し、参照プラグインが全部の経路(spotlight、reveal、`data-node`、位置の地図、`rewrite`、HTML の形)を通ることで確かめる。
- **適合テスト**(U6)は、プラグインの作者が自分のリポジトリで走らせる。core の CI は参照プラグインだけを走らせる。
- **golden**: コアの golden は、プラグインを使わない限り**不変**(各単位の完了の基準)。プラグインの出力の golden は、プラグインの側。
- **変異**: 各単位で、新しいコードを壊す変異を 1 つ以上当て、落ちることを PR に書く(`AGENTS.md`)。

## 決める人への質問

| # | 質問 | 推奨 | 理由 |
|---|---|---|---|
| Q1 | 型の入れ方: コアに `plugin` の封筒を 1 種類足す方式で進めてよいか | **封筒を 1 種類**。表 10 個に各 1 行 | コアの帯の全数性が残る。モジュールの拡張はグローバルになる。実際の合併型を広げても、壊れるのは 10 個の表(と派生の行)だけと実測 |
| Q2 | プラグイン API の版の方針と、`1.0` の条件 | **core の版とは別の semver。`0.x` の間は破壊的変更あり(minor まで同じでないと受けない)。`1.0` は D6 の「hook の網羅の確認表」を満たし(U9。必須)、Opus のレビューが収束してから** | 実物(参照プラグイン、manga-face、並べて書き直したコアの帯)で試す前に約束しない。バイト一致は構造上できない |
| Q3 | 帯の名前空間の書き方 | **`プラグイン id:帯の名前`**(`manga-face:avatar`)。規則は `id/規則名` | コアの名前と衝突しない。`/` は規則、`.` はスコープと使い分ける |
| Q4 | 登録は呼び出しごとか、グローバルか。コードの無い入口(デッキ、markdown、エディタ)はどうするか | **呼び出しごと** + **プロジェクトの設定の `plugins`**(呼び出しの指定が上書き)。MCP は許可リスト | ADR 0074 の約束。漏れない。設定は呼び出す側の持ち物で、spec ではない(D5 の 1) |
| Q5 | v1 で、プラグインの帯に何を許すか | **他の帯を持つこと(コンテナ)と、重ねの帯になることは許さない。行・グループ・`areas`・`grid` の子になること、`FlowBand` に含まれることは許す** | 子の測定と積みは、ホストの再帰に結びつく。顔を文の横に置く使い方に必要。スパイクで 3 つのコンテナとも描けた。0078 の `FlowBand` と整合 |
| Q6 | プラグインに `<text>` を出させるか | **出させない。文字は `texts` のデータで返し、コアが描く**(測定の厳密さ、`roles` の拡大、日本語の折り返しはコア) | 測定、フォント、ダークモード、小さい文字の検査、0078 の目録が自動で正しくなる。コアは測っていない文字を幅 0 で通すので、`plugin-text-unmeasured` で止める |
| Q7 | コアの帯(`comic`)を内側のプラグインに移すか | **移さない**。U9 では小さいコアの帯を**並べて**書き直すだけ。`comic` は 0078 が安定した後に別の ADR | コンパイル時の全数性を失う。`comic` の結びつきが深い。バイト一致は構造上できない |
| Q8 | 人物の提供元は、関数として呼ぶ形(今でも可)と、spec に書く形の両方か | **両方**。spec の形は comic が spec の部品を持つ(ADR 0074 U4)まで待つ | 0079 を待たせない。LLM / JSON の経路が要るときに仕組みが効く |
| Q9 | 追加の表情をプラグインで足せるようにするか | **後で(U8)。名前空間つき**、持たない人物は `neutral` に落として助言 | ADR 0079 の Q8 と同じ時期。コアの 8 種は動かさない |
| Q10 | 公開の MCP サーバーで、どのプラグインを有効にするか | **既定は 0 個。有効にするのは、権利と品質の確認の後(`manga-face` が最初の候補)** | 許可リストの方式は安全だが、見た目と権利は別の確認 |
| Q11 | 版の門: `requires` の不一致はエラーか警告か。どれが権威か | **エラー**(両方の版を名指し)。**`apiVersion` が権威**、`requires` は core の範囲、`peerDependencies` は案内 | 黙って動いて壊れるより、早く止まる。複数の門が食い違うときの順を決めておく |
| Q12 | プラグインの規則は `--strict` と `accept` にコアの規則と同じように乗せるか | **乗せる**。重大度は宣言の範囲内、規則の説明は必須。プラグインに見せる重大度は `problem` / `warn` / `info` | 利用者から見て、規則の扱いが 1 つ |
| Q13 | U1 に着手する順序 | **ADR 0078 U2 のマージの後**(`FlowBand` / `OverlayBand` が `Band` に入る単位。0078 U0b は `inventory.ts` だけ)。ADR 0079 の U1 以降は待たず、関数呼びの形(D7 の 1.)で進める | 同じ合併型と表を触る 2 本の PR の衝突を避ける |
| Q14 | 参照プラグインの置き場と、適合テストの道具の公開 | **`test/fixtures/plugins/rating/` に置き、`svg-diagram/plugin-testing` を公開**(U6) | プラグインの作者が同じ検査を自分のリポジトリで走らせられる。参照が core の CI に入り、API の変更で壊れたらすぐ分かる |
| Q15 | 1 つの帯の SVG / anchor の上限 | **設定できる値。既定は SVG 1 MB、anchor 1000** | 顔 64 個の見本帳が約 370 KB(ADR 0079 の実測)で収まる |

## スパイクの再現

```
node spikes/band-plugin/run.ts                                            # out/ok.svg, out/measurements.txt
node_modules/.bin/tsc --noEmit -p spikes/band-plugin/tsconfig.json        # typing.check.ts: ちょうど 10 件(各表で Property 'plugin' is missing)。typing.containers.check.ts は通る
```

`out/` は、U1 以降の PR で参照プラグインに置き換えて消す(ADR 0074 と同じ使い捨て)。スパイクの `host.ts` の変換器(`raw` に載せる)は**本実装ではない**。本実装は、10 個の表に直接入口を持つ(D4)。

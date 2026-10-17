# ADR 0031: FCIS を全体に(殻の明示・状態の値化・純粋関数の網羅テスト)

- 状態: 草案 改訂 4(Opus レビュー収束、実装前)
- 日付: 2026-10-17
- 基点: `main`(7c79971、PR #272 まで)
- 関連: ADR 0007(描画の状態を値にする・依存方向の検査)

## 背景

ADR 0007 は中核(layout・emit・verify ほか)に I/O を持ち込まない検査(`test/core-purity.test.ts`)を入れた。ADR 0007 が通ったのは**再現できるバグが先にあった**からである。0031 も、実在する問題から書く。

### 実在する問題(実測・再現できるもの)

1. **PPTX が図の `tones` を無視する**。`emitPptx` → `planSlide` は `withTones` を通らず、`pptx/shapes.ts`・`pptx/text.ts`・`pptx/connectors.ts` が `toneStyle` / `textColorOf` / `runColorOf` を上書きなしで引く。`examples/emphasis-tiers.ts` は `tones: {accent: {fill: '#cbdcf3'}}` を使うが、`examples/out/pptx-golden.json` は**誤った(既定の)色をハッシュで固定している**。ADR 0007 の「`renderDiagram` の外で `emitSvg` を呼ぶと黙って 1 倍」と同じ種類。
2. **`measure.ts` の `fontSpecs` / `backend` がプロセス全体のグローバル**。`configureMeasure` が `loadDiagram` のたびに上書きし、`emit-html.ts` が `currentFontSpecs()` で読む。さらに `measureAll` の `memoKey` と実測も同じグローバルを読むので、フォント設定の違う 2 プロジェクトを `Promise.all` で描くと、**レイアウトの文字幅そのもの**と `emitHtml` の ascent が他方のフォントで測られる(ROLES と同じ形。再現テストは `await Promise.resolve()` で回す)。
3. **ロケールが隠れた入力**。`fta-analysis.ts:74` と `qc.ts:173` の `localeCompare` はロケール引数がなく、`LANG` により並びが変わり得る。`wordart-vertical.ts:26` の `new Intl.Segmenter(undefined, ...)` も既定ロケール依存。
4. **`image-file.ts` の `sourceDir`**(動的スコープ)と **`dsl/text-bands.ts` の `boxSizeWarned` + `console.warn`**:純粋と宣言した側にある状態と副作用で、import の検査では捕まらない。

### 構造の問題

5. **検査が許可リスト方式**。`CORE` 22 ファイルとその推移的 import だけが対象で、`lib` 219 ファイルのうち 135 が対象。残り 84 のうち、`dsl/*`(別の検査あり)と意図した殻を除いても、検査のないファイルがある。実測の内訳:
   - 型だけで実行時コードのない 3 つ(`band-table`, `layout-ctx`, `deck-viewer/state.d`):検査しても意味がない。
   - 中核そのものなのに推移に入っていない:**`layout-measure.ts`**(測定要求を集めるパス 1)ほか `docs-check`, `icon-sets`, `strict`, `lint-browser`(playwright は型のみ)。
   - `charts-lines`, `covers`, `qc-plane`, `qc-table`, `scope-style`, `semantic-table`, `semnet-dsl`, `svg-diff`, `svg-dom`, `svg-to-css`, `toc-analysis`, `xml-check`。`covers` と `svg-diff` はどこからも import されていない(死にコードなら消す)。
6. **検査の誤検出**。`usesEnv` の正規表現が `lib/strict.ts:220` のテンプレートリテラル型の中の英文 "Split the process, ..." に当たり、`strict.ts`(全部 `import type`)が「process を使う殻」と判定されている。反転すると誤検出が増える。
7. **中核にモジュール単位の可変状態が残る**。`wrap.ts`(`wrapMode`, `keepWordsSetting`, `keepWordsNow`)と `tokens.ts`(`activeTones`)は動的スコープ。wrap は今は同期なので漏れない(呼び手は layout 中だけ)が、**tones は 1 のとおり、既に届いていない**。
8. **殻の中に純粋なロジックが混ざる**。実測した経路(最初に届く I/O)で選び直す(§3)。
9. **純粋関数のテストが体系的でない**。`lib` の関数 export は 979(うち async 26)で、テストが名前で import していないものが 485(他の `lib` ファイルから import されているものに絞ると 418)。

## 決定案

### 0. 先に再現テストを書く(元の main で落ちることを確かめる)

(a) PPTX のスライド XML に `CBDCF3` が出る(現状は出ない)。(b) `tones: {accent: {fill, dark: {fill}}}` × `appearance: 'dark' | 'auto'` で、SVG・`@media` ブロック(`appearance-auto.ts`)・verify の所見・PPTX を固定する特性テスト(`examples/` にこの組み合わせが無い。`mapOf` / `paintOf` / `recolor` が tones の dark ペアに依存するため、直し忘れは型にも golden にも出ない)。(c) フォント設定の違う 2 プロジェクトの並行描画(観測点は `laidOut` の箱の幅と `emitHtml` の ascent の両方)。

### 1. 検査を反転する(殻を明示し、残りは全部中核)

- `test/core-purity.test.ts` は `lib/**/*.ts` を列挙し、`SHELL` に載っていないものを全部中核として検査する。受け入れ条件は「**`SHELL` 以外の全ファイルが通る**」(既知違反の一覧にあるものを除く。下記)。
- `SHELL` は `{file, reason, through: 'deny' | 'allow'}`。`through: 'allow'` は「自身の I/O は許し、その先は辿る」(`icon-registry.ts` の宣言済み例外を引き継ぐ)。古い項目(実在しない・もう I/O に触れない)は落とす。`resolve-hook.ts`(Node のローダーフック。`node:module` は型のみ)は実行文脈が殻なので、理由つきで載せる。
- 実行時コードのないファイル(型だけ)は対象外と明示する。
- `usesEnv` を識別子としての `process`(`\bprocess\s*[.\[]`、分割代入、`globalThis.process`)に限り、文字列リテラルとコメントを潰してから当てる。`strict.ts` を殻から外す。
- 禁止の追加(中核): `Date.now(`・引数なし `new Date()`・`Math.random(`・`performance.now(`・`crypto.random*`・`path.resolve` / `process.cwd`・ロケール引数(第 2 引数)なしの `localeCompare` / `Intl.*(undefined` / 引数なし `toLocale*()`。時計・乱数・`path` は中核 176 ファイルで当たりゼロ(実測)なので、そのまま入れる。`node:crypto` は `createHash` だけ許す(ハッシュは決定的。`randomUUID` / `randomBytes` / `getRandomValues` を禁止)。
- 中核ファイルのトップレベルに `let` と、`ReadonlyMap` / `ReadonlySet` の型注釈のない `new Map/Set/WeakMap` を置かない。定数の検索表(`CANNOT_START_LINE` など、実測 26 個。残る 1 個の `MAPS` は下の許可一覧)は型注釈を足して通す(機械的な作業)。**オブジェクト・配列のリテラルは検査しない**(53 ファイル以上が当たり、正規表現で可変と定数を区別できない。書き換えは型検査と §4 の入口の凍結に任せる)。許可の一覧には、入力を完全にキーにした純粋キャッシュだけを理由つきで載せる(`tokens.ts` の `MAPS`、`ToneEnv` を引く `WeakMap` 自体、およびその env の中の `merged`。`emit-html.ts` の `boxMemo` は段階 4 で消える。`measure.ts` は殻)。
- **段階 1 の既知違反の一覧** `{file, rule, removedIn}`:`wrap.ts` の `let` 2 つ → 段階 3、`tokens.ts` の `activeTones` → 段階 2、`dsl/text-bands.ts` の `boxSizeWarned` → 段階 5、`localeCompare` 2 件と `Intl.Segmenter` 1 件 → 段階 6。該当の段階で一覧から消さないと落ちる(古い項目を残さない)。
- `lib/dsl/` の I/O の検査は反転した検査に統合する。ただし今の 4 つ目のテスト(dsl の import の循環と、ビルダーが `render.ts` / `io.ts` を import しないこと)は別物なので残す。

### 2. 状態を値にする(tones を先、wrap を後)

**tones(動機が強い):** `colorOf` は `activeTones` を読まず(`#` の鍵はそのまま返す)、変えない。tones に依存する関数は 10 個(実測で漏れなし): `toneStyle`, `textKeyOf`→`textColorOf`→`runColorOf`, `mapOf`→`darkOf`・`paintOf`・`pageColorOf`・`recolor`, `toneColors`。`pageColorOf` は `lib` に呼び手がないので削除、`darkOf` は組み込みの dark 表だけを引く関数(`baseMapOf` 経由)として残し、tones に依存しないことを名前と doc で明示する(呼び手はテストだけ)。形は **`ToneEnv`**: `toneEnv(tones)`(`d.tones` を鍵にした `WeakMap` で同じ env を返し、今の `activeTones.merged` のキャッシュをここへ移す。`undefined` は既定の単一インスタンス)が、`style`, `textKey`, `textColor`, `runColor`, `map`, `paint`, `recolor`, `colors` を持つ。

- `LaidOutDiagram` には**データの `tones`** をそのまま持たせ、関数を持つ env は焼き込まない(`rendered` として外へ出て、PPTX golden や slidev アドオンが触るため)。
- 引数なし版(`toneStyle(tone)` など)は**削除**する(残すと PPTX と同じバグがまた作れる)。型の赤で追う。影響は `lib` 約 22 ファイルと、テスト 6 ファイル(`tone-override`〔`withTones` の直接使用で書き直し〕、`tones`、`stat-bars`、`wordart-look`、`appearance-auto`、`dark-theme`)。
- `layoutWith` / `emitSvgWith` / `emitHtml` / `verifyWith` / `lintAll` / `planSlide` はそれぞれ、入口で `d.tones` から env を作る。公開の `emitSvg(laidOut, opts)` のシグネチャは変えない。`emitHtml` の内側の `emitSvg` 呼び出しは `d.tones` を共有する(`{...d, laidOut: bands}`)ので、`d.tones` を鍵にした `WeakMap` により**渡さなくても同じ env になる**。`'auto'` の dark 側(`{...d, appearance}`)でも鍵は `d.tones` なので env は共有される。
- `toneColors()` の順序(`data-tone-colors` 属性)は `activate` のロジックをそのまま移して保つ。
- 受け入れ条件: **SVG golden 不変、PPTX golden は `emphasis-tiers` だけ変わる**(直る方向)。

**wrap / keepWords(動機は将来の `await` だけ、小さくやる):** `WrapOptions` に `mode: WrapMode` を**必須**で足す(赤は 20 か所)。`runGlueOf` は `mode` を引数に取る。`keepingWords()` の読み手は `tree.ts` の 1 か所、`keepWordsRequested` / `withKeepWords` は `fit-width.ts` の 1 か所で、`LayoutPlan.build(d, mw)` に `floor` を足す。`charts-base.ts` のインスタンスがレイアウト外で wrap される経路は、実測で無い(`Canvas` の生成はすべて描画関数の中で、レイアウトが渡すジオメトリから作られる)。golden 不変。

**`measure.ts` の `fontSpecs` / `backend`(再現できるバグ。tones より重い):** `emit-html` から読まなくするだけでは足りない(`layoutDiagram` の測定も同じグローバルを読む)。段階 4 で `layoutDiagram(d, {roles, measure: {backend, fonts}})` と `measureAll(requests, cfg)` に変え、`configureMeasure` のグローバルを廃止する。測定の失敗時に `backend` を chromium に書き換えるグローバルの扱い、`renderDiagram` に測定設定を渡す経路、`fontBox` 必須化による公開型とテストへの影響は、段階 4 の PR の冒頭で洗い出して書く。

**殻の状態:** `image-file.ts` の `sourceDir`(動的スコープ)は `define` に引数で渡す形を検討する(`async` の define で壊れる)。`dsl/text-bands.ts` の警告は `Finding` として返す。`icon-registry.ts` の `explicit` / `found` は、`icon.use()` と cwd に依存する状態として `SHELL` の `through: 'allow'` に理由つきで残し、長いプロセスでの古い manifest は別の課題とする。

### 3. 殻の中の純粋ロジックを切り出す(実測した経路と価値の順)

1. **`emit-html.ts`**:本当の不純は `crypto` ではなく、`metrics()` が `font-metrics` の `textBox` で `'あ'` の ascent / descent を測ること、その `specs` を `currentFontSpecs()` で読むことの 2 つ。`metrics()` の引数 `(size, weight, mono)` は**レイアウト後**の `run.size` / `o.size` で決まる(stat の縮小、fill の拡大、`fontScale`)ので、パス 1 では集められない。**`layoutWith` の後に `LaidOutDiagram` を歩いて HTML で描く run の組を集め、殻(`layout-measured.ts`)の後処理で測って `LaidOutDiagram.fontBox` に入れる**。値は同じなので出力不変。`fontBox` は**必須**にし、引いた組が無ければ投げる(今の `catch` の既定値 `size * 0.88` / `0.24` で黙って描くと、PPTX の tones と同じ種類のバグになる。フォントファイルの無い環境での振る舞いは、殻の測定側で同じ既定値を入れて保つ)。port にすると `pipeline` も port を受けて殻が厚くなるので採らない。これで `emit-html` が中核になり、`pipeline`・`svg-to-css`・`xml-check` も自動で中核に入る。
2. **`svg-geom.ts` / `svg-lint.ts`**:不純は `textBox`(`svg-geom.ts:4,200`)だけ。`specs?: FontSpecs` を `measureText: TextBoxFn`(既定値なし:既定値を置くと import が残る)に置き換える。`placeRuns` を使う殻の `emoji-color.ts` にも渡す。テスト約 9 ファイルを直す。`svg-dom` も中核に入る。
3. **`markdown-target.ts`**:`resolveSource`(`fs.realpathSync`・`process.cwd()` 既定値)以外は全部純粋。`resolveSource` を別ファイルに出すだけ。`markdown` / `markdown-it` / `remark` / `deck-html` が使う。
4. **`markdown.ts`**:`expandMarkdown` の走査器(フェンス・コメント・リスト・インデントコード)を純粋にする。ただし `problems` は文書順に描画失敗と混ざって push されるので、**走査器が「イベント列」を返し、殻がイベント順に解決する**形にする(2 段にすると順序が変わる)。`seen`(id の重複回避)の文書順も守る。
5. **`freshness.ts`**:`readProvenance` の解析、`freshness()` の判定(候補ごとの `{source, sha, depsSha}` を受ける形)、`staleNotice`(`node:path` だけで既に純粋)。約 30 行。`candidates()` は `exists` の port。

**対象から外す**(実測で切り出すものがない): `strict`(誤検出)、`steps` / `versus`(`icon-registry` 経由で殻にいるだけ)、`pipeline`(`emit-html` が中核になれば自動)、`slide-budget`(残りは Slidev の dev サーバーとブラウザ内評価で、試せる部分がほぼない。`imgSelector` は既に純粋)。

ADR 0007 が採らなかった「Measurer のインスタンス化」は、ここでも行わない(`textBox` / metrics を渡すのは関数であって、測定器の複数化ではない)。ただし `fontSpecs` は純粋キャッシュではなく**設定のグローバル**なので、0007 の理由は当てはまらない。

### 4. 純粋関数のテストハーネス

- **一覧の作り方**: TypeScript 7 には JS の API が無い。関数単位の純粋判定(推移的な状態読み取り)はできないので、**モジュール単位で状態を持てないようにして(§1)、「中核ファイルの関数 export はすべて純粋」を構造で成り立たせる**。一覧は実行時に列挙する(中核ファイルを `await import()` して `typeof v === 'function'` の export を集め、async は `constructor.name` で除く)。
- **網羅の穴**:実行時カバレッジでなく**テストファイルが名前で import しているか**(静的)で判定する。穴は 485(§背景 9)。受け入れ条件は**ラチェット**(現状の一覧を `test/fixtures/untested-exports.json` に固定し、増えたら落ち、減ったら一覧も減らせと言って落ちる。前例: `test/fixtures/dsl-exports.json`)。対象は最初は「中核で、かつ他のファイルから import されている export」。
- **性質テスト**:自前生成器は既にある(`test/helpers/svg-fuzz.ts` の LCG、`semnet-sweep.ts`)。性質が 10 本を超えるなら、縮小のために `fast-check` を devDependency に入れる(`pnpm add -D`)。価値の高い性質:`recolor` の冪等(tokens.ts のコメントが主張している。**tones の dark ペアで成り立つかは自明でなく、バグ候補**)、`checkTones` の冪等、`mergeTones` の単位元、`splitAtoms(t).join('') === t`、`wrapAtoms` の幅・連結・禁則、`wcagRatio` の対称性と値域、`boxOf` / `unionBox` / `transformBox` の包含。
- **図全体**:乱数の図に `verify` を当てて ok を期待しない(verify は利用者の誤りを正しく落とす)。代わりに「layout が利用者向けの `Error` 以外で落ちない」「emit が整形式 XML」「同じ入力で 2 回描いて同一」「描く順番を入れ替えても同一(キャッシュ・状態の漏れの検出)」。
- **入力を壊さない**:全公開関数は無理(979 本に生成器が要る)。**入口だけ**:`examples/*.ts` 全部(+ 乱数の図)について、`runPreLayout` 後の `DiagramData` を深く凍結して `layoutWith` に渡し、`runPostLayout` 後の `LaidOutDiagram` を凍結して `verifyDiagram`・`emitSvg`・`emitHtml`・`planSlide` に渡す。pre-layout の `prepareReveal` / `applyAutoLegend` と post-layout の `applySpotlight` は意図して書き換えるので対象外。`Object.freeze` は Map / Set の中身を守らない点と、`raw({draw})` の関数・クラスのインスタンスを再帰から外す点を明記。

## 段階(PR を分ける)

| # | 内容 | 受け入れ条件 |
|---|---|---|
| 0 | §0 の再現テスト(`todo` で入れ、直す PR で外す) | 元の main で落ちる |
| 1 | §1 検査の反転(+ `usesEnv` 修正、`through: 'allow'`、禁止の追加、トップレベル可変状態の禁止、`resolve-hook` を殻に) | `SHELL` 以外の全ファイルが通る(**既知違反の一覧にあるものを除く**。一覧は後の段階で消さないと落ちる)。`layout-measure` を含む |
| 2 | §2 tones を `ToneEnv` に | `withTones` と引数なし版が消える。SVG golden 不変、PPTX golden は `emphasis-tiers` だけ変わる。テスト 6 ファイルを直す |
| 3 | §2 wrap / keepWords | `setWrapMode` / `setKeepWords` が消える。golden 不変 |
| 4 | §3 の 1(`emit-html` の `fontBox`)と、測定設定の値化(`measure: {backend, fonts}`) | `emit-html` / `pipeline` が中核。出力不変。§0(c) の並行描画の再現が、`laidOut` の箱の幅と ascent の両方で通る。別 PR に分けるなら、並行描画の受け入れ条件は測定設定の値化の PR に置く |
| 5 | §3 の 2〜5、`dsl/text-bands.ts` の警告を `Finding` で返す、`image-file.ts` の `sourceDir` | `SHELL` の項目が減る。出力不変 |
| 6 | §4 穴のラチェット、性質テスト、入口の凍結、ロケールの固定(`localeCompare(b, 'en')`、`Intl.Segmenter('ja')`。並びが変わって golden が動く場合は、変わった例と理由を PR に列挙し、新しい並びを決定的なもの〔コードポイント順または `'en'`〕として受け入れる) | ラチェットが通る。既知違反の一覧が空 |

## 影響

- 出力は不変を原則とし、例外(PPTX の tones)は直る方向に限る。
- 採らない: `lib/core/` と `lib/shell/` への物理移動(進行中の worktree との衝突)、Effect 系ライブラリ、`fast-check` の早期導入(性質テストが 10 本を超えるまで)。

## 未決

1. `fast-check` を入れるタイミング(10 本を超えた段階で、でよいか)。
2. `icon-registry` を `through: 'allow'` で残すか、`explicit` を値にして本当に純粋にするか。

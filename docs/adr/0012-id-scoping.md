# ADR 0012: id のスコープ化(band をまたぐ `duplicate anchor id`)と、複数 SVG の埋め込みでの内部 id 衝突

- 状態: 提案
- 日付: 2026-10-13
- 基点: `main`(4e58744、PR #120 まで)
- 関連: ADR 0007(結果が入力だけで決まること), ADR 0008(`--html`)。要望原文は「ツール側の要望」の D1 / D2

## 背景

自己配置する band(chevron、gantt、stateDiagram、causeTree、tree、mindmap、classes、bpmn、quadrant、chart など)は、中の項目に `id` を持てる。その id は図全体で 1 つの名前空間に入る。別の band が同じ id を持つと、レイアウトの時点で throw する。

> `duplicate anchor id "p0": a gantt task takes an id that another anchor already has`

実例(要望 D1)は、`chevron` の項目 `p0` と `gantt` の `p0`、`causeTree` の `poc` と `stateDiagram` の `poc`。利用者は片方に接頭辞を付けて回避した。複数の band を 1 枚に組み合わせるたびに起きる(要望側の優先度は高)。

D2 は別の層の話。複数の SVG を 1 つの HTML に貼ると、SVG の中の `id`(`svg-title`、`svg-desc`、矢じりの `dsl-arrow` など)が重なる。利用者は Python で接頭辞を置換した。

### 現状(コードで確かめたこと)

D1 側。

- 出所は `lib/layout.ts` の `claimed()`(472 行)。呼び出しは 30 か所ほどで、box、group、row、row の列 id(`id#n`)、image の mark、timeline、bpmn、classes、gantt、cause / cloud、states、tree、bars、chart、quadrant、swimlane、plane、flow-shapes の各 id が、同じ 1 つの `anchors: Map<string, Rect>`(465 行)に入る。重複は `anchors.has(id)` で検出する。
- 参照する側は 4 か所に分かれる。
  1. `connect()` の `from` / `to`。`parseRef()`(1096 行)が `id:side@t` を `:` で割る。解決は `resolveConnect()`(1197 行)で、未登録は `unknown anchor id` で throw する。先に来た connect は `deferred`(474 行)で後回しにして、最後に解く。
  2. `reveal.ts`。レイアウトの前に band を歩き、`nodeIdsOf()`(`lib/band-ids.ts`)で各 band の id を段階の表(`ids`、80 行)に入れる。この `ids` は素の id をキーにした `Map` で、**同じ id が 2 つあると後勝ちで黙って上書きする**(今は重複が layout で止まるので表に出ない)。connect の端点は `refId()`(`:` の前)で引く。plane の `lines` / `dims` / `paths.through` も同じ表で引く。
  3. `spotlight`(`lib/spotlight.ts`)の `ids`。各 band が返す `anchors[].id` は素の id のままで、spotlight はそれと照合する(68〜80 行)。charts の `of` / `dimIds` も素の名前で持つ。
  4. 型。`strict.ts` の `Declares<Id>` / `Refers<'id:side'>` が、band の宣言する id と connect の参照を、コンパイル時に照合する。`.anchors.<id>` のハンドル(`dsl.ts` の `withHandle`)は、id 文字列をそのまま持つ。
- `nodeIdsOf()` は、tree、states、cause、cloud、gantt、classes、bpmn、quadrant、chevron / funnel / cycle / venn / concentric、chart の id を返す。bars や image の mark、swimlane の step は、`layout.ts` が個別に登録している。
- row の列 id(`row#1`)は `id#n` の約束で、衝突検査にも `areaIds` にも別扱いで入っている。スコープ化の対象にしない。

D2 側。

- SVG に出る id は固定の少数。`svg-title` / `svg-desc`(doc の図)、`<metadata id="svg-diagram">`、矢じりの `dsl-arrow` / `dsl-arrow-dim` / `dsl-arrow-strong` / `dsl-arrow-strong-dim`(`emit.ts` 1015〜1030 行)。raster 用に `svg-diagram-gray` もある。図の中の node の id は、SVG の `id` 属性には出ない(レイアウトの内部だけ)。
- 接頭辞を付ける処理は、すでに 3 か所に別々にある。`raster.ts` の `embedSvg(svg, box, idPrefix)`(`id=` / `url(#…)` / `href="#…"` を書き換える。接頭辞は `${prefix}${id}`)、`markdown-target.ts` の `inlineSvg()`(内容のハッシュ + 通し番号。接頭辞は `${pre}-${id}` で、`<metadata id="svg-diagram">` の id も書き換える)、同 `htmlFigure()` と `remark.ts` の `dedupeId()`(HTML 形式の root id `sd-<hash>` に通し番号)。3 つは接頭辞の形も、`<metadata>` と `<style>` の扱いも違うので、同じ関数には寄せられない。
- `build` の `--html` は、`emitHtml` の root id を本文のハッシュから決める(`sd-<8 桁>`)。同じ図を 2 度貼らない限り衝突しない。中の `sd-ov` の SVG には、`<defs>` の矢じりが入る。
- `<metadata id="svg-diagram">` は、`build-diagram.ts`(90〜93 行)と `check-diagram.ts`(82 行)が、正規表現 `<metadata id="svg-diagram">` で読む(`check --drift` の出所の照合)。ファイルの SVG ではこの id を書き換えてはいけない。なお `inlineSvg()` は `md --inline` 用で、ページに埋め込んだ SVG の `metadata` の id まで書き換える(そのページの SVG は drift の対象ではないので害がない)。
- `svg-diagram build` は 1 ファイルずつ SVG を書く。複数を 1 つの HTML にまとめるのは利用者側の作業で、`md` サブコマンドの `--inline` は上の `inlineSvg()` で解決済み。

## 論点

1. 衝突を **どこで** 解くか。id を書いた側(band)か、参照する側か、図全体の既定か。
2. 衝突しない id の参照は、**今のまま**(`from: 'p0'`)で通るか。
3. 衝突した id をどう書き分けるか。曖昧なときは、黙って選ばず error にするか。
4. 型(`Declares` / `Refers`)と `.anchors.<id>` のハンドルを、どう通すか。
5. D2 を、新しい仕組みにするか、すでにある 3 つの接頭辞処理の整理で済ませるか。`metadata` の id をどう守るか。

最重視は互換性。**今ビルドできる図の SVG は、1 バイトも変わらない**ことを不変条件にする。

## 決定

### D1: 自己配置 band に `scope`。参照は修飾名 `scope.id`、衝突しないなら素の `id` でも通す

**段階。第 1 段は明示の `scope` と実行時の解決だけ。`diagram({idScope: 'auto'})` と型(`Declares` の修飾名)は第 2 段。** 型は約 12 のコンストラクタにリテラル型パラメータが要り重い。自動の名前は、明示の `scope` が使われてから要否を決める。

**1. 書き方。**

```ts
diagram({theme: 'blue'})
  .add(chevron([{id: 'p0', label: '準備'}, ...], {scope: 'plan'}))
  .add(gantt([{id: 'p0', label: '準備', start: ..., end: ...}], {scope: 'sched'}))
  .add(connect({from: 'plan.p0', to: 'sched.p0'}))   // 修飾名: 常に通る
```

- `scope?: string` を、自己配置 band(`nodeIdsOf()` が id を返す band と、bars / image / swimlane の項目を持つ band)のオプションに足す。band 自身の `id` は今まで通り図全体の名前(`anchors` に素のまま入る)。
- `scope` を付けた band の項目は、`<scope>.<id>` の名前で登録する。区切りは `.`。`.` は `parseRef` の区切り(`:` と `@`)とも、列 id の `#` とも当たらない。
- 素の `id` も、**曖昧でない限り** 引ける(下の 3)。

**2. `diagram({idScope: 'auto'})`(第 2 段)。** `scope` を書いていない自己配置 band に、自動で名前を付ける。名前は `band.id`、なければ `<type><n>`(同じ種類の n 番目、1 始まり。例 `gantt1`)。自動の名前は、衝突を避けるためだけに使う。修飾名で参照するなら、`scope` か band の `id` を明示する(エラー文にその書き方を出す)。

**3. 参照の解決(一か所の純関数にまとめる)。** `lib/anchor-scope.ts` を新設し、`resolveAnchor(table, id)` が次の順で決める。

1. `id` が登録名(素の box / group / row の id、列 id、修飾名)と完全に一致し、かつ、同じ `id` を素の名前に持つスコープ付きの項目がない → それ。
2. 完全一致がなく、素の名前に持つスコープ付きの項目がちょうど 1 つ → それ。
3. 2 つ以上(完全一致と合わせて 2 つ以上を含む) → **error**(`ambiguous anchor id "p0": plan.p0, sched.p0 — write one of them`)。黙って選ばない。
4. どれもなし → 今の `unknown anchor id`(候補があれば「`plan.p0` のことか」を添える)。

**4. 重複検査。** `claimed()` の対象を変える。スコープ付きの項目は、**自分のスコープの中**(と、素の登録名との完全一致 = 修飾名どうし)でだけ衝突を検査する。スコープなしの band の項目は、今まで通り全体で衝突を検査する。したがって、`scope` も `idScope` も使わない図の挙動は、検査も解決も今と同じ。

**5. 互換性の理由。**

- 今ビルドできる図には、重複がない。素の id の登録名は全部一意なので、解決の順 1(完全一致)が必ず当たり、結果は今と同じ(`anchors` の内容と順序も、`scope` なしの band では今と同じにする)。
- `scope` / `idScope` は新しいオプションで、使った図だけが挙動を変える。以前は throw していた組み合わせ(重複)が通るだけで、通っていた図の意味は変わらない。
- 描画物に id が出ない(SVG の `id` 属性ではなくレイアウトの内部名)ので、SVG は変わらない。

**6. 通す先。**

- `nodeIdsOf(b, scope?)`(`band-ids.ts`)と、素の名前の表を組み立てる関数を、純関数として `anchor-scope.ts` に置く。`reveal.ts` はレイアウトの前に走るので、`layout.ts` と **同じ関数** で表を作る(二重実装しない)。
- `reveal.ts` の `ids` / `untils`、plane の `lines` / `dims` / `paths.through`、`spotlight` の `ids`、`layout.ts` の `idsIn`(gap の計算)・`deferred` の判定(821 行)・`resolveConnect()`・`LaidOutConnect.fromId` / `toId`(解決した完全名を持たせる)は、全部 `resolveAnchor` を通す。
- **帯が返す id を、素の名前に戻す処理が要る**。各帯の出力 `anchors[].id` は素の id のままで、spotlight の照合(`spotlight.ts` 68〜80 行)と charts の `of` / `dimIds` が素の名前で持っている。修飾名で spotlight や reveal を指すときは、帯ごとに「修飾名 → その帯の素の名前」の対応表を持たせ、spotlight / charts の側がそれを引く。対応表は `anchor-scope.ts` の表から作る(帯の出力を修飾名に書き換えず、参照側を戻す。出力の形を変えないため)。
- **`reveal.ts:80` の同名後勝ちを直す(C の必須修正)**。`ids` / `untils` を完全名(修飾名を含む)のキーにして、素の名前は `resolveAnchor` で引く。直さないと、同じ素の id を持つ 2 つの band の段階が、後の band の値で黙って上書きされる。
- **型は第 1 段では最小限だけ変える**(`Declares` の修飾名は第 2 段)。`strict.ts` を読んで確かめた事実と、それに合わせた決定は次の通り。
  - 事実 1: `connect()` の参照は `RefIn` → `IdProblem`(`strict.ts` 76〜80 行)で照合される。リテラルの参照 `'plan.p0'` は、`IdOf` で `plan.p0` になり、`Known`(宣言済みの id の和)に無いので `unknown anchor id "plan.p0"` の型エラーになる。つまり **修飾名の参照は、何もしなければ `svg-diagram typecheck` で落ちる**。
  - 事実 2: パターン型や非リテラルの `string` は、`IsPattern<…>` が true になって `never`(= 通る)に落ちる作りになっている(同ファイル 47 行、79 行、65 行の `ShapeProblem`)。
  - 事実 3: `HandleRef`(ハンドルが返す、ブランド付きの文字列)は照合を飛ばす(同 79 行)。ハンドルの `.left` などは実行時には素の文字列。
  - 決定 (a): `scope` を付けた band のハンドル(`.anchors.<id>`、`withAnchors` / `withHandle`)は、**実行時に修飾名を返す**(`plan.p0`)。型は今のまま `string`(`HandleRef`)。素の名前を返すと、2 つの band が `p0` を持つとき実行時に曖昧エラーになり、回避策にならない。
  - 決定 (b): `Refers` の照合(`IdProblem`)に、`.` を含む参照を通す分岐を足す(`IdOf<R> extends `${string}.${string}` ? never`)。つまり修飾名は、`${string}.${string}` の形であればリテラルでも型エラーにしない。**その代わり、`.` を含む綴り間違いは型で捕まらず、実行時の `unknown anchor id`(候補つき)で捕まる**。
  - 残る穴: 素の `p0` は、型の上では 2 つの band が宣言した同じ名前として通るが、実行時には曖昧で error になりうる。つまり **型検査を通っても実行時の曖昧エラーはありうる**。第 2 段で `Declares<`${S}.${Ids}`>` を足して綴り間違いも捕まえるが、素の名前を型で許す限り、曖昧の穴は残る(型では曖昧を判定できない)。
- **0011(因果ループ図の介入点)との関係**。0011 の介入点の箱は id を持ち、band の `ids` / `anchors[].id` に入る。介入点の id も、因果ループ図の他の node と同じく、その band の `scope` で修飾される(`causalLoop(..., {scope})` が受ける)。0011 B(`causalLoop` のオーバーロード、`dsl.ts` 990 行付近と `CausalOpts`)は **型の例外として 0012 より先に入れる**(0012 の A〜D はそのあとに載せる。0012 が足す `scope` は、0011 が整えたオーバーロードに opts として足すだけにする)。介入点の id が band 内で重複しない検査は、band 内の検査として残る。
- 検査(`check`)に、`scope` を付けたのに衝突が一度も起きない band の「不要」警告は **出さない**(将来の追加で衝突しうる。警告は雑音)。

**7. 採らない範囲(今回)。**

- `group` 単位の `scope`。group は box を子に持ち、row の列 id や `areaIds` と絡む。band 単位で足りない実例が出てから、別 ADR で決める。
- top-level の box / group / row の id のスコープ化。これらは図全体の名前のまま。

### D2: `build --id-prefix`(新関数を 1 つ足すだけ。既存の 3 か所は触らない)

- 前の案(3 か所を 1 関数に寄せる)はやめる。3 つは接頭辞の形(`${p}${id}` と `${pre}-${id}`)、`<metadata>` の扱い(`inlineSvg` は書き換え、ファイルの SVG は書き換えてはいけない)、`<style>` の扱いが違い、出力を今と同じにしたまま寄せられない。
- `lib/svg-ids.ts`(新規)に、`--id-prefix` 専用の純関数 `prefixSvgIds(markup, prefix)` を 1 つ足す。`id="…"`、`url(#…)`、`href="#…"` / `xlink:href="#…"`、`aria-labelledby="…"`(空白区切りの複数)、HTML 形式の `<style>` の `#id` セレクタを書き換える。形は `<prefix>-<id>`。**`<metadata id="svg-diagram">` の id は書き換えない**(`check --drift` と `build --stale` が読む。`inlineSvg` とは逆の扱い)。
- `svg-diagram build <src>... --id-prefix <p>` を足す。SVG と `--html` の HTML の両方に掛ける。
  - ソースが 1 つなら `<p>-<id>`(例 `s1-svg-title`、HTML の root は `s1`)。
  - ソースが複数なら `<p>-<ソースの basename>-<id>`。`--out-dir` では出力名が basename で決まるので、basename の重複は今も許されない。
  - `--id-prefix auto` は、内容ハッシュの接頭辞(`sd<8 桁>`)。
- **既定は付けない**(`--id-prefix` なしの出力は 1 バイトも変わらない)。`emit.ts` / `emit-html.ts` は変えず、`build-diagram.ts` で書き出す直前に後処理として掛ける(ADR 0007 の純粋な核に入力を増やさない)。
- `raster.embedSvg` / `markdown-target.inlineSvg` / `htmlFigure` / `dedupeId` は **今のまま**。
- 複数の図を 1 つにまとめるコマンド(要望 F1)はここでは決めない。F1 のときに `prefixSvgIds` を使うか、既存の 3 つを整理するかを、そのとき決める。

## 代替案

| 案 | 内容 | 採らない理由 |
|---|---|---|
| a | `diagram({idScope: 'auto'})` だけ(`scope` なし)。全 band に自動で名前を付け、衝突した素の id は常に error | 修飾名を書く名前が自動(`gantt1`)で、band の順序が変わると参照が壊れる。明示の `scope` が要る |
| b | `scope` を付けた band は素の名前を引けなくする(常に修飾) | 衝突しない項目まで書き換えが要り、書き換えの手間という問題が残る。曖昧なときだけ error にすれば足りる |
| c | 重複を警告にして、後から来た id を勝たせる | 黙って別の box に線が引かれる。間違った図が「できて」しまう。今の throw のほうが安全 |
| d | 衝突した id に、自動で連番を付ける | 参照側がどれを指すか分からない。reveal / spotlight の段階が別の項目に付く |
| e | 接頭辞を付ける側(利用者)の仕組みを増やす(`scope` ではなく `idPrefix: 'p_'` が id の前に付く) | 修飾名との違いは区切りだけ。`.` で区切る `scope` が上位互換で、`Declares` の型も同じ形で書ける |
| f | D2 を `emit.ts` の `emitSvg({idPrefix})` で解く | 描画の核に入力が増え、既定の出力のキャッシュ・ハッシュが分岐する。後処理なら核は変わらない |
| g | D2 を、1 つの HTML にまとめる `deck` で解く | F1 は別の要望で、規模が大きい。D2 の「接頭辞を付ける」だけは先に独立して出せる |

## 影響

- **互換性**: `scope` / `idScope` / `--id-prefix` を使わない図は、解決の結果も、SVG も HTML も、変わらない。検証は `pnpm golden` の差分ゼロ(下の計画の単位 F)。基準は各 PR の直前の main。
- 以前は throw した図が通るのは、`scope` / `idScope` を使った図だけ。`duplicate anchor id` の既存テスト(`ergonomics`、`spotlight`、`canvas`、`stat-bars`、`reveal-receptacles`、`tree` の各 test)は、`scope` なしの挙動の固定として **そのまま通る**ことを要件にする。
- 第 1 段は型を変えない。型検査の穴(修飾名の宣言がない、曖昧な素の名前が型では通る)は D1 の節に書いた。第 2 段の型の追加は、既存の型を壊さない形にする。
- 曖昧な参照は error。エラー文に修飾名を出し、直し方が分かるようにする。
- 追加の制約が 1 つ増える。id に `.` を含む素の id を、`scope` 付きの band の修飾名と同じ文字列にはできない(登録時に衝突として検出する)。
- `check --drift` が読む `<metadata id="svg-diagram">` は、`--id-prefix` を付けても変わらない。

## 実装計画

独立に進められる単位に分ける。**マージ順は、0012-E(独立)が最初(ただし 0013 U2 のあと。下)。A〜D は最後**(0016 / 0010 / 0011 が `types.ts`、`dsl.ts`、`layout.ts` の呼び出し元を変えるので、それらのあとに載せる。各 ADR の opts 項目は `types.ts` に足すだけにして、競合を減らす)。byte 比較の基準は、各 PR の直前の main。

**0013 U2 との小さな衝突**: 0013 U2 と 0012-E は、どちらも `build-diagram.ts` を触る(0013 は書き出しの前後の処理、E は `--id-prefix` の引数と書き出し直前の後処理)。意味の衝突はなく、テキストの衝突だけ。順序は **0013 U2 → 0012-E** とし、E は 0013 U2 のマージ後の main から切る(E の `build-diagram.ts` の変更は引数の解析と、書き出す文字列への後処理 1 行に絞る)。

### E. D2: `prefixSvgIds` と `--id-prefix`(最初にマージ。他と独立)

- 触るファイル: `lib/svg-ids.ts`(新規)、`build-diagram.ts`(`--id-prefix` の引数と、書き出し直前の後処理)、`bin/svg-diagram` の先頭コメントと usage、`test/svg-ids.test.ts`(新規)、`test/cli.test.ts` に追記。既存の 3 か所(`raster.ts`、`markdown-target.ts`、`remark.ts`)は触らない。
- テスト: `id` / `url(#)` / `href` / `aria-labelledby`(複数) / `<style>` の `#id` が、同じ接頭辞で書き換わる。`<metadata id="svg-diagram">` が残り、`check --drift` が引き続き読める。2 つの SVG を接頭辞違いで 1 つの HTML に貼り、`id` の重複がない。`--id-prefix` なしの出力が byte 同一(`pnpm golden` の差分ゼロ)。ソースが複数のときの `<p>-<basename>`。

### A. 解決の核(`lib/anchor-scope.ts`、新規)

- 触るファイル: `lib/anchor-scope.ts`(新規)、`lib/band-ids.ts`(`nodeIdsOf` に `scope` を通す)、`lib/types.ts`(各 band の opts に `scope?: string`)、`lib/strict.ts`(`IdProblem` に決定 (b) の分岐)、`lib/dsl.ts`(`withHandle` / `withAnchors` が、`scope` を持つ band で修飾名を返す。決定 (a))、`test/anchor-scope.test.ts`(新規)、`test/types/`(または `dsl-exports` の fixture)に型の例を追加。
- 中身: 登録名と素の名前の表、`resolveAnchor` の 4 段、帯ごとの「修飾名 → 素の名前」の対応表。純関数のみ(`test/core-purity.test.ts` を通す)。
- テスト: スコープなしは素のまま・順序も同じ、一意 / 曖昧 / なし / 完全一致と素の名前の衝突 / `.` を含む素の id。ハンドル: `scope` つきの band の `.anchors.p0.right` が実行時に `plan.p0:right` になる。**型: `connect({from: 'plan.p0', to: 'sched.p0'})` と、ハンドルによる参照が `svg-diagram typecheck` を通る**。`scope` なしの既存の型テスト(未宣言の id が型エラーになる)は無変更で通る。

### B. レイアウトへの接続(`lib/layout.ts`)

- A のあと。触るファイル: `lib/layout.ts`、`lib/dsl.ts`(`scope` を band の opts に通す。ハンドルの修飾名は A で入れる)。
- 中身: `claimed()` の 30 か所を、スコープ付きの項目では「スコープ内だけ」で検査する(登録を 1 つの関数 `register(scope, id, rect, what)` にまとめる)。`resolveConnect()`、`deferred` の判定(821 行付近)、`idsIn`(gap 計算)を `resolveAnchor` に通す。`LaidOutConnect.fromId` / `toId` は解決した完全名。
- 注意: `scope` なしの band では `anchors` の key と挿入順を今と同じにする(`others` の障害物の列挙順が経路の選び方に効く)。
- テスト: `test/id-scope.test.ts`(新規)。chevron と gantt の `p0` を `scope` で書き分け、connect の端が正しい box に付く。曖昧な参照の error 文。スコープなしの重複は従来の error のまま。

### C. reveal / spotlight / charts / plane の参照(`lib/reveal.ts`、`lib/spotlight.ts`、`lib/charts*.ts`)

- A のあと(B と並列可)。**必須修正**: `reveal.ts:80` の `ids` / `untils` の同名後勝ちを、完全名キーにして直す。spotlight の `ids` の照合(`spotlight.ts` 68〜80 行)と、charts の `of` / `dimIds` は、修飾名を素の名前へ戻す対応表経由にする。plane の `lines` / `dims` / `paths.through` も `resolveAnchor` を通す。
- テスト: `test/id-scope-reveal.test.ts`(新規)。同じ素の id を持つ 2 つの band で、片方だけ `reveal: 2`(後勝ちで上書きされない)。connect の `reveal` の自動導出が、参照した側の段階になる。spotlight と charts の `of` が修飾名で効く。

### D. 第 2 段(`idScope: 'auto'` と型)

- A〜C のあと、実使用を見てから。`diagram({idScope: 'auto'})`(自動の名前の付け方と `DiagramOpts` への追加)、`Declares<`${S}.${Ids}`>`(修飾名の綴り間違いを型で捕まえる。第 1 段の (b) の通し分岐を、宣言された修飾名の照合に置き換える)。型検査の穴は D1 の節の通り。テストは `svg-diagram typecheck` と `dsl-exports` の fixture。

### F. 互換の回帰(各 PR で)

- `pnpm golden` の差分ゼロで代用する(ハッシュ fixture を新しく持たない)。`duplicate anchor id` を期待する既存テスト(`ergonomics`、`spotlight`、`canvas`、`stat-bars`、`reveal-receptacles`、`tree`)が、メッセージも含めて無変更で通る。
- 文書: skill の `svg-diagram` と README の id の節に、`scope` / `--id-prefix` を足す。コードと同じ PR に入れる。

### 並列の割り当てと PR

- 1 人目: E(先に単独でマージ)。
- 2 人目: A → B。3 人目: A が入ってから C。D は第 2 段として後回し。
- B・C は `lib/layout.ts` / `lib/dsl.ts` を触りうる。B が先に opts の型だけを入れ、`dsl.ts` の同じ関数を 2 人が触らないようにする。
- PR は E、A+B、C(、第 2 段の D)の順。worktree は単位ごとに分ける(共有の main ディレクトリは触らない)。

## 未決

- 区切りに `.` を使うことの最終確認。`.anchors.<id>` と見た目が似るが、文字列の中の区切りなので紛れない、という判断。
- `group` 単位の `scope`(別 ADR)。
- 第 2 段の自動の名前 `<type><n>` を、エラー文以外で使えるようにするか(使えると band の順序に依存する参照が生まれる)。
- F1(複数の図をまとめるビューア)で `prefixSvgIds` を使うか、既存の 3 か所を整理するか。

## 実装での補足(E = PR #158)

- `--id-prefix` と `--stale` を併用したときは、スキップせず毎回作り直す。来歴に接頭辞が入らず、前回の接頭辞の有無を判定できないため。
- HTML の root id は、ADR の例(root は `s1`)に従い、`s1-sd-…` ではなく接頭辞そのものにした。

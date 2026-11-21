# ADR 0072: 指摘と図の部品に、ソースの位置(ファイル・行・桁)を持たせる

- 状態: 決定・U1・U2a・U2b 実装済み・U3a・U3b 実装済み・U4a・U4b 実装済み(2026-11-21。Opus のレビュー 1 回目(`0072-opus-review-round1.md`)の Blocker 1・Major 5・Minor 10・Nit 7 を反映。2 回目(`0072-opus-review-round2.md`)は Blocker なし、D2 の運び方は全例で動くと確かめた上で、Major 3・Minor 5・Nit 6 を反映。3 回目(`0072-opus-review-round3.md`)は Blocker なし・Major 1(D7 の path が粗くなる)で、Major・Minor 5・Nit 6 を反映。4 回目(`0072-opus-review-round4.md`)で Blocker・Major なしで収束し、その Minor 4・Nit 4 を反映。PR #415 のレビュー 1 回目の m1・m2・n1・n2、PR #419 のレビュー 1 回目、同 PR のレビュー 2 回目の m1・n1、PR #422 のレビュー 1 回目の M1・m2・n1、PR #423 のレビュー 1 回目の M1・m1・m2・m3・n1・n2 と 2 回目の M1・m1・m2・n1、PR #425 のレビュー 1 回目の M1 を反映)
- 基点: `main`(950584b、PR #398 まで)
- 関連: ADR 0013(失敗の伝え方)、ADR 0025/0026(検査の重大度)、ADR 0034(SVG の `data-node`)、ADR 0038(ドリフトの検査)、ADR 0045(ブラウザの入口)、ADR 0071(JSON Schema)、svg-diagram-vscode(VS Code 拡張。Phase 2)

## 背景

VS Code 拡張は `check --format json` の指摘をエディタの波線にしている。指摘がソースのどこのことかを、CLI はほとんど言わない。

コードで確かめたこと(`check-diagram.ts`、`lib/rules.ts`、`lib/verify*.ts`、拡張の `src/check.ts`):

- `line` を持つのは文書の検査(`doc-*`)と `--covers` だけ。図のソースの指摘には位置がない。
- 規則の指摘(`Finding`)は、部品をラベルで言う(`data.band` は `band.name` やタイトル)。拡張は、そのラベルを引用符つきでソースの文字列から探し、ちょうど 1 か所で見つかったときだけそこに置く。同じ文言が 2 か所にあるとき、組み立てた文字列のときは 1 行目に置く。
- レイアウトの誤り(`verdict.problems`)はただの文字列(`"A" overlaps "B" by 12x4px`)で、部品への参照がない。
- ソースの読み込みや `define()` で投げた誤り(`build-error`)は、0.8.0 から JSON で出る。メッセージだけで行がない。0.5.0 は JSON を出さずに落ち、拡張はスタックの行を読んでいた。そのため 0.8.0 に上げると、誤りが 1 行目に移った(拡張の README に書いた後退)。
- SVG は平らな図形の並び。どの図形がどの部品かは、`data-node`(ADR 0034、id のある節だけ、希望したときだけ)でしか分からない。プレビューで図をクリックしてソースへ飛ぶ手がかりがない。

試して確かめたこと(U0。Node 26.13、`engines` は `>=22.18`。試しのファイルはレビュー 1 回目のもの):

- `.ts` のソースは Node の型の取り除き(type stripping)で読まれる。型は空白に置き換わるので、スタックの行・桁はソースのとおり(source map は要らない)。桁は呼ばれた関数の名前の所を指す(`box(…)` の `b`、`d.connect(…)` の `connect`)。
- `Error.captureStackTrace` は、深さ 25 ほどのスタックで 1 回 2.3 µs(上限 10)〜4.8 µs(上限 30)。文字にするとさらに 9〜25 µs。整形しない捕捉は 1 つ約 1〜2 KB を持つ。部品が数百でも、取るのは数 ms。
- **描く前に、部品はすべて写される。** `renderDiagram` / `checkDiagram` は最初に `detachData`(`lib/dsl/diagram.ts` の `cloneData`)で部品を深く写す。写すのは `Object.entries` だけで、シンボルのキーは捨てる(コメントのとおり)。
- **レイアウトの多くは、部品を作り直す。** `box` などは `{...band, x, y}` で写すが、`group`・`row`・`grid`・`swimlane`・`legend`・`pyramid`・`table`・流れの図形(`cycle` など)は、要るフィールドだけを選んで新しく作る。
- **レイアウトで投げた誤り**(`connect(): unknown anchor id`、`lib/layout-connect.ts`)のスタックには、利用者のフレームがない。`define()` の中で DSL が投げた誤り(`box` の `tone` など)には、利用者のフレームがある。
- 同じファイルの中の共通の関数(`examples/areas-trace.ts` の `const head = t => caption(t, …)` を 4 回呼ぶ)では、いちばん内側のソースのフレームは、4 つとも `head` の中の同じ行になる。呼んだ行はその外側のフレームにある。
- 公開の入口(`lib/dsl-pure.ts`)は、実行時に関数を 127、物を 3 つ(`em`・`icon`・`wf`)出す。`export *` は包めないので、包むなら名前を並べて `export const box = located(ns.box)` と書く。型を変えない包み(`located<F>(fn: F): F`)なら、`IdsOf` などの型の検査(知らない anchor id が型の誤りになる)はそのまま効く(`tsc` で確かめた)。

## 決定

**D1. 位置は `{file, line, column}` と、外側の呼び出しの並び `via`。** `line` と `column` は 1 始まり(エディタや SARIF と同じ)。`column` は呼ばれた関数の名前の位置(背景)。`file` は `check` の `file` と同じく、カレントディレクトリからの相対パス。粒度は**部品を作った呼び出し 1 つ**。`box(...)`・`cycle([...], ...)`・`connect(...)` / `d.connect(...)`・`diagram(...)` がそれに当たる。部品の中に書いた項目(`cycle` の各 `{label}`、`wf.*` の節)は、別の位置を持たない。項目まで絞るのは拡張の仕事で、部品の呼び出しの範囲の中でラベルを探す。

**D2. 位置を取り、描くまで運ぶ。** 取る所と、運ぶ所の両方を決める。運ぶ所の方が漏れやすい(背景)。

- **持ち方**: 部品に、**列挙できるシンボルのキー** `SOURCE`(`Symbol.for('svg-diagram.source')`。`svg-diagram/spec` などの入口が `node_modules` から別の写しで読まれても同じキーになる)で、小さなクラスのインスタンス `SourceRef` を置く(型の取り除きで動くよう、引数のプロパティでなく普通のフィールドで書く)。中身は `captureStackTrace` を受けた物、spec の部品のパス(D7)、またはその両方。そのスタックは列挙できない性質なので、深い写しで中まで写すと消える。だから `SourceRef` はどこでも**参照のまま**渡す。シンボルなので、JSON・`Object.keys`・SVG・PPTX には出ない。描いた結果は 1 バイトも変わらない。`SourceRef` と `located` はブラウザの入口からも届くので `node:*` を使わない。行と桁に解く所(D3。`fileURLToPath`・`realpath`)は CLI だけの別のモジュールに置く。
- **取る所 1: 公開の入口。** `lib/dsl-pure.ts` は、関数を `export *` でなく名前を並べて出し、部品を返すものを `located(fn)` で包む。`lib/dsl/io.ts` の部品を返す関数(`image`・`math`)も包む。包みの規則は次のとおり。
  - 文字列の `type` を持つ物(と、それを並べた配列の各要素)にだけ付ける。関数(`styled`)と部品でない物は素通しにする。
  - **すでに `SOURCE` があれば上書きしない**(`rewrite` が返す、変わらなかった部品は元の位置のまま)。
  - 返した部品の中の部品(`steps` の箱、`swimlane` の段、`versus` の中身)で `SOURCE` のない物には、外の呼び出しの `SourceRef` を付ける(`nestedBandsOf` で歩く)。`SOURCE` がある部品に着いたら、より近い位置を使えるよう、その中には降りない。
  - `wf.*` は対象外(ワイヤーフレームの部品の位置になる)。
  - 関数そのものに付いたプロパティは写し、関数なら同じく包む(`quadrant.preset`。写さないと `quadrant.preset is not a function` になる。型は変わらないので `tsc` では気づけない)。
  - `diagram()` は特別に扱う。返す `Diagram` には `type` がないが、`SOURCE` を付ける(`detachData` の spread で残る)。図全体の位置(D4)はこれを読む。`diagram()` の設定から足される部品(`withTitleLine`・`withSourceLine`・`withStatus` の見出しと出典、自動の凡例)は、`diagram()` の `SOURCE` を受け継ぐ。
- **取る所 2: `Diagram` のメソッド。** `d.connect(...)` は公開の `connect` を通らないので、自分で取る。`d.add(...)` は、`SOURCE` のない部品に `add()` を呼んだ位置を付ける(手で組んだ物への最後の受け皿)。
- **運ぶ所**:
  - `cloneData` は `SOURCE` だけを参照のまま写す。ほかのシンボル(`NUMBERING`・`GIVEN`・`RICH`)は、今のとおり捨てる。
  - `applyConnectDefaults` は、作り直した接続に元の `SOURCE` を写す。
  - 戻りの矢印(`expandLoopBacks`)は、`loopBack` を書いた部品の `SOURCE` を写す。
  - レイアウトは、**部品を振り分ける 1 か所**(`lib/layout.ts` の `ctx.stack`)で、処理の前後の `ctx.laidOut` を比べる。新しくできた部品のうち `SOURCE` のない物に、元の部品の `SOURCE` を付ける。後で解く接続(`deferred`)も同じにする。中の `ctx.stack`(`group` の中身など)が先に付けた、より細かい位置は上書きしない。各レイアウトの処理は直さない。
- **`WeakMap` にしない理由**: 写す所(`cloneData`・`cloneBand`・`rewrite`・`mapBands`・レイアウト)すべてで、写した物を登録し直すことになる。シンボルなら spread と記述子の写しで付いていく。付いていかない所は、上の 2 か所(`cloneData` と `ctx.stack`)だけ。
- **取るのは、要るときだけ。** `check` と、`build --locations`(D6)だけが、ソースを読む前に `captureSourceLocations(true)` を呼ぶ。ほかの CLI(`show`・`serve`・`notes`・`md`・`pptx`・`deck`・`site`)と、ライブラリとして使う人(Workers の `renderSpecEdge`、ブラウザのページ、MCP)は、スタックを取らない。その手間はない。ただし D7 の spec の印はいつも付くので、spec から作った部品には `SOURCE` のシンボルが見える(`Object.getOwnPropertySymbols` や `deepStrictEqual` で)。`captureStackTrace` がない環境では、有効にしても何もしない。`check` でも、図の指摘を出さない調べ方(`--drift`・`--docs`・`--covers` だけのとき)では取らない。

**D3. どのフレームを位置にするか。**

- フレームは、まず V8 の CallSite で読む。括弧のあるパス、`async` / `new` のフレーム、名前のないフレームも同じに扱える。なお、自前の `prepareStackTrace` を入れると Node の `--enable-source-maps` の書き換えが効かなくなる。source map つきの JS の共通部品を読む人のため、`process.sourceMapsEnabled` のときは `module.findSourceMap` で CallSite を元の位置に直す。CallSite は、`stack` を一度でも文字にすると取れない(`SVG_DIAGRAM_DEBUG`、利用者の `catch (e) { console.error(e); throw e; }` など)。そこで `check` と `build` は、起動のときに CLI 全体の `Error.prepareStackTrace` を 1 つ入れる。それは CallSite を誤りのシンボルに残し、いつもの文字のスタックを返す。V8 はこれを `stack` を初めて読んだときに呼ぶので、解く側はシンボルを見る前に `err.stack` を一度読む。
- **文字のスタックも読む(CallSite がないとき)。** 構文の誤り(書きかけの `return a +;`)、型の取り除きで扱えない構文(`enum` など)、ない名前の import は、Node が読み込みのときに作る誤りで、`stack` はすでに文字になっている(22.23、25.9、26.13 で確かめた)。位置は先頭の `path:line` の行(パスのことも `file://` の URL のこともある)と、`^` の行(桁)にしかない。読む順は次のとおり。(1) 先頭の行が `パス:行` で、その次のソースの行のあとに `^` だけの行が続くなら、そのファイルのその行(`define()` の中で壊れたファイルを `import()` したときも、誤りはそのファイルのこと)。パスには空白も日本語も入るので、`^(.+):(\d+)$` で読む。`^` の行を条件にするのは、`throw new Error('aspect must be 16:9')` の先頭の行(`Error: aspect must be 16:9`)を、パスと読まないため。Node が先頭にパスの行を付けるのは、読み込みのときの誤りだけ。(2) CallSite の利用者のフレーム。(3) 文字の `at …:行:桁` のフレーム。CLI 全体の `prepareStackTrace` を入れると構文の誤りにも CallSite が付くが、Node の中のフレームだけなので、(1) を先にする。`^` の桁は、出す所によって意味が違う。型の取り除きの誤り(`err.code` が `ERR_INVALID_TYPESCRIPT_SYNTAX` / `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`)は表示の幅で、タブは次の 4 の倍数まで進み、全角は 2 になる。そのときだけ、その行のソースを読んで UTF-16 の桁に直す。ラベルが日本語の行で桁がずれないように。V8 の誤り(ない名前の import など)の `^` は、すでに UTF-16 の位置なのでそのまま使う。import のパスの打ち間違い(`ERR_MODULE_NOT_FOUND`)には先頭の行も利用者のフレームもない。メッセージに `imported from <検査しているソース>` とあれば、そのファイルの import の指定子(`from '…'` と `import('…')`)を 1 つずつ解き、メッセージの絶対パス(`Cannot find module '<絶対パス>'`)と同じになる物の位置にする。相対パスは解いた絶対パスで書かれるので、文字のまま探しても見つからない。パッケージ(`Cannot find package '<名前>'`)は、書いたとおりの名前で探す。エディタで保存した書きかけのファイルがいちばん多く出す誤りなので、U1 に入れる。
- パスは `fileURLToPath` で戻す(日本語・空白のパスは URL では `%E6…` になる)。その前に、読み直しの問い合わせ(`?svg-diagram-fresh=…`、`lib/resolve-hook.ts`)を外す。
- **パッケージの中のフレーム**は読み飛ばす。それは、パッケージの根(`node:module` の `findPackageJSON` で見つけた `package.json` のディレクトリ)の `lib/` と `dist/` より下、根の**直下**の `.ts` / `.js`(CLI の入口と、`drift-cache-io.ts`・`drift-pool.ts` のような CLI の部品)、それに `node:` のフレーム。根より下の全部とはしない。clone で動かすと、`examples/` やテストの図まで「中」になってしまうため。検査しているソースそのものは、どこにあっても読み飛ばさない。(U1 の実装で、入口のファイルを手で並べた一覧が CLI の部品を漏らした(PR #407 のレビュー 1 回目 M1)ので、この形にした。)
  そのため、clone の根の直下に置いた利用者の共通の部品(`_parts.ts` など)は位置にならない(位置なしに戻るだけで、誤った位置は出さない)。共通の部品は `examples/` などのディレクトリに置く。`findPackageJSON` は Node 22.14 から。
- ソースのフレームかどうかは、フレームのパスとソースのパスを、どちらも `realpath` にして比べる(シンボリックリンクを通すと、スタックは実際のパスになる)。出力には、引数に書かれたとおりのパスを使う。別のファイルの位置(`location`)は、スタックの実際のパスになる。そこで、カレントディレクトリ(とその realpath)の下にあれば、カレントディレクトリからの論理的なパスに直して出す。シンボリックリンクを通して開いたワークスペースでも、拡張が開いた文書と合わせられるようにするため。
- **`loc` は、検査しているソースの中のいちばん内側のフレーム。** ソースの中の外側のフレームは、内から外の順に `via` に入れる(5 つまで)。`loc` が共通の関数の中の 1 行になるとき(背景の `head`)、拡張は `loc` の呼び出しの範囲でラベルを探す。見つからないとき、または同じ `loc` の部品が複数あるときは、`via` を外へたどる。いちばん外を `loc` にしない理由がある。`.map(t => box(...))` を何行にも書くと、外側は `.map` の行になり、部品ごとの行を失うからだ。
- ソースのフレームがなければ、利用者の別のファイル(`_parts.ts` など)のいちばん内側のフレームを `loc` にする。
- `check` と `build` は、起動のときに `Error.stackTraceLimit = 50` にする(包みの中だけでなく、投げた誤りのスタックも深く取るため)。

**D4. 指摘の位置を、その元から取る。**

- `build-error`:
  - 順に、誤りの `SOURCE`(部品の印)、誤りの CallSite か `stack` の文字から D3 で取った位置、`DIAGRAM_SOURCE`(図全体)。
  - 文字列など、`Error` でない物を投げたときは、一度だけ `new Error(String(e), {cause: e})` に包む(そのままでは位置を付けられない)。
  - `define()` で投げた誤りは、スタックに利用者のフレームがある(U1。位置の捕捉は要らない)。
  - レイアウトで投げた誤りは、`ctx.stack` と、後で解く接続の繰り返しで受け止める。そこで処理していた部品の `SOURCE` を誤りに付けて(すでにあれば付けない)、投げ直す(U2a)。
  - レイアウトの外で、部品ごとに回る所も同じにする(小さな `atBand(band, fn)` で)。`detach` の `resolveImages`(ない画像のファイル)、`prepareReveal`(`reveal` / `until`。部品を歩く所と、そのあとの接続の繰り返しの 2 か所)、`fillAutoToday`(gantt の `today`)、`layoutBands` の最初の歩み(1 回目)。
  - どれにも当たらない、図の設定の誤り(`spotlight` の知らない id、`slide` のない `fill`、測る所の誤り)は、`renderDiagram` / `checkDiagram` が受け止めて、`diagram()` の印を別のキー(`DIAGRAM_SOURCE`)で付ける。これは**最後の手**で、部品の `SOURCE` も利用者のフレームも解けないときだけ使う。`raw({draw})` の `draw` で投げた誤りは、利用者のフレームがあるので、その行になる。
- **中の受け渡しを、文字列から構造にする。** `Verdict.issues: {message, loc?, related?}[]` をただ 1 つの元にする。`verdict.problems` の文字列は、`verifyDiagram` の最後で `issues` から作る(`problems` を読む今の利用者 `check`・`show`・`serve`・spec・Worker のため)。各処理の `out.problems.push(文字列)`(`lib/verify-handlers.ts` に 53 か所)は直さない。`runCheckPhase` / `contrastProblems` が部品ごとの `out` を渡し、そこに入れた文字列を `{message, loc: band[SOURCE]}` にする。`loc` はプロセスの中では `SourceRef` のまま持ち、CLI で解く。`build()` が検査に落ちて投げる誤りにも `issues` と `laidOut` を付ける(`build --locations` が地図を書けるように。D6)。`--drift --rebuild` は捕捉しないので、`drift-rebuild-failed` は今のとおり位置なし。文字列と構造を 2 本並べて持つことはしない(順番や重複の除き方がずれる)。最初に、四角を集める 1 か所(`collectRects`。重なり・はみ出し・接続)を直す。四角(`CheckRect`)は元の部品の `loc` を持つ。`row` / `grid` の中の箱は `d.laidOut` の要素でなく、その処理が中を歩く(`childRects`・`checkNoWrap`・`contrastFor`)。そこでは中の箱の `SOURCE` を使い(なければ外の部品の)、中の箱ごとの `out` に入れる。「元の部品」は、四角が中の箱のものなら中の箱のこと。2 つの部品の重なりは、1 つ目を `loc`、2 つ目を `related` にする。
- 規則の指摘: `Finding` に `loc?: SourceLoc` を足す。部品を見る規則は、`at(band)` で位置を付ける。図全体を見る規則(幅・密度など)は `diagram()` の位置を使う。規則ごとに位置の付いた割合を `examples/*.ts` で数えるテストを置き、下がったら分かるようにする。
- 部品ごとに出す規則では、重複を除く所(`headlineLength` の `seen`、`appearance: 'auto'` の `mergeSides`)のキーに位置も入れる。色の対・トーンなどで図全体をまとめる規則は、従来の件数と文言を保ち、`mergeSides` では規則と文言で照合する。最初の部品を `loc` に、ほかの部品を `related` に最大 10 件入れる。
- 規則の指摘に部品の印がなければ `diagram()` の印を使う。使える印やソースのフレームがなく位置を解けないときは、位置を付けない。

**D5. 出力の形。**

- `--format json`: 指摘に `line` / `column` を足す(位置が `file` の中のとき)。位置が別のファイルのときは `location: {file, line, column}` を足し、`file` は検査したソースのまま。外側の呼び出しは `via: [{line, column}]`、重なりの相手は `related: [{file, line, column}]`。`--baseline` の指紋(`file`・`rule`・`message`)は変えない。行がずれても、ベースラインは外れない。
- `--format github`: `line=` / `col=` を足す。位置が別のファイルなら、そのファイルに付ける(PR でその差分に出る)。
- `--format sarif`: `region` と `relatedLocations` を足す。`region` が増えると、GitHub の code scanning は一度だけ古い警告を閉じて新しく開く。そこで、`partialFingerprints` にベースラインと同じ指紋を入れて、それ以降は行が動いても同じ警告にする。
- `--format text` の `build-error` は `✗ <src>:L:C: <message>`(別のファイルなら `✗ <src>: <file>:L:C: <message>`)。レイアウトの誤りは `✗ <src>:` の下に、位置があれば `  <位置>: <message>` の行を出す(位置は検査したソースの中なら `<src>:L:C`、別のファイルなら `<file>:L:C`)。行の書き方の変更は README に書く。
- `--worker` の子が返すのは、解いたあとの普通の値だけにする(`SourceRef` は渡さない)。

**D6. 図からソースへ: SVG は変えず、別のファイルに地図を書く。** `build --locations FILE`(`--locations-dir DIR`)は、次を JSON で書く。

- 部品ごとに `{loc, via?, kind, rect: {x, y, w, h}, label, node?, reveal?, until?}`。
  - `rect` は SVG の `viewBox` の座標。fill・canvas の倍率と `layoutFitted` はレイアウトで当たっている。部品を囲う四角は描画と同じ幾何の関数を通す。画面の題名が枠の外にあれば、枠の四角を使う。
  - `node` は ADR 0034 の名前。
- 接続は、線と見出しの外接の四角に加えて、`segments`(線の区切り)を書く。
- 図全体は `diagram()` の位置で 1 つ。
- **検査に落ちても書く。** 重なりやはみ出しがあると `build` は SVG を書かずに落ちる。直す所があるときこそプレビューに地図が要るので、`--locations` は、レイアウトまで進んだなら地図と `issues`(位置つき)を書いてから落ちる。`build()` が投げる誤りに付いた `laidOut` から書く(D4)。
- 地図の元は `laidOut`。成功したときの `BuildResult` にも `laidOut` を足す(今は返していない)。
- フラグは SVG と同じく 2 つに分ける。`--locations FILE`(ソースがちょうど 1 つのとき)と `--locations-dir DIR`(ソースごとに `<名前>.locations.json`。`--out-dir` と同じ名前の付け方)。
- `--stale` で SVG を飛ばしたソースでも、地図が無い・地図の `provenance` が今のソースと合わない・地図が `issues` を持つときは、地図を作り直す。
- 地図の `provenance` には、SVG の鮮度判定と同じソース・依存ファイル・設定ファイルのハッシュ、ツールの版、`--no-source-line` の有無を記録する。

拡張のプレビューでの使い方:

- **図からソースへ**: クリックの位置を `getScreenCTM().inverse()` で SVG の座標に直し、四角を引く。いくつも当たれば、面積の小さい方、次に後の部品を選ぶ。`group` の中の箱は、`group` より先に当たる。
- **ソースから図へ**(カーソルから部品を光らせる): 同じ地図を逆に引く。
- SVG に `data-src` を書かない理由: ソースの行が変わるだけで SVG が変わり、ドリフトの検査(ADR 0038)が落ちるため。

**D7. JSON の spec は、今ある `path`(`parts[3].links[1]`)を、文言の推測でなく部品の印から出す。** spec にはすでに位置の仕組みがある。`locateMessage` / `locateVerdict`(`lib/spec.ts`)が、メッセージの中の引用された文言から部品を探し、`LocatedMessage.path` に `parts[3]` の形で入れる。MCP の `check_diagram` / `render_diagram`、`spec-edge`、`pptx-edge` がそれを返し、デッキは前に `slides[i].figure.` / `slides[i].columns[j].figure.` を付ける。この形と欄の名前は変えない。

- 印は `SOURCE` に乗せる(ほかのシンボルは `cloneData` で消える)。`SourceRef` の `specPath` に持たせる。
- `assemble()` は `partDef.build(part, at)` のあと、返った部品とその中の部品に `{specPath: 'parts[3]'}` を付ける。spec の部品は包んだ入口の関数で作るので、捕捉が有効なら先にスタックの印が付いている。部品ごとにそのスタックを保ったまま `specPath` を足す。スタックを捕捉していなければ `specPath` だけを持つ。
- 印は、今の文言の推測を**置き換えず、狭める**。今の推測はフィールドまで言う(`parts[0].nodes[0].label`、ボードの線は `parts[2].links[1]`。`test/spec.test.ts` が固定し、MCP が返している)。部品の中の部品はどれも同じ `parts[i]` の印を持つので、印だけにすると粗くなる。レイアウトの誤りは、`loc` に spec の印があれば、その部品の中だけで今の推測(`linkOf`・`locateIn`)をし、見つからなければ印の `parts[i]` を返す。印がなければ、今のとおり全体を探す。レイアウトで投げた誤りを位置にする `layoutIssue(spec, error)` も、誤りの `SOURCE` に spec の印があれば同じく狭める(知らない anchor が、同じ文言の 2 つの部品の片方にあるときに効く)。良くなるのは、同じ文言が 2 つの部品にあるとき(今は場所を言えない)。それを確かめるテストと、1 か所にしかない文言が `.label` までの path のままであるテストを置く。
- スタックは要らないので、**いつも付ける**(ライブラリの道でも)。
- 規則の指摘は、指摘の部品(`loc`、次に `related` の順)のうち、印が付いた部品の中で文言を探し、最初に見つかったフィールドの path を返す。どの部品にもフィールドが見つからなければ、最初の部品(`loc`)の印の `parts[i]` を返し、その印がなければ従来どおり spec 全体を探す。
- `issues` の構造が要るので、U3 の後(U4)にする。
- MCP・`spec-edge`・デッキの検査は `specPath` を使う。`.ts` が `specToDiagram()` を呼ぶときも、`check` や `build --locations` はスタックからソースの行・桁を出す。投げた誤りに `specPath` だけがあれば、誤りのスタック、図全体の印の順に位置を探す(D4)。

## 実装の順

- **U0**(この ADR): 背景の試し。
- **U1**: 読み込みと `define()` で投げた `build-error` の位置。D3 のフレームの選び方(CallSite と文字のスタックの両方)、CLI 全体の `prepareStackTrace` と `stackTraceLimit`、D5 の出力の形を作る。捕捉はまだ要らず、今の拡張がすでに `line` を使うので、これだけで拡張の後退の大半が直る(レイアウトとその前後で投げた誤りは U2a)。`test/cli.test.ts` に、投げた行のテストと、構文の誤り・`enum`・ない名前の import のテストを足す。共通の関数から投げたとき(同じファイル・別のファイル)の `loc` と `via`、日本語と空白のあるパスのテストも足す。CI の Node 22 の job でも回す。
- **U2a**: 運ぶ所(D2 の「運ぶ所」・`Diagram` のメソッド・`diagram()` の印・D4 の、レイアウトとその前後で投げた誤りに位置を付ける所)。ない画像・箱と接続の `until` の誤り・`spotlight` の知らない id・知らない anchor id のテストを置く。テストでは、手で `SOURCE` を付けた部品を `checkDiagram()` / `renderDiagram()` に通し、レイアウトのあとのすべての部品が `SOURCE` を持つことを確かめる。危ないのはここ。
- **U2b**: 公開の入口の包み(`located`、名前を並べた export)。`.ts` の試しの図に、部品を返す関数ごとに最小の引数を書いた表を置き、それぞれの位置がその行に解けることを確かめる。`lib/dsl.ts` の実行時の export(関数に付いたプロパティ `quadrant.preset` も)のうち、表にも「部品を返さない」一覧(`build`・`renderDiagram`・`checkDiagram`・`closeMeasurer` など)にもない関数があれば落ちる(`partCatalog()` は JSON の部品だけで、`box`・`row`・`connect` などがないので使わない)。
- **U3**: 指摘の構造化と位置(D4 の残り、D5)。拡張は、`line` があればそれを使い、なければ今のようにラベルを探す(古い core でも動く)。
- **U4**: `build --locations`(D6)と spec の印(D7)。拡張のプレビューの「クリックでソースへ」と一緒に。

テストの注意: `assert.deepStrictEqual`(と、どのテストも使う `node:assert/strict` の `deepEqual`)は列挙できるシンボルも比べる。スタックの捕捉は既定で切ってあるので、`.ts` の DSL のテストは変わらない。D7 の spec の印はいつも付くが、spec から作った部品の木をそのまま比べるテストは今はない(読んで確かめた)。捕捉を有効にするテストでは、部品を比べる前に `SOURCE` を外すか、CLI のプロセスの外から確かめる。

## 考えたが採らなかったこと

- **TypeScript でソースを読み、呼び出しを順に数えて部品に合わせる**: ループ・条件・共通の関数があると、呼び出しの順と部品の順が合わない。実行して取るスタックなら、どう組み立てても呼んだ所が分かる。
- **部品に普通のフィールド(`src: '12:5'`)を足す**: 部品のキーを並べて読む所すべてに出てしまう。たとえば部品を比べるテスト(200 を超えるファイル)や、`rewrite` の patch。JSON の spec の部品とも形が変わる。
- **`WeakMap` で部品から位置を引く**: D2 のとおり、写す所すべてで登録し直すことになる。
- **SVG に `data-src="12:5"` を書く**: D6 のとおり。
- **すべての部品の関数の中で、それぞれ位置を取る**: 127 の関数を直すことになり、新しい部品で忘れやすい。入口で一度包み、表のテスト(U2b)で漏れを見張る方がよい。
- **`loc` をソースの中のいちばん外側のフレームにする**: D3 のとおり、`.map` で作る部品が 1 行にまとまる。
- **`data.fix` から Quick Fix を作る**: `fix` は人が読む文で、機械が当てられる編集ではない。位置が入ったあと、別の ADR で決める。

## 結果

- 拡張の波線が、指摘の元の部品の行に付く。同じ文言の部品が 2 つあっても、1 行目に落ちない。`build-error` は投げた行に戻る。構文の誤りはその行と桁、部品で投げた誤り(レイアウト・画像・`reveal` など)はその部品の行、図の設定の誤りは `diagram()` の行になる。0.8.0 での後退が直る。
- CI の注釈(`github` / SARIF)が、PR の差分の行に付く。
- 描いた SVG・PPTX・JSON は変わらない。位置はシンボルのキーにあり、外に出るのは CLI の出力と `--locations` の地図だけ。
- `check` の負担は、部品 1 つにつき数 µs と 1〜2 KB。ほかの CLI とライブラリは取らないので、負担はない。
- 公開の入口は、名前を並べた export になる。部品の関数を足す人は、そこに 1 行足し、U2b の表に例を足す(足し忘れるとテストが落ちる)。

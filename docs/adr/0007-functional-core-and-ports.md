# ADR 0007: 描画の状態を値にする(ROLES・入力の破壊・ports)

- 状態: 実装済み(PR #43、813608c でマージ。改訂 3)
- 日付: 2026-10-11
- 基点: `main`(221d59c、PR #42 まで)
- 関連: ADR 0004 §0、ADR 0006(HTML/CSS 描画)

## 背景

処理は一方向のバッチ変換である。

```
DSL(ビルダー) → Diagram データ → prepareReveal / applyAutoLegend
  → layoutDiagram(async) → applySpotlight → verifyDiagram → emitSvg / emitHtml → xml 検査
```

中核(レイアウト・検証・emit)は決定的な変換だが、**描画の状態がグローバルと入力の書き換えに漏れている**。初版は「FCIS + Ports に整理する」だったが、Opus のレビューで、動機の取り違えと、費用に見合わない部分が見つかった。実際に再現できた問題から書く。

### 実在する問題(再現済み)

1. **並行描画で `ROLES` が漏れる**。`renderDiagram` は fill の二分探索のために `ROLES`(文字サイズ表)を書き換え、`finally` で戻す(`dsl.ts:844-869`)。`await layoutAt(mid)` の途中に別の `renderDiagram` が走ると、fill でない図が 14px でなく 20〜22px で描かれる。さらに `const baseRoles = {...ROLES}` は**呼び出し開始時の値**を取るので、図 B が図 A の拡大中に始まって A より後に終わると、B の `finally` が `ROLES` を A の拡大値に「戻し」、プロセスの残りが壊れる。並行描画は実在する(`test/versus.test.ts:31` の `Promise.all`、Slidev アドオンの `renderSource`)。
2. **fill モードの reveal 段階ファイルが 1 倍の文字で描かれる**。`finishBuild`(`dsl.ts:887-907`)は `renderDiagram` が `ROLES` を 1 倍に戻した後に `emitSvg(r.laidOut, {reveal: stage})` を呼ぶ。emit は table / sequence / swimlane / legend / stamp / pyramid の文字を `ROLES` から読むので、レイアウトは 1.79 倍で文字は 14px になる(再現: fill + table + reveal の図で、本体は 25,27px、`reveal0.svg` は 14px)。`test/render-diagram.test.ts:50` は本体しか見ていない。
3. **パスが入力を破壊的に書き換える**。`prepareReveal` は利用者の band オブジェクトに `reveal` を書き込み(`reveal.ts:22,34,45,82`)、`applyAutoLegend` は既存の legend の `items` に push する(`rules.ts:157`)。`renderDiagram` は `d.width`(`dsl.ts:853`)・`d.usableWidth`・`d.maxDisplayHeight` を書く。`checkDiagram` も同じ。**同じ band を 2 つの図で共有すると、片方の reveal がもう片方に漏れる**(共通部品はこの使われ方をする)。

### 初版の認識から訂正する点

- ADR 0004 §0 #3(plane の文字サイズが読み込み時に固定される)は**すでに直っている**(`plane.ts` / `bars.ts` は呼び出し時に `ROLES` を読み、`test/plane-size.test.ts` が検査している)。「既存の出力が変わるのは fill の plane だけ」は誤り。
- 「例外の経路で `ROLES` が漏れる」は誤り(`finally` で戻る)。漏れるのは上の 1 の並行実行。
- `renderDiagram` を公開しているのは `svg-diagram`(`lib/dsl.ts`)で、`svg-diagram/render`(`renderSource`、`close`)ではない。両方を守る。
- `ROLES` の読み手は、layout・emit・bars・plane のほかに **`seq-table.ts`**(`collectTextRequests`、`layoutSequence`、`layoutTable`)と **`emit-html.ts`**(`:8,122`)がある。`dsl.ts` には 2 つのスナップショット(`BASE_ROLES` :168 と `baseRoles` :844)があり、統合する。
- **golden は fill を 1 枚も通らない**(`examples/*.ts` に `fill: true` は `spotlight-dim-fill.ts` のみで、段階ファイルも見ない)ので、「golden 不変」は fill の退行を検出しない。

## スパイクの結果(3 案を別 worktree で実装して比べた)

3 案とも同じ再現テスト(並行描画、fill の reveal 段階ファイル、box / plane / bars / row の共有 band の漏れ)を先に書き、**元の main で全部落ちること**を確かめてから実装した。実装後は 3 案とも `pnpm test`・`typecheck`・`golden` が通り、golden の差分はない。

| | A: `roles` を `LaidOutDiagram` に焼き込む | B: AsyncLocalStorage の `currentRoles()` | C: mutex + 段階ファイルの前倒し |
|---|---|---|---|
| lib の差分 | 9 ファイル、約 +300/-200(引数の追加が中心) | 約 +220/-110(ほぼ置換) | `dsl.ts` 約 44 行 + `types.ts` 2 行 |
| 並行描画 | 直る(状態が値) | 直る | 直る(直列化するだけ) |
| fill の段階ファイル | 直る | 直る(`finishBuild` で `scaleRoles(ROLES, fontScale)` を再計算するので、知識が 2 か所になる) | 直る(`RenderResult.revealSvgs` を足して前倒し) |
| 渡し忘れ(測るのは拡大値、描くのは 1 倍) | **コンパイルエラー**(typecheck の赤を消すだけで済んだ。実行時に拾ったものはゼロ) | スコープ外で `emitSvg` を呼ぶと型検査を通ったまま黙って 1 倍。reveal 段階ファイルのバグと同じ種類 | 構造のまま残る |
| `renderDiagram` の外で `emitSvg(r.laidOut)` | 正しい大きさで描く | 1 倍で描く | 1 倍で描く |
| 純粋さ・§4 の依存方向 | 前進する(`layoutWith` が同期で純粋) | 逆行する(隠れた文脈、`node:async_hooks`) | 何も進まない |
| 副作用 | なし | なし | 冷たいキャッシュの図が多いと、並行していた測定が逐次になる(未計測)。`raw({draw})` からの再入でデッドロック |

**共通して見つかったこと(どの案でも要る)**:
- `structuredClone(d.bands)` は `raw({draw})` の関数で `DataCloneError` になる(round 2 の「examples 27 本で通る」は raw を含まない例だけの確認だった)。**プレーンなオブジェクトと配列だけを再帰コピーし、関数などは参照共有する自前のコピー**にする。非列挙の handle / anchors は落ちるが、下流は読まない。
- 入力を壊さなくなると、描画後に `d.maxReveal` / `d.revealWarnings` / `d.bands`(自動 legend)を読んでいた既存テスト 3〜4 件が落ちる。`laidOut` から読むよう直す。**`slidev-addon-svg-diagram` を検索したが、これらの参照はなかった**ので、外部への影響は確認できていない範囲では無い。
- 共有 band の漏れは、**SVG 本体の文字列比較では検出できない**(最終段階は同一になる)。比較する観測点は `laidOut.maxReveal` と `emitSvg(laid, {reveal: 0})`。
- 並行描画の再現は `await Promise.resolve()` のマイクロタスクで回す必要がある(`setImmediate` では main でも通ってしまう)。

### 確定

**案 A を採る**。決め手は 2 つ。(1) 直したいバグの種類(測る大きさと描く大きさの食い違い)を、型検査で構造的に防げるのは A だけ。(2) §3・§4 の前提(`layoutDiagram` の分割)が A の中で一緒に済み、B・C では何も進まない。C は直接の差分が最小だが、A の再現テストと入力コピーはそのまま流用でき、`ROLES` が書き換わる窓が残る。B は差分が小さいが、隠れた文脈という、ADR の目的と逆の方向に進む。

ただし C の知見から、次を A に取り込む: 再入の禁止は不要(A は直列化しない)。冷たいキャッシュでの並行測定は A でも逐次化されない。

## 決定案

**目的は「描画の状態を値にして、並行描画と共有部品で結果が変わらないようにする」ことに絞る**。次は採らない。

- **代数的効果 / Effect-ts**: JS に言語機能がなく過剰。`layoutDiagram` は 1 回の測定で閉じている(`registerBand` で要求を全部集め、`measureAll` を 1 回だけ await して、以後は同期の `widthOf` で引く。追加測定の箇所はない)ので、トランポリンも不要。
- **Elm アーキテクチャ**: 入力から SVG への 1 回きりの変換で、状態遷移がない。
- **Measurer / BudgetSource のインスタンス化(初版の Ports)**: 測定の `memo` はキーが入力を完全に含む純粋なキャッシュで、正しさの問題を起こしていない。「プロセスで 1 つの既定 Measurer を共有する」なら状態は消えない。`browserPromise` は `svg-diagram show` の描画と共有しており(`measure.ts:64-104`)、分けると Chromium が 2 つ起動する。Slidev アドオンなどが実際に別の測定器を要求した時点で再検討する。
- **`lib/core/` への移動**: 衝突の費用(進行中の worktree が 20 以上)に見合わない。代わりに §4 の検査をファイルの移動なしで入れる。

### 1. `ROLES` を値にして、結果に焼き込む(最優先)

- `scaleRoles(base, s): Roles` を純粋関数にする(`Math.round(base * s)` のまま。丸めは今と同じ。最終描画は丸め後の `fontScale` の値でレイアウトした結果と一致させる)。`applyScale` と `finally` の巻き戻しをなくす。
- `layoutDiagram(d, {roles?})`(省略時は `ROLES`)にして、直接呼ぶ箇所(`checkDiagram`、`test/wireframe.test.ts` など)は無変更で済ませる。`stampChipW` などの export 関数の `roles` も必須引数にする。
- **`LaidOutDiagram.roles` にレイアウト時の値を持たせ**(`fontScale` と同じ場所)、`emitSvg` / `emitHtml` はそこから読む(`verifyDiagram` / `analyzeFit` は `ROLES` を読まないので変えない)。`emitSvg(laidOut, opts)` のシグネチャは変えない。呼び出し側が roles を持ち回って食い違える余地をなくす。前例: `LaidOutTable.bodySize`、`LaidOutPlane.labelSize`。
- `ROLES` は既定値の定数として `Object.freeze` する。`BASE_ROLES` と `baseRoles` は 1 つに統合する。`ROLES` は公開 API から re-export されておらず、`test/plane-size.test.ts` の代入だけ書き直す。
- 内部関数(`textRuns`、`collectTextRequests`、`layoutSequence`、`layoutTable`、`barsTexts`、`layoutBars`、`planeTexts`、`layoutPlane`、emit の各 render 関数、emit-html)の `roles` は**必須引数**にする。省略可能は `layoutDiagram` だけ(テストが直接呼ぶ関数も必須にして、テストを書き直す。スパイクでは typecheck の赤を順に消すだけで済んだ)。
- `layoutDiagram` を、同期の `collectMeasures(d, roles)` と `layoutWith(d, roles, widthOf)` に割り、`await measureAll` は殻の `lib/layout-measured.ts` に出す(`layoutDiagram` のラッパもそこ。layout.ts に残すと §4 が通らない)。
- 出力が変わるのは、**fill モードの図の reveal 段階ファイル**(table / sequence / swimlane / legend / stamp / pyramid を含むもの)だけで、これは直る方向の変化(上の 2)。`check --drift --rebuild` が `drift-rebuild` を出すので、利用側に告知する。

### 2. 入力を破壊しない(小さく)

`renderDiagram` / `checkDiagram` の入口で `{...d, bands: cloneData(d.bands)}` を作ってから、パスに渡す。`cloneData` は、プレーンなオブジェクトと配列だけを再帰コピーし、関数・文字列は共有する(`structuredClone` は `raw({draw})` で失敗する)。`prepareReveal` は band の中の points / data / children / lines にも書くので、浅いコピーでは足りない。パスの内部は今のまま変更でよい。結果は `d` ではなく `laidOut`(`maxReveal`、`revealWarnings`、自動 legend 込みの `bands`)から読む。保証の範囲は「描画関数に渡した後」で、`add()` の `d.bands.push` のようなビルダーの可変性は対象外。

### 3. テスト環境の差し込み口

`layout.ts` の `strictWidths()` が `process.env` を直接読むのをやめる(下の「実装での確定事項」)。テスト用の固定幅を差し込む口は**作らない**: `layoutWith(d, roles, widthOf)` が同期の純粋関数なので、必要なテストはそれを直接呼べば足りる。

### 4. 依存方向の検査(移動なし)

「中核とみなすファイル」の一覧(layout・emit・verify・spotlight・reveal・rules・seq-table・tokens・types・wrap・wireframe など)をテストに持ち、それらの**推移的な** import に `node:fs` / `child_process` / `playwright` / `resvg` がないことを検査する。前提として、`measure.ts` から純粋な `splitAtoms` / `textWidth` を `atoms.ts` に分ける(`wrap.ts`・`wireframe.ts`・`seq-table.ts` が I/O の塊を介してそれを import している)。`process.env` の直接読みは import 検査で見えないので、§3 で外す。

## 段階(PR を分ける)

| # | 内容 | 受け入れ条件 |
|---|---|---|
| 0 | 検査の先行(スパイクの `test/roles-state.test.ts` の 6 件が出発点。**main に入れるときは `todo` で入れ、PR 1 で外す**。または PR 0 と PR 1 を 1 つの PR の 2 コミットにする): fill モードの golden(各 band 種別 + reveal 段階ファイル。`test/helpers/slide-fixture.ts` を使う)と、並行描画の再現テスト(fill と非 fill を並行に描き、非 fill が逐次と 1 バイト一致) | 現在の main では、並行テストと段階ファイルの golden が**落ちる**(バグの再現) |
| 1 | §1 `ROLES` を値にして `LaidOutDiagram.roles` に焼き込む | 0 のテストが通る。golden の差分は fill の reveal 段階ファイルだけ。`build()` の reveal 段階ファイルの文字サイズが本体と一致(fill) |
| 2 | §2 入力を破壊しないコピー + §3 の strict-width の移動 | 描画の前後で `d.bands` と `d.width` などが一致(fill の経路でも。`test/roles-state.test.ts` の 4)。同じ band を共有する 2 つの図(片方だけ reveal 付きの group)で、もう片方の段階が変わらない |
| 3 | §4 `atoms.ts` の分離と依存方向のテスト | テストが通る。公開 API の関数のシグネチャが変わらない。ただし `LaidOutDiagram.roles` が必須フィールドとして増える(手で組む外部コードは型エラー) |

## 影響

- **得るもの**: ROLES と入力の書き換えについては、並行描画(Slidev アドオン)で結果が実行順に依存しなくなる(`measure.ts` の `backend` が font から chromium に切り替わる状態は対象外)。fill の reveal 段階ファイルが直る。共通部品の band が図の間で漏れなくなる。測定を差し替えやすくなる。
- **失うもの**: `layoutDiagram` などに省略可能な引数が増える。`LaidOutDiagram` のフィールドが 1 つ増える。fill を使う既存の資料で、reveal の段階ファイルが再ビルドで変わる。

## 実装での確定事項

- strict-width の環境変数は CLI プロセスの env で効いているので、`widthOf` 引数では置き換えられない。読む場所を `lib/layout-measured.ts`(測定してから layout する殻)に移し、`widthOfMeasured(measured, strict)` へ引数で渡した。`layout.ts` は環境を読まない。
- `emit-html.ts` は、フォント測定値(ascent / descent)と図の id 用のダイジェストを `HtmlEnv` として引数で受け取る(`emitHtml(d, env, opts)`)。実体は殻の `lib/html-env.ts` が `font-metrics.ts` / `node:crypto` から作る。これで `emit-html.ts` は中核の一覧に入り、出力は変わらない(golden 不変)。
- `dsl.ts` からディスクを触る部分を出した: `build` / `finishBuild` は `lib/build.ts`、`renderDiagram` / `checkDiagram` / `fillScaleLimit` は `lib/render-diagram.ts`。`dsl.ts` は両方を再 export するので公開 API は変わらない。`dsl.ts` が I/O を直接持たないことは `test/core-purity.test.ts` が見る。既知の残り: ビルダーの `box({size})` 警告の `console.warn`。
- §4 の検査は `test/core-purity.test.ts`。対象は atoms・bars・emit・fit・layout・plane・reveal・rich・rules・seq-table・spotlight・tokens・types・verify・wrap・wireframe。静的 import と動的 `import()` を推移的にたどり、fs / child_process / playwright / resvg / harfbuzz と `process.*` に届けば落ちる(`measure.ts` と `emit-html.ts` を一時的に対象へ入れて、落ちることを確かめた)。

- `cloneData` は、配列とプレーンなオブジェクト(`Object.prototype` / `null` プロトタイプ)だけをコピーし、クラスのインスタンス・Map / Set / Date / RegExp・関数は共有する(クラスのインスタンスを手でコピーすると、private field や内部スロットが壊れて、描画が例外で落ちる)。**既知の穴**: クラスのインスタンスを `plane({points})` などに渡すと、`prepareReveal` の書き込みが図をまたいで漏れうる。同じオブジェクトを 2 回見たら 1 回だけコピーする(WeakMap)ので、1 枚の図の中で同じ band を 2 か所に置いても同一のまま(main と同じ挙動)で、循環でもスタックを使い切らない。非列挙のプロパティ(`.left` / `.right` / `.at` の handle、anchors)とシンボルキー(`NUMBERING`、`GIVEN`、`RICH`)は落ちる。`add()` が描画の前に使い切り、パスより下流は読まない。**描画結果の `laidOut.bands` の band から handle は取れなくなる**。
- `test/core-purity.test.ts` には、描画の中核が `tokens.ts` のグローバルな `ROLES` を import しないことの検査も入れた(import すると、測るのは拡大値で描くのは 1 倍の食い違いが型検査を通ってしまう)。
- 既知で範囲外: curve の軸ラベルは、測定の登録が `roles.note`(拡大値)で、描画は `font-size="14"` 固定。位置には効かないので、fill でも出力は変わらない。

## 未決

- 外部の利用者が描画後の `d.maxReveal` などを読んでいないか(アドオンは読まない。他は未確認)。変更点として告知する。
- 将来、別の測定器や予算の取得元が実際に必要になったときの Ports(今は作らない)。

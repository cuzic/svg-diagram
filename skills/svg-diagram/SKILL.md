---
name: svg-diagram
description: 宣言的な DSL で文書向けの SVG 図（構成図・フロー・スイムレーン・シーケンス図・表・画面のワイヤーフレーム・画面遷移図・組織図・マインドマップ・状態遷移図・ガント・UML クラス図・BPMN 風の業務フロー）を作り、検査して仕上げる。図やワイヤーフレームを作る・直すとき、仕様書や設計書に図を入れるときに使う。
argument-hint: "[作りたい図 / 直したい図のソース]"
keywords:
  - svg
  - diagram
  - wireframe
  - 図
  - ワイヤーフレーム
  - 画面遷移図
  - スイムレーン
  - シーケンス図
  - 組織図
  - マインドマップ
  - 状態遷移図
  - ガントチャート
  - クラス図
  - BPMN
triggers:
  - 図を作って
  - ワイヤーフレーム
  - 画面遷移図
  - svg-diagram
  - 図を直して
  - 組織図を作って
  - 状態遷移図を作って
  - ガントチャートを作って
  - クラス図を作って
---

# svg-diagram で図を作る

図は SVG を直接書かず、`*.ts`（DSL）で宣言して生成する。レイアウト・重なり・コントラストの検査は DSL 側が行う。
SVG は生成物としてコミットし、Markdown からはそれを参照する。**SVG を手で編集しない**（ソースを直して再生成する）。

## 手順

1. **ソースを書く**: `import {diagram, ...} from 'svg-diagram'` / `export default () => diagram({theme: 'blue', title: '図の題名'})...`
   - 文書向けは `theme: 'blue' | 'teal' | 'amber'`。`title` は必須（`check` が見る）。幅は 940px 以下（文書に埋めると縮むため）。
   - **ソースは `.ts` で書き、ビルドの前に `npx tsc -p .`（またはエディタの型エラー）を通す**。型が保証すること: `connect()` の参照先 id と `:side[@t]` の書式、swimlane の `lane` / flow の `from`・`to` / step の id の重複 / レーン 6 本まで、`stateMatrix()` の `required` と「1 行のセルの数 = 列の数」（未設計にするなら `undefined` を明示）、`box({step})` に `title`、`connect()` の `dip`・`bend`・`chip` の組み合わせ、14px 未満の `size`（下げられるのは `canvas` の `minText` だけ。下の手順 3）、`grid` の `cols`、`pyramid` / `curve` の個数。
   - **`connect()` の id の検査を効かせるには、関係する box と `connect()` を 1 回の `d.add(...)` にまとめるか、`d.add(a).add(b)` とつなぐ**（別々の文では、前の id を型が知らず検査されない。つないだ `add()` をまたぐ前方参照は型エラーになる）。
   - **接続点は、`const list = box({id: 'list'})` のハンドルで書く**: `connect(list.right, detail.at('top', 0.25))`（screens / swimlane は `flow.anchors.a.right`）。id を文字列で打ち直さないので、別の文にまたがっても未宣言の id や辺の綴り違いが作れない。凡例を全図で既定オフにする・文言を揃えるなら `.svg-diagram.json` に `"legend": false` / `"legendLabels": {"tone:accent": "注意"}`（図ごとの指定が優先）。`accept` のキー（ルール ID）や `legendLabels` のキー、`tone` / `line` / `route` なども閉じた文字列の型で、綴り違いは型エラーになる。
   - 型エラーは `check` の警告より前に直す。型を通っても、重なり・コントラスト・見た目は下のビルド・検査・目視で確かめる。
2. **ビルド**: `svg-diagram build src.ts --out out.svg`（重なり検査と lint --strict まで走る。失敗するとエラー文が出る）
   - 複数の SVG を 1 つの HTML に貼るなら `--id-prefix <p|auto>` を付ける（`svg-title`・`dsl-arrow` などの id と参照が `<p>-<id>` になり、重ならない。ソースが複数なら `<p>-<ソース名>-<id>`。`<metadata id="svg-diagram">` はそのまま残るので `check --drift` も読める）。
   - 出典行（`diagram({sourceLine})`）をスライドには出し、文書には出したくないとき: `--no-source-line`（ソースは変えない。`deck` も同じフラグ。`<metadata>` に `noSourceLine` が残り、`--stale` と `check --drift --rebuild` が読む）。
   - `gantt({today: 'auto'})` の日付は呼び出し側が渡す: `SVG_DIAGRAM_TODAY=$(date +%F) svg-diagram build x.ts`（`--today YYYY-MM-DD` が優先。`build` と `check` の両方で同じ日付にする）。限界: `--stale` は日付を見ないので、日付が変わっても fresh と出る。
   - 下書きの図は `diagram({status: 'draft', statusLabel?: '仮説'})`（最上段に 1 段、右端に破線の札。`<desc>` の先頭に「(下書き)」、`<metadata>` に status。`check` は info の `draft-status`、公開ジョブでは `check --forbid-draft` で warn にして止める）。
   - ダーク設定に追従する 1 枚の SVG は `diagram({appearance: 'auto'})`（SVG だけ。`--html` との併用は throw。PNG・`preview` は明るい側。`check` / `lint-svg` は明暗の 2 回検査し、暗い側だけの指摘に `(暗い配色)` が付く。`<img>` では OS 設定に従い、`html.dark` には従わない）。
   - PNG も要るとき（Word・チャット・PNG しか貼れない所）は `--png <dir> [--scale N]` を足す。同じビルドの SVG から `<dir>/<名前>.png` を書く（既定の倍率 2。段階表示の各段の SVG も PNG になる）。`--stale` と併用すると、PNG がない・SVG より古いときは作り直す。
3. **ルール検査**: `svg-diagram check --strict src.ts`（コントラスト、凡例、線の交差、幅、密度、題名）
   - `shrink-narrow-text`（警告）: `bpmn` / `swimlane` を `fit: 'shrink'` で詰めた結果、task / step の本文が 1 行 2〜3 字ずつ折れている。文言を短くする・図を 2 つに分ける・縦向きにする・`maxWidth` を広げる。
   - 案件全体で許容する rule は `.svg-diagram.json` の `"accept": {"rule-id": "理由"}`（図の `accept` が優先。知らない ID はエラー）。solid と solid-danger が白黒で同明度のときは `tones` で `solid-danger` の fill を濃くする（既定色はテーマ依存で一律には直せない）。
   - `gray-tone-collision`（警告）: 使っている 2 つのトーンの塗りが白黒で見分けにくい（CIE L* の差が 10 未満。典型は plain の白と accent / new の soft）。直し方は 2 つ。(1) トーンの色を変えて明度差を付ける: `diagram({tones: {accent: {fill: '#e6d3bd'}}})`（案件全体なら `.svg-diagram.json` の `"tones"`。README「トーンの色を上書きする」）か、片方を `solid` / `muted` にする。(2) ラベル・太字・破線など色以外の手がかりを足して `accept` で許容する。破線の有無が違う組、塗りが同じ組、muted / removed、canvas() のピルで言葉にした領域は数えない。カラーでしか使わない図は `diagram({accept: {'gray-tone-collision': '理由'}})`。
   - **文字を 14px 未満にしたいとき（稠密な `canvas` の図）**: 投影しない手元・配布用の図だけ。`diagram({canvas: {width: 2304, height: 1296, minText: 10}})`（最小 10）と、案件の `.svg-diagram.json` に `"fontFloor": 10`（10〜14、既定 14）の両方が要る。`fontFloor` がないと、`minText` が 14 未満の図は描画で throw する。`slide` / `fill` の実効 12px とは別の層で、下げた図は SVG のルートに `data-min-text` が付く。`lint-svg` はそれを床にする（`fontFloor` より低い・10 未満・数でないと `font-floor-not-permitted` のエラー。許可されていれば失敗に数えない「お知らせ」の `font-floor-lowered`）。`check` は `font-floor-lowered`（info。`accept` で許容）、`build` は標準エラーに 1 行出す。`lint-svg` の設定は SVG のあるディレクトリから探す（`--config <path>` で明示。`build` は自分が読んだ設定を渡す）。
   - `layout-*`（情報）: 横に並ぶ枠の幅・端・間隔の数 px のずれ、枠の下の大きな空き、内容の左右の偏り、細すぎる図（`diagram({width: 'fit'})`）を測る。既定は info（`check --verbose`）。この図だけ warn にするなら `diagram({layoutCheck: 'strict'})`（文書向けの図だけ）。意図したものは `accept`。直し方は `cols` / `flex` で列の比を揃える、など所見の `fix` に書いてある。
   - `stat()` の値が箱に収まらないと、24px（canvas / fill は `round(24 × 倍率)`）まで自動で縮め、`stat-fit-shrunk`（info）を出す（同じ列の大きさがそろわない。箱を広げる・値を短くする）。それでも収まらなければ、下限と実測の幅つきで止まる。数字の出典は `stat(v, label, {source, confidence: 'primary' | 'secondary' | 'unverified'})`（3 行目に `出典: … ◎ 一次資料` / `○ 報道・二次資料` / `△ 未確認`。`source` が必須）。`diagram({evidenceCheck: 'info' | 'strict'})` を書くと、出典のない `stat` に `stat-no-source`（`strict` で warn）。
   - 凡例は、使った線種・トーンに必要な分だけ足す（`legend: 'auto'`）。記法が少なくて凡例が要らない図は、凡例を足さずに `diagram({legend: false})` で宣言する（`legend-missing` / `legend-incomplete` が出なくなる）。
4. **目で見る**: `svg-diagram preview out.svg out.png 2` で PNG にし（並列で動かすときは出力名を省くと、一時ディレクトリに重ならない名前で書いてパスを表示する）、画像として読んで確認する（`svg-diagram show x.ts --png out.png` なら SVG を書かずにソースから直接 PNG にできる。`show` を `--png` なしで使うのは人が sixel 対応の端末で見るとき用で、エージェントの実行環境では端末がないためエラーになる）。**検査を通っても、レイアウトの良し悪しは目で見ないと分からない**。
   - `preview` / `show` は、SVG が生成元のソースより古い（SVG に埋め込んだハッシュが今のソースと違う）と、stderr に警告し、PNG の上端に赤い帯を描く。**帯が出たら、その PNG は直前のソースの絵ではない**。`svg-diagram build <ソース>` で作り直してから見る。自動の手順では `--require-fresh` で古いときに exit 1 にできる（`preview` は `--no-stale-banner` で帯だけ消せる）。
   - **`build` が失敗しても、前回の SVG は消えない**（手置きの SVG を巻き込まないため）。失敗の `✗` の行と `⚠ 前回の ... が残っている` を見落とさない。複数ファイルの `build` や `--stale` の「N 件を生成」だけを見て、直ったと思わない。`lint` で落ちて exit 1 のときは、新しい SVG は書かれている。
   - 白黒印刷や色覚の違う読者にどう見えるかは `svg-diagram preview out.svg out.png --gray`（明度だけにして描く）。
5. **ズレ検査**: `svg-diagram check --drift --svg-dir <SVG の置き場> src.ts`（SVG が最新のソースから生成されたものか）
   - `--rebuild` を付けると、違いを言葉で説明する（「見た目は変わらない」ならそのまま再生成してよい）。
   - `check` は、読み込めない・レイアウトで throw するソースがあっても、`✗ <ソース>: <メッセージ>`（スタックなし）を出して**残りのファイルを検査し続け**、最後に `N 件中 M 件が検査できなかった` を出す（exit 1。`--format json` / `github` にも `build-error` として載る）。
   表を図に置き換えたときは `svg-diagram check --covers <表.md|csv> <ソース.ts|図.svg>` で、表の語・数値が図から落ちていないか確かめる
6. **文書との整合**: `svg-diagram check --docs <docs> --svg-dir <SVG の置き場> --src-dir <ソースの置き場>`（参照先、代替テキスト、孤立した図、図の注釈と文書のリストの一致、キャプション `図N-M` の連番と本文中の参照）。`--docs` は .md ファイルや複数指定（`--docs A.md B.md` も可）もでき、`--only <glob>` で一章だけ検査できる（絞ると孤立 SVG の検査はしない） PNG 参照（`![alt](x.png)`）の参照切れ・対応する図のない PNG・孤児 PNG も見る（`doc-png-no-source` / `doc-orphan-png`）。見出しの 1 行が全角で長すぎると `cjk-line-long`。
7. **まとめて目視**: `svg-diagram contact a.svg b.svg ... --out sheet.png`（多いときは `--per-page 12` か `--pages 4` で sheet-1.png, sheet-2.png … に分ける。--out の置き場は無ければ作る。1 枚に詰めると縮んで読めない。余白や釣り合いは検査では分からない）
8. **人に見せる・渡す**: `svg-diagram deck a.ts b.svg --out deck.html` は、複数の図を、前へ・次へで見られる 1 つの自己完結 HTML にする（`.ts` と `.svg` を混ぜてよく、引数の順がスライドの順。`--title` / `--cols N`（一覧の列数）/ `--csp`）。`←` `→` `PageUp` `PageDown` `Space`（`Shift+Space` で戻る）`Home` `End`、`g` で一覧（`Esc` で閉じる）、`z` か図のクリックで等倍。URL は `#3` / `#<ファイル名>` / `#grid`。印刷は 1 枚 1 ページで、JS なしでも全部が縦に並んで読める。同じ入力から同じバイト列。`<metadata>`（ソースのパスとハッシュ）は取り除かれ、外部参照は出さない（あれば warning）。`deck` は lint を走らせないので、`build` / `check` を通した図を渡す。**1 つでも失敗したら何も書かず exit 1**（失敗は全部表示。既存の `deck.html` はそのまま残る）。使い方の誤りは exit 2。`--render html`・`--lazy`・全画面・図ごとの `@page` はまだない。図 1 枚の断片を文書に貼るなら `build --html` / `md`。

## 部品

README の「部品」表を参照。基盤・ネットワーク図は、`group` の入れ子（ホスト > コンテナ > プロセス）と、`row([group, group])` の横並びで描く（接続線は、枠をまたぐ箇所で他の箱や題名を通らないよう、`@t` や `elbow` で調整）（box / row / grid / group / connect / swimlane / sequence / table / wireframe / screens ほか）。
新しい部品は「同じパターンが 3 回出たら」が原則。既存の図の出力が変わらないこと（回帰）を確認してから足す。

## 座標を書かずに自動で配置する図

節（ノード）と関係だけを書く。配置・矢印の経路・ラベルの置き場所は自動。詳しい書き方は README の各節。

| 描きたいもの | 部品 | 書くもの |
|---|---|---|
| 組織図・階層 | `tree(root, {dir})` | 節 `{label, sub?, id?, tone?, children?}` |
| マインドマップ | `mindmap(root, {layout, edges})` | 節（`tree` と同じ）。`layout`: radial（既定。中央から左右へ）/ right・left / down・up / org / list / brace / fishbone（特性要因図。大骨=子、中骨=孫、小骨=その下）/ timeline。`edges`: elbow・curve・straight（ツリー系の形だけ） |
| ms・秒などの数値の時間軸 | `timeline({unit: 'ms', from: 0, to: 700, lanes, events, spans})` | `events: [{at, label, lane?, tone?}]`、`spans: [{from, to, label?, lane?, dim?}]`（`dim` は寸法線で長さを自動表記）。日付の期限は従来の `timeline({from: '2026', now, deadline})` |
| 日付のない順序だけの出来事 | `steps([{title, body?, icon?, tag?}], {numbered, highlight})` | 番号バッジ・矢印つきの `row()`。`highlight: n` で 1 つ強調。`id` を付けると `s.col(n)` が端点 |
| 区間を示す括弧・箱を指す吹き出し | `bracket(a.left, b.right, {label, side})` / `callout(id, {text, side})` | `connect()` の 2 本引きの代わり。bracket は箱の下（`side: 'above'` で上）、callout は 1 行の吹き出し |
| 状態遷移図 | `stateDiagram(states, transitions, {initial, dir})` | 状態 `{id, label, final?, tone?}`（`tone` は `'solid'` / `'solid-danger'` も可）と遷移 `{from, to, label?}`（自己ループ・戻る遷移も可） |
| TOC の因果の図（現状・未来現実・前提条件・移行ツリー） | `causeTree(nodes, links, {dir, coreDriver})` | 実体 `{id, label, role?}`（role: ude / root / de / injection / goal / obstacle / io / action / precondition＝統制できない現状の事実 / tipping＝NBR の転換点 / trim＝転換点を断つ施策（`foldsInto: '施策 1'` で箱の下に「→ 施策 1 に組み込む」）/ need＝TT のニーズ（塗りつぶし））と `{from, to}`（`from` を配列にすると AND。循環の戻りの矢印には `back: true`: 節の並びで層が変わらず、太く描く）。下が原因・上が結果。`coreDriver: true` で、届く UDE が最多の起点に太い枠と「中核」のバッジ（箱の外に置かれる。`counts: false` で `到達 UDE n` を消す）。`layer: 'asap'｜'alap'`: 入力側（原因が入らない実体と、そこからの連鎖）を最初の層に置くか、行き先の手前に置くか。**`tree` が `'prt'｜'frt'｜'tt'｜'nbr'` のときの既定は `'alap'`**（それ以外は `'asap'`。戻すなら `layer: 'asap'`）。FRT の最終のゴールは `role: 'de'` でも `'goal'` でもよい。`maxNodeW: 'auto'` は 260 → 100 の広い方から、幅と高さの両方に収まる最初の箱幅（`dir` を書いても効く）。AND へ入る矢印が交差する（`cause-crossing`）ときは、節を書いた順を変えて探し直して、厳密に良くなるときだけ採る。リンクの `kind: 'blocks'` は「断つ」辺（破線＋横棒の端。ネガティブブランチ）。`tree: 'crt'｜'frt'｜'prt'｜'tt'｜'nbr'` を書くと `check` が TOC の約束（UDE の数・根本原因・1 本鎖・孤立・`back` の付け忘れ＝`toc-cycle-undeclared`）を見る（既定 info、`diagram({tocCheck: 'strict'})` で warn）。`nbr` は `toc-nbr-parts` / `-no-tipping`（転換点を通らない道）/ `-tipping-not-and` / `-trim-too-late`（転換点より結果側を断つ）、`tt` は `toc-tt-unit`（AND の結果にニーズと行動が無い。単位は `transitionUnits([{id, current?, need, action, result, resultRole?}])` が `{nodes, links}` を作る。`current` は最初の単位だけ）、`prt` は `toc-prt-bottom-not-action`（鎖の底が行動でない）/ `toc-prt-one-to-one` / `toc-obstacle-phrase`（障害の文末が「ない」「無い」「不足」。常に info）、`frt` は `causeTree(…, {tree: 'frt', mirrors: crtBand})` と de / goal の `mirrors: '<CRT の UDE の id>'` で `toc-mirror`（対応の欠け・重複・UDE でない id）。`diagram({legend: 'auto'})` は使った役割（tipping / trim / need を含む）・AND の弧・戻り・断つ辺・中核の印を凡例にする（文言は `legendLabels: {'role:precondition': '与件'}`）。層を 2 つ以上飛ぶ戻りは `returns: 'outer'` で外周のレーンへ（既定は `back: true` の辺だけ外周。`pdpc` は全部外周） |
| TOC のクラウド（対立解消図） | `cloud({a, b, c, d, d2}, {assumptions})` | 共通目的 A・必要条件 B/C・対立する要望 D/D'。前提 `{on: 'ab'｜'ac'｜'bd'｜'cd'｜'dd', text, injection?}` は番号が矢印に載り、一覧は図の下 |
| スケジュール | `gantt(rows, {today})` | タスク `{label, start, end｜days, after?, progress?, milestone?}`（日付は `YYYY-MM-DD`、`today` は必ず書く。軸の外なら `extendToToday: true`、日付をビルドが受け取るなら `today: 'auto'` + `--today` / `SVG_DIAGRAM_TODAY` / `.svg-diagram.json` の `today`。時計は読まない） |
| UML クラス図 | `classDiagram(classes, relations, {dir})` | クラス `{id, attrs?, methods?, stereotype?}` と関係 `{from, to, kind, label?, fromMult?, toMult?}` |
| 業務フロー（BPMN 風） | `bpmn(lanes, nodes, flows, {fit})` | レーン・ノード（task / start / end / xor / and / or）・フロー（`line: 'dashed'` はメッセージ）。940px に収まらず throw するときは `fit: 'shrink'`（スイムレーン `swimlane({fit: 'shrink'})` も同様） |
| 故障の木（FTA） | `faultTree(top, {maxNodeW, cutSets, quant, quantPeriod})` | 事象 `{label, kind?, gate?, children?, k?, condition?, ref?}`。gate: and / or / vote(k) / inhibit(condition)。kind: event / basic（円）/ undeveloped（ひし形）/ house（state）/ condition（楕円。inhibit の condition だけ）。同じ基本事象は `{ref: id}`。線に矢じりは無い。幅は 900px に収まる葉 7 個ほどまで。`cutSets: true` で単一故障点に太枠とバッジ、`quant: true` で葉の `p`（確率 0〜1）から頂上の確率を注に書く（独立を仮定。`quantPeriod` で期間）。`legend: 'auto'` で記号の凡例 |
| 章の頭の 1 枚 | `hero({banner, stat, flow, caption, note})` | 大きな数字 `stat` + 流れの `box()` の列 `flow` + 一言・出典。帯は任意 |

- 節に `id` を付けると、`connect()` の端点（`t.anchors.<id>` でも取れる）。図に `id` を付けると、図全体が端点・spotlight の対象になる（節の id は spotlight できない）。
- **検査は 2 つの形で止まる**: 幅が足りない（`dir: 'right'` / `maxNodeW` / ラベルを短く）、矢印やラベルが何かに重なる（どれとどれかが書いてある。並びを替える・`dir` を変える・ラベルを短くする）。エラーを読んで直す。
- 凡例の自動付与と「色だけの区別」の検査は、これらの図の `tone`・破線を数えない。`new` / `removed` や破線を使うときは `legend()` を自分で置く。
- BPMN は標準の一部だけ（サブプロセス、タイマー・メッセージのイベント、プール、データは対象外）。start に入るフロー・end から出るフローは書けない。
- 描いたら `svg-diagram preview` で必ず目で見る（配置は検査を通っても、読みやすさは見ないと分からない）。
- **幅に収まらないとき**: `dir` を省略するか `dir: 'auto'` にした図は、レイアウトが自分で収める（`causeTree` は向きを変えず `maxNodeW` 200 → 110、それでも駄目なら層を行に折り返す `fold`。`pdpc` / `relationDiagram` / `stateDiagram` / `classDiagram` / `tree` は向きも `right` ⇄ `down` で替える。`mindmap` は `layout` を変えない）。書いた `dir` / `maxNodeW` は変えず、試した案と直し方を書いて止まる（`dir: 'auto'`、`causeTree` は `fold: true` か `maxNodeW: 'auto'`）。`causeTree` が幅にも高さにも収まらないときは、エラーの末尾の `split:` が、図を分ける位置（どの層の後で切り、どの矢印がまたぐか）を提案する（自動では分けない。高さだけ超えるときは「図を分ける・`canvas` の高さを増やす」）。`dir` を省略して変わった図は `auto-fit-applied`（warn）、`dir: 'auto'` は info。`diagram({maxWidth: 1200})` は `doc-width` の閾値をその図だけ上げる（図の幅は `width` で別に決める）。細い図（`concentric`・縦の `chevron` など）は `diagram({width: 'fit'})` で幅を内容に縮める。
- **避けられない交差の見せ方**: `causeTree` / `relationDiagram` / `pdpc` の戻りの矢印が他の線を横切る箇所は、`hop: true` で、戻りの線が小さな弧で飛び越す表現になる（既定 off。AND の弧や矢じりの近く、破線の戻りなどには付けない。ADR 0028。例は `examples/toc-hop.ts`）。
- **折れの少ない配置**: 層状の図（`causeTree` 系 / `stateDiagram` / `arrowDiagram` / `classDiagram` / `pert` / `dependencyNetwork` / `causalLoop`）は、従来の座標と、折れ・交差が厳密に少なくなるときだけ採る新しい座標の 2 つを作る。高さが重なる隣の層の箱への矢印は 1 本の直線になる（円・六角形・AND は除く）。過去の SVG を動かしたくないときは `straighten: false`。折れが多い図は `edge-bends`（情報。1 本が 5 回以上、または平均 3 回超。直し方は層を飛ぶ矢印・戻る矢印を減らす。`diagram({layoutCheck: 'strict'})` で warn）。
- **同じ id を別の帯で使う**: 自己配置の帯に `scope: 'plan'` を付けると項目が `plan.<id>` の名前になり、帯をまたいで同じ素の id を使える（`duplicate anchor id` にならない）。参照は修飾名 `connect('plan.p0:right', 'sched.p0:left')`、`diagram({spotlight: 'plan.p1'})`。素の `p0` は 1 つに決まるときだけ通り、2 つ以上だと `ambiguous anchor id` で止まる。ハンドル `.anchors.p0` は修飾名を返す。`group` とトップレベルの `box` / `row` の id は対象外。
- 日本語の長い文を文節で折るなら `diagram({wrap: 'bunsetsu'})`（ひらがなは直前に付く。箱は最長の単位に合わせて `maxNodeW` の 1.5 倍まで広がる。既定は `'phrase'`）。

## 枠が決まったキャンバス（canvas）

ビジネスモデルキャンバス・SWOT・7S などは `canvas(template, content, opts)`。領域の位置・見出し（日本語）は自動、内容は領域 id ごとの文字列の配列。

| 部品 | 書き方 | 備考 |
|---|---|---|
| canvas | `canvas('bmc', {value: ['…'], segments: ['…']}, {title, emphasis, id})` | template: `bmc` `lean` `vpc` `swot` `tows` `errc` `pest` `threeC` `sevenS` `fiveForces` `empathy` `persona` `a3`。領域の id は README の表 |

- 間違った領域 id は型エラー（実行時は有効な id を列挙して止まる）。`titles` で見出しを差し替え、`emphasis: ['value']` で重点（「重点」タグ付き）、`h` で最小の高さ、`requireAll: true` で未記入を `canvas-region-empty` に、`pestle: true` で PESTLE。高さは内容で決まる（既定 `fit: 'content'`）。書き込み用紙のように広い枠が要るときは `fit: 'aspect'`（テンプレートの縦横比を床にする従来の見た目）か `h`。
- `id: 'c'` で各領域が `c-<領域>` のアンカーになり、`connect` / `spotlight` / `reveal` が効く。矢印は描かない（必要なら `connect`）。
- 書き方の全部は README の「枠が決まったキャンバス」。例: `examples/canvas-*.ts`。

## QC 七つ道具・新 QC 七つ道具

データや関係を渡す。軸・区間・限界・配置・計算は自動。書き方の全部は README の「QC 七つ道具と新 QC 七つ道具」。

| 道具 | 部品 | 書くもの |
|---|---|---|
| パレート図 | `pareto(items, {top, unit})` | `{label, value}` の一覧。大きい順・「その他」を最後・累積線・80% までの色分けは自動 |
| ヒストグラム | `histogram(values, {lsl, usl, normal})` | 測定値そのまま。区間の幅・境目の文字・規格外の赤は自動 |
| 散布図 | `scatter(points, {x, y, regression})` | `{x, y, group?}`。`group` が層別（色と形）、`regression` で r と回帰直線 |
| 管理図 | `controlChart(type, data)` / `...xbarR(subgroups)` | type: x / mr / xbar / r / p / np / c / u。中心線・3σ・外れ・連・傾向は自動 |
| チェックシート | `checkSheet(items, columns)` | `{label, counts?}`。「正」の字・計は自動、`counts` なしは手書き用 |
| 特性要因図 | `mindmap(root, {layout: 'fishbone'})` | 大骨（子）・中骨（孫）・小骨（その下） |
| 親和図 | `affinity(groups, {cols})` | `{title, cards?, groups?}`（グループの入れ子） |
| 連関図 | `relationDiagram(nodes, links, {problem})` | `{id, label}` と `{from, to}`。出入りの数と主原因は自動 |
| 系統図 | `tree(root, {dir: 'right'})` | 目的が左、手段が右 |
| マトリックス図 | `matrix(rows, cols, cells, {weights})` | ◎ ○ △ × の表。重みがあれば評価点と最高点の印 |
| アロー・ダイヤグラム | `arrowDiagram(activities)` | `{from, to, name, days}`（`dummy: true` は順序だけ）。最早/最遅・余裕・クリティカルパスは自動 |
| PDPC | `pdpc(nodes, links)` | `role`: start / step / risk / measure / goal。懸念・対策の矢印は点線 |

- 層別は専用の部品がない。層ごとに図を分けるか、`scatter` の `group` / `bars` の `stack` を使う。マトリックス・データ解析法（主成分分析）は計算しない。
- `pareto` / `histogram` / `scatter` / `controlChart` は、`bars` / `plane` を返すので、`labelRole` や `id`、spotlight、段階表示がそのまま効く。`checkSheet` / `matrix` は `table`。
- 管理図は、外れた点を含めて限界を計算する。安定した期間の限界で見たいときは `limits: {cl, ucl, lcl}` を渡す。
- アロー・ダイヤグラムは、始まりの結合点と終わりの結合点が 1 つずつでないと止まる。幅（940px）を超えるときは `{dir: 'down'}`。

## 象限図・分類マトリクス

2 軸のマス分け（BCG・GE・アンゾフ・人材 9 ボックス・リスクマトリクス・ポジショニングマップ・影響力×関心度）は `quadrant`。軸・マスの見出し・項目の置き場所を書く。配置と重ならない調整は自動。書き方の全部は README の「象限図・分類マトリクス」。

流れや構造の定型図は flowShapes を使う。工程は `chevron(steps)`、段階的な減少は `funnel(stages, {scale: 'value', showRate: true})`、閉じた改善は `cycle(steps)`、2〜3 集合は `venn(sets, {overlaps})`、入れ子の層は `concentric(rings)`。各項目の `id` は connect / spotlight の対象。cycle は 3〜8 個、venn は 2〜3 集合に限る。色だけにせず、venn は自動の線種の違い、他は文字ラベルを必ず残す（concentric の `labels: 'side'` は引き出し線で層につながる）。venn の `centre` は全集合の重なり（全集合の overlap と同時には書けない）。例は `examples/chevron-*` など。

飾り文字と縦書きは `wordart(text, {style, writing, size, tone, gradient, outline, shadow, glow, bevel, extrude, reflection, arc, rotate, flip, font, plate, limit})`。`style` は `plain｜bold｜outline｜shadow｜sticker｜glow｜emboss｜3d｜gradient｜reflect`、色は token の鍵だけ（`tone: 'none'` は中抜き）。縦書きは `writing: 'vertical'`（列は右から左、`\n` か `limit`(px) で列を替え、禁則・句読点・長音・縦中横は自動）。`arc`（度）は 1 行を弧に沿わせる。読めない配色（白い文字を縁取りなしで白い紙に）は検査が止める。band として縦に積むだけで、箱と並べたり箱の中を縦書きにはできない。例は `examples/wordart.ts`。

| 書くもの | 書き方 |
|---|---|
| 型から始める | `quadrant.preset('bcg' \| 'ge' \| 'ansoff' \| 'nineBox' \| 'impactEffort' \| 'risk' \| 'stakeholder' \| 'positioning' \| 'eisenhower', {items})`。軸・見出し・色は日本語で入る。書いたものだけ上書き |
| 自分で作る | `quadrant({x: {title, low, high, reversed?}, y: {...}, grid: [列, 行], cells: [[{title, note, tone}, ...], ...], items})`。`cells[行][列]` は見た目の順（上から） |
| 項目 | `{label, cell: [列, 行]}`（マスの中に自動で並ぶ）か `{label, at: [x, y]}`（0〜1、1 が高い側。軸を逆向きにしても数字は同じ）。`size`（円の面積）、`group`（形・色・凡例）、`id`（connect / spotlight）。`size` と `group` は、1 つに書いたら全部の項目に書く |
| 矢印 | `arrows: [{from: id, to: id｜[x, y], label?}]`（ポートフォリオの移動） |

- 評価は色だけにしない。マスの見出し・説明を文字で書き、項目の種類は `tone` ではなく `group` で分ける（`quadrant-tone-only`）。
- 項目のないマスは `quadrant-empty-cell`（警告）。項目を入れるか、意図した空きなら `allowEmpty: [[col, row]]` / `true` で示す。
- 項目は重ならず、混めば行が伸びる。座標から大きく動いた項目は `quadrant-item-moved` が知らせるので、座標か図の大きさを見直す。矢印が項目やラベルを横切るときは項目の位置を替える。
- 座標は値の空間（BCG のように x を高い→低い向きに描いても、シェアが高ければ x は 1 に近い）。マスの境目（0.5 など）の項目は、高い側のマスに入る。
- 描いたら `svg-diagram preview` で見る。例は `examples/quadrant-*.ts`。

## くり返しは、まとめて書く

- 12 列の行: `row([a, b], {cols: [6, 6]})`（`col:` を手で数えない）。`row([a, b, c], {cols: 12})` のように子に `span` を書かなければ、12/n 列ずつの等分（3 個なら 4+4+4）。
- `row()` の子は `box()` / `group()` のほか `caption()` / `banner()` なども可（枠なし `group()` に自動で包まれる）。`versus()` の `children` は配列（縦積み）、`direction: 'row'` で横並び。共通部への接続線は垂直（矢頭なしは `connectArrow: 'none'`）。
- 折り返しは文節単位（既定 `wrap: 'phrase'`）: カタカナ・漢字の連続は割れない。1 文字ずつ折りたいときだけ `diagram({wrap: 'char'})`。別の行の N 列目への矢印は、`row({id: 'top'})` の `top.col(5).top`。
- 枠付きの `group` を `row` に並べて高さがそろうと、低いほうの中身は余りの中で縦中央に寄る。`group({valign: 'top'})` で上詰め、`'stretch'` で箱 1 つが余りを埋める（余りが 16px 未満なら動かない）。
- 接続線: `diagram({connectDefaults: {chip: true, route: 'elbow'}})` と `d.connect(from, to, {label})`。
- ワイヤーフレームの外枠: `diagram({wireframeDefaults: {appbar: {title, nav}}})` と、画面ごとの `shell: {active: '在庫'}`。
- 状態の一覧: `stateRow('在庫カード', stock, {通常: {}, 読み込み中: 'loading', 空: {na: '理由'}})`。
- 表の記号セル: `cell('通る', {mark: 'ok' | 'mid' | 'ng' | 'best'})`。座標平面（軸・点・寸法線）は `plane()`。点ラベルは `labelAt` を省くと寸法線・補助線・他ラベルを避けて自動で置く。軸の `categories: [...]` でレーン名を目盛りにできる（`max` は個数 + 1）。`raw()` で SVG を手書きする前に、これらを探す。

## コンサル系のチャート

データを渡すと、軸・目盛り・配置・ラベルの避け方は自動。数字は必ず書く（入らない部分は `<desc>` に残る）。書き方の全部は README の「コンサル系のチャート」。

| 図 | 部品 | 書くもの |
|---|---|---|
| ウォーターフォール | `waterfall(steps, {unit})` | `{label, value}`（先頭が開始、あとは ± の差）、`{label, kind: 'subtotal'｜'total'}`（累計）。符号つきの値・コネクタは自動。`dir: 'h'` は横向き |
| レーダー | `radar(axes, series, {max, values})` | 3〜12 軸、1〜4 系列 `{label, values}`。線の種類と印の形で見分ける |
| ヒートマップ / コホート表 | `heatmap(rows, cols, values, {unit, corner})` | 数字の表。`null` は空欄。濃淡は段階で、凡例つき |
| 折れ線・戦略キャンバス・バーンダウン | `lines(series, {x, y, target, annotate})` / `strategyCanvas(factors, series)` / `burndown({total, days, actual})` / `burnup({scope, days, done})` | 系列名は線の右端。`ideal: true` が計画線 |
| 積み上げ・100%・マリメッコ | `stackedBars(columns, {percent})` / `mekko(columns)` | `{label, parts: [{label, value}]}`。マリメッコは幅が合計、高さが構成比 |
| ツリーマップ | `treemap(tree)` | 葉 `{label, value}`、グループ `{label, children}` |
| サンキー | `sankey(nodes, links)` | ノード（文字列か `{id, label}`）と `{from, to, value}`。層・並び・太さは自動 |
| トルネード | `tornado(items, {base})` | `{label, low, high}`（その入力が低い・高いときの結果）。幅の大きい順 |
| 回帰・残差 | `regplot({x, y, group}, {order, stats, lowess})` / `residplot({x, y})` | 生の値。直線（`order: 2` で曲線）と 95% 信頼帯、R² は自動。`lowess: true` は局所回帰の曲線 |
| パネル分割 | `...facet({名前: 値}, (名前, 値, _i, axes) => 図(値, {...axes}), {cols, share})` | 軸は既定で全パネル共通（`axes` を図の opts に展開）。`share: 'none'` で個別 |
| 2次元密度・クラスタ付きヒートマップ | `kde2d({x, y})` / `clustermap(行名, 列名, 表, {scale})` | クラスタリングと並べ替え・樹形図は自動 |
| 2次元ヒストグラム・ジョイント・散布図行列 | `hist2d({x, y})` / `jointplot({x, y, group})` / `pairplot({変数: [..]}, {groups})` | 列ごとの**生の値**。度数・周辺分布は自動。グループは印の形と輪郭の線の種類で見分ける |
| ヒストグラム・KDE・ECDF・ラグ | `histplot` / `kdeplot` / `ecdfplot` / `rugplot(values｜groups, {label, stat, binWidth})` / `displot(values, {kind: [..]})` | **生の値**（配列か `{男性: [..], 女性: [..]}`）。階級・密度・累積は自動。グループは色と線の種類で見分ける |
| 箱ひげ・バイオリン・ストリップ・スウォーム・ポイント・誤差つき棒 | `boxplot` / `violinplot` / `stripplot` / `swarmplot` / `pointplot` / `barplot(groups, {label, dir})` / `catplot(groups, {kind: [..]})` | **生の値**を渡す（`{東京: [..], 大阪: [..]}`）。四分位・密度・95% 信頼区間は自動。`hues: [{name, values}]` で第二のカテゴリ、`kind: ['box', 'strip']` で重ねる |
| バブル | `bubble(points, {x, y, sizeTitle, sizeUnit})` | `{label, x, y, size}`。円の**面積**が `size`。`x.line` / `y.line` は境目の破線。軸は円がはみ出さないよう自動で広がる |
| バタフライ | `butterfly(rows, {leftLabel, rightLabel, unit})` | `{label, left, right}`。中央の名前をはさんで左右に同じ目盛りの棒 |
| コンボ（棒 + 折れ線） | `combo(categories, series, {y, y2})` | `{label, type: 'bar'｜'line', values}`。折れ線は既定で右軸（`y2`）。`null` は欠測 |
| ハーベイボール | `harvey(rows, cols, values, {highlight})` | 値は 0〜4（四分円の数）、`null` は未評価。扇の形で示す |

- どれも `id`（図全体）と、要素の `id` が `connect()` / `spotlight` の端点になり、`labelRole` で文字を大きくできる。`lines` 系は `plane` を返す。
- 入らない値のラベル（狭い列・小さなセル）はエラーに直し方が書いてある。幅・高さを上げるか、小さいものを「その他」にまとめる。
- 描いたら `svg-diagram preview` で目で見る。

## 意味付き表

表のセルが業務上の意味を持つなら、生の `table()` より専用部品を使う。入力検査、集計、非色覚依存の文字・記号が付く。

| 図 | 部品 | 要点 |
|---|---|---|
| RACI 責任分担表 | `raci(tasks, roles, assignments)` | `R/A/C/I` と `A/R`。各タスクは A が 1、R が 1 以上。例外は `allowNoA`。空の役割列は check が警告 |
| FMEA | `fmea(rows, {sort: 'rpn'})` | S/O/D は 1〜10。RPN は自動。`after: {s,o,d}` で改善後、`threshold` / `midThreshold` で段階 |
| QFD | `qfd(demands, characteristics, relations)` | 要求の `importance` と `◎○△×` から得点（列合計）・相対 % を自動計算。単独首位は太字 |
| ジャーニーマップ | `journeyMap(stages, lanes)` | `{id,label,cells}`。`id: 'emotion'` は既定 -2〜+2 の折れ線＋点と記号付き数値（値は行上部、曲線は下部）。別尺度は `emotionRange` |

4 部品とも `title / width / dense / id / reveal / until` が使え、結果は通常の `table` band（ハンドルも同じ）。色だけに頼らず、RACI 文字・評価記号・数値を消さない。例は `examples/raci-project.ts`、`fmea-basic.ts`、`qfd-basic.ts`、`journey-map.ts`。

## 意味付きネットワーク

座標を手で書かず、意味をデータに持たせるネットワークは次を使う。方向はすべて `direction: 'LR' | 'TB'`、ノード `id` は `connect()` の端点になる。

| 図 | 書き方 | 自動で行うこと |
|---|---|---|
| PERT（作業を箱にする activity-on-node。作業を矢印にするなら `arrowDiagram`） | `pert([{id, label, duration, predecessors}], {unit})` | ES / EF / LS / LF / slack とクリティカルパス。循環・未知の先行タスクを拒否 |
| 因果ループ図 | `causalLoop(nodes, [{from, to, polarity, delay?}], {layout?: 'ring'})` (`'ring'` は閉路が 1 つだけの図を円環に。ループ外のノード・弦・`direction` 併用は止まる。`interventions: [{id, label, to, polarity, delay?}]` はループの外側の帯に破線で描かれ（LR は上、TB は左、ring は円の上下）、`id` は `connect()` / `spotlight` の対象。置けないと何が何に当たるかを書いて止まる) | `+` / `-`、遅延 `||`、単純ループの R / B 分類、介入点 |
| 関連図 / 依存ネットワーク | `dependencyNetwork([{id, label, kind?}], [{from, to, type, weight?}], opts)` | kind / type の表現、重みの線幅と数値、使用した記法の凡例 |

PERT の計算だけなら `analyzeCriticalPath`、ループ検出だけなら `analyzeCausalLoops`。長い日本語ラベルでは `width` を広げ、層が多いときは LR、並列が多いときは TB を試す。描いた後は必ず `check` とプレビューを通す。

## ワイヤーフレーム・画面遷移図で、見て直すこと（実際に効いた点）

画面ごとに `wireframe(root, {title, tag, h, notes})` を書き、`n:` で番号の丸を付けて右の注釈欄と対応させる。
作ったら PNG を 2 倍で撮り、次を見る。

- **空白**: 表や一覧の下、サイドバーの下に空きがないか。`flex`、行の追加、`wf.spacer(4, {flex: 1})` で埋める（row の中のカード・列は下まで伸びる）。
- **ラベルの衝突**: 地図のラベルが壁や枠線に重ならないか。`side: 'bottom'` や座標で逃がす。
- **番号の丸**: 隣の部品との境目にまたがっていないか。余白（既定 12px）が足りているか。
- **注釈文**: カタカナ語が途中で折れていないか（ツールは語単位で折る）。
- **状態の矛盾**: 例えば「通信断」の映像に `LIVE` を出していないか。
- **画面遷移図**: 矢印のラベルが画面にかかっていないか。ラベルが入る幅の `gap` / `rowGap` を取る。幅 940px に収めるには、タイトル行を短くし、画面名はサムネイルの `wf.appbar` に入れる。
- **モーダル**: `wireframe(root, {overlays: [wf.dialog(...), wf.toast(...)]})`。覆われた要素は描かれない。

## 画面仕様は「粗い全体 + 部品ごとの詳細」にする

1 画面に全部を描くと、状態（読み込み中・空・欠損・通信断・古い情報）が抜けやすい。次の 3 種類に分ける。

1. **全体（粗い図）**: `wf.region(名前, {n: true, emphasis: 'primary'})` だけで領域を並べ、見る順に番号を付ける（自動採番）。
2. **部品の構成**: `wireframe(部品, {frame: 'light', h: 'fit', notes})`。`parts: {level: true, ...}` で部品の**内側**に番号を付ける。
3. **部品の状態の一覧**: `stateMatrix(状態の列, 部品の行, {required: [...]})`。各欄は、図 / `'na'`（対象外。理由は `{na: '理由'}`）。**未指定は「未設計」と表示され、`check` が警告する**。

`state` は、映像・地図に限らず**どの部品にも**付けられる（`loading` は骨組み、`empty` は文言、`stale` は読めるまま点線の枠と札）。
`check` は、図の番号と注釈が一対一か、状態の一覧に「未設計」や必須の状態の抜けがないかも見る。

## 欲しい絵記号（アイコン）を入れる

`box({icon})` / `iconRow()` のアイコンは本体に入っていない。**プロジェクトごとに入れる**（`svg-diagram.icons.json`）。「鍵のアイコンが欲しい」と言われたら、次の順で進める。

1. **英語に直す**: Iconify の検索は英語。「鍵」→ `key`、「橋」→ `bridge`、「人」→ `person`、「承認」→ `approval`, `check-circle` など、似た語を 2〜3 個。
2. **候補を出す**: `svg-diagram icons find key bridge --png sheet.png`。ライセンスが許すセットだけが並び、**主セット**（最初に入れたセット）が先頭に出る。`--style fill|line` で塗り／線画を絞れる。
3. **目で選ぶ**: `sheet.png` を見る（枠が色つきのものが主セット）。図の中のアイコンは見た目を揃える（塗りと線画を混ぜない・太さが違うセットを混ぜない）。迷ったら主セットのものを選ぶ。主セットに無い時だけ他のセットから選び、揃わないことを伝える。
4. **入れる**: 候補の下に出る行をそのまま実行する（`svg-diagram icons add mdi:key-variant=key`）。1 回で複数入れられる。名前は図のソースで使う短い名前。
   セットに無い名前が混じるときは `--skip-missing`（あるものだけ入れて、無い名前を一覧する）。無いまま既定で実行すると、無い名前を全部まとめて報告して何も入れない。
   経理・業務の図なら、まず `svg-diagram icons add-set accounting`（`icons sets` で `office` / `infra` も）で用途別のセットを一括で入れられる。個別の `find` はその後の不足分だけ。
5. **使う**: `box({icon: 'key', title: '鍵の管理'})`。`icon` は box のほか、swimlane の step、`cell('鍵', {icon: 'key'})`（table のセル）、stateDiagram の状態 `{id, label, icon}`、sankey のノード `{id, icon}`、bpmn のタスク `{id, lane, label, icon, iconTone?}`（イベント・ゲートウェイは不可）、sequence の参加者 `{id, label, icon, iconTone?}` にも付く（bpmn / sequence はラベルの上に 20px）。`step`（丸番号）とも併用できる（アイコン→番号→タイトルの順）。入っていない名前は、入れ方つきのエラーで教えてくれる。

注意:
- CC BY などのライセンスのセットは既定で除外される。使うかはユーザーに確認し、了承されたら `--allow-license CC-BY-4.0`。
- 多色（固定色）のアイコンは `--color` が要る。トーンにもダークテーマにも従わず検査の外になるので、色そのものに意味がある 1〜2 枚だけにする。
- 入れたアイコンの出典は `svg-diagram icons notice` で出せる（クレジットが要る文書に貼る）。
- 絵記号は図の核心の数枚だけ。全部の箱には付けない。

## クラウド・ネットワークの構成図

アイコン+名前の点を `node({id, icon, label, sub})` で置き、境界（VPC・サブネット・ゾーン）は `group({title})` の入れ子、線は `connect('a:right', 'b:left')`。例: `examples/cloud-architecture.ts`。

- **線は必ず辺を指す**（`:right` `:left` `:top` `:bottom`）。省略すると中心同士を結び、枠のない node ではアイコンを貫く。`:bottom` は名前の下に付く。
- 線が見出しや別の node にかかって `build` が止まったら、node の並び（同じ行・同じ列に寄せる）か、`route: 'elbow'` の `bend` で直す。ゾーンや層ごとに行を分け、線は隣の行へだけ引くと素直に収まる。
- アイコンは汎用なら `icons find`（carbon が構成図向き）。**AWS / Azure / GCP / Kubernetes の公式アイコンは Iconify に無い**ので、ユーザーに各社の配布ページから zip を DL してもらい、`icons add-pack <zip> --prefix aws --terms <規約の URL> --accept-terms --match "..."` で入れる。**規約を読んだかはユーザーに確認してから** `--accept-terms` を付ける（勝手に付けない）。
- PNG プレビュー（resvg）でも曲がる線の矢じりは線の向きに合う（描くときだけマーカーを置き換えて直してある）。実ブラウザで確かめたいときは `--engine chromium`。
- グローバル運用（案件に `svg-diagram` を入れない）でも `svg-diagram typecheck` は動く（PATH 上の `tsc` と、このツールの型定義を使う）。

## 公開してよい内容か

図のソースは、案件の内容（社名・画面・数値）を含みやすい。ツール本体のリポジトリには**架空の例**だけを置き、案件の図は案件側のリポジトリに置く。

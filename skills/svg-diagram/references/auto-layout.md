# 座標を書かずに自動で配置する図（組織図・マインドマップ・状態遷移・ガント・クラス図・BPMN ほか）
（svg-diagram の入口は `../SKILL.md`）  TOC の因果ツリー・クラウド・故障の木は `toc.md`。


節（ノード）と関係だけを書く。配置・矢印の経路・ラベルの置き場所は自動。詳しい書き方は README の各節。

| 描きたいもの | 部品 | 書くもの |
|---|---|---|
| 組織図・階層 | `tree(root, {dir})` | 節 `{label, sub?, id?, tone?, children?}` |
| マインドマップ | `mindmap(root, {layout, edges})` | 節（`tree` と同じ）。`layout`: radial（既定。中央から左右へ）/ right・left / down・up / org / list / brace / fishbone（特性要因図。大骨=子、中骨=孫、小骨=その下）/ timeline。`edges`: elbow・curve・straight（ツリー系の形だけ） |
| ms・秒などの数値の時間軸 | `timeline({unit: 'ms', from: 0, to: 700, lanes, events, spans})` | `events: [{at, label, lane?, tone?}]`、`spans: [{from, to, label?, lane?, dim?}]`（`dim` は寸法線で長さを自動表記）。日付の期限は従来の `timeline({from: '2026', now, deadline})` |
| 日付のない順序だけの出来事 | `steps([{title, body?, icon?, tag?}], {numbered, highlight})` | 番号バッジ・矢印つきの `row()`。`highlight: n` で 1 つ強調。`id` を付けると `s.col(n)` が端点 |
| 区間を示す括弧・箱を指す吹き出し | `bracket(a.left, b.right, {label, side})` / `callout(id, {text, side})` | `connect()` の 2 本引きの代わり。bracket は箱の下（`side: 'above'` で上）、callout は 1 行の吹き出し |
| 状態遷移図 | `stateDiagram(states, transitions, {initial, dir})` | 状態 `{id, label, final?, tone?}`（`tone` は `'solid'` / `'solid-danger'` も可）と遷移 `{from, to, label?}`（自己ループ・戻る遷移も可） |
| 判断のある流れ図 | `flowchart(nodes, edges, {dir})` | 節 `{id, label, kind?: 'process'｜'decision'（ひし形）｜'terminator'（開始・終了）, sub?, tone?, icon?}`、矢印は遷移と同じ。既定は上から下。判断から出る矢印に `label: 'Yes'` / `'No'`。戻る矢印は外側を回る（`returns: 'outer'` が既定）。`initial` / `final` は無い |
| スケジュール | `gantt(rows, {today})` | タスク `{label, start, end｜days, after?, progress?, milestone?}`（日付は `YYYY-MM-DD`、`today` は必ず書く。軸の外なら `extendToToday: true`、日付をビルドが受け取るなら `today: 'auto'` + `--today` / `SVG_DIAGRAM_TODAY` / `.svg-diagram.json` の `today`。時計は読まない） |
| UML クラス図 | `classDiagram(classes, relations, {dir})` | クラス `{id, attrs?, methods?, stereotype?}` と関係 `{from, to, kind, label?, fromMult?, toMult?}` |
| 業務フロー（BPMN 風） | `bpmn(lanes, nodes, flows, {fit})` | レーン・ノード（task / start / end / xor / and / or）・フロー（`line: 'dashed'` はメッセージ）。940px に収まらず throw するときは `fit: 'shrink'`（スイムレーン `swimlane({fit: 'shrink'})` も同様） |
| 章の頭の 1 枚 | `hero({banner, stat, flow, caption, note})` | 大きな数字 `stat` + 流れの `box()` の列 `flow` + 一言・出典。帯は任意 |

- 節に `id` を付けると、`connect()` の端点（`t.anchors.<id>` でも取れる）。図に `id` を付けると、図全体が端点・spotlight の対象になる（節の id は spotlight できない）。
- **検査は 2 つの形で止まる**: 幅が足りない（`dir: 'right'` / `maxNodeW` / ラベルを短く）、矢印やラベルが何かに重なる（どれとどれかが書いてある。並びを替える・`dir` を変える・ラベルを短くする）。エラーを読んで直す。
- 凡例の自動付与と「色だけの区別」の検査は、これらの図の `tone`・破線を数えない。`new` / `removed` や破線を使うときは `legend()` を自分で置く。
- BPMN は標準の一部だけ（サブプロセス、タイマー・メッセージのイベント、プール、データは対象外）。start に入るフロー・end から出るフローは書けない。
- 描いたら `svg-diagram preview` で必ず目で見る（配置は検査を通っても、読みやすさは見ないと分からない）。
- **幅に収まらないとき**: `dir` を省略するか `dir: 'auto'` にした図は、レイアウトが自分で収める（`causeTree` は向きを変えず `maxNodeW` 200 → 110、それでも駄目なら層を行に折り返す `fold`。`pdpc` / `relationDiagram` / `stateDiagram` / `classDiagram` / `tree` は向きも `right` ⇄ `down` で替える。`mindmap` は `layout` を変えない）。書いた `dir` / `maxNodeW` は変えず、試した案と直し方を書いて止まる（`dir: 'auto'`、`causeTree` は `fold: true` か `maxNodeW: 'auto'`）。`causeTree` が幅にも高さにも収まらないときは、エラーの末尾の `split:` が、図を分ける位置（どの層の後で切り、どの矢印がまたぐか）を提案する（自動では分けない。高さだけ超えるときは「図を分ける・`canvas` の高さを増やす」）。`dir` を省略して変わった図は `auto-fit-applied`（warn）、`dir: 'auto'` は info。`diagram({maxWidth: 1200})` は `doc-width` の閾値をその図だけ上げる（図の幅は `width` で別に決める）。細い図（`concentric`・縦の `chevron` など）は `diagram({width: 'fit'})` で幅を内容に縮める。
- **詰めて描く（`diagram({density: 'compact'})`）**: 層状の図（`causeTree` 系 / `stateDiagram` / `arrowDiagram` / `classDiagram` / `tree`・`mindmap` の `right`・`left`・`down`・`up`・`radial` の木 / `faultTree` / `bpmn`）の、箱・層の間隔と矢印のレーン（スタブ・並走の間隔）を 1/4 詰める。同じ図が小さい面積に収まる（因果ツリーで高さがおよそ 1〜2 割減）。既定は `'normal'`（書かない図は変わらない）。**SVG の幅は変わらない**（`width: 'fit'` と組んでも層状の図は狭くならない）。減るのは高さで、兄弟が縦に並ぶ図（縦向きの因果ツリー・PDPC・組織図）で効き、横一列の状態遷移・BPMN（ラベルのあるフロー）ではほぼ変わらない。詰めないもの: 遷移ラベルの幅、自己ループの置き場、`classDiagram` の兄弟の間隔とレーン（多重度のラベルが重なる。層の間隔だけ詰まる）、`mindmap` の `org`・`list`・`brace`・`fishbone`・`timeline`。因果ツリーは、詰めると箱を通る矢印ができるときだけ、その帯を通常の間隔に戻す。`pert` / `dependencyNetwork` / `causalLoop` / `semnet` には効かない。
- **折れの少ない配置**: 層状の図（`causeTree` 系 / `stateDiagram` / `arrowDiagram` / `classDiagram` / `pert` / `dependencyNetwork` / `causalLoop`）は、従来の座標と、折れ・交差が厳密に少なくなるときだけ採る新しい座標の 2 つを作る。高さが重なる隣の層の箱への矢印は 1 本の直線になる（円・六角形・AND は除く）。過去の SVG を動かしたくないときは `straighten: false`。折れが多い図は `edge-bends`（情報。1 本が 5 回以上、または平均 3 回超。直し方は層を飛ぶ矢印・戻る矢印を減らす。`diagram({layoutCheck: 'strict'})` で warn）。
- **同じ id を別の帯で使う**: 自己配置の帯に `scope: 'plan'` を付けると項目が `plan.<id>` の名前になり、帯をまたいで同じ素の id を使える（`duplicate anchor id` にならない）。参照は修飾名 `connect('plan.p0:right', 'sched.p0:left')`、`diagram({spotlight: 'plan.p1'})`。素の `p0` は 1 つに決まるときだけ通り、2 つ以上だと `ambiguous anchor id` で止まる。ハンドル `.anchors.p0` は修飾名を返す。`group` とトップレベルの `box` / `row` の id は対象外。
- 日本語の長い文を文節で折るなら `diagram({wrap: 'bunsetsu'})`（ひらがなは直前に付く。箱は最長の単位に合わせて `maxNodeW` の 1.5 倍まで広がる。既定は `'phrase'`）。

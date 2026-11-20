# ADR 0070: CRT の辺の読みやすさ(`tree: 'crt'` の既定を ALAP に、隙間のトラック割り当て、AND の組ごとの入口、並走の検査)

- 状態: 承認(2026-11-20、Opus のレビュー 2 回を反映)
- 日付: 2026-11-20
- 基点: `main`(7a95096e、PR #371 まで)
- 関連: ADR 0015(`tree`・`cause-parallel` / `cause-crossing`。G6 の AND の並走)、ADR 0016(D3 直線化、D6 `edge-bends`、D11〜D14 の並走のずらし)、ADR 0019(D1 `layer: 'alap'` と既定、D4 交差の再探索は `cause-crossing` だけ)、ADR 0020(TOC の検査)、ADR 0028(交差の hop)。ADR 0068・0069 は別の PR で提案中のため、この ADR は 0070
- 範囲外: 節の並び(交差最小化)そのものの改良(ADR 0019 D4 の範囲)。`causeTree` 以外の図の経路の変更: D3・D4・D7・D8 は `causeTree` の帯(`band.base === undefined && band.layerFrom === undefined`)だけで有効にする。同じ `layoutCauseBand` を通る pdpc・relationDiagram・whyWhyTree と、states・classes・semnet・bpmn は出力を変えない(広げるのは未決)

## 背景

利用者の CRT(現状問題構造ツリー、`tree: 'crt'`)が読みにくい、という報告が届いた(2026-11-20)。図は 25 節・25 本の link(AND を展開すると矢印 31 本、AND 6 組)で、指定は `{tree: 'crt', dir: 'up', maxNodeW: 260, fold: true, roleTags: true, coreDriver: true}`、`canvas: {width: 2600, minText: 18}`。利用者は報告のあと `layer: 'alap'` も書いた。

報告された見え方の問題:

| # | 問題 |
|---|---|
| P1 | 層を飛ぶ長い辺が、1〜数 px の間隔の平行線の束になり、たどれない |
| P2 | 階段状の経路: 1 本の辺が 5〜10 回折れる |
| P3 | AND の弧: 1 つの節(例 u4)に AND の弧つきの矢印が 3〜4 本入ると、弧と矢じりが重なる |
| P4 | 1 つの節から出る複数の辺が、同じ x から出て、しばらく重なる |

利用者の案(優先順): (a) 辺どうしの最小間隔の保証と、チャネルでのトラック割り当て、(b) ダミー節・交差最小化・ダミーの列をまっすぐに(Brandes–Köpf)、(c) 折れの上限と並べ替えでの再試行。`edge-bends` を info から warn に上げることも検討、(d) 前提条件を行き先の 1 つ下の層に置く、(e) AND の組ごとに入口を分ける、(f) `dir: 'up'` で `edges: 'curve'`、(g) 並走の長さと重なりを測る検査(`cause-parallel` より強いもの)。

## 現状(コードで確かめた事実)

### 実測(報告の図、`layer` を書かない = asap と、`layer: 'alap'`)

測り方: 報告の図のソースを `renderDiagram`(`lib/dsl/render.ts:27`)に通し、`laidOut` の cause の帯の `edges[].points`・`ands`・`anchors` から数えた(スクリプトは PR 本文に載せる。図のファイルは利用者のもので、リポジトリには入れない。U0 で、構造だけを写した図をテストの fixture にする)。「並走」は、別の矢印の**同じ軸の** run(水平どうし・垂直どうし。進む向きは問わない)で、長さ方向に 4px を超えて重なるもの。値は SVG の座標(px)。この図の文字の最小は `minText` = 18px。

| 指標 | asap(いまの既定) | alap |
|---|---|---|
| 図の大きさ | 2600×1700 | 2600×1767 |
| 層を 2 つ以上飛ぶ矢印 | 18 / 31 本 | 8 / 31 本 |
| 折れの合計 / 平均 | 116 / 3.74 | 54 / 1.74 |
| 折れの分布(回数: 本数) | 0:7, 2:6, 4:11, 6:3, 8:1, 10:1, 12:2 | 0:5, 2:25, 4:1 |
| 最も折れる矢印 | pre3→u4・pre4→u4 が 12 回、r5→u3 が 10 回、r6→u3 が 8 回 | r1→e2 が 4 回 |
| `edge-bends`(info) | 出る(5 回以上が 7 本、平均 3.7) | 出ない |
| 並走: 間隔 4px 未満 | 12 組、計 1175px(最小間隔 **0px** = 同じ線の上) | 0 組 |
| 並走: 間隔 8px 未満(関係別) | 端を共有しない 7 組 960px、同じ頭 7 組 374px、同じ尾 1 組 26px | 0 組 |
| 並走する run の最小間隔(重なり 4px 超) | 0px | 14px(= `LANE`) |
| `cause-crossing` | u1→u2 × e2→u2、e8→u4 × pre4→u4 | pre1→e2 × r1→e2、u3→u4 × pre4→u4 |
| `cause-parallel` | pre3→u4 × pre4→u4 | なし |
| AND の弧が描けない(`loose`) | なし | なし |
| 並走の最小間隔 ÷ `minText` | 0 | 0.78(14 / 18) |

asap で最も長い並走は r5→u3 と r1→e7(間隔 0px、266px)、r4→u5 と r1→e7(0px、250px)、r2→e1 と r3→e3a(0px、204px)。どれも端を共有しない長い矢印どうしが、同じ線の上に重なっている。

節に入る矢印(alap。asap も間隔は同じ):

| 節 | 箱の幅 | 入る矢印 | AND の組 | 矢じりの間隔 | 弧の x の範囲 |
|---|---|---|---|---|---|
| u4 | 244 | 4 | 2(e8+pre3、u3+pre4) | すべて 22px(703, 725, 747, 769) | 693–731 と 741–779(2 つの弧の間 10px、y は同じ 398) |
| e2 | 244 | 3 | 1(pre1+r1) | 22px | 1345–1387 |
| u2 | 244 | 3 | 1(u1+e3) | 22px | 1872–1910 |
| e3・u3 | 244・262 | 3 | 0 | 22px | — |

AND の弧と矢じり(P3、alap。asap も同じ形): 弧は 2 次曲線で、両端が先端から `AND_END = 21`、頂点が先端から `AND_PEAK = 15`(`lib/toc.ts:29`・`:353`)。矢じりは長さ `ARROW_L = 12`・半幅 5(`lib/cause-hop.ts:11`、`lib/emit-common.ts:157`)、弧の線幅 2(`lib/emit-figures.ts:360`)。AND の 12 本の矢印のそれぞれで、弧が矢印の軸を横切る位置を数えると、先端から 16.3〜17.8px。**矢じりの根元から弧の中心線まで 4.3〜5.8px、線幅の半分を引いた見える隙間は 3.3〜4.8px**(`minText` の 0.18〜0.27 倍)。頂点(組の真ん中の矢印が来うる位置)では、中心線で 3px・見える隙間 2px。弧と矢じりが重なって見える(P3)のは、この隙間の狭さと、隣の組の弧との 10px の切れ目の両方による。

出る矢印(P4): alap では、2 本以上の出る矢印を持つ 5 節(r1・r2・e2・e3・u3)すべてで出口の間隔が 22px、最初の run を共有する組は無く、同じ尾の並走(8px 未満)も 0 組。asap では同じ尾の並走が 1 組(26px、間隔 0px)。**P4 は alap では、この図では再現しない**。

### 層(d)

- `layer: 'alap'` はある(ADR 0019 D1、`lib/graph-layout.ts:369` の `alap`)。`causeTree` の既定は `alapOf`(`lib/toc.ts:223-226`)で、`tree` が `'prt'`・`'frt'`・`'tt'`・`'nbr'` なら `'alap'`、**`'crt'` を含むそれ以外は `'asap'`**。`keep` は役割 `root`・`injection`・`start` の節で、根本原因は最下段に残る。
- `examples/` で `tree: 'crt'` を書くのは `examples/toc-compact.ts:30` だけ(`examples/toc-crt.ts` は `tree` を書かない)。`toc-compact` には `role: 'precondition'` の節が無い。入る辺の無い節は c1・c2(root)と b3(役割なし)。
- `test/` には `tree: 'crt'` が 11 ファイルに 25 か所ある: toc・toc-fit・toc-rules・cause-hop・spec・spec-edge・keep-words・wrap-soft・diagnostics-hints・pptx-edge・pptx-groups(`*.test.ts`)。
- ALAP の動く節は「`keep` に無く、循環を切った後の DAG で、入る辺がすべて動く節から来る節」(`lib/graph-layout.ts:369-381`、`:374`)。DAG の先行節が無い節は `[].every` が真になり、`keep` に無ければ動く。CRT の検査は root が 1 つ以上あることしか求めない(`lib/toc-rules.ts:35`)ので、根本原因に役割を付けない入口の節(`toc-compact` の b3 など)は普通にある。

### 層の中の列(b)

(b) は大部分が実装済み。

- ダミー節: 層を飛ぶ辺は、層ごとに大きさ 1×1 のダミーの slot を持つ(`lib/graph-layout.ts:445`)。ダミーどうし・ダミーと箱の間は、節の間隔 `gap`(causeTree は `GAP = 28`、`lib/toc.ts:25`)だけ離れる。**層の中を通る run の間隔は、すでに保証されている**。
- 交差最小化: 重心法の掃き出しと `transpose`(ADR 0016 D2)、`causeTree` の並びの再探索(ADR 0019 D4、`lib/toc.ts:94-160`)。
- Brandes–Köpf: `brandesKoepf`(`lib/graph-layout.ts:252`、`coord: 'bk'`)。`layeredAttempt` の `pick0`(`lib/layered-route.ts:580-588`)が、素の案(`coord: 'relax'`)と BK の案を (交差, 折れ) の辞書式で比べる。
- 経路はダミーの点を通る: `routeOnce` の `build` は `elbows([start, ...e.points.slice(1, -1), end], turn, lastTurn)`(`lib/layered-route.ts:258`)。BK でダミーの列がまっすぐなら、長い矢印は層の中をまっすぐ通る。
- 実測(`pick0` の最後に、両案の `score`・`fits`・幅と選んだ側を `console.error` で出す 1 行を一時的に入れて数えた。コードは戻した): asap では `pick0` の 1 回で、BK の案(交差 12・折れ 66)が素の案(交差 10・折れ 112)に負けた(交差が 2 少ないことが、折れ 46 回より優先される)。**最終の図の折れ 116 は素の案の値**(`pick0` 以降の選び方の経路は追い切っていない)。alap では記録した `pick0`(並びの再探索を含め 28 回以上)のすべてで BK の案(交差 11〜14・折れ 54〜58)が勝った。

### 隙間の中の曲がり(a、P1・P2)

**(b) の残りの穴はここにある。** 層と層の間の隙間で、どこで曲がるかの決め方が、矢印の種類で違う。

- 直接の矢印(隣の層へ。`points.length === 2`)は、隙間ごとに**レーン**を持つ(`corridors`、`lib/layered-route.ts:130-141`。`assignLanes`、`:182-197`)。レーンの間隔は `laneIn(g)`(`:124-128`)で、`LANE = 14`(`:17`)以上、`2 × LANE` 以下。
- **長い矢印**(層を飛ぶ)は、途中の曲がりにレーンを持たない。`elbows` は、`turn` / `lastTurn` が無い区間を**隙間の真ん中** `(p.x + q.x) / 2` で曲げる(`lib/layered-route.ts:32`)。同じ隙間を通る長い矢印は、みな同じ座標で曲がり、向きが合えば**同じ線の上に重なる**(実測の間隔 0px の並走はこれ)。例外は AND の頭へ入る長い矢印の最後の曲がり(`lastTurn`、`:249-255`)だけ。
- 隙間の広さ: `layoutWithLanes`(`:432-436`)は `corridorLoad`(`:409-426`)で隙間を広げるが、**数えるのは直接の矢印と外周の戻り辺だけ**で、長い矢印の曲がりは数えない。`laneIn` の混み具合 `crowdOf`(`:114-123`)も、長い矢印は AND の頭へ入るものの最後の隙間しか数えない。
- 後からのずらし: ADR 0016 D12〜D14(`aside`、`apartOf` → `moveApart`、`lib/route-apart.ts`)は、選んだ案の並走を 8〜24px ずらす。**何も悪くしないときだけ、1 回だけ**採る(`lib/layered-route.ts:560-575`)。さらに「交差が 1 つ以上ある図で、ずらしが交差を 0 にした」場合は採らない(`:573`)。asap の図では、0px の並走が計 1175px 残った。
- 曲がりを決めた後に経路を動かす処理は、ずらしのほかに、`detour`(箱を避ける探索。`causeTree` では既定で有効、`lib/toc.ts:279`。探した経路は `elbows` を通らずに置き換わる、`lib/layered-route.ts:258`)、ADR 0016 D3 の `align`(口の高さをそろえる)、D11 の `laneShare`/`longLane`(`:176-181`・`:254`)がある。どれも採否を `runsTogether`(4px 未満)と (交差, 折れ) で決め、`LANE` 未満に近づくことは止めない。
- 隙間の高さは図全体で 1 つ(`corridorLoad` が全隙間の最大を返し、`layoutWithLanes` がそれで `levelGap` を決める、`:425`・`:434`)。レビューの実測では、報告の図の隙間ごとの水平の run の最大の重なり(左端法に要るトラック数の下限)は asap・alap とも 3 で、`gapFor(3) = 80` は今の隙間(94・136)に収まる。
- 段差(P2): 1 本の長い矢印のダミーの位置が層ごとに違うと、隙間ごとに 2 回ずつ折れる(層を 6 つ飛ぶ pre3→u4 が 12 回)。asap で素の案が選ばれたことと、層を飛ぶ矢印の多さ(18 本)が重なった結果。alap では層を 2 つ以上飛ぶ矢印が 8 本に減り、最大 4 回になった。

### AND の入口(e、P3)

- 1 つの面に入る矢印の口(port)は、`portOf`(`lib/layered-route.ts:143-164`)が、他端の位置の順(AND の矢印は組の平均の位置でまとめる)に並べ、**組の区別なく等間隔** `step = min(portStep, (h - 12) / (n - 1))` に置く。`causeTree` の `portStep` は `PORT = 22`(`lib/toc.ts:25`、`:279`)。口の列は面の中央に寄り、面の幅は使わない(u4 は幅 244 の面の中央の 66px に 4 本)。
- 箱は、口が入るだけ伸びる(`need = 12 + (degree - 1) × PORT`、`lib/toc.ts:261`)。組の間の余白は数えない。
- AND の弧は、組の外側の矢印から `reachTo` = `min(AND_REACH = 10, 隣の矢印までの半分 - 5)` だけ伸びる(`lib/toc.ts:345-353`、`:29`)。口の間隔が 22px なら 6px で、隣の組の弧との間は 22 - 2×6 = **10px**。弧の高さ(`AND_END`・`AND_PEAK`)は全組で同じなので、2 つの弧は同じ y に 10px の切れ目で並び、1 本の弧に見える。検査の「2 つの弧が触れる」(`lib/verify-handlers.ts:151`)は 8px 未満で出るので、10px は検査を通る。
- alap に残る 2 つの `cause-crossing` は、**どちらも同じ AND の組の中**(pre1+r1 → e2、u3+pre4 → u4)。レーンの順の規則(`lib/layered-route.ts:189-193`)は、1 つの隙間の矢印が**全部同じ頭へ入るときだけ** fan-in の順(近い尾が先に曲がる)を使い、ほかの頭へ入る矢印が混じる隙間では fan-out の順(遠い方が先に曲がる)になる。レビュー(第 1 巡)が経路を出して確かめた:
  - u4: `u3→u4` は `1260,525 → 1260,465 → 769,465 → 769,377`、`pre4→u4` は `990,525 → 990,437 → 747,437 → 747,377`。u3 の水平の run(y = 465)が pre4 の縦の run(x = 990)を横切る。交差しない順は「pre4 が尾の側、u3 が頭の側」で、2 つの縦の制約が同じ向きを求め、循環しない。
  - e2: `r1→e2` の最後の曲がりは y = 1121(頭の近く、`lastTurn`)、`pre1→e2` の曲がりは y = 1213(尾の近く)。交差しない順は「pre1 が頭の側、r1 が尾の側」で、これも循環しない。
  - どちらも、D4 の縦の制約つきの割り当てで交差 0 にできる(U4b のテストの期待値にする)。

### 検査(g、c)

- `cause-parallel` / `cause-crossing`(warn)は、**AND を持つ頭へ入る矢印どうし**だけを見る(`andClashes`、`lib/cause-clash.ts:14-27`)。並走の判定は `runsTogether`(`lib/polyline-metrics.ts:111-117`): 間隔 4px 未満・重なり 4px 超。asap の 0px の並走 960px(端を共有しない組)は、どの検査にも出ない。
- `edge-bends`(`lib/rules.ts:644-675`): 1 本 5 回以上、または平均 3 回超。既定は info、`diagram({layoutCheck: 'strict'})` で warn(`layoutSeverity`、`:605`)。対象は cause・states・bpmn・classes・ネットワークの図。
- 経路の部品は `layeredAttempt` を通して states(`lib/states.ts:94`)・classes(`lib/classes.ts:71`)・semnet(`lib/semnet-common.ts:99`)と共有している。cause の帯の中でも、pdpc・relationDiagram(`base: 'down'`、`lib/dsl/diagrams.ts:255`)と whyWhyTree(`layerFrom = 'effect'`、`:348`)は `causeTree` と同じ `layoutCauseBand` → `tryLayoutCause` → `layeredAttempt`(`lib/toc.ts:278-279`)を通り、`groupOf` も全 cause の帯に渡る。pdpc の既定は `returns: 'outer'`(`:472`)。
- `tree` を書いた CRT は `hop: 'all'` が既定(`lib/dsl/diagrams.ts:294`)。hop は、同じ向きの線が近いとき(`room = R + 線幅/2 + 3`、約 10.5px)などに省かれる(`lib/cause-hop.ts:55-82`)。

### 曲線(f)

- 経路と検査は直交の線分を前提にしている: 交差の判定 `cross`(`lib/cause-clash.ts:7-11`)と `runsTogether` は水平・垂直の線分だけを扱う。AND の弧は、組の矢印の最後の run が同じ向きにそろうこと(`andEnds`、`lib/toc.ts:233-243`)を条件に描く。ADR 0028 の hop も直交の交点で決める。
- 曲線の辺は mindmap(`edges: 'elbow' | 'curve' | 'straight'`、`lib/types/diagrams.ts:53`)にだけある。

### 大きさの単位

`causeTree` の `PORT`・`GAP`・`LEVEL`(`lib/toc.ts:25`)と `LANE`・`STUB`(`lib/layered-route.ts:16-17`)は `density` の `space` でだけ縮み(`PORT` は `space` でも変わらない、`:279`)、`canvas.minText` の文字の倍率(`canvasFontScale`、`lib/tokens.ts:280`。`minText: 18` で 1.29)では大きくならない。帯の種類ごとに canvas の倍率で固定の大きさを大きくする仕組みは既にある(`canvasGeom`、`lib/layout-handlers.ts:603`。gantt・bars・chart・plane が使い、canvas の無い図は不変)が、cause の帯には渡していない(`:606`)。文字は 1.29 倍、矢印の間隔は 1 倍のまま。図を縮めて見ると(2600px の図を 1000px 幅で見ると 0.38 倍)、14px のレーンは 5px に見える。P1 の「1〜数 px」は、asap の 0px の重なりと、縮小で詰まって見える 14〜22px の間隔の両方を指していると考えられる。

## 論点

1. (d) は既にある。CRT の既定を alap にするか。ADR 0019 D1 は CRT を asap に残した(代替案「全図で ALAP を既定にする」を、CRT の根本原因の位置を理由に退けた)。`keep` があるいま、その理由は残るか。
2. (b) は実装済み。残りの穴は「隙間の中の長い矢印の曲がり」で、(a) と同じ問題になる。
3. (a) のトラック割り当てを、既存のレーン(直接の矢印)と後からのずらし(D12〜D14)にどう重ねるか。ほかの図への影響をどう閉じるか。
4. (e) と P3: 組の区別のない等間隔の口と、組の中の交差。
5. (c): 折れの上限と再試行は、alap の後にも要るか。`edge-bends` を warn にするか。
6. (g): 並走を、AND の頭に限らず測る指標と検査。
7. (f): 曲線。

## 決定

### D1: `tree: 'crt'` の既定を `layer: 'alap'` にする(d。ADR 0019 D1 の変更)

- `alapOf`(`lib/toc.ts:224`)で、`tree: 'crt'` かつ `layer` を書かないときの既定を、**前提条件だけの ALAP** にする。動く節の集合 M を、**循環を切る前の link の上で**、前から不動点で求める: M は `role: 'precondition'` の節と、「入る link が 1 本以上あり、その尾がすべて M に入る節」(最小の不動点。循環の節は、循環の中の尾が M に入らないので M に入らない)。`keep` は **M の外の全節**。`graph-layout.ts` の ALAP は循環を切った後の DAG の先行節で動く節を決める(`lib/graph-layout.ts:374`、`preds.every(p => movers.has(p))`)ので、「入る辺の無い節」で `keep` を作ると、循環の切れ目で DAG の入口になった節(根本原因の側のこともある)が動いてしまう。M の補集合を `keep` にすれば、動くのは前提条件とそこから始まる連鎖だけになる。
- CRT に前提条件が 1 つも無ければ `alap` を渡さない(層も循環の切り方も今と同じで、出力はバイト単位で同じ)。
- **明示の `layer: 'alap'` は ADR 0019 D1 の意味のまま**(`keep` は root・injection・start)。`layer: 'asap'` と書けば今の図に戻る。`tree` を書かない `causeTree`、pdpc・relationDiagram・whyWhyTree・arrowDiagram は今のまま。
- 理由: 実測で、折れの合計 116 → 54、最大 12 → 4、0px の並走 1175px → 0、`edge-bends` が出なくなり、図の高さの増えは 67px(4%)。報告の図の入口の節はすべて root か precondition なので、前提条件だけの ALAP でも結果は上の alap の実測と同じ。役割を付けない入口の節(タグの付け忘れた根本原因)は最下段に残るので、ADR 0019 が CRT を asap に残した理由(「根本原因は最下段」)に当たらない。動く範囲は利用者の案 (d)「前提条件を行き先の 1 つ下へ」と一致する。
- **ADR 0019 D1 の「既定」の項を書き換える**(`'crt'` を `'alap'` の側へ)。ADR 0019 の本文には、この ADR への参照を 1 行足す。
- 既存の出力への影響:
  - `examples/`: `tree: 'crt'` を書くのは `toc-compact` だけで、前提条件が無いので `alap` を渡さず、**出力は変わらない**(b3 も、b3 だけから入る a3 も動かない)。U1 の PR で `pnpm golden` の差分 0 を示す。
  - `test/`: `tree: 'crt'` を書く 25 か所(11 ファイル、上の一覧)のうち、前提条件を含み、層や座標を固定しているものを U1 で直す。直したものは PR 本文に一覧で書く。
  - 利用者の既存の CRT: 前提条件のある図は、前提条件が行き先の手前へ動く。リリースノート(PR 本文と README の追記)に `layer: 'asap'` で戻せることを書く。

### D2: 並走の指標と検査 `edge-parallel`(g)。U2 以降の物差しにする

- `lib/polyline-metrics.ts` に `parallelRuns(routes, sep)` を足す: 別の矢印の、同じ軸の run の組のうち、間隔が `sep` 未満で、長さ方向に 4px を超えて重なるもの。組ごとに重なりの長さと間隔を返す。`runsTogether`(4px 未満)は `sep = 4` の特別な場合として残す(`cause-parallel` と D11〜D14 は今の定義のまま)。
- `sep` は `laneStepOf(space)`(既定 14、`density: 'compact'` で 11)。フォントに依らない。
- 規則 `edge-parallel`(`lib/rules.ts`、`edge-bends` の隣): **`causeTree` の帯だけ**(pdpc・relationDiagram・whyWhyTree、states・classes・ネットワークの図は対象にしない。states・classes は `portStep` が 14 で面が短いと縮み、fan-in の最後の run が常に該当するため)で、`parallelRuns` の重なりの合計が `2 × sep` を超える帯に出す。**端を共有する組も数える**(P4 の、同じ尾から出て重なる辺はこれで見える)。文面には、最も長い 3 組(尾 → 頭、間隔、長さ)と合計を出す。`data` に `measured`(合計の長さ)と `threshold`。
- 帯の判別: レイアウトの後の帯(`LaidOutCause`、型は `lib/types/diagrams.ts:446`、作るのは `lib/toc.ts:320-323`)には `base`・`layerFrom` に当たる印が無く、`lib/rules.ts` の規則は `d.laidOut` だけを読む。`LaidOutCause` に `origin?: 'pdpc' | 'relation' | 'whywhy'` を足し、`causeTree` のときはキーを付けない(既存のレイアウトの JSON を比べるテストを壊さない。ADR 0028 D7 の `crossings` と同じやり方)。`edge-parallel` は `origin` の無い cause の帯だけに出す。U2 に入れる。
- 重さは `edge-bends` と同じ `layoutSeverity`(info、`layoutCheck: 'strict'` で warn)。`cause-parallel`(warn)はそのまま残す(AND の頭への 4px 未満の並走は、どの矢印が AND かを読み違えるので、別の重さで扱う)。
- この指標を、U3・U4 の完了の基準と、D4 の後段の処理の採否(D4)に使う。ほかの図へ広げるかは U6 の測り直しの後に決める。

### D3: AND の組ごとの入口(e、P3)

- 口の並べ方(`lib/layered-route.ts:143-164`)で、**AND の組と、それに隣り合う口との境界だけ**、間隔を `2 × portStep` にする(AND の組と AND の組の間、AND の組と OR の矢印の間)。組の中と、AND でない矢印どうし(普通の fan-in)は今の `portStep` のまま。AND の無い頭は、口も箱の幅も変わらない(幅の探索 `maxNodeW: 'auto'` と `fold` の判定に影響しない)。
- 広げる幅は `2 × portStep` に固定する。面の幅いっぱいに広げることはしない(口が箱の中央から離れると、長い矢印のダミーの列(中央)とずれ、最後の隙間で段差が 1 つ増える)。
- 箱の伸び(`lib/toc.ts:261`)の `need` に、(AND の組に接する境界の数)× `portStep` を足す。
- 弧の切れ目: `reachTo` は隣の矢印までの半分から決まるので、組の間が `2 × portStep` なら弧は `AND_REACH` まで伸び、2 つの弧の切れ目は `2 × portStep - 2 × AND_REACH`(今の定数で 24px、u4 は 10px から)になる。D7 の倍率の後も同じ式。
- 組の中の交差(alap の残りの 2 つ)は、D4 のトラックの順で直す。D3 は口の位置だけを変える。
- 対象は `causeTree` の帯だけ(範囲外の条件を見よ)。

### D4: 隙間のトラック割り当て(a・b の残り、P1・P2・P4)

- **1 つの隙間の、すべての曲がりを 1 回で割り当てる**: 直接の矢印の曲がり、長い矢印の途中の曲がり(今は真ん中、`lib/layered-route.ts:32`)と最後の曲がり(`lastTurn`)、外周の戻り辺の曲がり。各曲がりは、隙間を横切る run(`dir: 'up'` で水平の線分)を持ち、その範囲(across の区間)が決まっている。
- **D11 のレーンの共有(`laneShare`/`longLane`)と `lastTurn` は、`tracks` のときは使わず、この割り当てに吸収する**(長い矢印の最後の曲がりも 1 つの曲がりとして、縦の制約で位置が決まる)。AND の矢印の最後の曲がりは、頭から `AND_END + 1`(D8 の値)以上離れたトラックに置く(弧の置き場所。足りなければ隙間の側を広げる)。`tracks` のとき、`sharing()`(`lib/layered-route.ts:551`)は `laneShare` の案を作らない(割り当てに吸収済みで、作っても同じ経路になる)。
- 割り当ては、チャネル配線の左端法(left-edge)に**縦の制約**を足したもの: 同じ across の位置に、一方の曲がりの「入る側の縦の run」と、他方の「出る側の縦の run」が来る組は、交差しない上下の順を制約にする(fan-in・fan-out・頭が混じる隙間を同じ規則で扱う。今の `fanIn` の分岐(`:189-193`)を置き換える)。制約に循環があれば、その組だけ今の順に戻す(交差は残り、`cause-crossing` が出る)。
- 範囲が重ならない曲がりは同じトラックを使ってよい(左端法)。ただし重なりの判定の前に、各区間を**両端で `laneStepOf(space)` ずつ伸ばす**(同じトラックの 2 本の run の端が近いと、1 本につながって見えるため)。重なるものは別のトラックで、トラックの間隔は `laneIn(g)`(`LANE` 以上)。
- **後段の処理も間隔を壊さない**(割り当ての後に経路を動かす処理):
  1. `detour`: 探した経路も、層の間の区間ではその矢印に割り当てたトラックの座標に合わせる。合わせられない(箱にかかる)ときは detour を採らない。
  2. ADR 0016 D3 の `align`、D12 `shiftOf`・D13 `turnAt`・D14 `moveApart`: 今の採否の条件に、「`parallelRuns(routes, laneStepOf(space))` の組が 1 つも増えない」を足す(4px 未満だけでなく、`LANE` 未満の組を増やす変更を採らない)。
  3. この 2 つの上で、**同じ軸の run が `LANE` 未満で並ぶことは、`causeTree` では起きない**(層の中の run はダミーの slot の `gap` で既に離れている)。U4 のテストは、detour が効く図(箱を避ける長い矢印)でも回す。
- 隙間の広さ: `corridorLoad` と、`laneIn` の分母になる `crowdOf` を、**同じ**隙間ごとのトラックの数(長い矢印の曲がりを含む)で数える。`levelGap` は今どおり全隙間の最大で 1 つ(隙間ごとの `levelGap` は `graph-layout.ts` に手が入るので、この ADR ではしない)。報告の図では必要トラック数が 3 で、高さは増えない見込み。ほかの図で高くなれば、`fitLayout` の高さの予算がそのまま効く(収まらなければ今どおり狭める・折り返す)。
- トラックの間隔の下限は、hop(ADR 0028)の「同じ向きの線が近い」の閾値(約 10.5px)より大きく保つ(`density: 'compact'` の 11px が下限)。
- D8 で弧が頭から遠くなる(深さ 21 → 25〜29px)ので、hop を省く範囲(弧の外接矩形 ±8px、`lib/cause-hop.ts:63-66`、理由 `and-arc`)も頭から遠くまで広がる。**これは受け入れる効果とする**(弧の近くで線が飛び越すと、弧と hop の半円が重なって読みにくいので、省くこと自体は正しい)。トラックの配置で帯を避ける制約は足さない(隙間が高くなるため)。U3・U4 の PR の hop の内訳に `and-arc` を含め、`toc-hop`・`toc-hop-all` で `and-arc` の省きが増えたら、U4c で「頭の手前 `AND_END + 8` の帯に、ほかの頭へ入る矢印の水平の run を置かない」を足すかを決める。
- `elbows` は、区間ごとの曲がりの座標(トラック)を受け取る形にする(`turn` / `lastTurn` の 2 つの引数を、区間の配列に置き換える)。
- **`causeTree` の帯だけで有効にする**: `AttemptOpts` に `tracks?: boolean` を足し、`tryLayoutCause` が `band.base === undefined && band.layerFrom === undefined` のときだけ渡す。pdpc(外周の戻り辺が既定)・relationDiagram・whyWhyTree と states・classes・semnet は今の経路で、出力はバイト単位で同じ。
- 案の比べ方は変えない(`pick0`・`sharing`・`apartOf` は (交差, 折れ) のまま)。D12〜D14 のずらしは上の条件つきで残し、D4 の後に何かを動かしているかを D2 で数え、何も動かさないなら別の PR で外す(未決)。
- P4(同じ尾から出る辺の重なり): 別の仕組みは作らない。同じ尾から出る矢印の曲がりも D4 の同じ割り当てに入り、口は今どおり `PORT` 間隔で分かれる。alap の実測では P4 は再現しないので、D2 の検査で見張る。

### D5: 折れの上限と再試行は入れない。`edge-bends` は info のまま(c)

- 実測で、P2 の段差は asap と素の案の組み合わせで起き、alap(D1)では最大 4 回・平均 1.74(`edge-bends` の閾値 5 回・平均 3 の内側)になった。上限を超えた辺のための並べ替えの再試行は、ADR 0019 D4 の再探索(最大で数十回の `layeredAttempt`)にもう 1 つ探索を重ねることになり、費用に見合う図が今は無い。
- `edge-bends` を warn に上げない: 規則は cause・states・bpmn・classes・ネットワークの図で共有で(`lib/rules.ts:652-659`)、warn にすると、意図して折れる図の `check` が一斉に警告を出す。強く見たい図は今どおり `layoutCheck: 'strict'`。
- ただし、asap で BK の案(交差 12・折れ 66)が素の案(交差 10・折れ 112)に負けた事実は記録し、U4 の後に D2 の物差しで測り直す(未決)。

### D6: 曲線(`edges: 'curve'`)は入れない(f)

代替案を見よ。

### D7: canvas では、cause の帯の線の間隔を文字の倍率で大きくする(P1)

- `layoutCauseOrCloud`(`lib/layout-handlers.ts:606`)から `layoutCauseBand` へ `s = max(1, canvasGeom(ctx))` を渡す(canvas が無ければ 1。**下限を 1 にする**: `minText` は 10 まで書け(`lib/types/core.ts:77`)、`canvasFontScale(10)` は 0.72 になるが、文字が小さくても線を今より詰めない)。`causeTree` の帯(範囲外の条件)では、線の定数をこの倍率で大きくする。`layeredAttempt` には `space` とは別の線の倍率として渡し、経路の中では `unit = space × s` を 1 か所で求めて使う。
- 経路の間隔の値(レビュー第 2 巡が数えた 16 か所。`lib/layered-route.ts` の `routeOnce` と、そこから呼ぶ `lib/route-search.ts`・`lib/route-apart.ts`)と、U5 での扱い:

  | # | 値 | 場所 | U5 |
  |---|---|---|---|
  | 1 | `STUB`(18) | `:68`(`stubOf(space)`) | `unit` を掛ける |
  | 2 | `LANE`(14) | `:68`(`laneStepOf(space)`) | `unit` を掛ける |
  | 3 | `laneIn` の上限 `2 × LANE` と余白 `16 × space` | `:127` | `unit` を掛ける |
  | 4 | `gapFor` の `2 × stub + lane × (n − 1) + 16`・`chip + stub + 26` | `:19` | `unit` を掛ける |
  | 5 | `portStep`(cause は `PORT = 22`) | `:155`、`lib/toc.ts:279` | `unit` を掛ける |
  | 6 | 外周の戻り辺が頭へ入る最後の run `max(STUB, 22)` | `:209` | U3 で弧の深さから求める(MA)、`s` も掛かる |
  | 7 | 直接の矢印の最後の run `gw − 22` | `:246` | 同上 |
  | 8 | 長い矢印の `lastTurn` の `gr − 26`(2 か所) | `:254` | 同上 |
  | 9 | D13 の候補 `±LANE`・`±6` と範囲 `4`・`22` | `:394` | `22` は U3 で弧の深さから、ほかは `unit` を掛ける |
  | 10 | D12 のずらし `±8`・`±16` | `:386` | `unit` を掛ける |
  | 11 | detour の `stub`(`STUB` を渡す)と `margin` 8 | `:344`、`lib/route-search.ts:54` | `unit` を掛ける |
  | 12 | detour の最後の run `tail` 26 | `lib/route-search.ts:54` | U3 で弧の深さから求める(MA) |
  | 13 | `moveApart` の歩幅 `STEPS` 8〜24・`CLEAR` 6・`JOG` 10 | `lib/route-apart.ts:18-21` | `unit` を掛ける |
  | 14 | 口を箱の縁から離す `h − 12`・`h / 2 − 6`・`align` の 6 | `:155`・`:159`・`align` | **固定**(箱の縁と角の丸みからの距離で、線どうしの間隔ではない。箱の枠は倍率で太くならない) |
  | 15 | 同じ高さとみなす許容 3px(`align`・`alongOther`) | `:289`・`:299` | **固定**(座標の一致の判定の許容で、見える間隔ではない) |
  | 16 | `runsTogether` の 4px | `lib/polyline-metrics.ts:111-117` | **固定**(`cause-parallel` の定義。D2 の `parallelRuns` が `LANE × unit` で別に測る) |

  なお、`routeOnce` の中の `STUB`・`LANE` は `stubOf(space)`・`laneStepOf(space)` で既に `space` が掛かっている(`:68` で影を作る)。`space` が届いていないのは 3〜13 のうちの素の数字で、U5 でそれらを `unit` の倍数に書き換える(`density: 'compact'` でも同じく縮む)。
- `GAP`(箱と箱の間)は `max(GAP × space, 2 × LANE × unit)` にする(層の中のダミーの間隔 `gap` が、倍率を掛けたレーンの間隔を下回らないため。`s ≤ 1.0` では今の `GAP = 28` のまま。`2 × LANE × unit` が 28 を超えるのは `unit > 1` のとき)。それ以外の `GAP`・`LEVEL` は変えない(隙間の高さは `gapFor` が線の値から決めるので、線に合わせて広がる)。矢じりの大きさ(`ARROW_L`、emitter の定数)は変えない。
- canvas の無い図、pdpc・relationDiagram・whyWhyTree は不変。canvas の `causeTree` だけが動く。
- 報告の図(`minText: 18`、`s = 1.29`)では、`LANE` 14 → 18、`PORT` 22 → 28、`GAP` 28 → 36。並走の最小間隔 ÷ `minText` は 0.78 → 1.0。この比は図を縮めて見ても変わらない(文字と線が同じ倍率で縮む)ので、「縮小して見ると線が詰まって見える」の基準になる。

### D8: AND の弧を矢じりから離す(P3)

- 弧が矢印の軸を横切る位置は、組の真ん中で最も先端に近く、先端から `AND_PEAK`。矢じりの根元との**見える隙間**(弧の線幅の半分を引く)は `AND_PEAK − ARROW_L − 1` が最小になる。今は 15 − 12 − 1 = 2px(実測でも各矢印で 3.3〜4.8px)。
- 見える隙間の最小を、文字の大きさの 0.4 倍以上にする。文字の大きさは canvas では `minText`、canvas が無ければ 14(`s = 1` のときの本文)。
  - `AND_PEAK = ARROW_L + 1 + ceil(0.4 × 14 × s)`(`s = 1` で 19、`s = 1.29` で 21)
  - `AND_END = AND_PEAK + round(6 × s)`(弧の反りは今と同じ 6px を倍率で)
  - `AND_REACH = round(10 × s)`
- 弧を描く条件(`andEnds` の `room >= AND_END + 1`、`lib/toc.ts:241`)は、`AND_END` が伸びた分だけ厳しくなる(`AND_END + 1` は `s = 1` で 26、`s = 1.29` で 30)。今これを守っているのは、`AND_END = 21` に合わせた経路の側の 5 つの長さ: 直接の矢印の最後の run 22(`lib/layered-route.ts:246`)、長い矢印の `lastTurn` の 26(`:254`)、頭へ入る外周の戻り辺の 22(`:209`)、D13 の候補の範囲 22(`:394`)、detour の最後の run `tail = 26`(`lib/route-search.ts:54`)。
- **U3 で、この 5 つを弧の深さから求める**: `headRun = AND_END + 1` とし、22 の 3 か所は `max(22, headRun)`、26 の 2 か所(`lastTurn` と detour の `tail`)は `max(26, headRun + 4)`(今の 4px の差を保つ)。値は `AttemptOpts` で渡し、渡さない図(states・classes・semnet、pdpc・relationDiagram・whyWhyTree)は今の 22・26 のまま。D8 は U3 に置いたままにする(U4b の後に回さない)。D4 の後は、AND の矢印の最後の曲がりを頭から `headRun` 以上のトラックに置くことで同じ下限を守る。
- 「2 つの弧が触れる」の検査(`lib/verify-handlers.ts:151`、8px 未満で error)は変えない。D3 で切れ目は `2 × PORT × s − 2 × AND_REACH`(報告の図で 56 − 26 = 30px)になる。

## 代替案

| 案 | 採らない理由 |
|---|---|
| CRT の既定は asap のまま、利用者に `layer: 'alap'` を勧める(文書と `edge-bends` の文面で) | 実測で、CRT の前提条件の図は alap で折れが半分以下、0px の並走が 0 になる。根本原因は `keep` で最下段に残る。既定を良い方にし、戻し方(`layer: 'asap'`)を書く方が利用者に優しい |
| 後からのずらし(ADR 0016 D14 `moveApart`)の歩幅・回数を増やす | ずらしは「何も悪くしないときだけ、1 回」で、交差が増える・別の run に近づくと採られない(asap で 1175px が残った)。曲がりの位置を最初から割り当てる D4 の方が、間隔を構成で保証できる |
| 長い矢印の曲がりを、隙間の真ん中から一律にずらす(矢印の番号で `±k × LANE`) | 同じ隙間の直接の矢印のレーンと重なる。範囲と縦の制約を見ない割り当ては、交差を増やす |
| 折れの上限(例 4 回)を超えた図で、並べ替えを再試行する(c) | D5。alap で上限を超える辺が無い。探索の費用が ADR 0019 D4 に重なる |
| `edge-bends` を warn に上げる(c) | D5。5 種類の図で共有の規則で、影響が CRT に閉じない |
| `edges: 'curve'`(`dir: 'up'` の曲線の辺、f) | 交差・並走の判定(`cause-clash.ts`・`runsTogether`)、AND の弧(最後の run がそろうことが条件)、hop(ADR 0028)がすべて直交の線分を前提にしている。曲線にすると、それらをすべて作り直すことになる。また曲線は束を解かない(同じ隙間を通る曲線は、同じあたりで重なって曲がる)。間隔の保証(D4)を先にやり、それでも読みにくい図があれば、別の ADR で検討する |
| 隙間のトラック割り当てを、最初から全図(states・classes・semnet)で有効にする | 出力が広く動き、golden の差分が大きくなって確かめにくい。`causeTree` で効果を確かめてから広げる |
| D3・D4 を pdpc・relationDiagram・whyWhyTree にも同時に入れる | 同じ経路を通るが、pdpc は外周の戻り辺が既定で、`turnOuter` を割り当てに入れる話と直に当たる。`causeTree` で確かめてから広げる(未決) |
| D3 で AND の無い入口(普通の fan-in)の口も広げる、口を面の幅いっぱいに広げる | 箱が広がり、幅の探索と `fold` の判定、文字の折り返しまで動く。口が中央から離れると、長い矢印のダミーの列とずれて段差が増える |
| 線の倍率(D7)を `GAP`・`LEVEL` にも掛ける(`env.space` に倍率を掛ける) | 箱と箱の間も広がり、幅の探索で `maxNodeW` が狭まる図が出る。間隔の保証に要るのは線の定数だけ |

## 影響

- **変わる出力**:
  - D1: `tree: 'crt'` を書き、`role: 'precondition'` の節を持つ図の層。`examples/` では差分 0(`toc-compact` に前提条件が無い)。
  - D3: AND を持つ `causeTree` の図の、AND の組の隣の口の位置と、その箱の幅。
  - D4: `causeTree` のすべての図の、隙間の中の曲がりの位置(隙間の高さは、必要トラック数が今のレーン数を超える図だけ)。hop(ADR 0028)の飛び越す交差・省く交差の組も変わりうる。
  - D7: canvas の `causeTree` の図の、線の間隔・口の間隔・隙間の高さ。
  - D8: AND を持つ `causeTree` の図の、弧の位置。
  - D2: 新しい規則 `edge-parallel`(info、`causeTree` の帯だけ)。
- **変わらない出力(バイト単位)**: pdpc・relationDiagram・whyWhyTree(`examples/qc-pdpc`・`qc-relation`・`why-why`)、states・classes・semnet・bpmn。`tree` を書かない `causeTree` の層。D3・D4・D7・D8 は `causeTree` の帯の条件の外で何もしない。
- **触るファイル**: `lib/toc.ts`(D1 の既定、D3 の `need`、D4 の `tracks` を渡す、D7 の倍率、D8 の定数)、`lib/layout-handlers.ts`(D7 の `canvasGeom` を渡す)、`lib/layered-route.ts`(D3 の口、D4 の割り当て・`elbows`・`corridorLoad`)、`lib/route-search.ts`(U3 の `tail` を弧の深さから、U5 の `stub`・`margin` の倍率)、`lib/route-apart.ts`(U5 の歩幅の倍率)、`lib/polyline-metrics.ts`(D2 の `parallelRuns`)、`lib/rules.ts`(D2 の規則と `RULE_DOCS`)、`lib/types/diagrams.ts`(`LaidOutCause` の `origin`)、ADR 0019(D1 の既定の書き換えの注記)、README・`skills/svg-diagram/SKILL.md`(運用どおり PR 本文に書き、最後にまとめて反映)。
- **費用**: D4 の割り当ては隙間ごとに、曲がりの数 n で O(n log n + 制約の数)。今の `assignLanes` と同程度。
- **リスク**: D4・D7 で隙間が高くなり、高さの予算に収まらない図が `fold` や狭めに回る。U4c・U5 の PR で、`examples/` の `toc-*` の高さの増え方を表で出す。D4 で hop の組が変わるので、U4 の PR で `toc-hop`・`toc-hop-all` の hop の数と省いた理由ごとの内訳を before / after で出す。

## 実装計画

| 単位 | 内容 | 依存 | 大きさ |
|---|---|---|---|
| U0 | 報告の図の構造だけを写した fixture(`test/fixtures/crt-report-shape.ts`: 25 節・同じ link と AND・同じ役割、ラベルは同じ文字数のダミー)。pdpc・relationDiagram・whyWhyTree の不変は、各 PR で golden(`pnpm golden`)の `qc-pdpc`・`qc-relation`・`why-why` の差分 0 で示す | なし | 小 |
| U1 | D1: CRT の既定を前提条件だけの ALAP に(link の上の不動点 M、`keep` = M の外、前提条件が無ければ渡さない)。ADR 0019 への注記。`test/` の `tree: 'crt'` の見直し。`pnpm golden`(差分 0) | U0 | 小 |
| U2 | D2: `parallelRuns` と `edge-parallel`(info、`causeTree` の帯だけ)。`LaidOutCause` の `origin`。`RULE_DOCS`・`check --explain` | なし(U1 と並行可) | 小 |
| U3 | D3 と D8: AND の組の隣の口の間隔、`need`、弧の定数、**頭の手前の最後の run の 5 つの下限を弧の深さから求める**(`layered-route.ts:209`・`:246`・`:254`・`:394`、`route-search.ts:54`) | U2(物差し) | 中 |
| U4a | D4 の一部: 長い矢印の途中の曲がりにトラックを割り当てる(真ん中の重なりを消す。P1 の主因)。区間の両端の伸ばし、`elbows` の区間ごとの曲がり、`tracks` の口 | U2 | 中 |
| U4b | D4 の一部: 縦の制約で `fanIn` の分岐と D11 の `laneShare`/`lastTurn` を置き換える。最初のテストは u4・e2 の再現(交差 0) | U4a | 中 |
| U4c | D4 の一部: `corridorLoad`・`crowdOf` を同じトラック数で数える。detour をトラックに合わせる。後段(align・D12〜D14)の採否に `parallelRuns(·, LANE)` を足す | U4b | 中 |
| U5 | D7: `s = max(1, canvas の倍率)`、表の 1〜13 に `unit` を掛ける、`GAP` の下限 | U4c | 中 |
| U6 | 測り直し: D12〜D14 のずらしが何かを動かすか、`pick0` の比べ方(D5 の記録)、`edge-parallel` をほかの図へ広げるか。結果をこの ADR に戻す | U5 | 小(測定と ADR) |

最も安く効果が大きいのは U1(数行で、報告の図の折れが半分、0px の並走が 0)。U0 は U1 以降の基準を、利用者のファイルに頼らずに確かめるために先に入れる。U2 は、U3・U4 の効果を数えるために先に入れる。

### テスト方針

- **フォントに依存する絶対値を使わない**。箱の大きさや座標の px を固定しない。比べるのは、数(交差・並走の組・折れ)、順序(口の並び、トラックの順)、間隔と定数(`laneStepOf(space)`・`portStep`)の大小、asap と alap の比較。
- U0: pdpc・relationDiagram・whyWhyTree は、各 PR の golden(`test/helpers/strict-width.ts` を使う `pnpm golden`)で `qc-pdpc`・`qc-relation`・`why-why` の差分 0 を示す。出力のハッシュは固定しない(フォントの測り方に依存するため)。
- U1: 前提条件 → 結果 ← 根本原因 の小さな図で、`tree: 'crt'` の前提条件が行き先の層 - 1 にあり、root は層 0 のまま。**役割の無い入口の節は CRT の既定で asap の層のまま**(行き先が深い図で)。明示の `layer: 'alap'` では ADR 0019 どおり動く。前提条件の無い CRT の SVG が今と同じ。`layer: 'asap'` で今の層に戻る。`tree` を書かない図の層が変わらない。**前提条件と循環(`back: true` の負のループ)の両方を持つ CRT で、動くのは M の節だけで、ほかの節(循環の節を含む)の層は asap と同じ。反転した link の集合(`breakCycles` の結果)が asap と同じ**。
- U2: 合成した経路(数値の点列)で、間隔 `sep` 未満の重なりを数える。端を共有する組も数える。`runsTogether` の結果が変わらない。 `origin` の付いた cause の帯(pdpc など)には `edge-parallel` が出ない。
- U3: AND 2 組(4 本)が 1 つの頭に入る図で、組の間の口の間隔が組の中の間隔の 2 倍。2 つの弧の範囲の間が `2 × portStep - 2 × AND_REACH` 以上。**AND の無い頭の口と箱の幅が変わらない**。弧の見える隙間 `AND_PEAK − ARROW_L − 1` が 0.4 × 文字の大きさ以上。`loose` が増えない。折れの合計が増えない。 **すべての AND の弧が描ける: 各 AND の矢印の最後の run ≥ `AND_END + 1`(`loose` = 0)を、倍率 1 と 1.29 の両方で**(1.29 は U5 の前は `AND_*` だけに倍率を掛けたテスト用の指定で確かめる)。
- U4a: 同じ隙間を通る長い矢印 2 本が、`LANE` 以上離れて曲がる(`parallelRuns(routes, laneStepOf())` が 0)。同じトラックに並ぶ 2 本の run の端が `laneStepOf()` 以上離れる。
- U4b: u4 の再現(1 つの頭へ入る AND の組の 2 本と、別の頭へ入る矢印が同じ隙間を通る)と e2 の再現(長い矢印と直接の矢印が 1 つの AND に入る)で、組の中の交差が 0。
- U4c: detour が効く図(箱を避ける長い矢印)でも `parallelRuns(routes, laneStepOf())` が 0。`tracks` を渡さない `layeredAttempt`(states など)の経路が、今と同じ点列。
- U5: canvas の有無だけが違う 2 つの図で、並走の最小間隔 ÷ 文字の大きさが同じ。表の 1〜13 の値が倍率どおり(例: 隙間の中の隣り合うレーンの間隔が `LANE × unit`)。`minText` が 14 未満の図で、間隔が今より狭くならない(`s` の下限 1)。canvas の無い図の SVG が変わらない。
- 実行は対象のファイルだけ(`node --test test/<file>.test.ts`)。golden は U1・U3・U4 の PR で 1 回ずつ。

### 完了の基準

- U0 の fixture(報告の図の構造の写し)を、報告の図と同じ指定(`tree: 'crt'`、`dir: 'up'`、canvas の `minText: 18` など)で描いたとき、既定(`layer` を書かない)で次が成り立つ。テストにする(どれもフォントに依らない比・数):
  - 折れの最大 ≤ 4、折れの合計 ≤ 今の alap の値(PR で測って書く)
  - `parallelRuns(routes, laneStepOf(space) × s)` = 0
  - `cause-crossing` = 0、`loose` = 0
  - **並走の最小間隔 ÷ `minText` ≥ 0.9**(`density: 'compact'` では ≥ 0.7)。SVG の座標で測る(図を縮めて表示しても、文字と線が同じ倍率で縮むので、表示の px での比と同じ)
  - **AND の矢印のそれぞれで、矢じりの根元から弧までの見える隙間 ≥ 0.4 × `minText`**(今は最小 3.3px = 0.18 倍)
  - 2 つの AND の弧の切れ目 ≥ `2 × portStep − 2 × AND_REACH`(倍率込み)
- 報告の図そのもの(利用者のファイル)でも同じ値を測り、PR 本文に載せる(テストには入れない)。
- `edge-parallel` が、`examples/` の `toc-*` で 0 件(出るものは、PR で理由を書く)。
- pdpc・relationDiagram・whyWhyTree、states・classes・semnet・bpmn の golden の差分が 0。

## 未決

- D3・D4・D7・D8 を pdpc・relationDiagram・whyWhyTree へ広げるか(pdpc は外周の戻り辺の曲がり `turnOuter` を割り当てに入れる設計が要る)。U6 の後に別の ADR で決める。
- asap の最終の図が素の案になった経路(`pick0` の後の `sharing`・並びの再探索・fit のどこで決まったか)は追い切っていない。D1 で前提条件のある CRT が ALAP になれば、報告の図では問題にならない。
- D12〜D14 のずらし(`aside`・`apart`)を、`causeTree` で D4 の後も残すか(U6)。
- `edge-parallel` を、ほかの自動配置の図へ広げるか(U6)。
- 隙間ごとの `levelGap`(混む隙間だけを広げる)。`graph-layout.ts` に手が入るので、D4 で図が高くなる例が出たら別の ADR で。
- D8 の 0.4 倍・D7 の完了の基準 0.9 倍の係数は、U3・U5 で報告の図を見て調整しうる(調整したらこの ADR に戻す)。

## 改訂履歴

- 2026-11-20 第 1 巡(Opus レビュー `docs/adr/0070-opus-review-round1.md`、Major 6・Minor 8・Nit 3)を反映: M1 D3・D4 の範囲を `causeTree` の帯に限り、pdpc・relationDiagram・whyWhyTree のバイト単位の不変をテストに(U0)。M2 D11 を D4 に吸収、detour をトラックに合わせる、後段の採否に `LANE` 未満の並走を増やさない条件。M3 D3 は AND の組の隣だけ広げる。M4 D7(canvas の倍率)と、並走の間隔 ÷ `minText` の完了の基準。M5 弧と矢じりの隙間を実測し D8 と完了の基準に。M6 CRT の既定は前提条件だけの ALAP。Minor: 11 ファイル、`crowdOf`、区間の両端の伸ばし、hop、fixture、U4 の 3 分割、`edge-parallel` を `causeTree` だけに、D3 の広げ幅の固定。Nit: 「同じ軸」、toc-compact の a3、`pick0` の記録の手順。alap の 2 つの交差は、レビューの経路の確認で D4 で解けると分かったので未決から外した。
- 2026-11-20 第 2 巡(Opus レビュー `docs/adr/0070-opus-review-round2.md`、Major 2・Minor 6・Nit 2、条件付き承認)を反映し、状態を承認にした: MA 頭の手前の最後の run の 5 つの下限を U3 で弧の深さから求め、弧が描けることを倍率 1・1.29 でテスト。MB `keep` を link の上の不動点 M の補集合にし、循環つきの CRT のテストを足す。Minor: D7 の倍率の下限 1、経路の間隔 16 か所の表と U5 での扱い、`GAP` を倍率つきレーンの 2 倍以上に、U0 は golden の差分で、`LaidOutCause` の `origin`(U2)、hop の `and-arc` の範囲の広がりは受け入れる効果とする。Nit: D8 の弧の位置の書き方、`tracks` のとき `sharing()` の `laneShare` の案を作らない。

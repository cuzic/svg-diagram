# ADR 0070: CRT の辺の読みやすさ(`tree: 'crt'` の既定を ALAP に、隙間のトラック割り当て、AND の組ごとの入口、並走の検査)

- 状態: 提案
- 日付: 2026-11-20
- 基点: `main`(7a95096e、PR #371 まで)
- 関連: ADR 0015(`tree`・`cause-parallel` / `cause-crossing`。G6 の AND の並走)、ADR 0016(D3 直線化、D6 `edge-bends`、D11〜D14 の並走のずらし)、ADR 0019(D1 `layer: 'alap'` と既定、D4 交差の再探索は `cause-crossing` だけ)、ADR 0020(TOC の検査)、ADR 0028(交差の hop)。ADR 0068・0069 は別の PR で提案中のため、この ADR は 0070
- 範囲外: 節の並び(交差最小化)そのものの改良(ADR 0019 D4 の範囲)、`causeTree` 以外の図(states・classes・semnet・bpmn)の経路の変更(D4 は `causeTree` だけで有効にする)

## 背景

利用者の CRT(現状問題構造ツリー、`tree: 'crt'`)が読みにくい、という報告が届いた(2026-11-20)。図は 24 節・25 本の link(AND を展開すると矢印 31 本、AND 6 組)で、指定は `{tree: 'crt', dir: 'up', maxNodeW: 260, fold: true, roleTags: true, coreDriver: true}`、`canvas: {width: 2600, minText: 18}`。利用者は報告のあと `layer: 'alap'` も書いた。

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

測り方: 報告の図のソースを `renderDiagram`(`lib/dsl/render.ts:27`)に通し、`laidOut` の cause の帯の `edges[].points`・`ands`・`anchors` から数えた(スクリプトは PR 本文に載せる。図のファイルは利用者のもので、リポジトリには入れない)。「並走」は、別の矢印の同じ向きの run どうしで、長さ方向に 4px を超えて重なるもの。

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

asap で最も長い並走は r5→u3 と r1→e7(間隔 0px、266px)、r4→u5 と r1→e7(0px、250px)、r2→e1 と r3→e3a(0px、204px)。どれも端を共有しない長い矢印どうしが、同じ線の上に重なっている。

節に入る矢印(alap。asap も間隔は同じ):

| 節 | 箱の幅 | 入る矢印 | AND の組 | 矢じりの間隔 | 弧の x の範囲 |
|---|---|---|---|---|---|
| u4 | 244 | 4 | 2(e8+pre3、u3+pre4) | すべて 22px(703, 725, 747, 769) | 693–731 と 741–779(2 つの弧の間 10px、y は同じ 398) |
| e2 | 244 | 3 | 1(pre1+r1) | 22px | 1345–1387 |
| u2 | 244 | 3 | 1(u1+e3) | 22px | 1872–1910 |
| e3・u3 | 244・262 | 3 | 0 | 22px | — |

出る矢印(P4): alap では、2 本以上の出る矢印を持つ 5 節(r1・r2・e2・e3・u3)すべてで出口の間隔が 22px、最初の run を共有する組は無く、同じ尾の並走(8px 未満)も 0 組。asap では同じ尾の並走が 1 組(26px、間隔 0px)。**P4 は alap では、この図では再現しない**。

### 層(d)

- `layer: 'alap'` はある(ADR 0019 D1、`lib/graph-layout.ts:369` の `alap`)。`causeTree` の既定は `alapOf`(`lib/toc.ts:223-226`)で、`tree` が `'prt'`・`'frt'`・`'tt'`・`'nbr'` なら `'alap'`、**`'crt'` を含むそれ以外は `'asap'`**。`keep` は役割 `root`・`injection`・`start` の節で、根本原因は最下段に残る。
- `examples/` で `tree: 'crt'` を書くのは `examples/toc-compact.ts:30` だけ(`examples/toc-crt.ts` は `tree` を書かない)。`test/` には `tree: 'crt'` が 9 ファイルに 25 か所ある。

### 層の中の列(b)

(b) は大部分が実装済み。

- ダミー節: 層を飛ぶ辺は、層ごとに大きさ 1×1 のダミーの slot を持つ(`lib/graph-layout.ts:445`)。ダミーどうし・ダミーと箱の間は、節の間隔 `gap`(causeTree は `GAP = 28`、`lib/toc.ts:25`)だけ離れる。**層の中を通る run の間隔は、すでに保証されている**。
- 交差最小化: 重心法の掃き出しと `transpose`(ADR 0016 D2)、`causeTree` の並びの再探索(ADR 0019 D4、`lib/toc.ts:94-160`)。
- Brandes–Köpf: `brandesKoepf`(`lib/graph-layout.ts:252`、`coord: 'bk'`)。`layeredAttempt` の `pick0`(`lib/layered-route.ts:580-588`)が、素の案(`coord: 'relax'`)と BK の案を (交差, 折れ) の辞書式で比べる。
- 経路はダミーの点を通る: `routeOnce` の `build` は `elbows([start, ...e.points.slice(1, -1), end], turn, lastTurn)`(`lib/layered-route.ts:258`)。BK でダミーの列がまっすぐなら、長い矢印は層の中をまっすぐ通る。
- 実測(候補の選び方を一時的に記録して数えた。コードは戻した): asap では `pick0` の 1 回で、BK の案(交差 12・折れ 66)が素の案(交差 10・折れ 112)に負けた(交差が 2 少ないことが、折れ 46 回より優先される)。**最終の図の折れ 116 は素の案の値**(`pick0` 以降の選び方の経路は追い切っていない)。alap では記録した `pick0`(並びの再探索を含め 28 回以上)のすべてで BK の案(交差 11〜14・折れ 54〜58)が勝った。

### 隙間の中の曲がり(a、P1・P2)

**(b) の残りの穴はここにある。** 層と層の間の隙間で、どこで曲がるかの決め方が、矢印の種類で違う。

- 直接の矢印(隣の層へ。`points.length === 2`)は、隙間ごとに**レーン**を持つ(`corridors`、`lib/layered-route.ts:130-141`。`assignLanes`、`:182-197`)。レーンの間隔は `laneIn(g)`(`:124-128`)で、`LANE = 14`(`:17`)以上、`2 × LANE` 以下。
- **長い矢印**(層を飛ぶ)は、途中の曲がりにレーンを持たない。`elbows` は、`turn` / `lastTurn` が無い区間を**隙間の真ん中** `(p.x + q.x) / 2` で曲げる(`lib/layered-route.ts:32`)。同じ隙間を通る長い矢印は、みな同じ座標で曲がり、向きが合えば**同じ線の上に重なる**(実測の間隔 0px の並走はこれ)。例外は AND の頭へ入る長い矢印の最後の曲がり(`lastTurn`、`:249-255`)だけ。
- 隙間の広さ: `layoutWithLanes`(`:432-436`)は `corridorLoad`(`:409-426`)で隙間を広げるが、**数えるのは直接の矢印と外周の戻り辺だけ**で、長い矢印の曲がりは数えない。`laneIn` の混み具合 `crowdOf`(`:114-123`)も、長い矢印は AND の頭へ入るものの最後の隙間しか数えない。
- 後からのずらし: ADR 0016 D12〜D14(`aside`、`apartOf` → `moveApart`、`lib/route-apart.ts`)は、選んだ案の並走を 8〜24px ずらす。**何も悪くしないときだけ、1 回だけ**採る(`lib/layered-route.ts:560-575`)。さらに「交差が 1 つ以上ある図で、ずらしが交差を 0 にした」場合は採らない(`:573`)。asap の図では、0px の並走が計 1175px 残った。
- 段差(P2): 1 本の長い矢印のダミーの位置が層ごとに違うと、隙間ごとに 2 回ずつ折れる(層を 6 つ飛ぶ pre3→u4 が 12 回)。asap で素の案が選ばれたことと、層を飛ぶ矢印の多さ(18 本)が重なった結果。alap では層を 2 つ以上飛ぶ矢印が 8 本に減り、最大 4 回になった。

### AND の入口(e、P3)

- 1 つの面に入る矢印の口(port)は、`portOf`(`lib/layered-route.ts:143-164`)が、他端の位置の順(AND の矢印は組の平均の位置でまとめる)に並べ、**組の区別なく等間隔** `step = min(portStep, (h - 12) / (n - 1))` に置く。`causeTree` の `portStep` は `PORT = 22`(`lib/toc.ts:25`、`:279`)。口の列は面の中央に寄り、面の幅は使わない(u4 は幅 244 の面の中央の 66px に 4 本)。
- 箱は、口が入るだけ伸びる(`need = 12 + (degree - 1) × PORT`、`lib/toc.ts:261`)。組の間の余白は数えない。
- AND の弧は、組の外側の矢印から `reachTo` = `min(AND_REACH = 10, 隣の矢印までの半分 - 5)` だけ伸びる(`lib/toc.ts:345-353`、`:29`)。口の間隔が 22px なら 6px で、隣の組の弧との間は 22 - 2×6 = **10px**。弧の高さ(`AND_END`・`AND_PEAK`)は全組で同じなので、2 つの弧は同じ y に 10px の切れ目で並び、1 本の弧に見える。検査の「2 つの弧が触れる」(`lib/verify-handlers.ts:151`)は 8px 未満で出るので、10px は検査を通る。
- alap に残る 2 つの `cause-crossing` は、**どちらも同じ AND の組の中**(pre1+r1 → e2、u3+pre4 → u4)。u4 の組は 2 本とも直接の矢印で、レーンの順の規則(`lib/layered-route.ts:189-193`)は、1 つの隙間の矢印が**全部同じ頭へ入るときだけ** fan-in の順(近い尾が先に曲がる)を使い、ほかの頭へ入る矢印が混じる隙間では fan-out の順(遠い方が先に曲がる)になる。u4 の手前の隙間には u3→u6 なども通るので後者になり、遠い u3 が先に曲がって pre4 の縦の run を横切る、と読める(**推定**。U3 で確かめる)。e2 の組は直接の矢印(pre1)と長い矢印(r1)で、長い矢印の最後の曲がりが頭の近く(`lastTurn`)、直接の矢印の曲がりが尾の近くにあることによる交差と読める(同じく推定)。

### 検査(g、c)

- `cause-parallel` / `cause-crossing`(warn)は、**AND を持つ頭へ入る矢印どうし**だけを見る(`andClashes`、`lib/cause-clash.ts:14-27`)。並走の判定は `runsTogether`(`lib/polyline-metrics.ts:111-117`): 間隔 4px 未満・重なり 4px 超。asap の 0px の並走 960px(端を共有しない組)は、どの検査にも出ない。
- `edge-bends`(`lib/rules.ts:644-675`): 1 本 5 回以上、または平均 3 回超。既定は info、`diagram({layoutCheck: 'strict'})` で warn(`layoutSeverity`、`:605`)。対象は cause・states・bpmn・classes・ネットワークの図。
- 経路の部品は `layeredAttempt` を通して states(`lib/states.ts:94`)・classes(`lib/classes.ts:71`)・semnet(`lib/semnet-common.ts:99`)と共有している。

### 曲線(f)

- 経路と検査は直交の線分を前提にしている: 交差の判定 `cross`(`lib/cause-clash.ts:7-11`)と `runsTogether` は水平・垂直の線分だけを扱う。AND の弧は、組の矢印の最後の run が同じ向きにそろうこと(`andEnds`、`lib/toc.ts:233-243`)を条件に描く。ADR 0028 の hop も直交の交点で決める。
- 曲線の辺は mindmap(`edges: 'elbow' | 'curve' | 'straight'`、`lib/types/diagrams.ts:53`)にだけある。

### 大きさの単位

`causeTree` の `PORT`・`GAP`・`LEVEL`(`lib/toc.ts:25`)と `LANE`・`STUB`(`lib/layered-route.ts:16-17`)は `density` の `space` でだけ縮み、`canvas.minText` の文字の倍率(`canvasFontScale`、`lib/tokens.ts:280`。`minText: 18` で 1.29)では大きくならない。文字は 1.29 倍、矢印の間隔は 1 倍のまま。図を縮めて見ると(2600px の図を 1000px 幅で見ると 0.38 倍)、14px のレーンは 5px に見える。P1 の「1〜数 px」は、asap の 0px の重なりと、縮小で詰まって見える 14〜22px の間隔の両方を指していると考えられる。

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

- `alapOf`(`lib/toc.ts:224`)の既定の対象に `'crt'` を足す。`layer: 'asap'` と書けば今の図に戻る。`tree` を書かない `causeTree`、pdpc・relationDiagram・arrowDiagram は今のまま(asap)。
- 理由: 実測で、折れの合計 116 → 54、最大 12 → 4、0px の並走 1175px → 0、`edge-bends` が出なくなり、図の高さの増えは 67px(4%)。`keep`(root・injection・start)は最下段に残るので、ADR 0019 が CRT を asap に残した理由(「根本原因は最下段」)は、ALAP でも保たれる。動くのは、入る辺が無く root でない節(前提条件、役割の無い入口の節)とその連鎖だけで、これは利用者の案 (d) そのもの。
- **ADR 0019 D1 の「既定」の項を書き換える**(`'crt'` を `'alap'` の側へ)。ADR 0019 の本文には、この ADR への参照を 1 行足す。
- 既存の出力への影響:
  - `examples/`: `tree: 'crt'` を書くのは `toc-compact` だけ。動きうる節は `b3`(入る辺が無く root でない)だけで、行き先 `b2`・`a3` はどちらも層 1 なので、ALAP でも層 0 のまま(**推定**)。golden の差分は 0 の見込み。U1 で `pnpm golden` の結果を PR に載せる。
  - `test/`: `tree: 'crt'` を書く 25 か所(9 ファイル)のうち、層や座標を固定しているものは U1 で直す。直したものは PR 本文に一覧で書く。
  - 利用者の既存の CRT: 前提条件のある図は、前提条件が行き先の手前へ動く。リリースノート(PR 本文と README の追記)に `layer: 'asap'` で戻せることを書く。

### D2: 並走の指標と検査 `edge-parallel`(g)。U2 以降の物差しにする

- `lib/polyline-metrics.ts` に `parallelRuns(routes, sep)` を足す: 別の矢印の、同じ向きの run の組のうち、間隔が `sep` 未満で、長さ方向に 4px を超えて重なるもの。組ごとに重なりの長さと間隔を返す。`runsTogether`(4px 未満)は `sep = 4` の特別な場合として残す(`cause-parallel` と D11〜D14 は今の定義のまま)。
- `sep` は `laneStepOf(space)`(既定 14、`density: 'compact'` で 11)。フォントに依らない。
- 規則 `edge-parallel`(`lib/rules.ts`、`edge-bends` の隣): 自動配置の帯(`routedBands`)で、`parallelRuns` の重なりの合計が `2 × sep` を超える帯に出す。**端を共有する組も数える**(P4 の、同じ尾から出て重なる辺はこれで見える)。文面には、最も長い 3 組(尾 → 頭、間隔、長さ)と合計を出す。`data` に `measured`(合計の長さ)と `threshold`。
- 重さは `edge-bends` と同じ `layoutSeverity`(info、`layoutCheck: 'strict'` で warn)。`cause-parallel`(warn)はそのまま残す(AND の頭への 4px 未満の並走は、どの矢印が AND かを読み違えるので、別の重さで扱う)。
- この指標を、U3・U4 の完了の基準と、`layeredAttempt` の案の比べ方(D4)に使う。

### D3: AND の組ごとの入口(e、P3)

- 口の並べ方(`lib/layered-route.ts:143-164`)で、1 つの面に入る矢印を、**組(AND の組、組に入らない矢印は 1 本ずつ)の単位**に分ける。組の中は今と同じ `portStep` の間隔、組と組の間は `2 × portStep` にする。
- 面に余りがあれば、口の列を面の幅に広げる: 組の間を、`2 × portStep` から最大 `4 × portStep` まで、面の幅の範囲で広げる(組の中の間隔は変えない。AND の矢印は寄り添って見えるほうが組だと読める)。u4(幅 244、4 本・2 組)なら、組の間は 44〜88px になる。
- 箱の伸び(`lib/toc.ts:261`)の `need` に、組の間の追加分(組の数 - 1)× `portStep` を足す(面が足りない箱は今どおり伸びる)。
- AND の弧は今の式のまま(`reachTo` が隣の矢印までの半分から決まるので、組の間が広がれば弧は `AND_REACH` まで伸び、2 つの弧の切れ目は `2 × portStep - 2 × AND_REACH` 以上になる。u4 で 10px → 24px 以上)。
- 組の中の交差(alap の残りの 2 つ)は、D4 のトラックの順で直す。D3 は口の位置だけを変える。
- 対象は `groupOf` を渡す図(`causeTree`)だけ。`groupOf` の無い states・classes・semnet は口の位置が変わらない。

### D4: 隙間のトラック割り当て(a・b の残り、P1・P2・P4)

- **1 つの隙間の、すべての曲がりを 1 回で割り当てる**: 直接の矢印の曲がり、長い矢印の途中の曲がり(今は真ん中、`lib/layered-route.ts:32`)と最後の曲がり(`lastTurn`)、外周の戻り辺の曲がり。各曲がりは、隙間を横切る run(`dir: 'up'` で水平の線分)を持ち、その範囲(across の区間)が決まっている。
- 割り当ては、チャネル配線の左端法(left-edge)に**縦の制約**を足したもの: 同じ across の位置に、一方の曲がりの「入る側の縦の run」と、他方の「出る側の縦の run」が来る組は、交差しない上下の順を制約にする(fan-in・fan-out・頭が混じる隙間を同じ規則で扱う。今の `fanIn` の分岐(`:189-193`)を置き換える)。制約に循環があれば、その組だけ今の順に戻す(交差は残り、`cause-crossing` が出る)。
- 範囲が重ならない曲がりは同じトラックを使ってよい(左端法)。重なるものは別のトラックで、トラックの間隔は `laneIn(g)`(`LANE` 以上)。**同じ向きの run が `LANE` 未満で並ぶことは、構成上なくなる**(層の中の run はダミーの slot の `gap` で既に離れている)。
- 隙間の広さ: `corridorLoad` を、隙間ごとのトラックの数(長い矢印の曲がりを含む)で数えるように変える(`layoutWithLanes` が、その数で隙間を広げる)。図は今より高くなりうる。`fitLayout` の高さの予算はそのまま効く(収まらなければ今どおり狭める・折り返す)。
- `elbows` は、区間ごとの曲がりの座標(トラック)を受け取る形にする(`turn` / `lastTurn` の 2 つの引数を、区間の配列に置き換える)。
- **`causeTree` だけで有効にする**: `AttemptOpts` に `tracks?: boolean` を足し、`causeTree` だけが渡す。states・classes・semnet は今の経路(出力不変)。効果を測ってから、別の ADR で広げる。
- 案の比べ方は変えない(`pick0`・`sharing`・`apartOf` は (交差, 折れ) のまま)。並走は D4 で構成上なくなるので、D2 は物差しとしてだけ使う。D12〜D14 の後からのずらし(`aside`・`apart`)は残す。D4 の後に、ずらしが何かを動かしているかを D2 で数え、何も動かさないなら別の PR で外す(未決)。
- P4(同じ尾から出る辺の重なり): 別の仕組みは作らない。同じ尾から出る矢印の曲がりも D4 の同じ割り当てに入り、口は今どおり `PORT` 間隔で分かれる。alap の実測では P4 は再現しないので、D2 の検査で見張る。

### D5: 折れの上限と再試行は入れない。`edge-bends` は info のまま(c)

- 実測で、P2 の段差は asap と素の案の組み合わせで起き、alap(D1)では最大 4 回・平均 1.74(`edge-bends` の閾値 5 回・平均 3 の内側)になった。上限を超えた辺のための並べ替えの再試行は、ADR 0019 D4 の再探索(最大で数十回の `layeredAttempt`)にもう 1 つ探索を重ねることになり、費用に見合う図が今は無い。
- `edge-bends` を warn に上げない: 規則は cause・states・bpmn・classes・ネットワークの図で共有で(`lib/rules.ts:652-659`)、warn にすると、意図して折れる図の `check` が一斉に警告を出す。強く見たい図は今どおり `layoutCheck: 'strict'`。
- ただし、asap で BK の案(交差 12・折れ 66)が素の案(交差 10・折れ 112)に負けた事実は記録し、U4 の後に D2 の物差しで測り直す(未決)。

### D6: 曲線(`edges: 'curve'`)は入れない(f)

代替案を見よ。

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
| 線の間隔(`PORT`・`LANE`・`STUB`)を `canvas.minText` の倍率で大きくする | canvas を使うすべての図の出力が変わる。間隔の保証(D4)の後に、なお詰まって見えるかで決める(未決) |

## 影響

- **変わる出力**:
  - D1: `tree: 'crt'` を書いた図(前提条件など、入る辺が無く root でない節を持つもの)の層。`examples/` では `toc-compact` だけが対象で、差分は 0 の見込み。
  - D3: AND を持つ `causeTree` の図の、口の位置と箱の幅(組の間が広がる)。`examples/` の `toc-*` の多くが動く。
  - D4: `causeTree` のすべての図の、隙間の中の曲がりの位置と隙間の高さ。
  - D2: 新しい規則 `edge-parallel`(info)。`check` の出力が増えうる。
- **変わらない出力**: states・classes・semnet・bpmn(D3 は `groupOf` の無い図で、D4 は `tracks` を渡さない図で何もしない)。`tree` を書かない `causeTree` の層。
- **触るファイル**: `lib/toc.ts`(D1 の既定、D3 の `need`、D4 の `tracks` を渡す)、`lib/layered-route.ts`(D3 の口、D4 の割り当て・`elbows`・`corridorLoad`)、`lib/polyline-metrics.ts`(D2 の `parallelRuns`)、`lib/rules.ts`(D2 の規則と `RULE_DOCS`)、ADR 0019(D1 の既定の書き換えの注記)、README・`skills/svg-diagram/SKILL.md`(運用どおり PR 本文に書き、最後にまとめて反映)。
- **費用**: D4 の割り当ては隙間ごとに、曲がりの数 n で O(n log n + 制約の数)。今の `assignLanes` と同程度。
- **リスク**: D4 で隙間が高くなり、高さの予算に収まらない図が `fold` や狭めに回る。U4 の PR で、`examples/` の `toc-*` の高さの増え方を表で出す。

## 実装計画

| 単位 | 内容 | 依存 | 大きさ |
|---|---|---|---|
| U1 | D1: `alapOf` の既定に `'crt'`。ADR 0019 への注記。`test/` の `tree: 'crt'` の固定値の見直し。`pnpm golden`(差分 0 の見込み) | なし | 小(1 行 + テスト) |
| U2 | D2: `parallelRuns` と `edge-parallel`(info)。`RULE_DOCS`・`check --explain` | なし(U1 と並行可) | 小 |
| U3 | D3: 組ごとの口、組の間の余白、`need` | U2(物差し) | 中 |
| U4 | D4: 隙間のトラック割り当て(`tracks`、`causeTree` だけ)、`corridorLoad`、`elbows` の区間ごとの曲がり | U2・U3 | 大 |
| U5 | U4 の後の測り直し: D12〜D14 のずらしが何かを動かすか、`pick0` の比べ方(D5 の記録)、間隔の倍率(未決)。結果をこの ADR に戻す | U4 | 小(測定と ADR) |

最も安く効果が大きいのは U1(1 行で、報告の図の折れが半分、0px の並走が 0)。U2 は、U3・U4 の効果を数えるために先に入れる。

### テスト方針

- **フォントに依存する絶対値を使わない**。箱の大きさや座標の px を固定しない。比べるのは、数(交差・並走の組・折れ)、順序(口の並び、トラックの順)、間隔と定数(`laneStepOf(space)`・`portStep`)の大小、asap と alap の比較。
- U1: 前提条件 → 結果 ← 根本原因 の小さな図で、`tree: 'crt'` の前提条件が行き先の層 - 1 にあり、root は層 0 のまま。`layer: 'asap'` で今の層に戻る。`tree` を書かない図の層が変わらない。
- U2: 合成した経路(数値の点列)で、間隔 `sep` 未満の重なりを数える。端を共有する組も数える。`runsTogether` の結果が変わらない。
- U3: AND 2 組(4 本)が 1 つの頭に入る図で、組の間の口の間隔が組の中の間隔より大きい。2 つの弧の x の範囲の間が `2 × portStep - 2 × AND_REACH` 以上。`groupOf` の無い図で口が変わらない。
- U4: (1) 同じ隙間を通る長い矢印 2 本が、`LANE` 以上離れて曲がる(`parallelRuns(routes, laneStepOf())` が 0)。(2) 1 つの頭へ入る AND の組の 2 本と、別の頭へ入る矢印が同じ隙間を通る図(u4 の再現)で、組の中の交差が 0。(3) 長い矢印と直接の矢印が 1 つの AND に入る図(e2 の再現)で、交差が 0。(4) `tracks` を渡さない `layeredAttempt`(states など)の経路が、今と同じ点列。
- 実行は対象のファイルだけ(`node --test test/<file>.test.ts`)。golden は U1・U3・U4 の PR で 1 回ずつ。

### 完了の基準

- 報告の図(利用者のソース。リポジトリには入れない)で、既定(`layer` を書かない)の結果が、少なくとも今の alap の値(折れの合計 54・最大 4、並走 0)以下で、かつ `cause-crossing` が 0、u4 の 2 つの弧の切れ目が 24px 以上(`PORT = 22` のとき)。値は PR 本文に、測るスクリプトとともに載せる(テストには固定しない)。
- `edge-parallel` が、`examples/` の `toc-*` で 0 件(出るものは、PR で理由を書く)。
- states・classes・semnet・bpmn の golden の差分が 0。

## 未決

- D1 で、`examples/toc-compact` の差分が 0 になること(推定)。U1 で確かめる。
- alap に残る 2 つの `cause-crossing` の原因の読み(u4 は混じった隙間で fan-out の順になる、e2 は長い矢印の最後の曲がりと直接の矢印の曲がりの位置)は、コードを読んだ推定。U4 の前に、u4 と e2 の構造を再現した小さな図で確かめる。
- asap の最終の図が素の案になった経路(`pick0` の後の `sharing`・並びの再探索・fit のどこで決まったか)は追い切っていない。D1 で CRT が alap になれば、この図では問題にならない。
- `PORT`・`LANE`・`STUB` を `canvas.minText` の倍率で大きくするか。D4 の後に、縮小して見たときの間隔で決める。
- D12〜D14 のずらし(`aside`・`apart`)を、`causeTree` で D4 の後も残すか(U5)。
- D2 の閾値(合計 `2 × sep`)が、ほかの自動配置の図で誤検知を出さないか。U2 で `examples/` 全体の件数を数え、多ければ `causeTree` の帯に限る。

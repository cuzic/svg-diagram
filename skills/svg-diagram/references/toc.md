# TOC の図（因果ツリー・クラウド）と故障の木
（svg-diagram の入口は `../SKILL.md`）  配置・幅・折れ・交差の共通の注意は `auto-layout.md`。書き方の詳細は README の「TOC の思考プロセス」。

| 描きたいもの | 部品 | 書くもの |
|---|---|---|
| TOC の因果の図（現状・未来現実・前提条件・移行ツリー） | `causeTree(nodes, links, {dir, coreDriver})` | 実体 `{id, label, role?}`（role: ude / root / de / injection / goal / obstacle / io / action / precondition＝統制できない現状の事実 / tipping＝NBR の転換点 / trim＝転換点を断つ施策（`foldsInto: '施策 1'` で箱の下に「→ 施策 1 に組み込む」）/ need＝TT のニーズ（塗りつぶし））と `{from, to}`（`from` を配列にすると AND。循環の戻りの矢印には `back: true`: 節の並びで層が変わらず、太く描く）。下が原因・上が結果。`coreDriver: true` で、届く UDE が最多の起点に太い枠と「中核」のバッジ（箱の外に置かれる。`counts: false` で `到達 UDE n` を消す）。`layer: 'asap'｜'alap'`: 入力側（原因が入らない実体と、そこからの連鎖）を最初の層に置くか、行き先の手前に置くか。**`tree` が `'prt'｜'frt'｜'tt'｜'nbr'` のときの既定は `'alap'`**（それ以外は `'asap'`。戻すなら `layer: 'asap'`）。FRT の最終のゴールは `role: 'de'` でも `'goal'` でもよい。`maxNodeW: 'auto'` は 260 → 100 の広い方から、幅と高さの両方に収まる最初の箱幅（`dir` を書いても効く）。AND へ入る矢印が交差する（`cause-crossing`）ときは、節を書いた順を変えて探し直して、厳密に良くなるときだけ採る。リンクの `kind: 'blocks'` は「断つ」辺（破線＋横棒の端。ネガティブブランチ）。`tree: 'crt'｜'frt'｜'prt'｜'tt'｜'nbr'` を書くと `check` が TOC の約束（UDE の数・根本原因・1 本鎖・孤立・`back` の付け忘れ＝`toc-cycle-undeclared`）を見る（既定 info、`diagram({tocCheck: 'strict'})` で warn）。`nbr` は `toc-nbr-parts` / `-no-tipping`（転換点を通らない道）/ `-tipping-not-and` / `-trim-too-late`（転換点より結果側を断つ）、`tt` は `toc-tt-unit`（AND の結果にニーズと行動が無い。単位は `transitionUnits([{id, current?, need, action, result, resultRole?}])` が `{nodes, links}` を作る。`current` は最初の単位だけ）、`prt` は `toc-prt-bottom-not-action`（鎖の底が行動でない）/ `toc-prt-one-to-one` / `toc-obstacle-phrase`（障害の文末が「ない」「無い」「不足」。常に info）、`frt` は `causeTree(…, {tree: 'frt', mirrors: crtBand})` と de / goal の `mirrors: '<CRT の UDE の id>'` で `toc-mirror`（対応の欠け・重複・UDE でない id）。`diagram({legend: 'auto'})` は使った役割（tipping / trim / need を含む）・AND の弧・戻り・断つ辺・中核の印を凡例にする（文言は `legendLabels: {'role:precondition': '与件'}`）。層を 2 つ以上飛ぶ戻りは `returns: 'outer'` で外周のレーンへ（既定は `back: true` の辺だけ外周。`pdpc` は全部外周） |
| TOC のクラウド（対立解消図） | `cloud({a, b, c, d, d2}, {assumptions})` | 共通目的 A・必要条件 B/C・対立する要望 D/D'。前提 `{on: 'ab'｜'ac'｜'bd'｜'cd'｜'dd', text, injection?}` は番号が矢印に載り、一覧は図の下 |
| 故障の木（FTA） | `faultTree(top, {maxNodeW, cutSets, quant, quantPeriod})` | 事象 `{label, kind?, gate?, children?, k?, condition?, ref?}`。gate: and / or / vote(k) / inhibit(condition)。kind: event / basic（円）/ undeveloped（ひし形）/ house（state）/ condition（楕円。inhibit の condition だけ）。同じ基本事象は `{ref: id}`。線に矢じりは無い。幅は 900px に収まる葉 7 個ほどまで。`cutSets: true` で単一故障点に太枠とバッジ、`quant: true` で葉の `p`（確率 0〜1）から頂上の確率を注に書く（独立を仮定。`quantPeriod` で期間）。`legend: 'auto'` で記号の凡例 |
| なぜなぜ分析（木） | `whyWhyTree(problem, whys, {id})` | `whys: {why, because?, trueCause?: true, measure?}[]`（`because` は「なぜ?」の答え）。問題が上、答えが下で、「なぜ n」は枝によらず同じ段。真因は二重枠、`measure` は破線の棒で真因を断つ。返り値は木と読む向きの注（`.add(...)` に展開して渡す）。幅が足りなければ折り返さずに止まる。表で書くなら `references/semantic.md` の `whyWhyTable` |
| ボウタイ図 | `bowtie({hazard?, top, threats, consequences}, {id, maxNodeW})` | 中央が頂上事象（`top`）、左は脅威と予防バリア（`{label, barriers?}`）、右は低減バリアと結果。流れは左から右。箱は左右合わせて 6 個ほどまで（900px）。バリアの無い道は `bowtie-barrier-missing` |

- **避けられない交差の見せ方**: `causeTree(nodes, links, {hop: true})`（`relationDiagram` / `pdpc` も同じ第 3 引数）。戻りの矢印（`back: true` など）が他の線を横切る箇所は、`hop: true` で、戻りの線が小さな弧で飛び越す表現になる（既定 off。ただし `tree` を書いた図は `hop: 'all'` が既定で、`hop: false` で消せる。AND の弧や矢じりの近く、破線の戻りなどには付けない。ADR 0028。例は `examples/toc-hop.ts`）。**`hop: 'all'`** は、戻りに限らず、層を横切る線が、流れに沿って走る線を飛び越す（例は `examples/toc-hop-all.ts`）。折れ・矢じり・AND の弧・別の交点が近い交差には弧が付かないので、全部の交差に付くわけではない。`cause-crossing` の警告が出る図は、並びを乱択も含めて最大 60 通り探し直す（同じ図は同じ結果。改善が止まれば早く打ち切る。`straighten: false` なら従来の 7 通りだけ）。層を 2 つ以上またぐ長い矢印は、箱を避けて折れが最少の道を探し直し、箱の辺に 1 本だけの矢印も、箱が重なれば直線にそろえる（どちらも `straighten: false` で従来の図）。
- 幅に収まらないときの `dir: 'auto'` / `fold`、折れの少ない配置（`straighten` / `returns`）は、層状の図に共通なので `auto-layout.md` を見る。

## 警告の許容（accept）と、望む結果が本文に無いとき

- どの警告にも、許容するための書き方が → の行で出る（`check --help` にも、`check --explain 規則名` にもある）。理由は必須。例: `diagram({accept: {'toc-ude-count': '第 1 章の部分図のため'}})`、案件全体なら `.svg-diagram.json` の `{"accept": {...}}`。許容した指摘は info に下がり、理由が添えられる。
- **部分図**（CRT の第 1 章分だけ、など）の UDE の数は `toc-ude-count` で出る。`accept` で許容できる（書き方は警告に付く）。
- **`tocCheck: 'strict'` が未来現実ツリーに望む結果（`de` / `goal`）を求めるとき**、本文にその文が無い枝（副作用の枝など）のために、文を作ってはいけない。`toc-no-desired-result` を `accept` で、理由つきで許容する（例: `accept: {'toc-no-desired-result': '本文は副作用の枝だけを述べ、望む結果の文が無い'}`）。理由は ADR 0037。
- **ネガティブブランチ（`tree: 'nbr'`）で枝が 4 本以上**: 幅に収めるために折り返す・狭めると、`cause-crossing` / `cause-parallel` が出ることがある。`dir: 'right'` で消えることがあるが、横に長くなる（実例の tax-ai ch12 は 1576px。合成の図では、既定より 0.9〜1.3 倍の幅で、一定しない）。自動では切り替えない（測った結果は ADR 0037）。

## sourceLine（出典行・図の読み方の注）の言い回し: 読む向きは図の種類で決まる

`sourceLine` に「左が…、右が…」と書く前に、**その図をどの向きに読むか**を確かめる。向きを取り違えた文は、本文と図が食い違って見える。

| 図 | 読む向き | 言い回し（例） |
|---|---|---|
| 現状・未来現実・移行・ネガティブブランチ・前提条件ツリー（`causeTree` の既定 `dir: 'up'`） | **下から上**。下が原因（根本原因・施策・行動）、上が結果（UDE・望む結果・目標） | 「矢印は下の原因から上の結果へ」「いちばん下が根本原因、上が好ましくない現象」。**「左が原因、右が結果」とは書かない**（枝の並びは因果の順ではない） |
| `dir: 'right'` | 左から右。左が原因、右が結果 | 「矢印は左の原因から右の結果へ」 |
| `dir: 'down'` | 上から下。上が原因、下が結果 | 「上の原因から下の結果へ」 |
| `dir: 'left'` | 右から左 | 「右の原因から左の結果へ」 |
| `whyWhyTree` | 上から下。上が問題、下へ「なぜ 1、なぜ 2…」で、いちばん下が真因 | 「上が問題、下へ向けて『なぜ』を重ねる」 |
| `faultTree` | 上から下に展開。頂上事象が上、下が原因（葉が基本事象）。確率は下から上へ集まる | 「頂上事象を上に、原因を下に展開」 |
| `bowtie` | 左から右。左が脅威と予防バリア、中央が頂上事象、右が低減バリアと結果 | 「左の脅威から、中央の頂上事象を経て、右の結果へ」 |
| `cloud` | 左から右。左の共通目的 A から、必要条件 B/C、対立する要望 D/D' へ | 「左の共通目的から、右の要望へ」 |

- 並びの左右（同じ段の箱の位置）は意味を持たない。「左の枝」「右の枝」は、読み手が図で指せるように、枝の中身（「採用の枝」）で呼ぶ。

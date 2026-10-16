# 意味付き表・意味付きネットワーク
（svg-diagram の入口は `../SKILL.md`）


表のセルが業務上の意味を持つなら、生の `table()` より専用部品を使う。入力検査、集計、非色覚依存の文字・記号が付く。

| 図 | 部品 | 要点 |
|---|---|---|
| RACI 責任分担表 | `raci(tasks, roles, assignments)` | `R/A/C/I` と `A/R`。各タスクは A が 1、R が 1 以上。例外は `allowNoA`。空の役割列は check が警告 |
| FMEA | `fmea(rows, {sort: 'rpn'})` | S/O/D は 1〜10。RPN は自動。`after: {s,o,d}` で改善後、`threshold` / `midThreshold` で段階 |
| KT 法の IS/IS NOT 表 | `isIsNot(rows)` | `rows: {dim, is, isNot, distinct?, change?}[]`。`dim` は `'what'`（何に）/ `'where'` / `'when'` / `'extent'` か自分の見出し。**違い**（`distinct`）と**変化**（`change`）は別の列。IS NOT は「そうであってもおかしくないのに、そうでない」比較対象 |
| 仮説の検定（IS/IS NOT の続き） | `isIsNotTests(rows, hypotheses)` | `hypotheses: {text, results, assumes?}[]`。`results` はスペックの行ごとに `'yes'` / `'ifAssumed'`（`assumes` に仮定）/ `'no'`。説明できない行が 0 の仮説は太字、仮定が最少のものに「最少の仮定」（図は原因を選ばない）。`◎○△×` は使わない |
| なぜなぜ分析（表） | `whyWhyTable(problem, chains)` | `chains: {whys: string[], trueCause?, measure?}[]`（1 鎖 = 1 行）。列は 問題 \| なぜ 1…N \| 真因 \| 対策。同じ原因は行ごとに繰り返す。木で描くなら `whyWhyTree`（`references/toc.md`） |
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

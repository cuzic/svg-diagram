# QC 七つ道具・新 QC 七つ道具
（svg-diagram の入口は `../SKILL.md`）


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

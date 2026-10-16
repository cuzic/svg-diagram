# コンサル系のチャート
（svg-diagram の入口は `../SKILL.md`）


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

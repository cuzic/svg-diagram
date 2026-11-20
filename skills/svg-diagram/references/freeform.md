# 箱と線で描く図（freeform）
（svg-diagram の入口は `../SKILL.md`）

型の決まった部品（`versus`・`chevron`・`quadrant` など）に合わない図は、`row` / `group` / `box` / `connect` / `branch` で組む。左右の対比が言いたいことでないのに `versus` を選ばない。書き方の全部は README の「部品」表。

## 並べ方

| したいこと | 書き方 |
|---|---|
| 横に並べる | `row([a, b, c])`。幅は `flex`（既定 1）で分ける。固定幅は `justify: 'center'` と `width` |
| 行をまたいで列をそろえる | どの行も `row([...], {cols: 12, gap})` にして、子に `span`（何列分）と `col`（何列目から。1 始まり）を書く。同じ `cols` / `gap` の行は列の端が同じになる。設定は `const g = {cols: 12, gap: 56} as const` にまとめて使い回す |
| 等分 | `row([a, b, c], {cols: 12})`（子に `span` を書かなければ 4+4+4）。`cols: [3, 6, 3]` は子ごとの `span` を行に書く形 |
| 先頭を空ける | 2 行目の最初の子に `col: 4`。`span` / `col` は **`cols` のある行だけ**で効く（無いと throw） |
| 箱をまとめる | `group([...], {title, tone})`。枠ごと `row` に並べられ、`span` / `col` / `flex` は group に書く |
| 枠なしでまとめる | `group([...], {frame: false})`。`caption` / `table` などを `row` に置くと、これに自動で包まれる |
| 縦の位置 | 枠付きの group は、row で高さがそろうと中身が縦中央に寄る（`valign: 'top'` で上詰め、`'stretch'` で箱 1 つが余りを埋める）。枠なしの group は既定が上詰めで、`valign` を書いたときだけ動く。`row` に直接置いた `box` は行の高さに伸びる |
| 列に見出し | 最初の行を、見出しを枠なしの group で包んだ row にする: `group([caption(text, {bold: true, tone: 'text'})], {frame: false, span: 3})`（`caption` 自体は `span` を持たない） |

## つなぎ方

- 参照は `'id:side'`（side は `left` / `right` / `top` / `bottom` / `center`）。group の `id` も、group の中の箱の `id` も参照先になる。
- `connect('a:right', 'b:left')` は、高さが違っても、水平に引ける所があれば水平に引く: 片方の辺の真ん中がもう片方の箱の高さの中にあれば、その高さで引く。そうでなく、2 つの高さの重なりが十分にあれば、重なりの真ん中で引く。どちらでもなければ、それぞれの辺の真ん中を結ぶ（斜め）。`branch()` の線は元の端を動かさない（扇の根元は 1 点のまま）。端の位置を決めたいときは `'a:right@0.3'`（`@` を書いた端は動かさない）。
- 1 つから複数へ扇形に出す線は `branch('memo:right', [{to: 'c1:left'}, {to: 'c2:left', label: '…'}])`。既定は `route: 'elbow'`。`connect` を同じ元から何本も書かない。
- 折れ線は `route: 'elbow'`、`bend: 'auto'` で他の箱を横切らない曲がり位置を選ぶ。戻りの線は `loop-under`（下を回る）と `loop-side`（同じ側の外を回る）。
- ラベルは `label`、線の上に載せるなら `chip: true`。隣り合う箱を結ぶ、ラベル付きの直線（`route: 'straight'`）の矢印だけは、列の間（`gap`）を自動で広げて入れようとする。`elbow` や `branch()` の線、間に空いた列がある線は広げない。広げても足りないこともある（`connect-label-covers-arrow` で止まる）。そのときは `row([...], {gap: 56})` のように `gap` を大きく書く。行と行の間の縦の矢印は `diagram({gap})` で空ける。

## よくある形

```ts
// 左の枠 → 真ん中の 1 つ → 右の 3 つへ扇形
const g = {cols: 12, gap: 64} as const;
d.add(
  row([
    group([box({title: '手引き'}), box({title: 'ルール'}), box({title: '制約'})], {id: 'head', title: '頭の中', span: 4}),
    group([box({id: 'memo', title: '決定メモ'})], {frame: false, valign: 'center', span: 4}),
    group([box({id: 'c1', title: '今の会話'}), box({id: 'c2', title: '新しい会話'}), box({id: 'c3', title: '別の人'})], {title: '同じ前提', tone: 'accent', span: 4}),
  ], g),
  connect('head:right', 'memo:left'),
  branch('memo:right', [{to: 'c1:left'}, {to: 'c2:left'}, {to: 'c3:left'}]),
);
```

```ts
// 列のそろった 2 行（2 行目は 4 列目から）。横の矢印は各行の中で引く
const g = {cols: 12, gap: 56} as const;
d.add(
  row([box({id: 'm', title: 'M2', span: 3}), box({id: 'r2', title: 'R2', span: 3}), box({id: 's3', title: 'S3', span: 3})], g),
  row([box({id: 'r1', title: 'R1', span: 3, col: 4}), box({id: 's1', title: 'S1', span: 3})], g),
  connect('m:right', 'r2:left'), connect('r2:right', 's3:left'), connect('r1:right', 's1:left', {tone: 'muted'}),
);
```

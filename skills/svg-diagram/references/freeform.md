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
- ラベルは `label`、線の上に載せるなら `chip: true`。間隔は次の節。

## ラベル付きの矢印の間隔は自動で広がる。広がらない場合

ラベル付きの直線（`route: 'straight'`、既定）の矢印は、ラベルが端の箱に重ならず、矢印の向きが読める長さまで、間隔を自動で広げる。`gap` を大きく書かなくてよい。

- **横**: `connect('a:right', 'b:left')` で隣り合う子を結ぶと、row の `gap` が広がる。`cols` の row では、間に空いた列があっても広がり、同じ `cols` と `gap` の行すべてがそろって広がる（列の端はそろったまま）。
- **縦**: `connect('a:bottom', 'b:top')` で、続く 2 つの帯（箱、row、group など。間の `connect` は数えない）を結ぶと、その 2 つの帯の間が広がる。group の中の箱どうしも同じ。`diagram({gap: 56})` と書かなくてよい。
- 要る長さは、ラベルの幅（縦の線では高さ）、`chip` の有無、`labelAt` で決まる。`labelAt: 0.3` のように端に寄せると、近い方の端の箱に重ならないよう長く要る。
- 今の間隔で足りていれば変えない。

**広がらない場合**（`check` / `build` が「overlaps its own end」のエラーか `connect-label-covers-arrow` の警告で知らせ、文言に要る間隔「N px」を書く）:

- 広げると子が細くなりすぎる row: `cols` の row で子が元の幅の 7 割を切る、`cols` のない row で子が 80px を切る。ラベルを短くする、子を減らす、図の幅を広げる。
- `justify: 'center'` / `'start'` の row（固定幅の子）。`gap` を要る間隔以上に書く。
- `route: 'elbow'` と `branch()` の線、辺を書かない `connect('a', 'b')`。辺を書いて直線にするか、`gap` を書く。
- 縦で、2 つの帯の間に高さのある帯（`spacer` など）がある線、隣り合わない子を結ぶ横の線（間の子を線が横切る）。
- `image({over})` の上に置いた部品どうしの縦の線（絵の高さは変わらない）。tree・flowchart などの項目につなぐ線。

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

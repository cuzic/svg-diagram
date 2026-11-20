# 箱と線で描く図（freeform）
（svg-diagram の入口は `../SKILL.md`）

型の決まった部品（`versus`・`chevron`・`quadrant` など）に合わない図は、`row` / `areas` / `group` / `box` / `connect` / `branch` で組む。左右の対比が言いたいことでないのに `versus` を選ばない。書き方の全部は README の「部品」表。

## 並べ方

| したいこと | 書き方 |
|---|---|
| 横に並べる | `row([a, b, c])`。幅は `flex`（既定 1）で分ける。固定幅は `justify: 'center'` と `width` |
| 行をまたいで列をそろえる | `areas` で名前の領域を書く（下の「行をまたいでそろえる: `areas`」）。`row` で書くなら、どの行も `row([...], {cols: 12, gap})` にして、子に `span`（何列分）と `col`（何列目から。1 始まり）を書く。同じ `cols` / `gap` の行は列の端が同じになる。設定は `const g = {cols: 12, gap: 56} as const` にまとめて使い回す |
| 等分 | `row([a, b, c], {cols: 12})`（子に `span` を書かなければ 4+4+4）。`cols: [3, 6, 3]` は子ごとの `span` を行に書く形 |
| 先頭を空ける | 2 行目の最初の子に `col: 4`。`span` / `col` は **`cols` のある行だけ**で効く（無いと throw） |
| 箱をまとめる | `group([...], {title, tone})`。枠ごと `row` に並べられ、`span` / `col` / `flex` は group に書く |
| 枠なしでまとめる | `group([...], {frame: false})`。`caption` / `table` などを `row` に置くと、これに自動で包まれる |
| 縦の位置 | 枠付きの group は、row で高さがそろうと中身が縦中央に寄る（`valign: 'top'` で上詰め、`'stretch'` で箱 1 つが余りを埋める）。枠なしの group は既定が上詰めで、`valign` を書いたときだけ動く。`row` に直接置いた `box` は行の高さに伸びる |
| 列に見出し | 最初の行を、見出しを枠なしの group で包んだ row にする: `group([caption(text, {bold: true, tone: 'text'})], {frame: false, span: 3})`（`caption` 自体は `span` を持たない） |

## 行をまたいでそろえる: `areas`

行をまたいで列をそろえる図、行をまたぐ枠がある図は、`areas(template, cells, opts)` で書く。CSS の `grid-template-areas` と同じ書き方。

- テンプレートは 1 行が 1 段。セルは半角の空白で区切る。`.` 1 文字が空きのセル（`..` は誤り）。全角の空白は誤り（行と桁を示して止まる）。
- 同じ名前を並べると、その範囲が 1 つの領域になる（長方形だけ。L 字は誤り）。行をまたいでもよい。
- `cells` は名前 → 中身。中身は `box`（`stat` も箱）、`group`、または `caption` / `table` など（枠なしの `group` に自動で包まれる）。`row` / `grid` / `areas` は `group` に入れてから置く。
- 名前がそのまま中身の `id` になる。`connect('memo:right', 'c1:left')` のように書ける。中身に名前と違う `id` を書くと誤り。`table({id: 'a'})` のように包まれる中身が名前と同じ `id` を持つと、矢印の端はセルではなく表そのものの大きさになる。
- `areas({id})` は `connect` の端にできるが、`diagram({spotlight})` では指せない（中の領域の名前を指す）。
- 列の幅は `cols: [4, 3, 4]` の比（既定は等分）。行の高さは中身で決まる。`gap`（列の間、既定 16）と `rowGap`（行の間、既定は `gap`）。
- 中身に `span` / `col` / `flex` / `width` は書かない（書くと throw）。位置と幅はテンプレートが決める。
- `.` だけの列は余白になる（`cols: [4, 1, 4]` の真ん中）。`.` だけの行は誤り（高さが 0 になるので、行の間は `rowGap` で空ける）。
- `box` はセルの高さに伸びる。`group` の枠もセルの高さに伸び、中身は `row` のときと同じ決まりで寄る（枠付きは縦中央、枠なしは上。`valign` で変える）。
- 領域の幅が 96px より狭くなると止まる。
- `row([areas(…)])` は誤り。横に並べたいものは、同じ `areas` の列にする。
- 領域の間のラベル付きの直線の矢印は、row と同じく間隔を自動で広げる（下の「ラベル付きの矢印の間隔は自動で広がる」）。横に並ぶ領域（間の列が `.` だけでもよい）なら `gap`、上下に並ぶ領域なら `rowGap` が広がる。間隔は areas 全体で 1 つなので、1 本の矢印で全体が広がる。間に中身のある領域をはさむ 2 つは広げない。

```ts
// 見出し・変わる系列・変わらない系列の 3 段が同じ列に乗る（2 段目の先頭の空きは . 1 つ。span / col の足し算をしない）
const head = (text: string) => caption(text, {bold: true, tone: 'text'});
d.add(
  areas(`
    hm  hr  hs  ht
    m   r2  s3  t3
    .   r1  s1  t1
  `, {
    hm: head('決定メモ'), hr: head('要件'), hs: head('シナリオ'), ht: head('テスト'),
    m: box({title: 'M2 有効期限', body: '3か月 → 6か月に変更', tone: 'solid'}),
    r2: box({title: 'R2 有効期限を確かめる', tone: 'accent'}), s3: box({title: 'S3 境界', tone: 'accent'}), t3: box({title: 'T3 先に直す', tone: 'accent'}),
    r1: box({title: 'R1 添付書類と照合', tone: 'muted'}), s1: box({title: 'S1・S2', tone: 'muted'}), t1: box({title: 'T1・T2 そのまま', tone: 'muted'}),
  }, {gap: 56, rowGap: 24}),
  connect('m:right', 'r2:left'), connect('r2:right', 's3:left'), connect('s3:right', 't3:left'),
  connect('r1:right', 's1:left', {tone: 'muted'}), connect('s1:right', 't1:left', {tone: 'muted'}),
);
```

```ts
// 左の枠 → 真ん中 → 右の 3 つへ扇形。列の幅は cols の比で、子に span を書かない
d.add(
  areas('head memo convs', {
    head: group([box({title: '提出先の手引き'}), box({title: '社内ルール'}), box({title: '環境の制約'})], {title: '担当者の頭の中'}),
    memo: group([box({title: '決定メモ', body: '1枚に書き出す', tone: 'solid'})], {title: '書き出す先'}),
    convs: group([box({id: 'c1', title: '今の会話'}), box({id: 'c2', title: '新しい会話'}), box({id: 'c3', title: '別の人・別のAI'})], {title: '同じ前提で始まる', tone: 'accent'}),
  }, {cols: [4, 3, 4], gap: 64}),
  connect('head:right', 'memo:left'),
  branch('memo:right', [{to: 'c1:left'}, {to: 'c2:left'}, {to: 'c3:left'}]),
);
```

全体は `examples/areas-trace.ts` と `examples/areas-memo.ts`。

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
- `areas` では、横に並ぶ領域を結ぶと `gap` が、上下に並ぶ領域を結ぶと `rowGap` が広がる（`rowGap: 56` と書かなくてよい）。
- 今の間隔で足りていれば変えない。

**広がらない場合**（`check` / `build` が「overlaps its own end」のエラーか `connect-label-covers-arrow` の警告で知らせ、文言に要る間隔「N px」を書く）:

- 広げると子が細くなりすぎる row: `cols` の row で子が元の幅の 7 割を切る、`cols` のない row で子が 80px を切る。`areas` で領域が元の幅の 7 割（か 96px）を切る。ラベルを短くする、子を減らす、図の幅を広げる。
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

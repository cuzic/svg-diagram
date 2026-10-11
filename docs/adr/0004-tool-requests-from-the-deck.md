# ADR 0004: 資料づくりで見つかったツール側の改善要望(bars / spotlight / reveal / plane / table / 色 / 文字サイズ)

- 状態: 提案(実装前)
- 日付: 2026-10-11
- 基点: `main`(ADR 0002 の実装後)
- 関連: ADR 0002(量・強調の部品)、ADR 0003(部分強調)

## 背景

ADR 0002 の部品(`bars()` / `stat()` / `spotlight` / `reveal` など)を実際の資料づくりに使ったところ、次の 8 件がツール側の制約として見つかった。ハードルの高さと階段は「ラベルなしの棒」で作れず、HTML のままになった。要望をそのまま受け、現状をコードで確かめたうえで、対応案と未決点を整理する。

| # | 要望 | 要約 |
|---|---|---|
| 1 | bars: 値ラベル・目盛り・格子を消せない | ハードルの高さと階段を作れず、迫力が出ない |
| 2 | bars: 棒の高さの下限が大きい(145px) | 短い棒を並べられない |
| 3 | spotlight が bars に直接効かない | group で包む必要がある |
| 4 | reveal が stat / plane の点 / versus() の group に付けられない | |
| 5 | plane: 折れ線を滑らかにできない | |
| 6 | 表に「行ラベル用の列」がない | 左端のラベル |
| 7 | 色のトーンが少ない | 主役の濃い青・次点の青・薄い青を使い分けにくい |
| 8 | 文字の最小 14px がスライドの主役の絵には小さい | `display` は stat 専用 |

## 既存コードで確認した事実

- **bars の高さ(#1, #2)**: 縦棒の高さは既定 280、`height` で指定でき、`layoutVertical`(`lib/bars.ts:90-95`)は「プロット領域(`plotB - plotT`)が 80px 未満なら throw」。プロット領域は図の高さから上の余白(`ROLES.note + 8`)と下の余白(`ROLES.note * 1.4 + 14`)を引いたもので、**図の最小高さがおよそ 145px**。この下限は、目盛りと値ラベルのために確保する余白と 80px の固定最小値の和で決まる。横棒は `needH` を行数から導き、`height` が足りなければ throw。目盛り(`ticks`)・格子・値ラベルは常に出す(`BarsOpts` に出し分けの指定がない: `types.ts:560` は `max / unit / dir / stack / height` だけ)。
- **spotlight(#3)**: 主役の判定(`lib/spotlight.ts:20-40`)は、band の `id` が対象に含まれるか、row の `id#N` の列かを見る。`BarsOpts` に **`id` が無い**(`bars()` は band の id を受け取らない)ので、bars band そのものを対象にできない。bars の**各棒**には `id` を付けられ、`spotlight.ts` は `b.anchors` を引くので、個々の棒は対象にできる。
- **reveal(#4)**: `RevealOpts = {reveal?: number}`(`types.ts:175`)は `PlaneOpts`、`BarDatum`、`table`、`group`、`connect`、`box` の chrome などが継承している。**付けられないもの**: `StatOpts`(`types.ts:260` は `Pick<BoxChrome, 'id' | 'flex' | 'width' | 'col' | 'span'>` で `reveal` を拾っていない)、`PlanePoint`(`types.ts:510` は個々の点に `reveal` を持たない。`PlaneOpts` 全体にだけ付く)、`VersusPart`(`lib/versus.ts`。`versus()` が作る group に `reveal` を渡す口がない)。
- **plane(#5)**: `PlaneLine`(`types.ts:521`)は `from` と `to` の 2 点をつなぐ直線(`dashed` / `arrow` / `tone`)だけ。折れ線は複数の `PlaneLine` を並べて作る。曲線・平滑化の指定はない。
- **table(#6)**: `TableColumn`(`types.ts:644`)は `label / flex / mono / bold / align`。行(`TableRow`)の左端を「行ラベル」として見出し行と同じ扱い(塗り・太字)にする指定はない。1 列目に `bold` を付けることはできるが、見出し行と同じ塗りにはならない。
- **色(#7)**: 色は `PALETTE`(`lib/tokens.ts`)の固定値で、`ALLOWED_COLORS`(lint の off-token-color の許可集合)は `bg / text / muted / border / code / danger` と、**テーマごとの `accent` と `soft` の 2 色**だけ。主役(濃い青)=`accent`、薄い青=`soft` はあるが、**中間の青がない**。`BoxTone` は `plain / accent / new / changed / removed / muted / danger`、`TextTone` は `text / accent / muted / danger` の 4 つだけ。
- **文字サイズ(#8)**: ロール表 `ROLES`(`tokens.ts`)は `title 15 / label 14 / body 14 / note 14 / banner 16 / stat 34 / display 56 / hero 18`。`display`(56)は ADR 0002 で足した大きいロールで、`stat()` から使える。`BoxLine` は `role` を持つので `box({lines: [{text, role: 'display'}]})` なら使える。`box({size})`(`types.ts:252`)も 14〜72 の任意整数を受け付ける(`strict.ts:150`)。`caption` の `role`、`banner` の見出し(固定 `ROLES.banner`)、表、`bars` / `plane` のラベルは大きくできない。

## 決定案

### 1. bars: 値ラベル・目盛り・格子の出し分け(#1)

`BarsOpts` に次を足す。既定はすべて現状どおり(出力は変わらない)。

```ts
bars(data, {labels: false, axis: false, grid: false})
```

- `labels: false`: 値ラベル(棒の内外)を出さない。ラベルを出さないので、「値ラベルの内外判定」「ラベル矩形の検査」も走らない。棒そのもののラベル(`BarDatum.label`、行ラベルやカテゴリ)は残す。
- `axis: false`: 目盛りの数値と目盛り線を出さない。軸の基線は `baseline: false` で別に消せるようにするかは未決(まず `axis: false` で目盛り・基線の両方を消す案)。
- `grid: false`: 横棒・縦棒の補助線(目盛りに沿った格子)だけを消す。`axis` が残っていれば目盛りの数値は出る。
- `labels: false` かつ `axis: false` の棒は「値が見えない形」になる。意味が値にしかない場合に備え、`aria` / `<title>` に値を残す(スクリーンリーダー用。画面には出さない)。**ラベルなしの棒だけで量を伝える図は、値を別の箇所に書く運用を README に書く**(色や長さだけに頼らない原則)。
- ハードルの高さ・階段は、`dir: 'v'` + `labels: false` + `axis: false` + `grid: false` + 各棒に値で作れる(高さが値に比例する)。

### 2. bars: 図の最小高さを下げる(#2)

- 最小の 145px は、`axis` / `labels` が有効なときの余白(目盛りラベル + 値ラベル)に由来する。`axis: false` / `labels: false` のとき、**その余白を取らず**、プロット領域の最小値も 80px から下げる(目安: 20px。棒が 1px 以下にならない範囲は検査で throw)。
- `axis` / `labels` が有効なときの下限は変えない(既存の出力と検査を守る)。
- 短い棒を横に並べる用途(ハードル)では、`height: 60` のような小さい図が書けること、が受け入れ条件。
- 未決: 小さい図での棒の幅の上限(今は縦棒 64px・積み上げ 72px)。ハードルのように棒が太い図のために `barW` を足すか。

### 3. spotlight: bars band を対象にする(#3)

- `BarsOpts` に `id?: string` を足し、`bars()` の戻り値が band の id(ハンドル)を持つ。`spotlight: 'chart'` で bars 全体を主役にできる(子孫=各棒も主役)。既存の「各棒の id を対象にする」経路は残す。
- 同じ要領で、**`id` を受けない band**(plane / table / sequence / swimlane など)を洗い出し、`id` を持つべきものには足す。`spotlight` が「id を付けた band」にだけ効く、という規則を README に 1 行で書き、id を受けない band を `spotlight` の対象に指定したら throw(今は黙って効かない)。

### 4. reveal: 付けられないものに付ける(#4)

- `StatOpts` が `RevealOpts` を継承する(`stat({reveal})`)。実装は stat が返す box に `reveal` を渡すだけ。
- `PlanePoint` に `reveal`、`PlaneLine`・`PlaneDim`・`PlaneLabel` にも `reveal`(plane の描画は layout で全段階分の座標を 1 回で決めているので、要素ごとの表示だけを段階で切る)。点に付けたら、その点を端点にする `PlaneLine` / `PlaneDim` は、既定で端点の max を継承する(connect と同じ規則)。
- `VersusPart` に `reveal` を足し、`versus()` が作る左右の group に渡す。共通部(`shared`)にも同様。`versus()` の `connectLabels` の接続線は、両端の max を継承する(既存の connect の規則)。
- **reveal を受けられる要素の一覧**を README に表で書く(受けられない・受けるが継承するもの)。付けられない band に `reveal` を書くと throw する(今は黙って効かないものが残っていないか確認する)。

### 5. plane: 折れ線の平滑化(#5)

- `PlaneLine` を 2 点の直線のままにし、**複数点を通る線**を別の部品 `PlanePath` として足す: `paths: [{through: [refs…], smooth?: boolean | number, dashed?, tone?, arrow?, reveal?}]`。
- `smooth: true` は Catmull-Rom を 3 次ベジェに変換した滑らかな曲線(張力は既定 0.5。数値で調整可)。端点は通る点そのもの(点を通らない近似にしない)。`smooth` なしは折れ線(今の複数 `PlaneLine` と同じ見た目)。
- 曲線が軸の外・他のラベルに被らないかは、既存の plane の検査(`checkPlanes`)に曲線の制御点の範囲を載せる(滑らかにしても座標範囲を超えないよう、制御点を軸範囲にクランプ)。
- `PlaneLine` の複数個で折れ線を作っている既存の図は変えない。

### 6. table: 行ラベル用の列(#6)

- `table(columns, rows, {rowHeader: true})`: **左端の列を行見出しとして扱う**。見出し行と同じ塗り(`soft`)・太字・縦中央、本文の行と色で区別する。見出し行(最上段)と行ラベル列が交わるセル(左上)は、見出し行の扱い(`columns[0].label`)に従う。
- 行ごとの tone と併用できる(行全体の塗りは行ラベルのセルにも反映し、`soft` は `rowHeader` のセルだけで使う)。
- `rowHeader` の列の幅は、`TableColumn.flex` で他の列と同じように決める。
- 受け入れ条件: 3 層の表(`cellH` / `dense` と併用)で、左端が行ラベルとして読めること。

### 7. 色: 3 段階の青を使い分ける(#7)

現状は `accent`(濃い)と `soft`(薄い)の 2 段階で、「次点の青」がない。

- 各テーマに **`mid`**(中間の青)を足す: `PALETTE[theme].mid`。値は `accent` と `soft` の間で、**白地で非テキストの 3:1 以上、`soft` の上でも 3:1 以上**になる色(実装時に計算して決め、検証する)。`ALLOWED_COLORS` に追加し、lint の off-token-color を通す。
- トーンの追加: `BoxTone` に **`secondary`**(`fill: 'bg'`、`stroke: 'mid'`、`text: 'text'`、`ink: 'mid'`)と、ソリッド版 `solid-secondary`(`fill: 'mid'`、文字は白)を足す。`TextTone` には足さない(中間色の文字は白地で 4.5:1 を満たさない可能性が高く、文字は `accent` / `text` / `muted` / `danger` のまま)。`bars` の系列は `a / b / c` に `mid` を割り当てる案(現状: a=accent、b=text、c=muted)を検討し、既存の出力を変えないために **既存の系列の色は変えず、新しい系列 `d` を足す**。
- **凡例**: 新しいトーンは `DEFAULT_LEGEND_LABELS`(`rules.ts`)にラベルを足す(「準主役」など。実装時に決める)。意味を持たせるので、`legend: 'auto'` と `legend-missing` の対象になる。
- 既存の図は変わらない(新しいトーン・色を使った図だけが出力に現れる)。
- 未決: 値の選び方(各テーマの `accent` から明度を上げた色を機械的に作るか、手で選ぶか)。`blue` テーマを最優先で決め、`teal` / `amber` は同じ規則で。

### 8. 文字: スライドの主役の絵に大きい文字(#8)

- `display`(56)は `stat()` と `box({lines: [{role: 'display'}]})` で使える。**他の文字の入口に同じロールを開く**: `caption({role: 'display'})`、`banner({size: 'display'})`(見出しだけ)、`bars` / `plane` の軸ラベル・値ラベルのスケール `labelScale`(1〜2。ロールの 14px を 1.5 倍、2 倍にする。最小 14px の保証はそのまま「下限」で、上は広げる)。
- `hero`(18)は `Role` 型にあるが未使用で、`display` と紛らわしい。**`hero` を削除する**(使われていない。型 `Role` から外す)。他に使っていたら残す。
- `box({size})` の任意整数(14〜72)は、ロール表の外の抜け道として残っている(ADR 0002 で指摘済み)。`display` の入口を増やしたうえで、**`size` は非推奨にして warn を出す**ことを検討する(削除は別の判断)。
- スライドで文字が縮小される問題: `fit.ts` の `minEffectiveFont`(既定 12)は縮小後の実効サイズを見る。`display` の絵が縮小される場合は実効サイズが十分大きいので影響しない。
- 未決: 文字を大きくした分、箱の高さ・折り返しが変わる。row の高さ揃えへの影響は既存の仕組みで吸収されるはずだが、実際の資料の図で確かめる。

## 検討した代替案

| 案 | 判断 |
|---|---|
| bars の最小高さを `height` の指定で常に下げる(余白はそのまま) | 余白が残るので、ラベルなしの短い棒が小さく見える。ラベル・軸を出さないときに余白を取らないほうが目的に合う |
| spotlight を「id のない band」にも効かせる(暗黙の id) | どの band が対象か分かりにくくなる。id を受ける band を増やし、受けない band を指定したら throw |
| reveal を全 band に自動で付ける | 付けられるもの・継承するものの規則が曖昧になる。受け皿を明示して、付けられないものは throw |
| plane の `PlaneLine` に `smooth` を足す | 2 点の線に平滑化は意味がない。複数点を通る別部品が素直 |
| table の 1 列目に `bold` を付ける(今でも可能) | 行ラベルの塗り・縦中央・見出し行との区別が付かない。専用の指定を足す |
| 色を無制限にする(任意の `#rrggbb`) | off-token-color の lint が落とす。トークンに中間色を 1 つ足すだけで足りる |
| 文字を任意 px にする | 14px の下限と lint の保証が崩れる。ロールを広げる |

## 実装順と受け入れ条件

1. **bars の出し分け(#1)と最小高さ(#2)**: 最も具体的な要望。ハードルと階段が bars で作れること。
2. **reveal の受け皿(#4)**、**spotlight の bars 対象(#3)**: 小さな追加。付けられないものを throw にする。
3. **table の行ラベル列(#6)**。
4. **plane の平滑化(#5)**。
5. **色(#7)**: `mid` の値を決めて検証してから(影響範囲は lint・凡例・既存の bars 系列)。
6. **文字(#8)**: `display` の入口、`hero` の削除、`size` の非推奨。

どの段階でも `pnpm test` / `pnpm typecheck` / `pnpm golden` を通し、**新しい指定を使わない図の出力は 1 バイトも変えない**。各項目に `examples/` の図を足す。bars の「ラベルなし・目盛りなし」は、値が別の箇所に書かれていることを examples と README で示す。

## 影響とリスク

- 良い点: 実際の資料で HTML のまま残った図(ハードル・階段)が、bars で作れる。reveal / spotlight の「付けられない」が一覧で分かり、黙って効かないものがなくなる。
- リスク:
  - ラベルなし・目盛りなしの bars は量を値で読めないので、意味が色や長さだけになりやすい。値を別の箇所に書く運用と `<title>` への値の保持で補う。
  - 色(#7)は lint・凡例・既存の bars 系列に及ぶ。`mid` のコントラストを誤ると、白地の図が lint で落ちる。
  - `hero` の削除は、型を使うコードを壊す可能性がある(未使用の確認が要る)。
- 未決: `axis: false` と基線の関係、`barW`、`mid` の値、新しいトーンの名前とラベル、`labelScale` の刻み、`size` の非推奨の扱い。

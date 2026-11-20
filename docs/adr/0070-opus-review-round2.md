対象: docs/adr-0070-crt-routing @ c05c05dd

# ADR 0070 レビュー(第 2 巡、Opus)

## 結論(先に)

**第 1 巡の Major 6 件のうち、M1・M2・M3 は解消、M4・M6 はおおむね解消、M5 は方向は正しいが新しい Major を生んだ。** 今回の件数は Blocker 0・Major 2・Minor 6・Nit 2。Major 2 件を直せば承認できる。どちらも ADR の文言の修正で済む。

- 新しい Major:
  - (A) D8 で `AND_END` を伸ばすが、経路の側で「頭の手前の最後の run」の長さを決める定数(22・26、detour の `tail` 26)を一緒に変えていない。U3(D8)が U4(D4)より先なので、その間は弧が描けない AND(`loose`)が出うる。
  - (B) D1 の `keep`「入る辺の無い節のうち precondition でないもの」は、循環を切った後の DAG の入口を含まない。前提条件と循環の両方を持つ CRT では、precondition でない節が動く。
- 範囲の条件 `band.base === undefined && band.layerFrom === undefined` は正しい。`CauseBand` を作るのは `causeBand()` だけで(`lib/dsl/diagrams.ts:256`)、呼び出しは次の 4 つ:
  - `causeTree`(`:214`): どちらも undefined
  - whyWhyTree(`:347-348`): `layerFrom = 'effect'`
  - pdpc(`:471`): `base = 'down'`
  - relationDiagram(`:496`): `base = 'down'`
  
  JSON の spec も `causeTree()`・`whyWhyTree()` を呼ぶだけ(`lib/spec.ts:102`・`:501`)。arrowDiagram は `StatesBand`。同じ判定は既に `lib/toc.ts:306`(`foldable`)で使われている。

## 第 1 巡の Major の確認(コードと照合)

| # | 判定 | 根拠 |
|---|---|---|
| M1 範囲 | 解消 | 上の 4 つの呼び出しで、条件が `causeTree` だけを選ぶことを確かめた。D2 は帯の判別が要る(m4) |
| M2 後段 | 解消 | 次の 3 点を明記した: D11 の `laneShare`/`lastTurn` を吸収する、detour をトラックに合わせる、align・D12〜D14 の採否に `parallelRuns(·, LANE)` を足す。`sharing()`(`lib/layered-route.ts:551`)は `tracks` のとき `laneShare=true` の案を作っても意味が無いので、飛ばすと一言あるとよい(Nit) |
| M3 D3 の単位 | 解消 | AND の組に接する境界だけを `2×portStep` にする。AND の無い頭は不変 |
| M4 倍率 | おおむね解消 | D7 を立て、完了の基準を `minText` との比にした。倍率の下限と経路の定数の配線に穴がある(m1・m2・m3) |
| M5 弧と矢じり | 方向は正しい、新しい Major (A) | 式を確かめた: `s=1` で `AND_PEAK 19・AND_END 25`、見える隙間 6 ≥ 5.6。`s=1.29` で `21・29`、見える隙間 8 ≥ 7.2。弧の切れ目は 56 − 26 = 30 で、8px の検査(`lib/verify-handlers.ts:151`)と `andClashes` には当たらない |
| M6 keep | おおむね解消、新しい Major (B) | 前提条件の無い CRT に `alap` を渡さないので、`toc-compact` はバイト単位で同じ |

## 指摘

### Major

**MA. D8 の `AND_END + 1` を、経路の側の「最後の run」の長さが保証していない。U3 を U4 より先にすると、`loose` が増えうる**
- 根拠: 弧が描ける条件は、最後の run ≥ `AND_END + 1`(`lib/toc.ts:241`)。いまこれは `AND_END = 21` に合わせた定数で守られている。
  - 直接の矢印: 最後の run ≥ 22(`lib/layered-route.ts:246`、`Math.max(gw / 2, gw - 22)`)
  - 長い矢印の `lastTurn`: 26(`:254`、`gr - 26`)
  - 頭へ入る外周の戻り辺: 22(`:209`、`within` の `Math.max(STUB, 22)`)
  - D13 の候補: 22(`:394`)
  - detour の最後の run: `tail = 26`(`lib/route-search.ts:54`)
  
  D8 では、`AND_END + 1` が `s=1` で 26、`s=1.29` で 30 になる。直接の矢印(保証 22)はどちらの倍率でも足りず、`s=1.29` では 26 の 2 つ(`lastTurn` と detour)も足りなくなる。ADR は「D4 で最後の曲がりを `AND_END + 1` 以上に置くので loose は増えない」と書くが、実装計画では U3(D3+D8)が U4b より先で、その間は保証が無い。detour の `tail` は、D4 の説明にも出てこない。
- 直し方: U3 に「AND の頭へ入る矢印の最後の run の下限(上の 22・26 の 5 か所と、`searchRoute` の `tail`)を `AND_END + 1` から求める」を入れる。または、D8 の定数の変更を U4b の後へ移す。どちらにしても「影響」に `lib/route-search.ts` を足す。

**MB. D1 の `keep`「入る辺の無い節」を元の link で数えると、循環を切った後の DAG の入口(precondition でない節)が動く**
- 根拠: `alap` で動く節(movers)は、DAG の先行節で決まる(`lib/graph-layout.ts:374`、`preds.every(p => movers.has(p))`)。循環を切った結果、DAG 上で先行節が無くなった節は、`[].every` が true になるので、`keep` に入っていなければ動く。一方 `keep` は `alapOf`(`lib/toc.ts:223-226`)で、元の link から作る。循環の中の節は link 上では入る辺を持つので、`keep` に入らない。このため、前提条件と負のループの両方を持つ CRT では、循環の切れ目の節(根本原因側のこともある)が上へ動く。これは D1 の「動くのは precondition とその連鎖だけ」と食い違う。
- 直し方: `keep` を補集合で定義する。まず、link の上で「precondition であるか、入る辺が 1 本以上あり、その尾がすべてこの集合に入る節」の集合 M を作る(循環の節は、循環の中の尾が M に入らないので M に入らない)。`keep` は「M の外の全節」にする。U1 のテストに「前提条件 + `back: true` の循環を持つ CRT で、循環の節の層が asap と同じ」を足す。

### Minor

**m1. D7 の倍率に下限が無い。`minText` が 14 未満(10 まで可)だと線が今より詰まる**
- 根拠: `canvasFontScale(10)` は 0.72(`lib/tokens.ts:280`、本文の大きさは 14)。`minText` は 10 まで書ける(`lib/types/core.ts:77`)。このとき `LANE` は 10 になり、D4 が自分で決めた下限(hop の約 10.5px より大きい)を割る。
- 直し方: `s = max(1, canvasGeom(ctx))` と書く。

**m2. D7 の「`space` と掛け合わせる」だけでは、経路の多くの箇所に倍率が届かない**
- 根拠: `layered-route.ts` の経路は、`STUB`・`LANE` を素の定数で 16 か所使っている(`laneIn` が返す `LANE`、`STUB + laneOf`、`within`、`gr - 26` など)。`space` が効くのは `gapFor`・`stubOf`・`laneStepOf` を通る箇所だけで、`density: 'compact'` でも経路のレーンの間隔は 14 のまま。
- 直し方: D7 に「`routeOnce` の中の `STUB`・`LANE`・22・26 は、倍率を掛けた値(1 か所で求める)を使う」と書く。U5 のテストで、間隔 ÷ 文字の大きさが canvas の有無で同じになることは確かめられるので、そのテストを、レーンの間隔が倍率どおりかまで見る形にする。

**m3. D7 は `GAP` を大きくしないので、`minText` が 28 を超えると、層の中の run の間隔 `GAP = 28` が `LANE × s` を下回る**
- 根拠: `s > 2` で `LANE × s > 28`。このとき、完了の基準の `parallelRuns(·, laneStep × s) = 0` が、層の中のダミーの間隔(`lib/graph-layout.ts:445`、`gap`)で破れる。
- 直し方: `gap = max(GAP × space, laneStep × s + 1)` にするか、適用する範囲を `s ≤ 2` に限ると書く。

**m4. D2 の「`causeTree` の帯だけ」は、レイアウトの後の帯からは判別できない**
- 根拠: `LaidOutCause`(`lib/toc.ts:320-323`)には、`base`・`layerFrom` に当たる印が無い。`lib/rules.ts` の規則は `d.laidOut` を読む。
- 直し方: `LaidOutCause` に `origin?: 'pdpc' | 'relation' | 'whywhy'` のような印を足す(`causeTree` のときはキーを付けず、レイアウトの JSON を比べるテストを壊さない。ADR 0028 D7 と同じやり方)。

**m5. U0 の「今の出力のハッシュを固定」は、フォントに依存する**
- 根拠: SVG のバイト列は、文字の幅の測り方で変わる。テスト方針の「フォントに依存する絶対値を使わない」と食い違う。
- 直し方: U0 では golden(`test/helpers/strict-width.ts` を使う `pnpm golden`)の `qc-pdpc`・`qc-relation`・`why-why` の差分 0 を各 PR で示す、の 1 本にする。ハッシュは使わない。

**m6. D8 で弧が頭から遠くなると、hop の省き(`and-arc`)の範囲と、隙間を横切るほかの矢印の run との距離が変わる**
- 根拠: hop は、弧の外接矩形 ±8px の中では飛び越さない(`lib/cause-hop.ts:63-66`)。弧が 25〜29px の深さへ動くので、トラックの水平の run がこの範囲にかかりやすくなる。
- 直し方: D4 のトラックの配置で、頭の手前 `AND_END + 8` の帯に、ほかの頭へ入る矢印の水平の run を置かないと書く。または U3・U4 の PR の hop の内訳(既に計画にある)に `and-arc` を含めると明記する。

### Nit

- n1. D8 の「弧が矢印の軸を横切る位置は、先端から `AND_PEAK`〜`AND_END`」: 弧は 2 次曲線で、端は `reachTo` の分だけ外側の矢印の外にある。外側の矢印との交点は `AND_END` より手前になる。「最小は真ん中で `AND_PEAK`」とだけ書けば足りる。
- n2. M2 の表の注のとおり、`tracks` のとき `sharing()` の `laneShare` の案は作らない、と一言書く。

## 判定

**条件付き承認。** MA・MB を ADR に反映すれば、第 3 巡なしで承認してよい(反映の確認は差分の目視で足りる)。U0・U2 はこのまま着手してよい。U1 は MB を、U3 は MA を反映してから着手する。

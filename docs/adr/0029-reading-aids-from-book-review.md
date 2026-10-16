# ADR 0029: 誤読を防ぐ作図の拡張(技術書 459 枚の目視レビューから。役割の見た目・語を割らない幅・戻り矢印・チャートの軸と範囲)

- 状態: 起票(Opus 1 巡目のレビューを反映した版。再確認待ち)
- 日付: 2026-10-16
- 基点: `main`(53e029a、PR #252 まで)。**依存**: 検査 `text-mid-word-break` / `toc-injection-to-obstacle`(#256)、`loop-under` の案内(#260)は、この ADR の時点で未マージ。D2・D3 の「割れは検査が拾う」は #256 のマージが前提
- 関連: ADR 0010(幅の自動調整)、ADR 0015(TOC 因果ツリー)、ADR 0016(経路)、ADR 0028(飛び越し線)、ADR 0007(核と殻)
- 範囲外: Mermaid の取り込み(`from-mermaid`)。この ADR の実装の後で要るか再判断する

## 背景

技術書(Vol.1 / Vol.2、図 459 枚)を svg-diagram で作り、Opus 16 体が全図を画像として目視レビューした(High 16 / Med 126 / Low 142)。壊れた図はほぼ無く、問題は**誤読**、**検査で止められなかった不整合**、**表現力の不足**に集中した。書籍側から 12 項目の要望が来て、検査と文言の設定は第 1 陣(#256 #257 #259 #260)として出した。この ADR は、設計判断が要る残りを決める。

| 項目 | 要望 | 調べて分かったこと(53e029a。行番号は断りがなければこの版) |
|---|---|---|
| A2 | root / goal / injection が同じ青い二重枠で、取り違えた | `root` / `goal` / `start` は tone も二重枠も**同一定義**(`lib/toc.ts:32,35,39`)で、見た目が完全に同じ。形で区別されているのは `obstacle` / `risk` の六角形だけ。六角形は `legend: 'auto'` なら凡例に出る(書籍側は `legend: false` だった)。`cause` の role は `legend-missing` の対象外 |
| A1b | 施策 → 障害の矢印を自動で `blocks` に | `examples/` に該当する図は 0 本。検査 `toc-injection-to-obstacle`(#256)で足りる |
| A3b | 箱を狭めるとき、最長の語を下限に | 語を割る原因は `wrapStyledAtoms` が「語が 1 行より広いと**文字単位まで一気に**戻す」処理(`lib/wrap.ts:97-104`)。下限を出す `longestUnitWidth`(`:51`)を使うのは `measureNode`(`lib/tree.ts:47-50`)だけで、しかも `bunsetsu` のときだけ(既定の `phrase` では使われない)。`bunsetsu` の下限は、明示した `maxNodeW` にも効く(試行と無関係に `measureNode` の中で効く) |
| C7 | 直線の流れ(steps / chevron / row)の戻る矢印 | **下回りの経路 `route: 'loop-under'` は既にある**(書き方がどこにも無かった。#260 で案内)。複数の戻りの重なり・交差は、verify は止めないが、lint の `edge-crossings`(warn、`lib/rules.ts:341-360`)が既に拾う(再現済み)。足りないのは**文言**(「箱や線の配置・レーンの順を見直す」では何を直すか分からない) |
| C8 | 図の中の複数チャートの軸統一 | waterfall / stacked / tornado / butterfly は軸を固定する opt が無い(`charts-waterfall.ts:72,85,147`、`charts-tornado.ts:50,57`)。手で揃えられるのは `bars` の `max` だけ。`niceScale`(`charts-base.ts:67`)はデータだけから決まる |
| C9 | 範囲(下限〜上限)の浮き棒 | `bars` は値が 1 つで、負の値は throw する(`lib/dsl/bars.ts:47`)。下限と上限を別の棒で描くしかない |

語中改行の再現(causeTree、3 ノード):`dir: 'up', maxNodeW: 110` の phrase では「コンテキス/ト」と割れる。`wrap: 'bunsetsu'` にすると「コンテキストが/足りない」は直るが、「シャドウトラフィッ/ク」は下限があっても割れる(カタカナ + 後ろのひらがなが 1 単位で、キャップを超えると文字単位まで落ちる)。`maxNodeW: 170` や既定では割れない。

## 決定

### D1. 役割タグ `roleTags`(オプトイン)と、見分けのつかない図への案内

- `causeTree(…, {roleTags: true})` が、`root` に「根本原因」、`goal` に「ゴール」、`injection` に「施策」を、箱の `sub` 行に自動で入れる(`foldsInto` / `counts` と同じ手口)。順序は「タグ → 作者の `sub` → `counts`」。文言は `roleTags: {root: '…'}` で差し替えられる。色や形に頼らず**文字**で区別する(白黒印刷でも読める)。タグの文言は `<desc>` にも入り、用語の検査(`termFindings`)の対象になる。test で固定する。
- **既定は off**。`roleTags` を書かなければ SVG は変わらない。
- 凡例: `roleTags` が on のとき、タグで説明される role(root / goal / injection)の見本は凡例から**省く**(二重枠の見本が文言違いで並ぶだけで、かえって混乱するため)。
- **見分けのつかない図への案内(info、新しい規則 ID `toc-role-indistinct`)**: `tree` を書いた `causeTree` が root / goal / start のうち 2 種類以上を含み、`roleTags` が off のとき、`legend: false` でも出す(事故を起こした書籍の図に届くのはこの規則。凡例の info では届かない)。文言は「白黒や凡例なしでは役割を見分けられない。`roleTags: true`」。
- 凡例が無い図への案内(`legend: 'auto'` の推奨)は、別の規則 ID `toc-legend-suggested`(info)にする。`legend-missing`(warn)と同じ ID を info でも出すと、`accept` と RULE_DOCS の意味が二通りになる。`legendRules` の `if (!used.size) return` より前に分岐を置く。
- `examples/toc-*.ts` に `legend: 'auto'` を足す(凡例のバンドが増えるので、5〜7 本の SVG が変わる。PR 本文に挙げる)。
- `goal` の形を変える(スタジアム形など)案は見送る。既定 on にすると 2〜10 本の SVG が変わるため。

### D2. 施策 → 障害の自動 `blocks` は入れない

検査 `toc-injection-to-obstacle`(#256)で足りる。自動化は著者の意図(NBR の injection → ude のように「施策が悪い結果を生む」を描く場合)を壊しうる。`check --fix`(ADR 0015 の改良案。**まだ無い**。将来の話)で書き換えを提案する形にするのが安全。

### D3. 語を割らない: 図単位のオプトイン `keepWords` を本体にする

**変更**(Opus レビューによる): fitLayout の再試行にだけ効く設計(`keepWord` の付け外し)は、`dir` や `maxNodeW` を明示した図に効かない。`dir` を省略して狭められた図には `auto-fit-applied` の warn が出るので、`check --strict` を通そうとする作者は `dir` / `maxNodeW` を書いてそれを消す。消した瞬間に、再試行にだけ効く下限の対象から外れる。#256 の直し方の案内も「dir や maxNodeW を変える」である。したがって:

- `diagram({keepWords: true})` を第 1 段の本体にする。`measureNode` の中で、**試行に関係なく**語の下限を効かせる(今の `bunsetsu` の下限と同じ置き方)。書籍側は 1 行書けば、明示した `maxNodeW` の図も、`dir` を書いた図も直る。既定は off なので、golden は 0 本変わる。
- ADR 0007 の観点から、モジュールの大域変数は増やさない。`wrapMode` のように layout の入口で一度決め、`roles` や `widthOf` と一緒に**引数で**渡す。
- **語の単位はカタカナの連続だけ**。半角の英数字は 1 atom で、`wrapStyledAtoms` が割らずに溢れさせ、`measureNode` の `tw` が箱を広げるので、すでに割れない。全角の英数字は 1 文字ずつの CJK atom で `scriptRun` が `''` のため phrase では連結されない。これを語として守るには `scriptRun` の変更が要り golden が変わるので、**今回はやらない**。漢字の連続は含めない(漢字どうしの途中の改行は日本語では普通)。
- **下限はカタカナの連続だけで測る**(`longestUnitWidth` は今のモードの単位を返し、`bunsetsu` ではカタカナ + ひらがなが単位になって下限が広がりすぎる)。下限の上限(キャップ)は**箱の内側の幅**で `240px`。狭める試行の中で逆転(狭めた試行のほうが 1 回目より広くなる)が起きないよう、`keepWords` の下限には `min(240, その試行の基準幅 − 2·PAD_X)` を使う。
- キャップを超えるカタカナの語は割れたまま残る。**黙って割らない**ための警告は検査 `text-mid-word-break` の責務。レイアウトは警告を出さない(純粋関数のまま)。
- `wrap.ts:97-104` の戻り先を「単位 → カタカナの連続 → 文字」の 2 段にする変更は、`bunsetsu` の既存の出力を変えうるので、**別の PR で golden を確かめてから**入れる。
- 順序(再試行と fold): ADR 0010 D1 の連続性を守る。(a) 下限ありで狭める → 下限なしで狭める(従来の結果)→ fold(下限あり)→ fold(下限なし)。下限なしの系列は、下限ありが全滅したときだけ遅延で回す(causeTree は `layoutCauseBand` が最大 8 回呼ぶので費用に注意)。`keepWords` が off のときはこの経路に入らない。
- `describeApplied` の文言(`maxNodeW を 200→110 に縮めた` と出ても下限が効いた箱は 140px のまま)がずれる。語を守るため一部の箱が広いことを足し、test で固定する。
- **「狭めるときは既定で語を守る」(fitLayout の再試行にだけ効く版)は入れない**。書籍の図の実測(順序の 3)の結果を見て、既定化として後で判断する。
- **第 2 段**(枠が先に決まる `chevron` / `cycle` / `swimlane` の step)は別に扱う。書籍の語中改行の主な事例(`chevron` の横向き 6 段で本文幅が約 110px)はこちら。`tip` を 22→14 にしても +16px でカタカナ 1 字ぶんにしかならない。効く手は (i) 縦向きに替えるよう促す、(ii) その帯の文字を一段小さくする(オプトイン)、(iii) 語が入らないとき throw して直し方を示す。golden を変えずに足せるのは (iii) とオプトインの (ii)。**第 2 段を待たずに、`text-mid-word-break` の文言に chevron 向けの直し方(縦向き、段を減らす)を足す**(安い)。

### D4. 戻り矢印: 文言の改善と、`loopBack` の糖衣

**変更**(Opus レビューによる): 段階 1 を「新しい verify」にしない。重なり・交差は lint の `edge-crossings` が既に拾っており、build を止める理由が弱い。ADR 0007 の観点でも、検査は純粋に判定するだけで、段差の自動化(経路の変更)は検査の層の仕事ではない。

- **段階 0(出し済み、#260)**: エラー文言と README に `route: 'loop-under'` を書く。
- **段階 1(文言のみ)**: `edgeStats` が数えた重なり・交差のうち、どちらかが `route: 'loop-under'` の connect なら、専用の文言にする。例:「戻り s#4→s#2 と s#3→s#1 が重なる。片方のスパンをもう片方の内側に収めるか、外側に `dip: 56` を書く」。出力は変わらない。verify には足さない。
- **段階 2**: `steps` / `chevron` / `row` の opt `loopBack: {from, to, label?}` を、展開パスで既存の `loop-under` の `connect` に変換する薄い糖衣にする。**入れ子の段差の自動化は、作者が `dip` を書かない `loopBack` の展開の中だけ**で行う(手書きの `loop-under` の `dip` は変えない)。部分的に重なる 2 本は throw する。展開パスは **reveal より前**(`connect` は端点の reveal を継ぐ、`reveal.ts:51-57`)、展開した `connect` は**帯の直後**に置く(先に宣言した `connect` は `deferred` に回って高さを取らない)。D5 の pass と合わせた順序は `loop-back → reveal → shared-axes → auto-legend`(`test/pipeline.test.ts` の PIPELINE_ORDER を更新)。`outer` レーン(別エンジン用)の流用はしない。

### D5. チャートの軸: `domain` と検査を同じ PR で、共有はその上に

1. 各チャート(waterfall / stacked / tornado / butterfly)に `domain` opt を足す(`bars` の `max` に相当)。
2. 検査 `chart-axis-mismatch` を**同じ PR で**入れる(`domain` が無い warn は、直す手段が `accept` しかなくなるため)。**条件を絞る**: 同じ `row` / `grid` の**兄弟**(横に並べて比べる配置)で、**値の軸が同じ向き**で、同じ `unit` を持つものだけを warn。`unit` が無いチャートは検査しない。それ以外の組は出さない。`examples/chart-waterfall.ts`(`unit: '百万円'` の waterfall 2 つ。量が違う)で出ないことを test で固定する。出口は `accept` と、意図して別軸にする `axisGroup: false`。`bars` は `max` を省くと軸の上端をデータの最大値のまま(丸めない。`lib/dsl/bars.ts:61-62`)ので、`unit` が同じ bars が兄弟にあればほぼ必ず上端がずれる。これも条件(兄弟・同じ向き・同じ unit)に含めて、`max` を書く案内を直し方にする。
3. 共有: チャート側は `axisGroup?: string | false`、図の側は `diagram({sharedAxes: true})`(`scale` は `funnel` / `clustermap` / `boxplot` / `violin` で別の意味に使われているので使わない)。pre-layout の pass(`lib/pipeline.ts`。D4 の順序のとおり)で、`valueExtent(spec)` を各 kind に 1 つずつ置き、layout と rules と pass が**同じ関数**を呼ぶ(式を重複させない)。共有するとき、`bars` の `max` も `niceScale` で切り上げる。入力は複製した後のデータなので、作者の band は汚さない。
4. **約束するのは「同じ domain になる」まで**。プロットの高さ・幅は layout の中で(カテゴリ名の折り返しの計測を含めて)決まる(`charts-waterfall.ts:93-98`、`layout-measure.ts:118`)ので、layout の前の pass では揃えられない。長さが揃わないときは post-layout の info(「軸は共有したが、プロットの高さが 212px と 248px で違う。`height` を揃える」)を出す。そのため `LaidOutChartPart` にプロットの範囲を残す。
5. すべてオプトイン。既存の出力は変わらない。

### D6. 範囲の浮き棒 `range`

- `bars` の datum に `range: [lo, hi]` を足す(`lo ≥ 0` かつ `lo < hi`。**`lo < 0` は throw**。負まで許すと、`bars` の軸の下端を 0 以外にする別の変更になる)。`rangeBars()` はその別名。型は `value` を省ける union にし、`bars<const D>` の `BarIds<D>` の推論が保たれることを `test/types/` で確かめる。
- 内部では `value = hi` と `lo` に正規化しない。**`barSpan(d): {lo, hi}` を 1 つ作り、幾何の計算(`lib/bars.ts` の `valueText`、`hideZero`、`verticalValues`、横の棒と値ラベルの位置、縦の棒、`lib/rules.ts` の desc、`lib/dsl/bars.ts` の全部 0 の検査と extent)は全部これを通す**。直し忘れた読み手が、0 から伸びる棒を黙って描くのを防ぐ。`cumulative` / `stack` と `range` の併用は throw。テストで「range の datum の矩形の始点が、どの向き・どの経路でも `lo` の位置にある」ことを固定する。
- 凡例は自動で出さない(`bars` に凡例の経路が無く、足すと `legend-missing` を広く鳴らす)。値のラベルを `3.2〜5.8万円` にし、`<desc>` も範囲で書く。棒そのものが読み方を説明する。軸の自動範囲に `lo` を含める処理は要らない(`lo ≥ 0` で `lo < hi` なら常に軸の中)。

## 順序と PR の分け方

1. **文言(小)**: `edge-crossings` の `loop-under` 向けの文言(D4 段階 1)と、`text-mid-word-break` の chevron 向けの直し方(D3 第 2 段の安い部分)。#256 の上に載せる。出力は変わらない。
2. **D1**: `roleTags`、`toc-role-indistinct`、`toc-legend-suggested`、凡例の見本の扱い。
3. **実測(コードなし)**: #256 の検査を書籍の 459 枚にかけ、語中改行を「部品 × 幅の決まり方(明示の `maxNodeW` / 狭めた / 枠が固定)」で数える。D3 の第 2 段(chevron)の優先度をこの表で決める。
4. **D3 の `keepWords`**(小〜中)。カタカナだけ。`wrap.ts` の 2 段の戻りは別の PR。
5. **D5**(`domain` と `chart-axis-mismatch` を同じ PR、その後に `sharedAxes`)。
6. **D6**(独立。並行してよい)。
7. **D4 段階 2 `loopBack`**。chevron の対策(D3 第 2 段)は、3 の実測で多ければ 4 の直後に繰り上げる。

PR は項目ごとに分ける。各 PR は `tsc`、全体テスト、`golden`(`check --drift --rebuild`)を通し、出力が変わる図は PR 本文に挙げる。`dsl-exports` の fixture を更新する PR(`roleTags`、`keepWords`、`domain`、`axisGroup`、`sharedAxes`、`rangeBars`、`loopBack`)と、PIPELINE_ORDER を更新する PR(`shared-axes`、`loop-back`)は、PR 本文のチェック項目に入れる。

## 受け入れる代償

- D1 は既定 off なので、書籍側が書かない限り誤読は残る(`toc-role-indistinct` の info と README で促す)。
- D3 は図単位のオプトインなので、書籍側が `keepWords: true` を書くまで直らない。「狭めるときは既定で語を守る」は実測の後に判断する。
- D3 の単位をカタカナだけにしたので、全角英数字と長い英数字の割れは直らない(検査が拾う)。
- D5 は `domain` を足すチャートの型を増やす。長さの完全な一致までは約束しない(post-layout の info で知らせる)。

## 未決(再確認で見てほしい点)

1. D3 の `keepWords` を `diagram()` の opt にするか、帯ごとの opt にするか(推奨: `diagram()`。語中改行は図の読みやすさの問題で、帯ごとに分ける理由が弱い)。
2. D1 の凡例から、タグで説明される role の見本を省く扱いの妥当性。
3. D5-2 の「兄弟」の判定。`row` / `grid` の子のほか、`group` の中の並びを含めるか。

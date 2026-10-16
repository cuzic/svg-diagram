# ADR 0029: 誤読を防ぐ作図の拡張(技術書 459 枚の目視レビューから。役割の見た目・語を割らない幅・戻り矢印・チャートの軸と範囲)

- 状態: 起票(Opus レビュー前)
- 日付: 2026-10-16
- 基点: `main`(53e029a、PR #252 まで)。第 1 陣(検査 4 つ #256、文言の設定 #257、`--docs --fidelity` #259、`loop-under` の案内 #260)は別 PR で出し済み
- 関連: ADR 0010(幅の自動調整)、ADR 0015(TOC 因果ツリー)、ADR 0016(経路)、ADR 0028(飛び越し線)、`docs/adr/0007`(核と殻)
- 範囲外: Mermaid の取り込み(`from-mermaid`)。第 1 陣と第 2 陣の後で要るか再判断する

## 背景

技術書(Vol.1 / Vol.2、図 459 枚)を svg-diagram で作り、Opus 16 体が全図を画像として目視レビューした(High 16 / Med 126 / Low 142)。壊れた図はほぼ無く、問題は**誤読**、**検査で止められなかった不整合**、**表現力の不足**に集中した。書籍側から 12 項目の要望が来て、検査と文言の設定は第 1 陣として出した。この ADR は、設計判断が要る残りを決める。

| 項目 | 要望 | 調べて分かったこと |
|---|---|---|
| A2 | root / goal / injection が同じ青い二重枠で、取り違えた | `root` / `goal` / `start` は tone も二重枠も**同一定義**(`lib/toc.ts:27,29,32`)で、見た目が完全に同じ。形で区別されているのは `obstacle` / `risk` の六角形だけ。六角形は `legend: 'auto'` なら凡例に出る(書籍側は `legend: false` だった)。`cause` の role は `legend-missing` の対象外で、警告も出ない |
| A1b | 施策 → 障害の矢印を自動で `blocks` に | `examples/` に該当する図は 0 本。検査 `toc-injection-to-obstacle`(#256)で足りる |
| A3b | 箱を狭めるとき、最長の語を下限に | 語を割る原因は `wrapStyledAtoms` が「語が 1 行より広いと文字単位に戻す」処理(`lib/wrap.ts:97-104`)。下限を出す `longestUnitWidth` は既にあるが、使うのは `measureNode`(`lib/tree.ts:47-50`)だけで、しかも `bunsetsu` のときだけ。既定の `phrase` では使われない |
| C7 | 直線の流れ(steps / chevron / row)の戻る矢印 | **下回りの経路 `route: 'loop-under'` は既にある**。書き方がどこにも無かった(#260 で案内)。残る穴: 複数の戻りが同じ高さで重なる、`4→2` と `3→1` の交差を検査が止めない |
| C8 | 図の中の複数チャートの軸統一 | waterfall / stacked / tornado / butterfly は軸を固定する opt が無い。手で揃えられるのは `bars` の `max` だけ。作者が直したくても直せない |
| C9 | 範囲(下限〜上限)の浮き棒 | `bars` は値が 1 つ。下限と上限を別の棒で描くしかなく、凡例も無い |

## 決定

### D1. 役割タグ `roleTags`(オプトイン)と凡例の補強

- `causeTree(…, {roleTags: true})` が、`root` に「根本原因」、`goal` に「ゴール」、`injection` に「施策」を、箱の `sub` 行に自動で入れる(`foldsInto` / `counts` と同じ手口)。文言は `roleTags: {root: '…'}` で差し替えられる。色や形に頼らず、文字で区別する(白黒印刷でも読める)。
- **既定は off**。既存の SVG は 0 本変わる。書籍側は `roleTags: true` を書く。
- 凡例の補強: `tree` を書いた `causeTree` を含み `legend` が未指定の図に、`legend-missing` を **info** で出す(warn にしない。`check --strict` を落とさない)。`examples/toc-*.ts` で凡例の無いものに `legend: 'auto'` を足す。
- `goal` の形を変える(スタジアム形など)案は第 2 段として見送る。既定 on にすると 2〜10 本の SVG が変わるため。

### D2. 施策 → 障害の自動 `blocks` は入れない

検査 `toc-injection-to-obstacle`(#256)で足りる。自動化は著者の意図(NBR の injection → ude のように「施策が悪い結果を生む」を描く場合)を壊しうる。要るなら `check --fix`(ADR 0015 の改良案)で**書き換えを提案**する形にする。

### D3. 語を割らない幅の下限 `keepWord`

- `measureNode` に `keepWord`(語を割らない下限)を足し、`fitLayout` の 2 回目以降の試行と `maxNodeW: 'auto'` の全試行でだけ有効にする。下限の上限(キャップ)は 240px。語がキャップを超えるときは従来どおり割る(検査 `text-mid-word-break` が拾う。レイアウトは警告を出さない)。
- **1 回目(従来の既定)と、`maxNodeW` を数値で明示した図は変えない**(縮めないので、`keepWord` を付けない)。ADR 0010 D1 の順序(向き → `maxNodeW` 狭め → 折り返し)も変えない。「下限 100px」の意味が「語単位」になるだけ。
- 下限で収まらないときは fold を試し、それでも収まらないときは**下限なしの結果に戻す**(throw しない。割れは検査が拾う)。
- 漢字の連続は下限に含めない(漢字どうしの途中の改行は日本語では普通のため)。カタカナと英数字だけ。
- 第 1 段は `measureNode` を通る部品(`causeTree` / `states` / `faultTree` / `tree` / `cloud` / `bpmn` の task)。**第 2 段**は、枠が先に決まる `chevron` / `cycle` / `swimlane` の step。書籍側の語中改行の多くはこちらで起きる(`chevron` の横向き 6 段で本文幅が約 110px)。案: `cycle` は本文幅を `nr*1.5` から広げ、`chevron` は `tip` と `gap` を詰める(縦向きを勧める)、足りなければその部品の文字を下限まで小さくする。共通の `wrapKeepingWords(text, maxW, cap)` を `Texts.wrap` に足す。第 2 段は golden の変化が大きいので、別 ADR 追記で扱う。

### D4. 戻り矢印: 糖衣 `loopBack` と、`loop-under` の穴の検査

- **段階 0(出し済み、#260)**: エラー文言と README に `route: 'loop-under'` を書く。
- **段階 1**: `loop-under` の穴を検査で塞ぐ。(a) 同じ高さの戻りが重なる、(b) 戻りどうしが交差する(`4→2` と `3→1`)、を verify が止める。部分的に重なる 2 本は throw し、入れ子(`4→2` の外側に `5→1`)は段差を自動でつける。**手書きの `loop-under` を使う既存図が新しく止まる可能性がある**ので、`examples/` 全部を通してから入れる。
- **段階 2**: `steps` / `chevron` / `row` の opt `loopBack: {from, to, label?}` を、展開パスで既存の `loop-under` の `connect` に変換する薄い糖衣にする。ラベル、reveal、dark の部品はそのまま使える。`outer` レーン(別エンジン用)の流用はしない。

### D5. チャートの軸: 検査を先に、共有はその上に

1. `chart-axis-mismatch`(小): 同じ図・同じ unit で、軸の範囲が違う数値軸のチャートを warn。出口は `accept` と、意図して別軸にする `scale: 'own'`。**既存の例で新しい warn が出ないことを確かめてから確定する**。
2. 各チャートに `domain` opt を足す(waterfall / stacked / tornado / butterfly。`bars` の `max` に相当)。
3. `scale: 'shared'` は、その上に pre-layout の pass として載せる(`lib/pipeline.ts` の reveal の後)。同じ domain でも、プロットの高さや幅が違えば**長さは揃わない**ので、ドキュメントに書き、`scale: 'shared'` はプロットの大きさも揃える範囲までを約束する。
4. すべてオプトイン。既存の出力は変わらない(1 だけ新しい warn の可能性)。

### D6. 範囲の浮き棒

`bars` の datum に `range: [lo, hi]` を足し、内部では `value = hi` と `lo`(浮きの下端)に正規化する。`rangeBars()` はその別名。凡例に「下限〜上限」の読み方を自動で出す。軸の自動範囲は `lo` も含める。負の値、reveal、`bars-values-hidden` との整合は実装時に test で固定する。

## 順序と PR の分け方

1. D5-1(`chart-axis-mismatch`)と D4 段階 1(`loop-under` の検査)— 検査。独立。
2. D1(`roleTags` と凡例の info)。
3. D3 第 1 段(`keepWord`)。
4. D5-2・3(`domain` と `scale: 'shared'`)、D6(範囲の棒)。
5. D4 段階 2(`loopBack`)、D3 第 2 段(chevron / cycle / swimlane)。

PR は項目ごとに分ける。各 PR は `tsc`、全体テスト、`golden`(`check --drift --rebuild`)を通し、出力が変わる図は PR 本文に挙げる。

## 受け入れる代償

- D1 は既定 off なので、書籍側が書かない限り誤読は残る(検査 `legend-missing` の info と README で促す)。
- D3 は 1 回目と明示幅を守るので、`maxNodeW` を数値で書いた図の語中改行は直らない(検査が拾う。要るなら明示時にも `keepWord` を付けるオプトインを後で足す)。
- D4 段階 1 は、手書きの `loop-under` を使う外部の図を新しく止めうる。

## 未決(レビューで決めたい点)

1. D3: 明示した `maxNodeW` でも語を割らない opt を、今足すか。
2. D3: 下限で収まらないとき「下限なしに戻す」(推奨)か throw か。
3. D5-1: 「同じ unit」の判定。unit が無いチャートどうしをどう扱うか(推奨: unit が無ければ検査しない)。
4. D1: `roleTags` の既定を、`tree` を書いた `causeTree` では on にするか(推奨: off。出力が全部変わるため)。

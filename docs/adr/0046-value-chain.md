# ADR 0046: `valueChain()` — ポーターの価値連鎖(バリューチェーン)

- 状態: 実装済み(レビュー前)
- 日付: 2026-10-29
- 基点: `main`(PR #343 まで)
- 関連: ADR 0043(`emblem()`。流れ図形の帯に足す手順)、`chevron()`(主活動の矢羽根と同じ形)
- 範囲外: 活動ごとの原価・粗利の数値、活動どうしの矢印、コトラーの「価値提供ネットワーク」(供給者・企業・流通・顧客の連なり。別の図で、`swimlane()` か `cycle()` で足りる)

## 背景
「ポーターやコトラーのバリューチェーンの図を書きたい」という要望。既存の `chevron()` で主活動は並ぶが、(1) 支援活動を主活動の上に帯で置く、(2) 右端のマージンの矢印、(3) 二つを 1 つの図として揃える、の 3 つは `chevron()` と `box()` の組み合わせでは、幅の揃えと矢印の高さを手で合わせることになる。

## 決定
### D1: 流れ図形の 1 つの帯 `valueChain({support, primary}, opts)` にする
`chevron` / `emblem` と同じ表(`FlowShapeBand`)に足す。項目は文字列か `FlowStep`(`label` / `sub` / `id` / `tone`)。`id` は anchor で、`connect()` と spotlight の対象。支援活動は省ける。
### D2: 配置
- 上から、`titles[0]`(支援活動)、支援活動の帯(全幅、縦に積む、間 4px)、`titles[1]`(主活動)、主活動の矢羽根。
- 主活動の矢羽根は `chevron()` と同じ形(先頭だけ五角形)で、幅は帯の幅を等分する。
- 右端のマージンは、上の帯の上端から矢羽根の下端までの高さの矢印(`tone: 'accent'`、太枠)。幅は文字に合わせて 84〜140px。`margin: false` で外す。
- 既定の色は、支援活動 `muted`、主活動 `plain`、マージン `accent`。`tone` で項目ごとに変えられる。
### D3: 文言は日本語の既定にし、変えられる
`titles` と `margin` の既定は日本語(`支援活動` / `主活動` / `マージン`)。英語の図は `titles: ['Support activities', 'Primary activities']` と `margin: 'Margin'` を渡す。
### D4: 検査
他の flow shape と同じ(`checkFlowShape`: ラベルが図の内側、ラベル同士が重ならない)。語の途中の改行は `text-mid-word-break` が出る(矢羽根の幅は主活動の数で決まるので、`keepWords` は効かない。主活動を減らす・文言を短くする・`margin: false` を案内する)。
### D5: PPTX
他の流れ図形と同じく画像として書き出す(`lib/pptx/bands.ts`)。

## 結果と残り
- 例 `examples/value-chain.ts`(golden あり)。テストは `test/flow-shapes.test.ts`。
- 残り: 活動ごとに色分けする凡例、マージンを「粗利」と「その内訳」に分ける見せ方、縦書きの `支援活動` / `主活動`(ポーターの原図は左端に縦書き)。要望があれば。

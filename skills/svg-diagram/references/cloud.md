# クラウド・ネットワークの構成図
（svg-diagram の入口は `../SKILL.md`）


アイコン+名前の点を `node({id, icon, label, sub})` で置き、境界（VPC・サブネット・ゾーン）は `group({title})` の入れ子、線は `connect('a:right', 'b:left')`。例: `examples/cloud-architecture.ts`。

- **線は必ず辺を指す**（`:right` `:left` `:top` `:bottom`）。省略すると中心同士を結び、枠のない node ではアイコンを貫く。`:bottom` は名前の下に付く。
- 線が見出しや別の node にかかって `build` が止まったら、node の並び（同じ行・同じ列に寄せる）か、`route: 'elbow'` の `bend` で直す。ゾーンや層ごとに行を分け、線は隣の行へだけ引くと素直に収まる。
- アイコンは汎用なら `icons find`（carbon が構成図向き）。**AWS / Azure / GCP / Kubernetes の公式アイコンは Iconify に無い**ので、ユーザーに各社の配布ページから zip を DL してもらい、`icons add-pack <zip> --prefix aws --terms <規約の URL> --accept-terms --match "..."` で入れる。**規約を読んだかはユーザーに確認してから** `--accept-terms` を付ける（勝手に付けない）。
- PNG プレビュー（resvg）でも曲がる線の矢じりは線の向きに合う（描くときだけマーカーを置き換えて直してある）。実ブラウザで確かめたいときは `--engine chromium`。
- グローバル運用（案件に `svg-diagram` を入れない）でも `svg-diagram typecheck` は動く（PATH 上の `tsc` と、このツールの型定義を使う）。

README の「部品」表を参照。基盤・ネットワーク図は、`group` の入れ子（ホスト > コンテナ > プロセス）と、`row([group, group])` の横並びで描く（接続線は、枠をまたぐ箇所で他の箱や題名を通らないよう、`@t` や `elbow` で調整）（box / row / grid / group / connect / swimlane / sequence / table / wireframe / screens ほか）。

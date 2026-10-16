# 枠が決まったキャンバス（canvas）
（svg-diagram の入口は `../SKILL.md`）


ビジネスモデルキャンバス・SWOT・7S などは `canvas(template, content, opts)`。領域の位置・見出し（日本語）は自動、内容は領域 id ごとの文字列の配列。

| 部品 | 書き方 | 備考 |
|---|---|---|
| canvas | `canvas('bmc', {value: ['…'], segments: ['…']}, {title, emphasis, id})` | template: `bmc` `lean` `vpc` `swot` `tows` `errc` `pest` `threeC` `sevenS` `fiveForces` `empathy` `persona` `a3`。領域の id は README の表 |

- 間違った領域 id は型エラー（実行時は有効な id を列挙して止まる）。`titles` で見出しを差し替え、`emphasis: ['value']` で重点（「重点」タグ付き）、`h` で最小の高さ、`requireAll: true` で未記入を `canvas-region-empty` に、`pestle: true` で PESTLE。高さは内容で決まる（既定 `fit: 'content'`）。書き込み用紙のように広い枠が要るときは `fit: 'aspect'`（テンプレートの縦横比を床にする従来の見た目）か `h`。
- `id: 'c'` で各領域が `c-<領域>` のアンカーになり、`connect` / `spotlight` / `reveal` が効く。矢印は描かない（必要なら `connect`）。
- 書き方の全部は README の「枠が決まったキャンバス」。例: `examples/canvas-*.ts`。

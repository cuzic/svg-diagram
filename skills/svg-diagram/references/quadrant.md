# 象限図・分類マトリクス
（svg-diagram の入口は `../SKILL.md`）


2 軸のマス分け（BCG・GE・アンゾフ・人材 9 ボックス・リスクマトリクス・ポジショニングマップ・影響力×関心度）は `quadrant`。軸・マスの見出し・項目の置き場所を書く。配置と重ならない調整は自動。書き方の全部は README の「象限図・分類マトリクス」。

流れや構造の定型図は flowShapes を使う。工程は `chevron(steps)`、段階的な減少は `funnel(stages, {scale: 'value', showRate: true})`、閉じた改善は `cycle(steps)`、2〜3 集合は `venn(sets, {overlaps})`、入れ子の層は `concentric(rings)`。各項目の `id` は connect / spotlight の対象。cycle は 3〜8 個、venn は 2〜3 集合に限る。色だけにせず、venn は自動の線種の違い、他は文字ラベルを必ず残す（concentric の `labels: 'side'` は引き出し線で層につながる）。venn の `centre` は全集合の重なり（全集合の overlap と同時には書けない）。例は `examples/chevron-*` など。

飾り文字と縦書きは `wordart(text, {style, writing, size, tone, gradient, outline, shadow, glow, bevel, extrude, reflection, arc, rotate, flip, font, plate, limit})`。`style` は `plain｜bold｜outline｜shadow｜sticker｜glow｜emboss｜3d｜gradient｜reflect`、色は token の鍵だけ（`tone: 'none'` は中抜き）。縦書きは `writing: 'vertical'`（列は右から左、`\n` か `limit`(px) で列を替え、禁則・句読点・長音・縦中横は自動）。`arc`（度）は 1 行を弧に沿わせる。読めない配色（白い文字を縁取りなしで白い紙に）は検査が止める。band として縦に積むだけで、箱と並べたり箱の中を縦書きにはできない。例は `examples/wordart.ts`。

| 書くもの | 書き方 |
|---|---|
| 型から始める | `quadrant.preset('bcg' \| 'ge' \| 'ansoff' \| 'nineBox' \| 'impactEffort' \| 'risk' \| 'stakeholder' \| 'positioning' \| 'eisenhower', {items})`。軸・見出し・色は日本語で入る。書いたものだけ上書き |
| 自分で作る | `quadrant({x: {title, low, high, reversed?}, y: {...}, grid: [列, 行], cells: [[{title, note, tone}, ...], ...], items})`。`cells[行][列]` は見た目の順（上から） |
| 項目 | `{label, cell: [列, 行]}`（マスの中に自動で並ぶ）か `{label, at: [x, y]}`（0〜1、1 が高い側。軸を逆向きにしても数字は同じ）。`size`（円の面積）、`group`（形・色・凡例）、`id`（connect / spotlight）。`size` と `group` は、1 つに書いたら全部の項目に書く |
| 矢印 | `arrows: [{from: id, to: id｜[x, y], label?}]`（ポートフォリオの移動） |

- 評価は色だけにしない。マスの見出し・説明を文字で書き、項目の種類は `tone` ではなく `group` で分ける（`quadrant-tone-only`）。
- マスで切れない領域（斜めの帯。フロー理論の「釣り合う帯」）は `regions: [{title, note?, tone?, points: [[x, y], ...], at?}]`。`points` は値の空間（0〜1、1 が高い側）の 3 点以上の多角形で、後ろが上に描かれる。`crosshair: true` と、マスに見出しのない型（`quadrant.preset('positioning', {...})`）が条件（領域が文字を持つ）。領域があると `quadrant-empty-cell` は出ない。多角形どうしの重ね合わせ・切り取りはない。例は `examples/quadrant-flow.ts`。
- 項目のないマスは `quadrant-empty-cell`（警告）。項目を入れるか、意図した空きなら `allowEmpty: [[col, row]]` / `true` で示す。
- 項目は重ならず、混めば行が伸びる。座標から大きく動いた項目は `quadrant-item-moved` が知らせるので、座標か図の大きさを見直す。矢印が項目やラベルを横切るときは項目の位置を替える。
- 座標は値の空間（BCG のように x を高い→低い向きに描いても、シェアが高ければ x は 1 に近い）。マスの境目（0.5 など）の項目は、高い側のマスに入る。
- 描いたら `svg-diagram preview` で見る。例は `examples/quadrant-*.ts`。

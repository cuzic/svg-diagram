# 人間関係の図(Arbinger の「箱」ほか)
（svg-diagram の入口は `../SKILL.md`）

『自分の小さな「箱」から脱出する方法』『平和の解剖』のような、人間関係を「相手をどう見るか」で説明する図は、**専用の帯を持たず**、既存の部品で描く（ADR 0032）。型の名前・用語は書籍の訳語で書く。例の場面は説明用の架空で、書籍の逸話は写さない。

| 描くもの | 使う部品 | 例 |
|---|---|---|
| 共謀（二人の見方と行動が互いを回す） | `cycle`（4 点: A の見方 → A の行動 → B の見方 → B の行動）。節の文は 12 字 × 2 行ほど。`centre` に「箱の中の二人」 | `examples/arbinger-collusion.ts` |
| 同じ行動、違う心の向き（氷山） | `banner`（行動）+ `banner`（水面）+ `row` + `group`。箱の外/中は **`tone: 'new'` / `'muted'`** と `legendLabels` | `examples/arbinger-iceberg.ts` |
| 自己正当化のイメージの型 | `table` | `examples/arbinger-images.ts` |
| 箱から出る流れと戻り | `chevron({loopBack})` | `examples/arbinger-way-out.ts` |

## 落とし穴(試作で踏んだもの)

- **二人を左右の列に縦に積み、列をまたぐ矢印を引かない。** 同じ順で積むと矢印が箱を貫いて、ビルドが止まる(`path overlaps`)。循環は `cycle`（`causalLoop({layout: 'ring'})` でも描けるが、+/− と `R1` の印が付く）。
- **箱の中/外に `danger` / `removed` を使わない。** 凡例が「異常・注意」「対象外」と出て、意味が逆に読める。`legendLabels: {'tone:muted': '箱の中(…)'}` で文言を直し、色だけに頼らず、ラベル（「箱の中/外」）を必ず文字で書く。
- `plain` は凡例に出ない（`legendLabels` のキーにも無い）。凡例に出したい意味には `new` / `muted` などを使う。白黒で近いトーンの組は `gray-tone-collision` が出る。トーンを減らすか、`accept` に理由を書く。
- 箱の外の人に自己正当化を書けるかは、DSL が決めない（心の向きは特定の相手・時点に対するもので、書籍の主張を型にしない）。

## 帯にする条件

同じ配置の手書きが 3 つ以上の図で出たら、新しい ADR で帯を検討する（ADR 0032「帯に戻す条件」）。

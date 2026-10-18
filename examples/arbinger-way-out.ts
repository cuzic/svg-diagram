// 箱から出る流れと、箱へ戻る弧。chevron の loopBack で描く。
// 「技術ではなく見方が出口」のような主張は caption に書き手が書く(DSL は代弁しない)。
// ビルド: svg-diagram build examples/arbinger-way-out.ts --out examples/out/arbinger-way-out.svg
import {caption, chevron, diagram} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: '箱から出る流れ(と戻り)', legend: false, sourceLine: '出典: 説明用の例'}).add(
    caption('出口は、行動の技術より、相手の見方が変わること', {bold: true}),
    chevron([{label: '箱の中(相手が物)'}, {label: '気づく'}, {label: '相手を人として見る'}, {label: '箱の外で行動'}], {
      loopBack: {from: 4, to: 1, label: '再び箱へ'},
    }),
  );
}

// 3 集合のベン図。2 つだけが重なる部分のラベルは、その 2 つだけが重なる場所に、centre は 3 つ全部が重なる場所に入る。
// ビルド: svg-diagram build examples/venn-strategy.ts --out examples/out/venn-strategy.svg
import {diagram, venn} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'amber', title: '戦略の焦点'}).add(venn([{name: '顧客'}, {name: '自社'}, {name: '競合'}], {
    overlaps: [
      {sets: ['顧客', '自社'], label: '提供価値'},
      {sets: ['自社', '競合'], label: '差別化'},
    ],
    centre: '勝ち筋',
  }));
}

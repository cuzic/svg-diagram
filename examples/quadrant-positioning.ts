// 架空のノート PC 市場のポジショニングマップ。軸は自由に決められ、マスの名前はない（十字線だけ）。
// ビルド: svg-diagram build examples/quadrant-positioning.ts --out examples/out/quadrant-positioning.svg
import {diagram, quadrant} from 'svg-diagram';

export default function define() {
  const d = diagram({theme: 'blue', width: 940, gap: 20, title: 'ノート PC のポジショニングマップ'});
  d.add(quadrant.preset('positioning', {
    x: {title: '価格', low: '安い', high: '高い'}, y: {title: '携帯性', low: '重い', high: '軽い'},
    groups: ['自社', '競合'],
    items: [
      {label: '自社 A（軽量）', at: [0.55, 0.85], group: '自社'}, {label: '自社 B（標準）', at: [0.35, 0.45], group: '自社'},
      {label: '競合 X', at: [0.8, 0.9], group: '競合'}, {label: '競合 Y', at: [0.2, 0.2], group: '競合'},
      {label: '競合 Z', at: [0.6, 0.3], group: '競合'}, {label: '競合 W', at: [0.12, 0.62], group: '競合'},
    ],
  }));
  return d;
}

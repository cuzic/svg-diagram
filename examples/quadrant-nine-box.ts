// 架空の部門の人材 9 ボックス（業績 × 潜在能力）。名前は座標ではなくマスで指定すると、マスの中に重ならず並ぶ。
// ビルド: svg-diagram build examples/quadrant-nine-box.ts --out examples/out/quadrant-nine-box.svg
import {diagram, quadrant} from 'svg-diagram';

export default function define() {
  const d = diagram({theme: 'blue', width: 940, gap: 20, title: '人材 9 ボックス'});
  d.add(quadrant.preset('nineBox', {
    allowEmpty: true, // a sample: not every cell is filled
    items: [
      {label: '田中', cell: [2, 0]}, {label: '佐藤', cell: [2, 1]}, {label: '鈴木', cell: [2, 1]},
      {label: '高橋', cell: [2, 2]}, {label: '伊藤', cell: [1, 1]}, {label: '渡辺', cell: [1, 1]}, {label: '山本', cell: [1, 1]},
      {label: '中村', cell: [1, 0]}, {label: '小林', cell: [0, 2]}, {label: '加藤', cell: [0, 0]},
    ],
  }));
  return d;
}

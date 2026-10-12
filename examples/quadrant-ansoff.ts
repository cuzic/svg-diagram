// 架空の飲料メーカーの成長戦略（アンゾフの成長マトリクス）。項目はセルに並べるだけで、重ならないように置かれる。
// ビルド: svg-diagram build examples/quadrant-ansoff.ts --out examples/out/quadrant-ansoff.svg
import {diagram, quadrant} from 'svg-diagram';

export default function define() {
  const d = diagram({theme: 'blue', width: 940, gap: 20, title: '成長戦略（アンゾフ）'});
  d.add(quadrant.preset('ansoff', {
    items: [
      {label: '既存客への増量パック', cell: [0, 0]}, {label: '販売店の拡大', cell: [0, 0]}, {label: '値引きキャンペーン', cell: [0, 0]},
      {label: '無糖シリーズ', cell: [1, 0]}, {label: '機能性表示の新商品', cell: [1, 0]},
      {label: '海外の日系スーパー', cell: [0, 1]}, {label: '業務用ルート', cell: [0, 1]},
      {label: '健康食品への参入', cell: [1, 1]},
    ],
  }));
  return d;
}

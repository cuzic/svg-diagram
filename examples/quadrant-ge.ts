// 架空の事業ポートフォリオ（GE マッキンゼー 9 マス）。円の面積が売上高（svg-diagram の quadrant() の使用例）。
// ビルド: svg-diagram build examples/quadrant-ge.ts --out examples/out/quadrant-ge.svg
import {diagram, caption, quadrant} from 'svg-diagram';

export default function define() {
  const d = diagram({theme: 'blue', width: 940, gap: 20, title: '事業ポートフォリオ（GE マッキンゼー）'});
  d.add(caption('円の面積は売上高。位置は 0〜1 の評点（1 が高い・強い）。', {align: 'left'}));
  d.add(quadrant.preset('ge', {
    allowEmpty: true, // a sample: not every cell is filled
    sizeTitle: '売上高', sizeUnit: '億円',
    items: [
      {label: '決済', at: [0.88, 0.9], size: 80},
      {label: '会員基盤', at: [0.5, 0.82], size: 150},
      {label: '物流', at: [0.4, 0.5], size: 220},
      {label: '広告', at: [0.8, 0.5], size: 50},
      {label: '旧店舗', at: [0.15, 0.2], size: 90},
      {label: '紙媒体', at: [0.1, 0.55], size: 30},
    ],
  }));
  return d;
}

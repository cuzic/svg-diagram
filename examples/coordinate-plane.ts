// 架空の「地図の座標 → 画像の画素」の対応図（svg-diagram の plane() の使用例）。
// ビルド: svg-diagram build examples/coordinate-plane.ts --out examples/out/coordinate-plane.svg
import {diagram, caption, plane} from 'svg-diagram';

export default function define() {
  const d = diagram({theme: 'blue', width: 940, gap: 24, title: '地図の座標と画像の画素の対応（例）'});
  d.add(caption('地図（メートル、y は上向き）', {bold: true}));
  d.add(plane({
    x: {label: 'x [m]', max: 100, step: 20}, y: {label: 'y [m]', max: 60, step: 10}, grid: true, height: 320,
    points: [
      {id: 'o', at: [0, 0], shape: 'ring', tone: 'muted'},
      {id: 'a', at: [30, 20], label: 'A (30, 20)', labelAt: 'above'},
      {id: 'b', at: [80, 45], label: 'B (80, 45)', tone: 'danger', labelAt: 'above'},
    ],
    lines: [{from: 'a', to: [30, 0]}, {from: 'a', to: [0, 20]}],
    dims: [{from: 'a', to: 'b', label: '58.3 m', side: 'below'}, {from: [30, 0], to: [80, 0], label: '50 m', side: 'above', offset: 14}],
    labels: [{at: [70, 55], text: '地図の枠', tone: 'muted'}],
  }));
  d.add(caption('画像（画素、v は下向き）', {bold: true}));
  d.add(plane({
    x: {label: 'u [px]', max: 640, step: 160}, y: {label: 'v [px]', max: 360, step: 90}, yDown: true, height: 320,
    points: [{id: 'p', at: [200, 120], label: 'P', shape: 'cross'}, {id: 'q', at: [480, 260], label: 'Q'}],
    dims: [{from: 'p', to: 'q', label: '312 px'}],
  }));
  return d;
}

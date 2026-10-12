// plane() の paths: 点を通る滑らかな折れ線（単調な 3 次補間なので、点の値を行き過ぎない）と、素の折れ線。
// ビルド: svg-diagram build examples/plane-paths.ts --out examples/out/plane-paths.svg
import {diagram, caption, plane} from 'svg-diagram';

export default function define() {
  const d = diagram({theme: 'blue', width: 940, gap: 24, title: '点を通る滑らかな線（例）'});
  d.add(caption('smooth: true（点を必ず通り、0 や 10 の平らな区間は平らなまま）と、smooth なしの折れ線', {bold: true}));
  d.add(plane({
    x: {label: '日', max: 30, step: 5}, y: {label: '件', max: 10, step: 2}, height: 320, grid: true,
    points: [
      {at: [3, 1], label: 'a', labelAt: 'above', tone: 'muted'}, {at: [8, 1], label: 'b', labelAt: 'above', tone: 'muted'}, {at: [18, 9], label: 'c', labelAt: 'above', tone: 'muted'}, {at: [30, 9], label: 'd', labelAt: 'below', tone: 'muted'},
    ],
    paths: [
      {through: [[3, 1], [8, 1], [18, 9], [30, 9]], smooth: true, arrow: true},
      {through: [[0, 5], [10, 6], [20, 3], [30, 5]], tone: 'muted', dashed: true},
    ],
  }));
  return d;
}

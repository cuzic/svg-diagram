// ACT Matrix（架空のワークの記入例）: 縦は五感で感じる ↔ 心の中、横は大切なものから離れる ↔ 向かう。左下の内側の体験から読み、中心に気づいている自分。
// ビルド: svg-diagram build examples/quadrant-act-matrix.ts --out examples/out/quadrant-act-matrix.svg
import {diagram, quadrant} from 'svg-diagram';

export default function define() {
  const d = diagram({theme: 'blue', width: 940, gap: 20, title: '今週の ACT マトリックス'});
  d.add(quadrant.preset('actMatrix', {
    items: [
      {label: '会議で失敗したらどうしよう', cell: [0, 1]}, {label: '胸のざわつき', cell: [0, 1]},
      {label: '発言を控える', cell: [0, 0]}, {label: '資料を作り込みすぎる', cell: [0, 0]},
      {label: 'チームの役に立つこと', cell: [1, 1]}, {label: '学び続けること', cell: [1, 1]},
      {label: '会議で一つ質問する', cell: [1, 0]},
    ],
  }));
  return d;
}

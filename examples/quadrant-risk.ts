// 架空のシステム開発プロジェクトのリスクマトリクス（発生可能性 × 影響度）。評価は色ではなく、マスの文字で書く。
// ビルド: svg-diagram build examples/quadrant-risk.ts --out examples/out/quadrant-risk.svg
import {diagram, caption, quadrant} from 'svg-diagram';

export default function define() {
  const d = diagram({theme: 'blue', width: 940, gap: 20, title: 'プロジェクトのリスクマトリクス'});
  d.add(caption('R1〜R7 は別表のリスク番号。', {align: 'left'}));
  d.add(quadrant.preset('risk', {
    allowEmpty: true, // a sample: not every cell is filled
    items: [
      {label: 'R1 要件の変更', cell: [1, 0]}, {label: 'R2 主要メンバーの離脱', cell: [2, 0]},
      {label: 'R3 外部 API の仕様変更', cell: [1, 1]}, {label: 'R4 性能不足', cell: [2, 1]},
      {label: 'R5 ライセンス費の増加', cell: [0, 1]},
      {label: 'R6 災害・停電', cell: [2, 2]}, {label: 'R7 受入環境の遅れ', cell: [1, 2]},
    ],
  }));
  return d;
}

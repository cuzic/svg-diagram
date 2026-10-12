// 架空の 1 日のタスクの整理（緊急度 × 重要度のアイゼンハワー・マトリクス）。
// ビルド: svg-diagram build examples/quadrant-eisenhower.ts --out examples/out/quadrant-eisenhower.svg
import {diagram, quadrant} from 'svg-diagram';

export default function define() {
  const d = diagram({theme: 'blue', width: 940, gap: 20, title: '今日のタスクの整理'});
  d.add(quadrant.preset('eisenhower', {
    items: [
      {label: '障害の一次対応', cell: [0, 0]}, {label: '明日の提案書', cell: [0, 0]},
      {label: '新人の育成計画', cell: [1, 0]}, {label: '資格の勉強', cell: [1, 0]}, {label: '運動', cell: [1, 0]},
      {label: '定例会議の出席', cell: [0, 1]}, {label: '備品の注文', cell: [0, 1]},
      {label: 'ニュースの巡回', cell: [1, 1]},
    ],
  }));
  return d;
}

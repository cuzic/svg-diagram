// 架空の業務改善案の優先順位づけ（インパクト × 実行容易性）。円の面積は削減できる工数、矢印は見直しによる評価の変化。
// ビルド: svg-diagram build examples/quadrant-impact-effort.ts --out examples/out/quadrant-impact-effort.svg
import {diagram, caption, quadrant} from 'svg-diagram';

export default function define() {
  const d = diagram({theme: 'blue', width: 940, gap: 20, title: '改善案の優先順位'});
  d.add(caption('円の面積は年間の削減工数。', {align: 'left'}));
  d.add(quadrant.preset('impactEffort', {
    sizeTitle: '削減工数', sizeUnit: '時間',
    items: [
      {id: 'rpa', label: '請求書の自動取込', at: [0.85, 0.8], size: 1200}, {label: '承認フローの簡素化', at: [0.65, 0.9], size: 600},
      {id: 'erp', label: '基幹システムの刷新', at: [0.2, 0.85], size: 4000}, {label: '紙の廃止', at: [0.3, 0.6], size: 800},
      {label: '会議の定例化', at: [0.8, 0.25], size: 200}, {label: '名刺管理', at: [0.9, 0.12], size: 100},
      {label: '全社チャット導入', at: [0.15, 0.2], size: 400},
    ],
    arrows: [{from: 'erp', to: [0.45, 0.8], label: '分割して着手', dashed: true}],
  }));
  return d;
}

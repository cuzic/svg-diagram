// 架空の事業ポートフォリオ（BCG マトリクス）。円の面積が売上、矢印が 1 年後の見込み（svg-diagram の quadrant() の使用例）。
// ビルド: svg-diagram build examples/quadrant-bcg.ts --out examples/out/quadrant-bcg.svg
import {diagram, caption, quadrant} from 'svg-diagram';

export default function define() {
  const d = diagram({theme: 'blue', width: 940, gap: 20, title: '事業ポートフォリオ（BCG マトリクス）'});
  d.add(caption('円の面積は売上高。矢印は来期の見込み。', {align: 'left'}));
  d.add(quadrant.preset('bcg', {
    sizeTitle: '売上高', sizeUnit: '億円',
    items: [
      {id: 'cloud', label: 'クラウド', at: [0.85, 0.82], size: 120},
      {id: 'app', label: 'アプリ', at: [0.35, 0.8], size: 40},
      {id: 'pkg', label: 'パッケージ', at: [0.82, 0.25], size: 300},
      {id: 'old', label: '旧システム', at: [0.2, 0.2], size: 60},
      {id: 'ai', label: 'AI 新規', at: [0.15, 0.58], size: 30},
    ],
    arrows: [{from: 'app', to: [0.12, 0.9], label: '来期'}],
  }));
  return d;
}

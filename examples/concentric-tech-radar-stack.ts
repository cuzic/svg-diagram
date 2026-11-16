// 技術レーダーの積み重ね版（架空のチーム）: concentric-tech-radar.ts と同じデータを layout: 'stack' で描く。分野を列に、Adopt / Trial /
// Assess / Hold を上から下への段にする。前回から段を移ったものは矢印で示す（ADR 0065）。
// ビルド: svg-diagram build examples/concentric-tech-radar-stack.ts --out examples/out/concentric-tech-radar-stack.svg
import {concentric, diagram} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', width: 940, title: '技術レーダー 2026 秋'}).add(concentric(
    [{label: 'Adopt'}, {label: 'Trial'}, {label: 'Assess'}, {label: 'Hold'}],
    {
      order: 'inner-first',
      layout: 'stack',
      sectors: [{label: '言語・フレームワーク'}, {label: 'ツール'}, {label: 'プラットフォーム'}, {label: '手法'}],
      marks: [
        {label: 'TypeScript', sector: 1, ring: 'Adopt'}, {label: 'Effect', sector: 1, ring: 'Assess', from: {ring: 'Hold'}},
        {label: 'Biome', sector: 2, ring: 'Adopt', from: {ring: 'Trial'}}, {label: 'Bun', sector: 2, ring: 'Trial'},
        {label: 'Fly.io', sector: 3, ring: 'Trial'}, {label: 'Kubernetes', sector: 3, ring: 'Hold'},
        {label: 'ADR', sector: 4, ring: 'Adopt'}, {label: 'モブプロ', sector: 4, ring: 'Assess'},
      ],
    },
  ));
}

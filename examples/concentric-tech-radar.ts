// 技術レーダー（架空のチーム）: 同心円を 4 つの分野の扇形に区切り、Adopt / Trial / Assess / Hold を中心から外への輪にする。前回から輪を
// 移ったものは矢印で示す（ADR 0065）。
// ビルド: svg-diagram build examples/concentric-tech-radar.ts --out examples/out/concentric-tech-radar.svg
import {concentric, diagram} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', width: 940, title: '技術レーダー 2026 秋'}).add(concentric(
    [{label: 'Adopt'}, {label: 'Trial'}, {label: 'Assess'}, {label: 'Hold'}],
    {
      order: 'inner-first',
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

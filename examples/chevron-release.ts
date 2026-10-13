// リリースまでの工程を矢羽根（chevron）で並べる。current の工程は色と太い枠で示す。
// ビルド: svg-diagram build examples/chevron-release.ts --out examples/out/chevron-release.svg
import {chevron, diagram} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: 'リリース工程'}).add(chevron([
    {id: 'plan', label: '計画', sub: '要件を確認'},
    {id: 'build', label: '実装', sub: '小さく作る'},
    {id: 'test', label: '検証', sub: '品質を確認'},
    {id: 'ship', label: '公開', sub: '利用を開始'},
  ], {current: 2}));
}

// PDCA を時計回りの循環で描く。矢印は節と節の間を円周に沿って結ぶ。
// ビルド: svg-diagram build examples/cycle-pdca.ts --out examples/out/cycle-pdca.svg
import {cycle, diagram} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: 'PDCA'}).add(cycle([
    {id: 'plan', label: 'Plan'},
    {id: 'do', label: 'Do'},
    {id: 'check', label: 'Check'},
    {id: 'act', label: 'Act'},
  ], {centre: '継続改善'}));
}

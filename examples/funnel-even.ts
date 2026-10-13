// 値を書かない漏斗（scale: 'even'）。段の幅は一定の割合で狭まる。
// ビルド: svg-diagram build examples/funnel-even.ts --out examples/out/funnel-even.svg
import {diagram, funnel} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'amber', title: '候補の絞り込み'}).add(funnel(
    [{label: '全候補'}, {label: '一次選考'}, {label: '最終候補'}, {label: '採用'}],
    {scale: 'even'},
  ));
}

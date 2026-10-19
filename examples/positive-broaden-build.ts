// 拡張–形成理論(フレドリクソン): ポジティブ感情が視野を広げ、資源を築き、さらにポジティブ感情を増やす上昇のループ。cycle(4 点)で描く。
// 節の文は 12 字 × 2 行ほどに収める(円の中で折れる)。
// ビルド: svg-diagram build examples/positive-broaden-build.ts --out examples/out/positive-broaden-build.svg
import {cycle, diagram} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: '拡張–形成理論: ポジティブ感情の上昇スパイラル', legend: false, sourceLine: '出典: 説明用の例'}).add(cycle([
    {label: 'ポジティブな感情'},
    {label: '拡張: 視野が広がる'},
    {label: '形成: 資源が育つ'},
    {label: '感情がさらに増える'},
  ], {centre: '上昇スパイラル'}));
}

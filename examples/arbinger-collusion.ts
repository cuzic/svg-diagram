// 「箱」の本の共謀: 二人の見方と行動が、互いを回す。cycle(4 点)で描く。
// 場面は説明用の架空。節の文は 12 字 × 2 行ほどに収める(円の中で折れる)。
// ビルド: svg-diagram build examples/arbinger-collusion.ts --out examples/out/arbinger-collusion.svg
import {cycle, diagram} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: '共謀: 二人の見方と行動が、互いを回す', legend: false, sourceLine: '出典: 説明用の例'}).add(cycle([
    {label: 'A の見方: B は報告が遅い人'},
    {label: 'A の行動: 進捗を細かく問いただす'},
    {label: 'B の見方: A は信用していない人'},
    {label: 'B の行動: 報告を後回しにする'},
  ], {centre: '箱の中の二人'}));
}

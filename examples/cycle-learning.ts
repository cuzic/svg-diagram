// 5 つの節を反時計回り（direction: 'ccw'）に回す学習サイクル。sub は節の中に小さく出る。
// ビルド: svg-diagram build examples/cycle-learning.ts --out examples/out/cycle-learning.svg
import {cycle, diagram} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'teal', title: '学習サイクル'}).add(cycle([
    {label: '観察', sub: '現場を見る'},
    {label: '仮説'},
    {label: '実験'},
    {label: '計測'},
    {label: '共有'},
  ], {direction: 'ccw', centre: '学び'}));
}

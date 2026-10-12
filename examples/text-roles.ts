// 大きい文字の入口: banner の headlineRole と、bars / plane の labelRole（スライドの主役の絵に使う大きい文字）。
// ビルド: node build-diagram.ts --out-dir examples/out examples/text-roles.ts
import {diagram, banner, bars, caption, plane} from 'svg-diagram';

export default function define() {
  const d = diagram({theme: 'blue', width: 940, gap: 24, title: '離脱率の推移（例）'});
  d.add(banner({headline: '離脱率が半分以下に', headlineRole: 'display', sub: '導入前 76% から導入後 31% へ'}));
  d.add(bars([
    {label: '導入前', value: 76, series: 'c'},
    {label: '導入後', value: 31},
  ], {max: 100, unit: '%', labelRole: 'stat'}));
  d.add(caption('plane の labelRole: 軸・目盛り・点・寸法の文字を 1 段大きく'));
  d.add(plane({
    labelRole: 'banner', x: {label: '週', max: 8, step: 2}, y: {label: '%', max: 80, step: 20}, height: 300, grid: true,
    points: [{id: 'a', at: [1, 76], label: '導入前', labelAt: 'above', tone: 'muted'}, {id: 'b', at: [7, 31], label: '導入後', labelAt: 'above'}],
    dims: [{from: 'a', to: [1, 31], label: '-45pt', side: 'left'}],
    paths: [{through: [[1, 76], [4, 50], [7, 31]], smooth: true, arrow: true}],
  }));
  return d;
}

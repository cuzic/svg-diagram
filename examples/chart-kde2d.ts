import {diagram, hist2d, kde2d, row} from 'svg-diagram';

// seaborn の kdeplot(x=, y=): 2 変数の密度を 5 段の塗り（濃いほど密）と等高線で。点は小さく重ねる。
const n = 80;
const a = Array.from({length: n}, (_q, i) => 160 + ((i * 37) % 41) * 0.6 + (i % 3) * 4);
const b = a.map((h, i) => Math.round(0.55 * h - 32 + ((i * 17) % 11) - 5));
export default function define() {
  return diagram({theme: 'blue', title: '2変数の密度（KDE と 2次元ヒストグラム）', sourceLine: '出典: 説明用の例'}).add(
    row([kde2d({x: a, y: b}, {xLabel: '身長（cm）', yLabel: '体重（kg）', width: 440}), hist2d({x: a, y: b}, {xLabel: '身長（cm）', yLabel: '体重（kg）', width: 440})]),
  );
}

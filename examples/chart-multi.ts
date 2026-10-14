import {diagram, hist2d, jointplot, pairplot, row} from 'svg-diagram';

// seaborn の histplot(x, y) / jointplot / pairplot: 列ごとの生の値を渡す。階級・度数・周辺分布は計算される（乱数なし）。
const n = 40;
const height = Array.from({length: n}, (_q, i) => 150 + ((i * 37) % 41) + (i % 2) * 8);
const weight = height.map((h, i) => Math.round(0.55 * h - 32 + ((i * 17) % 11) - 5));
const age = height.map((_h, i) => 20 + ((i * 13) % 36));
const sex = height.map((_h, i) => (i % 2 ? '男性' : '女性'));
export default function define() {
  return diagram({theme: 'blue', title: '身長・体重・年齢（2次元ヒストグラム・ジョイント・散布図行列）', sourceLine: '出典: 説明用の例'}).add(
    row([
      hist2d({x: height, y: weight}, {xLabel: '身長（cm）', yLabel: '体重（kg）', width: 440}),
      jointplot({x: height, y: weight, group: sex}, {xLabel: '身長（cm）', yLabel: '体重（kg）', width: 440}),
    ]),
    pairplot({身長: height, 体重: weight, 年齢: age}, {groups: sex}),
  );
}

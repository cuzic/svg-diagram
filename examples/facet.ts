import {diagram, facet, histplot, regplot} from 'svg-diagram';

// seaborn の FacetGrid / displot(col=) 相当: 拠点ごとに 1 枚ずつ描く。パネルの名前は枠の見出し。
// 軸は既定で全パネル共通（sharex / sharey）。make の 4 つ目の引数 axes をそのまま図に渡す。
const data = {
  東京: [52, 58, 61, 63, 64, 66, 67, 69, 70, 72, 74, 75, 77, 81, 84, 96],
  大阪: [41, 47, 50, 52, 54, 55, 57, 58, 60, 61, 63, 65, 66, 70, 71],
  名古屋: [48, 53, 57, 59, 60, 62, 63, 64, 66, 67, 69, 72, 75, 78],
};
const x = Array.from({length: 12}, (_q, i) => i);
export default function define() {
  return diagram({theme: 'blue', title: '拠点別の分布（パネル分割）', sourceLine: '出典: 説明用の例'}).add(
    ...facet(data, (_k, values, _i, axes) => histplot(values, {label: '売上（百万円）', binWidth: 10, height: 240, ...axes}), {cols: 3}),
    ...facet({A: 1, B: 2, C: 3, D: 4}, (_k, s, _i, axes) => regplot({x, y: x.map((v, i) => s * v + ((i * 5) % 7))}, {height: 240, ...axes}), {cols: 2}),
  );
}

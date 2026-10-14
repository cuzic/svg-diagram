import {diagram, regplot, residplot, row} from 'svg-diagram';

// seaborn の regplot / lmplot / residplot: 生の値を渡すと、最小二乗の直線（order: 2 で曲線）と 95% 信頼帯、残差は計算される。
// グループごとに別の回帰線（印・線の種類・色が違う）。
const n = 36;
const x = Array.from({length: n}, (_q, i) => 150 + ((i * 37) % 41));
const y = x.map((h, i) => Math.round(0.55 * h - 32 + ((i * 17) % 11) - 5 + (i % 2 ? 4 : -4)));
const sex = x.map((_h, i) => (i % 2 ? '男性' : '女性'));
const curve = Array.from({length: 30}, (_q, i) => i);
const bend = curve.map((v, i) => Math.round(0.12 * v * v - 2 * v + 20 + ((i * 7) % 9) - 4));
export default function define() {
  return diagram({theme: 'blue', title: '回帰（回帰線・信頼帯・曲線・残差）', sourceLine: '出典: 説明用の例'}).add(
    row([
      regplot({x, y}, {xLabel: '身長（cm）', yLabel: '体重（kg）', stats: true, width: 440}),
      regplot({x, y, group: sex}, {xLabel: '身長（cm）', yLabel: '体重（kg）', width: 440}),
    ]),
    row([
      regplot({x: curve, y: bend}, {order: 2, xLabel: '経過日数', yLabel: '件数', stats: true, width: 440}),
      residplot({x: curve, y: bend}, {order: 1, xLabel: '経過日数', yLabel: '残差（直線との差）', width: 440}),
    ]),
  );
}

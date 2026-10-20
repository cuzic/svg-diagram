import {diagram, scatter} from 'svg-diagram';

// 散布図: 軸は点に合わせて自動。`group` を付けると層別（層ごとに色と形が変わる）、`regression: true` で回帰直線と相関係数 r。
const rows: [number, number][] = [
  [18, 2.1], [20, 2.6], [22, 2.9], [24, 3.6], [25, 3.4], [27, 4.2], [29, 4.4], [30, 5.1], [32, 5.3], [34, 6.0], [35, 6.2], [37, 6.9],
];
export default function define() {
  return diagram({theme: 'blue', title: '温度と不良率（散布図）', sourceLine: '出典: 説明用の例'}).add(
    scatter(
      [
        ...rows.map(([x, y], i) => ({x, y: y + (i % 2 ? 0.25 : -0.15), group: '機械 A'})),
        ...rows.map(([x, y], i) => ({x, y: y + 1.1 + (i % 3 ? 0.2 : -0.3), group: '機械 B'})),
      ],
      {x: '温度 (℃)', y: '不良率 (%)', regression: true},
    ),
  );
}

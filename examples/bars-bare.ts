import {bars, caption, diagram} from 'svg-diagram';

// 値・目盛り・格子を描かない棒。量は高さだけで伝わるので、数値は図の外（本文・caption）に書く。
export default function define() {
  return diagram({theme: 'blue', title: '壁の高さと段差のたとえ', gap: 24}).add(
    caption('ハードル：第 1 の壁は 20、第 2 は 35、第 3 は 60（高さは値に比例）', {bold: true, tone: 'text'}),
    bars(
      [{label: '', value: 20}, {label: '', value: 35}, {label: '', value: 60}],
      {dir: 'v', max: 60, height: 90, labels: 'none', axis: false, barRatio: 0.3},
    ),
    caption('階段：1 段ごとに 10 ずつ上がる（棒どうしが接する）', {bold: true, tone: 'text'}),
    bars(
      [10, 20, 30, 40, 50].map(v => ({label: String(v), value: v})),
      {dir: 'v', max: 50, height: 120, labels: 'none', axis: false, barRatio: 1},
    ),
  );
}

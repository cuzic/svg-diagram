import {diagram, pareto} from 'svg-diagram';

// パレート図: 項目を大きい順に棒で、累積比率を右の軸（0〜100%）の折れ線で。80% に届くまでの項目（主な原因）だけ色が付く。
// 「その他」は大きさに関わらず最後。`top: 5` で 5 位までを残し、残りを「その他」にまとめる。
export default function define() {
  return diagram({theme: 'blue', title: '不良の内訳（パレート図）', sourceLine: '出典: 説明用の例'}).add(
    pareto(
      [
        {label: '傷', value: 42}, {label: '汚れ', value: 25}, {label: '欠け', value: 12}, {label: '寸法不良', value: 8},
        {label: '変色', value: 4}, {label: '異物', value: 3}, {label: 'ばり', value: 2}, {label: '印字ずれ', value: 1},
      ],
      {top: 4, unit: '件', height: 320},
    ),
  );
}

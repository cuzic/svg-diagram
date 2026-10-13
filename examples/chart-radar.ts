import {diagram, radar} from 'svg-diagram';

// レーダーチャート: 自社と競合 2 社を 6 つの観点で比べる。系列は線の種類（実線・破線・点線）と印の形（○ □ ◇）でも見分けられ、
// 凡例に同じ線と印が出る。同心の目盛りには値が書かれ、各頂点の値も出せる。
export default function define() {
  return diagram({theme: 'blue', title: '競合比較（5 段階評価）', sourceLine: '出典: 説明用の例'}).add(
    radar(
      ['品質', '価格', '納期', 'サポート', '機能の幅', '導入のしやすさ'],
      [
        {label: '自社', values: [4, 3, 5, 4, 3, 4], id: 'own'},
        {label: 'A 社', values: [5, 2, 3, 3, 5, 2]},
        {label: 'B 社', values: [2, 5, 3, 2, 2, 5]},
      ],
      {max: 5, values: true, height: 460},
    ),
  );
}

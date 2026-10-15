import {causeTree, diagram} from 'svg-diagram';

// 現状ツリー(CRT)に悪循環の戻りを足す: 納期遅れ(UDE)が稼働率の評価(根本原因)へ戻る矢印に `back: true`。
// 戻りの矢印は太く描かれ、層を飛ぶので図の外側(右)の専用レーンを通る。節を書く順を変えても層は変わらない。
export default function define() {
  return diagram({theme: 'blue', title: '納期遅れの悪循環(現状ツリー)', sourceLine: '出典: 説明用の例'}).add(
    causeTree(
      [
        {id: 'late', label: '納期に遅れる', role: 'ude'},
        {id: 'cost', label: '残業費が膨らむ', role: 'ude'},
        {id: 'switch', label: '作業の切り替えが多い'},
        {id: 'rush', label: '急ぎの割り込みが入る'},
        {id: 'wip', label: '仕掛りが多い'},
        {id: 'start', label: '受注したらすぐ着手する'},
        {id: 'kpi', label: '稼働率で評価される', role: 'root'},
      ],
      [
        {from: 'kpi', to: 'start'},
        {from: 'start', to: 'wip'},
        {from: 'wip', to: 'switch'},
        {from: 'wip', to: 'rush'},
        {from: 'switch', to: 'late'},
        {from: ['switch', 'rush'], to: 'cost'},
        {from: 'late', to: 'kpi', back: true},
      ],
      {maxNodeW: 170},
    ),
  );
}

import {causeTree, diagram} from 'svg-diagram';

// 現状ツリー(CRT): 好ましくない現象(UDE)から原因をたどり、共通の根本原因を探す。
// 下が原因、上が結果。`from` を配列にすると AND(合わさって初めて結果になる原因。矢印にまたがる弧が付く)。
export default function define() {
  return diagram({theme: 'blue', title: '納期遅れの現状ツリー', sourceLine: '出典: 説明用の例'}).add(
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
      ],
      {maxNodeW: 170},
    ),
  );
}

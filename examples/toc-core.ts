import {causeTree, diagram} from 'svg-diagram';

// 現状ツリーの中核ドライバー: `coreDriver: true` で、起点(原因が無い実体)ごとに「たどって届く UDE の数」を数える。
// 最も多い起点(2 つ以上)に、役割とは別の印(太い枠と「中核」のバッジ)が付く。起点には `到達 UDE n` が書かれる(`counts: false` で消す)。
export default function define() {
  return diagram({theme: 'blue', title: '中核ドライバーを探す', sourceLine: '出典: 説明用の例'}).add(
    causeTree(
      [
        {id: 'late', label: '納期に遅れる', role: 'ude'},
        {id: 'cost', label: '残業費が膨らむ', role: 'ude'},
        {id: 'quality', label: '手戻りが多い', role: 'ude'},
        {id: 'switch', label: '作業の切り替えが多い'},
        {id: 'rush', label: '急ぎの割り込みが入る'},
        {id: 'wip', label: '仕掛りが多い'},
        {id: 'kpi', label: '稼働率で評価される', role: 'root'},
        {id: 'spec', label: '仕様の確認が遅い', role: 'root'},
      ],
      [
        {from: 'kpi', to: 'wip'},
        {from: 'wip', to: 'switch'},
        {from: 'wip', to: 'rush'},
        {from: 'switch', to: 'late'},
        {from: ['switch', 'rush'], to: 'cost'},
        {from: 'spec', to: 'quality'},
      ],
      {maxNodeW: 170, coreDriver: true},
    ),
  );
}

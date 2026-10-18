import {causeTree, diagram} from 'svg-diagram';
// 交差の多い未来現実ツリー: 左から右に流し(`dir: 'right'`)、線は箱の左右につなぐ。避けられない交差は、`hop: 'all'` で全部に飛び越しの弧を付け、
// 「交差しているだけ」と「合流」を見分けられるようにする(`hop: true` は戻りの矢印だけ)。並びの探索は、交差が残るときだけ働く。
export default function define() {
  return diagram({theme: 'blue', title: '施策で納期遵守と残業削減を実現する未来現実ツリー', legend: 'auto', sourceLine: '出典: 説明用の例'}).add(
    causeTree(
      [
        {id: 'inj1', label: '受注の投入を現場の余力に合わせて制限する', role: 'injection'},
        {id: 'inj2', label: '営業と現場の情報共有の場を設ける', role: 'injection'},
        {id: 'inj3', label: '手順書を最新に更新する', role: 'injection'},
        {id: 'pre1', label: '現場が稼働率より納期で評価される', role: 'precondition'},
        {id: 'n1', label: '受注してもすぐ着手しない'},
        {id: 'n2', label: '仕掛りが減り作業が滞留しない'},
        {id: 'n3', label: '営業が現場の状況を知って納期を約束する'},
        {id: 'n4', label: '急ぎの割り込みが減る'},
        {id: 'n5', label: '見積もりの工数が正確になる'},
        {id: 'n6', label: '新人が自力で作業を進められる'},
        {id: 'n7', label: '経験者への集中が解消される'},
        {id: 'de1', label: '納期遅れがなくなる', role: 'de'},
        {id: 'de2', label: '残業が減る', role: 'de'},
        {id: 'de3', label: '新人が定着する', role: 'de'},
      ],
      [
        {from: ['inj1', 'pre1'], to: 'n1'},
        {from: 'n1', to: 'n2'},
        {from: 'inj2', to: 'n3'},
        {from: 'inj2', to: 'n5'},
        {from: 'n3', to: 'n4'},
        {from: 'inj3', to: 'n6'},
        {from: ['n6', 'n5'], to: 'n7'},
        {from: 'n2', to: 'de1'},
        {from: 'n4', to: 'de1'},
        {from: 'n7', to: 'de1'},
        {from: 'n3', to: 'de1'},
        {from: ['n2', 'n4'], to: 'de2'},
        {from: 'n7', to: 'de2'},
        {from: 'n6', to: 'de3'},
      ],
      {tree: 'frt', dir: 'right', maxNodeW: 'auto', hop: 'all'},
    ),
  );
}

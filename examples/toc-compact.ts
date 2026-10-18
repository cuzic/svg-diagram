import {causeTree, diagram} from 'svg-diagram';
// 詰めて描く: `diagram({density: 'compact'})` は、箱・層の間隔と矢印のレーンを 1/4 詰める(因果ツリーで高さがおよそ 1〜2 割減)。書かなければ今までと同じ図。
export default function define() {
  return diagram({theme: 'blue', density: 'compact', sourceLine: '出典: 説明用の例', title: '小さな部品工場の現状ツリー:納期遅れと残業増'}).add(
    causeTree(
      [
        {id: 'u1', label: '納期遅れが続いている', role: 'ude'},
        {id: 'u2', label: '残業が増えている', role: 'ude'},
        {id: 'u3', label: '新人が辞めてしまう', role: 'ude'},
        {id: 'a1', label: '仕掛りが多い'},
        {id: 'a2', label: '急ぎの割り込みで作業の切り替えが増える'},
        {id: 'a3', label: '経験者に仕事が集中する'},
        {id: 'a4', label: '新人が何をすればいいか分からない'},
        {id: 'a5', label: '経験者に新人を教える時間がない'},
        {id: 'b1', label: '受注するとすぐ着手する'},
        {id: 'b2', label: '営業が納期を約束してしまう'},
        {id: 'b3', label: '見積もりが甘い'},
        {id: 'b4', label: '手順書が古い'},
        {id: 'b5', label: '手順書の更新が稼働に数えられない'},
        {id: 'c1', label: '営業が現場の状況を把握できない', role: 'root'},
        {id: 'c2', label: '現場が稼働率で評価されている', role: 'root'},
      ],
      [
        {from: 'c2', to: 'b1'}, {from: 'b1', to: 'a1'}, {from: 'a1', to: 'u1'},
        {from: ['c1', 'b3'], to: 'b2'}, {from: 'b2', to: 'a2'}, {from: 'a2', to: 'u1'},
        {from: 'b3', to: 'a3'}, {from: 'a3', to: 'u1'}, {from: 'u1', to: 'u2'}, {from: 'a3', to: 'u2'},
        {from: 'c2', to: 'b5'}, {from: 'b5', to: 'b4'}, {from: 'b4', to: 'a4'},
        {from: 'a3', to: 'a5'}, {from: 'a5', to: 'a4'}, {from: 'a4', to: 'u3'},
      ],
      {tree: 'crt'},
    ),
  );
}

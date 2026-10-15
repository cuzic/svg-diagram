import {causeTree, diagram} from 'svg-diagram';

// 移行ツリー(TT): 現状 + ニーズ + 行動 が合わさって、新しい現実になる(3 入力の AND)。
// `tree: 'tt'` を書くと、入力しか持たない節は、行き先の 1 つ手前の層に置かれる(ALAP。ADR 0019)。
export default function define() {
  return diagram({theme: 'blue', title: '着手の枠を入れる移行ツリー', sourceLine: '出典: 説明用の例'}).add(
    causeTree(
      [
        {id: 'n1', label: '枠の考え方を共有できた', role: 'io'},
        {id: 'n2', label: '枠の運用が回り始めた', role: 'io'},
        {id: 'n3', label: '納期を守れる', role: 'io'},
        {id: 'c1', label: '着手が受注順になっている', role: 'precondition'},
        {id: 'c2', label: '仕掛りが見える', role: 'precondition'},
        {id: 'x1', label: '営業と枠を話し合う', role: 'action'},
        {id: 'x2', label: '週次で枠を見直す', role: 'action'},
      ],
      [
        {from: ['c1', 'x1'], to: 'n1'},
        {from: ['n1', 'c2', 'x2'], to: 'n2'},
        {from: 'n2', to: 'n3'},
      ],
      {tree: 'tt'},
    ),
  );
}

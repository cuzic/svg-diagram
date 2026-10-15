import {causeTree, diagram} from 'svg-diagram';

// 未来現実ツリー(FRT): 施策(injection)が前提条件(precondition)と合わさって、望む結果(de)に届く。正の増幅ループを `back: true` で足す。
// `tree: 'frt'` を書くと、入力しか持たない節(前提条件)は、行き先の 1 つ手前の層に置かれる(ALAP。ADR 0019)。
export default function define() {
  return diagram({theme: 'blue', title: '受注の着手を絞る未来現実ツリー', sourceLine: '出典: 説明用の例'}).add(
    causeTree(
      [
        {id: 'de', label: '納期を守れる', role: 'de'},
        {id: 'gain', label: '顧客の信頼が増える'},
        {id: 'wip', label: '仕掛りが減る'},
        {id: 'focus', label: '1 つずつ仕上げる'},
        {id: 'cap', label: '着手の枠を決める', role: 'injection'},
        {id: 'fact', label: '受注の量は変えられない', role: 'precondition'},
        {id: 'sales', label: '営業が納期を相談できる', role: 'precondition'},
      ],
      [
        {from: 'cap', to: 'wip'},
        {from: 'wip', to: 'focus'},
        {from: ['focus', 'sales'], to: 'de'},
        {from: ['fact', 'cap'], to: 'focus'},
        {from: 'de', to: 'gain'},
        {from: 'gain', to: 'sales', back: true},
      ],
      {tree: 'frt'},
    ),
  );
}

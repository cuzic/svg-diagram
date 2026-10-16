import {causeTree, diagram} from 'svg-diagram';

// 前提条件ツリー(PRT): 目的に向かう中間目標(io)、その障害(obstacle)、障害を越える行動(action)。
// `tree: 'prt'` を書くと、入力しか持たない節(障害・行動)は、行き先の 1 つ手前の層に置かれる(ALAP。ADR 0019)。
// `roleTags: true` は、ゴールのように同じ見た目（アクセント色の二重枠）の役割を、節の下に【ゴール】と文字で書く（別の図の根本原因や施策と取り違えない）。
export default function define() {
  return diagram({theme: 'blue', title: '標準化を定着させる前提条件ツリー', legend: 'auto', sourceLine: '出典: 説明用の例'}).add(
    causeTree(
      [
        {id: 'goal', label: '標準手順が全拠点で使われる', role: 'goal'},
        {id: 'i1', label: '手順書が現場で読める形になる', role: 'io'},
        {id: 'i2', label: '拠点長が運用を支持する', role: 'io'},
        {id: 'i3', label: '手順の改善提案が集まる', role: 'io'},
        {id: 'o1', label: '手順書が長すぎる', role: 'obstacle'},
        {id: 'o2', label: '拠点長に手間の負担が見える', role: 'obstacle'},
        {id: 'a1', label: '1 枚に絞った版を作る', role: 'action'},
        {id: 'a2', label: '負担の少ない運用例を示す', role: 'action'},
        {id: 'a3', label: '提案の窓口と締め切りを決める', role: 'action'},
        {id: 'i4', label: '提案の様式が決まる', role: 'io'},
      ],
      [
        {from: 'o1', to: 'a1'}, {from: 'a1', to: 'i1'},
        {from: 'o2', to: 'a2'}, {from: 'a2', to: 'i2'},
        {from: 'a3', to: 'i4'}, {from: 'i4', to: 'i3'},
        {from: 'i1', to: 'goal'}, {from: 'i2', to: 'goal'}, {from: 'i3', to: 'i2'},
      ],
      {tree: 'prt', roleTags: true},
    ),
  );
}

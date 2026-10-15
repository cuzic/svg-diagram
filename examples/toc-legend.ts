import {causeTree, diagram} from 'svg-diagram';

// 凡例の自動生成: `legend: 'auto'` は causeTree の使った役割(`role`)と、AND の弧、中核ドライバーの印を拾って凡例にする。
// 使っていない役割は出ない。役割の既定の文言は `legendLabels: {'role:precondition': '与件'}` のように差し替えられる。
export default function define() {
  return diagram({theme: 'blue', legend: 'auto', title: '未来現実ツリーの凡例', sourceLine: '出典: 説明用の例'}).add(
    causeTree(
      [
        {id: 'inj', label: '着手の前に空き枠を確認する', role: 'injection'},
        {id: 'fact', label: '受注の量は変えられない', role: 'precondition'},
        {id: 'fix', label: '着手を絞る'},
        {id: 'ok', label: '納期を守れる', role: 'de'},
        {id: 'cost', label: '残業費が減る', role: 'de'},
      ],
      [
        {from: ['inj', 'fact'], to: 'fix'},
        {from: 'fix', to: 'ok'},
        {from: 'fix', to: 'cost'},
      ],
      {maxNodeW: 170},
    ),
  );
}

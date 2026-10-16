import {causeTree, diagram, transitionUnits} from 'svg-diagram';

// 移行ツリー(TT): 現状 + ニーズ + 行動 が合わさって、新しい現実になる(3 入力の AND)。前の単位の結果が、次の単位の現状になる。
// `transitionUnits()` は、この単位の並びから節と辺を作る(id は単位ごとに 1 つ: 結果の id。ニーズ・行動は `<id>.need`・`<id>.action`)。
// `tree: 'tt'` を書くと、入力しか持たない節は行き先の 1 つ手前の層に置かれ(ALAP。ADR 0019)、`tocCheck: 'strict'` で単位の形が検査される。
export default function define() {
  const {nodes, links} = transitionUnits([
    {id: 'u1', current: '着手が受注順になっている', need: '枠の考え方を共有したい', action: '営業と枠を話し合う', result: '枠の考え方を共有できた'},
    {id: 'u2', need: '枠を運用に乗せたい', action: '週次で枠を見直す', result: '枠の運用が回り始めた'},
    {id: 'u3', need: '納期を守りたい', action: '仕掛りを見える化する', result: '納期を守れる', resultRole: 'goal'},
  ]);
  return diagram({theme: 'blue', legend: 'auto', tocCheck: 'strict', title: '着手の枠を入れる移行ツリー', sourceLine: '出典: 説明用の例'}).add(
    causeTree(nodes, links, {tree: 'tt', roleTags: true}),
  );
}

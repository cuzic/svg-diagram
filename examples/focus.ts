import {caption, chevron, diagram, stateDiagram} from 'svg-diagram';

// focus（ADR 0051）: 図の中の「今ここ」。網の目の図は、つながる項目と矢印も強調する。並びの図は focus だけを塗る。
export default function define() {
  return diagram({theme: 'blue', title: '経費精算の承認（今ここ: 課長待ち）', legend: false}).add(
    caption('状態遷移図: focus の状態を塗り、前後の状態と矢印を強調色に', {bold: true, tone: 'text'}),
    stateDiagram(
      [{id: 'apply', label: '申請中'}, {id: 'mgr', label: '課長待ち'}, {id: 'dir', label: '部長待ち', sub: '10万円以上'}, {id: 'paid', label: '支払い済み', final: true}, {id: 'back', label: '差し戻し'}],
      [{from: 'apply', to: 'mgr', label: '申請'}, {from: 'mgr', to: 'dir', label: '10万円以上'}, {from: 'dir', to: 'paid', label: '承認'}, {from: 'mgr', to: 'back', label: '差し戻す'}, {from: 'back', to: 'apply', label: '直す'}],
      {initial: 'apply', focus: 'mgr'},
    ),
    caption('矢羽根: focus（番号でも指せる）だけを塗る', {bold: true, tone: 'text'}),
    chevron([{label: '申請'}, {label: '課長承認'}, {label: '部長承認'}, {label: '支払い'}], {focus: 2}),
  );
}

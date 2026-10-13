import {bpmn, diagram} from 'svg-diagram';

// 3 レーン・7 列の業務フロー。ふつうの寸法では 940px に収まらず throw する。fit: 'shrink' は、レーン名の列・列の間隔・タスクの幅を、収まるまで段階的に詰める。
export default function define() {
  return diagram({theme: 'blue', title: '経費精算のフロー', sourceLine: '出典: 業務フロー図(例)'}).add(
    bpmn(
      [{id: 'a', label: '申請者'}, {id: 'm', label: '上長'}, {id: 'f', label: '経理'}],
      [
        {id: 's', lane: 'a', kind: 'start', label: '出張から戻る'},
        {id: 'w', lane: 'a', label: '精算書を作成', sub: '領収書を添付'},
        {id: 'ap', lane: 'm', label: '内容を承認'},
        {id: 'g', lane: 'm', kind: 'xor', label: '承認'},
        {id: 'ck', lane: 'f', label: '領収書を照合'},
        {id: 'pay', lane: 'f', label: '振込を手配', sub: '月末締め翌月払い'},
        {id: 'e', lane: 'a', kind: 'end', label: '入金'},
      ],
      [
        {from: 's', to: 'w'}, {from: 'w', to: 'ap'}, {from: 'ap', to: 'g'},
        {from: 'g', to: 'ck', label: '承認'}, {from: 'g', to: 'w', label: '却下'},
        {from: 'ck', to: 'pay'}, {from: 'pay', to: 'e', line: 'dashed'},
      ],
      {fit: 'shrink'},
    ),
  );
}

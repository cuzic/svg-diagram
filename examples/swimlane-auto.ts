import {diagram, swimlane} from 'svg-diagram';

// 業務フロー: swimlane に手順の `kind` と `cols: 'auto'` を書くと、列は流れから決まる。
// 破線は、レーンをまたぐメッセージ。分岐の条件は、ゲートウェイから出る矢印の上に付ける。
export default function define() {
  return diagram({theme: 'blue', title: '注文の確認フロー', sourceLine: '出典: 業務フロー図(例)'}).add(
    swimlane(
      [{id: 'cust', label: '顧客'}, {id: 'shop', label: '店舗'}],
      [
        {id: 'start', lane: 'cust', kind: 'start', title: '注文'},
        {id: 'check', lane: 'shop', title: '在庫を確認'},
        {id: 'ok', lane: 'shop', kind: 'xor', title: '在庫'},
        {id: 'ship', lane: 'shop', title: '発送する', body: '送り状を発行'},
        {id: 'sorry', lane: 'shop', title: '欠品を連絡'},
        {id: 'done', lane: 'cust', kind: 'end', title: '受け取り'},
      ],
      {
        cols: 'auto',
        flows: [
          {from: 'start', to: 'check'},
          {from: 'check', to: 'ok'},
          {from: 'ok', to: 'ship', label: 'あり'},
          {from: 'ok', to: 'sorry', label: 'なし'},
          {from: 'ship', to: 'done'},
          {from: 'sorry', to: 'done', line: 'dashed'},
        ],
      },
    ),
  );
}

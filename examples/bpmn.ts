import {bpmn, diagram} from 'svg-diagram';

// BPMN 風の業務フロー: レーン(担当)を並べ、ノードと矢印を書くだけ。列は流れから、行はレーンから決まる。
// 破線は、レーンをまたぐメッセージ。分岐の条件は、ゲートウェイから出る矢印の上に付ける。
export default function define() {
  return diagram({theme: 'blue', title: '注文の処理フロー', sourceLine: '出典: 業務フロー図(例)'}).add(
    bpmn(
      [{id: 'cust', label: '顧客'}, {id: 'shop', label: '店舗'}, {id: 'wh', label: '倉庫'}],
      [
        {id: 'start', lane: 'cust', kind: 'start', label: '注文'},
        {id: 'check', lane: 'shop', label: '在庫を確認'},
        {id: 'ok', lane: 'shop', kind: 'xor', label: '在庫'},
        {id: 'ship', lane: 'wh', label: '出荷する', sub: '送り状を発行'},
        {id: 'sorry', lane: 'shop', label: '欠品を連絡'},
        {id: 'done', lane: 'cust', kind: 'end', label: '受け取り'},
        {id: 'cancel', lane: 'cust', kind: 'end', label: '取消'},
      ],
      [
        {from: 'start', to: 'check'},
        {from: 'check', to: 'ok'},
        {from: 'ok', to: 'ship', label: 'あり'},
        {from: 'ok', to: 'sorry', label: 'なし'},
        {from: 'ship', to: 'done', line: 'dashed'},
        {from: 'sorry', to: 'cancel', line: 'dashed'},
      ],
    ),
  );
}

import {bpmn, diagram} from 'svg-diagram';

// dir: 'v': レーンを列にして、流れを上から下へ。ゲートウェイの分岐は行き先に面した頂点から出し、戻る矢印と長い矢印は列の外側を回る。
// 失注は、受注するかの下(営業の列)で終わらせる。結末ごとに終了を分けると、遠い終了へ長い線を引かずに済む。
export default function define() {
  return diagram({theme: 'blue', title: '見積から入金確認までの業務フロー', sourceLine: '出典: 業務フロー図(例)'}).add(
    bpmn(
      [{id: 'cust', label: 'お客様'}, {id: 'sales', label: '営業'}, {id: 'office', label: '事務'}, {id: 'acc', label: '経理'}],
      [
        {id: 'req', lane: 'cust', kind: 'start', label: '見積を依頼'},
        {id: 'quote', lane: 'office', label: '見積書作成'},
        {id: 'check', lane: 'sales', label: '内容を確認'},
        {id: 'ok', lane: 'sales', kind: 'xor', label: '適切か'},
        {id: 'reply', lane: 'sales', label: 'お客様へ返信'},
        {id: 'won', lane: 'sales', kind: 'xor', label: '受注するか'},
        {id: 'lost', lane: 'sales', kind: 'end', label: '終了'},
        {id: 'ledger', lane: 'office', label: '受注台帳に入力'},
        {id: 'bill', lane: 'acc', label: '請求書発送'},
        {id: 'paid', lane: 'acc', kind: 'xor', label: '入金確認'},
        {id: 'done', lane: 'acc', kind: 'end', label: '完了'},
        {id: 'chase', lane: 'sales', label: '督促'},
      ],
      [
        {from: 'req', to: 'quote', line: 'dashed'},
        {from: 'quote', to: 'check', line: 'dashed'},
        {from: 'check', to: 'ok'},
        {from: 'ok', to: 'reply', label: '問題なし'},
        {from: 'ok', to: 'quote', line: 'dashed', label: '要修正'},
        {from: 'reply', to: 'won'},
        {from: 'won', to: 'ledger', line: 'dashed', label: '受注'},
        {from: 'won', to: 'lost', label: '失注'},
        {from: 'ledger', to: 'bill', line: 'dashed'},
        {from: 'bill', to: 'paid'},
        {from: 'paid', to: 'done', label: '入金あり'},
        {from: 'paid', to: 'chase', line: 'dashed', label: '入金なし'},
        {from: 'chase', to: 'paid', line: 'dashed'},
      ],
      {dir: 'v'},
    ),
  );
}

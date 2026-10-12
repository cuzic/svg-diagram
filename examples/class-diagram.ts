import {classDiagram, diagram} from 'svg-diagram';

// UML クラス図: クラスと関係を書くだけで、親が上になる層に自動配置する。矢印の端の記号は関係の種類(kind)で決まる。
export default function define() {
  return diagram({theme: 'blue', title: '注文まわりのクラス', sourceLine: '出典: 注文サービスの設計メモ(例)'}).add(
    classDiagram(
      [
        {id: 'Payable', stereotype: 'interface', methods: ['+ pay(amount: number)']},
        {id: 'Order', attrs: ['- id: string', '- total: number'], methods: ['+ addItem(item: Item)', '+ cancel()']},
        {id: 'Item', attrs: ['- sku: string', '- price: number']},
        {id: 'Customer', attrs: ['- name: string']},
        {id: 'Card', name: 'CardPayment', methods: ['+ pay(amount: number)']},
        {id: 'Bank', name: 'BankTransfer', methods: ['+ pay(amount: number)']},
      ],
      [
        {from: 'Card', to: 'Payable', kind: 'implement'},
        {from: 'Bank', to: 'Payable', kind: 'implement'},
        {from: 'Order', to: 'Payable', kind: 'depend', label: '支払い'},
        {from: 'Order', to: 'Item', kind: 'compose', fromMult: '1', toMult: '1..*'},
        {from: 'Customer', to: 'Order', kind: 'arrow', label: '注文する', fromMult: '1', toMult: '0..*'},
      ],
    ),
  );
}

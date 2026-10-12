import {diagram, stateDiagram} from 'svg-diagram';

// 状態遷移図: 状態と遷移を書くだけで、層に分けて自動配置する。戻る矢印・飛ばす矢印・自己ループも避けて引く。
export default function define() {
  return diagram({theme: 'blue', title: '注文の状態', sourceLine: '出典: 注文サービスの設計メモ(例)'}).add(
    stateDiagram(
      [
        {id: 'new', label: '受付済み'},
        {id: 'paid', label: '入金済み', tone: 'accent'},
        {id: 'ship', label: '出荷中', sub: '追跡番号あり'},
        {id: 'done', label: '完了', final: true},
        {id: 'cancel', label: 'キャンセル', tone: 'muted', final: true},
      ],
      [
        {from: 'new', to: 'paid', label: '入金'},
        {from: 'paid', to: 'ship', label: '出荷'},
        {from: 'ship', to: 'done', label: '到着'},
        {from: 'ship', to: 'ship', label: '再配達'},
        {from: 'new', to: 'cancel', label: '期限切れ', line: 'dashed'},
        {from: 'paid', to: 'new', label: '入金取消'},
      ],
      {initial: 'new'},
    ),
  );
}

import {diagram, journeyMap} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: '定期便のカスタマージャーニー'}).add(journeyMap(
    ['認知', '検討', '購入', '利用'],
    [
      {id: 'action', label: '行動', cells: ['広告を見る', '比較する', '申し込む', '商品を使う']},
      {id: 'touchpoint', label: 'タッチポイント', cells: ['SNS', '商品ページ', '決済画面', '同梱ガイド']},
      {id: 'emotion', label: '感情', cells: [0, -1, 1, 2]},
      {id: 'issue', label: '課題', cells: ['違いが不明', '送料が不明', '入力が多い', '交換日が不明']},
    ], {title: 'カスタマージャーニーマップ'}));
}

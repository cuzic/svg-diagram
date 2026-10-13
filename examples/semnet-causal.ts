import {causalLoop, diagram} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: '顧客体験の因果ループ'}).add(causalLoop([
    {id: 'quality', label: 'サービス品質'}, {id: 'satisfaction', label: '顧客満足'},
    {id: 'orders', label: '受注量'}, {id: 'load', label: '業務負荷'},
  ], [
    {from: 'quality', to: 'satisfaction', polarity: '+'},
    {from: 'satisfaction', to: 'orders', polarity: '+', delay: true},
    {from: 'orders', to: 'load', polarity: '+'},
    {from: 'load', to: 'quality', polarity: '-'},
  ], {height: 250}));
}

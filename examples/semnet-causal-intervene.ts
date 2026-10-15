import {causalLoop, diagram} from 'svg-diagram';

// interventions: points of leverage outside the loop. Dashed boxes and arrows in a band along one edge (the top for LR); the loop and its R/B name do not change.
export default function define() {
  return diagram({theme: 'blue', title: '悪循環のループと介入点'}).add(causalLoop([
    {id: 'pressure', label: '納期のプレッシャー'}, {id: 'shortcut', label: '手順の省略'},
    {id: 'defects', label: '不具合の増加'}, {id: 'rework', label: '手戻り作業'}, {id: 'overtime', label: '残業の常態化'},
  ], [
    {from: 'pressure', to: 'shortcut', polarity: '+'},
    {from: 'shortcut', to: 'defects', polarity: '+', delay: true},
    {from: 'defects', to: 'rework', polarity: '+'},
    {from: 'rework', to: 'overtime', polarity: '+'},
    {from: 'overtime', to: 'pressure', polarity: '+'},
  ], {
    interventions: [
      {id: 'standard', label: '標準の合意', to: 'shortcut', polarity: '-'},
      {id: 'quickwin', label: '早期の果実', to: 'pressure', polarity: '-', delay: true},
    ],
  }));
}

import {causalLoop, diagram} from 'svg-diagram';

// layout: 'ring' puts the nodes of a graph that is exactly one loop on an ellipse, the links as arcs (the default 'layered' lays a loop out as a band).
export default function define() {
  return diagram({theme: 'blue', title: '悪循環の因果ループ(円環)'}).add(causalLoop([
    {id: 'pressure', label: '納期のプレッシャー'}, {id: 'shortcut', label: '手順の省略'},
    {id: 'defects', label: '不具合の増加'}, {id: 'rework', label: '手戻り作業'}, {id: 'overtime', label: '残業の常態化'},
  ], [
    {from: 'pressure', to: 'shortcut', polarity: '+'},
    {from: 'shortcut', to: 'defects', polarity: '+', delay: true},
    {from: 'defects', to: 'rework', polarity: '+'},
    {from: 'rework', to: 'overtime', polarity: '+'},
    {from: 'overtime', to: 'pressure', polarity: '+'},
  ], {layout: 'ring'}));
}

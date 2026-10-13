import {diagram, pert} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'teal', appearance: 'dark', title: '並行するクリティカルパス'}).add(pert([
    {id: 's', label: '開始', duration: 0},
    {id: 'a', label: '基盤構築', duration: 5, predecessors: ['s']},
    {id: 'b', label: '運用設計', duration: 5, predecessors: ['s']},
    {id: 'c', label: '統合試験', duration: 3, predecessors: ['a', 'b']},
  ], {direction: 'TB', unit: '日', compact: true, height: 300}));
}

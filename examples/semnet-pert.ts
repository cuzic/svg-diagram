import {diagram, pert} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: '新サービス公開の PERT'}).add(pert([
    {id: 'plan', label: '要件整理', duration: 3},
    {id: 'design', label: '設計', duration: 4, predecessors: ['plan']},
    {id: 'copy', label: '原稿作成', duration: 2, predecessors: ['plan']},
    {id: 'build', label: '実装', duration: 6, predecessors: ['design']},
    {id: 'review', label: 'レビュー', duration: 2, predecessors: ['copy', 'build']},
    {id: 'release', label: '公開', duration: 1, predecessors: ['review']},
  ], {unit: '日', height: 330}));
}

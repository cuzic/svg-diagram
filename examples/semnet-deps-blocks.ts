import {dependencyNetwork, diagram} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'teal', appearance: 'dark', title: 'リリース阻害関係'}).add(dependencyNetwork([
    {id: 'release', label: '製品リリース', kind: 'milestone'}, {id: 'security', label: 'セキュリティ審査', kind: 'review'},
    {id: 'legal', label: '法務確認', kind: 'review'}, {id: 'docs', label: '利用ガイド', kind: 'artifact'},
  ], [
    {from: 'security', to: 'release', type: 'blocks', label: '未承認', weight: 4},
    {from: 'legal', to: 'release', type: 'blocks', label: '未承認', weight: 2},
    {from: 'docs', to: 'release', type: 'depends', label: '完成後'},
  ], {direction: 'TB', nodeKinds: {milestone: '節目', review: '審査', artifact: '成果物'}, edgeTypes: {blocks: '阻害', depends: '依存'}, height: 310}));
}

import {diagram, mindmap} from 'svg-diagram';

// 特性要因図（フィッシュボーン）: 頭が特性（結果）、大骨がカテゴリ（4M: 人・機械・方法・材料）、その下に要因（中骨）と、さらにその原因（小骨）。
// ルートの子がカテゴリ、その子が要因、孫以下は要因の下に字下げでぶら下がる。
const topic = {
  label: '寸法のばらつき', tone: 'accent' as const,
  children: [
    {label: '人', children: [{label: '作業者の経験差', children: [{label: '新人が多い'}, {label: '教育の記録がない'}]}, {label: '測定のくせ'}]},
    {label: '機械', children: [{label: '刃物の摩耗', children: [{label: '交換の基準がない'}]}, {label: '主軸の振れ'}]},
    {label: '方法', children: [{label: '段取りが人によって違う', children: [{label: '手順書が古い'}]}, {label: '検査の頻度'}]},
    {label: '材料', children: [{label: 'ロットごとの硬さ差', children: [{label: '仕入先が複数'}]}, {label: '保管中の変形'}]},
  ],
};

export default function define() {
  return diagram({theme: 'blue', title: '寸法のばらつきの特性要因図', sourceLine: '出典: 説明用の例'}).add(mindmap(topic, {layout: 'fishbone', maxNodeW: 150}));
}

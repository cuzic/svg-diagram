import {diagram, mindmap} from 'svg-diagram';

// 同じ内容を、`layout` を替えるだけで別の形にできる。この図は layout: 'org'。
const topic = {
  label: '開発本部', tone: 'accent' as const,
  children: [
    {label: 'プラットフォーム', children: [{label: 'インフラ'}, {label: 'SRE'}, {label: 'セキュリティ'}]},
    {label: 'プロダクト', children: [{label: 'Web'}, {label: 'モバイル'}]},
    {label: 'データ', children: [{label: '分析基盤'}]},
  ],
};

export default function define() {
  return diagram({theme: 'blue', title: '開発本部の体制(組織図型)'}).add(mindmap(topic, {layout: 'org'}));
}

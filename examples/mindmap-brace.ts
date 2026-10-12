import {diagram, mindmap} from 'svg-diagram';

// 同じ内容を、`layout` を替えるだけで別の形にできる。この図は layout: 'brace'。
const topic = {
  label: '新機能', tone: 'accent' as const,
  children: [
    {label: '目的', children: [{label: '棚卸しを半分に'}, {label: '欠品の防止'}]},
    {label: '機能', children: [{label: 'バーコード'}, {label: '発注アラート'}, {label: 'CSV 出力'}]},
    {label: '課題', children: [{label: '既存システム連携'}, {label: '現場の端末'}]},
  ],
};

export default function define() {
  return diagram({theme: 'blue', title: '新機能の検討(ブレース型)'}).add(mindmap(topic, {layout: 'brace'}));
}

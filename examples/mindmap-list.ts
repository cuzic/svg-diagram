import {diagram, mindmap} from 'svg-diagram';

// 同じ内容を、`layout` を替えるだけで別の形にできる。この図は layout: 'list'。
const topic = {
  label: '議題', tone: 'accent' as const,
  children: [
    {label: '進捗の確認', children: [{label: '開発'}, {label: '営業'}]},
    {label: '課題', children: [{label: '在庫の差異'}, {label: '端末の遅延'}]},
    {label: '次の予定'},
  ],
};

export default function define() {
  return diagram({theme: 'blue', title: '今週の議題(リスト型)'}).add(mindmap(topic, {layout: 'list'}));
}

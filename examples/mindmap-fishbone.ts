import {diagram, mindmap} from 'svg-diagram';

// 同じ内容を、`layout` を替えるだけで別の形にできる。この図は layout: 'fishbone'。
const topic = {
  label: '在庫のずれ', tone: 'accent' as const,
  children: [
    {label: '人', children: [{label: '入力ミス'}, {label: '教育不足'}]},
    {label: '手順', children: [{label: '棚卸しの頻度'}, {label: '返品の扱い'}]},
    {label: '設備', children: [{label: 'スキャナの誤読'}, {label: '端末の遅延'}]},
    {label: '情報', children: [{label: '商品コードの重複'}, {label: '更新の遅れ'}]},
  ],
};

export default function define() {
  return diagram({theme: 'blue', title: '在庫のずれの原因(フィッシュボーン)'}).add(mindmap(topic, {layout: 'fishbone'}));
}

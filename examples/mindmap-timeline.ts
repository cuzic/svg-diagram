import {diagram, mindmap} from 'svg-diagram';

// 同じ内容を、`layout` を替えるだけで別の形にできる。この図は layout: 'timeline'。
const topic = {
  label: '新機能の計画', tone: 'accent' as const,
  children: [
    {label: '10 月 要件', children: [{label: '課題の洗い出し'}, {label: '承認'}]},
    {label: '11 月 設計', children: [{label: '画面設計'}, {label: 'API 設計'}]},
    {label: '12 月 実装', children: [{label: 'アプリ'}, {label: 'API'}, {label: 'テスト'}]},
    {label: '1 月 公開', children: [{label: '現場への展開'}]},
  ],
};

export default function define() {
  return diagram({theme: 'blue', title: '新機能の計画(タイムライン型)'}).add(mindmap(topic, {layout: 'timeline'}));
}

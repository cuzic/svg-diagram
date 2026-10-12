import {diagram, mindmap} from 'svg-diagram';

// マインドマップ: 中央のテーマから、枝が左右に自動で伸びる。`sides` で、ある枝を左右どちらかに寄せられる。
export default function define() {
  return diagram({theme: 'blue', title: '在庫管理アプリの検討項目'}).add(
    mindmap({
      label: '在庫管理アプリ', tone: 'accent',
      children: [
        {label: '目的', children: [{label: '棚卸しの時間を半分に'}, {label: '欠品の防止'}]},
        {label: '機能', children: [{label: 'バーコード読み取り'}, {label: '発注点アラート'}, {label: 'CSV 出力'}]},
        {label: '課題', id: 'issues', children: [{label: '既存システムとの連携'}, {label: '現場の端末'}]},
        {label: '体制', children: [{label: '担当者'}, {label: '教育'}]},
      ],
    }, {sides: {issues: 'left'}}),
  );
}

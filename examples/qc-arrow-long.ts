import {arrowDiagram, diagram} from 'svg-diagram';

// 長い工程は `dir: 'down'` で縦に流す（横に並べると幅に収まらないとき）。ダミー（点線）は、別々の作業の順序だけを結ぶ。
export default function define() {
  return diagram({theme: 'blue', title: '新サービス立ち上げの日程（縦向き）', sourceLine: '出典: 説明用の例'}).add(
    ...arrowDiagram([
      {from: 1, to: 2, name: '要件定義', days: 5},
      {from: 2, to: 3, name: '設計', days: 8},
      {from: 2, to: 4, name: '契約手続き', days: 6},
      {from: 3, to: 5, name: '開発', days: 12},
      {from: 4, to: 6, name: '環境準備', days: 4},
      {from: 3, to: 4, dummy: true},
      {from: 5, to: 7, name: 'テスト', days: 6},
      {from: 6, to: 7, name: '教育資料', days: 3},
      {from: 6, to: 5, dummy: true},
      {from: 7, to: 8, name: '公開', days: 1},
    ], {dir: 'down'}),
  );
}

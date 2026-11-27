import {diagram, forest} from 'svg-diagram';

// フォレストプロット: 架空の学習アプリを、10 の拠点で試したときの、課程を終えた人のオッズ比(作り話のデータ)。
// 四角の大きさは重み、横の線は 95% 区間、ひし形は全体の統合。基準の線(1)より右なら、新方式が良い。
export default function define() {
  return diagram({theme: 'blue', title: '拠点ごとの修了のオッズ比', sourceLine: '出典: 説明用の作り話のデータ'}).add(
    forest(
      [
        {heading: '東の地域'},
        {label: '拠点 A', estimate: 1.54, low: 1.22, high: 1.95, weight: 180},
        {label: '拠点 B', estimate: 1.31, low: 0.98, high: 1.75, weight: 140},
        {label: '拠点 C', estimate: 0.92, low: 0.61, high: 1.39, weight: 70},
        {label: '拠点 D', estimate: 1.88, low: 1.4, high: 2.52, weight: 150},
        {label: '拠点 E', estimate: 2.6, low: 1.15, high: 5.9, weight: 25},
        {heading: '西の地域'},
        {label: '拠点 F', estimate: 1.12, low: 0.84, high: 1.49, weight: 130},
        {label: '拠点 G', estimate: 0.74, low: 0.41, high: 1.33, weight: 40},
        {label: '拠点 H', estimate: 1.4, low: 1.1, high: 1.78, weight: 200},
        {label: '拠点 I', estimate: 1.05, low: 0.7, high: 1.57, weight: 60},
        {label: '拠点 J', estimate: 0.55, low: 0.22, high: 1.38, weight: 15},
        {label: '全体(統合)', estimate: 1.29, low: 1.12, high: 1.49, summary: true},
      ],
      {valueHeader: 'OR (95% CI)', axisLabel: 'オッズ比(対数目盛)', favours: ['従来が良い', '新方式が良い']},
    ),
  );
}

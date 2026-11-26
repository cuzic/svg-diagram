import {diagram, forest} from '../../lib/dsl.ts';
// Invented data (made up for this ADR): ten made-up sites of a trial of a study-aid app, odds ratio of finishing a course.
export default function define() {
  return diagram({theme: 'blue', title: '会場ごとの修了のオッズ比(例・作り話)'}).add(
    forest([
      {heading: '東の会場'},
      {label: '会場 A', estimate: 1.54, low: 1.22, high: 1.95, weight: 180},
      {label: '会場 B', estimate: 1.31, low: 0.98, high: 1.75, weight: 140},
      {label: '会場 C', estimate: 0.92, low: 0.61, high: 1.39, weight: 70},
      {label: '会場 D', estimate: 1.88, low: 1.40, high: 2.52, weight: 150},
      {label: '会場 E', estimate: 2.60, low: 1.15, high: 5.90, weight: 25},
      {heading: '西の会場'},
      {label: '会場 F', estimate: 1.12, low: 0.84, high: 1.49, weight: 130},
      {label: '会場 G', estimate: 0.74, low: 0.41, high: 1.33, weight: 40},
      {label: '会場 H', estimate: 1.40, low: 1.10, high: 1.78, weight: 200},
      {label: '会場 I', estimate: 1.05, low: 0.70, high: 1.57, weight: 60},
      {label: '会場 J', estimate: 0.55, low: 0.22, high: 1.38, weight: 15},
      {label: '全体(統合)', estimate: 1.29, low: 1.12, high: 1.49, summary: true},
    ], {scale: 'log', valueHeader: 'OR (95% CI)', axisLabel: 'オッズ比(対数目盛)', favours: ['対照が良い', 'アプリが良い']}),
  );
}

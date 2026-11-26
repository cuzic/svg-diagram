import {diagram, forest} from '../../lib/dsl.ts';
// Invented data: a made-up trial of a reading-aid app, odds ratio of finishing a course, by subgroup.
export default function define() {
  return diagram({theme: 'blue', title: '修了のオッズ比(例・作り話)'}).add(
    forest([
      {heading: '年代'},
      {label: '20代', estimate: 1.54, low: 1.22, high: 1.95, weight: 180},
      {label: '30代', estimate: 1.31, low: 0.98, high: 1.75, weight: 140},
      {label: '40代以上', estimate: 0.92, low: 0.61, high: 1.39, weight: 70},
      {heading: '利用の頻度'},
      {label: '週 3 回以上', estimate: 1.88, low: 1.40, high: 2.52, weight: 150},
      {label: '週 1〜2 回', estimate: 1.12, low: 0.84, high: 1.49, weight: 130},
      {label: '週 1 回未満', estimate: 0.74, low: 0.41, high: 1.33, weight: 40},
      {heading: '受講の形'},
      {label: 'オンライン', estimate: 1.40, low: 1.10, high: 1.78, weight: 200},
      {label: '対面', estimate: 1.05, low: 0.70, high: 1.57, weight: 60},
      {label: '全体', estimate: 1.29, low: 1.12, high: 1.49, summary: true},
    ], {scale: 'log', ref: 1, valueHeader: 'OR (95% CI)', axisLabel: 'オッズ比(対数目盛)', favours: ['対照が良い', 'アプリが良い']}),
  );
}

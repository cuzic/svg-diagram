import {diagram, forest} from '../../lib/dsl.ts';
// Invented data: 22 made-up rows, to find how many rows a 16:9 slide holds at 9pt or more.
export default function define() {
  return diagram({theme: 'blue', title: '行の多いフォレストプロット(例・作り話)'}).add(
    forest([
      {label: '会場 1', estimate: 0.91, low: 0.6, high: 1.29, weight: 174},
      {label: '会場 2', estimate: 1.22, low: 0.79, high: 1.91, weight: 140},
      {label: '会場 3', estimate: 0.94, low: 0.7, high: 1.69, weight: 140},
      {label: '会場 4', estimate: 1.3, low: 0.85, high: 1.87, weight: 58},
      {label: '会場 5', estimate: 0.9, low: 0.7, high: 1.58, weight: 119},
      {label: '会場 6', estimate: 1.56, low: 0.97, high: 1.93, weight: 171},
      {label: '会場 7', estimate: 0.66, low: 0.4, high: 1.12, weight: 88},
      {label: '会場 8', estimate: 1.21, low: 0.74, high: 2.09, weight: 129},
      {label: '会場 9', estimate: 1.11, low: 0.66, high: 1.63, weight: 54},
      {label: '会場 10', estimate: 1.74, low: 1.38, high: 2.23, weight: 75},
      {label: '会場 11', estimate: 0.94, low: 0.59, high: 1.57, weight: 97},
      {label: '会場 12', estimate: 1.15, low: 0.68, high: 1.78, weight: 156},
      {label: '会場 13', estimate: 1.36, low: 0.88, high: 2.37, weight: 194},
      {label: '会場 14', estimate: 1.79, low: 1.47, high: 2.45, weight: 175},
      {label: '会場 15', estimate: 1.47, low: 1.13, high: 2.52, weight: 158},
      {label: '会場 16', estimate: 1.78, low: 1.15, high: 2.9, weight: 74},
      {label: '会場 17', estimate: 1.42, low: 0.79, high: 1.93, weight: 51},
      {label: '会場 18', estimate: 0.68, low: 0.4, high: 1.22, weight: 42},
      {label: '会場 19', estimate: 1.05, low: 0.85, high: 1.83, weight: 25},
      {label: '会場 20', estimate: 0.98, low: 0.59, high: 1.69, weight: 31},
      {label: '会場 21', estimate: 1.39, low: 0.84, high: 1.98, weight: 170},
      {label: '会場 22', estimate: 1.03, low: 0.6, high: 1.84, weight: 149},
      {label: '全体(統合)', estimate: 1.2, low: 1.08, high: 1.33, summary: true},
    ], {scale: 'log', valueHeader: 'OR (95% CI)', axisLabel: 'オッズ比(対数目盛)', favours: ['対照が良い', 'アプリが良い']}),
  );
}

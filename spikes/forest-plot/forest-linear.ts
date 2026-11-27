import {diagram, forest} from '../../lib/dsl.ts';
// Invented data: mean difference (minutes), linear scale, ref 0, no weights.
export default function define() {
  return diagram({theme: 'blue', title: '平均の差(分・例・作り話)'}).add(
    forest([
      {label: '朝の部', estimate: -4.2, low: -7.9, high: -0.5},
      {label: '昼の部', estimate: 1.1, low: -2.4, high: 4.6},
      {label: '夜の部', estimate: -2.0, low: -5.1, high: 1.1},
      {label: '全体', estimate: -1.8, low: -3.6, high: 0.0, summary: true},
    ], {decimals: 1, valueHeader: '差 (95% CI)', favours: ['新しい手順が速い', '今の手順が速い']}),
  );
}

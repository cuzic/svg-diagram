import {diagram, rangeBars} from '../../lib/dsl.ts';
// Baseline: the same ten invented rows as rangeBars (no point, no reference line, no log scale).
export default function define() {
  return diagram({theme: 'blue', title: '会場ごとの修了のオッズ比(例・作り話)'}).add(
    rangeBars([
      {label: '会場 A', range: [1.22, 1.95]}, {label: '会場 B', range: [0.98, 1.75]}, {label: '会場 C', range: [0.61, 1.39]},
      {label: '会場 D', range: [1.40, 2.52]}, {label: '会場 E', range: [1.15, 5.90]}, {label: '会場 F', range: [0.84, 1.49]},
      {label: '会場 G', range: [0.41, 1.33]}, {label: '会場 H', range: [1.10, 1.78]}, {label: '会場 I', range: [0.70, 1.57]},
      {label: '会場 J', range: [0.22, 1.38]}, {label: '全体(統合)', range: [1.12, 1.49]},
    ], {valueFormat: 2}),
  );
}

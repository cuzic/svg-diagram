import {burndown, diagram} from 'svg-diagram';

// バーンダウン: 残り作業量（ポイント）を日ごとに。破線が理想線、実線が実績（まだ来ていない日は null）。
// lines() の `target` で目標線、`annotate` で注目点も付けられる。
export default function define() {
  return diagram({theme: 'blue', title: 'スプリント 12 のバーンダウン', sourceLine: '出典: 説明用の例'}).add(
    burndown(
      {total: 80, days: 10, actual: [80, 78, 72, 70, 61, 58, 49, null, null, null, null]},
      {y: {label: '残りポイント'}, annotate: [{at: [3, 70], label: '仕様変更で増加', labelAt: 'above'}]},
    ),
  );
}

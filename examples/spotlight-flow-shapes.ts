// 強調（spotlight）の外に置いた、色（tone）付きの図形。暗くなった帯の図形は、枠と文字が muted で、塗りは白になる
// （以前は、塗りも muted になって、文字と同じ色になり、lint が止めていた）。強調の中の図形は、そのまま。
// ビルド: svg-diagram build examples/spotlight-flow-shapes.ts --out examples/out/spotlight-flow-shapes.svg
import {caption, chevron, diagram, emblem, funnel} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: '強調の外の図形', spotlight: 'now'}).add(
    caption('いまは「実装」', {role: 'title'}),
    chevron([{id: 'plan', label: '計画'}, {id: 'now', label: '実装', tone: 'accent'}, {id: 'test', label: '検証'}]),
    funnel([{label: '訪問', tone: 'accent'}, {label: '登録', tone: 'muted'}, {label: '成約', tone: 'danger'}]),
    emblem([{label: '重要', shape: 'hexagon', tone: 'accent'}, {label: '注意', shape: 'triangle', tone: 'danger'}, {label: '済み', shape: 'circle', tone: 'new'}, {label: '顧客DB', shape: 'cylinder', tone: 'accent'}, {label: '開始', shape: 'pill', tone: 'danger'}]),
  );
}

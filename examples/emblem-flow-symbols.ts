// 流れ図で使う記号を、emblem() の shape で置く。端子（開始・終了）・処理（角丸）・判断・データ（平行四辺形）・手作業（逆台形）・
// 準備（六角形）・書類・データベース（円柱）・他ページへの接続（五角形）。台形はピラミッドの層などにも使える。
// ビルド: svg-diagram build examples/emblem-flow-symbols.ts --out examples/out/emblem-flow-symbols.svg
import {caption, diagram, emblem} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: '流れ図の記号', accept: {'gray-tone-collision': '色の違う図形は、形でも区別している'}}).add(
    caption('流れ図の記号', {role: 'title'}),
    emblem([
      {label: '開始', shape: 'pill'},
      {label: '処理', sub: '集計する', shape: 'rounded'},
      {label: '判断', sub: '承認済みか', shape: 'diamond', tone: 'muted'},
      {label: 'データ', sub: '入力', shape: 'parallelogram'},
      {label: '手作業', shape: 'inverted-trapezoid'},
      {label: '準備', shape: 'hexagon'},
    ], {minSize: 112}),
    caption('記録と接続', {role: 'note'}),
    emblem([
      {label: '報告書', shape: 'document', tone: 'accent'},
      {label: '顧客DB', shape: 'cylinder', tone: 'accent'},
      {label: 'A へ', shape: 'pentagon'},
      {label: '土台', shape: 'trapezoid', tone: 'new'},
    ], {minSize: 112}),
  );
}

// 図形の中に文字を入れる emblem()。形（shape）は circle / square / triangle / diamond / hexagon。
// 形は文字に合わせて大きくなり（同じ帯の中は同じ大きさ）、幅が足りなければ次の行へ折り返す。tone で色、sub で小さな補足行。
// ビルド: svg-diagram build examples/emblem-shapes.ts --out examples/out/emblem-shapes.svg
import {caption, diagram, emblem} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: '図形に文字を入れる'}).add(
    caption('形ごとの見え方', {role: 'title'}),
    emblem([
      {id: 'c', label: '課題', sub: '現状の把握', shape: 'circle'},
      {id: 's', label: '施策', sub: '3 案', shape: 'square', tone: 'accent'},
      {id: 't', label: '重要', sub: '期限厳守', shape: 'triangle', tone: 'danger'},
      {id: 'd', label: '判断', sub: '承認は要るか', shape: 'diamond', tone: 'muted'},
      {id: 'h', label: '実行', sub: '担当を決める', shape: 'hexagon', tone: 'new'},
    ], {minSize: 128}),
    caption('小さな円に番号（minSize は最小の幅）', {role: 'note'}),
    emblem([{id: 'n1', label: '1'}, {id: 'n2', label: '2'}, {id: 'n3', label: '3', tone: 'accent'}], {minSize: 64}),
  );
}

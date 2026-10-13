// 順序だけの出来事(日付なし)。番号バッジ、アイコン、強調1つ、矢印。bracket で区間を示す。
import {bracket, caption, diagram, steps} from 'svg-diagram';

export default function define() {
  const s = steps([
    {title: '1回目', body: '原因は不明'},
    {title: '2回目', body: '手で復旧'},
    {title: '3回目', body: '手で復旧'},
    {title: '4回目', body: '同じ原因と判明', tag: '気づく'},
    {title: '5回目', body: '自動で遮断', icon: 'shield'},
  ], {numbered: true, highlight: 5, id: 's'});
  return diagram({theme: 'blue', title: '再発から遮断まで'}).add(
    caption('4回の再発のあと、5回目で遮断する', {bold: true, tone: 'text'}),
    s,
    bracket(s.col(2).left, s.col(4).right, {label: '手で復旧していた区間'}),
  );
}

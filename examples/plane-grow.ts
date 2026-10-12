import {caption, diagram, plane} from 'svg-diagram';

// 1 本の滑らかな曲線を、通る点の順に伸ばす（grow）。点のラベルは、線と重なるときは自動で逃げる（labelAt を書かない点）
export default function define() {
  return diagram({theme: 'blue', title: '号令から半年'}).add(
    caption('plane の path に grow（点が出た分だけ曲線が伸びる）', {bold: true, tone: 'text'}),
    plane({
      x: {label: '月', max: 6, step: 1}, y: {label: '定着率', max: 100, step: 25}, height: 320,
      points: [
        {id: 'p0', at: [0, 10], label: '号令'},
        {id: 'p1', at: [1, 30], label: '1 か月', reveal: 1},
        {id: 'p3', at: [3, 62], label: '3 か月', reveal: 2},
        {id: 'p6', at: [6, 76], label: '半年後', reveal: 3, tone: 'danger'},
      ],
      paths: [{through: ['p0', 'p1', 'p3', 'p6'], smooth: true, grow: true, arrow: true}],
    }),
  );
}

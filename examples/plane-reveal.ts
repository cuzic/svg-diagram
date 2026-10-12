import {caption, diagram, plane} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: '座標平面の点を順に出す'}).add(
    caption('plane の要素に reveal を付ける（点のラベルは点と一緒に出る）', {bold: true, tone: 'text'}),
    plane({
      x: {label: '時間', max: 10, step: 2}, y: {label: '誤差', max: 10, step: 2}, height: 320,
      points: [
        {id: 'start', at: [1, 8], label: '導入前', labelAt: 'above'},
        {id: 'mid', at: [5, 6], label: '3 か月後', labelAt: 'above', reveal: 1},
        {id: 'goal', at: [9, 2], label: '1 年後', reveal: 3, tone: 'danger'},
      ],
      paths: [{through: ['start', 'mid', 'goal'], smooth: true, arrow: true}],
      dims: [{from: 'start', to: 'mid', label: '-2', side: 'below', reveal: 2}],
      labels: [{at: [7, 8], text: '目標は誤差 2 以下', anchor: 'start', reveal: 3}],
    }),
  );
}

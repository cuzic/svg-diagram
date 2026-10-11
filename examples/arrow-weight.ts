import {box, caption, connect, diagram, row} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: '同じ力の綱引き', legend: 'auto', gap: 64}).add(
    caption('weight: 強い流れ(同じ力の 2 本)と通常の矢印', {bold: true, tone: 'text'}),
    row([
      box({id: 'left', title: '左のチーム', body: '力 100'}),
      box({id: 'rope', title: '綱'}),
      box({id: 'right', title: '右のチーム', body: '力 100'}),
    ], {gap: 96}),
    box({id: 'note', title: '結果', body: '動かない(つり合い)'}),
    connect('left:right', 'rope:left', {weight: 'strong', label: '100'}),
    connect('right:left', 'rope:right', {weight: 'strong', label: '100'}),
    connect('rope:bottom', 'note:top'),
  );
}

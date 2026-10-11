import {box, caption, connect, diagram, row} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: '主役に接する流れを残す', spotlight: 'decision'}).add(
    caption('spotlight（既定 edges: touching）', {bold: true, tone: 'text'}),
    row([
      box({id: 'input', title: '候補を集める', body: '前段の処理'}),
      box({id: 'decision', title: '判断する', body: '今回の主役'}),
      box({id: 'archive', title: '記録する', body: '後段の処理', dashed: true}),
    ]),
    connect('input:right', 'decision:left'),
    connect('decision:right', 'archive:left'),
  );
}

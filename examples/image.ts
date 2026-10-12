import {box, caption, connect, diagram, image, row} from 'svg-diagram';

// 絵の上の文字は、必ず不透明な板（plate）に載る。絵の画素は検査できないので、板なしの文字は書けない。
export default function define() {
  const kitchen = image('./assets/kitchen.png', {
    id: 'kitchen', alt: '台所。左にコンロと赤い鍋、右に窓がある', width: 480,
    marks: [
      {id: 'pot', rect: [0.16, 0.42, 0.24, 0.3], tone: 'danger', label: '火の元'},
      {id: 'window', rect: [0.62, 0.12, 0.3, 0.38], label: '窓'},
    ],
    labels: [{text: '台所', at: [0.02, 0.06], tone: 'solid'}],
  });
  return diagram({theme: 'blue', title: '台所の絵に印と文字を重ねる'}).add(
    caption('image（絵を部品として置き、上に印と文字を重ねる）', {bold: true, tone: 'text'}),
    kitchen,
    row([box({id: 'note', title: '見る所', body: '鍋の火の元を確認する'})]),
    connect(kitchen.anchors.pot.bottom, 'note:top'),
  );
}

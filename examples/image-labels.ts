import {caption, diagram, image} from 'svg-diagram';

// ラベルの位置は絵に対する割合 at: [fx, fy]。絵が決まってから、この数字だけ直せばよい（絵を差し替えても座標は割合のまま）。
// anchor は板のどの端を at に合わせるか（start=左端 / middle=中央 / end=右端）。板の大きさは文字から決まり、絵の外にはみ出す位置は内側に寄せられる。
export default function define() {
  return diagram({theme: 'blue', title: '食事の 4 つの選び方'}).add(
    caption('image + labels（板つきの文字 4 つ。位置は割合）', {bold: true, tone: 'text'}),
    image('./assets/kitchen.png', {
      alt: '台所', width: 640,
      labels: [
        {text: '冷凍食品を温める', at: [0.04, 0.12]},
        {text: '一品足す', at: [0.96, 0.12], anchor: 'end'},
        {text: 'ミールキット', at: [0.04, 0.88], tone: 'accent'},
        {text: '食材から作る', at: [0.96, 0.88], anchor: 'end', tone: 'solid'},
      ],
    }),
  );
}

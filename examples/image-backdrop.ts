import {box, connect, diagram, image, row, } from 'svg-diagram';

// 絵を背景にして、その上に普通の箱・矢印を重ねる（over）。重ねた部品は絵の上端から group のように積まれる。
// 文字は不透明な箱（や板）の上にだけ置ける。素の文字（caption など）を絵の上に置くと、描画後の検査が止める。
export default function define() {
  const kitchen = image('./assets/kitchen.png', {
    alt: '台所。左にコンロと赤い鍋、右に窓がある', width: 640, pad: 24,
    marks: [{id: 'pot', rect: [0.16, 0.42, 0.24, 0.3], tone: 'danger'}],
    over: [
      row([box({id: 'step', title: '1. 火を止める', body: '鍋の火の元を確認する', tone: 'plain'}), box({id: 'next', title: '2. 窓を開ける'})], {gap: 24, justify: 'start'}),
    ],
  });
  return diagram({theme: 'blue', title: '台所の絵の上に箱と矢印を重ねる'}).add(
    kitchen,
    connect(kitchen.anchors.pot.top, 'step:bottom'),
  );
}

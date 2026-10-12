import {caption, diagram, image} from 'svg-diagram';

// spotlight は絵の中の印にも使える。指した印の中だけが明るく残り、ほかは白いベールで薄くなる。
export default function define() {
  return diagram({theme: 'blue', title: '絵の一部だけを主役にする', spotlight: 'pot'}).add(
    caption('image + spotlight（印の id を指す）', {bold: true, tone: 'text'}),
    image('./assets/kitchen.png', {
      alt: '台所。左にコンロと赤い鍋、右に窓がある', width: 480,
      marks: [
        {id: 'pot', rect: [0.16, 0.42, 0.24, 0.3], tone: 'danger', label: '火の元'},
        {id: 'window', rect: [0.62, 0.12, 0.3, 0.38], label: '窓'},
      ],
    }),
  );
}

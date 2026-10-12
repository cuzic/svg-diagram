import {caption, diagram, people, row, stat} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: '100 人中 76 人'}).add(
    caption('100 人中 76 人が導入前に離脱した', {bold: true, tone: 'text'}),
    people(100, 76, {tone: 'danger', alt: '100 人中 76 人'}),
    row([
      stat('76 人', '離脱した', {tone: 'danger'}),
      stat('24 人', '残った', {tone: 'accent'}),
    ]),
  );
}

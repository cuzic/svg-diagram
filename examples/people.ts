import {caption, diagram, people} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: '100 人中 76 人'}).add(
    caption('100 人中 76 人が導入前に離脱した', {bold: true, tone: 'text'}),
    people(100, 76, {size: 24, gap: 6, tone: 'accent', alt: '100 人中 76 人', side: {value: '76%', label: '離脱した', tone: 'accent', size: 'display'}}),
    people(100, 82, {size: 24, gap: 6, tone: 'muted', rest: 'muted', alt: '100 人中 82 人', side: {value: '82%', label: '経営者の認識', tone: 'muted', size: 'display'}}),
  );
}

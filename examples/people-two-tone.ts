import {caption, diagram, people} from 'svg-diagram';

// 1 つの格子に 2 つの人数: 先頭の 35 人を accent、続く 47 人を danger、残りは輪郭。
export default function define() {
  return diagram({theme: 'blue', title: '100 人中 35 人と 47 人'}).add(
    caption('100 人のうち、35 人と 47 人', {bold: true, tone: 'text'}),
    people(100, [35, 47], {size: 24, gap: 6, tone: 'accent', tone2: 'danger', alt: '100 人中、35 人と 47 人', side: {value: '35% / 47%', label: '青 35 人・赤 47 人', size: 'stat'}}),
  );
}

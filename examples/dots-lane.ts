import {caption, diagram, dots} from 'svg-diagram';

// 理解の速さを横軸に、受講者を点で置く。左端の「ついてこれない人」は帯と点の色で示す。
const pace = [0.04, 0.06, 0.07, 0.09, 0.1, 0.12, 0.13, 0.15, 0.17, 0.2, 0.22, 0.26, 0.4, 0.45, 0.48, 0.5, 0.52, 0.55, 0.6, 0.62, 0.7, 0.75, 0.8, 0.9];

export default function define() {
  return diagram({theme: 'blue', title: 'レーン上の点の分布'}).add(
    caption('受講者の理解の速さ', {bold: true, tone: 'text'}),
    dots(pace, {
      zones: [{from: 0, to: 0.3, label: 'ついてこれない人'}, {from: 0.3, to: 1, label: 'ついてこれる人', tone: 'accent'}],
      lowLabel: '遅い', highLabel: '速い',
      alt: '24 人の分布。左端の 12 人がついてこれない',
    }),
  );
}

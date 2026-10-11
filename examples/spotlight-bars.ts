import {bars, caption, diagram} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: '棒を 1 本だけ主役にする', spotlight: 'q3'}).add(
    caption('spotlight（bars の棒を 1 本だけ指す）', {bold: true, tone: 'text'}),
    bars([
      {id: 'q1', label: '第1四半期', value: 120},
      {id: 'q2', label: '第2四半期', value: 150},
      {id: 'q3', label: '第3四半期', value: 210},
      {id: 'q4', label: '第4四半期', value: 170},
    ], {dir: 'v', unit: '件', max: 250}),
  );
}

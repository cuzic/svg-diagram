import {bars, box, caption, diagram} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: 'bars の band を主役にする', spotlight: 'sales'}).add(
    caption('spotlight（bars の band を id で指す。棒もまとめて主役）', {bold: true, tone: 'text'}),
    bars([
      {id: 'q1', label: '第1四半期', value: 120},
      {id: 'q2', label: '第2四半期', value: 150},
      {id: 'q3', label: '第3四半期', value: 210},
    ], {id: 'sales', dir: 'v', unit: '件', max: 250}),
    box({id: 'note', title: '補足', body: '主役以外は薄くなる'}),
  );
}

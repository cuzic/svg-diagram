import {bars, caption, diagram} from 'svg-diagram';

// 薄くした棒にも長さを残す（spotlight の dim: 'fill'）と、棒ごとの色（tone: 'danger' など）
export default function define() {
  return diagram({theme: 'blue', title: '許可待ちの棒だけ濃く、ほかは薄い塗りで', spotlight: {ids: 'wait', dim: 'fill'}}).add(
    caption('spotlight: {dim: "fill"} と bars の tone', {bold: true, tone: 'text'}),
    bars([
      {id: 'wait', label: '許可待ち', value: 76, tone: 'danger'},
      {label: '確認済み', value: 31},
      {label: '自動で通る', value: 18, tone: 'muted'},
    ], {unit: '%', max: 100}),
  );
}

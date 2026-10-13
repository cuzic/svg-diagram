// 数値の時間軸(ms)。レーン・イベント・区間(寸法線つき)。架空の計測値。
import {caption, diagram, timeline} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: '再初期化の間隔'}).add(
    caption('0 から 700ms の間に起きたこと', {bold: true, tone: 'text'}),
    timeline({
      unit: 'ms', from: 0, to: 700,
      lanes: ['UI', '通信'],
      events: [
        {at: 44, label: '再初期化', lane: 'UI', tone: 'danger'},
        {at: 388, label: '再初期化', lane: 'UI', tone: 'danger'},
        {at: 120, label: '要求', lane: '通信', tone: 'accent'},
      ],
      spans: [
        {from: 44, to: 388, dim: true, lane: 'UI'},
        {from: 120, to: 560, label: '応答待ち', lane: '通信'},
      ],
    }),
  );
}

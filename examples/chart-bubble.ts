import {diagram, bubble} from 'svg-diagram';

// バブルチャート: 事業ポートフォリオ。横軸が相対シェア、縦軸が市場成長率、円の面積が売上。破線は「シェア 1.0」と「成長率 10%」の境目。
export default function define() {
  return diagram({theme: 'blue', title: '事業ポートフォリオ', sourceLine: '出典: 説明用の例'}).add(
    bubble(
      [
        {label: '主力 A', x: 1.8, y: 6, size: 520},
        {label: '成長 B', x: 0.7, y: 18, size: 240, tone: 'danger'},
        {label: '新規 C', x: 0.3, y: 24, size: 60},
        {label: '安定 D', x: 1.2, y: 3, size: 310},
        {label: '縮小 E', x: 0.4, y: -2, size: 90, tone: 'muted'},
      ],
      {
        x: {title: '相対市場シェア', min: 0, max: 2.4, line: 1, lineLabel: 'シェア 1.0'},
        y: {title: '市場成長率', unit: '%', min: -5, max: 30, line: 10, lineLabel: '成長率 10%'},
        sizeTitle: '売上', sizeUnit: '億円',
      },
    ),
  );
}

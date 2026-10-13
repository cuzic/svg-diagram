import {diagram, raci} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: '新サービス立ち上げ RACI'}).add(
    raci(['要件定義', '画面設計', 'リリース判定'], ['PM', 'デザイン', '開発', '事業責任者'], [
      ['R', 'C', 'C', 'A'], ['A', 'R', 'C', 'I'], ['R', 'I', 'C', 'A'],
    ], {title: 'RACI 責任分担表', legend: true}),
  );
}

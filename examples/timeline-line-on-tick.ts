import {diagram, timeline} from 'svg-diagram';

// 期限の縦線が、目盛り(2027/3)のラベルにかかる軸。ラベルは線の右へずれる。期限 2027-02-28 は、3/1 の目盛りの 1 日手前に描く。
export default function define() {
  return diagram({theme: 'blue', title: 'RDS MySQL 5.7 の Extended Support 終了まで', sourceLine: '出典: AWS 公式ドキュメント'}).add(
    timeline({
      from: '2026-10', to: '2027-06',
      now: {at: '2026-10-12'},
      deadline: {at: '2027-02-28', label: 'Extended Support 終了', line: 'full'},
      marks: [{at: '2027-01', label: '移行リハーサル'}],
      span: 'fill',
    }),
  );
}

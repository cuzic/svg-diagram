import {diagram, timeline} from 'svg-diagram';

// 1 本の横軸、期限の縦線(図の高さいっぱい)、迫る区間の面の塗り。RDS MySQL 5.7 の Extended Support 終了。
export default function define() {
  return diagram({theme: 'blue', title: 'RDS MySQL 5.7 の Extended Support 終了まで', sourceLine: '出典: AWS 公式ドキュメント(RDS MySQL 5.7 のサポート終了予定)'}).add(
    timeline({
      from: '2026', to: '2028',
      now: {at: '2026-10'},
      deadline: {at: '2027-02-28', label: 'Extended Support 終了', line: 'full'},
      span: 'fill',
    }),
  );
}

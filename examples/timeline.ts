import {caption, diagram, timeline} from 'svg-diagram';

// 塩漬けシステムの期限: 今日から、サポート終了までの残り。now は必ず書く(ビルドは時計を読まない)。
export default function define() {
  return diagram({theme: 'blue', title: '塩漬けシステムの期限', sourceLine: '出典: ベンダー公開のサポート終了予告(2026-04)'}).add(
    caption('サポート終了まで、残りはこれだけ', {bold: true, tone: 'text'}),
    timeline({
      from: '2026', to: '2029',
      now: {at: '2026-10', label: '今'},
      deadline: {at: '2028-03-31', label: 'サポート終了'},
      marks: [{at: '2027-04', label: '予算申請'}, {at: '2027-10', label: '移行開始の期限', tone: 'accent'}],
    }),
  );
}

import {diagram, timeline} from 'svg-diagram';

// 近い日付の旗は、段を変えて階段にする(左の旗が高く、右の旗が低い)。期限を過ぎた図は、幅が危険色になる。
export default function define() {
  return diagram({theme: 'blue', title: '期限前の手続き', sourceLine: '出典: 社内の移行計画(2026-10 版)'}).add(
    timeline({
      from: '2026-09', to: '2027-06',
      now: {at: '2026-10-01'},
      deadline: {at: '2027-03-31', label: 'サポート終了'},
      marks: [{at: '2026-10-20', label: '調査'}, {at: '2026-11-10', label: '見積もり'}, {at: '2026-12-01', label: '稟議'}],
      remaining: 'あと半年',
    }),
  );
}

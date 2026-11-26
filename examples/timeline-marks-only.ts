import {caption, diagram, timeline} from 'svg-diagram';

// 今日も期限も無い、日付つきの予定の並び。軸は最初と最後の日付から自動で決まる(now / deadline / from / to は省ける)。
export default function define() {
  return diagram({theme: 'blue', title: '公開までの予定'}).add(
    caption('日付だけが決まっている予定', {bold: true, tone: 'text'}),
    timeline({
      marks: [
        {at: '2026-12-01', label: '試作'},
        {at: '2026-12-09', label: '社内確認', tone: 'accent'},
        {at: '2027-01-12', label: '公開'},
        {at: '2027-03', label: '見直し'},
      ],
    }),
  );
}

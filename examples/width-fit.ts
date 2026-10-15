// 細い図を内容の幅に縮める（width: 'fit'）。文字の大きさは変えず、図の幅だけを内容 + 余白にする。既定の 940 は変わらない。
// ビルド: svg-diagram build examples/width-fit.ts --out examples/out/width-fit.svg
import {concentric, diagram} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'teal', title: '関係者の距離（幅を内容に合わせる）', width: 'fit'}).add(concentric(
    [{label: 'チーム'}, {label: '顧客と取引先'}, {label: '社会'}],
    {order: 'inner-first', labels: 'side', centre: '利用者'},
  ));
}

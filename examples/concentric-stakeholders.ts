// 関係者の距離を同心円で描く。内側から順に書き（order: 'inner-first'）、ラベルは右の凡例に出して引き出し線で層につなぐ。
// ビルド: svg-diagram build examples/concentric-stakeholders.ts --out examples/out/concentric-stakeholders.svg
import {concentric, diagram} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'teal', title: '関係者の距離'}).add(concentric(
    [{label: 'チーム'}, {label: '顧客と取引先'}, {label: '社会'}],
    {order: 'inner-first', labels: 'side', centre: '利用者'},
  ));
}

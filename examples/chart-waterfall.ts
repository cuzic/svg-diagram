import {diagram, waterfall} from 'svg-diagram';

// ウォーターフォール図: 前期から今期へ、何が増やし何が減らしたか。増加は上へ伸び（+）、減少は前の水準から下へ垂れ下がる（-）。
// 色だけに頼らず、棒の向きと符号付きの値の両方で読める。小計・合計は 0 から立つ。
export default function define() {
  return diagram({theme: 'blue', title: '営業利益の増減要因（前期 → 今期）', sourceLine: '出典: 説明用の例'}).add(
    waterfall(
      [
        {label: '前期の営業利益', value: 1000},
        {label: '価格改定', value: 220, id: 'price'},
        {label: '販売数量', value: -130},
        {label: '原材料費', value: -310},
        {label: '小計', kind: 'subtotal'},
        {label: '販促費の削減', value: 90},
        {label: '為替', value: 40},
        {label: '今期の営業利益', kind: 'total'},
      ],
      {unit: '百万円', height: 340},
    ),
    // dir: 'h' は横向き。ステップの名前が長いとき、段数が多いときに読みやすい。水準が 0 をまたぐ（赤字になる）場合も同じ。
    waterfall(
      [
        {label: '期首の現金', value: 120},
        {label: '営業活動によるキャッシュフロー', value: 340},
        {label: '設備投資', value: -280},
        {label: '借入金の返済', value: -240},
        {label: '期末の現金', kind: 'total'},
      ],
      {unit: '百万円', dir: 'h'},
    ),
  );
}

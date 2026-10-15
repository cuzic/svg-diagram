// 細い図を内容の幅に縮める（width: 'fit'）。文字の大きさは変えず、図の幅だけを内容 + 余白にする。既定の 940 は変わらない。
// ビルド: svg-diagram build examples/width-fit.ts --out examples/out/width-fit.svg
import {chevron, diagram} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'teal', title: '問い合わせ対応（幅を内容に合わせる）', width: 'fit'}).add(chevron(
    [{label: '受付'}, {label: '内容の分類'}, {label: '担当者が回答'}],
    {direction: 'vertical', first: 'chevron', width: 420},
  ));
}

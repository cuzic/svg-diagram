// 縦に流れる矢羽根。先頭も矢羽根の形（first: 'chevron'）にする。
// ビルド: svg-diagram build examples/chevron-vertical.ts --out examples/out/chevron-vertical.svg
import {chevron, diagram} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'teal', title: '問い合わせ対応'}).add(chevron(
    [{label: '受付'}, {label: '内容の分類'}, {label: '担当者が回答'}],
    {direction: 'vertical', first: 'chevron', width: 420},
  ));
}

// 7 つの手順を 2 段に折り返す矢羽根（4 + 3）。段の間の矢印が、上の段の終わりから下の段の初めへ続く。
// ビルド: svg-diagram build examples/chevron-rows.ts --out examples/out/chevron-rows.svg
import {chevron, diagram} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'teal', title: '手順の流れ'}).add(chevron(
    [
      {label: '手順A', sub: '説明の文'},
      {label: '手順B', sub: '説明の文'},
      {label: '手順C', sub: '説明の文'},
      {label: '手順D', sub: '説明の文'},
      {label: '手順E', sub: '説明の文'},
      {label: '手順F', sub: '説明の文'},
      {label: '手順G', sub: '説明の文'},
    ],
    {rows: 2, current: 2},
  ));
}

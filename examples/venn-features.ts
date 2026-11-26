// 集合の名前と特徴を分けて置くベン図。items は名前の下に箇条で、その集合だけの部分に入る（1〜4 個、短く）。重なりは overlaps に書く。
// ビルド: svg-diagram build examples/venn-features.ts --out examples/out/venn-features.svg
import {diagram, venn} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: '二つの案の特徴'}).add(venn(
    [{name: '案 A', items: ['導入が早い', '費用が低い']}, {name: '案 B', items: ['拡張しやすい', '保守が楽']}],
    {overlaps: [{sets: ['案 A', '案 B'], label: '共通'}]},
  ));
}

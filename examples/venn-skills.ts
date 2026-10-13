// 2 集合のベン図。重なりのラベルは overlaps に書き、全体の枠（universe）に名前を付ける。
// ビルド: svg-diagram build examples/venn-skills.ts --out examples/out/venn-skills.svg
import {diagram, venn} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: '必要な能力'}).add(venn(
    [{name: '技術', id: 'tech'}, {name: '顧客理解', id: 'customer'}],
    {overlaps: [{sets: ['技術', '顧客理解'], label: '価値'}], universe: 'チーム'},
  ));
}

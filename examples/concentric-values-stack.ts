// Values Bullseye の積み重ね版（架空の記入例）: concentric-values-bullseye.ts と同じデータを layout: 'stack' で描く。価値の 4 領域を列に、
// 輪を段にして（いちばん内側の輪＝価値に最も沿えている段が上）、今週の行動を置く。先週からの動きは点線の丸から矢印（ADR 0065）。
// ビルド: svg-diagram build examples/concentric-values-stack.ts --out examples/out/concentric-values-stack.svg
import {concentric, diagram} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'teal', width: 940, title: '価値の的（今週と先週）'}).add(concentric(3, {
    layout: 'stack',
    centre: '価値に沿った生き方',
    sectors: [{label: '仕事・学び'}, {label: '人間関係'}, {label: '成長・健康'}, {label: '余暇'}],
    marks: [
      {label: '資格の勉強', sector: '仕事・学び', r: .3, from: {r: .7}},
      {label: '家族と夕食', sector: '人間関係', r: .25},
      {label: '週 1 で運動', sector: '成長・健康', r: .65, from: {r: .45}},
      {label: '読書の時間', sector: '余暇', r: .8},
    ],
  }));
}

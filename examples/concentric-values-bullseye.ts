// Values Bullseye（架空の記入例）: 同心円を価値の 4 領域の扇形に区切り、中心からの距離を「価値に沿えた度合い」（中心ほど沿えている）にして、
// 今週の行動を置く。先週からの動きは点線の丸から矢印で描く（ADR 0065）。
// ビルド: svg-diagram build examples/concentric-values-bullseye.ts --out examples/out/concentric-values-bullseye.svg
import {concentric, diagram} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'teal', width: 940, title: '価値の的（今週と先週）'}).add(concentric(3, {
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

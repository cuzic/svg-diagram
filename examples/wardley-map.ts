import {diagram, plane} from 'svg-diagram';

// Wardley Map: x = 進化の段階（`stages`）、y = 可視性（客から見えるほど上）。線は「上が下に依存する」関係。
// `evolves: {to}` は点がこれから進む先（薄い輪と破線の矢印）。段階の幅が違う地図は `stages: [{name: '起源', to: 0.8}, ...]`（最後以外は右端の x を書く）。
// 座標は [進化, 可視性]（OnlineWardleyMaps などは [可視性, 進化] の順なので、写すときは入れ替える）。
// ビルド: svg-diagram build examples/wardley-map.ts --out examples/out/wardley-map.svg
export default function define() {
  return diagram({theme: 'blue', width: 940, title: '紅茶の店の Wardley Map（架空の例）'}).add(
    plane({
      x: {label: '進化', max: 4}, stages: ['起源', 'カスタム', '製品', 'コモディティ'],
      y: {label: '可視性', min: 0, max: 1, ticks: [{at: 0.05, label: '裏'}, {at: 0.95, label: '表'}]},
      height: 460,
      points: [
        {id: 'cust', at: [2.5, 0.95], label: '客', shape: 'diamond'},
        {id: 'cup', at: [2.7, 0.78], label: '一杯の紅茶'},
        {id: 'tea', at: [2.3, 0.55], label: '茶葉'},
        {id: 'water', at: [3.5, 0.45], label: '水'},
        {id: 'kettle', at: [3.45, 0.3], label: '湯沸かし器', labelAt: 'left'},
        {id: 'power', at: [3.7, 0.1], label: '電力'},
        {id: 'blend', at: [1.2, 0.4], label: '独自ブレンド', evolves: {to: 2.2}},
      ],
      lines: [
        {from: 'cust', to: 'cup'}, {from: 'cup', to: 'tea'}, {from: 'cup', to: 'water'},
        {from: 'water', to: 'kettle'}, {from: 'kettle', to: 'power'}, {from: 'tea', to: 'blend'},
      ],
    }),
  );
}

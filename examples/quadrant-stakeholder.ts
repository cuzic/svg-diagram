// 架空の基幹システム刷新プロジェクトのステークホルダー分析（影響力 × 関心度）。社内・社外を形と凡例で分ける。
// ビルド: svg-diagram build examples/quadrant-stakeholder.ts --out examples/out/quadrant-stakeholder.svg
import {diagram, quadrant} from 'svg-diagram';

export default function define() {
  const d = diagram({theme: 'blue', width: 940, gap: 20, title: 'ステークホルダー分析'});
  d.add(quadrant.preset('stakeholder', {
    groups: ['社内', '社外'],
    items: [
      {id: 'cfo', label: 'CFO', at: [0.8, 0.9], group: '社内'}, {label: '情報システム部', at: [0.9, 0.65], group: '社内'},
      {label: '営業本部', at: [0.7, 0.35], group: '社内'}, {label: '経理部', at: [0.85, 0.2], group: '社内'},
      {label: '監督官庁', at: [0.2, 0.85], group: '社外'}, {label: '主要取引先', at: [0.3, 0.6], group: '社外'},
      {label: '開発ベンダー', at: [0.75, 0.55], group: '社外'}, {label: '株主', at: [0.15, 0.2], group: '社外'},
    ],
  }));
  return d;
}

import {diagram, faultTree} from 'svg-diagram';

// 故障の木（FTA）: 頂上事象「サービス停止」から、AND / OR のゲートで原因をたどる。
// cutSets: 単独で頂上を起こす事象（単一故障点）に太枠とバッジ。quant: 各事象の p から頂上の確率を求め、注に書く。
// 同じ事象（ネットワーク断）は {ref: id} で 2 か所に描く（確率では 1 つの事象として数える）。legend: 'auto' で使った記号だけの凡例。
export default function define() {
  const tree = faultTree({
    label: 'サービス停止', gate: 'or',
    children: [
      {label: 'DB 全体停止', gate: 'and', children: [
        {label: '主系停止', kind: 'basic', p: 1e-2},
        {label: '待機系へ切替不能', kind: 'basic', p: 5e-2},
      ]},
      {label: 'アプリ全台停止', kind: 'undeveloped', p: 1e-3},
      {label: '接続不能', gate: 'or', children: [
        {id: 'net', label: 'ネットワーク断', kind: 'basic', p: 2e-3},
        {label: 'DNS 障害', gate: 'and', children: [{label: '委任先の停止', kind: 'basic', p: 1e-2}, {ref: 'net'}]},
      ]},
    ],
  }, {id: 'fta1', cutSets: true, quant: true, quantPeriod: '1 年間', maxNodeW: 130});
  return diagram({theme: 'blue', title: 'サービス停止の故障の木', legend: 'auto', sourceLine: '出典: 説明用の例'}).add(tree);
}

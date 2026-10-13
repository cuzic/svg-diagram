import {diagram, strategyCanvas} from 'svg-diagram';

// 戦略キャンバス（lines() の一種）: 競争要因ごとに各社の提供水準を折れ線で。系列は線の種類（実線・破線）と印の形（● ■ ◆）が違い、
// 名前は線の右端に直接書く（凡例を行き来しなくてよい）。annotate で注目点に輪と名前を付けられる。
export default function define() {
  return diagram({theme: 'blue', title: '戦略キャンバス: 業界平均と自社の差', sourceLine: '出典: 説明用の例'}).add(
    strategyCanvas(
      ['価格', '機能の数', '導入の手軽さ', 'サポート', 'ブランド力', 'カスタマイズ性'],
      [
        {label: '競合 A', values: [4, 5, 2, 3, 5, 4]},
        {label: '競合 B', values: [2, 2, 5, 2, 2, 1]},
        {label: '自社', values: [1, 3, 5, 5, 3, 4]},
      ],
      {annotate: [{at: {series: '自社', index: 3}, label: '差別化の軸', labelAt: 'above'}], height: 360},
    ),
  );
}

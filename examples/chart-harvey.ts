import {diagram, harvey} from 'svg-diagram';

// ハーベイボール: 選定基準ごとに、3 つの候補を 5 段階（0〜4 の四分円）で評価する。自社を強調。
export default function define() {
  return diagram({theme: 'blue', title: 'ベンダー比較', sourceLine: '出典: 説明用の例'}).add(
    harvey(
      ['機能の充足度', '導入コスト', '運用のしやすさ', 'サポート体制', '拡張性'],
      ['A 社', 'B 社', 'C 社'],
      [[4, 3, 2], [2, 4, 3], [3, 2, 4], [4, 1, 2], [3, 2, null]],
      {corner: '評価基準', highlight: ['A 社']},
    ),
  );
}

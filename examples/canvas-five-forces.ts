import {canvas, diagram} from 'svg-diagram';

// ファイブフォース: 中央に業界内の競争、まわりに新規参入・売り手・買い手・代替品の 4 つの圧力。矢印の向き（▼ ▶ ◀ ▲）が中央へ向かう力を示す。
export default function define() {
  return diagram({theme: 'blue', title: 'コワーキング事業の業界構造', sourceLine: '出典: 説明用の例'}).add(
    canvas('fiveForces', {
      newEntrants: ['初期費用が小さく、参入しやすい', '大手不動産の参入が増えた'],
      suppliers: ['ビルオーナー（賃料の交渉力が強い）', '回線・備品は代わりがある'],
      rivalry: ['駅近 1km 圏に同規模が 6 か所', '価格競争になりやすい'],
      buyers: ['月額会員は乗り換えが簡単', '法人は値引きを求める'],
      substitutes: ['自宅・カフェでの作業', 'シェアオフィスの大手チェーン'],
    }, {title: '5 つの競争要因', emphasis: ['rivalry']}),
  );
}

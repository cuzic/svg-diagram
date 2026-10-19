// PERMA(セリグマン)の自己評価: 5 つの要素を 0〜10 で採点して、どこが弱いかを見る。レーダーで描く。
// 点数は説明用の架空。要素の名前と頭文字は書籍・論文の訳語に合わせる。
// ビルド: svg-diagram build examples/positive-perma.ts --out examples/out/positive-perma.svg
import {diagram, radar} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: 'PERMA の自己評価（0〜10）', sourceLine: '出典: 説明用の例'}).add(
    radar(
      ['P ポジティブ感情', 'E エンゲージメント', 'R 関係性', 'M 意味・意義', 'A 達成'],
      [
        {label: '今', values: [5, 7, 4, 6, 6]},
        {label: '3 か月後の目標', values: [6, 7, 7, 7, 6]},
      ],
      {max: 10, values: true, height: 460},
    ),
  );
}

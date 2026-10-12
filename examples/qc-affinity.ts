import {affinity, diagram} from 'svg-diagram';

// 親和図: 出てきた意見や事実のカードを、似たものどうしでグループにし、グループに短い文の見出し（表札）を付ける。
// グループの中にグループ（`groups`）を入れると、小さなまとまりから大きなまとまりへ重ねられる。
export default function define() {
  return diagram({theme: 'blue', title: '新人の定着についての親和図', sourceLine: '出典: 説明用の例'}).add(
    ...affinity(
      [
        {
          title: '最初の数週間で不安になる',
          groups: [
            {title: '何をすればいいか分からない', cards: ['初日の予定が決まっていない', '手順書が古い']},
            {title: '聞ける人がいない', cards: ['担当者が忙しそう', '質問のしかたが分からない']},
          ],
        },
        {title: '仕事の意味が見えない', cards: ['全体の流れを知らない', '自分の作業が何に使われるか不明', '成果の確認がない']},
        {title: '職場に慣れにくい', cards: ['昼休みに話す相手がいない', '会議で発言しにくい']},
      ],
      {cols: 3},
    ),
  );
}

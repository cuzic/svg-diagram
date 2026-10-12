import {diagram, matrix} from 'svg-diagram';

// マトリックス図（L 型）: 行 × 列の関係を ◎ ○ △ × で。`weights`（列の重み）を書くと、重み × 点（◎ 9 / ○ 3 / △ 1）の評価点が行ごとに付き、最高点に印が付く。
export default function define() {
  return diagram({theme: 'blue', title: '改善案の評価マトリックス', sourceLine: '出典: 説明用の例'}).add(
    matrix(
      ['A 案　治具の追加', 'B 案　作業手順の変更', 'C 案　設備の更新'],
      ['コスト', '効果', '早さ', '現場の負担'],
      [['○', '○', '◎', '△'], ['◎', '△', '◎', '○'], ['×', '◎', '△', '○']],
      {weights: [5, 4, 3, 2], corner: '案 ＼ 評価項目'},
    ),
  );
}

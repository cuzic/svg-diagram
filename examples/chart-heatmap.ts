import {diagram, heatmap} from 'svg-diagram';

// コホート表（リテンションの ヒートマップ）: 登録月ごとに、経過月数ごとの継続率。数字は必ず書き、濃さは 5 段階。
// 右下の空欄はまだ経過していない月（null）。
export default function define() {
  return diagram({theme: 'blue', title: '登録月別の継続率', sourceLine: '出典: 説明用の例'}).add(
    heatmap(
      ['4月登録', '5月登録', '6月登録', '7月登録', '8月登録', '9月登録'],
      ['0か月', '1か月', '2か月', '3か月', '4か月', '5か月'],
      [
        [100, 62, 48, 41, 38, 36],
        [100, 66, 51, 44, 40, null],
        [100, 59, 45, 37, null, null],
        [100, 71, 56, null, null, null],
        [100, 74, null, null, null, null],
        [100, null, null, null, null, null],
      ],
      {unit: '%', corner: '登録月 ＼ 経過月'},
    ),
  );
}

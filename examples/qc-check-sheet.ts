import {checkSheet, diagram} from 'svg-diagram';

// チェックシート: 項目を縦に、日などを横に。件数は「正」の字（一 丅 下 止 正）で書き、計の行と列は自動。
// `counts` を書かなければ、手で記入する空の用紙になる（`boxes: true` で各欄に ☐）。
export default function define() {
  return diagram({theme: 'blue', title: '不良のチェックシート', sourceLine: '出典: 説明用の例'}).add(
    checkSheet(
      [
        {label: '傷', counts: [3, 5, 2, 7, 4]},
        {label: '汚れ', counts: [1, 0, 4, 2, 2]},
        {label: '欠け', counts: [0, 2, 1, 0, 3]},
        {label: '寸法不良', counts: [2, 1, 0, 1, 0]},
      ],
      ['月', '火', '水', '木', '金'],
      {corner: '不良の種類', title: '10 月第 2 週　第 1 ライン', as: 'both'},
    ),
  );
}

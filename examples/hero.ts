import {box, diagram, hero} from 'svg-diagram';

// 章の頭に置く 1 枚: 大きい数字、それを生む流れ、一言と出典。banner / stat / row / caption を並べただけ。
export default function define() {
  return diagram({theme: 'blue', title: '承認の待ち時間', accept: {'legend-missing': '数値の色は意味でなく強調。値と見出しで読める', 'gray-tone-collision': '強調の枠線と太字の数値で、白黒でも読める'}}).add(
    hero({
      banner: {headline: '承認の待ち時間が 3 日から 1 日に縮んだ', tone: 'accent'},
      stat: {value: '-67%', label: '承認の待ち時間', tone: 'accent'},
      flow: [
        box({title: '申請', body: 'フォームから 1 回'}),
        box({title: '一次承認', body: '上長が当日中に'}),
        box({title: '決裁', body: '経理が翌営業日に'}),
      ],
      caption: '差し戻しの往復をなくしたのが効いた',
      note: '出典: 社内調査(2026 年上期、n = 120)',
    }),
  );
}

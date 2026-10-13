import {diagram, butterfly} from 'svg-diagram';

// バタフライチャート: 中央の項目名をはさんで、自社（左）と競合（右）の評価を同じ目盛りで比べる。
export default function define() {
  return diagram({theme: 'blue', title: '顧客満足度: 自社と競合', sourceLine: '出典: 説明用の例'}).add(
    butterfly(
      [
        {label: '品質', left: 82, right: 74},
        {label: '価格', left: 58, right: 88},
        {label: '納期', left: 91, right: 65},
        {label: 'サポート体制', left: 76, right: 79},
        {label: 'ブランド', left: 44, right: 90},
      ],
      {leftLabel: '自社', rightLabel: '競合 A 社', unit: '点'},
    ),
  );
}

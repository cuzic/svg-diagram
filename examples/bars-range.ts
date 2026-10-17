import {caption, diagram, rangeBars} from 'svg-diagram';

// 範囲(下限〜上限)の浮き棒: 見積りの幅や信頼区間のように、「最小〜最大」を 1 本の棒で描く。
// 値の文言は `3.2〜5.8万円`。棒は 0 から伸びず、下限の位置から上限まで浮く(軸は 0 から)。
// ビルド: svg-diagram build examples/bars-range.ts --out examples/out/bars-range.svg
export default function define() {
  const items = [
    {label: '設計', range: [3.2, 5.8]},
    {label: '開発', range: [12, 18]},
    {label: 'テスト', range: [4, 9]},
    {label: '移行', range: [2, 3.5]},
  ] as const;
  return diagram({theme: 'blue', title: '工程ごとの費用見積りの幅', sourceLine: '出典: 説明用の例'}).add(
    caption('工程ごとの費用の見積り（最小〜最大、万円）', {bold: true}),
    rangeBars(items, {unit: '万円', dir: 'v', height: 260}),
    caption('同じ見積りを横向きで', {bold: true}),
    rangeBars(items, {unit: '万円', dir: 'h'}),
  );
}

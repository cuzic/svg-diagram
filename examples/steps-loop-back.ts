import {chevron, diagram, steps, caption} from 'svg-diagram';

// 流れの途中から前へ戻る線(loopBack): steps() / row の箱、横向きの chevron で、下側の弧として描く。
// 複数の戻りは入れ子(一方のスパンが他方の内側)にすると、高さが自動でずれて重ならない。
// ビルド: svg-diagram build examples/steps-loop-back.ts --out examples/out/steps-loop-back.svg
export default function define() {
  return diagram({theme: 'blue', title: '差し戻しのある手順', legend: 'auto', sourceLine: '出典: 説明用の例'}).add(
    caption('レビューで見つかったら直しに戻る', {bold: true}),
    steps([{title: '調べる'}, {title: '直す'}, {title: '確かめる'}, {title: '出す'}, {title: '振り返る'}], {
      numbered: true,
      loopBack: [{from: 4, to: 2, label: '差し戻し'}, {from: 5, to: 1, label: '最初から', line: 'dashed'}],
    }),
    caption('chevron でも同じ', {bold: true}),
    chevron([{label: '計画'}, {label: '実装'}, {label: '検証'}, {label: '公開'}], {loopBack: {from: 3, to: 1, label: 'やり直し'}}),
  );
}

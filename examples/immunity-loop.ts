import {causalLoop, caption, diagram} from 'svg-diagram';

// 免疫マップの続き: 阻害行動が不安を下げて競合目標を守る自己調整。負の符号が 1 つなので B(バランス)ループになる。
// 強化(R)ではない。R になるのは別のループ(目標が遠のくほど不安が増える場合)で、別の図に描く。
export default function define() {
  return diagram({theme: 'blue', title: '任せられない仕組み(自己調整のループ)', sourceLine: '出典: 説明用の例'}).add(
    caption('不安が高まるほど自分で直し、直すと不安が下がる(B ループ)', {bold: true, tone: 'text'}),
    causalLoop([
      {id: 'worry', label: '任せることへの不安'},
      {id: 'guard', label: '失敗を見られない力'},
      {id: 'behavior', label: '自分で直す'},
    ], [
      {from: 'worry', to: 'guard', polarity: '+'},
      {from: 'guard', to: 'behavior', polarity: '+'},
      {from: 'behavior', to: 'worry', polarity: '-'},
    ], {height: 250}),
  );
}

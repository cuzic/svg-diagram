import {caption, cloud, diagram} from 'svg-diagram';

// 免疫マップの続き: 対立を蒸発雲に置く(出典のない対応。免疫マップの標準の書き方ではない)。
// B / C は目標と競合目標が満たす「ニーズ」、D / D' は対立する行動(改善の行動と、阻害行動)。
// 強力な固定観念は C → D' の矢印(cd)の前提。行動実験は injection に入れない(解決策に読まれる。検証は表で扱う)。
export default function define() {
  return diagram({theme: 'blue', title: '任せる・任せないの対立', sourceLine: '出典: 説明用の例'}).add(
    cloud(
      {a: 'チームが成果を出し続ける', b: '部下が育ち、自分は次の仕事に進める', c: '失敗の責任を負わされない', d: '部下に任せる', d2: '自分で直す'},
      {
        assumptions: [
          {on: 'cd', text: '自分で直さないと品質が落ち、責められる'},
        ],
      },
    ),
    caption('固定観念の検証は、別の図の表で行う', {tone: 'muted'}),
  );
}

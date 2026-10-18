import {box, caption, diagram, group, row} from 'svg-diagram';

// 免疫マップ(Kegan & Lahey): 4 つの欄に箇条書きを並べるワークシート。欄の間に矢印は引かない(欄の順に読む)。
// grid() ではなく row + group で作る(欄ごとに独立した列で、行が 1 対 1 に読まれない)。不安は色なしの破線の箱で、文頭に「不安:」。
// まだ聞いていない欄は、破線の枠に「(未記入)」と書く。
export default function define() {
  return diagram({theme: 'blue', title: '免疫マップ(任せられない課長)', sourceLine: '出典: 説明用の例'}).add(
    row([
      group([box({id: 'goal', title: '部下に仕事を任せる'})], {valign: 'top', title: '1 改善目標'}),
      group([
        box({id: 'b1', title: '自分で直してしまう'}),
        box({id: 'b2', title: '細かく進捗を確認する'}),
        box({id: 'b3', title: '頼まずに抱え込む'}),
      ], {valign: 'top', title: '2 阻害行動'}),
      group([
        box({id: 'w', title: '不安: 任せて品質が落ち、責められる', dashed: true}),
        box({id: 'c1', title: '失敗を見られないことに専心している'}),
        box({id: 'c2', title: '頼りない人だと思われないことに専心している'}),
      ], {valign: 'top', title: '3 隠れた競合目標'}),
      group([box({title: '(未記入)', frame: false})], {valign: 'top', title: '4 強力な固定観念', dashed: true}),
    ]),
    caption('第 4 欄は次の面談で聞く。欄の順に読み、矢印は引かない。', {tone: 'muted'}),
  );
}

import {diagram, isIsNot, isIsNotTests} from 'svg-diagram';

// KT 法（ケプナー・トリゴー）の問題分析: IS / IS NOT 表と、その上での仮説の検定。
// IS NOT は「そうであってもおかしくないのに、そうでない」比較対象。「違い」は IS と IS NOT の差、「変化」はその差に関わる最近の変更で、別の問い。
// 仮説の表は、スペックの行ごとに「説明できる / 仮定すれば / できない」を並べる。説明できない行が 0 の仮説は太字で、仮定が最少のものに「最少の仮定」と出る（図が原因を選ぶのではない）。
const rows = [
  {dim: 'what', is: 'API A がタイムアウトする', isNot: 'API B は正常', distinct: 'A だけ外部 DB を使う', change: '接続設定を変更した'},
  {dim: 'where', is: 'リージョン X', isNot: 'リージョン Y は正常', distinct: 'X だけ旧い接続プールを使う'},
  {dim: 'when', is: 'デプロイ後から', isNot: 'デプロイ前は正常', change: '先週のデプロイ'},
  {dim: 'extent', is: '全体の 3%', isNot: 'それ以外のリクエスト', distinct: '長いクエリだけ'},
] as const;

export default function define() {
  return diagram({theme: 'blue', title: 'API A のタイムアウト（IS / IS NOT）', rcaCheck: 'strict', sourceLine: '出典: 説明用の例'}).add(
    isIsNot(rows),
    isIsNotTests(rows, [
      {text: '接続設定の変更', results: ['yes', 'yes', 'yes', 'ifAssumed'], assumes: ['長いクエリだけが古い設定に当たる']},
      {text: 'ネットワーク障害', results: ['no', 'yes', 'no', 'no']},
      {text: 'DB の負荷の増加', results: ['yes', 'ifAssumed', 'ifAssumed', 'yes'], assumes: ['X だけ負荷が偏る', 'デプロイと同時に負荷が増えた']},
    ]),
  );
}

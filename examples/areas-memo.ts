import {areas, box, branch, connect, diagram, group} from 'svg-diagram';

// areas() で並べた自由な図(nov27 s04 の書き直し): 列の幅は cols の比で決まり、子に span を書かない。名前がそのまま id になる。
export default function define() {
  return diagram({theme: 'blue', title: '決定メモが前提を運ぶ', showTitle: false, legend: false}).add(
    areas(`
      head  memo  convs
    `, {
      head: group([
        box({title: '提出先の手引き'}),
        box({title: '社内ルール'}),
        box({title: '環境の制約'}),
      ], {title: '担当者の頭の中', tone: 'muted'}),
      memo: group([box({title: '決定メモ', body: '1枚に書き出す', tone: 'solid'})], {title: '書き出す先'}),
      convs: group([
        box({id: 'c1', title: '今の会話'}),
        box({id: 'c2', title: '新しい会話'}),
        box({id: 'c3', title: '別の人・別のAI'}),
      ], {title: '同じ前提で始まる', tone: 'accent'}),
    }, {cols: [4, 3, 4], gap: 64}),
    connect('head:right', 'memo:left'),
    branch('memo:right', [{to: 'c1:left'}, {to: 'c2:left'}, {to: 'c3:left'}]),
  );
}

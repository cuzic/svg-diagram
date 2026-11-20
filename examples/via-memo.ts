import {areas, box, branch, connect, diagram, group} from 'svg-diagram';

// connect({via}) (nov27 s04): 決定メモから右の 3 つの会話への矢印を、箱ではなく「同じ前提で始まる」の枠で止める。
// 枠の中には線を引き込まず、枠がひとまとまりの受け手であることを見せる。
export default function define() {
  return diagram({theme: 'blue', title: '決定メモが前提を運ぶ', showTitle: false, legend: false}).add(
    areas('head memo convs', {
      head: group([
        box({title: '提出先の手引き'}),
        box({title: '社内ルール'}),
        box({title: '環境の制約'}),
      ], {title: '担当者の頭の中', tone: 'muted'}),
      memo: group([box({id: 'note', title: '決定メモ', body: '1枚に書き出す', tone: 'solid'})], {frame: false, valign: 'center'}),
      convs: group([
        box({id: 'c1', title: '今の会話'}),
        box({id: 'c2', title: '新しい会話'}),
        box({id: 'c3', title: '別の人・別のAI'}),
      ], {title: '同じ前提で始まる', tone: 'accent'}),
    }, {cols: [4, 3, 4], gap: 64}),
    connect('head:right', 'note:left'),
    branch('note:right', [{to: 'c1:left'}, {to: 'c2:left'}, {to: 'c3:left'}], {via: {to: 'group'}}),
  );
}

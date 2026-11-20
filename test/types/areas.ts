// Type-level tests: areas() (ADR 0069 D3) declares its area names and the ids inside its cells, and carries their refs. Never executed (see ids.ts).
import {diagram, areas, box, caption, connect, group, row} from '../../lib/dsl.ts';

export function areasCases(): void {
  const memo = box({id: 'memo', title: '決定メモ'});
  const fig = areas('head memo convs', {
    head: group([box({title: '手引き'})], {title: '頭の中'}),
    memo,
    convs: group([box({id: 'c1', title: '今の会話'}), box({id: 'c2', title: '新しい会話'})], {title: '同じ前提'}),
  }, {cols: [4, 3, 4], gap: 64, id: 'all'});
  // the names, the ids inside the cells and the areas' own id are all declared
  diagram({theme: 'blue'}).add(fig, connect('head:right', 'memo:left'), connect(memo.right, 'c1:left'), connect('convs:bottom', 'all:top'), connect(fig.bottom, 'c2'));
  // a caption in a cell takes the name too
  diagram({theme: 'blue'}).add(areas('a note', {a: box({title: 'a'}), note: caption('n')}), connect('a:right', 'note:left'));
  // @ts-expect-error a name that is not in the cells
  diagram({theme: 'blue'}).add(fig, connect('head:right', 'nope:left'));
  // @ts-expect-error an id inside a cell is checked too
  diagram({theme: 'blue'}).add(fig, connect('c1:right', 'c9:left'));
  // @ts-expect-error a row is not a cell's content: put it in a group
  areas('a', {a: row([box({title: 'x'})])});
  // @ts-expect-error an areas() is not a row's child: put it in a group
  row([areas('a', {a: box({title: 'x'})})]);
  // a group holds an areas()
  row([group([areas('a', {a: box({title: 'x'})})]), box({title: 'y'})]);
  // @ts-expect-error areas() takes no reveal: its cells do
  areas('a', {a: box({title: 'x'})}, {reveal: 1});
}

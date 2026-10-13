// Type-level tests for the chart parts (checked by `tsc -p .`, never run): the ids of their elements are anchors for connect().
import {diagram, box, connect, heatmap, mekko, radar, sankey, stackedBars, tornado, treemap, waterfall} from '../../lib/dsl.ts';

export function chartCases(): void {
  const d = diagram({theme: 'blue'});
  d.add(waterfall([{label: 'a', value: 1, id: 'start'}, {label: 'b', value: 2, id: 'up'}], {id: 'wf'}), box({id: 'note'}), connect('note', 'up'), connect('wf:right', 'start:left'));
  d.add(tornado([{label: 'a', low: 1, high: 2, id: 'row1'}], {base: 1}), box({id: 'n2'}), connect('n2', 'row1'));
  d.add(sankey(['x', {id: 'y', label: 'Y'}], [{from: 'x', to: 'y', value: 1}]), box({id: 'n3'}), connect('n3', 'x'), connect('n3:right', 'y'));
  d.add(treemap([{label: 'g', id: 'grp', children: [{label: 'l', value: 1, id: 'leaf'}]}]), box({id: 'n4'}), connect('n4', 'leaf'), connect('n4', 'grp'));
  d.add(radar(['a', 'b', 'c'], [{label: 's', values: [1, 2, 3], id: 'ser'}]), box({id: 'n5'}), connect('n5', 'ser'));
  d.add(mekko([{label: 'c', id: 'col', parts: [{label: 'p', value: 1}]}]), stackedBars([{label: 'c', id: 'col2', parts: [{label: 'p', value: 1}]}]), connect('col', 'col2'));
  d.add(heatmap(['r'], ['c'], [[1]], {id: 'heat'}), box({id: 'n6'}), connect('n6', 'heat'));

  // @ts-expect-error: "nope" is not an id of the waterfall, nor of anything else
  d.add(waterfall([{label: 'a', value: 1, id: 'start'}, {label: 'b', value: 2}]), box({id: 'n7'}), connect('n7', 'nope'));
  // @ts-expect-error: a node id that was never declared
  d.add(sankey(['x', 'y'], [{from: 'x', to: 'y', value: 1}]), box({id: 'n8'}), connect('n8', 'zzz'));
}

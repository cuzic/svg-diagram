import test from 'node:test';
import assert from 'node:assert/strict';
import {box, checkDiagram, closeMeasurer, diagram, raw, screens, sequence, swimlane, table, wf, wireframe} from '../lib/dsl.ts';
import type {Band} from '../lib/dsl.ts';

test.after(() => closeMeasurer());

// every band that takes an id registers it as an anchor, so two bands (or a band and a step / item) sharing one must throw
const seq = (id: string) => sequence([{id: 'a', label: 'A'}, {id: 'b', label: 'B'}], [{from: 'a', to: 'b', label: 'x'}], {id});
const BANDS: [string, (id: string) => Band][] = [
  ['sequence', seq],
  ['table', id => table([{label: 'x'}], [['t']], {id})],
  ['wireframe', id => wireframe(wf.text('a'), {id})],
  ['screens', id => screens([{id, root: wf.text('a')}])],
  ['raw', id => ({...raw({h: 10, draw: () => '<g/>'}), id})], // raw() forwards no id; a hand-built band still registers it
  ['swimlane', id => swimlane([{id: 'l', label: 'L'}], [{id, lane: 'l', title: 'S'}]) as unknown as Band],
];
for (const [name, make] of BANDS) {
  test(`${name}: an id another band already has is a duplicate anchor`, async () => {
    await assert.rejects(checkDiagram(diagram({theme: 'blue'}).add(box({id: 'dup', title: 'x'}), make('dup'))), /duplicate anchor id "dup"/);
    await assert.rejects(checkDiagram(diagram({theme: 'blue'}).add(make('dup'), box({id: 'dup', title: 'x'}))), /duplicate anchor id "dup"/);
  });
}
test('two sequences sharing an id throw', async () => {
  await assert.rejects(checkDiagram(diagram({theme: 'blue'}).add(seq('s'), seq('s'))), /duplicate anchor id "s"/);
});
test('a swimlane\'s own id clashing with its step throws', async () => {
  await assert.rejects(checkDiagram(diagram({theme: 'blue'}).add(swimlane([{id: 'l', label: 'L'}], [{id: 'x', lane: 'l', title: 'S'}], {id: 'x'}))), /duplicate anchor id "x"/);
});

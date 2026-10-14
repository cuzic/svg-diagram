import test from 'node:test';
import assert from 'node:assert/strict';
import {box, checkDiagram, closeMeasurer, diagram, grid, group} from '../lib/dsl.ts';

test.after(() => closeMeasurer());

// grid() takes box() children only (the constructor rejects a group), and a box holds no bands, so there is nothing nested for
// the reveal walk to follow: setting each cell (reveal / until / id) is the whole job. This pins both halves.
test('grid() rejects a group cell, so its reveal handler need not walk nested bands', () => {
  assert.throws(() => grid([group(box({title: 'in', reveal: 3}), {reveal: 2}) as never, box({title: 'b'})], {cols: 2}), /takes box\(\) children only/);
});

test('each grid cell takes its own reveal and counts toward the stages', async () => {
  const {laidOut} = await checkDiagram(diagram({theme: 'blue'}).add(grid([box({id: 'a', title: 'a'}), box({id: 'b', title: 'b', reveal: 3})], {cols: 2}), box({title: 'x'})));
  assert.equal(laidOut.maxReveal, 3);
});

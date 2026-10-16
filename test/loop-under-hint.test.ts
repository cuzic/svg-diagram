import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {steps, connect, diagram, checkDiagram, closeMeasurer} from '../lib/dsl.ts';

test.after(() => closeMeasurer());

const flow = (route: 'straight' | 'loop-under') => diagram({theme: 'blue', title: 't'}).add(
  steps([{title: '調べる'}, {title: '直す'}, {title: '確かめる'}, {title: '出す'}], {id: 's'}),
  connect('s#4:bottom', 's#2:bottom', {route, label: '差し戻し'}),
);

test("a line back through a row of steps stops the build and names route: 'loop-under'; written with it, the line runs under the boxes", async () => {
  const overlap = (await checkDiagram(flow('straight'))).verdict.problems.find(p => p.includes('path overlaps'));
  assert.ok(overlap?.includes("route: 'loop-under'"), overlap);
  assert.deepEqual((await checkDiagram(flow('loop-under'))).verdict.problems, []);
});

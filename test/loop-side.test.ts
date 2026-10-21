import test from 'node:test';
import assert from 'node:assert/strict';
import {box, checkDiagram, closeMeasurer, connect, diagram, row} from '../lib/dsl.ts';

test.after(() => closeMeasurer());

const column = (n: number, width?: number): never[] => Array.from({length: n}, (_, i) => row([box({id: `s${i + 1}`, title: `step ${i + 1}`, ...(width ? {width} : {})})], {justify: 'center'})) as never[];

test("route 'loop-side' runs out past the shared side of two boxes in a column, and stays on the canvas", async () => {
  const d = diagram({theme: 'blue'}).add(...column(4, 600), connect('s4:left', 's1:left', {route: 'loop-side', dip: 40}), connect('s4:right', 's1:right', {route: 'loop-side'}));
  const {laidOut, verdict} = await checkDiagram(d);
  assert.deepEqual(verdict.problems, []);
  const [l, r] = laidOut.connects;
  const boxes = laidOut.laidOut.flatMap(b => b.type === 'row' ? b.children : []);
  const left = Math.min(...boxes.map(b => b.x)), right = Math.max(...boxes.map(b => b.x + b.w));
  // the vertical leg is 40px left of the left edge / 32px (the default) right of the right edge
  assert.deepEqual(l!.points.map(p => p.x), [left, left - 40, left - 40, left]);
  assert.deepEqual(r!.points.map(p => p.x), [right, right + 32, right + 32, right]);
});

test("route 'loop-side' joins anchors on one side only", async () => {
  const d = diagram({theme: 'blue'}).add(...column(2, 600), connect('s2:left', 's1:right', {route: 'loop-side'}));
  await assert.rejects(checkDiagram(d), /same left \/ right \/ top side/);
  const bottom = diagram({theme: 'blue'}).add(...column(2, 600), connect('s2:bottom', 's1:bottom', {route: 'loop-side'}));
  await assert.rejects(checkDiagram(bottom), /use 'loop-under'/);
});

test("a 'loop-side' line that leaves the canvas is reported with the way out", async () => {
  const d = diagram({theme: 'blue'}).add(...(Array.from({length: 3}, (_, i) => box({id: `f${i}`, title: `full ${i}`})) as never[]), connect('f2:left', 'f0:left', {route: 'loop-side'}));
  const {verdict} = await checkDiagram(d);
  assert.match(verdict.problems.join('\n'), /runs outside the .* canvas: the boxes leave no room beside them for route: 'loop-side'/);
});

test("a 'loop-side' label that does not fit beside the line is reported", async () => {
  const d = diagram({theme: 'blue'}).add(...column(3, 700), connect('s3:left', 's1:left', {route: 'loop-side', label: '改善して戻る'}));
  const {verdict} = await checkDiagram(d);
  assert.match(verdict.problems.join('\n'), /label "改善して戻る" runs outside/);
});

test("loop-under keeps drawing what it drew (the side only matters to loop-side)", async () => {
  const d = diagram({theme: 'blue'}).add(row([box({id: 'a', title: 'a'}), box({id: 'b', title: 'b'})]), connect('a:right', 'b:right', {route: 'loop-under'}));
  const {laidOut} = await checkDiagram(d);
  const ys = laidOut.connects[0]!.points.map(p => p.y);
  assert.equal(ys[1], ys[2]);
  assert.ok(ys[1]! > ys[0]!); // down, across, up
});

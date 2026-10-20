import test from 'node:test';
import assert from 'node:assert/strict';
import {headCrossings, searchRoute} from '../lib/route-search.ts';
import {bendsOf, crossingsOf, simplify} from '../lib/polyline-metrics.ts';

const BOUNDS = {x: 0, y: 0, w: 600, h: 400};

test('a free way is one straight run', () => {
  const r = searchRoute({x: 100, y: 200}, {x: 500, y: 200}, [], [], BOUNDS)!;
  assert.deepEqual(simplify(r), [{x: 100, y: 200}, {x: 500, y: 200}]);
});

test('it goes around a box in the way (up, across, down, back to the height of the head: four bends), keeping its margin', () => {
  const box = {x: 250, y: 150, w: 100, h: 100};
  const r = searchRoute({x: 100, y: 200}, {x: 500, y: 200}, [box], [], BOUNDS)!;
  assert.equal(bendsOf(r), 4);
  for (let k = 1; k < r.length; k++) {
    const a = r[k - 1]!, b = r[k]!;
    const hit = Math.max(a.x, b.x) > box.x - 7 && Math.min(a.x, b.x) < box.x + box.w + 7 && Math.max(a.y, b.y) > box.y - 7 && Math.min(a.y, b.y) < box.y + box.h + 7;
    assert.ok(!hit, `run ${k} keeps off the box`);
  }
});

test('two boxes staggered across the way: still no more than four bends', () => {
  const boxes = [{x: 200, y: 120, w: 80, h: 60}, {x: 320, y: 220, w: 80, h: 60}];
  const r = searchRoute({x: 100, y: 200}, {x: 520, y: 200}, boxes, [], BOUNDS)!;
  assert.ok(bendsOf(r) <= 4);
  assert.ok(r[0]!.x === 100 && r[r.length - 1]!.x === 520);
});

test('it keeps a stub out of the tail and a run into the head', () => {
  const r = searchRoute({x: 100, y: 200}, {x: 500, y: 100}, [], [], BOUNDS)!;
  assert.ok(r[1]!.y === 200 && r[1]!.x >= 118, 'leaves along the layers');
  assert.ok(r[r.length - 2]!.y === 100 && r[r.length - 2]!.x <= 474, 'arrives along the layers');
});

test('none when the head lies before the stub', () => {
  assert.equal(searchRoute({x: 100, y: 200}, {x: 120, y: 100}, [], [], BOUNDS), undefined);
});

test('it avoids running along another arrow when going around costs less than the run along it', () => {
  const other = [{x: 150, y: 200}, {x: 450, y: 200}];
  const near = {x: 290, y: 240, w: 10, h: 10}; // a box off the way: its sides are where the route may turn (without it the grid has no row near the other arrow)
  const r = searchRoute({x: 100, y: 200}, {x: 500, y: 200}, [near], [other], BOUNDS)!;
  const along = r.slice(1).filter((b, k) => r[k]!.y === b.y && Math.abs(r[k]!.y - 200) < 4 && Math.min(Math.max(r[k]!.x, b.x), 450) - Math.max(Math.min(r[k]!.x, b.x), 150) > 1);
  assert.equal(along.length, 0, 'no run lies along the other arrow');
});

test('the fewest bends is not bought with a crossing that a route with as many bends avoids (the last bend is part of the cost)', () => {
  // another arrow's run across the layers at x=300 (y 150..250) lies between a head at (500,100) and a tail at (100,200)
  const wall = [{x: 300, y: 150}, {x: 300, y: 250}];
  const r = searchRoute({x: 100, y: 200}, {x: 500, y: 100}, [], [wall], BOUNDS)!;
  assert.equal(crossingsOf([r, wall]), 0, JSON.stringify(r));
  assert.equal(bendsOf(r), 2);
});

test('a crossing on a grid line counts: the route does not run through the other arrow when it can go around', () => {
  // the other run lies exactly where the grid line of a box side (x = 292 = 300 - 8) is
  const box = {x: 300, y: 20, w: 40, h: 40};
  const wall = [{x: 292, y: 150}, {x: 292, y: 250}];
  const r = searchRoute({x: 100, y: 200}, {x: 500, y: 200}, [box], [wall], BOUNDS)!;
  assert.equal(crossingsOf([r, wall]), 0, JSON.stringify(r));
});

test('it keeps clear of the arrowhead of another arrow: no run across its last stretch, even when that is the shortest way', () => {
  // another arrow ends at (400,150) along the layers. The boxes leave only two columns to go up through y = 150: x = 304, where the route crosses two arrows (the tip's and a second one),
  // and x = 392, 8px before the tip, where it crosses one: a run across the arrowhead reads as a join
  const boxes = [{x: 110, y: 100, w: 10, h: 100}, {x: 130, y: 140, w: 166, h: 20}, {x: 400, y: 120, w: 200, h: 60}];
  const tip = [{x: 300, y: 150}, {x: 400, y: 150}], along = [{x: 280, y: 200}, {x: 330, y: 200}];
  const without = searchRoute({x: 100, y: 250}, {x: 500, y: 50}, boxes, [tip, along], BOUNDS, {head: 0})!;
  assert.ok(headCrossings([tip, without]) > 0, 'with no cost for it the route goes through the arrowhead (the figure is a real test)');
  const r = searchRoute({x: 100, y: 250}, {x: 500, y: 50}, boxes, [tip, along], BOUNDS)!;
  assert.ok(r);
  assert.equal(headCrossings([tip, r]), 0, JSON.stringify(r));
});

test('a search that would take more than its budget of steps gives up instead of running long', () => {
  const boxes = Array.from({length: 12}, (_, i) => ({x: 60 + i * 40, y: 60 + (i % 3) * 100, w: 20, h: 30}));
  assert.equal(searchRoute({x: 20, y: 200}, {x: 570, y: 200}, boxes, [], BOUNDS, {budget: 5}), undefined);
});

test('it stays inside the bounds and is the same route every time', () => {
  const boxes = [{x: 200, y: 20, w: 100, h: 360}];
  const a = searchRoute({x: 100, y: 200}, {x: 500, y: 200}, boxes, [], BOUNDS), b = searchRoute({x: 100, y: 200}, {x: 500, y: 200}, boxes, [], BOUNDS);
  assert.deepEqual(a, b);
  assert.ok(a);
  assert.ok(a.every(p => p.x >= 0 && p.x <= 600 && p.y >= 0 && p.y <= 400));
});

test('over its budget it returns the way it has found, not none; before any way is found it gives up', () => {
  const boxes = [{x: 200, y: 20, w: 100, h: 360}];
  const full = searchRoute({x: 100, y: 200}, {x: 500, y: 200}, boxes, [], BOUNDS)!;
  assert.ok(full);
  // a budget that runs out after the first way to the head was found still gives a way
  let found: ReturnType<typeof searchRoute>;
  for (const budget of [30, 60, 100, 200, 400]) { found = searchRoute({x: 100, y: 200}, {x: 500, y: 200}, boxes, [], BOUNDS, {budget}); if (found) break; }
  assert.ok(found, 'some budget finds a way');
  assert.equal(searchRoute({x: 100, y: 200}, {x: 500, y: 200}, boxes, [], BOUNDS, {budget: 1}), undefined);
});

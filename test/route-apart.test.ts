import {test} from 'node:test';
import assert from 'node:assert/strict';
import {moveApart} from '../lib/route-apart.ts';
import {runsTogether} from '../lib/polyline-metrics.ts';

const rects = new Map([['a', {x0: 0, x1: 40, y0: 0, y1: 40}], ['b', {x0: 0, x1: 40, y0: 100, y1: 140}], ['c', {x0: 300, x1: 340, y0: 0, y1: 40}], ['d', {x0: 300, x1: 340, y0: 100, y1: 140}], ['e', {x0: 0, x1: 40, y0: 50, y1: 90}], ['f', {x0: 300, x1: 340, y0: 150, y1: 190}]]);
const P = (x: number, y: number) => ({x, y});

test('two arrows with no end in common whose vertical runs lie along each other are moved apart', () => {
  const routes = new Map([
    [0, [P(40, 20), P(150, 20), P(150, 120), P(300, 120)]], // a -> d
    [1, [P(40, 70), P(152, 70), P(152, 170), P(300, 170)]], // e -> f
  ]);
  const edges = new Map([[0, {from: 'a', to: 'd'}], [1, {from: 'e', to: 'f'}]]);
  const out = moveApart({routes, edges, rects});
  const [r0, r1] = [out.get(0)!, out.get(1)!];
  assert.ok(![0, 1, 2].some(k => [0, 1, 2].some(m => runsTogether({p: r0[k]!, q: r0[k + 1]!}, {p: r1[m]!, q: r1[m + 1]!}))), 'no runs together now');
  assert.equal(r0[0]!.y, 20);
  assert.equal(r1[0]!.y, 70); // the ports stay
});

test('a run is not moved onto an arrow into the same head, nor next to a box', () => {
  const r = new Map(rects).set('g', {x0: 158, x1: 200, y0: 60, y1: 100});
  const routes = new Map([
    [0, [P(40, 20), P(150, 20), P(150, 120), P(300, 120)]], // a -> d
    [1, [P(40, 70), P(152, 70), P(152, 170), P(300, 170)]], // e -> f
    [2, [P(40, 35), P(158, 35), P(158, 120), P(300, 120)]], // b -> d: same head as the first
  ]);
  const edges = new Map([[0, {from: 'a', to: 'd'}], [1, {from: 'e', to: 'f'}], [2, {from: 'b', to: 'd'}]]);
  const out = moveApart({routes, edges, rects: r});
  for (const i of [0, 1]) assert.ok(out.get(i)![1]!.x < 158 - 6 || out.get(i)![1]!.x === routes.get(i)![1]!.x, `arrow ${i} keeps off box g and the head's other arrow`);
});

test('a box a later run already passes close by does not let a run onto its outline', () => {
  const r = new Map(rects).set('g', {x0: 158, x1: 200, y0: 60, y1: 116});
  const routes = new Map([
    [0, [P(40, 20), P(150, 20), P(150, 120), P(300, 120)]],
    [1, [P(40, 70), P(152, 70), P(152, 170), P(300, 170)]],
  ]);
  const edges = new Map([[0, {from: 'a', to: 'd'}], [1, {from: 'e', to: 'f'}]]);
  const out = moveApart({routes, edges, rects: r});
  for (const i of [0, 1]) assert.ok(!(out.get(i)![1]!.x > 158 - 6 && out.get(i)![1]!.x < 200 + 6 && out.get(i)![1]!.x !== routes.get(i)![1]!.x), `arrow ${i} not beside g`);
});

test('a run is not moved onto the separate trunk of an arrow from the same tail', () => {
  const routes = new Map([
    [0, [P(40, 20), P(150, 20), P(150, 120), P(300, 120)]], // a -> d
    [1, [P(40, 70), P(152, 70), P(152, 170), P(300, 170)]], // e -> f
    [2, [P(40, 25), P(158, 25), P(158, 110), P(300, 110)]], // a -> h: its own trunk at 158
  ]);
  const edges = new Map([[0, {from: 'a', to: 'd'}], [1, {from: 'e', to: 'f'}], [2, {from: 'a', to: 'h'}]]);
  const out = moveApart({routes, edges, rects});
  assert.ok(Math.abs(out.get(0)![1]!.x - 158) >= 4);
});

test('an outer return is not moved onto, either', () => {
  const routes = new Map([
    [0, [P(40, 20), P(150, 20), P(150, 120), P(300, 120)]], // a -> d
    [1, [P(40, 70), P(152, 70), P(152, 170), P(300, 170)]], // e -> f
    [2, [P(300, 5), P(158, 5), P(158, 125), P(40, 125)]], // an outer return along x=158
  ]);
  const edges = new Map([[0, {from: 'a', to: 'd'}], [1, {from: 'e', to: 'f'}], [2, {from: 'c', to: 'b', outer: true}]]);
  const out = moveApart({routes, edges, rects});
  for (const i of [0, 1]) assert.ok(Math.abs(out.get(i)![1]!.x - 158) >= 4, JSON.stringify(out.get(i)) + `arrow ${i} is not on the return`);
});

test('arrows from one tail keep their shared trunk', () => {
  const routes = new Map([[0, [P(40, 20), P(150, 20), P(150, 120), P(300, 120)]], [1, [P(40, 30), P(150, 30), P(150, 20), P(300, 20)]]]);
  const edges = new Map([[0, {from: 'a', to: 'd'}], [1, {from: 'a', to: 'c'}]]);
  const out = moveApart({routes, edges, rects});
  for (const [i, r] of routes) assert.equal(out.get(i), r);
});

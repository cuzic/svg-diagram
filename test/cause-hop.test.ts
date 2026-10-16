import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/strict-width.ts';
import {causeCrossings} from '../lib/cause-hop.ts';
import type {HopEdge} from '../lib/cause-hop.ts';
import {causeTree} from '../lib/dsl.ts';
import {layoutCauseBand} from '../lib/toc.ts';
import type {CauseBand, LaidOutCause} from '../lib/types/diagrams.ts';

// ADR 0028 U0: which crossings of a return get a hop. Font-free: fixed text width.
const fixedW = (t: string, size: number): number => t.length * size * 0.6;
const ROLES = {body: 14, note: 12} as never;
const N = (id: string) => ({id, label: id});
const BAND = {x: 0, y: 0, w: 1000, h: 1000};
const ret = (points: {x: number; y: number}[]): HopEdge => ({from: 'a', to: 'b', points, line: 'solid', reversed: true, back: true});
const line = (points: {x: number; y: number}[]): HopEdge => ({from: 'c', to: 'd', points, line: 'solid'});

test('a return run across the layers that crosses a line gets a hop on the side against the flow', () => {
  // flow 'up': the run across the layers is horizontal; the line it crosses runs up
  const r = ret([{x: 100, y: 300}, {x: 400, y: 300}]), l = line([{x: 250, y: 500}, {x: 250, y: 100}]);
  const [c] = causeCrossings([r, l], 'up', BAND, [], []);
  assert.deepEqual([c.over, c.under, c.x, c.y], [0, 1, 250, 300]);
  assert.deepEqual(c.side, {x: 0, y: 1}, 'up: against the flow is down the page');
  assert.equal(c.skipped, undefined);
});

test('the same figure turned to every direction: the same crossings, the bump against the flow', () => {
  // flow 'right': the run across the layers is vertical
  const r = ret([{x: 300, y: 100}, {x: 300, y: 400}]), l = line([{x: 100, y: 250}, {x: 500, y: 250}]);
  const [c] = causeCrossings([r, l], 'right', BAND, [], []);
  assert.deepEqual(c.side, {x: -1, y: 0});
  assert.equal(c.skipped, undefined);
  const [d] = causeCrossings([ret([{x: 300, y: 400}, {x: 300, y: 100}]), line([{x: 500, y: 250}, {x: 100, y: 250}])], 'left', BAND, [], []);
  assert.deepEqual(d.side, {x: 1, y: 0});
  const [e] = causeCrossings([ret([{x: 100, y: 300}, {x: 400, y: 300}]), line([{x: 250, y: 100}, {x: 250, y: 500}])], 'down', BAND, [], []);
  assert.deepEqual(e.side, {x: 0, y: -1});
});

test('a return run along the flow (a lane run) is not hopped: the other line would be the one over', () => {
  const r = ret([{x: 300, y: 100}, {x: 300, y: 400}]), l = line([{x: 100, y: 250}, {x: 500, y: 250}]);
  assert.deepEqual(causeCrossings([r, l], 'up', BAND, [], []), []);
});

test('no hop: next to a corner, an arrowhead, a neighbouring crossing, an AND arc, outside the band, a dashed return, a parallel line beside it', () => {
  const run = [{x: 100, y: 300}, {x: 400, y: 300}], vert = (x: number, a = 500, b = 100) => line([{x, y: a}, {x, y: b}]);
  const skipOf = (r: HopEdge, ls: HopEdge[], ands: {p0: {x: number; y: number}; c: {x: number; y: number}; p1: {x: number; y: number}}[] = [], band = BAND) => causeCrossings([r, ...ls], 'up', band, [], ands).map(c => c.skipped);
  assert.deepEqual(skipOf(ret(run), [vert(104)]), ['corner'], 'near the return\'s own corner');
  assert.deepEqual(skipOf(ret(run), [vert(250, 500, 295)]), ['arrowhead'], 'the other line ends (its arrowhead) just beyond');
  assert.deepEqual(skipOf(ret(run), [vert(250), vert(256)]), ['neighbour', 'neighbour'], 'two crossings too close');
  assert.deepEqual(skipOf(ret(run), [vert(250)], [{p0: {x: 240, y: 293}, c: {x: 250, y: 285}, p1: {x: 260, y: 293}}]), ['and-arc']);
  assert.deepEqual(skipOf(ret(run), [vert(250)], [], {x: 0, y: 0, w: 1000, h: 302}), ['band'], 'the bump would leave the band');
  assert.deepEqual(skipOf({...ret(run), line: 'dashed'}, [vert(250)]), ['dashed']);
  const beside = line([{x: 200, y: 304}, {x: 300, y: 304}]); // a run along the return, 4px to the bump's side
  assert.deepEqual(skipOf(ret(run), [vert(250), beside]), ['parallel']);
});

test('a line that is not a return never hops, and neither does a cutting (blocks) return', () => {
  const l1 = line([{x: 100, y: 300}, {x: 400, y: 300}]), l2 = line([{x: 250, y: 500}, {x: 250, y: 100}]);
  assert.deepEqual(causeCrossings([l1, l2], 'up', BAND, [], []), []);
  assert.deepEqual(causeCrossings([{...ret([{x: 100, y: 300}, {x: 400, y: 300}]), kind: 'blocks'}, l2], 'up', BAND, [], []), []);
});

// the layout: a figure with `hop` keeps the crossings; one without it is exactly as before
const links = [{from: 'a', to: 'b'}, {from: 'b', to: 'c'}, {from: 'b', to: 'd'}, {from: 'c', to: 'e'}, {from: 'd', to: 'f'}, {from: 'e', to: 'g'}, {from: 'f', to: 'g'}, {from: 'g', to: 'a', back: true as const}];
const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
const place = (band: CauseBand): LaidOutCause => layoutCauseBand(band, 0, 0, 1800, fixedW as never, ROLES);

test('hop: true keeps the crossings of a return, and the lines are untouched; without hop nothing is added', () => {
  const plain = place(causeTree(ids.map(N), links, {dir: 'up'})), hop = place(causeTree(ids.map(N), links, {dir: 'up', hop: true}));
  assert.equal(plain.crossings, undefined);
  assert.ok(!plain.edges.some(e => 'reversed' in e), 'no reversed key without hop');
  assert.ok(hop.edges.some(e => e.reversed));
  assert.deepEqual(hop.edges.map(e => e.points), plain.edges.map(e => e.points), 'the routes are the same');
  assert.deepEqual(hop.nodes, plain.nodes);
});

test('hop must be true or false', () => {
  assert.throws(() => causeTree([N('a')], [], {hop: 'yes' as never}), /hop must be true or false/);
});

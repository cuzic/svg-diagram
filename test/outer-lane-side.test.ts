import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/strict-width.ts';
import {layoutLayered} from '../lib/graph-layout.ts';
import {causeTree} from '../lib/dsl.ts';
import {layoutCauseBand} from '../lib/toc.ts';
import {scoreOf} from '../lib/polyline-metrics.ts';
import type {CauseBand} from '../lib/types/diagrams.ts';

// The lane of a return that skips layers may be on the side it is nearer to (layeredAttempt tries far / near / low and keeps the first strictly better, never bigger).
const fixedW = (t: string, size: number): number => t.length * size * 0.6;
const ROLES = {body: 14, note: 12} as never;
const size = {w: 80, h: 30};
const nodes = ['a', 'b', 'c', 'd'].map(id => ({id, size}));
const edges = [{from: 'a', to: 'b'}, {from: 'b', to: 'c'}, {from: 'c', to: 'd'}, {from: 'd', to: 'a'}];

test('layoutLayered outer.side: far puts the lane past the high side, low past the low side, and the figure moves over by what the low lane takes', () => {
  const lanes = (side?: 'far' | 'near' | 'low') => {
    const lay = layoutLayered(nodes, edges, {dir: 'right', outer: {which: 'all', gap: 18, step: 14, ...(side ? {side} : {})}});
    const lane = lay.edges.find(e => e.outer)!.points[1].y, ys = [...lay.nodes.values()].flatMap(n => [n.y, n.y + n.h]);
    return {lane, lo: Math.min(...ys), hi: Math.max(...ys), h: lay.h};
  };
  const far = lanes(), low = lanes('low');
  assert.ok(far.lane > far.hi, 'default: past the high side');
  assert.deepEqual(lanes('far'), far, "'far' is the default");
  assert.ok(low.lane < low.lo, 'low: before the first box');
  assert.ok(low.lane >= 0 && low.lo >= 18, 'and inside the figure: the boxes moved over');
  assert.equal(low.h, far.h, 'one lane takes the same room on either side');
});

const links = JSON.parse('[{"from":"n0","to":"n1"},{"from":"n1","to":"n2"},{"from":"n1","to":"n3"},{"from":"n1","to":"n4"},{"from":"n3","to":"n5"},{"from":"n5","to":"n6"},{"from":"n3","to":"n6"},{"from":"n6","to":"n7"},{"from":"n0","to":"n7"},{"from":"n6","to":"n8"},{"from":"n0","to":"n8"},{"from":"n8","to":"n0","back":true}]');
const band = (): CauseBand => causeTree(Array.from({length: 9}, (_, i) => ({id: `n${i}`, label: `n${i}`})), links, {dir: 'right'});

test('causeTree(): a return whose lane is better on the near side crosses nothing (the far side crossed 2 arrows)', () => {
  const t = layoutCauseBand(band(), 0, 0, 3000, fixedW as never, ROLES);
  assert.equal(scoreOf(t.edges.map(e => e.points)).crossings, 0);
  assert.ok(t.edges.some(e => e.outer), 'it is still a return in an outer lane');
  assert.deepEqual(layoutCauseBand(band(), 0, 0, 3000, fixedW as never, ROLES), t, 'deterministic');
});

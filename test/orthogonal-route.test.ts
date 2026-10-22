import test from 'node:test';
import assert from 'node:assert/strict';
import {routeClear} from '../lib/orthogonal-route.ts';
import type {RouteRect} from '../lib/orthogonal-route.ts';

const hits = (a: RouteRect, p: {x: number; y: number}, q: {x: number; y: number}): boolean => Math.min(p.x, q.x) < a.x + a.w && Math.max(p.x, q.x) > a.x && Math.min(p.y, q.y) < a.y + a.h && Math.max(p.y, q.y) > a.y;
const bounds = {x: 0, y: 0, w: 400, h: 300};

test('routeClear(): goes around a box that stands between the two ends', () => {
  const from = {x: 20, y: 120, w: 60, h: 40}, to = {x: 300, y: 120, w: 60, h: 40}, wall = {x: 160, y: 40, w: 40, h: 220};
  const r = routeClear({from, to, boxes: [from, to, wall], bounds});
  assert.ok(r && r.length >= 4);
  assert.ok(!r.slice(1).some((q, i) => hits(wall, r[i]!, q)));
  assert.ok(r.every((p, i) => i === 0 || p.x === r[i - 1]!.x || p.y === r[i - 1]!.y), 'every run is horizontal or vertical');
});

test('routeClear(): a straight run when nothing is in the way; null when the boxes close every way', () => {
  const from = {x: 20, y: 120, w: 60, h: 40}, to = {x: 300, y: 120, w: 60, h: 40};
  const r = routeClear({from, to, boxes: [from, to], bounds});
  assert.ok(r && r.every(p => p.y === 140), 'one straight run');
  const wall = {x: 160, y: -10, w: 40, h: 320};
  assert.equal(routeClear({from, to, boxes: [from, to, wall], bounds}), null);
});

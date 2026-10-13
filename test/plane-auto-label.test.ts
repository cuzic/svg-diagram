import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutPlane, ticksOf} from '../lib/plane.ts';
import {ROLES} from '../lib/tokens.ts';
import type {PlaneBand} from '../lib/types.ts';

const widthOf = (_atom: string, size: number) => size * 0.6;
const hit = (a: {x: number; y: number; w: number; h: number}, b: {x: number; y: number; w: number; h: number}) =>
  Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.5 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.5;

test('an automatic point label steps off a dimension line', () => {
  // the dimension line runs to the right of the point, through where the label would first go
  const band: PlaneBand = {type: 'plane', x: {max: 10}, y: {max: 10}, height: 400,
    points: [{id: 'a', at: [4, 5], label: 'Anchor'}, {id: 'b', at: [4, 9]}],
    dims: [{from: 'a', to: 'b', label: '4', side: 'right', offset: 20}]};
  const laid = layoutPlane(band, 0, 0, 800, widthOf, ROLES);
  const box = laid.labelBoxes.find(b => b.label === 'Anchor')!;
  assert.ok(!laid.obstacles.some(o => o.dim !== undefined && hit(box, o)), 'the label overlaps no dimension line');
});

test('a categorical axis puts the names at 1..n', () => {
  assert.deepEqual(ticksOf({max: 4, categories: ['営業', '開発', '品質']}), [{at: 1, label: '営業'}, {at: 2, label: '開発'}, {at: 3, label: '品質'}]);
  const laid = layoutPlane({type: 'plane', x: {max: 10}, y: {max: 4, categories: ['営業', '開発', '品質']}, height: 300}, 0, 0, 800, widthOf, ROLES);
  assert.ok(['営業', '開発', '品質'].every(n => laid.texts.some(t => t.s === n)));
});

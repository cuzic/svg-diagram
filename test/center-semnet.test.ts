// ADR 0014 U4: a network figure sits in the middle of a `height` taller than it, and a side-keyed concentric is centred as one block.
// Everything is a relation between margins (never an absolute coordinate), so it does not depend on the font.
import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/strict-width.ts';
import {layoutDependency, resolveDependency} from '../lib/semnet.ts';
import {layoutFlowShape} from '../lib/flow-shapes.ts';
import {concentric} from '../lib/dsl.ts';
import {ROLES} from '../lib/tokens.ts';
import type {ConcentricBand} from '../lib/flow-shapes.ts';

const rough = (atom: string, size: number) => Array.from(atom).length * size * .58;
const spec = resolveDependency(
  [{id: 'a', label: '要件', kind: 'x'}, {id: 'b', label: '設計', kind: 'x'}, {id: 'c', label: '実装', kind: 'x'}],
  [{from: 'a', to: 'b', type: 'depends'}, {from: 'b', to: 'c', type: 'depends'}],
  {},
);
const run = (height?: number) => layoutDependency(spec, {x: 20, y: 40, w: 900, size: 14, widthOf: rough, ...(height === undefined ? {} : {height})});
const top = (p: ReturnType<typeof run>) => Math.min(...p.solids.map(s => s.y));
const bottom = (p: ReturnType<typeof run>) => Math.max(...p.solids.map(s => s.y + s.h));

test('networkCanvas: a taller height puts the nodes in the middle, the legend stays at the bottom', () => {
  const natural = run(), tall = run(natural.h + 200);
  assert.equal(tall.h, natural.h + 200);
  const down = top(tall) - top(natural), room = natural.h - (bottom(natural) - 40); // what the natural figure keeps under its nodes: the legend
  assert.ok(Math.abs(down - 100) <= 4, `moved down by half the extra (${down})`);
  assert.equal(down % 4, 0, 'the move is on the 4px grid');
  const above = top(tall) - 40, below = tall.h - (bottom(tall) - 40) - room;
  assert.ok(Math.abs(above - below) <= 12, `above ${above} vs below ${below} (the 8px margins differ)`);
});

test('networkCanvas: no room (height at or below the content) does not move anything', () => {
  const natural = run();
  for (const h of [1, natural.h - 30, natural.h]) assert.deepEqual(run(h).solids, natural.solids, `height ${h}`);
});

test('concentric with side keys: the circle and its keys are one block in the middle of the width', () => {
  const band = concentric([{label: 'チーム'}, {label: '顧客と取引先'}, {label: '社会'}], {order: 'inner-first', labels: 'side', centre: '利用者'}) as unknown as ConcentricBand;
  const f = layoutFlowShape(band, 24, 24, 892, rough, ROLES);
  const circles = f.primitives.filter(p => p.k === 'circle' && p.r > 10) as unknown as {cx: number; r: number}[];
  const left = Math.min(...circles.map(c => c.cx - c.r)), right = Math.max(...f.texts.map(t => t.x + t.w));
  assert.ok(Math.abs((left - 24) - (24 + 892 - right)) <= 8, `left ${left - 24} vs right ${24 + 892 - right}`);
});

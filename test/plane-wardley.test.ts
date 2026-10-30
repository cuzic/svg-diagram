import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {diagram, plane, checkDiagram, closeMeasurer} from '../lib/dsl.ts';
import type {LaidOutPlane, PlaneOpts} from '../lib/types/figures.ts';

after(closeMeasurer);
const base: PlaneOpts = {x: {max: 4}, y: {max: 1}, height: 320, stages: ['起源', 'カスタム', '製品', 'コモディティ']};
async function laid(opts: PlaneOpts) {
  const r = await checkDiagram(diagram({theme: 'blue'}).add(plane(opts)));
  return {r, p: r.laidOut.laidOut.find((b): b is LaidOutPlane => b.type === 'plane')!};
}

test('plane stages: names sit at the middle of equal columns and dashed dividers run between them', async () => {
  const {r, p} = await laid(base);
  assert.deepEqual(r.verdict.problems, []);
  const w = (p.plotR - p.plotL) / 4;
  for (const [i, name] of ['起源', 'カスタム', '製品', 'コモディティ'].entries()) {
    const t = p.texts.find(t => t.s === name)!;
    assert.ok(Math.abs(t.x - (p.plotL + w * (i + 0.5))) < 1e-6, name);
  }
  const dividers = p.lines.filter(l => l.dashed && l.x1 === l.x2 && l.y1 === p.plotT && l.y2 === p.plotB);
  assert.deepEqual(dividers.map(l => l.x1), [1, 2, 3].map(i => p.plotL + w * i));
});

test('plane stages: needs 2+ names and no x ticks of its own', () => {
  assert.throws(() => plane({...base, stages: ['one']}), /at least 2 names/);
  assert.throws(() => plane({...base, x: {max: 4, ticks: [1]}}), /stages are the x axis ticks/);
});

test('plane evolves: a faint ring at the target and a dashed arrow that stops at its edge', async () => {
  const {r, p} = await laid({...base, points: [{id: 'a', at: [1, 0.5], label: 'A', evolves: {to: 2.5}}]});
  assert.deepEqual(r.verdict.problems, []);
  const w = (p.plotR - p.plotL) / 4, ring = p.points[1]!;
  assert.equal(ring.shape, 'ring');
  assert.equal(ring.tone, 'muted');
  assert.ok(Math.abs(ring.x - (p.plotL + 2.5 * w)) < 1e-6 && Math.abs(ring.y - p.points[0]!.y) < 1e-6);
  const arrow = p.lines.find(l => l.arrow)!;
  assert.ok(arrow.dashed && arrow.x2 < ring.x && ring.x - arrow.x2 <= 8 + 1e-6);
});

test('plane evolves: the target must be right of the point and inside the x axis', () => {
  for (const to of [1, 0.5, 4.5]) assert.throws(() => plane({...base, points: [{at: [1, 0.5], evolves: {to}}]}), /evolves\.to/);
});

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

test('plane stages: {name, to} puts the column edges where they say; the last column runs to the axis end', async () => {
  const {r, p} = await laid({...base, x: {max: 1}, stages: [{name: 'a', to: 0.2}, {name: 'b', to: 0.5}, {name: 'c', to: 0.8}, 'd']});
  assert.deepEqual(r.verdict.problems, []);
  const at = (v: number) => p.plotL + v * (p.plotR - p.plotL);
  for (const [name, mid] of [['a', 0.1], ['b', 0.35], ['c', 0.65], ['d', 0.9]] as const) assert.ok(Math.abs(p.texts.find(t => t.s === name)!.x - at(mid)) < 1e-6, name);
  assert.deepEqual(p.lines.filter(l => l.x1 === l.x2 && l.y1 === p.plotT).map(l => Math.round(l.x1)), [0.2, 0.5, 0.8].map(v => Math.round(at(v))));
  assert.throws(() => plane({...base, x: {max: 1}, stages: [{name: 'a', to: 0.5}, 'b', 'c']}), /every stage but the last/);
  assert.throws(() => plane({...base, x: {max: 1}, stages: [{name: 'a', to: 0.5}, {name: 'b', to: 0.4}, 'c']}), /increase/);
  assert.throws(() => plane({...base, x: {max: 1}, stages: [{name: 'a', to: 0.5}, {name: 'b', to: 1}]}), /last stage/);
});

test('plane stages: names carry no tick marks, grid lines are the dividers, dependencies are solid by default', async () => {
  const {p} = await laid({...base, grid: true, points: [{id: 'a', at: [1, 0.5]}, {id: 'b', at: [3, 0.5]}], lines: [{from: 'a', to: 'b'}]});
  assert.equal(p.ticks.filter(t => t.y2 !== t.y1).length, 0, 'no x tick marks');
  const w = (p.plotR - p.plotL) / 4;
  assert.deepEqual(p.grid.filter(g => g.x1 === g.x2).map(g => g.x1), [1, 2, 3].map(i => p.plotL + w * i));
  assert.equal(p.lines.find(l => l.y1 !== p.plotT)!.dashed, false);
});

test('plane stages: an automatic label stays clear of a divider, a fixed one that touches it is reported', async () => {
  const near = {id: 'a', at: [0.95, 0.5] as [number, number], label: '長い名前のラベル'};
  const {r, p} = await laid({...base, points: [near]});
  assert.deepEqual(r.verdict.problems, []);
  const dx = p.plotL + (p.plotR - p.plotL) / 4, box = p.labelBoxes.find(b => b.label === near.label)!;
  assert.ok(box.x + box.w <= dx + 0.5 || box.x >= dx - 0.5, 'not across the divider');
  const bad = await laid({...base, labels: [{at: [1, 0.5], text: '注記'}]});
  assert.ok(bad.r.verdict.problems.some(m => /overlaps a stage divider/.test(m)));
});

test('plane evolves: follows reveal, yDown and x.min', async () => {
  const {r, p} = await laid({...base, x: {min: 1, max: 5}, yDown: true, points: [{at: [2, 0.3], evolves: {to: 4}, reveal: 2}]});
  assert.deepEqual(r.verdict.problems, []);
  assert.equal(p.points[1]!.reveal, 2);
  assert.equal(p.lines.find(l => l.arrow)!.reveal, 2);
  assert.ok(Math.abs(p.points[1]!.x - (p.plotL + 3 / 4 * (p.plotR - p.plotL))) < 1e-6);
});

test('plane evolves: a target too near its point, on another point, or an arrow through one is reported', async () => {
  const msgs = async (points: NonNullable<PlaneOpts['points']>) => (await laid({...base, points})).r.verdict.problems.join('\n');
  assert.match(await msgs([{id: 'a', at: [1, 0.5], evolves: {to: 1.01}}]), /too short/);
  assert.match(await msgs([{id: 'a', at: [1, 0.5], evolves: {to: 2.5}}, {id: 'b', at: [2.5, 0.5]}]), /sits on|lies on/);
  assert.match(await msgs([{id: 'a', at: [1, 0.5], evolves: {to: 3}}, {id: 'b', at: [2, 0.5]}]), /lies on the evolution arrow/);
  assert.equal(await msgs([{id: 'a', at: [1, 0.5], evolves: {to: 2.5}}, {id: 'b', at: [1, 0.8], evolves: {to: 2.5}}]), '');
});

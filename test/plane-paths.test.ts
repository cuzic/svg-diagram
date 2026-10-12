import {test} from 'node:test';
import assert from 'node:assert/strict';
import {diagram, plane, checkDiagram, closeMeasurer} from '../lib/dsl.ts';
import {emitSvg} from '../lib/emit.ts';
import type {LaidOutPlane, PlaneOpts} from '../lib/types.ts';

const base: PlaneOpts = {x: {max: 30, step: 10}, y: {max: 10, step: 5}, height: 300};
async function laid(opts: PlaneOpts) {
  const r = await checkDiagram(diagram({theme: 'blue'}).add(plane(opts)));
  return {r, p: r.laidOut.laidOut.find((b): b is LaidOutPlane => b.type === 'plane')!};
}
const at = (p: LaidOutPlane, x: number, y: number) => ({x: p.plotL + x / 30 * (p.plotR - p.plotL), y: p.plotB - y / 10 * (p.plotB - p.plotT)});

test('plane paths: a smooth path passes through its points and keeps the monotone shape (no overshoot)', async () => {
  const {r, p} = await laid({...base, paths: [{through: [[0, 0], [10, 0], [20, 10], [30, 10]], smooth: true}]});
  assert.deepEqual(r.verdict.problems, []);
  const path = p.paths![0];
  assert.equal(path.curves.length, 3);
  [[0, 0], [10, 0], [20, 10], [30, 10]].forEach(([x, y], i) => {
    const q = path.pts[i], e = at(p, x, y);
    assert.ok(Math.abs(q.x - e.x) < 1e-6 && Math.abs(q.y - e.y) < 1e-6, 'through the point');
  });
  for (const [c1, c2] of path.curves) for (const c of [c1, c2]) assert.ok(c.y <= p.plotB + 1e-6 && c.y >= p.plotT - 1e-6, 'control points stay inside 0..10');
  assert.ok(path.overshoot < 1e-6);
  // the flat pieces stay flat: tangents at 0 and 10 plateaus are horizontal
  assert.equal(path.curves[0][0].y, path.pts[0].y);
  assert.equal(path.curves[2][1].y, path.pts[3].y);
});

test('plane paths: x not monotone uses centripetal Catmull-Rom and still passes through the points', async () => {
  const {p} = await laid({...base, paths: [{through: [[5, 2], [20, 5], [10, 8], [25, 6]], smooth: true}]});
  const path = p.paths![0];
  assert.equal(path.curves.length, 3);
  for (const [i, [x, y]] of ([[5, 2], [20, 5], [10, 8], [25, 6]] as const).entries()) {
    const q = i === 0 ? path.pts[0] : path.curves[i - 1][2], e = at(p, x, y);
    assert.ok(Math.abs(q.x - e.x) < 1e-6 && Math.abs(q.y - e.y) < 1e-6);
  }
});

test('plane paths: without smooth it is a polyline, solid by default; dashed only when asked', async () => {
  const {r, p} = await laid({...base, paths: [{through: [[0, 0], [10, 5], [20, 2]]}, {through: [[0, 9], [30, 9]], dashed: true}]});
  assert.equal(p.paths![0].curves.length, 0);
  assert.equal(p.paths![0].dashed, false);
  assert.equal(p.paths![1].dashed, true);
  const svg = emitSvg(r.laidOut);
  assert.match(svg, /<path d="M\d+,\d+ L\d+,\d+ L\d+,\d+" fill="none" stroke="#[0-9a-f]{6}" stroke-width="2"\/>/);
  assert.match(svg, /stroke-dasharray="6,4"/);
});

test('plane paths: smooth emits C segments; the arrow follows the tangent at the end and reveal is kept', async () => {
  const {r, p} = await laid({...base, paths: [{through: [[0, 0], [10, 8], [30, 10]], smooth: true, arrow: true, reveal: 2}]});
  assert.match(emitSvg(r.laidOut), /d="M\d+,\d+ C\d+,\d+ \d+,\d+ \d+,\d+ C/);
  assert.equal(p.paths![0].reveal, 2);
  assert.ok(p.paths![0].tip.dx > 0.9, 'the head points along the final tangent');
});

test('plane paths: a path with fewer than 2 points throws; a curve that leaves the axes is reported', async () => {
  await assert.rejects(laid({...base, paths: [{through: [[1, 1]]}]}), /at least 2/);
  const {r} = await laid({...base, paths: [{through: [[0, 0], [30, 0], [0, 10], [30, 10]], smooth: true}]});
  assert.ok(r.verdict.problems.some(m => /leaves the axes/.test(m)));
});

test('plane paths: a plane without paths has no paths field (existing output unchanged)', async () => {
  const {p} = await laid({...base, lines: [{from: [0, 0], to: [10, 5]}]});
  assert.equal('paths' in p, false);
});

test.after(() => closeMeasurer());

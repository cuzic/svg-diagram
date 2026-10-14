import test from 'node:test';
import assert from 'node:assert/strict';
import {box, checkDiagram, closeMeasurer, diagram, dots, people, renderDiagram} from '../lib/dsl.ts';
import type {DotsBand, LaidOutDots, LaidOutPeople, PeopleBand} from '../lib/types/people-dots.ts';

test.after(() => closeMeasurer());

const one = async (type: 'people' | 'dots', band: PeopleBand | DotsBand) => {
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue'}).add(band));
  return {band: laidOut.laidOut.find(b => b.type === type)!, verdict};
};

test('people(100, 76) lays out a 10 x 10 grid with 76 emphasized, and passes verify', async () => {
  const {band, verdict} = await one('people', people(100, 76));
  assert.deepEqual(verdict.problems, []);
  const p = band as LaidOutPeople;
  assert.equal(p.icons.length, 100);
  assert.equal(p.icons.filter(i => i.on).length, 76);
  assert.equal(new Set(p.icons.map(i => i.x)).size, 10);
  assert.equal(new Set(p.icons.map(i => i.y)).size, 10);
  assert.ok(p.icons.slice(0, 76).every(i => i.on) && p.icons.slice(76).every(i => !i.on));
});

test('people() draws emphasized icons filled and the rest as outlines, with an accessible name', async () => {
  const {svg} = await renderDiagram(diagram({theme: 'blue'}).add(people(10, 3, {alt: '10 人中 3 人'})), {name: 'p.svg', budget: 'cacheOnly'});
  assert.match(svg, /<g role="img" aria-label="10 人中 3 人">/);
  assert.equal(svg.match(/fill="none" stroke=/g)?.length, 7);
  assert.equal(svg.match(/<path d="M12 4a4 4[^"]*" transform="[^"]*" fill="#/g)?.length, 3);
});

test('people(total, [k1, k2]) fills k1 in tone, the next k2 in tone2, the rest as outlines', async () => {
  const {svg, laidOut} = await renderDiagram(diagram({theme: 'blue'}).add(people(100, [35, 47], {tone: 'accent', tone2: 'danger'})), {name: 'p2.svg', budget: 'cacheOnly'});
  const p = laidOut.laidOut.find(b => b.type === 'people') as LaidOutPeople;
  assert.deepEqual([p.icons.filter(i => i.on && !i.second).length, p.icons.filter(i => i.second).length, p.icons.filter(i => !i.on).length], [35, 47, 18]);
  assert.ok(p.icons.slice(35, 82).every(i => i.second) && p.icons.slice(0, 35).every(i => i.on && !i.second));
  assert.equal(svg.match(/fill="#b91c1c"/gi)?.length, 47);
  assert.equal(svg.match(/fill="none" stroke=/g)?.length, 18);
  assert.throws(() => people(100, [60, 41]), /k1 \+ k2 <= total/);
  assert.throws(() => people(10, [1, -1]), /count must be/);
  assert.throws(() => people(10, [1, 1], {tone2: 'text' as 'accent'}), /tone2 must be/);
});

test('people() checks its arguments and the width', async () => {
  assert.throws(() => people(10, 11), /count must be/);
  assert.throws(() => people(10.5, 1), /total must be/);
  assert.throws(() => people(10, 1, {cols: 11}), /cols must be/);
  assert.throws(() => people(10, 1, {tone: 'text' as 'accent'}), /tone must be/);
  assert.throws(() => people(10, 1, {reveal: 1} as object), /takes no reveal/);
  await assert.rejects(checkDiagram(diagram({theme: 'blue', width: 200}).add(people(100, 76))), /fewer cols, a smaller size or gap/);
});

test('people(): tone may be muted, rest and side are drawn, and side stays inside the column', async () => {
  const {svg, laidOut} = await renderDiagram(diagram({theme: 'blue'}).add(people(100, 76, {tone: 'muted', rest: 'accent', size: 20, gap: 4, align: 'left', side: {value: '76%', label: '経営者の認識', tone: 'danger'}})), {name: 'ps.svg', budget: 'cacheOnly'});
  assert.match(svg, />76%</);
  assert.match(svg, />経営者の認識</);
  const p = laidOut.laidOut.find(b => b.type === 'people') as LaidOutPeople;
  assert.equal(p.texts.length, 2);
  assert.ok(p.texts.every(t => t.x >= p.x + 10 * 20 + 9 * 4 && t.y > p.y && t.y < p.y + p.h));
  assert.ok(p.w <= laidOut.width);
  assert.throws(() => people(10, 1, {side: {value: ''}}), /needs a value/);
  await assert.rejects(checkDiagram(diagram({theme: 'blue', width: 360}).add(people(100, 76, {size: 24, gap: 4, side: {value: '76%'}}))), /number beside them/);
});

test('dots(): dots that would touch pile up, and no two dots overlap', async () => {
  const values = Array.from({length: 40}, (_, i) => 0.1 + (i % 5) * 0.004);
  const {band, verdict} = await one('dots', dots(values));
  assert.deepEqual(verdict.problems, []);
  const d = band as LaidOutDots;
  assert.equal(d.dots.length, 40);
  for (const [i, a] of d.dots.entries()) for (const b of d.dots.slice(i + 1)) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 2 * d.r, `dots overlap at ${a.x},${a.y}`);
  for (const p of d.dots) assert.ok(p.y - d.r >= d.y && p.y < d.axis.y);
});

test('dots(): zones tone the dots inside them; an explicit tone wins', async () => {
  const {band} = await one('dots', dots([0.1, 0.2, {at: 0.25, tone: 'accent'}, 0.8], {zones: [{from: 0, to: 0.3, label: '遅れ'}]}));
  assert.deepEqual((band as LaidOutDots).dots.map(p => p.tone), ['danger', 'danger', 'accent', 'accent']);
});

test('spotlight dims people and dots as a whole, and can focus them by id', async () => {
  const focus = diagram({theme: 'blue', spotlight: 'lane'}).add(box({id: 'b', title: 'x'}), dots([0.1, 0.5], {id: 'lane', zones: [{from: 0, to: 0.3, label: '遅れ'}]}));
  const {svg, laidOut} = await renderDiagram(focus, {name: 'dots-spot.svg', budget: 'cacheOnly'});
  assert.equal(laidOut.laidOut.find(b => b.type === 'dots')!.dim, false);
  assert.equal(laidOut.laidOut.find(b => b.type === 'box')!.dim, true);
  assert.match(svg, /<circle [^>]*fill="#b91c1c"/i);
  const dim = diagram({theme: 'blue', spotlight: 'b'}).add(box({id: 'b', title: 'x'}), people(4, 2, {id: 'crowd'}));
  const r = await renderDiagram(dim, {name: 'people-dim.svg', budget: 'cacheOnly'});
  assert.equal(r.laidOut.laidOut.find(b => b.type === 'people')!.dim, true);
  assert.doesNotMatch(r.svg.slice(r.svg.indexOf('role="img"')), /fill="#1[0-9a-f]{5}"/i);
});

test('dots(): bad input is rejected', async () => {
  assert.throws(() => dots([]), /at least one/);
  assert.throws(() => dots([2]), /outside the lane/);
  assert.throws(() => dots([0.5], {min: 1, max: 1}), /min < max/);
  assert.throws(() => dots([0.5], {zones: [{from: 0, to: 0.5, label: 'a'}, {from: 0.4, to: 1, label: 'b'}]}), /overlap/);
  assert.throws(() => dots([0.5], {zones: [{from: 0, to: 0.5, label: ''}]}), /needs a label/);
  await assert.rejects(checkDiagram(diagram({theme: 'blue'}).add(dots(Array(30).fill(0.5), {height: 20}))), /too small for its tallest pile/);
  await assert.rejects(checkDiagram(diagram({theme: 'blue', width: 360}).add(dots([0.5], {lowLabel: '遅いほうの端のとても長いラベル', highLabel: '速いほうの端のとても長いラベル'}))), /overlap|leaves the figure|too narrow/);
});

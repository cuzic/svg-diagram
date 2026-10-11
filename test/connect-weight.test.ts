import test from 'node:test';
import assert from 'node:assert/strict';
import {box, checkDiagram, closeMeasurer, connect, diagram, legend, renderDiagram, row} from '../lib/dsl.ts';
import {applyAutoLegend, edgeStats, legendKeys, lintDiagram, usedNotation} from '../lib/rules.ts';
import type {ConnectInput} from '../lib/strict.ts';
import type {Diagram} from '../lib/types.ts';
import type {LaidOutConnect, LegendBand, Point} from '../lib/types.ts';

test.after(() => closeMeasurer());

const svgOf = async (d: Diagram) => (await renderDiagram(d, {name: 't', budget: 'measure'})).svg;
const two = (opts: ConnectInput) =>
  diagram({theme: 'blue', title: 't'}).add(row([box({id: 'a', title: 'A'}), box({id: 'b', title: 'B'})], {gap: 120}), connect('a:right', 'b:left', opts));

test("weight: 'strong' draws a 5px line with its own fixed-size arrowhead, and a diagram without it is unchanged", async () => {
  const svg = await svgOf(two({weight: 'strong'}));
  assert.match(svg, /stroke-width="5" marker-end="url\(#dsl-arrow-strong\)"/);
  assert.match(svg, /<marker id="dsl-arrow-strong"[^>]*markerUnits="userSpaceOnUse"/);
  const plain = await svgOf(two({}));
  assert.ok(!plain.includes('dsl-arrow-strong'));
  assert.ok(!plain.includes('stroke-width="5"'));
});

test('weight: the line stops short so the arrowhead tip lands on the box edge', async () => {
  const {laidOut} = await checkDiagram(two({weight: 'strong'}));
  const c = laidOut.connects[0];
  const svg = await svgOf(two({weight: 'strong'}));
  const x2 = Number(/ L([\d.-]+),/.exec(svg.slice(svg.indexOf('stroke-width="5"') - 80))![1]);
  assert.ok(c.to.x - x2 > 4 && c.to.x - x2 < 8, `line ends ${c.to.x - x2}px before the edge`);
});

test('weight combines with dashed / dotted, and with arrow: none (no marker)', async () => {
  assert.match(await svgOf(two({weight: 'strong', line: 'dashed'})), /stroke-width="5" stroke-dasharray="6,4"/);
  const none = await svgOf(two({weight: 'strong', arrow: 'none'}));
  assert.ok(!none.includes('dsl-arrow-strong'));
});

test("weight with line: 'double' throws (both mean a thick line)", () => {
  assert.throws(() => connect('a', 'b', {weight: 'strong', line: 'double'} as never), /double/);
  assert.throws(() => legend([{line: 'double', weight: 'strong', label: 'x'}]), /double/);
  assert.throws(() => diagram({theme: 'blue', title: 't', connectDefaults: {line: 'double'}}).add(connect('a', 'b', {weight: 'strong'})), /double/);
});

test('weight: a dimmed strong arrow gets the dim strong marker', async () => {
  const d = diagram({theme: 'blue', title: 't', spotlight: {ids: ['a'], edges: 'between'}}).add(
    row([box({id: 'a', title: 'A'}), box({id: 'b', title: 'B'})], {gap: 120}), connect('a:right', 'b:left', {weight: 'strong'}),
  );
  const svg = await svgOf(d);
  assert.match(svg, /marker-end="url\(#dsl-arrow-strong-dim\)"/);
  assert.match(svg, /<marker id="dsl-arrow-strong-dim"/);
});

test("legend: a used weight is a notation key; legend: 'auto' adds 強い流れ and lint reports a missing one", () => {
  const bands = [box({id: 'a', title: 'a'}), box({id: 'b', title: 'b'}), connect('a', 'b', {weight: 'strong'})];
  assert.deepEqual([...usedNotation(bands)].sort(), ['line:solid', 'weight:strong']);
  const d = diagram({theme: 'blue', legend: 'auto', title: 't'});
  d.add(...bands);
  applyAutoLegend(d);
  const items = (d.bands.find(b => b.type === 'legend') as LegendBand).items;
  assert.deepEqual(items.find(i => i.weight)!, {line: 'solid', weight: 'strong', label: '強い流れ'});
  assert.ok(legendKeys(d.bands).has('weight:strong'));
  const plain = diagram({theme: 'blue', title: 't'}).add(...bands);
  assert.ok(lintDiagram({...plain, laidOut: [], connects: []}).some(f => f.rule === 'legend-missing' && f.message.includes('weight:strong')));
});

test('legend({weight}) fills in the solid line', () => {
  assert.equal(legend([{weight: 'strong', label: 'x'}]).items[0].line, 'solid');
});

test('edgeStats: parallel lines count as overlapping at a wider distance when strong', () => {
  const c = (y: number, weight?: 'strong') => ({points: [{x: 0, y}, {x: 100, y}] as Point[], fromId: `f${y}`, toId: `t${y}`, weight}) as unknown as LaidOutConnect;
  assert.equal(edgeStats([c(0), c(4)]).overlaps, 0);
  assert.equal(edgeStats([c(0, 'strong'), c(4)]).overlaps, 1);
  assert.equal(edgeStats([c(0, 'strong'), c(5, 'strong')]).overlaps, 1);
  assert.equal(edgeStats([c(0, 'strong'), c(7, 'strong')]).overlaps, 0);
});

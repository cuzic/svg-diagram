// Spec parts of round R6 (lib/spec-parts/r6.ts): QC charts from raw data draw the same as the DSL, English carries no Japanese, and
// mistakes are reported at their place.
import test from 'node:test';
import assert from 'node:assert/strict';
import {boxplot, checkSheet, closeMeasurer, controlChart, diagram, histogram, rangeBars, renderDiagram, scatter} from '../lib/dsl.ts';
import {partCatalog, specToDiagram, validateSpec} from '../lib/spec.ts';
import type {Diagram} from '../lib/types/index.ts';

test.after(() => closeMeasurer());

const svgOf = async (d: unknown) => (await renderDiagram(d as Diagram, {name: 'x.svg', budget: 'cacheOnly'})).svg;
const spec = (...parts: unknown[]) => ({version: 1, title: '例', parts});
const dsl = (band: unknown) => diagram({theme: 'blue', title: '例'}).add(band as never);
const pathsOf = (input: unknown) => validateSpec(input).map(i => i.path);
const JAPANESE = /[　-ヿ㐀-鿿＀-￯]/;
const VALUES = [9.8, 10.1, 10.0, 10.2, 9.9, 10.0, 10.3, 9.7, 10.1, 10.0, 9.9, 10.2];

test('a histogram and a scatter diagram draw the same SVG as the DSL', async () => {
  assert.equal(await svgOf(specToDiagram(spec({type: 'histogram', values: VALUES, unit: '本', lsl: 9.75, usl: 10.25, target: 10, normal: true}))),
    await svgOf(dsl(histogram(VALUES, {unit: '本', lsl: 9.75, usl: 10.25, target: 10, normal: true}))));
  const points = [{x: 1, y: 2, group: 'A'}, {x: 2, y: 3, group: 'B'}, {x: 3, y: 5, group: 'A'}, {x: 4, y: 4, group: 'B'}];
  assert.equal(await svgOf(specToDiagram(spec({type: 'scatter', x: '温度', y: '率', points, regression: true}))),
    await svgOf(dsl(scatter(points, {x: '温度', y: '率', regression: true, crossMark: '×'}))));
});

test('control charts take the data their chart needs, and draw the same SVG as the DSL', async () => {
  const values = [3, 5, 4, 2, 6, 4, 3, 5, 4, 13];
  assert.equal(await svgOf(specToDiagram(spec({type: 'controlChart', chart: 'c', values, xLabel: '日'}))),
    await svgOf(dsl(controlChart('c', values, {xLabel: '日', crossMark: '×'}))));
  const samples = [{n: 100, d: 3}, {n: 120, d: 5}, {n: 90, d: 2}, {n: 110, d: 12}];
  assert.equal(await svgOf(specToDiagram(spec({type: 'controlChart', chart: 'p', samples}))), await svgOf(dsl(controlChart('p', samples, {crossMark: '×'}))));
  const subgroups = [[10.1, 10.0, 9.9], [10.2, 10.1, 10.0], [9.9, 10.0, 10.1], [10.0, 10.2, 9.8]];
  assert.equal(await svgOf(specToDiagram(spec({type: 'controlChart', chart: 'xbar', subgroups, limits: {cl: 10, ucl: 10.4, lcl: 9.6}}))),
    await svgOf(dsl(controlChart('xbar', subgroups, {limits: {cl: 10, ucl: 10.4, lcl: 9.6}, crossMark: '×'}))));
});

test('a check sheet, range bars and a box plot draw the same SVG as the DSL', async () => {
  const rows = [{label: '傷', counts: [3, 5]}, {label: '汚れ', counts: [1, 0]}];
  assert.equal(await svgOf(specToDiagram(spec({type: 'checkSheet', columns: ['月', '火'], items: rows, corner: '種類'}))), await svgOf(dsl(checkSheet(rows, ['月', '火'], {corner: '種類'}))));
  assert.equal(await svgOf(specToDiagram(spec({type: 'checkSheet', columns: ['月', '火'], items: [{label: '傷'}], boxes: true}))), await svgOf(dsl(checkSheet([{label: '傷'}], ['月', '火'], {boxes: true}))));
  assert.equal(await svgOf(specToDiagram(spec({type: 'rangeBars', unit: '万円', decimals: 1, items: [{label: '開発', low: 3.2, high: 5.8, tone: 'accent'}, {label: '試験', low: 1, high: 2}]}))),
    await svgOf(dsl(rangeBars([{label: '開発', range: [3.2, 5.8], tone: 'accent'}, {label: '試験', range: [1, 2]}], {unit: '万円', valueFormat: 1}))));
  const groups = [{label: 'A', values: [1, 2, 3, 4, 9]}, {label: 'B', values: [2, 3, 3, 4]}];
  assert.equal(await svgOf(specToDiagram(spec({type: 'boxplot', groups, label: '分', points: true, counts: true}))), await svgOf(dsl(boxplot(groups, {label: '分', kind: ['box', 'strip'], counts: true} as never))));
});

test('in English, the words the QC charts write by themselves are English', async () => {
  const en = (part: unknown) => ({version: 1, title: 'Example', lang: 'en', parts: [part]});
  for (const part of [
    {type: 'histogram', values: VALUES, lsl: 9.75, usl: 10.25, target: 10},
    {type: 'scatter', x: 'Temp', y: 'Rate', regression: true, points: [{x: 1, y: 2, group: 'A'}, {x: 2, y: 3, group: 'B'}, {x: 3, y: 5, group: 'A'}]},
    {type: 'controlChart', chart: 'c', values: [3, 5, 4, 2, 6, 4, 3, 5, 4, 13]},
    {type: 'controlChart', chart: 'p', samples: [{n: 100, d: 3}, {n: 120, d: 5}, {n: 90, d: 2}, {n: 110, d: 12}]},
    {type: 'controlChart', chart: 'x', values: [1, 2, 3, 4, 5, 6, 7, 8, 9]},
    {type: 'checkSheet', columns: ['Mon', 'Tue'], items: [{label: 'Scratch', counts: [3, 5]}]},
    {type: 'rangeBars', items: [{label: 'Build', low: 3, high: 5}]},
    {type: 'boxplot', groups: [{label: 'A', values: [1, 2, 3, 4]}], counts: true, values: 'median'},
  ]) {
    const svg = await svgOf(specToDiagram(en(part)));
    assert.doesNotMatch(svg, JAPANESE, `${(part as {type: string}).type}: ${svg.match(new RegExp(`.{0,40}${JAPANESE.source}.{0,20}`))?.[0]}`);
  }
});

test('QC mistakes are reported at their place', () => {
  assert.deepEqual(pathsOf(spec({type: 'histogram', values: [1, 2], bins: 5, width: 1})), ['parts[0].width']);
  assert.deepEqual(pathsOf(spec({type: 'histogram', values: [1, 2], lsl: 3, usl: 2})), ['parts[0].usl']);
  assert.deepEqual(pathsOf(spec({type: 'histogram', values: [4, 4, 4]})), ['parts[0].values']);
  assert.deepEqual(pathsOf(spec({type: 'histogram', values: [0, 1000], width: 1})), ['parts[0].width']);
  const pts = [{x: 1, y: 1}, {x: 2, y: 2, group: 'a'}];
  assert.deepEqual(pathsOf(spec({type: 'scatter', x: 'x', y: 'y', points: pts})), ['parts[0].points[0].group']);
  assert.deepEqual(pathsOf(spec({type: 'scatter', x: 'x', y: 'y', regression: true, points: [{x: 1, y: 1}, {x: 1, y: 2}, {x: 1, y: 3}]})), ['parts[0].regression']);
  assert.deepEqual(pathsOf(spec({type: 'scatter', x: 'x', y: 'y', points: ['a', 'b', 'c', 'd', 'e'].map((group, i) => ({x: i, y: i, group}))})), ['parts[0].points']);
  assert.deepEqual(pathsOf(spec({type: 'controlChart', chart: 'p', values: [1, 2]})), ['parts[0].samples', 'parts[0].values']);
  assert.deepEqual(pathsOf(spec({type: 'controlChart', chart: 'xbar', subgroups: [[1, 2], [1, 2, 3]]})), ['parts[0].subgroups[1]']);
  assert.deepEqual(pathsOf(spec({type: 'controlChart', chart: 'c', values: [1, 2.5, 3]})), ['parts[0].values[1]']);
  assert.deepEqual(pathsOf(spec({type: 'controlChart', chart: 'np', samples: [{n: 10, d: 3}, {n: 10, d: 12}]})), ['parts[0].samples[1].d']);
  assert.deepEqual(pathsOf(spec({type: 'controlChart', chart: 'x', values: [1, 2, 3], at: ['a', 'b']})), ['parts[0].at']);
  assert.deepEqual(pathsOf(spec({type: 'controlChart', chart: 'x', values: [1, 2, 3], limits: {cl: 2, ucl: 1, lcl: 3}})), ['parts[0].limits.ucl', 'parts[0].limits.lcl']);
  assert.deepEqual(pathsOf(spec({type: 'checkSheet', columns: ['a', 'b'], items: [{label: 'x', counts: [1]}, {label: 'x'}]})), ['parts[0].items[1].label', 'parts[0].items[0].counts']);
  assert.deepEqual(pathsOf(spec({type: 'checkSheet', columns: ['a'], items: [{label: 'x'}], total: true})), ['parts[0].total']);
  assert.deepEqual(pathsOf(spec({type: 'rangeBars', items: [{label: 'a', low: 5, high: 5}]})), ['parts[0].items[0].high']);
  assert.deepEqual(pathsOf(spec({type: 'boxplot', groups: [{label: 'a', values: [1, 2, 3]}, {label: 'a', values: [1, 2, 3]}]})), ['parts[0].groups[1].label']);
});

test('the largest QC charts the schema allows stay quick', async () => {
  const many = Array.from({length: 300}, (_, i) => Math.sin(i * 12.9898) * 50 + 100);
  for (const part of [
    {type: 'histogram', values: many, normal: true, lsl: 20, usl: 180},
    {type: 'scatter', x: 'x', y: 'y', regression: true, points: many.slice(0, 200).map((y, i) => ({x: i, y, group: ['a', 'b', 'c', 'd'][i % 4]}))},
    {type: 'controlChart', chart: 'x', values: many.slice(0, 100), at: many.slice(0, 100).map((_, i) => `L${i + 1}`)},
    {type: 'boxplot', points: true, groups: Array.from({length: 4}, (_, g) => ({label: `G${g}`, values: many}))},
  ]) {
    const t = performance.now();
    const issues = validateSpec(spec(part));
    if (!issues.length) await svgOf(specToDiagram(spec(part)));
    assert.ok(performance.now() - t < 2000, `${part.type} took ${Math.round(performance.now() - t)} ms`);
  }
});

test('every R6 catalog example is in the catalog', () => {
  const types = new Set(partCatalog().map(p => p.type));
  for (const t of ['histogram', 'scatter', 'controlChart', 'checkSheet', 'rangeBars', 'boxplot']) assert.ok(types.has(t), t);
});

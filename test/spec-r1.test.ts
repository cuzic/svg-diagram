// Spec parts of round R1 (lib/spec-parts/r1.ts): charts of numbers draw the same as the DSL, and mistakes are reported at their place.
import test from 'node:test';
import assert from 'node:assert/strict';
import {bars, closeMeasurer, diagram, lines, pareto, radar, renderDiagram, stackedBars, waterfall} from '../lib/dsl.ts';
import {specToDiagram, validateSpec} from '../lib/spec.ts';
import type {Diagram} from '../lib/types/index.ts';

test.after(() => closeMeasurer());

const svgOf = async (d: unknown) => (await renderDiagram(d as Diagram, {name: 'x.svg', budget: 'cacheOnly'})).svg;
const spec = (...parts: unknown[]) => ({version: 1, title: '例', parts});
const dsl = (band: unknown) => diagram({theme: 'blue', title: '例'}).add(band as never);
const pathsOf = (input: unknown) => validateSpec(input).map(i => i.path);

test('bars, with a reference line and decimals, draw the same SVG as the DSL', async () => {
  const data = [{label: '4月', value: 12.5}, {label: '5月', value: 15}, {label: '6月', value: 9.25, tone: 'danger'}];
  const lineList = [{at: 11, label: '目標'}];
  assert.equal(await svgOf(specToDiagram(spec({type: 'bars', dir: 'v', unit: '件', data, lines: lineList, grid: true, decimals: 1}))),
    await svgOf(dsl(bars(data as never, {dir: 'v', unit: '件', lines: lineList, grid: true, valueFormat: 1}))));
  assert.equal(await svgOf(specToDiagram(spec({type: 'bars', data}))), await svgOf(dsl(bars(data as never))));
});

test('lines draw the same SVG as the DSL', async () => {
  const categories = ['1月', '2月', '3月'];
  const series = [{label: '実績', values: [3, -1, 4], smooth: true}, {label: '計画', values: [2, 2, 2], ideal: true}];
  assert.equal(await svgOf(specToDiagram(spec({type: 'lines', categories, series, xLabel: '月', yLabel: '利益', yMin: -5, yMax: 5, target: {at: 3, label: '目標'}, markers: false}))),
    await svgOf(dsl(lines(series as never, {x: {categories, label: '月'}, y: {label: '利益', min: -5, max: 5}, target: {at: 3, label: '目標'}, markers: false}))));
});

test('stacked bars draw the same SVG as the DSL, by value and by percent', async () => {
  const columns = [{label: 'Q1', values: [1, 2]}, {label: 'Q2', values: [3, 0]}];
  const parts = columns.map(c => ({label: c.label, parts: [{label: 'A', value: c.values[0] as number}, {label: 'B', value: c.values[1] as number}]}));
  assert.equal(await svgOf(specToDiagram(spec({type: 'stackedBars', series: ['A', 'B'], columns, unit: '台'}))), await svgOf(dsl(stackedBars(parts, {unit: '台'}))));
  assert.equal(await svgOf(specToDiagram(spec({type: 'stackedBars', series: ['A', 'B'], columns, percent: true}))), await svgOf(dsl(stackedBars(parts, {percent: true}))));
});

test('a waterfall, a radar chart and a Pareto chart draw the same SVG as the DSL', async () => {
  const steps = [{label: '前年', value: 100}, {label: '増', value: 30}, {label: '減', value: -10, tone: 'muted'}, {label: '今年', kind: 'total'}];
  assert.equal(await svgOf(specToDiagram(spec({type: 'waterfall', steps, unit: '円', dir: 'h', connectors: false}))), await svgOf(dsl(waterfall(steps as never, {unit: '円', dir: 'h', connectors: false}))));
  const axes = ['a', 'b', 'c'], series = [{label: 'X', values: [1, 2, 3]}];
  assert.equal(await svgOf(specToDiagram(spec({type: 'radar', axes, series, max: 5, values: true}))), await svgOf(dsl(radar(axes, series, {max: 5, values: true}))));
  const items = [{label: '傷', value: 4}, {label: '汚れ', value: 9}, {label: '欠け', value: 1}, {label: '色', value: 2}];
  assert.equal(await svgOf(specToDiagram(spec({type: 'pareto', items, top: 2, guide: 70, unit: '件'}))), await svgOf(dsl(pareto(items, {top: 2, guide: 70, unit: '件'}))));
});

test('in English, a Pareto chart folds the rest into Other', async () => {
  const items = [{label: 'Scratch', value: 4}, {label: 'Stain', value: 9}, {label: 'Chip', value: 1}];
  const en = {...spec({type: 'pareto', items, top: 1}), lang: 'en'};
  assert.equal(validateSpec(en).length, 0);
  assert.match(await svgOf(specToDiagram(en)), /Other/);
});

test('chart mistakes are reported at their place', () => {
  assert.deepEqual(pathsOf(spec({type: 'bars', data: [{label: 'a', value: 1}, {label: 'a', value: 2}], lines: [{at: 1}]})), ['parts[0].data[1].label', 'parts[0].lines']);
  assert.deepEqual(pathsOf(spec({type: 'bars', dir: 'v', data: [{label: 'a', value: 1}], lines: [{at: 5}]})), ['parts[0].lines[0].at']);
  assert.deepEqual(pathsOf(spec({type: 'bars', data: [{label: 'a', value: -1}]})), ['parts[0].data[0].value']);
  assert.deepEqual(pathsOf(spec({type: 'lines', categories: ['a', 'b'], series: [{label: 's', values: [1, 2, 3]}]})), ['parts[0].series[0].values']);
  assert.deepEqual(pathsOf(spec({type: 'lines', categories: ['a', 'b'], yMax: 1, series: [{label: 's', values: [1, 2]}]})), ['parts[0].series[0].values[1]']);
  assert.deepEqual(pathsOf(spec({type: 'stackedBars', series: ['A', 'B'], columns: [{label: 'x', values: [1]}]})), ['parts[0].columns[0].values']);
  assert.deepEqual(pathsOf(spec({type: 'stackedBars', percent: true, series: ['A'], columns: [{label: 'x', values: [0]}, {label: 'y', values: [1]}]})), ['parts[0].columns[0].values']);
  assert.deepEqual(pathsOf(spec({type: 'waterfall', steps: [{label: 'a', kind: 'total'}, {label: 'b'}, {label: 'c', kind: 'start', value: 1}]})), ['parts[0].steps[0].kind', 'parts[0].steps[1].value', 'parts[0].steps[2].kind']);
  assert.deepEqual(pathsOf(spec({type: 'radar', axes: ['a', 'b', 'c', 'd'], max: 5, series: [{label: 's', values: [1, 2, 9, 1]}, {label: 't', values: [1, 2, 3]}]})), ['parts[0].series[0].values[2]', 'parts[0].series[1].values']);
  assert.deepEqual(pathsOf(spec({type: 'pareto', top: 2, items: [{label: 'a', value: 0}, {label: 'b', value: 0}]})), ['parts[0].items', 'parts[0].top']);
  assert.deepEqual(pathsOf(spec({type: 'pareto', guide: true, items: [{label: 'a', value: 1}, {label: 'b', value: 2}]})), ['parts[0].guide']);
});

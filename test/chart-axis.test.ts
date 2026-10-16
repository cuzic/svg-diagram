import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {bars, caption, checkDiagram, closeMeasurer, diagram, group, row, stackedBars, tornado, waterfall} from '../lib/dsl.ts';
import {waterfallScale} from '../lib/charts-waterfall.ts';

test.after(() => closeMeasurer());

const invest = [{label: '開発', value: 3}, {label: '運用', value: 2}, {label: '保守', value: 0.76}];
const ret = [{label: '売上', value: 5}, {label: '削減', value: 3}, {label: '効果', value: 1.5}];
const wf = (steps: typeof invest, opts: object = {}) => waterfall([{label: '開始', value: 0}, ...steps, {label: '合計', kind: 'total'}] as never, {unit: '百万ドル', dir: 'h', ...opts});
const found = async (...bands: unknown[]) => (await checkDiagram(diagram({theme: 'blue', title: 't'}).add(...(bands as never[])))).verdict.findings.filter(f => f.rule === 'chart-axis-mismatch');

test('waterfall({domain}): the axis runs to the written end points; a domain smaller than the data, or a bad one, is an error', async () => {
  const a = wf(ret).spec as never, b = wf(ret, {domain: [0, 20]}).spec as never;
  assert.equal(waterfallScale(a).max, 10);
  assert.equal(waterfallScale(b).max, 20);
  assert.throws(() => wf(ret, {domain: [0, 5]}), /domain \[0, 5\] is smaller than the data/);
  assert.throws(() => wf(ret, {domain: [5, 5]}), /domain must be \[lo, hi\]/);
  assert.throws(() => wf(ret, {domain: [0, NaN]}), /domain must be/);
  assert.throws(() => wf(ret, {axisGroup: 'money' as never}), /axisGroup must be false/);
});

test('stackedBars / tornado take a domain too (stacked columns only)', () => {
  const cols = [{label: 'A', parts: [{label: 'x', value: 4}, {label: 'y', value: 3}]}, {label: 'B', parts: [{label: 'x', value: 2}]}];
  assert.doesNotThrow(() => stackedBars(cols as never, {unit: '件', domain: [0, 20]}));
  assert.throws(() => stackedBars(cols as never, {unit: '件', domain: [0, 5]}), /smaller than the data/);
  assert.throws(() => stackedBars(cols as never, {unit: '件', percent: true, domain: [0, 100]}), /no value axis/);
  assert.doesNotThrow(() => tornado([{label: 'a', low: 80, high: 130}] as never, {base: 100, unit: '万円', domain: [0, 200]}));
  assert.throws(() => tornado([{label: 'a', low: 80, high: 130}] as never, {base: 100, unit: '万円', domain: [0, 120]}), /smaller than the data/);
});

test('chart-axis-mismatch: two charts one under the other, same unit, value axis along the page, different axes -> warn (the book\'s 0-6 vs 0-10)', async () => {
  const f = await found(caption('投資コスト'), wf(invest), caption('期待リターン'), wf(ret));
  assert.equal(f.length, 1);
  assert.match(f[0].message, /0〜6/);
  assert.match(f[0].message, /0〜10/);
  assert.match(f[0].message, /百万ドル/);
});

test('chart-axis-mismatch: gone with the same domain, axisGroup: false, a different unit, no unit, a chart in between, or a different direction', async () => {
  assert.deepEqual(await found(caption('a'), wf(invest, {domain: [0, 10]}), caption('b'), wf(ret, {domain: [0, 10]})), []);
  assert.deepEqual(await found(wf(invest), wf(ret, {axisGroup: false})), []);
  assert.deepEqual(await found(wf(invest), wf(ret, {unit: '件'})), []);
  assert.deepEqual(await found(wf(invest, {unit: undefined}), wf(ret, {unit: undefined})), []);
  assert.deepEqual(await found(wf(invest), wf(ret, {dir: 'v'})), [], 'v and h are not read against each other');
  assert.deepEqual(await found(wf(invest), wf(invest, {dir: 'v'}), wf(ret)), [], 'only neighbours are compared: the chart between (value axis the other way) breaks the run, so the two are not read against each other');
});

test('chart-axis-mismatch: charts side by side in the groups of one row, value axis up the page', async () => {
  const side = (a: object, b: object) => row([group([wf(invest, {dir: 'v', ...a})] as never, {title: '投資'}), group([wf(ret, {dir: 'v', ...b})] as never, {title: 'リターン'})] as never);
  assert.equal((await found(side({}, {}))).length, 1);
  assert.deepEqual(await found(side({domain: [0, 10]}, {domain: [0, 10]})), []);
});

test('chart-axis-mismatch: bars compare by max', async () => {
  const b = (max: number) => bars([{label: 'x', value: 5}] as never, {unit: '百万ドル', dir: 'h', max} as never);
  assert.equal((await found(b(6), b(10))).length, 1);
  assert.deepEqual(await found(b(10), b(10)), []);
});

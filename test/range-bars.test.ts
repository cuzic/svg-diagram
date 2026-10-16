import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {bars, rangeBars, checkDiagram, closeMeasurer, diagram, renderDiagram} from '../lib/dsl.ts';
import {barSpan, spanText} from '../lib/bars.ts';

test.after(() => closeMeasurer());

const laid = async (band: unknown) => ((await checkDiagram(diagram({theme: 'blue', title: 't'}).add(band as never))).laidOut.laidOut[0] as unknown as {bars: {x: number; y: number; w: number; h: number}[]});

test('barSpan and spanText: a range is lo..hi, a value is 0..value; the text reads lo〜hi', () => {
  assert.deepEqual(barSpan({label: 'a', value: 5}), {lo: 0, hi: 5});
  assert.deepEqual(barSpan({label: 'a', range: [2, 6]}), {lo: 2, hi: 6});
  assert.equal(spanText({label: 'a', range: [3.2, 5.8]}, undefined, '万円'), '3.2〜5.8万円');
  assert.equal(spanText({label: 'a', value: 5}, undefined, '万円'), '5万円');
});

test('bars({range}): vertical bars float from lo to hi, on the same scale as a plain bar', async () => {
  const b = await laid(bars([{label: '値', value: 6}, {label: '幅', range: [2, 6]}], {dir: 'v', max: 10, height: 300}));
  const [plain, range] = b.bars;
  assert.ok(Math.abs(plain.y - range.y) < 0.01, 'the same top (hi = 6)');
  assert.ok(Math.abs(range.h - plain.h * 4 / 6) < 0.01, 'a height of (hi - lo) / max');
  assert.ok(range.y + range.h < plain.y + plain.h - 1, 'it floats: its bottom is above the baseline');
});

test('bars({range}): horizontal bars float from lo to hi', async () => {
  const b = await laid(bars([{label: '値', value: 6}, {label: '幅', range: [2, 6]}], {dir: 'h', max: 10}));
  const [plain, range] = b.bars;
  assert.ok(Math.abs(plain.x + plain.w - (range.x + range.w)) < 0.01, 'the same right edge (hi = 6)');
  assert.ok(Math.abs(range.w - plain.w * 4 / 6) < 0.01);
  assert.ok(range.x > plain.x + 1, 'it starts at lo, not at the baseline');
});

test('rangeBars(): the same as bars() with range data; the value text and the description say lo〜hi', async () => {
  const d = diagram({theme: 'blue', title: 't'}).add(rangeBars([{label: '開発', range: [3.2, 5.8]}, {label: '運用', range: [1, 2]}], {unit: '万円'}));
  const svg = (await renderDiagram(d, {name: 'a.svg', budget: 'cacheOnly'})).svg;
  assert.ok(svg.includes('3.2〜5.8万円') && svg.includes('1〜2万円'));
  const hidden = diagram({theme: 'blue', title: 't'}).add(rangeBars([{label: '開発', range: [3.2, 5.8]}], {unit: '万円', labels: 'category', axis: false}));
  assert.match((await renderDiagram(hidden, {name: 'a.svg', budget: 'cacheOnly'})).svg, /開発 3\.2〜5\.8万円/, 'the <desc> carries the range');
  assert.throws(() => rangeBars([{label: 'x', value: 3} as never]), /every item of rangeBars\(\) is a range/);
});

test('bars({range}): exactly one of value and range; 0 <= lo < hi; no stack, cumulative, hideZero or replaces', () => {
  assert.throws(() => bars([{label: 'a'}] as never), /exactly one of value and range/);
  assert.throws(() => bars([{label: 'a', value: 1, range: [0, 2]}]), /exactly one of value and range/);
  assert.throws(() => bars([{label: 'a', range: [-1, 2]}]), /starts below 0/);
  assert.throws(() => bars([{label: 'a', range: [3, 3]}]), /needs lo < hi/);
  assert.throws(() => bars([{label: 'a', range: [1, NaN]}]), /two finite numbers/);
  assert.throws(() => bars([{label: 'a', range: [1, 2]}], {stack: true}), /does not stack/);
  assert.throws(() => bars([{label: 'a', range: [1, 2]}], {hideZero: true}), /hideZero does not apply to range/);
  assert.throws(() => bars([{label: 'a', value: 1, id: 'x'}, {label: 'b', range: [1, 2], replaces: 'x', reveal: 2}]), /range and replaces/);
  assert.throws(() => bars([{label: 'a', range: [1, 2]}], {dir: 'v', cumulative: {}, max: 2}), /cumulative does not work with range/);
  assert.throws(() => bars([{label: 'a', range: [1, 12]}], {max: 10}), /exceeds max/);
});

test('bars({range}): the axis runs to the largest hi', () => {
  assert.equal(bars([{label: 'a', range: [1, 8]}, {label: 'b', value: 5}]).max, 8);
});

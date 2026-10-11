import test from 'node:test';
import assert from 'node:assert/strict';
import {bars, checkDiagram, closeMeasurer, connect, diagram, renderDiagram, row, stat} from '../lib/dsl.ts';
import type {LaidOutBars, LaidOutRow} from '../lib/dsl.ts';

test.after(() => closeMeasurer());

test('stat() is a plain row-compatible box; tone applies only to the atomic value', async () => {
  const d = diagram({theme: 'blue'}).add(row([
    stat('76%', '導入前', {tone: 'danger'}),
    stat('31%', '導入後', {size: 'display'}),
  ]));
  const {laidOut, verdict} = await checkDiagram(d);
  assert.deepEqual(verdict.problems, []);
  const r = laidOut.laidOut.find((b): b is LaidOutRow => b.type === 'row')!;
  assert.deepEqual(r.children.map(c => [c.tone, c.align, c.wrappedRuns.map(x => [x.text, x.size, x.tone])]), [
    [undefined, 'center', [['76%', 34, 'danger'], ['導入前', 14, 'muted']]],
    [undefined, 'center', [['31%', 56, undefined], ['導入後', 14, 'muted']]],
  ]);
});

test('stat() never wraps its value and verify rejects one that does not fit', async () => {
  const d = diagram({theme: 'blue', width: 180}).add(stat('12345678901234567890', '長い値', {size: 'display'}));
  const {laidOut, verdict} = await checkDiagram(d);
  const b = laidOut.laidOut.find(x => x.type === 'box')!;
  assert.equal(b.wrappedRuns[0].lines.length, 1);
  assert.match(verdict.problems.join('\n'), /stat: value .* does not fit/);
});

test('bars() validates its numeric domain', () => {
  assert.throws(() => bars([{label: 'x', value: -1}]), />= 0/);
  assert.throws(() => bars([{label: 'x', value: Number.NaN}]), /finite/);
  assert.throws(() => bars([{label: 'x', value: Infinity}]), /finite/);
  assert.throws(() => bars([{label: 'x', value: 1}], {max: 0}), /max must/);
  assert.throws(() => bars([{label: 'x', value: 2}], {max: 1}), /exceeds max/);
  assert.throws(() => bars([{label: 'a', value: 2}, {label: 'b', value: 3}], {max: 4, stack: true}), /stack total.*exceeds/);
  assert.throws(() => bars([{label: 'x', value: 0}, {label: 'y', value: 0}]), /all values are 0/);
});

test('horizontal, vertical and stacked bars lay out labels, series colours and exact 2px separators', async () => {
  const d = diagram({theme: 'blue'}).add(
    bars([{label: '前', value: 76, series: 'a'}, {label: '後', value: 31, series: 'b'}], {max: 100, unit: '%'}),
    bars([{label: 'A', value: 8, series: 'a'}, {label: 'B', value: 5, series: 'c'}], {max: 10, dir: 'v'}),
    bars([{label: '企画', value: 16, series: 'a'}, {label: '実装', value: 34, series: 'b'}, {label: '運用', value: 50, series: 'c'}], {max: 100, unit: '%', stack: true}),
  );
  const {laidOut, verdict} = await checkDiagram(d);
  assert.deepEqual(verdict.problems, []);
  const [h, v, s] = laidOut.laidOut.filter((b): b is LaidOutBars => b.type === 'bars');
  assert.deepEqual([h.dir, v.dir, s.stack], ['h', 'v', true]);
  assert.deepEqual(h.bars.map(b => b.fill), ['accent', 'text']);
  assert.deepEqual(v.bars.map(b => b.fill), ['accent', 'muted']);
  assert.ok(s.labelBoxes.length === 3);
  assert.ok(Math.abs(s.bars[1].x - (s.bars[0].x + s.bars[0].w) - 2) < 1e-9);
});

test('bar ids are connector anchors and bars do not create notation legend entries', async () => {
  const b = bars([{id: 'before', label: '前', value: 8}, {id: 'after', label: '後', value: 5, series: 'b'}], {max: 10});
  const d = diagram({theme: 'blue', legend: 'auto'}).add(b, connect(b.anchors.before.right, b.anchors.after.right, {route: 'loop-under'}));
  const {laidOut, verdict} = await checkDiagram(d);
  assert.deepEqual(verdict.problems, []);
  assert.equal(laidOut.laidOut.some(x => x.type === 'legend'), false);
  assert.equal(laidOut.connects[0].fromId, 'before');
});

test('bars SVG includes value labels and token series colours', async () => {
  const d = diagram({theme: 'blue'}).add(bars([{label: '前', value: 76, series: 'a'}], {max: 100, unit: '%'}));
  const {svg} = await renderDiagram(d, {name: 'bars.svg', budget: 'cacheOnly'});
  assert.match(svg, />76%<\/text>/);
  assert.match(svg, /fill="#1d5fa8"/);
});

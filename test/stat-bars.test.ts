import test from 'node:test';
import assert from 'node:assert/strict';
import {bars, box, checkDiagram, closeMeasurer, connect, diagram, group, renderDiagram, row, stat} from '../lib/dsl.ts';
import {verifyDiagram} from '../lib/verify.ts';
import {toneStyle} from '../lib/tokens.ts';
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
  assert.throws(() => bars([{label: 'x', value: 1}], {height: Number.NaN}), /height must be a finite number > 0/);
  assert.throws(() => bars([{label: 'x', value: 1}], {height: 0}), /height must be a finite number > 0/);
  assert.throws(() => bars([{label: 'x', value: 1}], {height: -1}), /height must be a finite number > 0/);
});

test('horizontal bars reject a height too small for their rows and axis', async () => {
  await assert.rejects(checkDiagram(diagram({theme: 'blue'}).add(
    bars([{label: 'A', value: 1}, {label: 'B', value: 2}], {max: 2, height: 40}),
  )), /height .* too small/);
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
  assert.equal(s.labelBoxes.filter(x => x.background).length, 3); // the segment labels; tick labels carry no background
  assert.ok(Math.abs(s.bars[1].x - (s.bars[0].x + s.bars[0].w) - 2) < 1e-9);
});

test('stacked horizontal outside labels use a separate row from tick labels', async () => {
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue'}).add(
    bars([{label: 'a', value: 60}, {label: 'b', value: 35}, {label: 'c', value: 5}], {max: 100, stack: true}),
  ));
  assert.deepEqual(verdict.problems, []);
  const b = laidOut.laidOut.find((x): x is LaidOutBars => x.type === 'bars')!;
  const outside = b.labelBoxes.find(x => x.label === 'c 5')!;
  const ticks = b.labelBoxes.filter(x => /^\d+$/.test(x.label));
  assert.ok(ticks.every(t => outside.y + outside.h <= t.y || t.y + t.h <= outside.y));
});

test('vertical stacks keep their full extent, touch the baseline and remove gaps from upper segments', async () => {
  const {laidOut} = await checkDiagram(diagram({theme: 'blue'}).add(
    bars([{label: 'bottom', value: 40}, {label: 'top', value: 60}], {max: 100, dir: 'v', stack: true}),
  ));
  const b = laidOut.laidOut.find((x): x is LaidOutBars => x.type === 'bars')!;
  const baseline = b.ticks[b.ticks.length - 1].y1;
  assert.equal(b.bars[0].y + b.bars[0].h, baseline);
  assert.equal(b.bars[1].y + b.bars[1].h, b.bars[0].y - 2);
  assert.equal(b.bars[0].h + b.bars[1].h + 2, baseline - b.bars[1].y);
});

test('vertical labels move above bars when either height or width is insufficient', async () => {
  const {laidOut} = await checkDiagram(diagram({theme: 'blue', width: 240}).add(
    bars([{label: 'wide', value: 100}], {max: 100, unit: '-very-long-unit', dir: 'v'}),
  ));
  const b = laidOut.laidOut.find((x): x is LaidOutBars => x.type === 'bars')!;
  const value = b.labelBoxes.find(x => x.label.includes('very-long-unit'))!;
  assert.ok(value.y + value.h <= b.bars[0].y);
  assert.equal(value.background, undefined);
});

test('category, tick and row labels all participate in bars verification', async () => {
  const data = Array.from({length: 10}, (_, i) => ({label: `very-long-category-${i}`, value: i + 1}));
  const {verdict} = await checkDiagram(diagram({theme: 'blue', width: 360}).add(bars(data, {max: 10, dir: 'v'})));
  assert.match(verdict.problems.join('\n'), /bars: value label .* overlaps value label/);
});

test('labels drawn inside bars are contrast-checked against their series fill', async () => {
  const {laidOut} = await checkDiagram(diagram({theme: 'blue'}).add(bars([{label: 'A', value: 100}], {max: 100})));
  const b = laidOut.laidOut.find((x): x is LaidOutBars => x.type === 'bars')!;
  const value = b.labelBoxes.find(x => x.label === '100' && x.background)!; // not the '100' tick label
  assert.equal(value.background, 'accent');
  value.background = 'border';
  assert.match(verifyDiagram(laidOut).problems.join('\n'), /bars: value label "100" .*low contrast/);
});

test('box and group ids cannot reuse an earlier anchor id', async () => {
  await assert.rejects(checkDiagram(diagram({theme: 'blue'}).add(box({id: 'same', title: 'A'}), group([box({title: 'B'})], {id: 'same'}))), /duplicate anchor id "same"/);
  await assert.rejects(checkDiagram(diagram({theme: 'blue'}).add(group([box({title: 'A'})], {id: 'same'}), box({id: 'same', title: 'B'}))), /duplicate anchor id "same"/);
});

test('bar values use plane number formatting and stacked bars do not reserve value-label width', async () => {
  const {laidOut} = await checkDiagram(diagram({theme: 'blue'}).add(
    bars([{label: 'sum', value: 0.1 + 0.2}, {label: 'third', value: 100 / 3}], {max: 100}),
    bars([{label: 'all', value: 100}], {max: 100, unit: '-long-unit', stack: true}),
  ));
  const [plain, stacked] = laidOut.laidOut.filter((x): x is LaidOutBars => x.type === 'bars');
  assert.ok(plain.texts.some(x => x.text === '0.3'));
  assert.ok(plain.texts.some(x => x.text === '33.3'));
  const axis = stacked.ticks[stacked.ticks.length - 1];
  assert.ok(axis.x2 > stacked.x + stacked.w - 30);
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

test('stat({tone: accent}) fills the card with the accent tone fill, honours a tones.accent.fill override; plain and solid are unchanged', async () => {
  const svgOf = async (tone?: 'accent' | 'solid', tones?: {accent: {fill: string}}) =>
    (await renderDiagram(diagram({theme: 'blue', ...(tones ? {tones} : {})}).add(stat('+12%', '完了率', tone ? {tone} : {})), {name: 's.svg', budget: 'cacheOnly'})).svg;
  const fills = (svg: string) => [...svg.matchAll(/<rect[^>]*\sfill="(#[0-9a-fA-F]{6})"/g)].map(m => m[1].toLowerCase());
  const soft = toneStyle('accent').fill, plain = fills(await svgOf());
  const accentFills = fills(await svgOf('accent'));
  assert.notDeepEqual(accentFills, plain, 'the accent stat is not drawn like the plain one');
  const overridden = fills(await svgOf('accent', {accent: {fill: '#b8cfe8'}}));
  assert.ok(overridden.includes('#b8cfe8'), 'tones.accent.fill is what the card is filled with');
  assert.ok(!fills(await svgOf(undefined, {accent: {fill: '#b8cfe8'}})).includes('#b8cfe8'), 'a plain stat ignores the override');
  assert.ok(soft && fills(await svgOf('solid')).length > 0);
  const {verdict} = await checkDiagram(diagram({theme: 'blue'}).add(stat('+12%', '完了率', {tone: 'accent'})));
  assert.deepEqual(verdict.problems, []);
});

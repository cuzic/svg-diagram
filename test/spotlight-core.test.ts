import assert from 'node:assert/strict';
import {test} from 'node:test';
import {plain} from '../lib/band-def.ts';
import {bars} from '../lib/bands/bars.ts';
import {box} from '../lib/bands/box.ts';
import {chevron} from '../lib/bands/chevron.ts';
import {connect} from '../lib/bands/connect.ts';
import {funnel} from '../lib/bands/funnel.ts';
import {raw} from '../lib/bands/raw.ts';
import {row} from '../lib/bands/row.ts';
import {waterfall} from '../lib/bands/waterfall.ts';
import {renderBands} from '../lib/core.ts';
import {diagram} from '../lib/dsl-pure.ts';
import type {MeasureRequest} from '../lib/types/core.ts';
import {renderInBrowser} from '../lib/web.ts';

const measure = ({text, size}: MeasureRequest) => ({w: [...text].length * size * 0.6, h: size});

test('renderBands focuses a box and the nth child of a row', async () => {
  const spotlight = {ids: ['main', 'choices#2'], edges: 'between'} as const;
  const bands = [
    box({id: 'main', title: 'Main'}),
    box({id: 'other', title: 'Other'}),
    row([box({id: 'left', title: 'Left'}), box({id: 'right', title: 'Right'})], {id: 'choices'}),
    connect('main', 'left'),
  ];
  const result = await renderBands(bands, {measure, spotlight});
  const boxes = result.laidOut.laidOut.filter(b => b.type === 'box');
  assert.deepEqual(boxes.map(b => b.dim), [false, true]);
  const choices = result.laidOut.laidOut.find(b => b.type === 'row');
  assert.deepEqual(choices?.children.map(b => b.dim), [true, false]);
  assert.deepEqual(result.laidOut.connects.map(c => c.dim), [true]);
  assert.match(result.svg, /marker-end="url\(#dsl-arrow-dim\)"/);
});

test('renderBands dims the other bars and their labels, with the legacy pale fill', async () => {
  const spotlight = {ids: 'b2', dim: 'fill'} as const;
  const band = bars([{id: 'b1', label: 'One', value: 3}, {id: 'b2', label: 'Two', value: 5}], {dir: 'v', max: 6, scope: 'sales'});
  const result = await renderBands([band], {measure, spotlight});
  const legacy = await renderInBrowser(diagram({theme: 'blue', spotlight}).add(plain(band)), {measure});
  const placed = result.laidOut.laidOut.find(b => b.type === 'bars');
  assert.deepEqual(placed?.bars.map(b => b.dim), [true, false]);
  assert.deepEqual(placed?.texts.filter(t => t.bar !== undefined).map(t => t.dim), [true, true, false, false]);
  assert.doesNotMatch(result.svg, /stroke-dasharray="2,5"/);
  assert.equal(result.svg, legacy.svg);
});

test('renderBands dims individual chart elements using the legacy pale fill', async () => {
  const spotlight = {ids: 'change', dim: 'fill'} as const;
  const band = waterfall([{id: 'start', label: 'Start', value: 10}, {id: 'change', label: 'Change', value: 5}]);
  const result = await renderBands([band], {measure, spotlight});
  const legacy = await renderInBrowser(diagram({theme: 'blue', spotlight}).add(plain(band)), {measure});
  const dimIds = result.laidOut.laidOut.find(b => b.type === 'chart')?.dimIds;
  assert.ok(dimIds);
  assert.ok(dimIds.includes('start'));
  assert.ok(!dimIds.includes('change'));
  assert.equal(result.svg, legacy.svg);
});

test('renderBands keeps a flow shape lit when one of its items is focused', async () => {
  const bands = [
    chevron([{id: 'plan', label: 'Plan'}, {id: 'now', label: 'Now', tone: 'accent'}]),
    funnel([{label: 'Visit', tone: 'accent'}, {label: 'Order', tone: 'danger'}]),
  ];
  const spotlight = 'now';
  const result = await renderBands(bands, {measure, spotlight});
  const legacy = await renderInBrowser(diagram({theme: 'blue', spotlight}).add(...bands.map(band => plain(band))), {measure});
  assert.deepEqual(result.laidOut.laidOut.map(b => b.dim), [false, true]);
  assert.equal(result.svg, legacy.svg);
});

test('renderBands mutes the SVG of a band without its own dimming', async () => {
  const bands = [
    box({id: 'main', title: 'Main'}),
    raw({h: 24, draw: ({x, y}) => `<rect x="${x}" y="${y}" width="24" height="24" fill="#abcdef"/>`}),
  ];
  const spotlight = 'main';
  const result = await renderBands(bands, {measure, spotlight});
  const legacy = await renderInBrowser(diagram({theme: 'blue', spotlight}).add(...bands.map(band => plain(band))), {measure});
  assert.deepEqual(result.laidOut.laidOut.map(b => b.dim), [false, true]);
  assert.doesNotMatch(result.svg, /fill="#abcdef"/);
  assert.equal(result.svg, legacy.svg);
});

test('renderBands defines the muted arrow for an out-of-focus row', async () => {
  const bands = [
    box({id: 'main', title: 'Main'}),
    row([box({title: 'First'}), box({title: 'Second'})], {arrows: 'between'}),
  ];
  const result = await renderBands(bands, {measure, spotlight: 'main'});
  assert.match(result.svg, /id="dsl-arrow-dim"/);
  assert.match(result.svg, /marker-end="url\(#dsl-arrow-dim\)"/);
});

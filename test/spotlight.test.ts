import test from 'node:test';
import assert from 'node:assert/strict';
import {bars, box, checkDiagram, closeMeasurer, connect, diagram, group, renderDiagram, row, sequence, swimlane} from '../lib/dsl.ts';
import type {LaidOutRow} from '../lib/dsl.ts';
import {applySpotlight as applySpot} from '../lib/spotlight.ts';
import {emitSvg} from '../lib/emit.ts';
import {lintDiagram} from '../lib/rules.ts';
import {ROLES} from '../lib/tokens.ts';

test.after(() => closeMeasurer());

test('spotlight focuses group descendants and row#N while dimming other boxes', async () => {
  const d = diagram({theme: 'blue', spotlight: {ids: ['main', 'choices#2']}}).add(
    group([box({id: 'inside', title: 'Inside'})], {id: 'main'}),
    row([box({id: 'left', title: 'Left'}), box({id: 'right', title: 'Right'})], {id: 'choices'}),
  );
  const {laidOut} = await checkDiagram(d);
  const inside = laidOut.laidOut.find(b => b.type === 'box' && b.id === 'inside')!;
  const choices = laidOut.laidOut.find((b): b is LaidOutRow => b.type === 'row' && b.id === 'choices')!;
  assert.equal(inside.dim, false);
  assert.deepEqual(choices.children.map(b => b.dim), [true, false]);
});

test('spotlight edges default to touching and between requires both focused ends', async () => {
  const make = (edges?: 'touching' | 'between') => diagram({theme: 'blue', spotlight: {ids: ['a'], edges}}).add(
    row([box({id: 'a', title: 'A'}), box({id: 'b', title: 'B'}), box({id: 'c', title: 'C'})]),
    connect('a', 'b'), connect('b', 'c'),
  );
  const touching = (await checkDiagram(make())).laidOut.connects;
  const between = (await checkDiagram(make('between'))).laidOut.connects;
  assert.deepEqual(touching.map(c => c.dim), [false, true]);
  assert.deepEqual(between.map(c => c.dim), [true, true]);
});

test('dim keeps line shapes, uses real muted colours and only emits its marker when needed', async () => {
  const d = diagram({theme: 'blue', spotlight: 'main', legend: 'auto'}).add(
    row([box({id: 'main', title: 'Main'}), box({id: 'old', title: 'Old', tone: 'danger'}), box({id: 'muted', title: 'Muted', tone: 'muted'})]),
    connect('old', 'muted', {line: 'dashed'}),
  );
  const {svg, laidOut, verdict} = await renderDiagram(d, {name: 'spotlight.svg', budget: 'cacheOnly'});
  assert.deepEqual(verdict.problems, []);
  assert.ok(verdict.warnings.some(w => w.includes('spotlight-muted')));
  assert.equal(laidOut.laidOut.some(b => b.type === 'legend'), false, 'dim notation is excluded from auto legend');
  assert.match(svg, /stroke="#[0-9a-f]{6}" stroke-width="2" stroke-dasharray="6,4"/);
  assert.match(svg, /id="dsl-arrow-dim"/);
  assert.match(svg, /marker-end="url\(#dsl-arrow-dim\)"/);

  const plain = await renderDiagram(diagram({theme: 'blue'}).add(box({id: 'only', title: 'Only'})), {name: 'plain.svg', budget: 'cacheOnly'});
  assert.doesNotMatch(plain.svg, /dsl-arrow-dim/);
});

test('spotlight on one bar dims only the other bars and their labels', async () => {
  const d = diagram({theme: 'blue', spotlight: 'b2'}).add(
    bars([{id: 'b1', label: 'One', value: 3}, {id: 'b2', label: 'Two', value: 5}, {id: 'b3', label: 'Three', value: 4}], {dir: 'v', max: 6}),
  );
  const {svg, laidOut} = await renderDiagram(d, {name: 'spotlight-bars.svg', budget: 'cacheOnly'});
  const band = laidOut.laidOut.find(b => b.type === 'bars')!;
  assert.equal(band.dim, false);
  assert.deepEqual(band.bars.map(b => b.dim), [true, false, true]);
  assert.deepEqual(band.texts.filter(t => t.bar !== undefined).map(t => t.dim), [true, true, false, false, true, true]);
  assert.equal(band.texts.filter(t => t.bar === undefined).every(t => !t.dim), true, 'tick labels are not tied to a bar');
  assert.equal(svg.match(/stroke-dasharray="2,5" stroke-linecap="round"\/>/g)?.length, 2);
  assert.equal(svg.match(/<path d="M[\d.]+,[\d.]+ H[\d.]+ V[\d.]+ H[\d.]+ Z" fill="#[0-9a-f]{6}"\/>/g)?.length, 1);
});

test('a bars band inside a focused group is not dimmed', async () => {
  const d = diagram({theme: 'blue', spotlight: 'main'}).add(
    group([bars([{id: 'b1', label: 'One', value: 3}, {id: 'b2', label: 'Two', value: 5}], {dir: 'v', max: 6})], {id: 'main'}),
    box({title: 'Other'}),
  );
  const band = (await checkDiagram(d)).laidOut.laidOut.find(b => b.type === 'bars')!;
  assert.equal(band.dim, undefined);
  assert.deepEqual(band.bars.map(b => b.dim), [undefined, undefined]);
  const {svg} = await renderDiagram(d, {name: 'spotlight-bars-group.svg', budget: 'cacheOnly'});
  assert.doesNotMatch(svg, /<path [^>]*stroke-dasharray="2,5"/);
  assert.match(svg, /<path d="[^"]+" fill="#1d5fa8"\/>/);
});

test('spotlight can target a swimlane by its id', async () => {
  const d = diagram({theme: 'blue', spotlight: 'flow'}).add(
    swimlane([{id: 'dev', label: 'Dev'}], [{id: 's1', lane: 'dev', title: 'Step'}], {id: 'flow'}),
    box({id: 'other', title: 'Other'}),
  );
  const {laidOut} = (await checkDiagram(d));
  assert.equal(laidOut.laidOut.find(b => b.type === 'swimlane')!.dim, false);
  assert.equal(laidOut.laidOut.find(b => b.type === 'box' && b.id === 'other')!.dim, true);
  assert.equal(laidOut.laidOut.find(b => b.type === 'box' && b.id === 's1')!.dim, false);
});

const DIM_BAR = /<path [^>]*stroke-dasharray="2,5"/g;
const sample = [{id: 'b1', label: 'One', value: 3}, {id: 'b2', label: 'Two', value: 5}, {id: 'b3', label: 'Three', value: 4}];
const render = (d: ReturnType<typeof diagram>, name: string) => renderDiagram(d, {name, budget: 'cacheOnly'});

test('horizontal bars: the category label and the inner value label follow their bar', async () => {
  const {laidOut, svg} = await render(diagram({theme: 'blue', spotlight: 'b2'}).add(bars(sample, {max: 6, unit: 'x'})), 'h.svg');
  const band = laidOut.laidOut.find(b => b.type === 'bars')!;
  const dimOf = (text: string) => band.texts.find(t => t.text === text)!.dim;
  assert.equal(dimOf('One'), true);
  assert.equal(dimOf('Two'), false);
  assert.equal(dimOf('3x'), true);
  assert.equal(dimOf('5x'), false);
  assert.equal(svg.match(DIM_BAR)?.length, 2);
  assert.ok(!/fill="#ffffff"[^>]*>3x</.test(svg), 'the label inside a dimmed bar is not bg-on-bg');
});

test('stacked bars carry their segment labels with the segment, vertically and horizontally', async () => {
  const stack = [{id: 's1', label: 'A', value: 40}, {id: 's2', label: 'B', value: 60, series: 'b' as const}];
  for (const dir of ['v', 'h'] as const) {
    const {laidOut} = await render(diagram({theme: 'blue', spotlight: 's2'}).add(bars(stack, {dir, stack: true, max: 100})), `stack-${dir}.svg`);
    const band = laidOut.laidOut.find(b => b.type === 'bars')!;
    assert.equal(band.texts.find(t => t.text.startsWith('A '))!.dim, true, dir);
    assert.equal(band.texts.find(t => t.text.startsWith('B '))!.dim, false, dir);
  }
});

test('a zero-value dimmed bar draws no outline', async () => {
  const {svg} = await render(diagram({theme: 'blue', spotlight: 'b2'}).add(bars([{id: 'b1', label: 'Zero', value: 0}, {id: 'b2', label: 'Two', value: 5}], {dir: 'v', max: 6})), 'zero.svg');
  assert.equal(svg.match(DIM_BAR), null);
});

test('a bars band outside the spotlight is dimmed whole, like a box', async () => {
  const {svg, laidOut} = await render(diagram({theme: 'blue', spotlight: 'x'}).add(box({id: 'x', title: 'X'}), bars(sample, {dir: 'v', max: 6})), 'elsewhere.svg');
  const band = laidOut.laidOut.find(b => b.type === 'bars')!;
  assert.equal(band.dim, true);
  assert.equal(svg.match(DIM_BAR)?.length, 3);
  assert.doesNotMatch(svg, /fill="#1d5fa8"/);
  assert.match(svg, /stroke="#6f6659" stroke-width="2"\/>/, 'tick lines are muted');
});

test('reveal and spotlight together: the other bars stay dim at an early stage', async () => {
  const d = diagram({theme: 'blue', spotlight: 'b2'}).add(bars([{id: 'b1', label: 'One', value: 3}, {id: 'b2', label: 'Two', value: 5, reveal: 1}, {id: 'b3', label: 'Three', value: 4}], {dir: 'v', max: 6}));
  const {laidOut} = await checkDiagram(d);
  applySpot(laidOut);
  const svg = emitSvg(laidOut, {reveal: 0});
  assert.equal(svg.match(DIM_BAR)?.length, 2);
  assert.doesNotMatch(svg, /fill="#1d5fa8"/);
});

test('spotlight on a swimlane id keeps its flows in the legend check', async () => {
  const d = diagram({theme: 'blue', spotlight: 'flow', title: 't'}).add(
    swimlane([{id: 'dev', label: 'Dev'}], [{id: 's1', lane: 'dev', title: 'A', col: 1}, {id: 's2', lane: 'dev', title: 'B', col: 2}], {id: 'flow', flows: [{from: 's1', to: 's2', line: 'dashed'}]}),
    box({id: 'other', title: 'Other'}),
  );
  const findings = lintDiagram({...d, laidOut: [], connects: []}).filter(f => f.rule === 'legend-missing');
  assert.ok(findings.some(f => f.message.includes('line:dashed')), findings.map(f => f.message).join());
});

test('a swimlane id is an anchor: connectable, and a duplicate is rejected', async () => {
  const lane = () => swimlane([{id: 'dev', label: 'Dev'}], [{id: 's1', lane: 'dev', title: 'A'}], {id: 'flow'});
  await checkDiagram(diagram({theme: 'blue'}).add(lane(), box({id: 'b', title: 'B'}), connect('b', 'flow')));
  await assert.rejects(checkDiagram(diagram({theme: 'blue'}).add(lane(), box({id: 'flow', title: 'B'}))), /duplicate anchor id "flow"/);
});

test('sequence text is measured and drawn at the same (filled) size', async () => {
  const base = ROLES.note;
  try {
    ROLES.note = 25;
    const {svg} = await render(diagram({theme: 'blue'}).add(sequence([{id: 'a', label: 'A'}, {id: 'b', label: 'B'}], [{from: 'a', to: 'b', label: 'request message'}])), 'seq.svg');
    assert.match(svg, /font-size="25"[^>]*>1\. request message</);
    assert.doesNotMatch(svg, /font-size="14"/);
  } finally {
    ROLES.note = base;
  }
});

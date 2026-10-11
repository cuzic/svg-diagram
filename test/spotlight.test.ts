import test from 'node:test';
import assert from 'node:assert/strict';
import {bars, box, checkDiagram, closeMeasurer, connect, diagram, group, renderDiagram, row, swimlane} from '../lib/dsl.ts';
import type {LaidOutRow} from '../lib/dsl.ts';

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

import test from 'node:test';
import assert from 'node:assert/strict';
import {box, checkDiagram, closeMeasurer, connect, diagram, group, renderDiagram, row} from '../lib/dsl.ts';
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

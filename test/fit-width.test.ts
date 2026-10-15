import test from 'node:test';
import assert from 'node:assert/strict';
import {describeApplied, fitFailure, fitWidth, widerThan, type FitAttempt, type FitResult} from '../lib/fit-width.ts';
import {layeredAttempt} from '../lib/layered-route.ts';
import type {FitApplied} from '../lib/types/diagrams.ts';

// The attempts are fakes: fitWidth only reads size and score, so nothing here depends on a font or a layout.
const fake = (label: string, w: number, h: number, crossings = 0, bends = 0, applied?: FitApplied[]): FitAttempt<FitResult> & {ran: number} => {
  const a = {label, ran: 0, run: () => { a.ran++; return {size: {w, h}, score: {crossings, bends}}; }, ...(applied ? {applied} : {})};
  return a;
};
const dirChange: FitApplied = {what: 'dir', from: 'up', to: 'right', wasW: 1460, nowW: 880, mode: 'omitted'};

test('fitWidth first: the first that fits wins and later ones are not run', () => {
  const a = fake('a', 1460, 300), b = fake('b', 880, 400, 0, 5, [dirChange]), c = fake('c', 700, 300);
  const r = fitWidth(900, [a, b, c], {mode: 'first'});
  assert.ok(r.ok);
  assert.equal(r.index, 1);
  assert.deepEqual(r.applied, [dirChange]);
  assert.deepEqual(r.tried.map(t => t.label), ['a', 'b']);
  assert.equal(c.ran, 0);
});

test('fitWidth first: a figure that fits as written is the first attempt, with nothing applied', () => {
  const a = fake('a', 900, 300), b = fake('b', 500, 300);
  const r = fitWidth(900, [a, b], {mode: 'first'});
  assert.ok(r.ok && r.index === 0 && r.applied.length === 0);
  assert.equal(b.ran, 0);
});

test('fitWidth best: the best (crossings, bends) of those that fit; a tie goes to the earlier', () => {
  const r = fitWidth(900, [fake('a', 800, 300, 1, 0), fake('b', 800, 300, 0, 9), fake('c', 800, 300, 0, 4), fake('d', 800, 300, 0, 4), fake('e', 1200, 300, 0, 0)], {mode: 'best'});
  assert.ok(r.ok);
  assert.equal(r.index, 2);
  assert.equal(r.tried.length, 5);
});

test('fitWidth best: a figure over the height budget is out', () => {
  const tall = fitWidth(900, [fake('wide', 1000, 300), fake('tall', 600, 900, 0, 0), fake('ok', 800, 400, 3, 3)], {mode: 'best', heightBudget: 500});
  assert.ok(tall.ok);
  assert.equal(tall.index, 2);
  const none = fitWidth(900, [fake('tall', 600, 900)], {mode: 'best', heightBudget: 500});
  assert.equal(none.ok, false);
  assert.deepEqual(none.tried, [{label: 'tall', w: 600, h: 900}]);
});

test('fitWidth: half a pixel of slack, and widthOf for what hangs out of the figure', () => {
  assert.ok(fitWidth(900, [fake('a', 900.4, 10)], {mode: 'first'}).ok);
  assert.equal(fitWidth(900, [fake('a', 900.6, 10)], {mode: 'first'}).ok, false);
  const loops = fitWidth(900, [fake('a', 880, 10)], {mode: 'first', widthOf: r => r.size.w + 40});
  assert.equal(loops.ok, false);
  assert.equal(loops.tried[0].w, 920);
});

test('fitWidth: every attempt failing gives the tried list, nothing chosen', () => {
  const r = fitWidth(900, [fake('dir up', 1460, 300), fake('dir right', 1180, 600)], {mode: 'first'});
  assert.equal(r.ok, false);
  assert.deepEqual(r.tried, [{label: 'dir up', w: 1460, h: 300}, {label: 'dir right', w: 1180, h: 600}]);
  assert.equal(widerThan(r.tried, 40), 1220);
  assert.equal(widerThan(r.tried, 41), 1240);
});

test('fitFailure: the widths tried, what was not tried and why, one fix', () => {
  const msg = fitFailure('causeTree()', 900, [{label: "dir 'up' (as written)", w: 1460, h: 300}], "dir: 'auto', or widen the figure (diagram({width: 1100}))", ["dir 'right' (dir is explicit; write dir: 'auto' to let it change)"]);
  assert.match(msg, /^causeTree\(\): the figure does not fit 900px\./);
  assert.match(msg, /dir 'up' \(as written\) 1460px wide/);
  assert.match(msg, /not tried: dir 'right' \(dir is explicit/);
  assert.equal(msg.split('\n').filter(l => l.startsWith('  fix:')).length, 1);
});

test('describeApplied names what changed and the widths', () => {
  assert.equal(describeApplied(dirChange), 'dir を up から right に変えた(1460→880px)');
  assert.match(describeApplied({what: 'maxNodeW', from: 200, to: 130, mode: 'auto'}), /maxNodeW を 200→130 に縮めた/);
});

test('fitWidth wraps layeredAttempt: a real layout fits by its own width, and the result is layeredAttempt\'s', () => {
  const nodes = ['a', 'b', 'c', 'd'].map(id => ({id, size: {w: 80, h: 30}}));
  const edges = [{from: 'a', to: 'b'}, {from: 'a', to: 'c'}, {from: 'a', to: 'd'}];
  const run = (): ReturnType<typeof layeredAttempt> => layeredAttempt(nodes, edges, {dir: 'right', gap: 24, levelGap: 60}, {transpose: true, place: () => p => p});
  const natural = run();
  assert.equal(fitWidth(natural.size.w - 5, [{label: 'x', run}], {mode: 'first'}).ok, false);
  const ok = fitWidth(natural.size.w, [{label: 'x', run}], {mode: 'first'});
  assert.ok(ok.ok);
  assert.deepEqual(ok.result.lay, natural.lay);
});

// Runtime guards that the compile-time types (lib/strict.ts) now hide from TypeScript users must still fire
// for JS callers / .mjs diagram sources. Every call goes through an `as unknown as` cast so tsc lets it through.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {diagram, box, banner, grid, row, pyramid, curve, raw, connect, swimlane, stateMatrix, wireframe, screens, sequence, wf, build, checkDiagram, closeMeasurer} from '../lib/dsl.ts';

test.after(() => closeMeasurer());

// loosely typed aliases: the whole point is calling with what the types forbid
const any = (f: unknown) => f as (...a: unknown[]) => unknown;
const boxJs = any(box), gridJs = any(grid), pyramidJs = any(pyramid), curveJs = any(curve), rawJs = any(raw);
const diagramJs = any(diagram), swimlaneJs = any(swimlane), stateMatrixJs = any(stateMatrix), wireframeJs = any(wireframe), sequenceJs = any(sequence);

test('box({step}) without a title throws; with a title (or without step) it does not', () => {
  assert.throws(() => boxJs({step: 1}), /box\(\{step\}\) needs a title/);
  assert.throws(() => boxJs({step: 'A', body: 'b'}), /needs a title/);
  assert.throws(() => boxJs({step: 0, title: ''}), /needs a title/, 'an empty title is no title');
  assert.doesNotThrow(() => boxJs({step: 1, title: 'T'}));
  assert.doesNotThrow(() => boxJs({title: 'T'}));
  assert.doesNotThrow(() => boxJs({step: null, body: 'b'}), 'step: null means no step');
});

test('font size below 14 throws (box), 14 and above pass', () => {
  assert.throws(() => boxJs({title: 'T', size: 13}), /font-size 13 is below the 14px floor/);
  assert.throws(() => boxJs({title: 'T', size: 0}), /below the 14px floor/);
  assert.doesNotThrow(() => boxJs({title: 'T', size: 14}));
  assert.doesNotThrow(() => boxJs({title: 'T', size: 72}));
});

test('grid without cols (or without opts) throws', () => {
  assert.throws(() => gridJs([box({title: 'a'})]), /grid\(children, \{cols\}\) needs cols/);
  assert.throws(() => gridJs([box({title: 'a'})], {gap: 8}), /needs cols/);
  assert.throws(() => gridJs([box({title: 'a'})], {cols: 0}), /needs cols/);
  assert.equal((gridJs([box({title: 'a'})], {cols: 2}) as {gap: number}).gap, 16, 'default gap');
});

test('pyramid needs at least 2 layers', () => {
  assert.throws(() => pyramidJs(['only']), /pyramid\(layers\) needs at least 2 layers/);
  assert.throws(() => pyramidJs([]), /at least 2 layers/);
  assert.throws(() => pyramidJs('ab'), /at least 2 layers/);
  assert.throws(() => pyramidJs(undefined), /at least 2 layers/);
  const p = pyramid(['a', {text: 'b'}]);
  assert.deepEqual(p.layers, [{text: 'a'}, {text: 'b'}]);
});

test('curve needs at least 2 points, each with a numeric y', () => {
  assert.throws(() => curveJs([{y: 1}]), /curve\(points\) needs at least 2 points/);
  assert.throws(() => curveJs(null), /at least 2 points/);
  assert.throws(() => curveJs([{y: 1}, {y: '0.5'}]), /every point needs a numeric y/);
  assert.throws(() => curveJs([{y: 1}, {emphasis: 'accent'}]), /numeric y/);
  assert.equal(curve([{y: 1}, {y: 0}]).height, 220);
});

test('raw({draw}) needs a function', () => {
  assert.throws(() => rawJs({h: 10}), /raw\(\{draw\}\) needs a draw\(ctx\) function/);
  assert.throws(() => rawJs({draw: '<g/>'}), /needs a draw/);
  assert.equal(raw({draw: () => '<g/>'}).h, 0);
});

test('diagram(): a theme that is not in the palette throws, both spellings', () => {
  assert.throws(() => diagramJs({theme: 'purple'}), /diagram\(\{theme\}\) must be one of .*blue/);
  assert.throws(() => diagramJs({}), /must be one of/);
  assert.throws(() => diagramJs({day: 3}), /must be one of/);
  assert.throws(() => diagramJs(), /must be one of/);
  for (const ok of [{theme: 'blue'}, {theme: 'teal'}, {theme: 'amber'}, {day: 1}, {day: 2}, {theme: 1}]) assert.doesNotThrow(() => diagramJs(ok), JSON.stringify(ok));
});

test('diagram(): theme => doc medium, day => slide medium, explicit medium wins', () => {
  assert.equal(diagram({theme: 'blue'}).medium, 'doc');
  assert.equal(diagram({day: 2}).medium, 'slide');
  assert.equal(diagram({theme: 'blue', medium: 'slide'}).medium, 'slide');
  assert.equal(diagram({day: 1}).day, 1);
});

test('build(): fill: true without slide throws before anything is written', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'guard-')), 'x.svg');
  const d = diagramJs({theme: 'blue', fill: true}) as ReturnType<typeof diagram>;
  d.add(box({title: 'x'}));
  await assert.rejects(build(d, out), /diagram\(\{fill: true\}\) needs diagram\(\{slide/);
  assert.equal(fs.existsSync(out), false);
});

test('layout: connect() to an id nobody declared throws, naming the side that is wrong', async () => {
  const mk = (from: string, to: string) => { const d = diagram({theme: 'blue'}); d.add(box({id: 'a', title: 'A'}), connect(from, to)); return d; };
  await assert.rejects(checkDiagram(mk('a', 'zzz')), /connect\(\): unknown anchor id "zzz"/);
  await assert.rejects(checkDiagram(mk('qqq:left', 'a')), /unknown anchor id "qqq"/);
  await checkDiagram(mk('a', 'a:right')); // sanity: fine
});

test('layout: connect() declared AFTER its boxes works even across separate add() calls', async () => {
  const d = diagram({theme: 'blue'});
  d.add(box({id: 'a', title: 'A'}));
  d.add(box({id: 'b', title: 'B'}));
  d.add(connect('a', 'b'));
  assert.equal((await checkDiagram(d)).laidOut.connects.length, 1);
});

test('swimlane(): unknown lane and unknown flow step id throw', () => {
  const lanes = [{id: 'dev', label: 'D'}];
  assert.throws(() => swimlaneJs(lanes, [{id: 'a', lane: 'qa', title: 'A'}]), /swimlane\(\): step "a" uses unknown lane "qa"/);
  assert.throws(() => swimlaneJs(lanes, [{lane: 'qa', title: 'No id'}]), /step "No id" uses unknown lane "qa"/);
  const steps = [{id: 'a', lane: 'dev', title: 'A'}];
  assert.throws(() => swimlaneJs(lanes, steps, {flows: [{from: 'a', to: 'z'}]}), /flow a -> z refers to an unknown step id/);
  assert.throws(() => swimlaneJs(lanes, steps, {flows: [{from: 'z:left', to: 'a'}]}), /unknown step id/);
});

test('swimlane(): 7 lanes still lays out (only the swimlane-lanes rule warns)', async () => {
  const lanes = Array.from({length: 7}, (_, i) => ({id: `l${i}`, label: `L${i}`}));
  const d = diagram({theme: 'blue'});
  d.add(swimlaneJs(lanes, [{id: 's', lane: 'l0', title: 'S'}]) as never);
  const r = await checkDiagram(d);
  assert.ok(r.verdict.findings.some(f => f.rule === 'swimlane-lanes'));
});

test('sequence(): unknown actor and from === to throw at layout time', async () => {
  const mk = (steps: unknown[]) => { const d = diagram({theme: 'blue'}); d.add(sequenceJs([{id: 'u', label: 'U'}, {id: 'v', label: 'V'}], steps) as never); return d; };
  await assert.rejects(checkDiagram(mk([{from: 'u', to: 'db', label: 'x'}])), /sequence\(\): unknown actor "db"/);
  await assert.rejects(checkDiagram(mk([{self: 'db', label: 'x'}])), /unknown actor "db"/);
  await assert.rejects(checkDiagram(mk([{note: 'n', over: ['u', 'db']}])), /unknown actor "db"/);
  await assert.rejects(checkDiagram(mk([{from: 'u', to: 'u', label: 'x'}])), /has from === to; use \{self: id\}/);
});

test('stateMatrix(): more cells than columns throws; fewer cells is allowed and reported as wf-states-todo', async () => {
  const mk = (cells: unknown[]) => { const d = diagram({theme: 'blue'}); d.add(stateMatrixJs(['a', 'b'], [{label: 'Row', cells}]) as never); return d; };
  await assert.rejects(checkDiagram(mk([wf.text('x'), wf.text('y'), wf.text('z')])), /stateMatrix\(\): row "Row" has 3 cells for 2 columns/);
  const short = await checkDiagram(mk([wf.text('x')]));
  assert.ok(short.verdict.findings.some(f => f.rule === 'wf-states-todo'));
  const explicit = await checkDiagram(mk([wf.text('x'), undefined]));
  assert.ok(explicit.verdict.findings.some(f => f.rule === 'wf-states-todo'), 'an explicit undefined is the TODO marker');
});

test('wireframe(): an overlay that is not wf.dialog / wf.toast throws; an unknown node type throws', async () => {
  const d1 = diagram({theme: 'blue'});
  d1.add(wireframeJs(wf.text('x'), {overlays: [wf.text('not an overlay')]}) as never);
  await assert.rejects(checkDiagram(d1), /wireframe\(\): overlay must be wf\.dialog or wf\.toast, got "text"/);
  const d2 = diagram({theme: 'blue'});
  d2.add(wireframeJs({t: 'hologram'}) as never);
  await assert.rejects(checkDiagram(d2), /wireframe\(\): unknown node type "hologram"/);
  const d3 = diagram({theme: 'blue'});
  d3.add(wireframeJs(wf.col([wf.text('a'), {t: 'nope'} as never])) as never);
  await assert.rejects(checkDiagram(d3), /unknown node type "nope"/);
});

test('row({cols}): a child outside the columns throws at layout time', async () => {
  const d = diagram({theme: 'blue'});
  d.add(row([box({title: 'a', col: 3, span: 2})], {cols: 3}));
  await assert.rejects(checkDiagram(d), /row\(\{cols: 3\}\): child "a" at col 3 span 2 falls outside the 3 columns/);
});

test('wireframe(): an unknown state throws', async () => {
  const d = diagram({theme: 'blue'});
  d.add(wireframeJs(wf.video({state: 'broken'} as never)) as never);
  await assert.rejects(checkDiagram(d), /unknown state "broken"/);
});

test('screens(): unrelated sanity, an item without root still reports a clear failure rather than hanging', async () => {
  const d = diagram({theme: 'blue'});
  d.add(any(screens)([{id: 's', title: 'T'}]) as never);
  await assert.rejects(checkDiagram(d));
});

test('box() refuses an unknown option instead of dropping or keeping it (JS callers); banner() keeps its defaults', () => {
  assert.throws(() => boxJs({title: 'T', extra: 1}), /unknown option 'extra'/);
  assert.equal(banner({headline: 'H'}).tone, 'accent');
});

test('row() takes boxes and groups; grid() takes boxes only; anything else is refused instead of drawing an empty box', async () => {
  const {row, grid, group, box, banner} = await import('../lib/dsl.ts');
  const g = group([box({title: 'x'})], {title: 'g'});
  const ban = banner({headline: 'h'}) as never;
  assert.equal(row([ban]).type, 'grouprow'); // a banner / caption is wrapped in a frameless group
  assert.throws(() => row([grid([box({title: 'a'})], {cols: 1}) as never]), /row\(\): child 0 is a grid\(\)/);
  assert.throws(() => grid([box({title: 'a'}), g as never], {cols: 2}), /grid\(\): child 1 is a group\(\)/);
  assert.throws(() => row([g], {arrows: 'between'}), /arrows: 'between' cannot be used/);
  assert.doesNotThrow(() => row([box({title: 'a'})]));
  assert.equal(row([box({title: 'a'}), g]).type, 'grouprow');
});

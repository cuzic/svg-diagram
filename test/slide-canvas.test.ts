import test from 'node:test';
import assert from 'node:assert/strict';
import {box, checkDiagram, closeMeasurer, connect, diagram, renderDiagram} from '../lib/dsl.ts';
import {lintDiagram} from '../lib/rules.ts';
import {ROLES} from '../lib/tokens.ts';

test.after(() => closeMeasurer());

const small = (extra: object = {}) => diagram({theme: 'blue', canvas: 'slide', gap: 36, title: '流れ', ...extra}).add(
  box({id: 'a', title: '利用者', body: 'ブラウザから送る'}),
  box({id: 'b', title: 'API', body: '検証して処理する'}),
  connect('a', 'b', {label: '要求'}),
);

test('canvas: "slide" is a 1280x720 canvas whose smallest text is 24px, with no finding', async () => {
  const r = await renderDiagram(small(), {name: 'c.svg', budget: 'cacheOnly'});
  assert.deepEqual([r.width, r.height], [1280, 720]);
  assert.match(r.svg, /viewBox="0 0 1280 720"/);
  const sizes = [...r.svg.matchAll(/font-size="(\d+)"/g)].map(m => Number(m[1]));
  assert.equal(Math.min(...sizes), 24);
  assert.deepEqual(r.verdict.findings.filter(f => f.severity === 'warn'), []);
  assert.deepEqual(r.verdict.problems, []);
  assert.equal(ROLES.body, 14, 'the font scale is undone afterwards');
});

test('canvas: check sees the same scaled layout as build', async () => {
  const {laidOut, verdict} = await checkDiagram(small());
  assert.equal(laidOut.canvasHeight, 720);
  assert.deepEqual(verdict.problems, []);
});

test('canvas: an explicit minText is the one the fonts are scaled to', async () => {
  const {verdict} = await checkDiagram(small({canvas: {minText: 30}}));
  assert.deepEqual(verdict.findings.filter(f => f.rule === 'slide-min-text'), []);
});

test('canvas: content taller than the canvas is slide-canvas-overflow', async () => {
  const d = diagram({theme: 'blue', canvas: 'slide', title: '縦長'}).add(...Array.from({length: 8}, (_, i) => box({title: `項目${i}`, body: '説明'})));
  const {verdict, laidOut} = await checkDiagram(d);
  assert.ok(laidOut.canvasHeight > 720);
  assert.ok(verdict.findings.some(f => f.rule === 'slide-canvas-overflow' && f.severity === 'warn'), JSON.stringify(verdict.findings));
});

test('canvas: a custom size and minimum text; combining with slide / fill throws', async () => {
  const r = await renderDiagram(small({canvas: {width: 1920, height: 1080, minText: 30}}), {name: 'c.svg', budget: 'cacheOnly'});
  assert.deepEqual([r.width, r.height], [1920, 1080]);
  assert.equal(Math.min(...[...r.svg.matchAll(/font-size="(\d+)"/g)].map(m => Number(m[1]))), 30);
  assert.throws(() => small({slide: {page: 'p.md', heading: 'h'}}), /cannot be combined/);
  assert.throws(() => small({fill: true}), /cannot be combined/);
});

test('slide-min-text: text under the canvas minimum is a warning (with its size in the message)', () => {
  const d = {...small(), laidOut: [{type: 'box', wrappedRuns: [{text: 'x', size: 18}]}], connects: []} as unknown as Parameters<typeof lintDiagram>[0];
  const f = lintDiagram(d).filter(x => x.rule === 'slide-min-text');
  assert.equal(f.length, 1);
  assert.match(f[0].message, /18px.*24px/);
});

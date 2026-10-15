// ADR 0017 U2: the root carries data-min-text only when a canvas figure lowers its text floor below 14.
import test from 'node:test';
import assert from 'node:assert/strict';
import {box, closeMeasurer, connect, diagram, renderDiagram} from '../lib/dsl.ts';
import {canvasFontScale, ROLES} from '../lib/tokens.ts';

test.after(() => closeMeasurer());

const fig = (extra: object) => diagram({theme: 'blue', title: '流れ', ...extra}).add(
  box({id: 'a', title: '利用者', body: 'ブラウザから送る'}),
  box({id: 'b', title: 'API', body: '検証して処理する'}),
  connect('a', 'b', {label: '要求'}),
);
const render = async (extra: object) => (await renderDiagram(fig(extra), {name: 'f.svg', budget: 'cacheOnly'})).svg;
const rootTag = (svg: string) => svg.match(/<svg [^>]*>/)![0];

test('minText below 14: data-min-text on the root, and the smallest text is the role scale', async () => {
  const svg = await render({canvas: {minText: 10}});
  assert.match(rootTag(svg), / data-min-text="10"/);
  const sizes = [...svg.matchAll(/font-size="(\d+)"/g)].map(m => Number(m[1]));
  assert.equal(Math.min(...sizes), Math.round(ROLES.body * canvasFontScale(10)));
});

test('no attribute for minText >= 14, canvas: "slide", or no canvas', async () => {
  for (const extra of [{canvas: {minText: 14}}, {canvas: {minText: 20}}, {canvas: 'slide'}, {}]) {
    assert.doesNotMatch(await render(extra), /data-min-text/, JSON.stringify(extra));
  }
});

test('the attribute sits on the root tag only', async () => {
  const svg = await render({canvas: {minText: 10}});
  assert.equal(svg.split('data-min-text').length, 2);
  assert.match(svg, /^<svg data-min-text="10" xmlns=|^<svg [^>]*data-min-text="10"/);
});

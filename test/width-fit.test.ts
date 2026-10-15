// ADR 0014 U5: diagram({width: 'fit'}) narrows a thin figure to its content. Relations only (no absolute widths): the font does not matter.
import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/strict-width.ts';
import {banner, box, concentric, closeMeasurer, diagram, renderDiagram} from '../lib/dsl.ts';

test.after(() => closeMeasurer());
const thin = () => concentric([{label: 'チーム'}, {label: '顧客と取引先'}, {label: '社会'}], {order: 'inner-first', labels: 'side', centre: '利用者'});
const draw = (d: ReturnType<typeof diagram>) => renderDiagram(d, {name: 't.svg', budget: 'cacheOnly'});

test("width: 'fit' narrows a thin figure and keeps its content inside, on the 4px grid", async () => {
  const wide = await draw(diagram({theme: 'teal'}).add(thin())), fit = await draw(diagram({theme: 'teal', width: 'fit'}).add(thin()));
  assert.equal(wide.width, 940);
  assert.ok(fit.width < wide.width - 100, `narrower (${fit.width})`);
  assert.equal(fit.width % 4, 0);
  assert.deepEqual(fit.verdict.problems ?? [], []);
  assert.match(fit.svg, new RegExp(`viewBox="0 0 ${fit.width} `));
});

test("width: 'fit' leaves a figure whose content spans the width at 940, byte for byte", async () => {
  const bands = () => [banner({headline: '見出し', sub: '補足'}), box({title: '全幅', body: '本文'})];
  const a = await draw(diagram({theme: 'teal'}).add(...bands())), b = await draw(diagram({theme: 'teal', width: 'fit'}).add(...bands()));
  assert.equal(b.svg, a.svg);
});

test("width: 'fit' is validated; a number or nothing is as before", async () => {
  assert.throws(() => diagram({theme: 'teal', width: 'wide' as unknown as 'fit'}), /width/);
  assert.throws(() => diagram({day: 1, width: 'fit', fill: true} as never), /fit/);
  const r = await draw(diagram({theme: 'teal', width: 700}).add(thin()));
  assert.equal(r.width, 700);
});

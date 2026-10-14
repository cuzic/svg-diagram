// canvas({fit}) (ADR 0014 U3): the default height comes from the content; fit: 'aspect' keeps the old floor.
// Relative checks only (no absolute heights), so they hold with whatever font the machine has.
import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {canvas, checkDiagram, closeMeasurer, diagram} from '../lib/dsl.ts';
import {canvasKeys, canvasTemplates, CANVAS_MIN_ROW_H, TEMPLATES} from '../lib/canvas.ts';
import type {LaidOutGrid} from '../lib/types/containers.ts';
import type {LaidOutBox} from '../lib/types/text-bands.ts';

test.after(() => closeMeasurer());

const laid = async (band: unknown) => {
  const d = diagram({theme: 'blue', title: 't'});
  d.add(band as never);
  const {laidOut} = await checkDiagram(d);
  const boxes = (laidOut.laidOut.find(b => b.type === 'grid') as LaidOutGrid).children as LaidOutBox[];
  const span = Math.max(...boxes.map(b => b.y + b.h)) - Math.min(...boxes.map(b => b.y));
  return {laidOut, boxes, span, width: laidOut.width, byTitle: (t: string) => boxes.find(b => b.title === t) as LaidOutBox};
};
const sample = (name: keyof typeof TEMPLATES): Record<string, string[]> =>
  Object.fromEntries(canvasKeys(name, false).map(k => [k, [`${k} の要点`]]));

test("default is content-driven: never taller than fit 'aspect', which keeps the template's height / width as a floor", async () => {
  for (const name of canvasTemplates() as (keyof typeof TEMPLATES)[]) {
    const c = await laid(canvas(name, sample(name)));
    const a = await laid(canvas(name, sample(name), {fit: 'aspect'}));
    assert.ok(a.span >= TEMPLATES[name].aspect * (a.width - 40) - 8, `${name}: aspect keeps its floor`);
    assert.ok(c.span <= a.span + 0.5, `${name}: content ${c.span} vs aspect ${a.span}`);
  }
});

test('a region meant to be filled is at least the minimum row height, even with no content; label cells and empty optional regions are not', async () => {
  const swot = await laid(canvas('swot', {}));
  for (const b of swot.boxes) assert.ok(b.h >= CANVAS_MIN_ROW_H, `${b.title} ${b.h}`);
  const three = await laid(canvas('threeC', {customer: ['a']}));
  assert.ok(three.byTitle('示唆（勝てるポイント）').h < CANVAS_MIN_ROW_H, 'an empty optional region is only its title');
  const vpc = await laid(canvas('vpc', {}));
  assert.ok(vpc.byTitle('顧客プロフィール').h < CANVAS_MIN_ROW_H, 'a label cell has no floor');
});

test('a row is as tall as its tallest region, so a long text makes only its row taller', async () => {
  const long = Array.from({length: 10}, (_, i) => `項目 ${i} をかなり長めの文で書いて折り返しを起こさせる`);
  const base = await laid(canvas('swot', sample('swot')));
  const grown = await laid(canvas('swot', {...sample('swot'), strengths: long}));
  const t = (r: typeof base, n: string) => r.byTitle(n).h;
  assert.ok(t(grown, '強み（Strengths）') > t(base, '強み（Strengths）'));
  assert.equal(t(grown, '強み（Strengths）'), t(grown, '弱み（Weaknesses）'));
  assert.equal(t(grown, '機会（Opportunities）'), t(base, '機会（Opportunities）'));
});

test('h still sets the least height in both modes; an unknown fit throws', async () => {
  for (const fit of ['content', 'aspect'] as const) assert.ok((await laid(canvas('swot', {strengths: ['a']}, {h: 900, fit}))).span >= 900, fit);
  assert.throws(() => canvas('swot', {}, {fit: 'wide' as never}), /canvas\(\{fit\}\) is 'content' or 'aspect'/);
});

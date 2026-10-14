import test from 'node:test';
import assert from 'node:assert/strict';
import {bars, box, caption, checkDiagram, closeMeasurer, diagram, group, renderDiagram} from '../lib/dsl.ts';
import {diagramDesc} from '../lib/rules.ts';
import type {LaidOutBars} from '../lib/dsl.ts';

test.after(() => closeMeasurer());

const DATA = [{label: 'A', value: 20}, {label: 'B', value: 40}, {label: 'C', value: 30}];
const laid = async (opts: Parameters<typeof bars>[1], extra: {title?: string; medium?: 'doc' | 'slide'} = {}) => {
  const d = diagram({theme: 'blue', ...extra}).add(bars(DATA, opts));
  const r = await checkDiagram(d);
  return {b: r.laidOut.laidOut.find((x): x is LaidOutBars => x.type === 'bars')!, verdict: r.verdict, d};
};
const svgOf = async (opts: Parameters<typeof bars>[1]) => (await renderDiagram(diagram({theme: 'blue', title: 't'}).add(bars(DATA, opts)), {name: 't', budget: 'measure'})).svg;

test('explicit defaults draw the same bytes as no options', async () => {
  for (const dir of ['h', 'v'] as const) {
    const base = await svgOf({dir, max: 50});
    assert.equal(await svgOf({dir, max: 50, labels: 'all', axis: true, grid: true, baseline: true}), base);
  }
});

test('ticks split: axis on + grid off draws short ticks, the combined line is the default', async () => {
  const v = await laid({dir: 'v', max: 50});
  const vg = await laid({dir: 'v', max: 50, grid: false});
  assert.equal(v.b.ticks.length, vg.b.ticks.length);
  const full = v.b.ticks.filter(t => t.x2 - t.x1 > 100).length, short = vg.b.ticks.filter(t => t.x2 - t.x1 > 100).length;
  assert.ok(full > short);
  assert.deepEqual(vg.b.ticks.slice(0, 2).map(t => t.x2 - t.x1), [6, 6]);
  const h = await laid({max: 50});
  const hg = await laid({max: 50, grid: false});
  assert.ok(h.b.ticks[0]!.y2 - h.b.ticks[0]!.y1 > 30 && hg.b.ticks[0]!.y2 - hg.b.ticks[0]!.y1 === 6);
  assert.equal(hg.b.ticks.at(-1)!.y1, hg.b.ticks.at(-1)!.y2, 'the value axis stays');
});

test('labels: category keeps the labels and drops the values; none drops both', async () => {
  const all = (await laid({dir: 'v', max: 50, axis: false})).b.texts.map(t => t.text);
  assert.ok(all.includes('A') && all.includes('40'));
  const cat = (await laid({dir: 'v', max: 50, axis: false, labels: 'category'})).b.texts.map(t => t.text);
  assert.deepEqual(cat, ['A', 'B', 'C']);
  assert.deepEqual((await laid({dir: 'v', max: 50, axis: false, labels: 'none'})).b.texts, []);
  assert.deepEqual((await laid({max: 50, axis: false, labels: 'none'})).b.texts, []);
});

test('axis: false drops numbers, ticks and the value axis but keeps a baseline (also on horizontal bars)', async () => {
  const v = await laid({dir: 'v', axis: false, labels: 'none'});
  assert.equal(v.b.ticks.length, 1);
  assert.equal(v.b.ticks[0]!.y1, v.b.ticks[0]!.y2, 'a horizontal ground line');
  const h = await laid({axis: false, labels: 'none'});
  assert.equal(h.b.ticks.length, 1);
  assert.equal(h.b.ticks[0]!.x1, h.b.ticks[0]!.x2, 'a vertical line at the bars start');
  assert.equal((await laid({dir: 'v', axis: false, labels: 'none', baseline: false})).b.ticks.length, 0);
  assert.equal((await laid({axis: false, labels: 'none', baseline: false})).b.ticks.length, 0);
});

test('horizontal bars: axis and labels free their space', async () => {
  const full = (await laid({max: 50})).b.h, bare = (await laid({max: 50, axis: false, labels: 'none'})).b;
  assert.ok(bare.h < full - 30);
  assert.equal(bare.bars[0]!.x, bare.x, 'no label column');
  assert.ok(bare.bars[1]!.w > (await laid({max: 50})).b.bars[1]!.w);
});

test('a hurdle at height 60 has a plot of 50px or more and does not throw', async () => {
  const {b, verdict} = await laid({dir: 'v', labels: 'none', axis: false, grid: false, height: 60});
  assert.deepEqual(verdict.problems, []);
  assert.ok(b.bars[1]!.h >= 50, `tallest bar ${b.bars[1]!.h}`);
  // with axis / labels the old floor stays
  await assert.rejects(laid({dir: 'v', height: 100}), /too small/);
  await assert.rejects(laid({dir: 'v', height: 100, axis: false}), /too small/);
});

test('a bar of 1px or less is a warning, not a throw (and zero is not one)', async () => {
  const d = diagram({theme: 'blue'}).add(bars([{label: 'a', value: 0.5}, {label: 'b', value: 100}, {label: 'c', value: 0}], {dir: 'v', labels: 'none', axis: false, height: 60}));
  const {verdict} = await checkDiagram(d);
  assert.deepEqual(verdict.problems, []);
  assert.ok(verdict.findings.some(f => f.rule === 'bars-thin-bar' && f.severity === 'warn'));
  assert.ok(!(await laid({dir: 'v', labels: 'none', axis: false, height: 80})).verdict.findings.some(f => f.rule === 'bars-thin-bar'));
});

test('barRatio: omitted keeps the cap, given lifts it, 1 makes bars touch', async () => {
  const wide = (o: object) => bars(DATA, {dir: 'v', max: 50, ...o});
  const widthOf = async (o: object) => (await checkDiagram(diagram({theme: 'blue', width: 1200}).add(wide(o)))).laidOut.laidOut.find((x): x is LaidOutBars => x.type === 'bars')!;
  const none = await widthOf({}), r62 = await widthOf({barRatio: 0.62}), r1 = await widthOf({barRatio: 1});
  assert.equal(none.bars[0]!.w, 64);
  assert.ok(r62.bars[0]!.w > 64);
  assert.ok(Math.abs(r1.bars[0]!.x + r1.bars[0]!.w - r1.bars[1]!.x) < 1e-6);
  const h = (await laid({barRatio: 1})).b, d = (await laid({})).b;
  assert.ok(Math.abs(h.bars[0]!.y + h.bars[0]!.h - h.bars[1]!.y) < 1e-6, 'horizontal rows touch');
  assert.ok(h.h > d.h);
});

test('invalid combinations throw', () => {
  assert.throws(() => bars(DATA, {axis: false, grid: true}), /grid needs axis/);
  assert.throws(() => bars(DATA, {labels: 'values' as never}), /labels must be/);
  assert.throws(() => bars(DATA, {axis: 'no' as never}), /axis must be true or false/);
  assert.throws(() => bars(DATA, {barRatio: 0}), /barRatio/);
  assert.throws(() => bars(DATA, {barRatio: 1.2}), /barRatio/);
  assert.throws(() => bars(DATA, {barRatio: 0.5, stack: true}), /does not apply to stack/);
  assert.doesNotThrow(() => bars(DATA, {axis: false, grid: false}));
});

test('stack honours labels / axis', async () => {
  const s = await laid({stack: true, axis: false, labels: 'category'});
  assert.deepEqual(s.b.texts.map(t => t.text), ['A', 'B', 'C']);
  assert.deepEqual((await laid({stack: true, axis: false, labels: 'none'})).b.texts, []);
});

test('hidden values go to <desc> without dropping box titles; a user desc wins', async () => {
  const hidden = bars(DATA, {dir: 'v', labels: 'none', axis: false, unit: '%'});
  const d = diagram({theme: 'blue', title: 't'}).add(box({title: '箱'}), hidden);
  assert.match(diagramDesc(d), /要素: 箱/);
  assert.match(diagramDesc(d), /値: A 20%、B 40%、C 30%/);
  assert.equal(diagramDesc(diagram({theme: 'blue', desc: '自分の説明'}).add(hidden)), '自分の説明');
  const shown = diagram({theme: 'blue'}).add(bars(DATA, {labels: 'none'}));
  assert.equal(diagramDesc(shown), '', 'a scale still shows the values');
  const grouped = diagram({theme: 'blue'}).add(group([hidden], {title: 'g'}));
  assert.match(diagramDesc(grouped), /値: A 20%/);
  const svg = (await renderDiagram(d, {name: 't', budget: 'measure'})).svg;
  assert.match(svg, /<desc[^>]*>[^<]*値: A 20%/);
});

test('bars-values-hidden warns on a doc diagram without a title only', async () => {
  const make = (extra: object) => diagram({theme: 'blue', medium: 'doc', ...extra}).add(bars(DATA, {labels: 'none', axis: false, height: 80, dir: 'v'}));
  const rules = async (d: ReturnType<typeof make>) => (await checkDiagram(d)).verdict.findings.map(f => f.rule);
  assert.ok((await rules(make({}))).includes('bars-values-hidden'));
  assert.ok(!(await rules(make({title: '題名'}))).includes('bars-values-hidden'));
  const withCaption = diagram({theme: 'blue', medium: 'doc'}).add(caption('題名'), bars(DATA, {labels: 'none', axis: false, height: 80, dir: 'v'}));
  assert.ok(!(await rules(withCaption as never)).includes('bars-values-hidden'));
  assert.ok(!(await rules(diagram({theme: 'blue', medium: 'doc'}).add(bars(DATA, {})) as never)).includes('bars-values-hidden'));
});

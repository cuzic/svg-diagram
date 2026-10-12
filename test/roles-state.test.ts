// Drawing state must be a value: fill mode's scaled font sizes and the reveal pass must not leak between figures.
// Not part of `pnpm golden` (it needs a temporary slide project and the cacheOnly budget).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {diagram, box, row, group, table, cell, plane, bars, build, renderDiagram, checkDiagram, closeMeasurer} from '../lib/dsl.ts';
import {emitSvg} from '../lib/emit.ts';
import {ROLES} from '../lib/tokens.ts';
import {slideCacheKeyForTest} from './helpers/slide-fixture.ts';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'roles-state-'));
const cwd = process.cwd();
test.before(() => { process.chdir(dir); slideCacheKeyForTest(dir, {maxHeight: 900, contentWidth: 800}); });
test.after(async () => { process.chdir(cwd); fs.rmSync(dir, {recursive: true}); await closeMeasurer(); });

const slide = {page: 'pages/p.md', heading: '見出し'};
const tbl = () => table([{label: '方式'}, {label: '結果'}], [['A', cell('通る')], ['B', cell('条件付き')]]);
const sizes = (svg: string) => [...new Set([...svg.matchAll(/font-size="(\d+)"/g)].map(m => Number(m[1])))].sort((a, b) => a - b);
const render = (d: ReturnType<typeof diagram>) => renderDiagram(d, {name: 'p.svg', budget: 'cacheOnly'});

test('1. a figure drawn while a fill figure is mid-search is drawn as if alone', async () => {
  const mkB = () => diagram({day: 2}).add(tbl(), box({title: '見出し', body: '本文'}));
  const alone = await render(mkB());
  const base = ROLES.title;
  // B starts after A's n-th microtask, while A is still mid-search (it awaits a measurement for each of its ~9 layouts).
  // T = how many microtasks a lone A takes; only n < T are mid-search, whatever T is after later optimisations.
  let T = 0;
  for (let pass = 0; pass < 2; pass++) { // the second pass is warm (measurements memoised), like the runs below
    let done = false; T = 0;
    const lone = render(diagram({day: 2, fill: true, slide}).add(tbl(), box({title: 'x', body: 'y'}))).finally(() => { done = true; });
    while (!done && T < 100000) { await Promise.resolve(); T++; }
    await lone;
  }
  assert.ok(T >= 2, `a fill render spans several microtasks (T=${T})`);
  for (const n of [1, 2, 4, 8, 16, 32, 64].filter(n => n < T - 2)) {
    let aDone = false;
    const a = render(diagram({day: 2, fill: true, slide}).add(tbl(), box({title: 'x', body: 'y'}))).finally(() => { aDone = true; });
    for (let i = 0; i < n; i++) await Promise.resolve();
    assert.ok(!aDone, `A is still running when B starts (n=${n})`);
    const b = render(mkB());
    const [ra, rb] = await Promise.all([a, b]);
    assert.ok((ra.fontScale ?? 1) > 1);
    assert.equal(rb.svg, alone.svg, `B drawn ${n} microtasks into A == B drawn alone`);
  }
  assert.equal(ROLES.title, base, 'ROLES is back at its base values');
});

test('2. the reveal stage files of a fill figure are drawn at the same font sizes as the main file', async () => {
  const d = diagram({day: 2, fill: true, slide}).add(box({title: '先'}), table([{label: '方式'}], [['A']], {reveal: 1}));
  const out = path.join(dir, 'out', 'p.svg');
  const r = await build(d, out, {lint: false});
  assert.ok((r.fontScale ?? 1) > 1);
  const main = fs.readFileSync(out, 'utf8');
  assert.equal(r.revealPaths.length, 2);
  assert.deepEqual(sizes(fs.readFileSync(r.revealPaths[1], 'utf8')), sizes(main));
  assert.ok(Math.min(...sizes(fs.readFileSync(r.revealPaths[1], 'utf8'))) > 14);
});

const shared: Record<string, () => unknown> = {
  box: () => box({title: '共有', body: '本文'}),
  plane: () => plane({x: {max: 1}, y: {max: 1}, points: [{id: 'p', at: [0.5, 0.5], label: 'P'}], labels: [{at: [0.2, 0.2], text: 'L'}]}),
  bars: () => bars([{label: 'a', value: 1}, {label: 'b', value: 2}]),
  row: () => row([box({title: '左'}), box({title: '右'})]),
};
for (const [kind, mk] of Object.entries(shared)) {
  test(`3. a ${kind}() band shared by two figures: revealing it in one leaves the other unchanged`, async () => {
    const band = mk() as never;
    const mkOther = () => diagram({day: 2}).add(band);
    const before = await render(mkOther());
    const revealed = await render(diagram({day: 2}).add(group([band], {reveal: 1})));
    assert.ok(revealed.laidOut.maxReveal, 'the revealing figure does have a stage');
    const after = await render(mkOther());
    assert.equal(after.svg, before.svg);
    assert.equal(after.laidOut.maxReveal, before.laidOut.maxReveal, 'no stage appears in the other figure');
    assert.equal(emitSvg(after.laidOut, {reveal: 0}), emitSvg(before.laidOut, {reveal: 0}));
  });
}

test('4. a render does not change its input (bands, width), also on the fill path', async () => {
  const snap = (d: ReturnType<typeof diagram>) => JSON.stringify(d); // every enumerable data field (the methods drop out)
  for (const d of [
    diagram({day: 2}).add(box({title: 'a', reveal: 2}), group([box({title: 'b'})], {reveal: 1}), plane({x: {max: 1}, y: {max: 1}, points: [{id: 'p', at: [0.5, 0.5], label: 'P', reveal: 2}]})),
    diagram({day: 2, fill: true, slide}).add(tbl(), box({title: 'x'})),
  ]) {
    const before = snap(d);
    await render(d);
    assert.equal(snap(d), before);
    await checkDiagram(d);
    assert.equal(snap(d), before);
  }
});

test('5. a band placed twice stays one band in the copy; cycles, RegExp and class instances do not break the copy', async () => {
  const shared = box({title: 'qq'});
  const r = await render(diagram({day: 2}).add(row([shared, shared])));
  assert.equal([...r.svg.matchAll(/>qq</g)].length, 2);
  // one object in two places: a reveal that reaches it through the group is the same value for both places, as before the copy
  const s2 = box({title: 'zz'});
  const withGroup = await render(diagram({day: 2}).add(group([s2], {reveal: 2}), s2));
  const alone = await render(diagram({day: 2}).add(group([box({title: 'zz'})], {reveal: 2}), box({title: 'zz'})));
  assert.equal(withGroup.laidOut.maxReveal, alone.laidOut.maxReveal);
  const loop: {title: string; self?: unknown} = {title: 'c'};
  loop.self = loop;
  await render(diagram({day: 2}).add(Object.assign(box({title: 'c'}), {loop, re: /x/g})));
  class Pt { #id = 'p'; get id() { return this.#id; } }
  await render(diagram({day: 2}).add(Object.assign(box({title: 'k'}), {pt: new Pt()})));
});

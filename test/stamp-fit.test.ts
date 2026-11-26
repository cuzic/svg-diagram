// A stamp wider than its frame no longer throws: it wraps to two lines, and when even that is too wide it is drawn spilling out and reported (stamp-too-wide).
import test from 'node:test';
import assert from 'node:assert/strict';
import {banner, box, checkDiagram, closeMeasurer, diagram, group, renderDiagram} from '../lib/dsl.ts';
import type {LaidOutBox, LaidOutGroup} from '../lib/dsl.ts';

process.env["SVG_DIAGRAM_STRICT_WIDTH"] = '1';
test.after(() => closeMeasurer());

const mk = () => diagram({theme: 'blue', width: 240});
const WRAPS = '見本として載せている架空の数字です'; // too wide for one line in a 240px frame, fine on two
const HOPELESS = 'これは短くできない非常に長い注意書きの文章であり二行でも収まらない'; // too wide even on two lines

for (const [name, wrap] of [
  ['box', (stamp: string) => box({title: 'タイトル', body: '本文', stamp})],
  ['group', (stamp: string) => group([box({title: 'タイトル', body: '本文'})], {title: '枠', stamp})],
] as const) {
  const find = (r: Awaited<ReturnType<typeof checkDiagram>>) => r.laidOut.laidOut.find((x): x is LaidOutBox | LaidOutGroup => x.type === name)!;

  test(`${name}: a stamp that fits on one line is the plain 24px chip`, async () => {
    const b = find(await checkDiagram(mk().add(wrap('仮説'))));
    assert.equal(b.stampLines, undefined);
    assert.equal(b.stampH, undefined);
  });

  test(`${name}: a long stamp wraps to two lines, the chip grows and stays inside the frame`, async () => {
    const r = await checkDiagram(mk().add(wrap(WRAPS)));
    const b = find(r);
    assert.equal(b.stampLines?.length, 2);
    assert.ok(b.stampH! > 24);
    assert.ok(b.stampW! <= b.w - 16);
    assert.equal(b.stampOver, undefined);
    assert.deepEqual(r.verdict.problems.filter(p => /stamp/.test(p)), []);
    const svg = (await renderDiagram(mk().add(wrap(WRAPS)), {name: 'x', budget: 'measure'})).svg;
    for (const l of b.stampLines!) assert.ok(svg.includes(l));
  });

  test(`${name}: a hopeless stamp is still drawn and reported as stamp-too-wide`, async () => {
    const r = await checkDiagram(mk().add(wrap(HOPELESS)));
    assert.ok(find(r).stampOver);
    assert.equal(r.verdict.ok, false);
    const f = r.verdict.problems.filter(p => /stamp/.test(p));
    assert.equal(f.length, 1);
    assert.match(f[0]!, /短くするか、枠を広げる/);
    assert.ok((await renderDiagram(mk().add(wrap(HOPELESS)), {name: 'x', budget: 'measure'})).svg.includes('<svg'));
  });
}

test('banner: a long stamp wraps and a hopeless one is reported', async () => {
  const r = await checkDiagram(mk().add(banner({headline: '見出し', stamp: HOPELESS})));
  assert.equal(r.verdict.problems.filter(p => /stamp/.test(p)).length, 1);
  assert.equal((await checkDiagram(mk().add(banner({headline: '見出し', stamp: WRAPS})))).verdict.problems.filter(p => /stamp/.test(p)).length, 0);
});

test('fitStamp: one line when it fits, two when wrapping helps, two with `over` when it does not; stampProblems / stampTooWideMessage say how to fix it', async () => {
  const {fitStamp, stampTooWideMessage, STAMP_H} = await import('../lib/layout-util.ts');
  const {stampProblems} = await import('../lib/verify-box-like.ts');
  const {measureAtoms} = await import('../lib/measure.ts');
  const {ROLES} = await import('../lib/tokens.ts');
  const m = await measureAtoms([...new Set([...WRAPS, ...HOPELESS, ...'仮説'])], {size: ROLES.note, weight: 400});
  const widthOf = (a: string) => m.width(a);
  const plain = fitStamp(widthOf, '仮説', ROLES, 200);
  assert.deepEqual([plain.h, plain.lines, plain.over], [STAMP_H, undefined, undefined]);
  const two = fitStamp(widthOf, WRAPS, ROLES, 200);
  assert.equal(two.lines?.length, 2); assert.equal(two.over, undefined); assert.ok(two.w <= 200 && two.h > STAMP_H);
  const bad = fitStamp(widthOf, HOPELESS, ROLES, 200);
  assert.ok(bad.over && bad.w === 200);
  const msg = stampTooWideMessage('x', 200, bad.over!);
  assert.match(msg, /短くするか、枠を広げる/);
  assert.deepEqual(stampProblems({stamp: 'x', stampOver: bad.over, w: 216}), [msg]);
  assert.deepEqual(stampProblems({stamp: 'x', w: 216}), []);
});

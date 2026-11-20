// node --test test/   — connect({via}): an end inside a framed group stops on the group's frame (ADR 0069 D2).
import test from 'node:test';
import assert from 'node:assert/strict';
import {areas, box, bracket, branch, checkDiagram, closeMeasurer, connect, diagram, group, node, renderDiagram, row, table} from '../lib/dsl.ts';
import {lintDiagram} from '../lib/rules.ts';
import {fontsOf, planSlide} from '../lib/pptx/slide.ts';
import type {LaidOutBox} from '../lib/types/text-bands.ts';
import type {ConnectBand, LaidOutConnect, LaidOutGroup} from '../lib/types/containers.ts';
import type {Band} from '../lib/types/index.ts';

test.after(() => closeMeasurer());

const render = async (...bands: Band[]) => (await renderDiagram(diagram({theme: 'blue', title: 't'}).add(...bands), {name: 'x.svg', budget: 'cacheOnly'})).laidOut;
type Laid = Awaited<ReturnType<typeof render>>;
const boxOf = (l: Laid, id: string): LaidOutBox => {
  for (const b of l.laidOut) {
    if (b.type === 'box' && b.id === id) return b;
    if (b.type === 'row') { const c = b.children.find(x => x.id === id); if (c) return c; }
  }
  throw new Error(`no box ${id}`);
};
const frameOf = (l: Laid, title: string) => l.laidOut.find(b => b.type === 'group' && b.title === title) as LaidOutGroup;
const memo = () => group([box({id: 'memo', title: '決定メモ'})], {frame: false, valign: 'center'});
const convs = (title = '同じ前提') => group([box({id: 'c1', title: '今の会話'}), box({id: 'c2', title: '新しい会話'}), box({id: 'c3', title: '別の人'})], {title});
const crosses = (c: LaidOutConnect, f: LaidOutGroup): boolean => c.points.slice(1).some((p, i) => {
  const q = c.points[i]!; // a segment strictly inside the frame's x range on a y inside it
  const xs = [Math.min(p.x, q.x), Math.max(p.x, q.x)], ys = [Math.min(p.y, q.y), Math.max(p.y, q.y)];
  return xs[1]! > f.x + 0.5 && xs[0]! < f.x + f.w - 0.5 && ys[1]! > f.y + 0.5 && ys[0]! < f.y + f.h - 0.5;
});

test('via: the end stops on the frame edge, at a y within the box, and the line never enters the frame (a row stretches the frame first)', async () => {
  const l = await render(row([memo(), group([], {frame: false}), convs()], {cols: [4, 2, 4]}), connect('memo:right', 'c3:left', {via: {to: 'group'}}));
  const c = l.connects[0]!, f = frameOf(l, '同じ前提'), c3 = boxOf(l, 'c3');
  assert.equal(c.to.x, f.x, 'on the left edge of the frame');
  assert.ok(c.to.y >= c3.y && c.to.y <= c3.y + c3.h, 'within the box\'s height');
  assert.equal(crosses(c, f), false);
  assert.deepEqual(c.toVia, {x: f.x, y: f.y, w: f.w, h: f.h});
  assert.equal(c.toId, 'c3', 'the end is still the box (the graph reads it so)');
  assert.equal(c.toArea, undefined);
  assert.equal(l.connects.length, 1, 'resolved once (the row lays the frame out twice)');
});

test('via: a frame an areas() lays out again (its second pass) is read at its final size', async () => {
  const tall = group(['a', 'b', 'c', 'd'].map(t => box({title: t})), {title: 'L'});
  const l = await render(areas('L m G', {L: tall, m: memo(), G: group([box({id: 'g1', title: 'g1'})], {title: 'G'})}), box({id: 'z', title: 'z'}), connect('memo:right', 'g1:left', {via: {to: 'group'}}), connect('g1:bottom', 'z:top', {via: {from: 'group'}}));
  const G = frameOf(l, 'G'), L = frameOf(l, 'L');
  assert.equal(G.h, L.h, 'the frame is stretched to its area');
  assert.equal(l.connects[0]!.to.x, G.x);
  assert.equal(l.connects[1]!.from.y, G.y + G.h, 'the bottom edge of the stretched frame, not of its first, shorter layout');
});

test('via: nested frames stop at the outermost one that leaves the other end out', async () => {
  const inner = group([box({id: 'c1', title: 'c1'})], {title: '内'});
  const outer = group([inner, box({id: 'c2', title: 'c2'})], {title: '外'});
  const l = await render(row([memo(), outer], {cols: [4, 8]}), connect('memo:right', 'c1:left', {via: {to: 'group'}}), connect('c2:top', 'c1:bottom', {via: 'group'}));
  assert.equal(l.connects.find(c => c.fromId === 'memo')!.to.x, frameOf(l, '外').x, 'the outer frame (the inner one would make the line cross it)');
  const within = l.connects.find(c => c.fromId === 'c2')!;
  assert.equal(within.toVia?.y, frameOf(l, '内').y, 'both ends in 外: c1 stops on 内, not on 外');
  assert.equal(within.toVia?.h, frameOf(l, '内').h);
  assert.equal(within.fromVia, undefined, 'c2 has no frame of its own that leaves c1 out');
  assert.equal(within.to.y, frameOf(l, '内').y + frameOf(l, '内').h);
});

test('via: the errors', async () => {
  const fig = (c: Band) => render(row([memo(), convs()], {cols: [6, 6]}), c);
  assert.throws(() => connect('memo:right', 'c1', {via: {to: 'group'}}), /via to needs a side on "c1"/);
  assert.throws(() => connect('memo:right', 'c1:center', {via: {to: 'group'}}), /via to needs a side/);
  assert.throws(() => connect('memo:right', 'c1:left', {via: 'x' as never}), /via is 'group', \{from: 'group'\} or \{to: 'group'\}/);
  assert.throws(() => connect('memo:right', 'c1:left', {route: 'loop-under', via: 'group'} as never), /via works with route 'straight' or 'elbow'/);
  await assert.rejects(fig(connect('memo:right', 'c1', {via: 'group'})), /via needs a side on "c1"/);
  await assert.rejects(fig(connect('memo:right', 'c1:right', {via: {to: 'group'}})), /stops "c1:right" on the right edge of its frame, but the other end is not on that side/);
  await assert.rejects(fig(connect('c1:left', 'memo:right', {via: {to: 'group'}})), /via to: "memo" is not inside a framed group/);
  await assert.rejects(fig(connect('memo:right', 'c1:left', {via: {from: 'group'}})), /via from: "memo" is not inside a framed group/);
  await assert.rejects(render(row([memo(), box({id: 'x', title: 'x'})], {cols: [6, 6]}), connect('memo:right', 'x:left', {via: 'group'})), /neither end is inside a framed group/);
  await assert.rejects(render(row([memo(), group([box({title: 'x'})], {title: 'G', id: 'G'})], {cols: [6, 6]}), connect('memo:right', 'G:left', {via: {to: 'group'}})), /"G" is a group, so "G:left" already ends on its frame: drop via to/);
  const annot = {...bracket('c1:left', 'c3:left'), via: 'group'} as ConnectBand;
  await assert.rejects(fig(annot), /a bracket\(\) takes no via/);
});

test('via: levelled like any side-to-side line (one end moves, or both to the middle of the overlap); a fan keeps one start', async () => {
  const short = group([box({id: 's', title: 's'})], {title: 'S'});
  const big = () => group([box({title: 'a'}), box({id: 'L', title: 'L'}), box({title: 'c'})], {title: 'big'});
  const l = await render(row([big(), short], {cols: [6, 6]}), connect('L:right', 's:left', {via: 'group'}));
  const c = l.connects[0]!;
  assert.equal(c.from.y, c.to.y, 'level');
  assert.equal(c.from.x, frameOf(l, 'big').x + frameOf(l, 'big').w);
  assert.equal(c.to.x, frameOf(l, 'S').x);
  const fan = await render(row([memo(), convs()], {cols: [6, 6]}), ...branch('memo:right', [{to: 'c1:left'}, {to: 'c2:left'}, {to: 'c3:left'}], {via: {to: 'group'}}));
  assert.equal(new Set(fan.connects.map(x => `${x.from.x},${x.from.y}`)).size, 1, 'one start');
  assert.ok(fan.connects.every(x => x.to.x === frameOf(fan, '同じ前提').x));
});

test('via: an elbow with bend auto does not take the boxes in the frame for obstacles; the checks do not count them as overlaps', async () => {
  const d = diagram({theme: 'blue', title: 't'}).add(row([memo(), convs()], {cols: [6, 6]}), connect('memo:right', 'c3:left', {via: {to: 'group'}, route: 'elbow', bend: 'auto'}));
  const {laidOut, verdict} = await checkDiagram(d);
  const c = laidOut.connects[0]!;
  assert.equal(c.to.x, frameOf(laidOut, '同じ前提').x);
  assert.deepEqual(verdict.problems, []);
});

test('via: a node\'s bottom end stops on the frame, not under its label (nodeBottoms is not used)', async () => {
  const l = await render(group([node({id: 'n', icon: 'user', label: '利用者'})], {title: 'N'}), box({id: 'b', title: 'b'}), connect('n:bottom', 'b:top', {via: {from: 'group'}}));
  const c = l.connects[0]!, f = frameOf(l, 'N');
  assert.equal(c.from.y, f.y + f.h);
});

test('via: a frame round an anchor that is not a box (a table) works the same', async () => {
  const l = await render(row([memo(), group([table([{label: '列'}], [['値']], {id: 'tbl'})], {title: 'T'})], {cols: [6, 6]}), connect('memo:right', 'tbl:left', {via: {to: 'group'}}));
  assert.equal(l.connects[0]!.to.x, frameOf(l, 'T').x);
});

test('via: the graph rules still see the boxes the line does not reach (c2, c3)', async () => {
  // (the graph rules look at a figure of 3 arrows or more)
  const l = await render(row([memo(), convs()], {cols: [6, 6]}), ...[0.3, 0.5, 0.7].map(t => connect(`memo:right@${t}`, 'c1:left', {via: {to: 'group'}})));
  const f = lintDiagram(l as never);
  const orphan = f.find(x => x.rule === 'graph-orphan-node');
  assert.ok(orphan && /c2/.test(orphan.message) && /c3/.test(orphan.message), JSON.stringify(f.map(x => x.rule)));
});

test('PowerPoint: a via end is not glued; the other end, and ends moved by levelSides / @t, are', async () => {
  const short = group([box({id: 's', title: 's'})], {title: 'S'});
  const big = group([box({title: 'a'}), box({id: 'L', title: 'L'}), box({title: 'c'})], {title: 'big'});
  const l = await render(row([big, short], {cols: [6, 6]}), connect('L:right', 's:left', {via: {to: 'group'}}), connect('L:bottom@0.3', 's:bottom@0.7', {route: 'elbow'}));
  assert.ok(l.connects[1]!.toVia && !l.connects[0]!.toVia, 'the via connect is resolved last');
  const xml = planSlide(l, fontsOf()).xml;
  const cxns = [...xml.matchAll(/<p:cxnSp>[\s\S]*?<\/p:cxnSp>/g)].map(m => m[0]);
  assert.equal(cxns.length, 2);
  // a via connect is always resolved last, so it is drawn last
  assert.match(cxns[1]!, /<a:stCxn /, 'the box end (moved by levelSides) is glued');
  assert.doesNotMatch(cxns[1]!, /<a:endCxn /, 'the end on the frame is not');
  assert.match(cxns[0]!, /<a:stCxn [\s\S]*<a:endCxn /, 'a line with @t ends: both glued');
});

test('via and the label gaps (D1): the gap a labelled via line runs through is widened like any other, and the checks agree', async () => {
  for (const chip of [true, false]) for (const labelAt of [0.5, 0.3]) {
    const side = diagram({theme: 'blue', title: 't'}).add(row([memo(), convs()], {cols: [6, 6], gap: 8}), connect('memo:right', 'c2:left', {via: {to: 'group'}, label: '照らし合わせる', chip, labelAt}));
    const a = await checkDiagram(side);
    assert.deepEqual([...a.verdict.problems, ...a.verdict.warnings.filter(w => w.includes('covers-arrow'))], [], `side by side, chip ${chip} @${labelAt}`);
    const stacked = (inner: Band) => diagram({theme: 'blue', title: 't', gap: 8}).add(box({id: 'top', title: '上'}), group([inner], {title: 'N'}), connect('top:bottom', 'n:top' as string, {via: {to: 'group'}, label: '確認', chip, labelAt}));
    const b = await checkDiagram(stacked(node({id: 'n', icon: 'user', label: '利用者'})));
    assert.deepEqual([...b.verdict.problems, ...b.verdict.warnings.filter(w => w.includes('covers-arrow'))], [], `stacked onto a frame, chip ${chip} @${labelAt}`);
    const plain = await checkDiagram(stacked(box({id: 'n', title: '利用者'})));
    const gapOf = (r: typeof b) => (r.laidOut.laidOut.find(x => x.type === 'group') as LaidOutGroup).y - (boxOf(r.laidOut, 'top').y + boxOf(r.laidOut, 'top').h);
    assert.equal(gapOf(b), gapOf(plain), 'no room added for a node\'s icon the line does not reach');
  }
});

test('via: levelSides moves both ends to the middle of the overlap when neither middle is inside the other box', async () => {
  const body = '本文の行。'.repeat(14);
  const l = await render(row([group([box({id: 'A', title: 'A', body})], {title: 'L', valign: 'top'}), group([box({title: 'pad'}), box({id: 'B', title: 'B', body})], {title: 'R'})], {cols: [6, 6]}), connect('A:right', 'B:left', {via: 'group'}));
  const A = boxOf(l, 'A'), B = boxOf(l, 'B'), c = l.connects[0]!;
  assert.ok(A.y + A.h / 2 < B.y + 12 && B.y + B.h / 2 > A.y + A.h - 12, 'neither middle is well inside the other box');
  assert.equal(c.from.y, c.to.y, 'level');
  const lo = Math.max(A.y, B.y) + 12, hi = Math.min(A.y + A.h, B.y + B.h) - 12;
  assert.ok(Math.abs(c.from.y - (lo + hi) / 2) < 0.01, `the middle of the overlap (${c.from.y} vs ${(lo + hi) / 2})`);
  assert.equal(c.from.x, frameOf(l, 'L').x + frameOf(l, 'L').w);
  assert.equal(c.to.x, frameOf(l, 'R').x);
});

test('via: an elbow whose leg at the frame would run along its edge is refused; one that leaves the same way is fine', async () => {
  const fig = (c: Band) => render(row([box({id: 'a', title: 'A'}), box({title: 'spacer'}), box({title: 's2'})]), row([group([box({title: 'x'})], {frame: false}), group([box({id: 'c', title: 'C'})], {title: 'G'})], {cols: [4, 8]}), c);
  await assert.rejects(fig(connect('a:right', 'c:top', {via: {to: 'group'}, route: 'elbow'})), /the elbow runs along the top edge of the frame at "c:top"/);
  const ok = await fig(connect('a:bottom', 'c:top', {via: {to: 'group'}, route: 'elbow'}));
  const c = ok.connects[0]!, last = c.points[c.points.length - 2]!;
  assert.equal(c.to.y, frameOf(ok, 'G').y);
  assert.equal(last.x, c.to.x, 'the last leg comes down onto the edge');
});

test('via: \'group\' on an end that is a group inside an outer frame stops on the outer frame; {to} on it is the group-id error', async () => {
  const inner = group([box({title: 'i'})], {title: '内', id: 'G'});
  const fig = (c: Band) => render(row([memo(), group([inner, box({title: 'o'})], {title: '外'})], {cols: [6, 6]}), c);
  const l = await fig(connect('memo:right', 'G:left', {via: 'group'}));
  assert.equal(l.connects[0]!.to.x, frameOf(l, '外').x);
  assert.deepEqual(l.connects[0]!.toVia, {x: frameOf(l, '外').x, y: frameOf(l, '外').y, w: frameOf(l, '外').w, h: frameOf(l, '外').h});
  await assert.rejects(fig(connect('memo:right', 'G:left', {via: {to: 'group'}})), /"G" is a group, so "G:left" already ends on its frame/);
});

test('via: the shape is checked; branch() adds a target\'s via to the shared one', () => {
  assert.throws(() => connect('a:right', 'b:left', {via: {from: undefined}} as never), /via is 'group', \{from: 'group'\} or \{to: 'group'\}/);
  assert.throws(() => connect('a:right', 'b:left', {via: {}} as never), /via is 'group'/);
  const [both, shared, own, all] = branch('m:right', [{to: 'c1:left', via: {to: 'group'}}, {to: 'c2:left'}, {to: 'c3:left', via: {to: 'group'}}, {to: 'c4:left', via: 'group'}], {via: {from: 'group'}}) as ConnectBand[];
  assert.deepEqual(both!.via, {from: 'group', to: 'group'});
  assert.deepEqual(shared!.via, {from: 'group'});
  assert.deepEqual(own!.via, {from: 'group', to: 'group'});
  assert.equal(all!.via, 'group');
  assert.deepEqual((branch('m:right', [{to: 'c1:left', via: {to: 'group'}}]) as ConnectBand[])[0]!.via, {to: 'group'});
});

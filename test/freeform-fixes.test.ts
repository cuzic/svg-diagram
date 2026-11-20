// node --test test/   — small fixes to drawing with box / group / row / connect (freeform figures): a span / col on a row without
// cols is refused, a frameless group honours valign, and a side-to-side connector between boxes of different heights is level.
import test from 'node:test';
import assert from 'node:assert/strict';
import {box, branch, connect, diagram, group, row, renderDiagram, spacer} from '../lib/dsl.ts';
import type {LaidOutBox} from '../lib/types/text-bands.ts';
import type {LaidOutGroup} from '../lib/types/containers.ts';
import type {Band} from '../lib/types/index.ts';

const render = async (...bands: Band[]) => (await renderDiagram(diagram({theme: 'blue', title: 't'}).add(...bands), {name: 'x.svg', budget: 'cacheOnly'})).laidOut;
const boxOf = (l: Awaited<ReturnType<typeof render>>, id: string) => l.laidOut.find(b => b.type === 'box' && b.id === id) as LaidOutBox;
const frameOf = (l: Awaited<ReturnType<typeof render>>, id: string) => l.laidOut.find(b => b.type === 'group' && b.id === id) as LaidOutGroup;
const tall = () => group(['a', 'b', 'c', 'd'].map(id => box({title: id, id})), {title: 'L', id: 'L'});

test('row(): a span / col on a child needs cols on the row (it was dropped silently)', () => {
  assert.throws(() => row([box({title: 'a', span: 4}), box({title: 'b', col: 9})]), /child 0 has span: 4, but the row has no cols/);
  assert.throws(() => row([box({title: 'a'}), group([box({title: 'b'})], {col: 9, span: 4})]), /child 1 has span: 4, col: 9/);
  assert.doesNotThrow(() => row([box({title: 'a', span: 4}), box({title: 'b', col: 9})], {cols: 12}));
  assert.doesNotThrow(() => row([box({title: 'a', flex: 2}), box({title: 'b'})]));
});

test('a frameless group stays at the top of a taller row by default, and moves with valign', async () => {
  const at = async (valign?: 'center' | 'stretch') => {
    const l = await render(row([tall(), group([box({title: 's', id: 's'})], {frame: false, id: 'G', ...(valign ? {valign} : {})})], {cols: [6, 6]}));
    return {s: boxOf(l, 's'), L: frameOf(l, 'L'), G: frameOf(l, 'G')};
  };
  const top = await at();
  assert.equal(top.s.y, top.G.y, 'no valign: the box stays at the top (as before)');
  const mid = await at('center');
  const above = mid.s.y - mid.L.y, below = mid.L.y + mid.L.h - (mid.s.y + mid.s.h);
  assert.ok(above > 16 && Math.abs(above - below) <= 8, `centred: ${above} above, ${below} below`);
  const st = await at('stretch');
  assert.ok(st.s.h > top.s.h * 2, 'stretch: the single box fills the room');
});

test('connect(a.right, b.left) between boxes of different heights is level when their heights overlap', async () => {
  const fig = (c: Band) => render(row([tall(), group([box({title: 's', id: 's'})], {frame: false})], {cols: [6, 6]}), c);
  const level = await fig(connect('L:right', 's:left'));
  const c = level.connects[0]!, s = boxOf(level, 's');
  assert.equal(c.from.y, c.to.y, 'level');
  assert.ok(Math.abs(c.to.y - (s.y + s.h / 2)) <= 1, 'at the middle of the overlap (the short box)');
  const elbow = (await fig(connect('L:right', 's:left', {route: 'elbow'}))).connects[0]!;
  assert.equal(new Set(elbow.points.map(p => p.y)).size, 1, 'an elbow with nothing to bend is one level line');
  const placed = (await fig(connect('L:right@0.5', 's:left'))).connects[0]!;
  assert.notEqual(placed.from.y, placed.to.y, 'an end placed with @ stays where it was put');
});

test('branch(): every arrow of a fan leaves the same point of the source; only the target ends move', async () => {
  const fan = group(['c1', 'c2', 'c3'].map(id => box({title: id, id})), {title: 'R'});
  const l = await render(row([group([box({title: 'memo', id: 'memo'})], {frame: false, valign: 'center', span: 4}), group([], {frame: false, span: 4}), fan], {cols: 12}),
    ...branch('memo:right', [{to: 'c1:left'}, {to: 'c2:left'}, {to: 'c3:left'}]));
  const starts = new Set(l.connects.map(c => c.from.y)), m = boxOf(l, 'memo');
  assert.deepEqual([...starts], [m.y + m.h / 2], 'one start, at the middle of the source side');
  const c2 = boxOf(l, 'c2'), mid = l.connects[1]!;
  if (m.y + m.h / 2 >= c2.y + 12 && m.y + m.h / 2 <= c2.y + c2.h - 12) assert.equal(mid.to.y, mid.from.y, 'the middle branch is level');
});

test('connect(a.right, b.left): an overlap too thin to clear the rounded corners keeps the slanted line', async () => {
  const l = await render(row([group([box({title: 'a', body: 'x\ny\nz', id: 'a'})], {frame: false}), group([spacer(100), box({title: 'b', body: 'x\ny\nz', id: 'b'})], {frame: false})], {cols: [6, 6]}), connect('a:right', 'b:left'));
  const c = l.connects[0]!, a = boxOf(l, 'a'), b = boxOf(l, 'b');
  const overlap = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  assert.ok(overlap > 0 && overlap < 24, `the boxes overlap by ${overlap}px`);
  assert.notEqual(c.from.y, c.to.y, 'no level line hugging the corners');
});

test('connect(a.right, b.left): boxes whose heights do not overlap keep the slanted line', async () => {
  const l = await render(row([box({title: 'a', id: 'a'}), box({title: 'b', id: 'b'})]), row([box({title: 'c', id: 'c'}), box({title: 'd', id: 'd'})]), connect('a:right', 'd:left'));
  const c = l.connects[0]!;
  assert.ok(c.to.y > c.from.y + 8);
});

test('branch(): the fan survives diagram({connectDefaults}), which rebuilds the arrows', async () => {
  const fan = group(['c1', 'c2', 'c3'].map(id => box({title: id, id})), {title: 'R'});
  const d = diagram({theme: 'blue', title: 't', connectDefaults: {line: 'dashed'}}).add(
    row([group([box({title: 'memo', id: 'memo'})], {frame: false, valign: 'center', span: 4}), group([], {frame: false, span: 4}), fan], {cols: 12}),
    ...(branch('memo:right', [{to: 'c1:left'}, {to: 'c2:left'}, {to: 'c3:left'}]) as Band[]));
  const {connects} = (await renderDiagram(d, {name: 'x.svg', budget: 'cacheOnly'})).laidOut;
  assert.equal(new Set(connects.map(c => c.from.y)).size, 1);
  assert.ok(connects.every(c => c.line === 'dashed'));
});

test('connect(a.right, b.left): a short box beside a tall one is entered at its own middle', async () => {
  const l = await render(row([tall(), group([box({title: 's', id: 's'})], {frame: false, valign: 'center'})], {cols: [6, 6]}), connect('L:right', 's:left'));
  const c = l.connects[0]!, s = boxOf(l, 's');
  assert.equal(c.from.y, c.to.y);
  assert.equal(c.to.y, s.y + s.h / 2, 'the line runs at the short box\'s middle, not the tall one\'s');
});

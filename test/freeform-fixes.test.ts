// node --test test/   — small fixes to drawing with box / group / row / connect (freeform figures): a span / col on a row without
// cols is refused, a frameless group honours valign, and a side-to-side connector between boxes of different heights is level.
import test from 'node:test';
import assert from 'node:assert/strict';
import {box, connect, diagram, group, row, renderDiagram} from '../lib/dsl.ts';
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

test('connect(a.right, b.left): boxes whose heights do not overlap keep the slanted line', async () => {
  const l = await render(row([box({title: 'a', id: 'a'}), box({title: 'b', id: 'b'})]), row([box({title: 'c', id: 'c'}), box({title: 'd', id: 'd'})]), connect('a:right', 'd:left'));
  const c = l.connects[0]!;
  assert.ok(c.to.y > c.from.y + 8);
});

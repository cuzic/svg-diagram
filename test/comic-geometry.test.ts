import {test} from 'node:test';
import assert from 'node:assert/strict';
import {comicGeometry} from '../lib/comic/geometry.ts';
import {box, comic, connect, diagram, renderInBrowser} from '../lib/web.ts';
import type {ComicWorksheet} from '../lib/types/comic.ts';
import {lay, measure} from './helpers/comic-values.ts';
import {SAMPLE} from './helpers/comic-sample.ts';

const rect = ({x, y, w, h}: {x: number; y: number; w: number; h: number}) => ({x, y, w, h});

test('comic geometry maps exact panel, bubble, slot and head coordinates', () => {
  const laid = lay();
  const g = comicGeometry(laid);
  assert.deepEqual(g.panels['p1'], rect(laid.panels[0]!));
  assert.deepEqual(g.bubbles['p2.d1'], rect(laid.bubbles[1]!));
  assert.deepEqual(g.slots['day'], rect(laid.bubbles[0]!.slots[0]!));
  const {cx, cy, r, mouth} = laid.panels[0]!.heads[0]!;
  assert.deepEqual(g.heads['p1.me'], {x: cx - r, y: cy - r, w: 2 * r, h: 2 * r});
  assert.deepEqual(g.points['p1.me'], {head: [cx, cy, 36], mouth});
});

test('every geometry key follows the anchor scope grammar', async () => {
  const figure = diagram({theme: 'blue', width: 500}).add(comic(SAMPLE, {scope: 'c'}));
  const {laidOut} = await renderInBrowser(figure, {measure});
  const scoped = comicGeometry(laidOut.laidOut.find(b => b.type === 'comic')!);
  for (const record of Object.values(scoped)) assert.ok(Object.keys(record).every(k => k.startsWith('c.')));
  assert.ok(scoped.panels['c.p1']);
  assert.ok(scoped.bubbles['c.p1.d1']);
  assert.ok(scoped.slots['c.day']);
  assert.ok(scoped.heads['c.p1.me']);
  assert.ok(scoped.points['c.p1.me']);
});

test('a map with twelve holes fits in 4 KiB', () => {
  const sheet: ComicWorksheet = {...SAMPLE, panels: SAMPLE.panels.map(p => ({...p, dialogue: [{
    id: 'd1', who: 'me', kind: 'say', tpl: `{${p.id}a}と{${p.id}b}と{${p.id}c}`,
    slots: Object.fromEntries(['a', 'b', 'c'].map(s => [p.id + s, {max: 2, prompt: 'こと'}])),
  }]}))};
  const g = comicGeometry(lay(sheet));
  assert.equal(Object.keys(g.slots).length, 12);
  assert.ok(JSON.stringify(g).length < 4096);
});

test('a comic slot is an anchor and colliding anchors are rejected', async () => {
  const doc = () => diagram({theme: 'blue', width: 500, legend: false});
  const drawn = await renderInBrowser(doc().add(box({id: 'note', title: '注記'}), comic(SAMPLE), connect('note:bottom', 'day:top')), {measure});
  assert.equal(drawn.laidOut.connects.length, 1);
  const duplicate = box({id: 'day', title: '注記'});
  await assert.rejects(renderInBrowser(doc().add(duplicate, comic(SAMPLE)), {measure}), /another anchor already has/);
  await assert.rejects(renderInBrowser(doc().add(comic(SAMPLE), duplicate), {measure}), /duplicate anchor id "day"/);
});

test('comic data-node names the visible panel frame, bubble outline and slot group on request', async () => {
  const scope = 'c&"';
  const doc = (s?: string) => diagram({theme: 'blue', width: 500}).add(comic(SAMPLE, s ? {scope: s} : {}));
  for (const [s, prefix] of [[undefined, ''], [scope, 'c&amp;&quot;.']] as const) {
    const {svg} = await renderInBrowser(doc(s), {measure, nodeIds: true});
    for (const [tag, id] of [['rect', 'p1'], ['path', 'p1.d1'], ['g', 'day']] as const) {
      assert.equal(svg.split(`data-node="${prefix}${id}"`).length, 2);
      assert.ok(svg.match(new RegExp(`<${tag} [^>]*data-node="${prefix}${id}"`)), id);
    }
    assert.doesNotMatch((await renderInBrowser(doc(s), {measure})).svg, /data-node=/);
  }
});

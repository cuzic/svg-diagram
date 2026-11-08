import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/strict-width.ts'; // a label the layout did not register for measuring throws instead of measuring 0 wide
import {checkDiagram, closeMeasurer, diagram, mindmap, renderDiagram, tree} from '../lib/dsl.ts';
import {PALETTE, colorOf} from '../lib/tokens.ts';
import type {LaidOutTree, TreeItem} from '../lib/types/diagrams.ts';

test.after(() => closeMeasurer());

const topic = (): TreeItem => ({
  label: '研修', id: 'root',
  children: [
    {label: 'なぜ', id: 'why', children: [{label: '詰まっているのは決定', id: 'why1'}]},
    {label: '6つの条件', id: 'dq', children: [{label: '問い', id: 'q'}, {label: '選択肢', id: 'opt', children: [{label: 'A 案', id: 'a'}]}, {label: '情報', id: 'info'}]},
    {label: '渡し方', id: 'hand', tone: 'danger', children: [{label: '一度で渡す', id: 'hand1'}]},
  ],
});

const laid = async (band: ReturnType<typeof mindmap>) => {
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue'}).add(band));
  const t = laidOut.laidOut.find(b => b.type === 'tree') as LaidOutTree;
  return {t, verdict, tone: (id: string) => t.nodes.find(n => n.id === id)?.tone};
};

test('mindmap focus: the focused node is solid, its branch and the path to the root accent, the rest muted', async () => {
  const {verdict, tone} = await laid(mindmap(topic(), {focus: 'opt'}));
  assert.equal(verdict.ok, true, verdict.problems?.join('\n'));
  assert.equal(tone('opt'), 'solid');
  assert.equal(tone('a'), 'accent', 'under the focused node');
  assert.equal(tone('dq'), 'accent', 'on the path to the root');
  assert.equal(tone('root'), 'accent');
  for (const id of ['why', 'why1', 'q', 'info', 'hand1']) assert.equal(tone(id), 'muted', id);
  assert.equal(tone('hand'), 'muted', 'a tone written on a node is replaced by focus');
});

test('focus takes several ids, and works on tree() too', async () => {
  const {tone} = await laid(mindmap(topic(), {focus: ['q', 'hand']}));
  assert.equal(tone('q'), 'solid');
  assert.equal(tone('hand'), 'solid');
  assert.equal(tone('hand1'), 'accent');
  assert.equal(tone('opt'), 'muted');
  const {laidOut} = await checkDiagram(diagram({theme: 'blue'}).add(tree(topic(), {focus: 'why1'})));
  const t = laidOut.laidOut.find(b => b.type === 'tree') as LaidOutTree;
  assert.equal(t.nodes.find(n => n.id === 'why1')?.tone, 'solid');
  assert.equal(t.nodes.find(n => n.id === 'why')?.tone, 'accent');
});

test('focus: the lines to the lit nodes are lit, the others not', async () => {
  const {t} = await laid(mindmap(topic(), {focus: 'opt'}));
  // lit: root→dq, dq→opt, opt→a
  assert.equal(t.edges.filter(e => e.lit).length, 3);
  assert.ok(t.edges.some(e => !e.lit));
  const {t: plain} = await laid(mindmap(topic()));
  assert.equal(plain.edges.filter(e => e.lit).length, 0, 'no focus: no line is lit');
});

test('focus: drawn in the accent colour, with white text on the filled node', async () => {
  const {svg} = await renderDiagram(diagram({theme: 'blue'}).add(mindmap(topic(), {focus: 'opt'})), {name: 'f.svg', budget: 'cacheOnly'});
  const accent = colorOf('accent', 'blue');
  assert.match(svg, new RegExp(`<path d="[^"]*" fill="none" stroke="${accent}"`), 'a lit line');
  assert.match(svg, new RegExp(`<text [^>]*fill="${PALETTE.bg}">選択肢</text>`), 'white text on the solid node');
});

test('focus: an unknown id, an empty list or a non-string throws, naming the ids', () => {
  assert.throws(() => mindmap(topic(), {focus: 'nope'}), /focus "nope" is not the id of an item \(the ids: root, why, why1, dq, q, opt, a, info, hand, hand1\)/);
  assert.throws(() => tree({label: 'x', children: [{label: 'y'}]}, {focus: 'y'}), /no item has an id/);
  assert.throws(() => mindmap(topic(), {focus: []}), /focus is the id of an item/);
  assert.throws(() => mindmap(topic(), {focus: [3 as never]}), /focus is the id of an item/);
});

test('focus does not change the tree it was given', () => {
  const root = topic();
  const before = JSON.stringify(root);
  mindmap(root, {focus: 'opt'});
  assert.equal(JSON.stringify(root), before);
});

test('a tree node takes solid / solid-danger directly (white text), and still refuses an unknown tone', async () => {
  const {svg} = await renderDiagram(diagram({theme: 'blue'}).add(mindmap({label: '中心', children: [{label: '主役', tone: 'solid'}, {label: '失敗', tone: 'solid-danger'}]})), {name: 's.svg', budget: 'cacheOnly'});
  assert.match(svg, new RegExp(`fill="${PALETTE.bg}">主役</text>`));
  assert.match(svg, new RegExp(`fill="${PALETTE.bg}">失敗</text>`));
  assert.throws(() => tree({label: 'x', tone: 'loud' as never}), /tree\(\): "x" has tone loud \(use plain, accent/);
});

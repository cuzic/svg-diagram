import test from 'node:test';
import assert from 'node:assert/strict';
import {mindmap, tree} from '../lib/dsl.ts';
import {layoutTreeBand} from '../lib/tree.ts';
import type {LaidOutTree, TreeBand, TreeItem} from '../lib/types/diagrams.ts';

// ADR 0010 U3: tree / mindmap fit the width. Font-free: a fixed text width, and widths taken from the figure itself.
const fixedW = (t: string, size: number): number => t.length * size * 0.6;
const ROLES = {body: 14, note: 12} as never;
const laid = (b: TreeBand, w: number, h?: number): LaidOutTree => layoutTreeBand(b, 0, 0, w, fixedW as never, ROLES, h);
const spread = (t: LaidOutTree): number => Math.max(...t.nodes.map(n => n.x + n.w)) - Math.min(...t.nodes.map(n => n.x));

// one root with nine children: wide growing down, a column growing right
const kids: TreeItem[] = Array.from({length: 9}, (_, i) => ({label: `部署の名前が長い${i}`}));
const org = (opts: object = {}): TreeBand => tree({label: '社長', children: kids}, opts) as TreeBand;
// narrower than a row of the nine even at the narrowest nodes: only turning right can fit
const tooWide = (): number => spread(laid(org({dir: 'down', maxNodeW: 110}), 9000)) - 1;

test('tree() too wide with dir left out: it turns right, and what changed is recorded', () => {
  const w = tooWide(), t = laid(org(), w);
  assert.ok(spread(t) <= w + 0.5);
  assert.ok(t.fitApplied?.some(a => a.what === 'dir' && a.from === 'down' && a.to === 'right' && a.mode === 'omitted'));
  assert.ok(t.fitApplied![0].wasW! > w && t.fitApplied![0].nowW! <= w);
});

test("tree() dir: 'auto' is recorded as auto; written down is not changed and says so", () => {
  const w = tooWide();
  assert.ok(laid(org({dir: 'auto'}), w).fitApplied?.every(a => a.mode === 'auto'));
  assert.throws(() => laid(org({dir: 'down'}), w), (e: Error) => /^tree\(\): the figure does not fit/.test(e.message) && /dir 'down', maxNodeW 200 \(as written\)/.test(e.message) && /not tried: dir 'right' and narrower nodes \(dir is explicit/.test(e.message) && /fix: dir: 'auto'/.test(e.message));
});

test('tree() that fits: nothing recorded, and left out, auto and written down lay out the same', () => {
  const w = spread(laid(org(), 9000)) + 40;
  const same = JSON.stringify(laid(org({dir: 'down'}), w));
  assert.equal(laid(org(), w).fitApplied, undefined);
  assert.equal(JSON.stringify(laid(org(), w)), same);
  assert.equal(JSON.stringify(laid(org({dir: 'auto'}), w)), same);
});

test('tree() with maxNodeW written is not narrowed, the direction may turn', () => {
  const t = laid(org({maxNodeW: 200}), tooWide());
  assert.ok(t.fitApplied?.every(a => a.what === 'dir'));
});

test("tree() dir: 'auto' leaves out a turn taller than the height budget", () => {
  const w = tooWide(), free = laid(org({dir: 'auto'}), w);
  assert.throws(() => laid(org({dir: 'auto'}), w, free.h - 10), /does not fit/);
});

test('mindmap() keeps its layout: nodes are narrowed when left out, and a layout that cannot fit is told to use list', () => {
  const long: TreeItem[] = Array.from({length: 9}, (_, i) => ({label: `部署の名前がとても長くて折り返される${i}`}));
  const m = (opts: object = {}) => mindmap({label: '中心', children: long}, opts) as TreeBand;
  const wide = spread(laid(m({layout: 'org'}), 9000));
  const narrowest = spread(laid(m({layout: 'org', maxNodeW: 110}), 9000));
  assert.ok(narrowest < wide);
  const t = laid(m({layout: 'org'}), Math.floor((wide + narrowest) / 2));
  assert.ok(t.fitApplied?.length && t.fitApplied.every(a => a.what === 'maxNodeW'));
  assert.throws(() => laid(m({layout: 'org'}), narrowest - 1), (e: Error) => /^mindmap\(\)/.test(e.message) && /maxNodeW 110/.test(e.message) && /fix: write layout: 'list', 'right' or 'left'/.test(e.message) && !/dir '/.test(e.message));
  assert.throws(() => laid(m({layout: 'org', maxNodeW: 200}), narrowest - 1), /maxNodeW is explicit/);
});

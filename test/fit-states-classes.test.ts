import test from 'node:test';
import assert from 'node:assert/strict';
import {classDiagram, stateDiagram, arrowDiagram} from '../lib/dsl.ts';
import {layoutStatesBand} from '../lib/states.ts';
import {layoutClassesBand} from '../lib/classes.ts';
import type {ClassesBand, LaidOutClasses, LaidOutStates, StatesBand} from '../lib/types/diagrams.ts';

// ADR 0010 U2: stateDiagram / classDiagram fit the width. Font-free: a fixed text width, and widths taken from the figure itself.
const fixedW = (t: string, size: number): number => t.length * size * 0.6;
const ROLES = {body: 14, note: 12} as never;
const states = (b: StatesBand, w: number, h?: number): LaidOutStates => layoutStatesBand(b, 0, 0, w, fixedW as never, ROLES, {wrap: 'phrase', keepWords: false}, h);
const classes = (b: ClassesBand, w: number, h?: number): LaidOutClasses => layoutClassesBand(b, 0, 0, w, fixedW as never, ROLES, {wrap: 'phrase', keepWords: false}, h);
const spread = (t: {nodes: {x: number; w: number}[]}): number => Math.max(...t.nodes.map(n => n.x + n.w)) - Math.min(...t.nodes.map(n => n.x));

// ---- stateDiagram: a long chain is wide running right, narrow running down
const chain = Array.from({length: 9}, (_, i) => ({id: `s${i}`, label: `状態の名前が長い${i}`}));
const flow = (opts: object = {}): StatesBand => stateDiagram(chain, chain.slice(1).map((s, i) => ({from: chain[i]!.id, to: s.id})), opts) as StatesBand;
// narrower than the chain running right even with the narrowest nodes: only turning down can fit
const tooWide = (): number => spread(states(flow({dir: 'right', maxNodeW: 110}), 9000)) - 1;

test('stateDiagram() too wide with dir left out: it turns down, and what changed is recorded', () => {
  const w = tooWide(), t = states(flow(), w);
  assert.ok(spread(t) <= w + 0.5);
  assert.ok(t.fitApplied?.some(a => a.what === 'dir' && a.from === 'right' && a.to === 'down' && a.mode === 'omitted'));
  assert.ok(t.fitApplied![0]!.wasW! > w && t.fitApplied![0]!.nowW! <= w);
  const by = (id: string) => t.anchors.find(a => a.id === id)!;
  assert.ok(by('s1').y > by('s0').y, 'the flow runs down');
});

test("stateDiagram() dir: 'auto' is recorded as auto", () => {
  const t = states(flow({dir: 'auto'}), tooWide());
  assert.ok(t.fitApplied?.length && t.fitApplied.every(a => a.mode === 'auto'));
});

test('stateDiagram() that fits: nothing recorded, and left out, auto and written right lay out the same', () => {
  const w = spread(states(flow(), 9000)) + 40;
  const same = JSON.stringify(states(flow({dir: 'right'}), w));
  assert.equal(states(flow(), w).fitApplied, undefined);
  assert.equal(JSON.stringify(states(flow(), w)), same);
  assert.equal(JSON.stringify(states(flow({dir: 'auto'}), w)), same);
});

test("stateDiagram() with dir: 'right' written is not changed: tried / not tried / one fix", () => {
  assert.throws(() => states(flow({dir: 'right'}), tooWide()), (e: Error) => /does not fit/.test(e.message) && /dir 'right', maxNodeW 200 \(as written\)/.test(e.message) && /not tried: dir 'down' and narrower nodes \(dir is explicit/.test(e.message) && e.message.split('\n').filter(l => l.startsWith('  fix:')).length === 1 && /fix: dir: 'auto'/.test(e.message));
});

test('stateDiagram() with maxNodeW written: not narrowed, but the direction may still turn', () => {
  const w = tooWide();
  const t = states(flow({maxNodeW: 200}), w);
  assert.ok(t.fitApplied?.every(a => a.what === 'dir'));
  assert.throws(() => states(flow({maxNodeW: 200}), 100), /maxNodeW is explicit/);
});

test("stateDiagram() dir: 'auto' leaves out a turn taller than the height budget", () => {
  const w = tooWide(), free = states(flow({dir: 'auto'}), w);
  assert.throws(() => states(flow({dir: 'auto'}), w, free.h - 10), /does not fit/);
});

test('arrowDiagram() with dir left out is free to turn down; written right is not', () => {
  const acts = chain.slice(1).map((_, i) => ({from: i + 1, to: i + 2, name: `作業の名前が長い${i}`, days: 3}));
  const wide = (opts: object) => arrowDiagram(acts, {...opts, summary: false})[0] as StatesBand;
  const w = spread(states(wide({dir: 'right', maxNodeW: 110}), 9000)) - 1;
  assert.ok(states(wide({}), w).fitApplied?.some(a => a.to === 'down'));
  assert.throws(() => states(wide({dir: 'right'}), w), /dir is explicit/);
});

// ---- classDiagram: one parent with many children is wide running down, narrow running right
const kids = Array.from({length: 9}, (_, i) => ({id: `k${i}`, name: `子のクラス名${i}`, attrs: ['name: string']}));
const family = (opts: object = {}): ClassesBand => classDiagram([{id: 'p', name: '親', attrs: ['id: number']}, ...kids], kids.map(k => ({from: k.id, to: 'p', kind: 'inherit' as const})), opts) as ClassesBand;
const tooWideC = (): number => spread(classes(family({dir: 'down'}), 9000)) - 1;

test('classDiagram() too wide with dir left out: it turns right, and what changed is recorded', () => {
  const w = tooWideC(), t = classes(family(), w);
  assert.ok(spread(t) <= w + 0.5);
  assert.ok(t.fitApplied?.some(a => a.what === 'dir' && a.from === 'down' && a.to === 'right' && a.mode === 'omitted'));
  assert.deepEqual(t.fitApplied?.map(a => a.what), ['dir'], 'no node width to narrow in a class diagram');
});

test("classDiagram() dir: 'auto' is recorded as auto; written down is not changed and says so", () => {
  const w = tooWideC();
  assert.ok(classes(family({dir: 'auto'}), w).fitApplied?.every(a => a.mode === 'auto'));
  assert.throws(() => classes(family({dir: 'down'}), w), (e: Error) => /dir 'down' \(as written\)/.test(e.message) && /not tried: dir 'right' \(dir is explicit/.test(e.message) && /fix: dir: 'auto'/.test(e.message));
});

test('classDiagram() that fits: nothing recorded, and left out, auto and written down lay out the same', () => {
  const w = spread(classes(family(), 9000)) + 40;
  const same = JSON.stringify(classes(family({dir: 'down'}), w));
  assert.equal(classes(family(), w).fitApplied, undefined);
  assert.equal(JSON.stringify(classes(family(), w)), same);
  assert.equal(JSON.stringify(classes(family({dir: 'auto'}), w)), same);
});

test("classDiagram() dir: 'auto' leaves out a turn taller than the height budget", () => {
  const w = tooWideC(), free = classes(family({dir: 'auto'}), w);
  assert.throws(() => classes(family({dir: 'auto'}), w, free.h - 10), /does not fit/);
});

test('the error names every direction tried, with widths, when neither fits', () => {
  assert.throws(() => classes(family(), 60), (e: Error) => /dir 'down'.*px wide/.test(e.message) && /dir 'right'.*px wide/.test(e.message));
});

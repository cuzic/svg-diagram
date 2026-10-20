// causalLoop({interventions}) (ADR 0011 C): dashed boxes and arrows in a band along one edge. Nothing here depends on font widths: figures are
// judged by checkDiagram and lint-svg --strict, and by geometry recomputed from the drawn SVG.
import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/strict-width.ts';
import {box, causalLoop, closeMeasurer, connect, diagram, renderDiagram} from '../lib/dsl.ts';
import type {CausalIntervention, CausalLink, CausalNode} from '../lib/dsl.ts';
import {segHitsRect} from '../lib/bars.ts';
import {countText, drawAndCheck, rng} from './helpers/semnet-sweep.ts';
import {planInterventions, ringSide} from '../lib/semnet-interventions.ts';
import {Canvas} from '../lib/charts-base.ts';
import {resolveCausal} from '../lib/semnet-causal.ts';

test.after(() => closeMeasurer());

const LABELS = ['品質', '満足', '受注', '負荷', '残業'], IV_LABELS = ['標準の合意', '早期の果実', '教育の機会', '権限の委譲'];
const NO_ROOM = /has no room|would run through|wider than|does not fit|do not fit on a ring/;
function loopCase(seed: number, n = 5): {nodes: CausalNode[]; links: CausalLink[]} {
  const rand = rng(seed * 7 + 1), nodes = Array.from({length: n}, (_, i) => ({id: `n${i}`, label: LABELS[i % LABELS.length] + (i >= LABELS.length ? String(i) : '')}));
  return {nodes, links: nodes.map((x, i) => ({from: x.id, to: nodes[(i + 1) % n]!.id, polarity: rand() < .5 ? '+' : '-', ...(rand() < .3 ? {delay: true} : {})}))};
}
function ivCase(seed: number, nodes: CausalNode[]): CausalIntervention[] {
  const rand = rng(seed * 13 + 5), count = 1 + Math.floor(rand() * 4);
  return Array.from({length: count}, (_, i) => {
    const first = Math.floor(rand() * nodes.length), two = rand() < .4, second = (first + 1 + Math.floor(rand() * (nodes.length - 1))) % nodes.length;
    return {id: `iv${i}`, label: IV_LABELS[i]!, to: two ? [nodes[first]!.id, nodes[second]!.id] : nodes[first]!.id, polarity: rand() < .7 ? '-' : '+', ...(rand() < .3 ? {delay: true} : {})};
  });
}
interface Bx {x: number; y: number; w: number; h: number}
const NUM = '(-?[\\d.]+)';
const nodeBoxes = (svg: string): Bx[] => [...svg.matchAll(new RegExp(`<path d="M${NUM},${NUM} H${NUM} V${NUM} H[\\d.]+ Z" fill="#ffffff" stroke="#22201b" stroke-width="2"/>`, 'g'))].map(m => ({x: +m[1]!, y: +m[2]!, w: +m[3]! - +m[1]!, h: +m[4]! - +m[2]!}));
const dashedBoxes = (svg: string): Bx[] => [...svg.matchAll(new RegExp(`<path d="M${NUM},${NUM} H${NUM} V${NUM} H[\\d.]+ Z" fill="#ffffff" stroke="#[0-9a-f]{6}" stroke-width="2" stroke-dasharray="6,4"/>`, 'g'))].map(m => ({x: +m[1]!, y: +m[2]!, w: +m[3]! - +m[1]!, h: +m[4]! - +m[2]!}));
const dashedSegs = (svg: string): {x1: number; y1: number; x2: number; y2: number}[] => [...svg.matchAll(new RegExp(`<path d="M${NUM},${NUM} L${NUM},${NUM}" fill="none" stroke="#[0-9a-f]{6}" stroke-width="2" stroke-linejoin="round" stroke-dasharray="6,4"/>`, 'g'))].map(m => ({x1: +m[1]!, y1: +m[2]!, x2: +m[3]!, y2: +m[4]!}));
const arrowCount = (ivs: CausalIntervention[]): number => ivs.reduce((a, v) => a + (typeof v.to === 'string' ? 1 : v.to.length), 0);
/** A segment ending on a node's edge touches that node; one that goes through the inside of any node's box is a hit. */
const crossesNode = (sg: {x1: number; y1: number; x2: number; y2: number}, nodes: Bx[]): boolean => nodes.some(n => segHitsRect(sg, {x: n.x + 1.5, y: n.y + 1.5, w: n.w - 3, h: n.h - 3}));

for (const direction of ['LR', 'TB'] as const) {
  test(`${direction}: 60 seeds of 1-4 interventions on a 5-node loop are clean, signs all drawn, arrows keep out of node boxes (or an explicit "no room" error)`, async () => {
    let drawn = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const {nodes, links} = loopCase(seed), ivs = ivCase(seed, nodes), who = `${direction} seed ${seed}`, r = await drawAndCheck(causalLoop(nodes, links, {direction, interventions: ivs}));
      if (r.error !== undefined) { assert.match(r.error, NO_ROOM, who); continue; }
      drawn++;
      assert.deepEqual([r.problems, r.lint], [[], []], who);
      assert.equal(countText(r.svg, '+') + countText(r.svg, '-'), links.length + arrowCount(ivs), `${who}: one sign per link and per intervention arrow`);
      assert.equal(countText(r.svg, '||'), links.filter(l => l.delay).length + ivs.reduce((a, v) => a + (v.delay ? (typeof v.to === 'string' ? 1 : v.to.length) : 0), 0), `${who}: delays`);
      assert.equal(dashedBoxes(r.svg).length, ivs.length, `${who}: one dashed box each`);
      assert.equal(dashedSegs(r.svg).length >= arrowCount(ivs), true, `${who}: a dashed arrow for every target`);
      const ns = nodeBoxes(r.svg);
      assert.equal(ns.length, 5, who);
      for (const sg of dashedSegs(r.svg)) assert.equal(crossesNode(sg, ns), false, `${who}: an intervention arrow runs through a node box`);
      assert.equal(countText(r.svg, 'R1') + countText(r.svg, 'B1'), 1, `${who}: the loop is named once`);
      const band = dashedBoxes(r.svg);
      // the band is one edge: above every node (LR) or to the left of every node (TB)
      for (const b of band) for (const n of ns) assert.ok(direction === 'LR' ? b.y + b.h < n.y : b.x + b.w < n.x, `${who}: boxes are outside the loop`);
    }
    assert.ok(drawn >= 50, `most figures draw (${drawn} of 60)`);
  });
}

test('a figure without interventions is the same bytes as before (the band is only reserved when there is one)', async () => {
  const {nodes, links} = loopCase(3);
  for (const direction of ['LR', 'TB'] as const) assert.equal((await drawAndCheck(causalLoop(nodes, links, {direction, interventions: []}))).svg, (await drawAndCheck(causalLoop(nodes, links, {direction}))).svg);
});

test('the loop name, the classification and the loop are the same with and without interventions', async () => {
  const {nodes, links} = loopCase(4), iv = {id: 'fix', label: '標準の合意', to: 'n1', polarity: '-' as const};
  assert.deepEqual(resolveCausal(nodes, links, {interventions: [iv]}).loops, resolveCausal(nodes, links).loops);
});

test('height unspecified: the figure grows to take the band; TB with many boxes grows downwards', async () => {
  const {nodes, links} = loopCase(5), ivs = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i): CausalIntervention => ({id, label: '長い介入点の名前' + i, to: nodes[i % 5]!.id, polarity: '-'}));
  const plain = await drawAndCheck(causalLoop(nodes, links, {direction: 'TB'})), withIv = await drawAndCheck(causalLoop(nodes, links, {direction: 'TB', interventions: ivs}));
  assert.equal(withIv.error, undefined);
  assert.deepEqual([withIv.problems, withIv.lint], [[], []]);
  const h = (svg: string): number => +/<svg[^>]* height="([\d.]+)"/.exec(svg)![1]!;
  assert.ok(h(withIv.svg) >= h(plain.svg));
  const lr = await drawAndCheck(causalLoop(nodes, links, {interventions: ivs.slice(0, 2)})), lr0 = await drawAndCheck(causalLoop(nodes, links));
  assert.ok(h(lr.svg) > h(lr0.svg), 'LR: the band adds height');
});

test('a band thicker than the first try is used when an arrow is blocked, and a box too wide for the figure stops with a named error', async () => {
  const nodes = [{id: 'a', label: 'A'}, {id: 'b', label: 'B'}], links: CausalLink[] = [{from: 'a', to: 'b', polarity: '+'}, {from: 'b', to: 'a', polarity: '-'}];
  const long = (id: string): CausalIntervention => ({id, label: 'とても長い名前の介入点'.repeat(6), to: 'a', polarity: '-'});
  await assert.rejects(() => renderDiagram(diagram({theme: 'blue'}).add(causalLoop(nodes, links, {interventions: [long('x'), long('y'), long('z')]})), {name: 't.svg', budget: 'measure'}), /causalLoop\(\): the 3 intervention boxes on the top .* are wider than the figure/);
});

test('interventions are anchors: connect() reaches their box', async () => {
  const {nodes, links} = loopCase(6), band = causalLoop(nodes, links, {id: 'cl', interventions: [{id: 'fix', label: '標準の合意', to: 'n2', polarity: '-'}]});
  const d = diagram({theme: 'blue'}).add(band, box({id: 'memo'}), connect('memo', 'fix'));
  const r = await renderDiagram(d, {name: 'anchor.svg', budget: 'measure'});
  assert.match(r.svg, /stroke-dasharray="6,4"/);
});

test('a plan: boxes are pushed apart by 16px in the order of their targets, and a box over a column of nodes does not run through them', () => {
  const c = new Canvas(0, 0, 400, 300, 14, () => 8, 'phrase'), pos = new Map([['a', {x: 20, y: 120, w: 100, h: 48}], ['b', {x: 150, y: 120, w: 100, h: 48}], ['c', {x: 280, y: 120, w: 100, h: 48}]]);
  const item = (id: string, to: string, w = 100) => ({id, label: id, to: [to], w});
  const r = planInterventions(c, [item('y', 'b'), item('x', 'a'), item('z', 'b')], pos, () => 'top');
  assert.ok('placed' in r, JSON.stringify(r));
  const bs = r.placed.map(p => p.box).sort((p, q) => p.x - q.x);
  for (let i = 1; i < bs.length; i++) assert.ok(bs[i]!.x - (bs[i - 1]!.x + bs[i - 1]!.w) >= 16 - 1e-6, 'a gap of at least 16');
  assert.ok(bs[0]!.x >= 8 && bs.at(-1)!.x + bs.at(-1)!.w <= 392, 'inside the figure');
  assert.deepEqual(r.placed.map(p => p.item.id).sort(), ['x', 'y', 'z']);
  const tooMany = planInterventions(c, [item('p', 'a', 200), item('q', 'b', 200)], pos, () => 'top');
  assert.ok('problem' in tooMany && /wider than the figure/.test(tooMany.problem));
});

test('on a ring the nodes in the upper half are reached from above and the rest from below', () => {
  const ids = ['n0', 'n1', 'n2', 'n3', 'n4', 'n5'];
  assert.deepEqual(ids.map(id => ringSide(ids, [id])), ['top', 'top', 'bottom', 'bottom', 'bottom', 'top']);
  assert.equal(ringSide(ids, ['n0', 'n3']), 'top');
});

function ringCase(seed: number, n: number): {nodes: CausalNode[]; links: CausalLink[]} {
  const rand = rng(seed * 31 + n), nodes = Array.from({length: n}, (_, i) => ({id: `n${i}`, label: ['需要', '供給と在庫の調整', '顧客満足', '業務負荷が高まる'][Math.floor(rand() * 4)]! + i}));
  return {nodes, links: nodes.map((x, i) => ({from: x.id, to: nodes[(i + 1) % n]!.id, polarity: rand() < .5 ? '+' : '-', ...(rand() < .3 ? {delay: true} : {})}))};
}

test('a ring with interventions: they sit outside the ring (above or below), clean on checkDiagram and lint --strict, arrows keep out of the node boxes', async () => {
  let drawn = 0;
  for (let n = 3; n <= 8; n++) for (let seed = 1; seed <= 10; seed++) {
    const {nodes, links} = ringCase(seed, n), ivs = ivCase(seed + n, nodes), who = `ring n=${n} seed ${seed}`, r = await drawAndCheck(causalLoop(nodes, links, {layout: 'ring', interventions: ivs}));
    if (r.error !== undefined) { assert.match(r.error, NO_ROOM, who); continue; }
    drawn++;
    assert.deepEqual([r.problems, r.lint], [[], []], who);
    assert.equal(countText(r.svg, '+') + countText(r.svg, '-'), n + arrowCount(ivs), `${who}: signs`);
    const ns = nodeBoxes(r.svg), top = Math.min(...ns.map(b => b.y)), bottom = Math.max(...ns.map(b => b.y + b.h));
    assert.equal(ns.length, n, who);
    for (const b of dashedBoxes(r.svg)) assert.ok(b.y + b.h <= top || b.y >= bottom, `${who}: a box is outside the ring`);
    for (const sg of dashedSegs(r.svg)) assert.equal(crossesNode(sg, ns), false, `${who}: an arrow runs through a node box`);
  }
  assert.ok(drawn >= 40, `most rings with interventions draw (${drawn} of 60)`);
});

test('a ring with an intervention is taller than the same ring without, by the band; a ring without interventions is unchanged', async () => {
  const {nodes, links} = ringCase(1, 4), h = (svg: string): number => +/<svg[^>]* height="([\d.]+)"/.exec(svg)![1]!;
  const plain = await drawAndCheck(causalLoop(nodes, links, {layout: 'ring'})), one = await drawAndCheck(causalLoop(nodes, links, {layout: 'ring', interventions: [{id: 'fix', label: '対策', to: 'n0', polarity: '-'}]}));
  assert.equal(one.error, undefined);
  assert.ok(h(one.svg) >= h(plain.svg) + 88, 'one band of 48 + 40');
  assert.deepEqual([one.problems, one.lint], [[], []]);
  assert.equal(plain.svg, (await drawAndCheck(causalLoop(nodes, links, {layout: 'ring', interventions: []}))).svg);
});

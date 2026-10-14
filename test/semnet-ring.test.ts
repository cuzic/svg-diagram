// causalLoop({layout: 'ring'}) (ADR 0011 D): one loop on an ellipse, arcs for links. Nothing here depends on font widths: figures are
// judged by checkDiagram and lint-svg --strict, and by geometry recomputed from the drawn SVG.
import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/strict-width.ts';
import {causalLoop, closeMeasurer} from '../lib/dsl.ts';
import type {CausalLink, CausalNode} from '../lib/dsl.ts';
import {countText, drawAndCheck, rng} from './helpers/semnet-sweep.ts';

test.after(() => closeMeasurer());

const LABELS = ['需要', '供給と在庫の調整', '顧客満足', '業務負荷が高まる', 'A', '品質の低下による信頼の毀損'];
function ringCase(seed: number, n: number, opts: {delays?: boolean; labels?: boolean} = {}): {nodes: CausalNode[]; links: CausalLink[]} {
  const rand = rng(seed * 31 + n), nodes = Array.from({length: n}, (_, i) => ({id: `n${i}`, label: LABELS[Math.floor(rand() * LABELS.length)] + (i % 2 ? '' : String(i))}));
  const links: CausalLink[] = nodes.map((x, i) => ({from: x.id, to: nodes[(i + 1) % n].id, polarity: rand() < .5 ? '+' : '-', ...(opts.delays && rand() < .4 ? {delay: true} : {}), ...(opts.labels && rand() < .4 ? {label: '短期的な効果'} : {})}));
  return {nodes, links};
}
const selfLink = (nodes: CausalNode[], links: CausalLink[], at: number): CausalLink[] => [...links, {from: nodes[at % nodes.length].id, to: nodes[at % nodes.length].id, polarity: '+'}];

test('one loop of 2-8 nodes: clean on checkDiagram and lint-svg --strict, every sign drawn, or an explicit "no room" / fit error', async () => {
  let drawn = 0;
  for (let n = 2; n <= 8; n++) for (let seed = 1; seed <= 12; seed++) {
    const {nodes, links} = ringCase(seed, n, {delays: seed % 2 === 0}), who = `n=${n} seed ${seed}`, r = await drawAndCheck(causalLoop(nodes, links, {layout: 'ring'}));
    if (r.error !== undefined) { assert.match(r.error, /has no room|do not fit on a ring/, who); continue; }
    drawn++;
    assert.deepEqual([r.problems, r.lint], [[], []], who);
    assert.equal(countText(r.svg, '+') + countText(r.svg, '-'), n, `${who}: one sign per link`);
    assert.equal(countText(r.svg, '||'), links.filter(l => l.delay).length, `${who}: delays`);
    assert.equal(countText(r.svg, 'R1') + countText(r.svg, 'B1'), 1, `${who}: the loop name`);
  }
  assert.ok(drawn >= 80, `most rings draw (${drawn} of 84)`);
});

test('a self link is allowed and is drawn outside the ring; edge labels may be left out but never overlap', async () => {
  let drawn = 0;
  for (let n = 2; n <= 8; n++) for (let seed = 1; seed <= 10; seed++) {
    const {nodes, links} = ringCase(seed, n, {labels: true, delays: true}), who = `self n=${n} seed ${seed}`;
    const r = await drawAndCheck(causalLoop(nodes, selfLink(nodes, links, seed), {layout: 'ring'}));
    if (r.error !== undefined) { assert.match(r.error, /has no room|do not fit on a ring/, who); continue; }
    assert.deepEqual([r.problems, r.lint], [[], []], who);
    drawn++;
    assert.equal(countText(r.svg, '+') + countText(r.svg, '-'), n + 1, `${who}: signs`);
  }
  assert.ok(drawn >= 65, `most rings with a self link draw (${drawn} of 70)`);
});

test('the ring is round: the nodes sit on one ellipse, the first at the top, clockwise; the name is in the middle', async () => {
  const {nodes, links} = ringCase(1, 5), r = await drawAndCheck(causalLoop(nodes, links, {layout: 'ring', height: 500}));
  assert.equal(r.error, undefined);
  const rects = [...r.svg.matchAll(/<path d="M([\d.]+),([\d.]+) H([\d.]+) V([\d.]+) H[\d.]+ Z" fill="#ffffff" stroke="#22201b" stroke-width="2"/g)].map(m => ({x: (+m[1] + +m[3]) / 2, y: (+m[2] + +m[4]) / 2}));
  assert.equal(rects.length, 5);
  const cx = rects.reduce((a, p) => a + p.x, 0) / 5;
  assert.ok(rects[0].y < Math.min(...rects.slice(1).map(p => p.y)), 'the first node is the top one');
  assert.ok(Math.abs(rects[0].x - cx) < 2, 'and in the middle');
  assert.ok(rects[1].x > cx && rects[4].x < cx, 'the second node is to the right: clockwise');
});

test('a ring is the same figure for the same input and a bigger height only adds room', async () => {
  const {nodes, links} = ringCase(2, 4), a = await drawAndCheck(causalLoop(nodes, links, {layout: 'ring'})), b = await drawAndCheck(causalLoop(nodes, links, {layout: 'ring'}));
  assert.equal(a.svg, b.svg);
  const tall = await drawAndCheck(causalLoop(nodes, links, {layout: 'ring', height: 700}));
  assert.deepEqual([tall.problems, tall.lint], [[], []]);
});

test('what a ring does not take stops with a named error', () => {
  const N = (...ids: string[]): CausalNode[] => ids.map(id => ({id, label: id.toUpperCase()}));
  const L = (...pairs: string[]): CausalLink[] => pairs.map(p => ({from: p[0], to: p[1], polarity: '+' as const}));
  const ring = (nodes: CausalNode[], links: CausalLink[], more: object = {}): unknown => causalLoop(nodes, links, {layout: 'ring', ...more} as never);
  assert.throws(() => ring(N('a', 'b', 'c', 'd'), L('ab', 'ba', 'bc', 'cb')), /causalLoop\(\{layout: 'ring'\}\): the graph must be one loop \(found 2 loops;/); // two loops
  assert.throws(() => ring(N('a', 'b', 'c'), L('ab', 'bc', 'ca', 'ba')), /found 2 loops/); // a figure of eight on one node pair: the chord makes a second loop
  assert.throws(() => ring(N('a', 'b', 'c', 'd'), L('ab', 'ba')), /"c" is not on it; use layout: 'layered'; a node outside the loop is an intervention/);
  assert.throws(() => ring(N('a', 'b'), L('ab')), /found 0 loops/); // no loop at all
  assert.throws(() => ring(N('a'), L('aa')), /found 0 loops/); // one node with a self link only
  const nine = Array.from({length: 9}, (_, i) => `n${i}`);
  assert.throws(() => ring(nine.map(id => ({id, label: id})), nine.map((id, i) => ({from: id, to: nine[(i + 1) % 9], polarity: '+' as const}))), /the loop has 9 nodes; a ring takes 2 to 8/);
  assert.throws(() => ring(N('a', 'b'), L('ab', 'ba'), {direction: 'TB'}), /direction has no meaning on a ring/);
  assert.throws(() => ring(N('a', 'b'), L('ab', 'ba'), {direction: 'LR'}), /direction has no meaning on a ring/);
  assert.throws(() => causalLoop(N('a', 'b'), L('ab', 'ba'), {layout: 'circle'} as never), /layout must be 'layered' or 'ring'/);
});

test('a ring with interventions is checked but, until unit C, stops as not drawn yet', async () => {
  const {nodes, links} = ringCase(1, 4), r = await drawAndCheck(causalLoop(nodes, links, {layout: 'ring', interventions: [{id: 'fix', label: '対策', to: 'n0', polarity: '-'}]}));
  assert.match(r.error ?? '', /not drawn yet/);
});

test('a height that is too small says how high the ring needs to be; the default layout is untouched', async () => {
  const {nodes, links} = ringCase(3, 4), band = causalLoop(nodes, links, {layout: 'ring', height: 100});
  const r = await drawAndCheck(band);
  const need = /it needs at least (\d+)/.exec(r.error ?? '')?.[1];
  assert.ok(need, String(r.error));
  assert.equal((await drawAndCheck(causalLoop(nodes, links, {layout: 'ring', height: Number(need)}))).error, undefined);
  assert.equal((await drawAndCheck(causalLoop(nodes, links, {layout: 'layered'}))).svg, (await drawAndCheck(causalLoop(nodes, links))).svg);
});

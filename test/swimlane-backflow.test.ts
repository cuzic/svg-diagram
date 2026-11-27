import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {box, checkDiagram, closeMeasurer, diagram, swimlane} from '../lib/dsl.ts';
import type {LaidOutConnect} from '../lib/types/containers.ts';
import type {LaidOutSwimlane} from '../lib/types/sequence-table-swimlane.ts';
import type {LaidOutBox} from '../lib/types/text-bands.ts';

test.after(() => closeMeasurer());

type Step = {id: string; lane: string; title: string; col: number; row?: number};
type Flow = {from: string; to: string; label?: string; labelAt?: number; bend?: 'start' | 'end' | number; bendOffset?: number};
const lanes = [{id: 'a', label: '担当A'}, {id: 'b', label: '担当B'}, {id: 'c', label: '担当C'}];
const chain: Step[] = [
  {id: 'x1', lane: 'a', title: '受付', col: 1}, {id: 'p', lane: 'b', title: '下書き', col: 2},
  {id: 'q', lane: 'b', title: '点検', col: 3}, {id: 'r', lane: 'b', title: '仕上げ', col: 4},
];
const forward = (ids: string[]): Flow[] => ids.slice(1).map((id, i) => ({from: ids[i]!, to: id}));

const laid = async (steps: Step[], flows: Flow[], next = false) => {
  const d = diagram({theme: 'blue'}).add(...swimlane(lanes, steps as never, {flows} as never));
  const {laidOut, verdict} = await checkDiagram(next ? d.add(box({id: 'after', title: '次'})) : d);
  const boxes = laidOut.laidOut.filter(b => b.type === 'box') as LaidOutBox[];
  return {
    frame: laidOut.laidOut.find(b => b.type === 'swimlane') as LaidOutSwimlane,
    boxes, verdict, all: laidOut.connects as LaidOutConnect[],
    back: laidOut.connects.at(-1) as LaidOutConnect,
    after: boxes.find(b => b.id === 'after'),
  };
};
const base = forward(['x1', 'p', 'q', 'r']);

test('swimlane: a labelled flow back along one lane runs under the boxes between and its label overlaps none', async () => {
  const {boxes, back, frame, verdict} = await laid(chain, [...base, {from: 'r', to: 'p:bottom', label: 'やり直し'}]);
  assert.deepEqual(verdict.problems, []);
  const lowest = Math.max(...boxes.filter(b => b.y >= frame.lanes[1]!.y).map(b => b.y + b.h));
  assert.ok(back.points.slice(1, -1).every(pt => pt.y >= lowest), 'the run is under the boxes');
  const lane = frame.lanes[1]!;
  assert.ok(back.labelBox !== undefined && back.labelBox.y + back.labelBox.h <= lane.y + lane.h, 'the label stays inside its lane (the lane grew for it)');
});

test('swimlane: a flow back past a box in the same lane, with no side given, also runs under the boxes', async () => {
  const {verdict, back} = await laid(chain, [...base, {from: 'r', to: 'p', label: 'やり直し'}]);
  assert.deepEqual(verdict.problems, []);
  assert.equal(back.route, 'loop-under');
});

test('swimlane: a way back to the next box (nothing between) keeps its side-to-side route', async () => {
  const {back} = await laid(chain, [{from: 'q', to: 'p'}]);
  assert.equal(back.route, 'elbow');
});

test('swimlane: an explicit start side, or an explicit bend, keeps the elbow', async () => {
  assert.equal((await laid(chain, [{from: 'r:right', to: 'p:bottom'}])).back.route, 'elbow');
  assert.equal((await laid(chain, [{from: 'r', to: 'p:bottom', bend: 'end'}])).back.route, 'elbow');
  assert.equal((await laid(chain, [{from: 'r', to: 'p:bottom', bendOffset: 10}])).back.route, 'elbow');
});

test('swimlane: a back-flow without a label fits in the lane as it is (the lane does not grow)', async () => {
  const [plain, one] = await Promise.all([laid(chain, base), laid(chain, [...base, {from: 'r', to: 'p:bottom'}])]);
  assert.deepEqual(one.verdict.problems, []);
  assert.equal(one.frame.h, plain.frame.h);
});

test('swimlane: the space after the swimlane does not change with the number of back-flows (0, 1, 3)', async () => {
  const five: Step[] = [1, 2, 3, 4, 5].map(i => ({id: `s${i}`, lane: 'b', title: `手順${i}`, col: i}));
  const f = forward(['s1', 's2', 's3', 's4', 's5']);
  const backs: Flow[] = [{from: 's5', to: 's1:bottom', label: '全部やり直し'}, {from: 's4', to: 's2:bottom', label: '直す'}, {from: 's3', to: 's2:bottom', label: '戻す'}];
  const cases = await Promise.all([0, 1, 3].map(n => laid(five, [...f, ...backs.slice(0, n)], true)));
  const gaps = cases.map(c => c.after!.y - (c.frame.y + c.frame.h));
  // the next band's top is rounded to the 4px grid: the gap may differ by that much, never by a dip's worth (it was 36px per labelled back-flow)
  for (const g of gaps.slice(1)) assert.ok(Math.abs(g! - gaps[0]!) < 4, `gaps ${gaps.join(', ')}`);
  assert.ok(cases[2]!.frame.h > cases[0]!.frame.h, 'the lane itself holds the stacked levels');
});

test('swimlane: nested and overlapping back-flows in one lane each get a line and a label slot of their own', async () => {
  const five: Step[] = [1, 2, 3, 4, 5].map(i => ({id: `s${i}`, lane: 'b', title: `手順${i}`, col: i}));
  const f = forward(['s1', 's2', 's3', 's4', 's5']);
  for (const backs of [
    [{from: 's5', to: 's1:bottom', label: '全部やり直し'}, {from: 's4', to: 's2:bottom', label: '直す'}],
    [{from: 's4', to: 's1', label: '前半へ'}, {from: 's5', to: 's2', label: '後半へ'}],
  ] as Flow[][]) {
    const {all, verdict} = await laid(five, [...f, ...backs]);
    assert.deepEqual(verdict.problems, []);
    const under = all.filter(c => c.route === 'loop-under');
    assert.equal(under.length, 2);
    assert.notEqual(under[0]!.points[1]!.y, under[1]!.points[1]!.y, 'two depths');
    const [x, y] = [under[0]!.labelBox!, under[1]!.labelBox!];
    assert.ok(x.x + x.w <= y.x || y.x + y.w <= x.x || x.y + x.h <= y.y || y.y + y.h <= x.y, 'the chips do not touch');
  }
  const nested = await laid(five, [...f, {from: 's5', to: 's1:bottom'}, {from: 's4', to: 's2:bottom'}]);
  const [outer, inner] = nested.all.filter(c => c.route === 'loop-under');
  assert.ok(outer!.points[1]!.y > inner!.points[1]!.y, 'the outer one runs deeper');
});

test('swimlane: a taller box between the ends is cleared by the line and its label', async () => {
  const tall: Step[] = [
    {id: 's1', lane: 'b', title: '短い', col: 1},
    {id: 's2', lane: 'b', title: '長い長い長い長い長い長い長い長い長い長い長い長い説明の手順', col: 2},
    {id: 's3', lane: 'b', title: '短い', col: 3},
  ];
  const {verdict, back, boxes} = await laid(tall, [{from: 's1', to: 's2'}, {from: 's2', to: 's3'}, {from: 's3', to: 's1:bottom', label: '戻す'}]);
  assert.deepEqual(verdict.problems, []);
  const lowest = Math.max(...boxes.map(b => b.y + b.h));
  assert.ok(back.points[1]!.y > lowest, 'the line is under the tallest box');
});

test('swimlane: in a lane with rows, a back-flow in the first row gets room under that row and crosses no box', async () => {
  const rows: Step[] = [...[1, 2, 3, 4, 5].map(i => ({id: `s${i}`, lane: 'b', title: `手順${i}`, col: i})), {id: 't', lane: 'b', title: '別作業', col: 3, row: 1}];
  const f = forward(['s1', 's2', 's3', 's4', 's5']);
  const [plain, withBack] = await Promise.all([laid(rows, f), laid(rows, [...f, {from: 's5', to: 's2:bottom', label: 'やり直し'}])]);
  assert.deepEqual(withBack.verdict.problems, []);
  const t = withBack.boxes.find(b => b.id === 't')!, s1 = withBack.boxes.find(b => b.id === 's1')!;
  assert.ok(withBack.back.labelBox!.y + withBack.back.labelBox!.h <= t.y, 'the chip ends above the second row');
  assert.ok(t.y - (s1.y + s1.h) > plain.boxes.find(b => b.id === 't')!.y - (plain.boxes.find(b => b.id === 's1')!.y + s1.h), 'the gap under row 1 grew');
  assert.ok(withBack.frame.h > plain.frame.h);
});

test('swimlane: a way back from one row of a lane to another is not run under the boxes', async () => {
  const two: Step[] = [{id: 'u', lane: 'b', title: '上の段', col: 1}, {id: 'v', lane: 'b', title: '中', col: 2}, {id: 'w', lane: 'b', title: '下の段', col: 3, row: 1}];
  assert.equal((await laid(two, [{from: 'w', to: 'u:bottom'}])).back.route, 'elbow');
});

test('swimlane: a hand-over from the bottom of a box that a back-flow comes back to does not share its point', async () => {
  const sl = [{id: 'b', label: '担当B'}, {id: 'c', label: '担当C'}];
  const st: Step[] = [...[1, 2, 3, 4, 5].map(i => ({id: `s${i}`, lane: 'b', title: `手順${i}`, col: i})), {id: 'c2', lane: 'c', title: '引き継ぐ', col: 2}];
  const flows: Flow[] = [...forward(['s1', 's2', 's3', 's4', 's5']), {from: 's5', to: 's2:bottom', label: 'やり直し'}, {from: 's2', to: 'c2', label: '引き継ぎ'}];
  const {all, verdict} = await checkDiagram(diagram({theme: 'blue'}).add(...swimlane(sl, st as never, {flows} as never))).then(r => ({all: r.laidOut.connects, verdict: r.verdict}));
  assert.deepEqual(verdict.problems, []);
  const back = all.find(c => c.route === 'loop-under')!, hand = all.find(c => c.label === '引き継ぎ')!;
  assert.notEqual(back.to.x, hand.from.x, 'the arrowhead and the hand-over start are apart');
  const chip = hand.chipBox ?? hand.labelBox!;
  assert.ok(!(chip.x < back.to.x + 6 && back.to.x - 6 < chip.x + chip.w && chip.y < back.to.y + 6 && back.to.y - 6 < chip.y + chip.h), 'the hand-over label does not cover the arrowhead');
});

const five: Step[] = [1, 2, 3, 4, 5].map(i => ({id: `s${i}`, lane: 'b', title: `手順${i}`, col: i}));
const fwd5 = forward(['s1', 's2', 's3', 's4', 's5']);
const runY = (c: LaidOutConnect): number => c.points[1]!.y;
const runs = (c: LaidOutConnect): [number, number] => [Math.min(c.points[1]!.x, c.points[2]!.x), Math.max(c.points[1]!.x, c.points[2]!.x)];

test('swimlane: two ways back that meet at one box never share a run, whichever flow is written first', async () => {
  for (const pair of [
    [{from: 's5', to: 's3:bottom', label: 'Q'}, {from: 's3', to: 's1:bottom', label: 'P'}],
    [{from: 's5', to: 's3:bottom'}, {from: 's3', to: 's1:bottom'}],
    [{from: 's5', to: 's1:bottom', label: 'Redo'}, {from: 's5', to: 's3:bottom', label: 'Fix'}],
    [{from: 's5', to: 's1:bottom'}, {from: 's5', to: 's3:bottom'}],
    [{from: 's3', to: 's1:bottom'}, {from: 's5', to: 's1:bottom'}],
  ] as Flow[][]) for (const order of [pair, [...pair].reverse()]) {
    const {all, verdict} = await laid(five, [...fwd5, ...order]);
    const under = all.filter(c => c.route === 'loop-under');
    assert.deepEqual(verdict.problems, []);
    assert.deepEqual(verdict.warnings.filter(w => /交差|重なり/.test(w)), [], JSON.stringify(order));
    const [x, y] = under as [LaidOutConnect, LaidOutConnect];
    if (runY(x) === runY(y)) assert.ok(runs(x)[1] <= runs(y)[0] + 0.5 || runs(y)[1] <= runs(x)[0] + 0.5, `same line, runs ${runs(x)} ${runs(y)}`);
  }
});

test('swimlane: a hand-over from a box in the middle does not pass through the chip of a way back (with and without its own label)', async () => {
  const sl = [{id: 'b', label: '担当B'}, {id: 'c', label: '担当C'}];
  const st: Step[] = [...five, {id: 'c3', lane: 'c', title: '引き継ぎ先', col: 3}];
  for (const label of [undefined, '渡す']) {
    const flows: Flow[] = [...fwd5, {from: 's5', to: 's1:bottom', label: 'やり直し'}, {from: 's3', to: 'c3', ...(label ? {label} : {})}];
    const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue'}).add(...swimlane(sl, st as never, {flows} as never)));
    assert.deepEqual(verdict.problems.filter(p => p.includes('label "やり直し"')), []); // the way back's chip is clear (the hand-over's own chip on the line is reported on its own)
    const back = laidOut.connects.find(c => c.route === 'loop-under')!, hand = laidOut.connects.find(c => c.toId === 'c3')!;
    const chip = back.chipBox!, leg = hand.points[0]!;
    assert.ok(leg.x < chip.x - 2 || leg.x > chip.x + chip.w + 2, `the hand-over leg at ${leg.x} clears the chip ${chip.x}..${chip.x + chip.w}`);
    if (hand.chipBox) assert.ok(hand.chipBox.x + hand.chipBox.w <= chip.x || chip.x + chip.w <= hand.chipBox.x || hand.chipBox.y + hand.chipBox.h <= chip.y || chip.y + chip.h <= hand.chipBox.y, 'the chips do not touch');
  }
});

test('swimlane: the bands survive a JSON round trip, and a way back without its swimlane layout is refused', async () => {
  const bands = swimlane(lanes, chain as never, {flows: [...base, {from: 'r', to: 'p:bottom', label: 'やり直し'}]} as never);
  const direct = await checkDiagram(diagram({theme: 'blue'}).add(...bands));
  const viaJson = await checkDiagram(diagram({theme: 'blue'}).add(...(JSON.parse(JSON.stringify(bands)) as typeof bands)));
  assert.deepEqual(viaJson.laidOut.connects.map(c => c.points), direct.laidOut.connects.map(c => c.points));
  const lone = bands.filter(b => b.type === 'connect').slice(-1);
  await assert.rejects(checkDiagram(diagram({theme: 'blue'}).add(box({id: 'p', title: 'x'}), box({id: 'r', title: 'y'}), ...lone)), /way back without its swimlane/);
});

test('edgeStats: two ways back under a row that share an end and run on one line are an overlap; a shared end alone is not', async () => {
  const {edgeStats} = await import('../lib/verify-connect-crossings.ts');
  const way = (route: string, toId: string, y: number, x2: number) => ({route, fromId: 'a', toId, points: [{x: 500, y: 100}, {x: 500, y}, {x: x2, y}, {x: x2, y: 100}]}) as unknown as LaidOutConnect;
  assert.equal(edgeStats([way('loop-under', 'b', 140, 300), way('loop-under', 'c', 140, 200)]).overlaps, 1);
  assert.equal(edgeStats([way('loop-under', 'b', 140, 300), way('loop-under', 'c', 170, 200)]).overlaps, 0);
  assert.equal(edgeStats([way('elbow', 'b', 140, 300), way('elbow', 'c', 140, 200)]).overlaps, 0);
});

const mid = (c: LaidOutConnect): number => (c.points[0]!.x + c.points[3]!.x) / 2;
const two: Step[] = [...five, {id: 'c2', lane: 'c', title: '渡す先', col: 2}, {id: 'c3', lane: 'c', title: '受け取る', col: 3}];

test('swimlane: one pair written twice (with and without :bottom, or the same way) runs at two depths with two chips', async () => {
  for (const pair of [
    [{from: 's5', to: 's1:bottom', label: 'A'}, {from: 's5', to: 's1', label: 'B'}],
    [{from: 's5', to: 's1:bottom', label: 'A'}, {from: 's5', to: 's1:bottom', label: 'B'}],
    [{from: 's5', to: 's1:bottom'}, {from: 's5', to: 's1:bottom'}],
  ] as Flow[][]) {
    const {all, verdict} = await laid(five, [...fwd5, ...pair]);
    assert.deepEqual(verdict.problems, [], JSON.stringify(pair));
    const [x, y] = all.filter(c => c.route === 'loop-under') as [LaidOutConnect, LaidOutConnect];
    assert.notEqual(runY(x), runY(y));
    if (x.chipBox && y.chipBox) assert.ok(x.chipBox.y + x.chipBox.h <= y.chipBox.y || y.chipBox.y + y.chipBox.h <= x.chipBox.y, 'two chips');
  }
});

test('swimlane: the chip of a way back stays in the middle when no other flow crosses its line', async () => {
  const {back} = await laid(five, [...fwd5, {from: 's5', to: 's1:bottom', label: 'Again'}]);
  assert.ok(Math.abs(back.labelX! - mid(back)) <= 1, `${back.labelX} vs ${mid(back)}`);
});

test('swimlane: an explicit labelAt keeps its place, and a scoped swimlane lays out its ways back', async () => {
  const flows: Flow[] = [...fwd5, {from: 's5', to: 's1:bottom', label: 'Again', labelAt: 0.5}, {from: 's3', to: 'c3'}];
  const sl = [{id: 'b', label: '担当B'}, {id: 'c', label: '担当C'}];
  const fixed = await checkDiagram(diagram({theme: 'blue'}).add(...swimlane(sl, two as never, {flows} as never)));
  const back = fixed.laidOut.connects.find(c => c.route === 'loop-under')!;
  assert.ok(Math.abs(back.labelX! - mid(back)) <= 1, 'kept at 0.5, on the leg');
  const scoped = await checkDiagram(diagram({theme: 'blue'}).add(...swimlane(sl, two as never, {flows: [...fwd5, {from: 's5', to: 's1:bottom', label: 'Again'}], scope: 'one'} as never)));
  assert.deepEqual(scoped.verdict.problems, []);
  assert.equal(scoped.laidOut.connects.filter(c => c.route === 'loop-under').length, 1);
});

test('swimlane: a long hand-over label is kept clear of, not only its leg', async () => {
  const sl = [{id: 'b', label: '担当B'}, {id: 'c', label: '担当C'}];
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue'}).add(...swimlane(sl, two as never, {flows: [...fwd5, {from: 's5', to: 's1:bottom', label: 'Again'}, {from: 's3', to: 'c3', label: '引き継ぎを依頼する'}]} as never)));
  assert.deepEqual(verdict.problems.filter(p => p.includes('label "Again"')), []);
  const back = laidOut.connects.find(c => c.route === 'loop-under')!, hand = laidOut.connects.find(c => c.toId === 'c3')!;
  const [p, q] = [back.chipBox!, hand.chipBox!];
  assert.ok(p.x + p.w <= q.x || q.x + q.w <= p.x || p.y + p.h <= q.y || q.y + q.h <= p.y);
});

test('swimlane: a chip that has no free place goes where it covers least, and the overlap that is left is reported', async () => {
  const sl = [{id: 'b', label: '担当B'}, {id: 'c', label: '担当C'}];
  const {verdict} = await checkDiagram(diagram({theme: 'blue'}).add(...swimlane(sl, two as never, {flows: [...fwd5, {from: 's3', to: 's1:bottom', label: 'Go back and redo it all'}, {from: 's2', to: 'c2', label: 'Hand it over right now'}]} as never)));
  assert.ok(verdict.problems.some(p => /label "Go back and redo it all" overlaps connect\(s2:bottom -> c2:top\) by \d+x\d+px/.test(p)), verdict.problems.join('\n'));
});

test('swimlane: a flow that ends above the line (a hand-over into the box from the lane above) does not push the chip off the middle', async () => {
  const sl = [{id: 'a', label: '担当A'}, {id: 'b', label: '担当B'}];
  const st: Step[] = [{id: 'a3', lane: 'a', title: '依頼', col: 3}, ...five];
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue'}).add(...swimlane(sl, st as never, {flows: [...fwd5, {from: 'a3', to: 's3'}, {from: 's5', to: 's1:bottom', label: 'Again'}]} as never)));
  assert.deepEqual(verdict.problems, []);
  const back = laidOut.connects.find(c => c.route === 'loop-under')!;
  assert.ok(Math.abs(back.labelX! - mid(back)) <= 1, `${back.labelX} vs ${mid(back)}`);
});

const bothLanes = [{id: 'b', label: '担当B'}, {id: 'c', label: '担当C'}];
const oStep: Step[] = [...[1, 2, 3, 4, 5].map(i => ({id: `s0${i}`, lane: 'b', title: `手順${i}`, col: i})), {id: 'o13', lane: 'c', title: '受取', col: 3}];
const f05 = forward(['s01', 's02', 's03', 's04', 's05']);
const problemsOf = async (steps: Step[], flows: Flow[], ls = bothLanes): Promise<string[]> => (await checkDiagram(diagram({theme: 'blue'}).add(...swimlane(ls, steps as never, {flows} as never)))).verdict.problems;

test('swimlane: a way-back chip that has to cover another flow\'s line (no chip there) is reported with the label, the size and a hint', async () => {
  const problems = await problemsOf(two, [...fwd5, {from: 's3', to: 's1:bottom', label: 'Go back and redo everything from the very start of it'}, {from: 's2', to: 'c2'}]);
  assert.ok(problems.some(p => /label "Go back and redo everything from the very start of it" overlaps connect\(s2:bottom -> c2:top\) by \d+x\d+px \(write labelAt/.test(p)), problems.join('\n'));
});

test('swimlane: another flow\'s chip that sits on a way back\'s line is reported too', async () => {
  const problems = await problemsOf(oStep, [...f05, {from: 's05', to: 's02', label: 'Go back'}, {from: 's03', to: 'o13', label: 'Pass'}]);
  assert.ok(problems.some(p => /label "Pass" overlaps connect\(s05:bottom -> s02:bottom\) by \d+x\d+px/.test(p)), problems.join('\n'));
});

test('swimlane: the chip of a shallow way back keeps clear of the legs of the deeper one that overlaps it', async () => {
  const {all, verdict} = await laid(five, [...fwd5, {from: 's4', to: 's1', label: 'A fairly long label here'}, {from: 's5', to: 's2', label: 'B'}]);
  assert.deepEqual(verdict.problems, []);
  const shallow = all.filter(c => c.route === 'loop-under').sort((x, y) => runY(x) - runY(y))[0]!;
  assert.ok(Math.abs(shallow.labelX! - mid(shallow)) > 5, 'moved off the middle, where the deeper way back comes down');
});

test('swimlane: with no free place the chip is not left in the middle but where it covers least', async () => {
  const {all} = await laid(two, [...fwd5, {from: 's3', to: 's1:bottom', label: 'Go back and redo it all'}, {from: 's2', to: 'c2'}]);
  const back = all.find(c => c.route === 'loop-under')!;
  assert.ok(Math.abs(back.labelX! - mid(back)) > 5, `${back.labelX} vs ${mid(back)}`);
});

test('swimlane: fuzz — a chip on another flow\'s line, in either direction, is never silent', async () => {
  let seed = 7;
  const rnd = (n: number): number => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  const overlap = (a: {x: number; y: number; w: number; h: number}, b: {x: number; y: number; w: number; h: number}): boolean => a.x + a.w - b.x > 0.5 && b.x + b.w - a.x > 0.5 && a.y + a.h - b.y > 0.5 && b.y + b.h - a.y > 0.5;
  let reported = 0;
  for (let n = 0; n < 120; n++) {
    const cols = 4 + rnd(3), st: Step[] = [...Array(cols).keys()].map(i => ({id: `s${i + 1}`, lane: 'b', title: `手順${i + 1}`, col: i + 1}));
    const flows: Flow[] = forward(st.map(x => x.id));
    for (let k = rnd(3); k >= 0; k--) st.push({id: `o${k}`, lane: 'c', title: '受取', col: 1 + rnd(cols)});
    for (const x of st.filter(y => y.lane === 'c')) if (rnd(3) > 0) flows.push({from: `s${x.col}`, to: x.id, ...(rnd(2) ? {label: ['Pass', '引き継ぎ'][rnd(2)]!} : {})});
    for (let k = 1 + rnd(3); k > 0; k--) { const to = 1 + rnd(cols - 2), from = to + 1 + rnd(cols - to); flows.push({from: `s${from}`, to: `s${to}${rnd(2) ? ':bottom' : ''}`, ...(rnd(3) ? {label: ['Redo', 'Go back and redo it all'][rnd(2)]!} : {})}); }
    const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue'}).add(...swimlane(bothLanes, st as never, {flows} as never)));
    for (const c of laidOut.connects) for (const o of laidOut.connects) {
      if (c === o || !c.labelBox || !(c.under || o.under)) continue;
      if (o.pathSegments.some(r => overlap(c.labelBox!, r)) || (c.under && o.labelBox && overlap(c.labelBox, o.labelBox))) {
        reported++;
        assert.ok(verdict.problems.some(p => p.includes(`label "${c.label}" overlaps connect(${o.fromLabel} -> ${o.toLabel})`)), `silent: ${JSON.stringify(flows)}\n${verdict.problems.join('\n')}`);
      }
    }
  }
  assert.ok(reported > 0, 'the fuzz reaches the reported case');
});

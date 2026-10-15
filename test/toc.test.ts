import test from 'node:test';
import './helpers/strict-width.ts'; // a label the layout did not register for measuring throws instead of measuring 0 wide
import assert from 'node:assert/strict';
import {box, causeTree, checkDiagram, closeMeasurer, cloud, connect, diagram, renderDiagram} from '../lib/dsl.ts';
import type {LaidOutCause, LaidOutCloud} from '../lib/types/diagrams.ts';

test.after(() => closeMeasurer());

type R = {x: number; y: number; w: number; h: number};
const overlap = (a: R, b: R): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const N = (id: string, extra: object = {}) => ({id, label: id, ...extra});

const crt = (opts: object = {}) => causeTree(
  [N('late', {role: 'ude'}), N('cost', {role: 'ude'}), N('switch'), N('rush'), N('wip'), N('start'), N('kpi', {role: 'root'})],
  [{from: 'kpi', to: 'start'}, {from: 'start', to: 'wip'}, {from: 'wip', to: 'switch'}, {from: 'wip', to: 'rush'}, {from: 'switch', to: 'late'}, {from: ['switch', 'rush'], to: 'cost'}],
  opts,
);
const laidCause = async (...bands: unknown[]) => {
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue'}).add(...(bands as never[])));
  return {t: laidOut.laidOut.find(b => b.type === 'cause') as LaidOutCause, verdict};
};
const laidCloud = async (...bands: unknown[]) => {
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue'}).add(...(bands as never[])));
  return {t: laidOut.laidOut.find(b => b.type === 'cloud') as LaidOutCloud, verdict};
};

for (const dir of ['up', 'down', 'right', 'left'] as const) {
  test(`causeTree() dir ${dir}: effects lie on the far side of their causes, nothing overlaps, every arrow ends on its effect, verify passes`, async () => {
    const {t, verdict} = await laidCause(crt({dir}));
    assert.deepEqual(verdict.problems, []);
    assert.equal(t.nodes.length, 7);
    assert.equal(t.edges.length, 7); // the AND's two arrows count one each
    for (let i = 0; i < t.nodes.length; i++) for (let j = i + 1; j < t.nodes.length; j++) assert.ok(!overlap(t.nodes[i], t.nodes[j]));
    const by = (id: string) => t.anchors.find(a => a.id === id)!;
    const cause = by('kpi'), effect = by('late');
    if (dir === 'up') assert.ok(effect.y + effect.h < cause.y);
    if (dir === 'down') assert.ok(effect.y > cause.y + cause.h);
    if (dir === 'right') assert.ok(effect.x > cause.x + cause.w);
    if (dir === 'left') assert.ok(effect.x + effect.w < cause.x);
    const onEdge = (p: {x: number; y: number}, r: R): boolean => p.x >= r.x - 0.5 && p.x <= r.x + r.w + 0.5 && p.y >= r.y - 0.5 && p.y <= r.y + r.h + 0.5;
    for (const e of t.edges) assert.ok(onEdge(e.points[e.points.length - 1], by(e.to)) && onEdge(e.points[0], by(e.from)), `${e.from} -> ${e.to} runs from its cause to its effect`);
  });
}

test('causeTree(): an AND gets one arc across its arrows, before the arrowheads; separate links get none', async () => {
  const {t} = await laidCause(crt());
  assert.equal(t.ands.length, 1);
  assert.deepEqual(t.loose, []);
  const [arc] = t.ands, cost = t.anchors.find(a => a.id === 'cost')!;
  assert.equal(arc.to, 'cost');
  const tips = t.edges.filter(e => e.to === 'cost').map(e => e.points[e.points.length - 1]);
  assert.equal(tips.length, 2);
  // dir up: the arrows arrive on the bottom of the effect; the arc spans their x and sits above their start of the head (below the box)
  assert.ok(arc.p0.x < Math.min(...tips.map(p => p.x)) && arc.p1.x > Math.max(...tips.map(p => p.x)));
  for (const p of [arc.p0, arc.c, arc.p1]) assert.ok(p.y > cost.y + cost.h, 'the arc is under the effect');
  assert.ok(arc.c.y < arc.p0.y, 'the middle of the arc is nearer the effect than its ends');
});

test('causeTree(): an AND of three causes, in every direction, is joined by one arc each', async () => {
  for (const dir of ['up', 'down', 'right', 'left'] as const) {
    const {t, verdict} = await laidCause(causeTree([N('a'), N('b'), N('c'), N('z')], [{from: ['a', 'b', 'c'], to: 'z'}], {dir}));
    assert.deepEqual(verdict.problems, [], dir);
    assert.equal(t.ands.length, 1, dir);
    assert.equal(t.edges.length, 3, dir);
  }
});

test('causeTree(): roles set the tone and the double outline; a tone overrides the role', async () => {
  const roles = ['effect', 'ude', 'root', 'de', 'injection', 'goal', 'obstacle', 'io', 'action'] as const;
  const {t} = await laidCause(causeTree(roles.map(r => N(r, {role: r})), roles.slice(1).map((r, i) => ({from: roles[i], to: r}))));
  const tone = (id: string) => t.nodes[roles.indexOf(id as never)].tone;
  assert.equal(tone('ude'), 'danger');
  assert.equal(tone('root'), 'accent');
  assert.equal(tone('obstacle'), 'plain');
  assert.deepEqual(t.nodes.flatMap((n, i) => n.hex ? [roles[i]] : []), ['obstacle'], 'an obstacle is a hexagon');
  assert.deepEqual(t.nodes.flatMap((n, i) => n.double ? [roles[i]] : []), ['root', 'goal']);
  const {t: o} = await laidCause(causeTree([N('a', {role: 'ude', tone: 'muted'})], []));
  assert.equal(o.nodes[0].tone, 'muted');
});

test('causeTree(): the SVG has the boxes, double outlines, arrowheads as shapes and the AND arc', async () => {
  const {svg} = await renderDiagram(diagram({theme: 'blue'}).add(crt()), {name: 'c.svg', budget: 'cacheOnly'});
  assert.equal(svg.match(/<rect [^>]*rx="8"/g)?.length, 7, '7 entities');
  assert.equal(svg.match(/<rect [^>]*rx="5"/g)?.length, 1, 'the inner outline of the root cause');
  assert.match(svg, / Q/, 'the AND arc is a curve');
  assert.equal(svg.includes('marker-end'), false);
  assert.match(svg, /stroke-dasharray="6,4"/, 'a UDE is a dashed box');
  const prt = await renderDiagram(diagram({theme: 'blue'}).add(causeTree([N('g', {role: 'goal'}), N('o', {role: 'obstacle'})], [{from: 'o', to: 'g'}])), {name: 'p.svg', budget: 'cacheOnly'});
  assert.equal(prt.svg.match(/<polygon /g)?.length, 1, 'the obstacle is a hexagon');
});

test('causeTree(): nodes are anchors for connect(); a connect to the whole figure may cross it', async () => {
  const ct = crt({id: 'tree'});
  assert.equal(ct.anchors.kpi.id, 'kpi');
  const {verdict} = await checkDiagram(diagram({theme: 'blue'}).add(ct, box({id: 'memo', title: 'メモ'}), connect('kpi', 'memo', {route: 'elbow'}), connect('tree', 'memo')));
  assert.deepEqual(verdict.problems, []);
});

test('causeTree(): a link may be a feedback loop (a cycle), drawn from its real cause', async () => {
  const {t, verdict} = await laidCause(causeTree([N('a'), N('b'), N('c')], [{from: 'a', to: 'b'}, {from: 'b', to: 'c'}, {from: 'c', to: 'a'}]));
  assert.equal(t.edges.length, 3);
  assert.ok(t.edges.some(e => e.from === 'c' && e.to === 'a'));
  assert.deepEqual(verdict.problems.filter(p => p.startsWith('cause: arrow')), []);
});

test('causeTree() rejects bad input', async () => {
  assert.throws(() => causeTree([], []), /at least one node/);
  assert.throws(() => causeTree([N('a')], [], {dir: 'sideways' as never}), /dir must be/);
  assert.throws(() => causeTree([N('a')], [{from: 'a', to: 'a', line: 'wavy' as never}]), /has line/);
  assert.throws(() => causeTree([N('a', {role: 'villain'})], []), /has role villain/);
  assert.throws(() => causeTree([N('a', {tone: 'solid'})], []), /has tone solid/);
  const bad = (nodes: object[], links: object[]) => checkDiagram(diagram({theme: 'blue'}).add(causeTree(nodes as never, links as never)));
  await assert.rejects(() => bad([N('a'), N('a')], []), /duplicate node id "a"/);
  await assert.rejects(() => bad([N('a')], [{from: 'a', to: 'zz'}]), /unknown node "zz"/);
  await assert.rejects(() => bad([N('a'), N('b')], [{from: ['a', 'zz'], to: 'b'}]), /unknown node "zz"/);
  await assert.rejects(() => bad([N('a')], [{from: 'a', to: 'a'}]), /cannot be its own cause/);
  await assert.rejects(() => bad([N('a'), N('b')], [{from: 'a', to: 'b'}, {from: ['a'], to: 'b'}]), /written twice/);
  await assert.rejects(() => bad([N('a'), N('b')], [{from: [], to: 'b'}]), /has no cause/);
  await assert.rejects(() => bad([{id: 'a', label: ' '}], []), /needs a label/);
  await assert.rejects(() => bad(Array.from({length: 12}, (_, i) => N(`n${i}`)), []), /wide but it has/);
});

// ---- cloud ----
const FIVE = {a: '製品を成功させる', b: '品質を確保する', c: '市場機会を逃さない', d: '検証に時間をかける', d2: '早くリリースする'};
const assumed = (extra: object = {}) => cloud(FIVE, {
  assumptions: [{on: 'bd', text: '品質確保には長い検証期間が必須だ', injection: '自動テストで検証を短くする'}, {on: 'cd', text: '早いリリースとは全機能の公開だ'}, {on: 'bd', text: '検証は最後にまとめて行う'}],
  ...extra,
});

test('cloud(): A on the left, B above C in the middle, D above D\' on the right, the conflict between D and D\', verify passes', async () => {
  const {t, verdict} = await laidCloud(assumed());
  assert.deepEqual(verdict.problems, []);
  const at = (k: string) => t.nodes.find(n => n.key === k)!;
  assert.ok(at('a').x + at('a').w < at('b').x && at('b').x + at('b').w < at('d').x);
  assert.equal(at('b').x, at('c').x);
  assert.equal(at('d').x, at('d2').x);
  assert.ok(at('b').y + at('b').h < at('c').y && at('d').y + at('d').h < at('d2').y);
  assert.equal(at('b').y, at('d').y);
  const ay = at('a').y + at('a').h / 2;
  assert.ok(at('b').y + at('b').h / 2 < ay && ay < at('c').y + at('c').h / 2, 'A is level with the middle of the two needs');
  for (let i = 0; i < t.nodes.length; i++) for (let j = i + 1; j < t.nodes.length; j++) assert.ok(!overlap(t.nodes[i], t.nodes[j]));
  const edge = (k: string) => t.edges.find(e => e.arrow === k)!;
  assert.equal(t.edges.length, 5);
  assert.equal(edge('bd').points[0].x, at('d').x, 'D -> B leaves D and ends on B');
  assert.equal(edge('bd').points[1].x, at('b').x + at('b').w);
  assert.equal(edge('ab').points[3].x, at('a').x + at('a').w);
  const dd = edge('dd');
  assert.equal(dd.points[0].y, at('d').y + at('d').h);
  assert.equal(dd.points[dd.points.length - 1].y, at('d2').y);
});

test('cloud(): assumptions are numbered in the order written, the numbers sit on their arrow, the list is under the figure', async () => {
  const {t} = await laidCloud(assumed());
  assert.deepEqual(t.chips.map(c => [c.arrow, c.text]).sort(), [['bd', '1,3'], ['cd', '2']]);
  const bottom = Math.max(...t.nodes.map(n => n.y + n.h));
  const list = t.texts.filter(x => x.anchor === 'start');
  assert.ok(list.length >= 5 && list.every(x => x.y > bottom));
  assert.deepEqual(list.filter(x => /^\d\.$/.test(x.text)).map(x => x.text), ['1.', '2.', '3.']);
  assert.ok(list.some(x => x.tone === 'accent' && x.text.startsWith('→')), 'an injection is drawn in the accent colour');
  assert.ok(t.h > bottom - t.y, 'the band includes the list');
  for (const c of t.chips) for (const n of t.nodes) assert.ok(!overlap(c, n));
});

test('cloud(): the SVG has five boxes, arrowheads as shapes, the red conflict arrow with a head at each end, the numbers in chips', async () => {
  const {svg} = await renderDiagram(diagram({theme: 'blue'}).add(assumed({conflictLabel: '対立'})), {name: 'cl.svg', budget: 'cacheOnly'});
  assert.equal(svg.match(/<rect [^>]*rx="8"/g)?.length, 5);
  assert.equal(svg.includes('marker-end'), false);
  assert.equal(svg.match(/<path [^>]*stroke-width="2.5"/g)?.length, 1);
  assert.equal(svg.match(/<path [^>]*fill="#b91c1c"\/>/g)?.length, 2, 'two heads on the conflict');
  assert.match(svg, />A：製品を成功させる</);
  assert.match(svg, />D'：早くリリースする</);
  assert.match(svg, />1,3</);
  assert.match(svg, />対立</);
});

test('cloud(): a cloud with no assumptions is just the figure; a box may carry an id (an anchor) and a tone', async () => {
  const plain = cloud({...FIVE, d: {text: FIVE.d, id: 'dWant', tone: 'danger'}}, {id: 'cl'});
  assert.equal(plain.anchors.dWant.id, 'dWant');
  const {t, verdict} = await laidCloud(plain, box({id: 'memo', title: 'メモ'}), connect('dWant', 'memo', {route: 'elbow'}));
  assert.deepEqual(verdict.problems, []);
  assert.equal(t.chips.length, 0);
  assert.equal(t.nodes.find(n => n.key === 'd')!.tone, 'danger');
  assert.equal(t.h, Math.max(...t.nodes.map(n => n.y + n.h)) - t.y);
});

test('cloud() rejects bad input', async () => {
  assert.throws(() => cloud({...FIVE, c: undefined as never}), /box c is missing/);
  assert.throws(() => cloud(FIVE, {maxNodeW: 50}), /maxNodeW/);
  assert.throws(() => cloud({...FIVE, b: {text: 'x', tone: 'neon' as never}}), /box b has tone neon/);
  const bad = (boxes: object, opts: object = {}) => checkDiagram(diagram({theme: 'blue'}).add(cloud(boxes as never, opts as never)));
  await assert.rejects(() => bad({...FIVE, a: ' '}), /box A needs a text/);
  await assert.rejects(() => bad({...FIVE, b: {text: 'x', id: 'k'}, c: {text: 'y', id: 'k'}}), /duplicate box id "k"/);
  await assert.rejects(() => bad(FIVE, {assumptions: [{on: 'xy', text: 'z'}]}), /an assumption sits on/);
  await assert.rejects(() => bad(FIVE, {assumptions: [{on: 'bd', text: ''}]}), /needs a text/);
});

test('cloud() and causeTree() reveal and spotlight like the other bands: reveal on the band, connect to a node appears with it', async () => {
  const d = diagram({theme: 'blue'}).add(box({title: '前置き'}), crt({id: 'tree', reveal: 1}), connect('kpi', 'tree', {route: 'elbow'}));
  const {verdict} = await checkDiagram(d);
  assert.deepEqual(verdict.problems.filter(p => /reveal|appears/.test(p)), []);
});

// ---- review fixes (opus-review-toc) ----
const tipsInto = (t: LaidOutCause, id: string) => t.edges.filter(e => e.to === id).map(e => ({from: e.from, tip: e.points[e.points.length - 1], tail: e.points[e.points.length - 2]}));

for (const dir of ['up', 'down', 'right', 'left'] as const) {
  test(`causeTree() dir ${dir} H1: an OR arrow never lands between the arrows of an AND, so the arc covers only its own arrows`, async () => {
    const {t, verdict} = await laidCause(causeTree([N('a'), N('b'), N('c'), N('z')], [{from: ['a', 'c'], to: 'z'}, {from: 'b', to: 'z'}], {dir}));
    assert.deepEqual(verdict.problems, [], dir);
    const along = (p: {x: number; y: number}) => dir === 'up' || dir === 'down' ? p.x : p.y;
    const tips = tipsInto(t, 'z'), order = tips.sort((p, q) => along(p.tip) - along(q.tip)).map(x => x.from);
    assert.ok(order.join('') === 'acb' || order.join('') === 'bac' || order.join('') === 'bca' || order.join('') === 'cab', `a and c are neighbours: ${order}`);
    assert.equal(t.ands.length, 1);
    assert.deepEqual([...t.ands[0].from].sort(), ['a', 'c']);
  });
}

test('causeTree() M1: two ANDs into one effect get separate arcs that do not touch', async () => {
  for (const dir of ['up', 'right'] as const) {
    const {t, verdict} = await laidCause(causeTree([N('a'), N('b'), N('c'), N('d'), N('z')], [{from: ['a', 'b'], to: 'z'}, {from: ['c', 'd'], to: 'z'}], {dir}));
    assert.deepEqual(verdict.problems, [], dir);
    assert.equal(t.ands.length, 2, dir);
    const span = (a: LaidOutCause['ands'][number]) => dir === 'up' ? [a.p0.x, a.p1.x].sort((p, q) => p - q) : [a.p0.y, a.p1.y].sort((p, q) => p - q);
    const [s1, s2] = t.ands.map(span).sort((p, q) => p[0] - q[0]);
    assert.ok(s2[0] - s1[1] >= 6, `${dir}: ${s1} ${s2}`);
  }
});

test('causeTree() M2: an AND of six causes keeps the arrowheads apart in every direction (the effect grows)', async () => {
  for (const dir of ['up', 'right', 'left'] as const) {
    const causes = ['a', 'b', 'c', 'd', 'e', 'f'];
    const {t, verdict} = await laidCause(causeTree([...causes.map(c => N(c)), N('z')], [{from: causes, to: 'z'}], {dir}));
    assert.deepEqual(verdict.problems, [], dir);
    const along = (p: {x: number; y: number}) => dir === 'up' ? p.x : p.y;
    const us = tipsInto(t, 'z').map(x => along(x.tip)).sort((p, q) => p - q);
    for (let i = 1; i < us.length; i++) assert.ok(us[i] - us[i - 1] >= 10, `${dir}: heads ${us}`);
    assert.equal(t.ands.length, 1, dir);
  }
});

test('cloud() H2: a tall A makes the figure taller and keeps the next band below it', async () => {
  const d = diagram({theme: 'blue'}).add(box({id: 'before', title: '前'}), cloud({...FIVE, a: '共通の目的'.repeat(30)}, {}), box({id: 'after', title: '後'}));
  const {laidOut, verdict} = await checkDiagram(d);
  assert.deepEqual(verdict.problems, []);
  const t = laidOut.laidOut.find(b => b.type === 'cloud') as LaidOutCloud, a = t.nodes.find(n => n.key === 'a')!;
  assert.ok(a.y >= t.y - 0.5 && a.y + a.h <= t.y + t.h + 0.5, 'A is inside its band');
  for (const n of t.nodes) assert.ok(n.y >= t.y - 0.5 && n.y + n.h <= t.y + t.h + 0.5);
  const at = (k: string) => t.nodes.find(n => n.key === k)!;
  assert.ok(Math.abs((at('b').y + at('c').y + at('c').h) / 2 - (a.y + a.h / 2)) < 1, 'the rows stay centred beside A');
});

test('cloud() M3: a connector across a cloud whose boxes have no id is caught', async () => {
  const {verdict} = await checkDiagram(diagram({theme: 'blue'}).add(box({id: 'top', title: '上'}), cloud(FIVE, {id: 'cl'}), box({id: 'bot', title: '下'}), connect('top', 'bot')));
  assert.ok(verdict.problems.some(p => /overlaps|runs through|crosses/i.test(p) || p.includes('cloud box')), `got ${JSON.stringify(verdict.problems)}`);
});

test('cloud() M4: conflictLabel is a chip left of the zigzag, checked like the others; a chip that would leave the figure on the right goes to the left', async () => {
  const {t, verdict} = await laidCloud(assumed({conflictLabel: '対立'}));
  assert.deepEqual(verdict.problems, []);
  const dd = t.chips.filter(c => c.arrow === 'dd');
  assert.equal(dd.length, 1);
  assert.equal(dd[0].text, '対立');
  const zig = t.edges.find(e => e.arrow === 'dd')!.points[0].x;
  assert.ok(dd[0].x + dd[0].w < zig);
  const narrow = await checkDiagram(diagram({theme: 'blue', width: 640} as never).add(cloud(FIVE, {assumptions: [{on: 'dd', text: 'a'}, {on: 'dd', text: 'b'}, {on: 'dd', text: 'c'}, {on: 'dd', text: 'd'}]})));
  assert.deepEqual(narrow.verdict.problems, []);
});

test('cloud() L4: a null box is "missing", and the list lines up with the figure', async () => {
  assert.throws(() => cloud({...FIVE, a: null as never}), /box a is missing/);
  assert.throws(() => causeTree([N('a')], null as never), /links must be an array/);
  const {t} = await laidCloud(assumed());
  const left = Math.min(...t.nodes.map(n => n.x));
  assert.ok(t.texts.filter(x => /^\d\.$/.test(x.text)).every(x => x.x === left));
});

// ---- review fixes, round 2 ----
test('causeTree() N1: causes of an AND stay neighbours, so an OR arrow does not cross them (also interleaved ANDs)', async () => {
  for (const dir of ['up', 'down', 'right', 'left'] as const) {
    const a = await laidCause(causeTree([N('a'), N('b'), N('c'), N('z')], [{from: ['a', 'c'], to: 'z'}, {from: 'b', to: 'z'}], {dir}));
    assert.deepEqual(a.verdict.problems, [], dir);
    const b = await laidCause(causeTree([N('a'), N('b'), N('c'), N('d'), N('z')], [{from: ['a', 'c'], to: 'z'}, {from: ['b', 'd'], to: 'z'}], {dir}));
    assert.deepEqual(b.verdict.problems, [], dir);
    assert.equal(b.t.ands.length, 2, dir);
  }
});

test('causeTree() N5: a back edge into an effect that has an AND still lays out, and the AND arc stays on its own arrows', async () => {
  const {t} = await laidCause(causeTree([N('a'), N('b'), N('z'), N('w')], [{from: ['a', 'b'], to: 'z'}, {from: 'z', to: 'w'}, {from: 'w', to: 'z'}]));
  assert.equal(t.edges.length, 4);
  for (const arc of t.ands) assert.deepEqual([...arc.from].sort(), ['a', 'b']);
});

test('cloud() N2/N4: a long conflict label is reported when it sits on an arrow; a label and numbers on the left stack', async () => {
  const long = await laidCloud(assumed({conflictLabel: '両立しない、どちらかしか選べない対立関係にある要望同士の衝突、どうしても譲れない'}));
  assert.ok(long.verdict.problems.some(p => /conflict label/.test(p)), JSON.stringify(long.verdict.problems));
  const narrow = await checkDiagram(diagram({theme: 'blue', width: 640} as never).add(cloud(FIVE, {conflictLabel: '対立', assumptions: [{on: 'dd', text: 'a'}, {on: 'dd', text: 'b'}, {on: 'dd', text: 'c'}, {on: 'dd', text: 'd'}]})));
  assert.deepEqual(narrow.verdict.problems, []);
});

// ---- review fixes, round 3 ----
test('causeTree() R3-1: crossings that no layout can avoid are not a build failure unless they touch an AND', async () => {
  const k23 = causeTree(['a', 'b', 'x', 'y', 'z'].map(i => N(i)), ['x', 'y', 'z'].flatMap(t => ['a', 'b'].map(f => ({from: f, to: t}))));
  const {verdict} = await laidCause(k23);
  assert.deepEqual(verdict.problems, []);
});

test('causeTree() R3-2: an AND cause from another layer never runs side by side with the OR arrow into the same effect; a crossing it cannot avoid is a warning', async () => {
  for (const dir of ['up', 'down', 'right', 'left'] as const) {
    const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue'}).add(causeTree(['x', 'a', 'b', 'c', 'z'].map(i => N(i)), [{from: 'x', to: 'a'}, {from: ['a', 'c'], to: 'z'}, {from: 'b', to: 'z'}, {from: 'x', to: 'b'}], {dir})));
    assert.deepEqual(verdict.problems, [], dir);
    assert.ok(verdict.warnings.every(w => w.startsWith('[cause-crossing]') || !w.includes('cause:')), dir);
    void laidOut;
  }
});

// ---- round 4: a seeded fuzz of acyclic graphs with ANDs: no hard problem in any direction (a layout too wide for the page is the author's to fix) ----
test('causeTree() fuzz: random acyclic graphs with ANDs lay out with no hard problem in every direction', async () => {
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  let laidOutCount = 0;
  for (let g = 0; g < 60; g++) {
    const n = 4 + Math.floor(rnd() * 5), ids = Array.from({length: n}, (_, i) => `n${i}`), links: {from: string | string[]; to: string}[] = [];
    for (let to = 1; to < n; to++) {
      const k = 1 + Math.floor(rnd() * Math.min(3, to)), pool = ids.slice(0, to).sort(() => rnd() - 0.5).slice(0, k);
      if (k > 1 && rnd() < 0.6) links.push({from: pool, to: ids[to]}); else for (const f of pool) links.push({from: f, to: ids[to]});
    }
    for (const dir of ['up', 'down', 'right', 'left'] as const) {
      try {
        const {verdict} = await checkDiagram(diagram({theme: 'blue'}).add(causeTree(ids.map(i => N(i)), links, {dir})));
        assert.deepEqual(verdict.problems, [], `${dir} ${JSON.stringify(links)}`);
        laidOutCount++;
      } catch (e) { if (!/wide but it has/.test(String(e))) throw e; }
    }
  }
  assert.ok(laidOutCount > 150);
});

// ---- declared returns (ADR 0016 D9) ----
test('causeTree() back: a declared return keeps its layer whatever the order of the entities, and is drawn bold', async () => {
  const links = [{from: 'kpi', to: 'start'}, {from: 'start', to: 'wip'}, {from: 'wip', to: 'switch'}, {from: 'switch', to: 'late'}, {from: 'late', to: 'kpi', back: true as const}];
  const ids = ['late', 'switch', 'wip', 'start', 'kpi'];
  const rows = async (order: string[]) => {
    const {t, verdict} = await laidCause(causeTree(order.map(id => N(id)), links, {dir: 'down', maxNodeW: 170}));
    assert.deepEqual(verdict.problems, []);
    const y = (id: string) => t.anchors.find(a => a.id === id)!.y;
    return {order: ids.map(id => y(id)), bold: t.edges.filter(e => e.back).map(e => `${e.from}>${e.to}`)};
  };
  const a = await rows(ids), b = await rows([...ids].reverse());
  assert.deepEqual(a.order, b.order);
  assert.ok(a.order[0] > a.order[4], 'late (the UDE) lies below kpi in a figure that runs down');
  assert.deepEqual(a.bold, ['late>kpi']);
  const {svg} = await renderDiagram(diagram({theme: 'blue'}).add(causeTree(ids.map(id => N(id)), links, {dir: 'down'})), {name: 'b.svg', budget: 'cacheOnly'});
  assert.equal(svg.split('stroke-width="3"').length - 1, 1);
  const plain = await renderDiagram(diagram({theme: 'blue'}).add(causeTree(ids.map(id => N(id)), links.map(({back: _b, ...l}) => l), {dir: 'down'})), {name: 'p.svg', budget: 'cacheOnly'});
  assert.ok(!plain.svg.includes('stroke-width="3"'));
});

test('causeTree() back: not with an AND, not on an arrow that closes no loop, not twice on a loop; a loop left undeclared still lays out', async () => {
  assert.throws(() => causeTree([N('a'), N('b'), N('c')], [{from: ['a', 'b'], to: 'c', back: true}]), /AND.*back: true/);
  await assert.rejects(() => laidCause(causeTree([N('a'), N('b')], [{from: 'a', to: 'b', back: true}])), /a -> b closes no cycle/);
  await assert.rejects(() => laidCause(causeTree([N('a'), N('b')], [{from: 'a', to: 'b', back: true}, {from: 'b', to: 'a', back: true}])), /on one cycle/);
  const {t, verdict} = await laidCause(causeTree([N('a'), N('b'), N('c'), N('d')], [{from: 'a', to: 'b'}, {from: 'b', to: 'a', back: true}, {from: 'b', to: 'c'}, {from: 'c', to: 'd'}, {from: 'd', to: 'c'}]));
  assert.equal(t.edges.length, 5);
  assert.deepEqual(verdict.problems.filter(p => p.startsWith('cause: arrow')), []);
});

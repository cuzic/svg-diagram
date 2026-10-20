import test from 'node:test';
import assert from 'node:assert/strict';
import {banner, bars, box, caption, checkDiagram, closeMeasurer, connect, curve, diagram, grid, group, iconRow, legend, plane, pyramid, raw, row, screens, sequence, spacer, stat, swimlane, table, versus, wireframe} from '../lib/dsl.ts';
import type {Band} from '../lib/dsl.ts';
import {emitSvg} from '../lib/emit.ts';

test.after(() => closeMeasurer());

const stages = async (d: ReturnType<typeof diagram>, n: number) => {
  const {laidOut, verdict} = await checkDiagram(d);
  return {laidOut, verdict, svgs: Array.from({length: n + 1}, (_, i) => emitSvg(laidOut, {reveal: i}))};
};
// what the stage files show, minus <title> / <desc> (they are the same at every stage)
const visible = (svg: string) => svg.replace(/<(title|desc)[^>]*>.*?<\/\1>/gs, '');

// every constructor that takes a reveal keeps it all the way to laidOut
const RECEPTACLES: [string, () => Band | Band[]][] = [
  ['stat', () => stat('42', 'label', {reveal: 2})],
  ['caption', () => caption('c', {reveal: 2})],
  ['bars band', () => bars([{label: 'a', value: 1}], {reveal: 2})],
  ['sequence', () => sequence([{id: 'a', label: 'A'}, {id: 'b', label: 'B'}], [{from: 'a', to: 'b', label: 'x'}], {reveal: 2})],
  ['swimlane', () => swimlane([{id: 'l', label: 'L'}], [{id: 's', lane: 'l', title: 'S'}], {reveal: 2})],
  ['plane', () => plane({x: {max: 1}, y: {max: 1}, reveal: 2})],
  ['table', () => table([{label: 'x'}], [['t']], {reveal: 2})],
  ['box', () => box({title: 'b', reveal: 2})],
  ['banner', () => banner({headline: 'h', reveal: 2})],
  ['group', () => group(box({title: 'g'}), {reveal: 2})],
];
for (const [name, make] of RECEPTACLES) {
  test(`reveal reaches laidOut: ${name}`, async () => {
    const {laidOut} = await checkDiagram(diagram({theme: 'blue'}).add(make() as Band));
    const first = laidOut.laidOut[0];
    assert.equal(first!.type === 'swimlane' || 'reveal' in first! ? (first as {reveal?: number}).reveal : undefined, 2);
    assert.equal(laidOut.maxReveal, 2);
  });
}

test('a swimlane / group reveal carries to the steps and their flows', async () => {
  const {svgs} = await stages(diagram({theme: 'blue'}).add(
    caption('always'),
    swimlane([{id: 'l', label: 'LANE'}], [{id: 's1', lane: 'l', title: 'STEP1'}, {id: 's2', lane: 'l', title: 'STEP2'}], {reveal: 1, flows: [{from: 's1', to: 's2'}]}),
  ), 1);
  assert.doesNotMatch(visible(svgs[0]!), /STEP1|STEP2|LANE|marker-end/);
  assert.match(svgs[1]!, /STEP1/);
  assert.match(svgs[1]!, /LANE/);
  assert.match(svgs[1]!, /marker-end/);
});

test('a caption in a revealed group follows the group', async () => {
  const {svgs} = await stages(diagram({theme: 'blue'}).add(group([caption('INSIDE'), box({title: 'B'})], {reveal: 1})), 1);
  assert.doesNotMatch(visible(svgs[0]!), /INSIDE/);
  assert.match(visible(svgs[1]!), /INSIDE/);
});

test('sequence: reveal hides the whole band until its stage', async () => {
  const {svgs} = await stages(diagram({theme: 'blue'}).add(sequence([{id: 'a', label: 'ALPHA'}, {id: 'b', label: 'BETA'}], [{from: 'a', to: 'b', label: 'x'}], {reveal: 1})), 1);
  assert.doesNotMatch(visible(svgs[0]!), /ALPHA|BETA/);
  assert.match(svgs[1]!, /ALPHA/);
});

test('stat in a row: reveal hides it', async () => {
  const {svgs} = await stages(diagram({theme: 'blue'}).add(row([stat('111', 'first'), stat('222', 'second', {reveal: 1})])), 1);
  assert.match(svgs[0]!, />111</);
  assert.doesNotMatch(svgs[0]!, />222</);
  assert.match(svgs[1]!, />222</);
});

test('plane: points, labels, lines, dims, paths and labels appear at their stage; stage 0 holds nothing later', async () => {
  const d = diagram({theme: 'blue', title: 'plane'}).add(plane({
    x: {max: 10}, y: {max: 10}, height: 320,
    points: [
      {id: 'a', at: [1, 1], label: 'PTA'},
      {id: 'b', at: [5, 5], label: 'PTB', reveal: 1},
      {id: 'c', at: [9, 9], label: 'PTC', reveal: 3},
    ],
    lines: [{from: 'a', to: [1, 0]}, {from: 'b', to: [5, 0]}, {from: 'a', to: 'c', arrow: true}],
    paths: [{through: ['a', 'b'], reveal: 2}],
    dims: [{from: 'a', to: 'b', label: 'DIMAB', side: 'below'}],
    labels: [{at: [3, 8], text: 'NOTE', reveal: 2}],
  }));
  const {laidOut, svgs, verdict} = await stages(d, 3);
  const p = laidOut.laidOut[0];
  assert.equal(p!.type, 'plane');
  if (p!.type !== 'plane') return;
  assert.deepEqual(p!.points.map(x => x.reveal ?? 0), [0, 1, 3]);
  assert.deepEqual(p!.lines.map(x => x.reveal ?? 0), [0, 1, 3], 'a line takes the later end; a coordinate counts 0');
  assert.equal(p!.dims[0]!.reveal, 1);
  assert.equal(p!.paths![0]!.reveal, 2);
  assert.deepEqual(verdict.warnings.filter(w => /earlier than an endpoint/.test(w)), []);
  const s0 = visible(svgs[0]!), s1 = visible(svgs[1]!), s2 = visible(svgs[2]!);
  assert.match(s0, />PTA</);
  for (const later of ['PTB', 'PTC', 'DIMAB', 'NOTE']) assert.doesNotMatch(s0, new RegExp(`>${later}<`));
  assert.match(s1, />PTB</);
  assert.match(s1, />DIMAB</);
  assert.doesNotMatch(s1, />NOTE<|>PTC</);
  assert.match(s2, />NOTE</);
  assert.doesNotMatch(s2, />PTC</);
  assert.match(visible(svgs[3]!), />PTC</);
  const circles = (s: string) => s.match(/<circle/g)?.length ?? 0;
  assert.deepEqual(svgs.map(circles), [1, 2, 2, 3]);
  assert.equal(new Set(svgs.map(s => s.match(/viewBox="[^"]+"/)?.[0])).size, 1);
});

test('plane: an element never appears before the plane; an explicit reveal earlier than an endpoint warns', async () => {
  const d = diagram({theme: 'blue'}).add(plane({
    x: {max: 10}, y: {max: 10}, reveal: 2,
    points: [{id: 'a', at: [1, 1], reveal: 1}, {id: 'b', at: [5, 5], reveal: 4}],
    lines: [{from: 'a', to: 'b', reveal: 3}],
  }));
  const {laidOut, verdict} = await checkDiagram(d);
  const p = laidOut.laidOut[0];
  if (p!.type !== 'plane') throw new Error('plane');
  assert.deepEqual(p!.points.map(x => x.reveal), [2, 4], 'a point is not earlier than its plane');
  assert.equal(p!.lines[0]!.reveal, 3, 'the explicit one wins, with a warning');
  assert.match(verdict.warnings.join('\n'), /plane\(\) line 1 \(a -> b\) reveal 3 is earlier than an endpoint \(reveal 4\)/);
});

test('versus: a reveal on the right side hides its text and the arrow to the shared part', async () => {
  const d = diagram({theme: 'blue'}).add(versus(
    {id: 'l', title: 'LEFTT', children: box({title: 'LEFTBOX'})},
    {id: 'r', title: 'RIGHTT', children: box({title: 'RIGHTBOX'}), reveal: 2},
    {shared: {id: 's', title: 'SHAREDT', children: box({title: 'SHAREDBOX'}), reveal: 3}, connectLabels: {left: 'LCON', right: 'RCON'}},
  ));
  const {laidOut, svgs} = await stages(d, 3);
  assert.deepEqual(laidOut.connects.map(c => c.reveal), [3, 3]);
  const s0 = visible(svgs[0]!), s1 = visible(svgs[1]!), s2 = visible(svgs[2]!);
  for (const t of ['RIGHTT', 'RIGHTBOX', 'SHAREDT', 'SHAREDBOX', 'LCON', 'RCON']) assert.doesNotMatch(s0, new RegExp(t));
  assert.match(s1, /LEFTBOX/);
  assert.doesNotMatch(s1, /RIGHTBOX/);
  assert.match(s2, /RIGHTBOX/);
  assert.doesNotMatch(s2, /SHAREDBOX|marker-end/);
  assert.match(visible(svgs[3]!), /SHAREDBOX/);
  assert.match(svgs[3]!, /marker-end/);
});

test('constructors without a reveal throw on one (a JS caller is told)', () => {
  const nothing: [string, () => unknown][] = [
    ['legend', () => legend([{tone: 'accent', label: 'x'}], {reveal: 1} as never)],
    ['spacer', () => (spacer as (h: number, o: object) => unknown)(10, {reveal: 1})],
    ['raw', () => raw({draw: () => '', reveal: 1} as never)],
    ['pyramid', () => pyramid(['a', 'b'], {reveal: 1} as never)],
    ['curve', () => curve([{y: 0}, {y: 1}], {reveal: 1} as never)],
    ['wireframe', () => wireframe([], {reveal: 1} as never)],
    ['screens', () => screens([], {reveal: 1} as never)],
    ['row', () => row([box({title: 'a'})], {reveal: 1} as never)],
    ['grid', () => grid([box({title: 'a'})], {cols: 1, reveal: 1} as never)],
    ['row', () => iconRow([{icon: 'person', label: 'a'}], {reveal: 1} as never)],
  ];
  for (const [name, make] of nothing) assert.throws(make, new RegExp(`${name}\\(\\): takes no reveal`), name);
  assert.doesNotThrow(() => spacer(10));
  assert.doesNotThrow(() => legend([{tone: 'accent', label: 'x'}]));
});

test('bars band id: a spotlight target (its bars too) and a connect endpoint; ids may not repeat', async () => {
  const mk = (spotlight: string) => diagram({theme: 'blue', spotlight}).add(
    bars([{id: 'b1', label: 'a', value: 1}, {id: 'b2', label: 'b', value: 2}], {id: 'chart', dir: 'v'}),
    box({id: 'other', title: 'other'}),
    connect('chart:bottom', 'other:top'),
  );
  const band = await checkDiagram(mk('chart'));
  const chart = band.laidOut.laidOut.find(b => b.type === 'bars');
  assert.equal(chart?.type === 'bars' && chart.id, 'chart');
  assert.ok(!chart?.dim);
  assert.ok(chart?.type === 'bars' && chart.bars.every(r => !r.dim), 'the whole band is the spotlight');
  assert.ok(!band.laidOut.connects[0]!.dim, 'an arrow touching the focused band stays');
  const bar = await checkDiagram(mk('b2'));
  const c2 = bar.laidOut.laidOut.find(b => b.type === 'bars');
  assert.deepEqual(c2?.type === 'bars' && c2.bars.map(r => r.dim), [true, false], 'one bar by its own id');
  assert.throws(() => bars([{id: 'x', label: 'a', value: 1}], {id: 'x'}), /band's id "x" is also a bar's id/);
  assert.rejects(checkDiagram(diagram({theme: 'blue'}).add(bars([{label: 'a', value: 1}], {id: 'k'}), box({id: 'k', title: 'k'}))), /duplicate anchor id "k"/);
  assert.rejects(checkDiagram(diagram({theme: 'blue', spotlight: 'nope'}).add(bars([{label: 'a', value: 1}], {id: 'k'}))), /unknown anchor id/);
});

test('plane id: a spotlight target and a connect endpoint', async () => {
  const d = diagram({theme: 'blue', spotlight: 'fig'}).add(
    plane({id: 'fig', x: {max: 1}, y: {max: 1}}),
    box({id: 'n', title: 'n'}),
    connect('fig:bottom', 'n:top'),
  );
  const {laidOut} = await checkDiagram(d);
  const p = laidOut.laidOut.find(b => b.type === 'plane');
  assert.equal(p?.type === 'plane' && p.id, 'fig');
  assert.ok(!p?.dim);
  const n = laidOut.laidOut.find(b => b.type === 'box');
  assert.equal(n?.dim, true);
});

test('stat reveal in a row, bars band reveal hides its axis and texts', async () => {
  const {svgs} = await stages(diagram({theme: 'blue'}).add(caption('ALWAYS'), bars([{label: 'BARLABEL', value: 1}], {reveal: 1})), 1);
  assert.doesNotMatch(visible(svgs[0]!), /BARLABEL/);
  assert.match(svgs[1]!, /BARLABEL/);
});

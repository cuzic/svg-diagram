import test from 'node:test';
import assert from 'node:assert/strict';
import {checkDiagram, closeMeasurer, diagram, flowchart, stateDiagram} from '../lib/dsl.ts';
import {diamondLines, diamondPoints, ontoDiamond, pillLines, vertexDrops} from '../lib/flow-nodes.ts';
import {statesWords} from '../lib/states-words.ts';
import {ROLES} from '../lib/tokens.ts';
import type {LaidOutStates} from '../lib/types/diagrams.ts';

test.after(() => closeMeasurer());

const NODES = [
  {id: 's', kind: 'terminator', label: '相談'},
  {id: 'q1', kind: 'decision', label: '自分で答えられる？'},
  {id: 'a1', label: '回答する'},
  {id: 'q2', kind: 'decision', label: '期限までに先輩へ確認できる見込みがある？'},
  {id: 'a2', label: '先輩に確認する', sub: '当日中'},
  {id: 'a3', label: '上司に相談する'},
] as const;
const EDGES = [{from: 's', to: 'q1'}, {from: 'q1', to: 'a1', label: 'Yes'}, {from: 'q1', to: 'q2', label: 'No'}, {from: 'q2', to: 'a2', label: 'Yes'}, {from: 'q2', to: 'a3', label: 'No'}];
const lay = async (opts = {}, edges = EDGES) => {
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue', title: 't'}).add(flowchart(NODES, edges, opts)));
  return {band: laidOut.laidOut.find((b): b is LaidOutStates => b.type === 'states')!, verdict};
};
const widthOf = (a: string, size: number) => [...a].length * size; // every character a full-width em
const roles = ROLES;

test('a decision is a diamond that holds its text, a terminator a pill; the rest are boxes', async () => {
  const {band, verdict} = await lay();
  assert.deepEqual(verdict.problems, []);
  assert.deepEqual(band.nodes.map(n => n.shape), ['pill', 'diamond', undefined, 'diamond', undefined, undefined]);
  for (const n of band.nodes.filter(n => n.shape === 'diamond')) assert.ok(n.w > n.h * 1.5 && n.w % 8 === 0 && n.h % 8 === 0, `${n.w}x${n.h}`);
});

test('the flow runs down unless dir says otherwise; a flowchart is not an explicit dir', async () => {
  const down = (await lay()).band, right = (await lay({dir: 'right'})).band;
  const ys = (b: LaidOutStates) => b.nodes.map(n => n.y), xs = (b: LaidOutStates) => b.nodes.map(n => n.x);
  assert.ok(Math.max(...ys(down)) - Math.min(...ys(down)) > Math.max(...xs(down)) - Math.min(...xs(down)) - 1, 'down: taller than wide');
  assert.ok(Math.max(...xs(right)) - Math.min(...xs(right)) > Math.max(...ys(right)) - Math.min(...ys(right)), 'right: wider than tall');
  assert.equal(flowchart(NODES, EDGES).dir, undefined);
  assert.equal(flowchart(NODES, EDGES).defaultDir, 'down');
});

test('an arrow that meets a diamond ends on its outline, not off the rect side', async () => {
  const {band} = await lay();
  const ends = (id: string) => band.edges.flatMap(e => e.from === id ? [e.points[0]!] : e.to === id ? [e.points[e.points.length - 1]!] : []);
  for (const [i, n] of band.nodes.entries()) {
    if (n.shape !== 'diamond') continue;
    for (const p of ends(band.anchors[i]!.id)) {
      const d = Math.abs(p.x - (n.x + n.w / 2)) / (n.w / 2) + Math.abs(p.y - (n.y + n.h / 2)) / (n.h / 2); // 1 on the outline
      assert.ok(Math.abs(d - 1) * Math.min(n.w, n.h) / 2 < 1, `${band.anchors[i]!.id}: ${d}`);
    }
  }
});

test('a diamond does not get wider when the lines of text it may take are capped (the narrowest of several wraps wins)', () => {
  const w = (cap: number) => diamondLines('期限までに先輩へ確認できる見込みがある？', undefined, cap, 0, widthOf, roles, 'phrase', false).w;
  const widths = [1000, 260, 200, 160, 130].map(w);
  for (let i = 1; i < widths.length; i++) assert.ok(widths[i]! >= widths[i - 1]!, `a smaller cap cannot make it narrower than a larger one: ${widths}`); // capping only removes choices
});

test('diamondLines holds its text inscribed; pillLines leaves room for the rounding; ontoDiamond moves an end onto the outline', () => {
  const l = diamondLines('自分で答えられる？', 'メモ', 200, 28, widthOf, roles, 'phrase', false);
  const th = l.label.length * Math.round(roles.body * 1.4) + l.sub.length * Math.round(roles.note * 1.4) + 28;
  const tw = Math.max(...l.label.map(t => [...t].length * roles.body), ...l.sub.map(t => [...t].length * roles.note));
  assert.ok((tw + 16) / l.w + (th + 12) / l.h <= 1.0001, `${tw}x${th} in ${l.w}x${l.h}`);
  const base = {label: ['短い'], sub: [], w: 88, h: 36};
  assert.equal(pillLines(base, 0).h, 36);
  assert.ok(pillLines(base, 0).w > 88);
  assert.equal(diamondPoints({x: 0, y: 0, w: 80, h: 40}).length, 4);
  const r = {x: 0, y: 0, w: 80, h: 40};
  assert.deepEqual(ontoDiamond({x: 40, y: 0}, {x: 40, y: -20}, r), {x: 40, y: 0}); // at the vertex: unchanged
  assert.deepEqual(ontoDiamond({x: 20, y: 0}, {x: 20, y: -20}, r), {x: 20, y: 10}); // 20 off the vertex: the outline is 10 down
  assert.deepEqual(ontoDiamond({x: 60, y: 40}, {x: 60, y: 60}, r), {x: 60, y: 30});
  assert.deepEqual(ontoDiamond({x: 0, y: 10}, {x: -20, y: 10}, r), {x: 20, y: 10}); // a horizontal end on the left
  assert.deepEqual(ontoDiamond({x: 5, y: 5}, {x: 9, y: 9}, r), {x: 5, y: 5}); // not orthogonal: left alone
});

test('messages say flowchart / node / arrow, not stateDiagram / state / transition', async () => {
  await assert.rejects(checkDiagram(diagram({theme: 'blue'}).add(flowchart([{id: 'a', label: 'a'}, {id: 'b', label: 'b'}], [{from: 'a', to: 'z'}]) as never)), /flowchart\(\): arrow a -> z names unknown node "z"/);
  await assert.rejects(checkDiagram(diagram({theme: 'blue'}).add(flowchart([{id: 'a', label: 'a'}, {id: 'a', label: 'b'}], []))), /flowchart\(\): duplicate node id "a"/);
  assert.throws(() => flowchart([{id: 'a', label: 'a', final: true} as never], []), /unknown option 'final'/);
  assert.throws(() => flowchart([{id: 'a', label: 'a', kind: 'box' as never}], []), /kind box/);
  assert.throws(() => flowchart([{id: 'a', label: 'a'}], [], {initial: 'a'} as never), /no `initial`/);
  assert.deepEqual([statesWords('flowchart').who, statesWords(undefined).who], ['flowchart()', 'stateDiagram()']);
});

test('stateDiagram takes the new shapes, but not with final or a self loop', () => {
  assert.ok(stateDiagram([{id: 'a', label: 'a', shape: 'diamond'}, {id: 'b', label: 'b', shape: 'pill'}], [{from: 'a', to: 'b'}]));
  assert.throws(() => stateDiagram([{id: 'a', label: 'a', shape: 'diamond', final: true}], []), /diamond and final/);
  assert.throws(() => stateDiagram([{id: 'a', label: 'a', shape: 'pill'}], [{from: 'a', to: 'a'}]), /cannot loop to itself/);
});

test('a decision with one arrow out, or arrows without Yes / No, is told so (info)', async () => {
  const bare = (await lay({}, [{from: 's', to: 'q1'}, {from: 'q1', to: 'a1'}, {from: 'q1', to: 'q2'}, {from: 'q2', to: 'a2', label: 'Yes'}, {from: 'q2', to: 'a3', label: 'No'}])).verdict.findings.filter(f => f.rule === 'flowchart-decision-edges');
  assert.equal(bare.length, 1);
  assert.match(bare[0]!.message, /q1.*ラベルがない/);
  const one = (await lay({}, [{from: 's', to: 'q1'}, {from: 'q1', to: 'a1', label: 'Yes'}, {from: 'q2', to: 'a2', label: 'Yes'}, {from: 'q2', to: 'a3', label: 'No'}])).verdict.findings.filter(f => f.rule === 'flowchart-decision-edges');
  assert.match(one.map(f => f.message).join('\n'), /q1.*1 本/);
  assert.deepEqual((await lay()).verdict.findings.filter(f => f.rule === 'flowchart-decision-edges'), []);
});

test('a return to an earlier decision goes round the outside by default (it does not run through the nodes between)', async () => {
  const {band, verdict} = await lay({}, [...EDGES, {from: 'a2', to: 'q1', label: 'やり直し', line: 'dashed'} as never]);
  assert.deepEqual(verdict.problems, []);
  assert.ok(band.edges.some(e => e.from === 'a2' && e.to === 'q1'));
});

test('the arrows that drop from a decision start at its corners, one answer each; a target not under a corner keeps the path', () => {
  const r = {x: 100, y: 0, w: 80, h: 40}; // corners at x 100 / 140 / 180, y 20
  const out = (cx: number, w = 60) => ({pts: [{x: cx + 5, y: 38}, {x: cx + 5, y: 100}], target: {x: cx - w / 2, y: 100, w, h: 36}});
  const two = vertexDrops([out(110), out(170)], r, []);
  assert.deepEqual(two, [[{x: 100, y: 20}, {x: 100, y: 100}], [{x: 180, y: 20}, {x: 180, y: 100}]]);
  const three = vertexDrops([out(100), out(140), out(180)], r, []);
  assert.deepEqual(three.map(p => p[0]!.x), [100, 140, 180]);
  const one = vertexDrops([out(140)], r, []);
  assert.deepEqual(one, [[{x: 140, y: 20}, {x: 140, y: 100}]]);
  const far = [out(110), out(300)], kept = vertexDrops(far, r, []); // the right target is nowhere near the right corner
  assert.deepEqual(kept, far.map(o => o.pts));
  const blocked = vertexDrops([out(110), out(170)], r, [{x: 90, y: 50, w: 20, h: 20}]); // something stands on the left corner's way
  assert.deepEqual(blocked[0], [{x: 115, y: 38}, {x: 115, y: 100}]);
  const bent = vertexDrops([{pts: [{x: 110, y: 38}, {x: 110, y: 60}, {x: 200, y: 60}, {x: 200, y: 100}], target: {x: 170, y: 100, w: 60, h: 36}}, out(170)], r, []);
  assert.equal(bent[0]!.length, 4, 'a bent path is not touched, and the others stay put with it');
});

test('in a flowchart the answers leave a decision from its corners', async () => {
  const {band} = await lay();
  const q1 = band.nodes[1]!, id = band.anchors[1]!.id;
  const starts = band.edges.filter(e => e.from === id).map(e => e.points[0]!);
  assert.deepEqual(starts.map(p => p.y), [q1.y + q1.h / 2, q1.y + q1.h / 2]);
  assert.deepEqual(starts.map(p => p.x).sort((a, b) => a - b), [q1.x, q1.x + q1.w]);
});

test('a return that comes in on the side where an answer leaves from the corner ends a little above that corner', async () => {
  // the lane the return takes (left or right of the figure) is the layout's choice: whichever side it comes in from, it must not meet an answer's corner
  const answers = [...EDGES].filter(e => e.from === 'q1');
  for (const extra of [{from: 'a1', to: 'q1', label: 'やり直し'}, {from: 'a2', to: 'q1', label: 'やり直し'}]) {
    const {band, verdict} = await lay({}, [...EDGES, extra]);
    assert.deepEqual(verdict.problems, []);
    const q1 = band.nodes[1]!, cy = q1.y + q1.h / 2;
    const back = band.edges.find(e => e.from === extra.from && e.to === 'q1')!, tip = back.points[back.points.length - 1]!;
    for (const e of band.edges.filter(e => e.from === 'q1')) assert.ok(Math.hypot(tip.x - e.points[0]!.x, tip.y - e.points[0]!.y) > 8, `the return ends at ${tip.x},${tip.y}, on an answer's start ${e.points[0]!.x},${e.points[0]!.y}`);
    assert.equal(answers.length, 2);
    assert.ok(band.edges.filter(e => e.from === 'q1').every(e => e.points[0]!.y === cy), 'the answers still leave from the corners');
  }
  // the e.ts shape of the report: the return comes in from the left, where the Yes answer leaves
  const left = await lay({}, [{from: 's', to: 'q1'}, {from: 'q1', to: 'a1', label: 'Yes'}, {from: 'q1', to: 'q2', label: 'No'}, {from: 'q2', to: 'a2', label: 'Yes'}, {from: 'q2', to: 'a3', label: 'No'}, {from: 'a2', to: 'q1', label: 'やり直し'}]);
  const back = left.band.edges.find(e => e.from === 'a2' && e.to === 'q1')!, q1 = left.band.nodes[1]!, tip = back.points[back.points.length - 1]!;
  assert.ok(tip.x > q1.x && tip.x < q1.x + q1.w, 'it ends on the outline of the diamond');
});

test('dir right: a return that comes in on a vertex where an answer leaves ends a little before it (the same rule as down, turned)', async () => {
  const nodes = [{id: 's', kind: 'terminator', label: '開始'}, {id: 'q1', kind: 'decision', label: '自分で答えられる？'}, {id: 'a1', label: '回答する', sub: '当日中に\n丁寧に'}, {id: 'a2', label: '先輩に確認する', sub: '当日中に\n丁寧に'}, {id: 'b2', label: '調べる'}, {id: 'c2', label: '試す'}, {id: 'e', kind: 'terminator', label: '終了'}] as const;
  const edges = [{from: 's', to: 'q1'}, {from: 'q1', to: 'a1', label: 'Yes'}, {from: 'q1', to: 'a2', label: 'No'}, {from: 'a2', to: 'b2'}, {from: 'b2', to: 'c2'}, {from: 'c2', to: 'q1', label: 'やり直し'}, {from: 'a1', to: 'e'}];
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue', title: 't', width: 1400}).add(flowchart(nodes, edges, {dir: 'right'})));
  const band = laidOut.laidOut.find((b): b is LaidOutStates => b.type === 'states')!;
  assert.deepEqual(verdict.problems, []);
  const id = band.anchors[1]!.id, back = band.edges.find(e => e.from === 'c2' && e.to === id)!, tip = back.points[back.points.length - 1]!;
  for (const e of band.edges.filter(e => e.from === id)) assert.ok(Math.hypot(tip.x - e.points[0]!.x, tip.y - e.points[0]!.y) > 8, `the return ends at ${tip.x},${tip.y}, on an answer's start ${e.points[0]!.x},${e.points[0]!.y}`);
});

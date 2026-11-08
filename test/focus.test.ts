// ADR 0051: `focus` ("you are here") on every band that has items, and 'solid' / 'solid-danger' items with white text.
import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/strict-width.ts';
import {bpmn, causeTree, checkDiagram, chevron, classDiagram, closeMeasurer, cycle, diagram, emblem, flowchart, funnel, pdpc, renderDiagram, stateDiagram, steps, swimlane, valueChain} from '../lib/dsl.ts';
import {graphTones, litLink, resolveFocus, sequenceTones} from '../lib/focus.ts';
import {tonedHead} from '../lib/emit-common.ts';
import {PALETTE, colorOf} from '../lib/tokens.ts';
import type {Band} from '../lib/types/index.ts';

test.after(() => closeMeasurer());

const accent = colorOf('accent', 'blue');
const svgOf = async (...bands: (Band | Band[])[]) => (await renderDiagram(diagram({theme: 'blue', legend: false}).add(...bands.flat()), {name: 'f.svg', budget: 'cacheOnly'})).svg;
const whiteText = (svg: string, text: string) => new RegExp(`fill="${PALETTE.bg}">${text}</text>`).test(svg);

test('resolveFocus: ids, 1-based numbers (sequences only), lists; anything else names what can be named', () => {
  assert.deepEqual([...resolveFocus('b', ['a', 'b', 'c'], 'x()')], [1]);
  assert.deepEqual([...resolveFocus(['a', 'c'], ['a', 'b', 'c'], 'x()')], [0, 2]);
  assert.deepEqual([...resolveFocus(2, [undefined, undefined], 'x()', true)], [1]);
  assert.deepEqual([...resolveFocus(['q', 1], ['p', 'q'], 'x()', true)], [1, 0]);
  assert.throws(() => resolveFocus('z', ['a', 'b'], 'x()'), /x\(\): focus "z" is not the id of an item \(the ids: a, b\)/);
  assert.throws(() => resolveFocus(2, ['a', 'b'], 'x()'), /names its items by id/);
  assert.throws(() => resolveFocus(3, ['a', 'b'], 'x()', true), /focus 3 is not an item number 1\.\.2/);
  assert.throws(() => resolveFocus('z', [undefined], 'x()', true), /no item has an id: give it one, or use its number 1\.\.1/);
  assert.throws(() => resolveFocus([], ['a'], 'x()'), /got an empty list/);
  assert.throws(() => resolveFocus([{}] as never, ['a'], 'x()'), /or a list of them/);
});

test('graphTones / sequenceTones / litLink: solid, the items one link away accent (either direction), the rest muted', () => {
  assert.deepEqual(graphTones(4, [[0, 1], [2, 1], [2, 3]], new Set([1])), ['accent', 'solid', 'accent', 'muted']);
  assert.deepEqual(sequenceTones(3, new Set([2])), ['muted', 'muted', 'solid']);
  assert.equal(litLink(0, 1, new Set([1])), true);
  assert.equal(litLink(0, 2, new Set([1])), false);
});

test('tonedHead: a plain connector in accent / muted / danger gets a head of that colour; dimmed, strong, double or headless ones do not', () => {
  assert.equal(tonedHead({tone: 'accent'}), 'accent');
  assert.equal(tonedHead({tone: 'muted', arrow: 'end'}), 'muted');
  assert.equal(tonedHead({tone: 'text'}), undefined);
  assert.equal(tonedHead({}), undefined);
  for (const c of [{dim: true}, {weight: 'strong'}, {line: 'double'}, {arrow: 'none'}]) assert.equal(tonedHead({tone: 'accent', ...c}), undefined);
});

test('stateDiagram / flowchart focus: states and arrows', async () => {
  const s = stateDiagram([{id: 'a', label: 'A'}, {id: 'b', label: 'B'}, {id: 'c', label: 'C'}, {id: 'd', label: 'D'}],
    [{from: 'a', to: 'b'}, {from: 'b', to: 'c'}, {from: 'c', to: 'd', tone: 'danger'}], {focus: 'b'});
  assert.deepEqual(s.states.map(x => x.tone), ['accent', 'solid', 'accent', 'muted']);
  assert.deepEqual(s.transitions.map(t => t.tone), ['accent', 'accent', 'muted'], 'focus decides the arrows too');
  const f = flowchart([{id: 's', kind: 'terminator', label: 'S'}, {id: 'q', kind: 'decision', label: 'Q?'}, {id: 'e', label: 'E'}], [{from: 's', to: 'q'}, {from: 'q', to: 'e'}], {focus: 'q'});
  assert.deepEqual(f.states.map(x => x.tone), ['accent', 'solid', 'accent']);
  assert.ok(whiteText(await svgOf(f), 'Q\\?'));
  assert.throws(() => stateDiagram([{id: 'a', label: 'A'}], [], {focus: 'zz'}), /stateDiagram\(\): focus "zz"/);
});

test('causeTree / pdpc focus: the boxes, and the arrows (an AND arc too) lit or muted', async () => {
  const c = causeTree([{id: 'r', label: '根', role: 'root'}, {id: 'm', label: '中'}, {id: 'u', label: '結果', role: 'ude'}, {id: 'o', label: '他'}, {id: 'p', label: '別'}],
    [{from: 'r', to: 'm'}, {from: ['m', 'o'], to: 'u'}, {from: 'p', to: 'o'}], {focus: 'm'});
  assert.deepEqual(c.nodes.map(n => n.tone), ['accent', 'solid', 'accent', 'muted', 'muted']);
  assert.deepEqual(c.focused, ['m']);
  const {laidOut} = await checkDiagram(diagram({theme: 'blue', legend: false}).add(c));
  const lo = laidOut.laidOut.find(b => b.type === 'cause');
  assert.deepEqual(lo && 'focused' in lo ? lo.focused : undefined, ['m'], 'layout carries it to the emitter');
  const svg = await svgOf(c);
  assert.ok(whiteText(svg, '中'), 'white text on the filled box');
  assert.ok(svg.includes(`stroke="${accent}"`) && svg.includes(`stroke="${PALETTE.muted}"`), 'lit and muted arrows');
  const p = pdpc([{id: 's', label: '開始', role: 'start'}, {id: 'k', label: '工程'}, {id: 'x', label: '危険', role: 'risk'}, {id: 'g', label: '完了', role: 'goal'}],
    [{from: 's', to: 'k'}, {from: 'k', to: 'g'}, {from: 'k', to: 'x'}], {focus: 'x'});
  assert.deepEqual(p.nodes.map(n => n.tone), ['muted', 'accent', 'solid', 'muted']);
  assert.ok(whiteText(await svgOf(p), '危険'), 'a filled risk hexagon has white text');
});

test('classDiagram / bpmn focus: tones, lit edges, white text, a gateway mark in white', async () => {
  const c = classDiagram([{id: 'A'}, {id: 'B'}, {id: 'C'}], [{from: 'B', to: 'A', kind: 'inherit'}, {from: 'C', to: 'A', kind: 'inherit'}], {focus: 'B'});
  assert.deepEqual(c.classes.map(x => x.tone), ['accent', 'solid', 'muted']);
  const cs = await svgOf(c);
  assert.ok(whiteText(cs, 'B'));
  assert.ok(cs.includes(`stroke="${accent}"`));
  const b = bpmn([{id: 'l', label: 'L'}], [{id: 's', lane: 'l', kind: 'start'}, {id: 't', lane: 'l', label: '作業'}, {id: 'g', lane: 'l', kind: 'xor', label: '判断'}, {id: 'u', lane: 'l', label: '別'}],
    [{from: 's', to: 't'}, {from: 't', to: 'g'}, {from: 'g', to: 'u'}], {focus: 'g'});
  assert.deepEqual(b.nodes.map(n => n.tone), ['muted', 'accent', 'solid', 'accent']);
  assert.deepEqual(b.focused, ['g']);
  assert.match(await svgOf(b), new RegExp(`fill="none" stroke="${PALETTE.bg}" stroke-width="3"`), "the gateway's mark is white on the fill");
});

test('swimlane focus: steps and flows, the flow heads in the flow colour', async () => {
  const sw = swimlane([{id: 'x', label: 'X'}, {id: 'y', label: 'Y'}], [{id: 'a', lane: 'x', title: 'A', col: 1}, {id: 'b', lane: 'y', title: 'B', col: 2}, {id: 'c', lane: 'x', title: 'C', col: 3}, {id: 'd', lane: 'x', title: 'D', col: 4}],
    {flows: [{from: 'a', to: 'b'}, {from: 'b:right', to: 'c'}, {from: 'c', to: 'd'}], focus: 'b'});
  const lane = sw.find(b => b.type === 'swimlane');
  assert.deepEqual(lane && lane.type === 'swimlane' ? lane.steps.map(s => s.tone) : [], ['accent', 'solid', 'accent', 'muted']);
  assert.deepEqual(sw.filter(b => b.type === 'connect').map(c => c.type === 'connect' ? c.tone : ''), ['accent', 'accent', 'muted']);
  const svg = await svgOf(sw);
  assert.match(svg, /<marker id="dsl-arrow-accent"/);
  assert.match(svg, /<marker id="dsl-arrow-muted"/);
  assert.match(svg, /marker-end="url\(#dsl-arrow-muted\)"/);
});

test('sequences: chevron / funnel / cycle / steps / emblem / valueChain take an id or a 1-based number; the focused item filled, white text', async () => {
  const ch = chevron([{label: '計画'}, {label: '実装', sub: '小さく'}, {label: '検証'}], {focus: 2});
  assert.deepEqual(ch.steps.map(s => s.tone), ['muted', 'solid', 'muted']);
  assert.equal('focus' in ch, false, 'the band does not keep focus: the tones carry it');
  const chSvg = await svgOf(ch);
  assert.ok(whiteText(chSvg, '実装') && whiteText(chSvg, '小さく'));
  const fu = funnel([{label: '全体', id: 'all'}, {label: '一次'}, {label: '採用'}], {focus: 'all'});
  assert.deepEqual(fu.stages.map(s => s.tone), ['solid', 'muted', 'muted']);
  assert.ok(whiteText(await svgOf(fu), '全体'));
  const cy = cycle([{label: 'P'}, {label: 'D'}, {label: 'C'}], {focus: 3});
  assert.ok(whiteText(await svgOf(cy), 'C'), 'a filled circle');
  const st = steps([{title: '見せる'}, {title: '決める'}, {title: '渡す'}], {numbered: true, focus: 2});
  assert.deepEqual(st.children.map(c => c.type === 'box' ? c.tone : ''), ['muted', 'solid', 'muted']);
  const em = emblem([{label: '品質', id: 'q'}, {label: '速さ', id: 's'}], {focus: 's'});
  assert.ok(whiteText(await svgOf(em), '速さ'));
  const vc = valueChain({support: ['人事'], primary: [{label: '購買', id: 'buy'}, '製造']}, {focus: 'buy'});
  assert.deepEqual([...vc.support, ...vc.primary].map(s => s.tone), ['muted', 'solid', 'muted']);
  assert.deepEqual(valueChain({support: ['人事'], primary: ['購買']}, {focus: 1}).support.map(s => s.tone), ['solid'], 'numbers count the support activities first');
});

test('focus and the older marks of one step do not mix; solid tones are taken directly', () => {
  assert.throws(() => chevron([{label: 'a'}, {label: 'b'}], {current: 0, focus: 1}), /current \/ highlight and focus both mark a step/);
  assert.throws(() => steps([{title: 'a'}, {title: 'b'}], {highlight: 1, focus: 2}), /highlight and focus both mark a step/);
  assert.throws(() => chevron([{label: 'a'}, {label: 'b'}], {focus: 'nope'}), /chevron\(\): focus "nope" is not the id of an item \(no item has an id: give it one, or use its number 1\.\.2\)/);
  assert.doesNotThrow(() => chevron([{label: 'a', tone: 'solid'}, {label: 'b', tone: 'solid-danger'}]));
  assert.doesNotThrow(() => classDiagram([{id: 'A', tone: 'solid'}], []));
});

// ---- the review's findings (ADR 0051) ----
import {box, connect, swimlane as swimlaneFn, tree} from '../lib/dsl.ts';
import {usedNotation} from '../lib/rules.ts';

test('funnel: the growth rate under the label of a filled stage is white', async () => {
  const fu = funnel([{label: '全体', value: 1000}, {label: '一次', value: 400}, {label: '採用', value: 40}], {scale: 'value', showRate: true, width: 200, focus: 2});
  const svg = await svgOf(fu);
  assert.ok(whiteText(svg, '一次'));
  // the rate of the filled stage: left of the shape (text-anchor end) it stays muted; under the label (inside the fill) it is white
  const rate = svg.match(/<text[^>]*>40%<\/text>/)?.[0] ?? '';
  assert.ok(rate.includes('text-anchor="end"') ? rate.includes(`fill="${PALETTE.muted}"`) : rate.includes(`fill="${PALETTE.bg}"`), rate);
  const narrow = await svgOf(funnel([{label: '全体の候補者', value: 1000}, {label: '一次面接の通過者', value: 400}, {label: '採用', value: 40}], {scale: 'value', showRate: true, width: 160, focus: 2}));
  const inside = narrow.match(/<text[^>]*>40%<\/text>/)?.[0] ?? '';
  assert.ok(inside.includes('text-anchor="end"') ? inside.includes(`fill="${PALETTE.muted}"`) : inside.includes(`fill="${PALETTE.bg}"`), inside);
});

test('bpmn: an iconTone does not vanish on a filled task (the icon is white there)', async () => {
  const b = bpmn([{id: 'l', label: 'L'}], [{id: 't', lane: 'l', label: '作業', icon: 'user', iconTone: 'accent'}], [], {focus: 't'});
  const svg = await svgOf(b);
  assert.ok(!new RegExp(`<g[^>]*fill="${accent}"[^>]*>\\s*<path`).test(svg) || svg.includes(PALETTE.bg));
});

test('swimlane: focus on a step with its own text tones fills it (white text) instead of refusing', () => {
  const sw = swimlaneFn([{id: 'x', label: 'X'}], [{id: 'a', lane: 'x', title: 'A', titleTone: 'accent', bodyTone: 'muted', body: 'b', col: 1}, {id: 'c', lane: 'x', title: 'C', col: 2}], {flows: [{from: 'a', to: 'c'}], focus: 'a'});
  const lane = sw.find(b => b.type === 'swimlane');
  const step = lane && lane.type === 'swimlane' ? lane.steps[0] : undefined;
  assert.equal(step?.tone, 'solid');
  assert.equal(step && 'titleTone' in step ? step.titleTone : undefined, undefined);
});

test('tree: the line into a band node is lit only when the node is on the lit part', async () => {
  const t = tree({label: 'R', id: 'r', children: [
    {label: 'A', id: 'a', children: [{label: 'B', id: 'b'}]},
    {label: 'C', id: 'c', children: [{label: 'chev', band: chevron([{label: '1'}, {label: '2'}]), w: 240}]},
  ]}, {focus: 'b'});
  const {laidOut} = await checkDiagram(diagram({theme: 'blue', legend: false}).add(t));
  const lo = laidOut.laidOut.find(b => b.type === 'tree');
  assert.equal(lo?.type === 'tree' ? lo.edges.filter(e => e.lit).length : -1, 2, 'R→A and A→B only');
  assert.throws(() => tree(null as never, {focus: 'x'}), /needs a root node/);
});

test("legend: 'auto' on a focused cause tree lists the focus tones, not the roles' colours", () => {
  const c = causeTree([{id: 'r', label: '根', role: 'root'}, {id: 'u', label: '結果', role: 'ude'}], [{from: 'r', to: 'u'}], {focus: 'r'});
  const used = usedNotation([c], new Set(), true);
  assert.equal(used.has('role:ude'), false);
  assert.equal(used.has('role:root'), false);
  assert.equal(used.has('tone:solid'), true);
});

test('a coloured connect gets a head of its colour without focus too (the one output change outside focus)', async () => {
  const svg = await svgOf(box({id: 'p', title: 'P'}), box({id: 'q', title: 'Q'}), connect('p', 'q', {tone: 'danger'}));
  assert.match(svg, /<marker id="dsl-arrow-danger"/);
  assert.match(svg, /marker-end="url\(#dsl-arrow-danger\)"/);
  const plain = await svgOf(box({id: 'p', title: 'P'}), box({id: 'q', title: 'Q'}), connect('p', 'q'));
  assert.doesNotMatch(plain, /dsl-arrow-(accent|muted|danger)/, 'no coloured line: no new marker');
});

test('steps: focus is a number (a step has no id); stateDiagram: the start arrow follows focus', () => {
  assert.throws(() => steps([{title: 'a'}, {title: 'b'}], {focus: 'a'}), /a step has no id: focus names it by its number 1\.\.2/);
  const s = stateDiagram([{id: 'a', label: 'A'}, {id: 'b', label: 'B'}], [{from: 'a', to: 'b'}], {initial: 'a', focus: 'b'});
  assert.equal(s.initialTone, 'muted');
  assert.equal(stateDiagram([{id: 'a', label: 'A'}], [], {initial: 'a', focus: 'a'}).initialTone, 'accent');
});

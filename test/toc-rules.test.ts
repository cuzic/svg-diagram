import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {causeTree, checkDiagram, closeMeasurer, diagram, renderDiagram} from '../lib/dsl.ts';
import {tocFindings} from '../lib/toc-rules.ts';
import {rcaSeverity} from '../lib/rules.ts';

test.after(() => closeMeasurer());

const N = (id: string, role?: string) => ({id, label: id, ...(role ? {role} : {})}) as {id: string; label: string; role?: never};
// toc-role-indistinct is advice (always information, about how the figure reads next to others), not a defect of the tree: these tests are about the tree
const rules = (nodes: object[], links: object[], tree?: string) => tocFindings({nodes, links, ...(tree ? {tree}: {})} as never).map(f => f.rule).filter(r => r !== 'toc-role-indistinct').sort();

// a current reality tree that is fine: 5 ude, a root, branches and a join
const udes = ['u1', 'u2', 'u3', 'u4', 'u5'].map(id => N(id, 'ude'));
const goodCrt = {
  nodes: [...udes, N('m1'), N('m2'), N('root', 'root')],
  links: [{from: 'root', to: 'm1'}, {from: 'root', to: 'm2'}, {from: 'm1', to: 'u1'}, {from: 'm1', to: 'u2'}, {from: ['m1', 'm2'], to: 'u3'}, {from: 'm2', to: 'u4'}, {from: 'm2', to: 'u5'}],
};

test('toc rules: nothing without a tree; a good tree is clean', () => {
  assert.deepEqual(rules([N('a')], [], undefined), []);
  assert.deepEqual(rules(goodCrt.nodes, goodCrt.links, 'crt'), []);
});

test('toc-ude-count: a CRT outside 5..10 ude; other trees are not counted', () => {
  assert.deepEqual(rules(goodCrt.nodes.slice(1), goodCrt.links.filter(l => l.to !== 'u1'), 'crt').filter(r => r === 'toc-ude-count'), ['toc-ude-count'], '4 ude');
  const eleven = Array.from({length: 11}, (_, i) => N(`x${i}`, 'ude'));
  assert.ok(rules([...eleven, N('r', 'root')], eleven.map(n => ({from: 'r', to: n.id})), 'crt').includes('toc-ude-count'));
  assert.ok(!rules([N('u', 'ude'), N('i', 'injection'), N('d', 'de')], [{from: 'i', to: 'd'}, {from: 'i', to: 'u'}], 'frt').includes('toc-ude-count'));
});

test('toc-parts: a CRT needs a root; an FRT needs an injection and a de and takes no root', () => {
  assert.ok(rules(udes, [{from: 'u1', to: 'u2'}], 'crt').includes('toc-parts'));
  assert.ok(rules([N('i', 'injection'), N('x')], [{from: 'i', to: 'x'}], 'frt').includes('toc-parts'), 'no de');
  assert.ok(rules([N('d', 'de'), N('x')], [{from: 'x', to: 'd'}], 'frt').includes('toc-parts'), 'no injection');
  assert.ok(rules([N('i', 'injection'), N('d', 'de'), N('r', 'root')], [{from: 'i', to: 'd'}, {from: 'r', to: 'd'}], 'frt').includes('toc-parts'), 'a root in an FRT');
  assert.ok(!rules([N('i', 'injection'), N('g', 'goal')], [{from: 'i', to: 'g'}], 'frt').includes('toc-parts'), "a final 'goal' counts as the de (H9)");
  assert.ok(!rules([N('i', 'injection'), N('d', 'de'), N('u', 'ude')], [{from: 'i', to: 'd'}, {from: 'i', to: 'u'}], 'frt').includes('toc-parts'), 'a ude (negative branch) is allowed');
});

test('toc-source-has-cause: root (crt), injection (frt) and precondition (any) take no incoming arrow; blocks and back do not count', () => {
  assert.ok(rules([N('a'), N('r', 'root'), N('u', 'ude')], [{from: 'a', to: 'r'}, {from: 'r', to: 'u'}], 'crt').includes('toc-source-has-cause'));
  assert.ok(rules([N('a'), N('p', 'precondition')], [{from: 'a', to: 'p'}], 'prt').includes('toc-source-has-cause'));
  assert.ok(!rules([N('a'), N('r', 'root'), N('u', 'ude')], [{from: 'a', to: 'r', kind: 'blocks'}, {from: 'r', to: 'u'}], 'crt').includes('toc-source-has-cause'));
  assert.ok(!rules([N('a'), N('r', 'root'), N('u', 'ude')], [{from: 'a', to: 'r', back: true}, {from: 'r', to: 'u'}], 'crt').includes('toc-source-has-cause'));
  assert.ok(!rules([N('i', 'injection'), N('r', 'root')], [], 'crt').includes('toc-source-has-cause'), 'an injection in a CRT is not a source of that tree');
});

test('toc-chain-only: one chain with no branch, join or AND', () => {
  const chain = [N('a', 'root'), N('b'), N('c'), N('d', 'ude')];
  assert.ok(rules(chain, [{from: 'a', to: 'b'}, {from: 'b', to: 'c'}, {from: 'c', to: 'd'}], 'crt').includes('toc-chain-only'));
  assert.ok(!rules(chain, [{from: 'a', to: 'b'}, {from: 'b', to: 'c'}, {from: 'b', to: 'd'}], 'crt').includes('toc-chain-only'), 'a branch');
  assert.ok(!rules(chain, [{from: ['a', 'b'], to: 'c'}, {from: 'c', to: 'd'}], 'crt').includes('toc-chain-only'), 'an AND');
  assert.ok(!rules(chain, [{from: 'a', to: 'b'}, {from: 'b', to: 'c'}, {from: 'c', to: 'd'}], 'prt').includes('toc-chain-only'), 'prt is not checked for it');
});

test('toc-orphan: an entity in no link; any tree', () => {
  assert.deepEqual(rules([N('a'), N('b'), N('lonely')], [{from: 'a', to: 'b'}], 'tt').filter(r => r === 'toc-orphan'), ['toc-orphan']);
  assert.ok(!rules([N('a'), N('b')], [{from: 'a', to: 'b', kind: 'blocks'}], 'prt').includes('toc-orphan'), 'a blocks link still names its ends');
});

test('toc rules in check: info by default, warn with tocCheck strict, info again when accepted; the SVG does not change', async () => {
  const chain = () => causeTree([N('a', 'root'), N('b'), N('c', 'ude')] as never, [{from: 'a', to: 'b'}, {from: 'b', to: 'c'}], {tree: 'crt'});
  const sev = async (opts: object) => (await checkDiagram(diagram({theme: 'blue', ...opts}).add(chain()))).verdict.findings.filter(f => f.rule.startsWith('toc-') && f.rule !== 'toc-role-indistinct' && f.rule !== 'toc-legend-suggested'); // the two advice rules are always information
  const base = await sev({});
  assert.ok(base.length > 0 && base.every(f => f.severity === 'info'));
  assert.ok((await sev({tocCheck: 'strict'})).every(f => f.severity === 'warn'));
  const acc = await sev({tocCheck: 'strict', accept: {'toc-ude-count': '部分図', 'toc-chain-only': '部分図'}});
  assert.ok(acc.filter(f => f.rule === 'toc-ude-count' || f.rule === 'toc-chain-only').every(f => f.severity === 'info'));
  const render = async (d: unknown) => (await renderDiagram(d as never, {name: 'x.svg', budget: 'cacheOnly'})).svg;
  const plain = causeTree([N('a', 'root'), N('b'), N('c', 'ude')] as never, [{from: 'a', to: 'b'}, {from: 'b', to: 'c'}]);
  assert.equal(await render(diagram({theme: 'blue', tocCheck: 'strict'}).add(chain())), await render(diagram({theme: 'blue'}).add(plain)));
});

test('toc rules do not run for a causeTree without tree, nor for relationDiagram / pdpc', async () => {
  const f = (await checkDiagram(diagram({theme: 'blue'}).add(causeTree([N('a'), N('lonely')] as never, [])))).verdict.findings;
  assert.ok(!f.some(x => x.rule.startsWith('toc-')));
});

test('toc-cycle-undeclared: a cycle with no back: true is named; a declared return, a blocks arrow and a plain tree are not', () => {
  const nodes = [N('root', 'root'), N('a'), N('late', 'ude'), N('kpi')];
  const loop = [{from: 'root', to: 'a'}, {from: 'a', to: 'late'}, {from: 'late', to: 'root'}];
  const found = tocFindings({nodes, links: loop, tree: 'crt'} as never).filter(f => f.rule === 'toc-cycle-undeclared');
  assert.equal(found.length, 1);
  assert.match(found[0].message, /->/, 'names the arrow the layout treated as the return');
  assert.ok(!rules(nodes, [...loop.slice(0, 2), {from: 'late', to: 'root', back: true}], 'crt').includes('toc-cycle-undeclared'), 'declared');
  assert.ok(!rules(nodes, [...loop.slice(0, 2), {from: 'late', to: 'root', kind: 'blocks'}], 'crt').includes('toc-cycle-undeclared'), 'blocks is not a cause');
  assert.ok(!rules(nodes, loop.slice(0, 2), 'crt').includes('toc-cycle-undeclared'));
  assert.ok(rules(nodes, loop, 'prt').includes('toc-cycle-undeclared'), 'any tree');
  assert.equal(rules(nodes, loop, undefined).length, 0, 'no tree, no check');
});

test('the first figure the requester drew (a 5-entity chain, one ude, a return into the root) trips ude-count, cycle-undeclared and source-has-cause', () => {
  const nodes = [N('root', 'root'), N('b'), N('c'), N('d'), N('late', 'ude')];
  const links = [{from: 'root', to: 'b'}, {from: 'b', to: 'c'}, {from: 'c', to: 'd'}, {from: 'd', to: 'late'}, {from: 'late', to: 'root'}];
  const r = rules(nodes, links, 'crt');
  for (const id of ['toc-ude-count', 'toc-cycle-undeclared', 'toc-source-has-cause']) assert.ok(r.includes(id as never), id);
  const declared = rules(nodes, links.map(l => l.to === 'root' ? {...l, back: true} : l), 'crt');
  assert.ok(!declared.includes('toc-cycle-undeclared' as never) && declared.includes('toc-ude-count' as never) && declared.includes('toc-chain-only' as never), 'with back: true the chain itself is still named');
});

test('tocCheck and tree reject bad values', () => {
  assert.throws(() => diagram({theme: 'blue', tocCheck: 'loud' as never}), /tocCheck/);
  assert.throws(() => causeTree([N('a')] as never, [], {tree: 'xyz' as never}), /tree must be/);
});

// a negative branch tree (ADR 0020 D1): a plan (inj) leads, with a precondition, to a tipping point and on to a bad result; a trim cuts at the tipping point
const goodNbr = {
  nodes: [N('inj', 'injection'), N('fact', 'precondition'), N('step'), N('tip', 'tipping'), N('bad', 'ude'), N('trim', 'trim')],
  links: [{from: 'inj', to: 'step'}, {from: ['step', 'fact'], to: 'tip'}, {from: 'tip', to: 'bad'}, {from: 'trim', to: 'tip', kind: 'blocks'}],
};
test('toc-nbr-*: a clean negative branch tree raises nothing; each part is checked', () => {
  assert.deepEqual(rules(goodNbr.nodes, goodNbr.links, 'nbr'), []);
  assert.ok(rules(goodNbr.nodes.filter(n => n.id !== 'trim'), goodNbr.links.filter(l => l.from !== 'trim'), 'nbr').includes('toc-nbr-parts'), 'no trim');
  assert.ok(rules(goodNbr.nodes.filter(n => n.id !== 'bad'), goodNbr.links.filter(l => l.from !== 'tip'), 'nbr').includes('toc-nbr-parts'), 'no bad result');
});

test('toc-nbr-no-tipping: a cause path to the bad result that does not pass a tipping point (a cut check, any source, not only an injection)', () => {
  const second = [...goodNbr.nodes, N('src'), N('other')], links = [...goodNbr.links, {from: 'src', to: 'other'}, {from: 'other', to: 'bad'}];
  assert.deepEqual(rules(second, links, 'nbr'), ['toc-nbr-no-tipping']);
  const viaBack = [...goodNbr.links, {from: 'bad', to: 'inj', back: true}];
  assert.deepEqual(rules(goodNbr.nodes, viaBack, 'nbr'), [], 'a declared return is not a cause path');
});

test('toc-nbr-tipping-not-and: a tipping point is the result of an AND', () => {
  const notAnd = [...goodNbr.links.map(l => Array.isArray(l.from) ? {from: 'step', to: 'tip'} : l), {from: 'fact', to: 'step'}];
  assert.deepEqual(rules(goodNbr.nodes, notAnd, 'nbr'), ['toc-nbr-tipping-not-and']);
});

test('toc-nbr-trim-too-late: the trim cuts at the tipping point or before it, not what lies after', () => {
  assert.deepEqual(rules(goodNbr.nodes, goodNbr.links.map(l => l.kind ? {...l, to: 'step'} : l), 'nbr'), [], 'before it');
  assert.deepEqual(rules(goodNbr.nodes, goodNbr.links.map(l => l.kind ? {...l, to: 'bad'} : l), 'nbr'), ['toc-nbr-trim-too-late'], 'after it');
});

test('toc-source-has-cause: an injection and a trim of a negative branch tree are not caused by anything', () => {
  assert.ok(rules(goodNbr.nodes, [...goodNbr.links, {from: 'step', to: 'inj'}], 'nbr').includes('toc-source-has-cause'));
  assert.ok(rules(goodNbr.nodes, [...goodNbr.links, {from: 'fact', to: 'trim'}], 'nbr').includes('toc-source-has-cause'));
});

test('toc-tt-unit: an AND of a transition tree is current reality (or a need) + action', () => {
  const nodes = [N('c', 'precondition'), N('n', 'need'), N('a', 'action'), N('r', 'io'), N('a2', 'action'), N('r2', 'io')];
  const unit = [{from: ['c', 'n', 'a'], to: 'r'}];
  assert.deepEqual(rules(nodes.slice(0, 4), unit, 'tt'), []);
  assert.deepEqual(rules(nodes, [...unit, {from: ['r', 'a2'], to: 'r2'}], 'tt'), ['toc-tt-unit'], 'no need in the second unit');
  assert.deepEqual(rules(nodes, [...unit, {from: ['r', 'n'], to: 'r2'}, {from: 'a2', to: 'r2'}], 'tt'), ['toc-tt-unit'], 'an AND with no action');
  assert.deepEqual(rules(nodes, [{from: 'c', to: 'r'}, {from: 'a', to: 'r'}, {from: 'n', to: 'r'}, {from: 'a2', to: 'r2'}, {from: 'r', to: 'r2'}], 'tt'), [], 'OR links are not units');
});

// a prerequisite tree (ADR 0020 D4)
const prtOf = (extra: object[] = [], links: {from: string; to: string}[] = []) => ({
  nodes: [N('goal', 'goal'), N('ioA', 'io'), N('ioB', 'io'), N('act1', 'action'), N('o1', 'obstacle'), N('o2', 'obstacle'), N('o3', 'obstacle'), ...extra],
  links: [{from: 'act1', to: 'ioA'}, {from: 'o1', to: 'ioA'}, {from: 'o2', to: 'ioA'}, {from: 'ioA', to: 'ioB'}, {from: 'o3', to: 'ioB'}, {from: 'ioB', to: 'goal'}, ...links],
});
test('toc-prt-bottom-not-action: the bottom of an io chain has an action (an obstacle with no cause is not a bottom)', () => {
  const p = prtOf();
  assert.deepEqual(rules(p.nodes, p.links, 'prt'), [], 'the requester\'s shape: obstacles are sources, the bottom io has an action');
  assert.deepEqual(rules(p.nodes, p.links.filter(l => l.from !== 'act1'), 'prt').filter(r => r.startsWith('toc-prt')), ['toc-prt-bottom-not-action'], 'ioA has no action');
});
test('toc-prt-one-to-one: obstacles and intermediate objectives all paired one to one', () => {
  const pairs = {nodes: [N('goal', 'goal'), N('i1', 'io'), N('i2', 'io'), N('a1', 'action'), N('a2', 'action'), N('b1', 'obstacle'), N('b2', 'obstacle')], links: [{from: 'a1', to: 'i1'}, {from: 'b1', to: 'i1'}, {from: 'a2', to: 'i2'}, {from: 'b2', to: 'i2'}, {from: 'i1', to: 'goal'}, {from: 'i2', to: 'goal'}]};
  assert.deepEqual(rules(pairs.nodes, pairs.links, 'prt'), ['toc-prt-one-to-one']);
  assert.deepEqual(rules(pairs.nodes, [...pairs.links, {from: 'b1', to: 'i2'}], 'prt'), [], 'one obstacle in the way of two objectives');
  assert.ok(!rules(pairs.nodes.slice(0, 5), pairs.links.slice(0, 2).concat({from: 'i1', to: 'goal'}), 'prt').includes('toc-prt-one-to-one'), 'one objective: nothing to compare');
});
test('toc-obstacle-phrase: an obstacle ending in ない / 無い / 不足 (always info)', () => {
  const nodes = [N('g', 'goal'), N('i', 'io'), N('a', 'action'), {id: 'o', label: '担当者に時間がない。', role: 'obstacle' as never}, {id: 'p', label: 'マスタが会社ごとに別々である', role: 'obstacle' as never}];
  const links = [{from: 'a', to: 'i'}, {from: 'o', to: 'i'}, {from: 'p', to: 'i'}, {from: 'i', to: 'g'}];
  const found = tocFindings({nodes, links, tree: 'prt'} as never).filter(f => f.rule === 'toc-obstacle-phrase');
  assert.equal(found.length, 1);
  assert.equal(found[0].severity, 'info');
  assert.match(found[0].message, /: o。/);
});

test('toc-mirror: the de / goal of a future reality tree against the ude of the current one (1 to 1)', () => {
  const mirrorOf = {ids: ['u1', 'u2', 'u3', 'r'], udes: ['u1', 'u2', 'u3']};
  const frt = (mir: Record<string, string>) => ({
    nodes: [N('i', 'injection'), ...Object.entries(mir).map(([id, m]) => ({...N(id, 'de'), mirrors: m}))], links: Object.keys(mir).map(id => ({from: 'i', to: id})), mirrorOf,
  });
  const run = (f: {nodes: object[]; links: object[]; mirrorOf: object}) => tocFindings({...f, tree: 'frt'} as never).filter(x => x.rule === 'toc-mirror').map(x => x.message);
  assert.deepEqual(run(frt({d1: 'u1', d2: 'u2', d3: 'u3'})), []);
  assert.match(run(frt({d1: 'u1', d2: 'u2'})).join(), /対応する望む結果が無い.*u3/);
  assert.match(run(frt({d1: 'u1', d2: 'u1', d3: 'u2'})).join(), /同じ UDE を複数.*u1（d1、d2）/);
  assert.match(run(frt({d1: 'u1', d2: 'u2', d3: 'r'})).join(), /UDE の id でない.*d3/);
  assert.deepEqual(tocFindings({nodes: [N('i', 'injection'), N('d', 'de')], links: [{from: 'i', to: 'd'}], tree: 'frt'} as never).filter(x => x.rule === 'toc-mirror'), [], 'no mirrors given: nothing is compared');
});

test('rcaCheck: validated, never reaches the drawing, and rcaSeverity follows tocSeverity', async () => {
  assert.throws(() => diagram({theme: 'blue', rcaCheck: 'loud' as never}), /rcaCheck/);
  assert.equal(rcaSeverity({}), 'info');
  assert.equal(rcaSeverity({rcaCheck: 'info'}), 'info');
  assert.equal(rcaSeverity({rcaCheck: 'strict'}), 'warn');
  const render = async (d: unknown) => (await renderDiagram(d as never, {name: 'x.svg', budget: 'cacheOnly'})).svg;
  const band = causeTree([N('a', 'root'), N('b', 'ude')] as never, [{from: 'a', to: 'b'}]);
  assert.equal(await render(diagram({theme: 'blue', rcaCheck: 'strict'}).add(band)), await render(diagram({theme: 'blue'}).add(band)));
});

test('toc-injection-to-obstacle: an ordinary arrow from a measure to an obstacle; kind blocks is fine', () => {
  const nodes = [N('i', 'injection'), N('o', 'obstacle'), N('d', 'de')];
  assert.deepEqual(rules(nodes, [{from: 'i', to: 'o'}, {from: 'i', to: 'd'}], 'frt'), ['toc-injection-to-obstacle']);
  assert.deepEqual(rules(nodes, [{from: 'i', to: 'o', kind: 'blocks'}, {from: 'i', to: 'd'}], 'frt'), []);
  assert.deepEqual(rules(nodes, [{from: ['i', 'd'], to: 'o'}], 'frt'), ['toc-injection-to-obstacle']);
});

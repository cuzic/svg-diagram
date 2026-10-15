import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {causeTree, checkDiagram, closeMeasurer, diagram, renderDiagram} from '../lib/dsl.ts';
import {tocFindings} from '../lib/toc-rules.ts';

test.after(() => closeMeasurer());

const N = (id: string, role?: string) => ({id, label: id, ...(role ? {role} : {})}) as {id: string; label: string; role?: never};
const rules = (nodes: object[], links: object[], tree?: string) => tocFindings({nodes, links, ...(tree ? {tree}: {})} as never).map(f => f.rule).sort();

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
  const sev = async (opts: object) => (await checkDiagram(diagram({theme: 'blue', ...opts}).add(chain()))).verdict.findings.filter(f => f.rule.startsWith('toc-'));
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

test('tocCheck and tree reject bad values', () => {
  assert.throws(() => diagram({theme: 'blue', tocCheck: 'loud' as never}), /tocCheck/);
  assert.throws(() => causeTree([N('a')] as never, [], {tree: 'xyz' as never}), /tree must be/);
});

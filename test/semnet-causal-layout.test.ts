// The causal loop and the dependency network draw every line first and every sign / label after it (ADR 0011 A).
// Before: `label "-" overlaps label "R1"`, `"+" is crossed by a path` (lint-svg rule 5) and a sign silently dropped were all reachable.
import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/strict-width.ts';
import {causalLoop, closeMeasurer, dependencyNetwork} from '../lib/dsl.ts';
import {causalCase, countText, denseCausalCase, dependencyCase, drawAndCheck, plateDamage} from './helpers/semnet-sweep.ts';

test.after(() => closeMeasurer());

const SEEDS = Array.from({length: 60}, (_, i) => i + 1);
const NO_ROOM = /^causalLoop\(\): the (polarity ".*"|delay mark "\|\|") of n\d -> n\d has no room \(/;

test('causal loop + 2 outside nodes: clean on checkDiagram and lint-svg, or an explicit "no room" (60 seeds x LR / TB)', async () => {
  let drawn = 0, refused = 0;
  for (const direction of ['LR', 'TB'] as const) for (const seed of SEEDS) {
    const {nodes, links} = causalCase(seed), r = await drawAndCheck(causalLoop(nodes, links, {direction}));
    const who = `seed ${seed} ${direction}`;
    if (r.error !== undefined) { assert.match(r.error, NO_ROOM, who); refused++; continue; }
    drawn++;
    assert.deepEqual(r.problems, [], `${who}: checkDiagram`);
    assert.deepEqual(r.lint, [], `${who}: lint-svg --strict (a line through a sign, or two texts over each other)`);
    // nothing is dropped silently: one drawn sign per link, one "||" per delay
    assert.equal(countText(r.svg, '+'), links.filter(l => l.polarity === '+').length, `${who}: "+" count`);
    assert.equal(countText(r.svg, '-'), links.filter(l => l.polarity === '-').length, `${who}: "-" count`);
    assert.equal(countText(r.svg, '||'), links.filter(l => l.delay).length, `${who}: "||" count`);
    assert.deepEqual(plateDamage(r.svg), {heads: 0, nodes: 0}, `${who}: a plate hides an arrow head or a node's edge`);
  }
  assert.ok(drawn >= 115, `most cases draw (${drawn} drawn, ${refused} refused)`);
});

test('dense causal loops with edge labels: a polarity or delay stops the build, a label is left out, the rest is clean (150 seeds x LR / TB)', async () => {
  let drawn = 0, stopped = 0, omitted = 0, heads = 0, nodesHit = 0;
  for (const direction of ['LR', 'TB'] as const) for (const seed of Array.from({length: 150}, (_, i) => i + 1)) {
    const {nodes, links} = denseCausalCase(seed), r = await drawAndCheck(causalLoop(nodes, links, {direction}));
    const who = `dense seed ${seed} ${direction}`;
    if (r.error !== undefined) { assert.match(r.error, NO_ROOM, `${who}: only a polarity or a delay may stop the build, never a label`); stopped++; continue; }
    drawn++;
    assert.deepEqual([r.problems, r.lint], [[], []], who);
    assert.equal(countText(r.svg, '+') + countText(r.svg, '-'), links.length, `${who}: signs`);
    assert.equal(countText(r.svg, '||'), links.filter(l => l.delay).length, `${who}: "||"`);
    omitted += links.filter(l => l.label).length - countText(r.svg, '短期的な効果');
    const d = plateDamage(r.svg); heads += d.heads; nodesHit += d.nodes;
  }
  // before this change: 1 arrow head and 11 node edges hidden in these 300 figures
  assert.equal(heads, 0, 'no arrow head is hidden');
  assert.ok(nodesHit <= 4, `${nodesHit} node edges are cut by a plate`);
  assert.ok(stopped <= 10, `a stop is rare even in dense figures (${stopped} of 300; before, those figures lost a sign silently)`);
  assert.ok(drawn > 0 && omitted > 0, `labels with no room are left out (${omitted}), not made a reason to stop`);
});

test('the three outcomes, pinned: a stopped polarity / delay, a label left out, and a clean figure', async () => {
  // every node linked to every other, with long labels: it stops at some link, which one depends on the font and on how the arrows are routed
  // (the case used to be denseCausalCase(55) 'TB', which stopped until straight arrows (ADR 0016 D3) gave its sign room)
  const names = Array.from({length: 6}, (_, i) => ({id: `n${i}`, label: `要素${i}`.repeat(6)}));
  const all = names.flatMap(a => names.filter(b => b !== a).map(b => ({from: a.id, to: b.id, polarity: '+' as const, delay: true})));
  const stopped = await drawAndCheck(causalLoop(names, all, {direction: 'LR'}));
  assert.match(stopped.error ?? '', /the (polarity "\+"|delay mark "\|\|") of n\d -> n\d has no room \(the figure is too dense around this link: drop a link or a node, or shorten the node labels; a larger height \/ width does not make room\)/);
  const omit = denseCausalCase(1), left = await drawAndCheck(causalLoop(omit.nodes, omit.links, {direction: 'LR'}));
  assert.equal(left.error, undefined);
  assert.ok(countText(left.svg, '短期的な効果') < omit.links.filter(l => l.label).length, 'a label with no room is left out');
  assert.equal(countText(left.svg, '+') + countText(left.svg, '-'), omit.links.length, 'but every polarity is drawn');
  const {nodes, links} = causalCase(2), clean = await drawAndCheck(causalLoop(nodes, links));
  assert.deepEqual([clean.error, clean.problems, clean.lint], [undefined, [], []]);
});

test('dependency network: no edge label is struck through by a later edge, and a label on an edge does not hide an arrow head or a node edge (60 seeds x LR / TB)', async () => {
  let missing = 0, total = 0, heads = 0, nodesHit = 0;
  for (const direction of ['LR', 'TB'] as const) for (const seed of SEEDS) {
    const {nodes, edges} = dependencyCase(seed), r = await drawAndCheck(dependencyNetwork(nodes, edges, {direction}));
    assert.equal(r.error, undefined, `seed ${seed} ${direction}`);
    assert.deepEqual([r.problems, r.lint], [[], []], `seed ${seed} ${direction}`);
    const d = plateDamage(r.svg); heads += d.heads; nodesHit += d.nodes;
    // one text per edge, plus one legend entry per edge type
    const labels = [...r.svg.matchAll(/<text\b[^>]*>((?:depends|uses|blocks)(?: \d+)?)<\/text>/g)].length;
    missing += edges.length + new Set(edges.map(e => e.type)).size - labels; total += edges.length;
  }
  // a label with no room is left out (it does not change what the figure says). How many depends on the font's widths, so this is a share, not a count
  // (38 of 777 before this change with the local font, 46 after; 53 with DejaVu Sans, the CI font)
  assert.ok(missing <= total * 0.15, `${missing} of ${total} labels left out`);
  // before this change 10 arrow heads and 28 node edges were hidden (the first version of the on-edge fallback: 25 and 36)
  assert.equal(heads, 0, 'no arrow head is hidden');
  assert.ok(nodesHit <= 2, `${nodesHit} node edges are cut by a plate`);
});

test('in the SVG, no line or arrow head comes after the first sign or label', async () => {
  const {nodes, links} = causalCase(1), r = await drawAndCheck(causalLoop(nodes, links));
  const firstSign = r.svg.search(/<text\b[^>]*>(\+|-|\|\|)<\/text>/), lastStroke = r.svg.lastIndexOf('stroke="#');
  assert.ok(firstSign > 0 && lastStroke > 0);
  assert.ok(lastStroke < firstSign, 'every stroked shape (lines, node boxes) is drawn before the first sign');
});

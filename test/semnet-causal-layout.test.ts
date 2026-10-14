// The causal loop and the dependency network draw every line first and every sign / label after it (ADR 0011 A).
// Before: `label "-" overlaps label "R1"`, `"+" is crossed by a path` (lint-svg rule 5) and a sign silently dropped were all reachable.
import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/strict-width.ts';
import {causalLoop, closeMeasurer, dependencyNetwork} from '../lib/dsl.ts';
import {causalCase, countText, dependencyCase, drawAndCheck} from './helpers/semnet-sweep.ts';

test.after(() => closeMeasurer());

const SEEDS = Array.from({length: 60}, (_, i) => i + 1);

test('causal loop + 2 outside nodes: clean on checkDiagram and lint-svg, or an explicit "no room" (60 seeds x LR / TB)', async () => {
  let drawn = 0, refused = 0;
  for (const direction of ['LR', 'TB'] as const) for (const seed of SEEDS) {
    const {nodes, links} = causalCase(seed), r = await drawAndCheck(causalLoop(nodes, links, {direction}));
    const who = `seed ${seed} ${direction}`;
    if (r.error !== undefined) { assert.match(r.error, /causalLoop\(\): the (polarity|delay mark|label) .* has no room \(raise height \/ width\)/, who); refused++; continue; }
    drawn++;
    assert.deepEqual(r.problems, [], `${who}: checkDiagram`);
    assert.deepEqual(r.lint, [], `${who}: lint-svg --strict (a line through a sign, or two texts over each other)`);
    // nothing is dropped silently: one drawn sign per link, one "||" per delay
    const plus = links.filter(l => l.polarity === '+').length, minus = links.filter(l => l.polarity === '-').length;
    assert.equal(countText(r.svg, '+'), plus, `${who}: "+" count`);
    assert.equal(countText(r.svg, '-'), minus, `${who}: "-" count`);
    assert.equal(countText(r.svg, '||'), links.filter(l => l.delay).length, `${who}: "||" count`);
  }
  assert.ok(drawn >= 115, `most cases draw (${drawn} drawn, ${refused} refused)`);
});

test('dependency network: no edge label is struck through by a later edge, and the on-edge fallback keeps (almost) every label (60 seeds x LR / TB)', async () => {
  let missing = 0;
  for (const direction of ['LR', 'TB'] as const) for (const seed of SEEDS) {
    const {nodes, edges} = dependencyCase(seed), r = await drawAndCheck(dependencyNetwork(nodes, edges, {direction}));
    assert.equal(r.error, undefined, `seed ${seed} ${direction}`);
    assert.deepEqual([r.problems, r.lint], [[], []], `seed ${seed} ${direction}`);
    // one text per edge, plus one legend entry per edge type
    const labels = [...r.svg.matchAll(/<text\b[^>]*>((?:depends|uses|blocks)(?: \d+)?)<\/text>/g)].length;
    missing += edges.length + new Set(edges.map(e => e.type)).size - labels;
  }
  // before the fallback 32 of these 120 figures lost a label; a label with no room is still left out (it does not change what the figure says), but rarely
  assert.ok(missing <= 6, `${missing} labels left out of the 120 figures`);
});

test('in the SVG, no line or arrow head comes after the first sign or label', async () => {
  const {nodes, links} = causalCase(1), r = await drawAndCheck(causalLoop(nodes, links));
  const firstSign = r.svg.search(/<text\b[^>]*>(\+|-|\|\|)<\/text>/), lastStroke = r.svg.lastIndexOf('stroke="#');
  assert.ok(firstSign > 0 && lastStroke > 0);
  assert.ok(lastStroke < firstSign, 'every stroked shape (lines, node boxes) is drawn before the first sign');
});

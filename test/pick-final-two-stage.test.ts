// ADR 0075 D3: the final pick in two stages. One `pickFinal` over main's candidates and the rows candidates together is not monotone: a rows candidate that is not chosen can still move the pick to another
// main candidate (its fewer bends shrink the window). `pickTwoStage` picks main's figure M exactly as on main, takes the best rows candidate R, and lets R replace M only when the ADR 0073 window over [M, R] selects R
// (a pairs-only gain costs at most +4 bends, a lower C wins, a tie keeps M) and R has no more overlaps than M. The final figure is always M or R, never another main candidate.
import test from 'node:test';
import assert from 'node:assert/strict';
import {pickFinal, pickTwoStage, type Judged} from '../lib/toc.ts';

// scores: [AND crossings, AND side by side, crossings, pairs, bends, height]
const J = (name: string, score: number[]): Judged & {name: string} => ({name, h: score[5]!, score, layers: [0], loose: 0, fits: undefined});
const frame = {h: 100, layers: [0], loose: 0, fits: undefined};
const view = (t: Judged): Judged => t;
const name = (t: unknown): string => (t as {name: string}).name;
const first = J('first', [0, 0, 3, 0, 20, 100]), M = J('M', [0, 0, 2, 0, 12, 100]), N = J('N', [0, 0, 2, 1, 8, 100]), R = J('R', [0, 0, 2, 2, 7, 100]);

test('one pickFinal over all candidates is not monotone: main alone picks M, main + R picks N, a main candidate that R did not even win', () => {
  assert.equal(name(pickFinal(first, [M, N], frame, true, view)), 'M');
  assert.equal(name(pickFinal(first, [M, N, R], frame, true, view)), 'N');
});

test('pickTwoStage: the pick is main\'s M, or R when the window over [M, R] selects it; never N', () => {
  assert.equal(name(pickTwoStage(first, [M, N], [], frame, true, view)), 'M');
  assert.equal(name(pickTwoStage(first, [M, N], [R], frame, true, view)), 'R'); // M's 12 bends are 5 over R's 7: M leaves the window
  const R2 = J('R2', [0, 0, 2, 2, 9, 100]); // M's 12 bends are within R2's 9 + 4: M stays in the window and keeps the lower pairs
  assert.equal(name(pickTwoStage(first, [M, N], [R2], frame, true, view)), 'M');
});

test('pickTwoStage: a pairs-only gain may not cost more than +4 bends (ADR 0073 D1-4)', () => {
  const m = J('m', [0, 0, 2, 1, 8, 100]), r = J('r', [0, 0, 2, 0, 20, 100]), r4 = J('r4', [0, 0, 2, 0, 12, 100]);
  assert.equal(name(pickFinal(first, [m, r], frame, true, view)), 'm'); // the window rule
  assert.equal(name(pickTwoStage(first, [m], [r], frame, true, view)), 'm'); // +12 bends: not taken
  assert.equal(name(pickTwoStage(first, [m], [r4], frame, true, view)), 'r4'); // +4 bends: taken
});

test('pickTwoStage: a lower C wins whatever the bends; a tie keeps main\'s; more overlaps are not taken; an out-of-frame candidate is not taken', () => {
  const better = J('better', [0, 0, 1, 0, 30, 100]), tie = J('tie', [...M.score]);
  assert.equal(name(pickTwoStage(first, [M, N], [better], frame, true, view)), 'better');
  assert.equal(name(pickTwoStage(first, [M, N], [tie], frame, true, view)), 'M');
  const ov = new Map<unknown, number>([[M, 0], [N, 0], [better, 1], [first, 0]]);
  assert.equal(name(pickTwoStage(first, [M, N], [better], frame, true, view, t => ov.get(t) ?? 0)), 'M');
  const out = {...J('out', [0, 0, 0, 0, 0, 100]), layers: [1]};
  assert.equal(name(pickTwoStage(first, [M, N], [out, better], frame, true, view)), 'better'); // `out` does not seed the pool
});

test('pickTwoStage: a taller R can replace M only with fewer crossings than M', () => {
  const equalCrossings = J('equal crossings', [0, 0, 2, 0, 7, 110]);
  const fewerCrossings = J('fewer crossings', [0, 0, 1, 0, 7, 110]);
  assert.equal(pickTwoStage(first, [M], [equalCrossings], frame, true, view), M, 'fewer bends alone cannot justify the extra height');
  assert.equal(pickTwoStage(first, [M], [fewerCrossings], frame, true, view), fewerCrossings);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ALL_BANDS_REVEALED, REVEAL_HANDLERS} from '../lib/reveal-handlers.ts';
import {CHILD_BANDS} from '../lib/band-children.ts';

// The compile-time half is UnrevealedBandTypes (tsc fails when a band type has no entry); this is the run-time half.
test('every band type has a reveal handler', () => {
  assert.equal(ALL_BANDS_REVEALED, true);
  assert.deepEqual(Object.keys(REVEAL_HANDLERS).sort(), Object.keys(CHILD_BANDS).sort());
  for (const [type, h] of Object.entries(REVEAL_HANDLERS) as [string, {stage: unknown; visit?: unknown}][]) {
    assert.equal(typeof h.stage, 'boolean', type);
    if (h.visit !== undefined) assert.equal(typeof h.visit, 'function', type);
  }
  // only the bands that carry no reveal of their own skip the stage
  const unstaged = Object.entries(REVEAL_HANDLERS).filter(([, h]) => !h.stage).map(([t]) => t).sort();
  assert.deepEqual(unstaged, ['connect', 'legend', 'spacer']);
});

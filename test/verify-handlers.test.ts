import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ALL_BANDS_VERIFIED, CHECK_PHASES, VERIFY_HANDLERS} from '../lib/verify-handlers.ts';
import {EMIT_HANDLERS} from '../lib/emit-handlers.ts';

// The compile-time half is UnverifiedBandTypes (tsc fails when a laid-out band type has no entry); this is the run-time half.
test('every laid-out band type has a verify handler', () => {
  assert.equal(ALL_BANDS_VERIFIED, true);
  assert.deepEqual(Object.keys(VERIFY_HANDLERS).sort(), Object.keys(EMIT_HANDLERS).sort());
  const phases = new Set<string>(CHECK_PHASES);
  for (const [type, h] of Object.entries(VERIFY_HANDLERS) as [string, {check?: {phase: string; run: unknown}}][]) {
    if (h.check) { assert.ok(phases.has(h.check.phase), `${type}: unknown phase ${h.check.phase}`); assert.equal(typeof h.check.run, 'function', type); }
  }
  // every phase is used by some band type, so the run order in CHECK_PHASES has no dead slot
  for (const phase of CHECK_PHASES) assert.ok(Object.values(VERIFY_HANDLERS).some(h => (h as {check?: {phase: string}}).check?.phase === phase), phase);
});

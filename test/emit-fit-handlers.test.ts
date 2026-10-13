import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ALL_BANDS_EMITTED, EMIT_HANDLERS} from '../lib/emit-handlers.ts';
import {ALL_BANDS_FITTED, FIT_HANDLERS} from '../lib/fit-handlers.ts';

// The compile-time half is Unemitted/UnfittedBandTypes (tsc fails when a laid-out band type has no entry); this is the run-time half.
test('every laid-out band type has an emitter and a text-size handler', () => {
  assert.equal(ALL_BANDS_EMITTED, true);
  assert.equal(ALL_BANDS_FITTED, true);
  assert.deepEqual(Object.keys(EMIT_HANDLERS).sort(), Object.keys(FIT_HANDLERS).sort());
  for (const [type, h] of Object.entries(EMIT_HANDLERS)) assert.equal(typeof h.render, 'function', type);
  for (const [type, h] of Object.entries(FIT_HANDLERS)) assert.equal(typeof h, 'function', type);
  for (const type of ['caption', 'box', 'row', 'grid', 'chart', 'bars', 'table', 'wireframe']) assert.ok(type in EMIT_HANDLERS, type);
});

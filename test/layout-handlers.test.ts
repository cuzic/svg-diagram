import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ALL_BANDS_HANDLED, LAYOUT_HANDLERS} from '../lib/layout-handlers.ts';

// The compile-time half is UnhandledBandTypes (tsc fails when a Band type has no handler); this is the run-time half.
test('every band type has a layout handler', () => {
  assert.equal(ALL_BANDS_HANDLED, true);
  for (const [type, handler] of Object.entries(LAYOUT_HANDLERS)) assert.equal(typeof handler, 'function', type);
  for (const type of ['caption', 'box', 'banner', 'row', 'grid', 'group', 'swimlane', 'connect', 'spacer']) assert.ok(type in LAYOUT_HANDLERS, type);
});

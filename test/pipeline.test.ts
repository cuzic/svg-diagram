import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PIPELINE_ORDER, POST_LAYOUT_STAGES, PRE_LAYOUT_STAGES} from '../lib/pipeline.ts';

// The order is load-bearing (see the comments in lib/pipeline.ts): changing it is a decision, so it is pinned.
test('the render pipeline runs its stages in this order', () => {
  assert.deepEqual([...PIPELINE_ORDER], ['loop-back', 'reveal', 'auto-legend', 'layout', 'spotlight', 'verify', 'emit', 'xml']);
  assert.deepEqual(PRE_LAYOUT_STAGES.map(s => s.name), ['loop-back', 'reveal', 'auto-legend']);
  assert.deepEqual(POST_LAYOUT_STAGES.map(s => s.name), ['spotlight']);
});

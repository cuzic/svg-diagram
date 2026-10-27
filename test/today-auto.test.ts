import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fillAutoToday} from '../lib/today-auto.ts';

test("fillAutoToday writes the given day into every gantt that says 'auto', and says whether there was one", () => {
  const auto = {type: 'gantt', today: 'auto'}, fixed = {type: 'gantt', today: '2026-01-01'}, other = {type: 'box'};
  assert.equal(fillAutoToday([auto, fixed, other] as never, '2026-10-27'), true);
  assert.equal(auto.today, '2026-10-27');
  assert.equal(fixed.today, '2026-01-01');
  assert.equal(fillAutoToday([other] as never, undefined), false);
});

test("fillAutoToday without a day names the ways to give one", () => {
  assert.throws(() => fillAutoToday([{type: 'gantt', today: 'auto'}] as never, undefined), /--today/);
});

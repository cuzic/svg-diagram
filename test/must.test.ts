import {test} from 'node:test';
import assert from 'node:assert/strict';
import {must} from '../lib/must.ts';

test('must returns a value and rejects undefined and null with a message', () => {
  assert.equal(must(0), 0);
  assert.equal(must(''), '');
  assert.throws(() => must(undefined), /expected a value, got undefined/);
  assert.throws(() => must(null), /expected a value, got null/);
  assert.throws(() => must(undefined, 'a lane "x"'), /expected a lane "x", got undefined/);
});

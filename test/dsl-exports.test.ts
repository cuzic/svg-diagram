// lib/dsl.ts is the package entry point and only re-exports lib/dsl/*.ts. The runtime export list was captured from the monolithic
// dsl.ts before it was split (test/fixtures/dsl-exports.json); a function that is lost, or an internal helper that leaks, shows here.
// A new public function is added to the fixture on purpose.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('the public runtime API of lib/dsl.ts is exactly the recorded list', async () => {
  const expected = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'fixtures/dsl-exports.json'), 'utf8')) as string[];
  const actual = Object.keys(await import('../lib/dsl.ts')).sort();
  assert.deepEqual(actual, expected);
});

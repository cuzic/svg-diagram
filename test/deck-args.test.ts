// `svg-diagram deck`'s command line (lib/deck-args.ts), in-process. test/deck-cli.test.ts keeps one child process that proves the entry prints it and exits 2.
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDeckArgs} from '../lib/deck-args.ts';

const errorOf = (...args: string[]): string => { const r = parseDeckArgs([...args, '--out', 'usage.html']); assert.equal(r.ok, false, args.join(' ')); return r.ok ? '' : r.error; };

test('usage errors: no input, an unknown option, --cols 0 / 2.5 / x, a bad --render, another extension, a missing value', () => {
  assert.equal(errorOf(), '');
  assert.equal(errorOf('flow.ts', '--nope'), 'unknown option --nope');
  for (const c of ['0', '2.5', 'x']) assert.match(errorOf('flow.ts', '--cols', c), /--cols needs a whole number of 1 or more/);
  assert.match(errorOf('flow.ts', '--render', 'png'), /--render is svg \(got png\)/);
  assert.match(errorOf('flow.ts', '--render', 'html'), /not available yet/);
  assert.match(errorOf('notes.md'), /notes\.md: a deck takes \.ts sources and \.svg files/);
  assert.match(errorOf('flow.ts', '--out'), /--out needs a value/);
  assert.equal(errorOf('--out', 'u.html'), ''); // the value of --out is not an input
});

test('a good command line: inputs in order, the defaults, and every option', () => {
  assert.deepEqual(parseDeckArgs(['b.ts', 'a.svg']), {ok: true, args: {files: ['b.ts', 'a.svg'], out: 'deck.html', csp: false, noSourceLine: false}});
  assert.deepEqual(parseDeckArgs(['a.ts', '--out', 'x/d.html', '--title', 'T', '--cols', '3', '--csp', '--no-source-line', '--render', 'svg']),
    {ok: true, args: {files: ['a.ts'], out: 'x/d.html', title: 'T', cols: 3, csp: true, noSourceLine: true}});
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {banner, box, caption, row} from '../lib/dsl.ts';
import {assertOneOf} from '../lib/dsl/shared.ts';

// A value the types refuse reaches the runtime from JS callers or a missed typecheck; it must stop there, not draw something else.
const bad = (f: () => unknown, re: RegExp) => assert.throws(f, re);

test('banner without a headline throws and names the right key', () => {
  bad(() => banner({text: 'x'} as never), /headline/);
});
test('box with an unknown key throws and says where the text goes; an empty placeholder box is still allowed', () => {
  bad(() => box({text: 'x'} as never), /unknown option 'text'/);
  bad(() => box({title: 'a', label: 'x', bogus: 1} as never), /'label', 'bogus'/);
  assert.ok(box({id: 'placeholder'}));
  assert.ok(box({title: 'a', body: 'b', lines: ['c'], note: 'd', tone: 'accent', step: 1}));
});
test('assertOneOf: an absent value passes, a listed one passes, anything else throws', () => {
  assertOneOf(undefined, ['a'], 'x');
  assertOneOf('a', ['a'], 'x');
  assert.throws(() => assertOneOf('b', ['a'], 'x'), /x must be 'a' \(got "b"\)/);
});
test('enumerated options are checked at the constructor', () => {
  bad(() => caption('x', {align: 'end'} as never), /caption\(\) align/);
  bad(() => caption('x', {role: 'zzz'} as never), /caption\(\) role/);
  bad(() => caption('x', {tone: 'zzz'} as never), /caption\(\) tone/);
  bad(() => box({title: 'a', tone: 'zzz'} as never), /box\(\) tone/);
  bad(() => box({title: 'a', align: 'zzz'} as never), /box\(\) align/);
  bad(() => banner({headline: 'a', tone: 'zzz'} as never), /banner\(\) tone/);
  bad(() => row([box({title: 'a'})], {arrows: 'end'} as never), /row\(\) arrows/);
  bad(() => row([box({title: 'a'})], {justify: 'end'} as never), /row\(\) justify/);
});
test('the values the types allow still pass', () => {
  assert.ok(box({title: 'a', tone: 'solid-danger', align: 'right'}));
  assert.ok(caption('x', {align: 'left', role: 'display', tone: 'danger'}));
  assert.ok(row([box({title: 'a'}), box({title: 'b'})], {arrows: 'between', justify: 'center'}));
});

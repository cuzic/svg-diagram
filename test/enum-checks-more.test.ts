import test from 'node:test';
import assert from 'node:assert/strict';
import {box, steps} from '../lib/dsl.ts';

test('steps() refuses a solid tone on an item (its dark title would sit on the fill)', () => {
  assert.throws(() => steps([{title: 'a', tone: 'solid-danger' as never}, {title: 'b'}]), /steps\(\) item 1: tone 'solid-danger'/);
  assert.ok(steps([{title: 'a', tone: 'danger'}, {title: 'b'}]));
});

test('box() checks its tag tone and text tones', () => {
  assert.throws(() => box({title: 'a', tag: 't', tagTone: 'solid' as never}), /box\(\) tagTone/);
  assert.throws(() => box({title: 'a', titleTone: 'bogus' as never}), /box\(\) titleTone/);
  assert.throws(() => box({title: 'a', iconTone: 'plain' as never}), /box\(\) iconTone/);
  assert.ok(box({title: 'a', tag: 't', tagTone: 'danger', titleTone: 'accent', bodyTone: 'muted', noteTone: 'text'}));
});

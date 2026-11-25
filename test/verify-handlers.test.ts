import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ALL_BANDS_VERIFIED, VERIFY_HANDLERS} from '../lib/verify-handlers.ts';
import {EMIT_HANDLERS} from '../lib/emit-handlers.ts';
import {SourceRef} from '../lib/source-ref.ts';
import {issueAt} from '../lib/verify-base.ts';

test('issueAt keeps opaque source references and omits unavailable positions', () => {
  const main = new SourceRef(), other = new SourceRef();
  const issue = issueAt('overlap', main, other);
  assert.equal(issue.loc, main);
  assert.equal(issue.related?.[0], other);
  assert.deepEqual(issueAt('out of bounds'), {message: 'out of bounds'});
  assert.deepEqual(issueAt('overlap', undefined, other), {message: 'overlap', related: [other]});
});

test('every laid-out band type has a location-map entry for the location map', () => {
  assert.equal(ALL_BANDS_VERIFIED, true);
  assert.deepEqual(Object.keys(VERIFY_HANDLERS).sort(), Object.keys(EMIT_HANDLERS).sort());
});

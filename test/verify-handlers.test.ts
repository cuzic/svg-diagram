import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SourceRef} from '../lib/source-ref.ts';
import type {BandDef} from '../lib/band-def.ts';
import type {LaidOutBand} from '../lib/types/index.ts';
import {issueAt} from '../lib/verify-base.ts';
import {collectRectsWith} from '../lib/verify-rects.ts';

test('issueAt keeps opaque source references and omits unavailable positions', () => {
  const main = new SourceRef(), other = new SourceRef();
  const issue = issueAt('overlap', main, other);
  assert.equal(issue.loc, main);
  assert.equal(issue.related?.[0], other);
  assert.deepEqual(issueAt('out of bounds'), {message: 'out of bounds'});
  assert.deepEqual(issueAt('overlap', undefined, other), {message: 'overlap', related: [other]});
});

test('collectRectsWith takes the rects a definition lists, else the band as a whole, and scopes them', () => {
  const band = {type: 'box', id: 'a', scope: 'S', x: 1, y: 2, w: 30, h: 40} as unknown as LaidOutBand;
  const listed = collectRectsWith({laidOut: [band]}, () => ({verify: {rects: () => [{id: 'p', label: 'p', x: 0, y: 0, w: 1, h: 1}]}}) as unknown as BandDef);
  assert.deepEqual(listed.map(r => r.id), ['S.p']);
  const whole = collectRectsWith({laidOut: [band]}, () => undefined);
  assert.deepEqual(whole.map(r => [r.x, r.y, r.w, r.h]), [[1, 2, 30, 40]]);
  const qualified = collectRectsWith({laidOut: [band]}, () => ({rectsQualified: true, verify: {rects: () => [{id: 'p', label: 'p', x: 0, y: 0, w: 1, h: 1}]}}) as unknown as BandDef);
  assert.deepEqual(qualified.map(r => r.id), ['p']);
});

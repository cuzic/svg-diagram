import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sha1Hex} from '../lib/sha1.ts';

test('sha1Hex is node:crypto sha1 for every length around the block edges, and for non-ASCII text', () => {
  const samples = ['', 'a', 'abc', 'あいう', '😀 emoji', JSON.stringify([940, 120, false, null, '<g>図</g>'])];
  for (let n = 50; n <= 70; n++) samples.push('x'.repeat(n));
  samples.push('y'.repeat(1000));
  for (const s of samples) assert.equal(sha1Hex(s), createHash('sha1').update(s).digest('hex'), JSON.stringify(s.slice(0, 20)));
});

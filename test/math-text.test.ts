import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeTextRuns} from '../lib/math-text.ts';

const ch = (c: string, x?: number) => `<text data-variant="normal" transform="${x === undefined ? '' : `translate(${x},0) `}scale(1,-1)" font-size="884px" font-family="serif">${c}</text>`;

test('mergeTextRuns joins neighbours one em apart into one text, and pins its length', () => {
  assert.equal(mergeTextRuns(ch('利') + ch('益', 1000) + ch('率', 2000)), '<text y="0" transform="translate(0,0) scale(1,-1)" font-size="1000px" textLength="3000" lengthAdjust="spacing">利益率</text>');
});

test('mergeTextRuns keeps runs apart when something sits between them or the gap is not one em', () => {
  const out = mergeTextRuns(ch('利') + '<path d="M0 0"/>' + ch('益', 1000));
  assert.equal([...out.matchAll(/<text /g)].length, 2);
  assert.equal([...mergeTextRuns(ch('利') + ch('益', 1500)).matchAll(/<text /g)].length, 2);
});

test('mergeTextRuns counts an entity as one character (0.6 em, like any non-CJK one) and leaves other text alone', () => {
  assert.match(mergeTextRuns(ch('&amp;') + ch('益', 600)), /textLength="1600"/);
  const other = '<text font-size="12px">x</text>';
  assert.equal(mergeTextRuns(other), other);
});

test('mergeTextRuns pins a non-CJK character at the 0.6 em MathJax gave it, not 1 em', () => {
  assert.match(mergeTextRuns(ch('ā')), /textLength="600"/);
  assert.match(mergeTextRuns(ch('売') + ch('上', 1000) + ch('ā', 2000)), /textLength="2600"/);
  assert.equal([...mergeTextRuns(ch('ā') + ch('売', 1000)).matchAll(/<text /g)].length, 2, 'a gap of 1 em after a 0.6 em character is not contiguous');
});

test('mergeTextRuns leaves an emoji unpinned, so math() refuses it', () => {
  assert.doesNotMatch(mergeTextRuns(ch('😀')), /textLength/);
});

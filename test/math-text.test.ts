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

test('mergeTextRuns counts an entity as one character and leaves other text alone', () => {
  assert.match(mergeTextRuns(ch('&amp;') + ch('益', 1000)), /textLength="2000"/);
  const other = '<text font-size="12px">x</text>';
  assert.equal(mergeTextRuns(other), other);
});

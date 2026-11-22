import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {convertOpenPeeps} from './convert.ts';

test('the selected Open Peeps parts keep their transforms in the manifest', () => {
  const {box, anchors, expressions} = convertOpenPeeps();
  assert.deepEqual(box, [0, 0, 704, 860]);
  assert.deepEqual(anchors, {head: {cx: 377, cy: 347, r: 230}, mouth: [470, 485]});
  const fragments = Object.values(expressions);
  assert.equal(fragments.length, 7);
  assert.equal(new Set(fragments).size, 7);
  for (const fragment of fragments) {
    assert.match(fragment, /<g transform="matrix\(\.99789 0 0 1 6 -58\)">/);
    assert.match(fragment, /<g transform="translate\(351 275\)">/);
  }
  assert.equal(expressions.think, undefined);
});

test('the palette changes only the declared slots and keeps the illustration ink', () => {
  const {expressions, recolor, license} = convertOpenPeeps();
  assert.deepEqual(recolor, {skin: '#edb98a', hair: '#4a312c', top: '#8fa7df'});
  for (const fragment of Object.values(expressions)) {
    for (const color of Object.values(recolor)) assert.ok(fragment.includes(`fill="${color}"`));
    assert.ok(fragment.includes('fill="#000000"'));
  }
  assert.deepEqual(license, {
    spdx: 'CC0-1.0',
    author: 'Pablo Stanley',
    url: 'https://www.openpeeps.com/',
  });
});

test('character.json can be reproduced from the upstream definition', () => {
  const saved = readFileSync(new URL('./character.json', import.meta.url), 'utf8');
  assert.equal(JSON.stringify(convertOpenPeeps(), null, 2) + '\n', saved);
});

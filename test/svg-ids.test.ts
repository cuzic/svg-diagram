// prefixSvgIds / idPrefixFor (ADR 0012 D2): a pure rewrite of ids and the references to them.
import test from 'node:test';
import assert from 'node:assert/strict';
import {prefixSvgIds, idPrefixFor} from '../lib/svg-ids.ts';

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="svg-title svg-desc">
  <title id="svg-title">t</title><desc id="svg-desc">d</desc>
  <metadata id="svg-diagram">{"a":"#svg-title"}</metadata>
  <defs><marker id="dsl-arrow"><path d="M0,0"/></marker><linearGradient id="g1"/></defs>
  <style>#g1 { fill: #fab; } .x:hover, #dsl-arrow .y { stroke: #ff0000; }</style>
  <path marker-end="url(#dsl-arrow)" fill="url(#g1)"/><use href="#g1"/><use xlink:href="#dsl-arrow"/>
</svg>`;

test('ids, url(#), href, aria-labelledby (several) and <style> selectors get the same prefix', () => {
  const out = prefixSvgIds(SVG, 'p');
  assert.match(out, /<title id="p-svg-title">/);
  assert.match(out, /<desc id="p-svg-desc">/);
  assert.match(out, /aria-labelledby="p-svg-title p-svg-desc"/);
  assert.match(out, /<marker id="p-dsl-arrow">/);
  assert.match(out, /marker-end="url\(#p-dsl-arrow\)" fill="url\(#p-g1\)"/);
  assert.match(out, /<use href="#p-g1"\/>/);
  assert.match(out, /xlink:href="#p-dsl-arrow"/);
  assert.match(out, /#p-g1 \{ fill: #fab; \}/); // a colour is not an id
  assert.match(out, /#p-dsl-arrow \.y \{ stroke: #ff0000; \}/);
  assert.doesNotMatch(out, /\sid="(svg-title|svg-desc|dsl-arrow|g1)"/);
});

test('<metadata id="svg-diagram"> and its content are left alone', () => {
  const out = prefixSvgIds(SVG, 'p');
  assert.match(out, /<metadata id="svg-diagram">\{"a":"#svg-title"\}<\/metadata>/);
});

test('no ids: the markup is returned as is; unknown references are not touched', () => {
  assert.equal(prefixSvgIds('<svg><path d="M0,0"/></svg>', 'p'), '<svg><path d="M0,0"/></svg>');
  const out = prefixSvgIds('<svg><g id="a"/><use href="#zzz"/></svg>', 'p');
  assert.equal(out, '<svg><g id="p-a"/><use href="#zzz"/></svg>');
});

test('rootId becomes the prefix itself (the HTML figure root)', () => {
  const html = '<style>\n#sd-1234abcd { position: relative; }\n#sd-1234abcd .sd-b { x: 1; }\n</style>\n<div id="sd-1234abcd" class="sd"><svg><marker id="dsl-arrow"/></svg></div>';
  const out = prefixSvgIds(html, 's1', {rootId: 'sd-1234abcd'});
  assert.match(out, /<div id="s1" class="sd">/);
  assert.match(out, /^#s1 \{ position/m);
  assert.match(out, /^#s1 \.sd-b \{/m);
  assert.match(out, /<marker id="s1-dsl-arrow"\/>/);
});

test('two figures with different prefixes share no id', () => {
  const ids = (s: string) => [...s.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]).filter(i => i !== 'svg-diagram');
  const a = ids(prefixSvgIds(SVG, 'a')), b = ids(prefixSvgIds(SVG, 'b'));
  assert.ok(a.length > 0);
  assert.deepEqual(a.filter(i => b.includes(i)), []);
});

test('idPrefixFor: one source is <p>, several are <p>-<basename>; unsafe characters become -', () => {
  assert.equal(idPrefixFor('s1', null), 's1');
  assert.equal(idPrefixFor('s1', 'flow'), 's1-flow');
  assert.equal(idPrefixFor('s1', 'my flow'), 's1-my-flow');
});

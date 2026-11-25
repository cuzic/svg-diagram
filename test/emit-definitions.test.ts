import assert from 'node:assert/strict';
import {test} from 'node:test';
import {pyramidDefinition} from '../lib/bands/pyramid.ts';
import {emitHtml} from '../lib/emit-html.ts';
import {emitSvg} from '../lib/emit.ts';
import {diagram, pyramid, renderInBrowser} from '../lib/web.ts';
import {renderDiagram} from '../lib/dsl/render.ts';
import type {LaidOutDiagram} from '../lib/types/index.ts';

const measure = ({text, size}: {text: string; size: number}) => ({w: text.length * size / 2, h: size});
const fontBox = (size: number) => ({ascent: size, descent: 0});
const figure = async () => (await renderInBrowser(diagram({theme: 'blue', title: 't'}).add(pyramid(['Review', 'Base'])), {measure})).laidOut;
// JSON and structuredClone drop the definitions the renderer attached to the bands
const copy = (d: LaidOutDiagram) => JSON.parse(JSON.stringify(d)) as LaidOutDiagram;

test('emitSvg and emitHtml name the band when a copied figure has lost its definitions', async () => {
  const lost = copy(await figure());
  const message = /no definition for the "pyramid" band.*definitions/s;
  assert.throws(() => emitSvg(lost), message);
  assert.throws(() => emitHtml(lost, {fontBox}), message);
});

test('the definitions passed explicitly draw a copied figure like the original', async () => {
  const original = await figure();
  const lost = copy(original);
  assert.equal(emitSvg(lost, {definitions: [pyramidDefinition]}), emitSvg(original));
  assert.equal(emitSvg(lost, {}, () => pyramidDefinition), emitSvg(original));
  assert.equal(emitHtml(lost, {fontBox, definitions: [pyramidDefinition], id: 'x'}), emitHtml(original, {fontBox, id: 'x'}));
});

test('the full Node path draws the HTML form without being given definitions', async () => {
  const result = await renderDiagram(diagram({theme: 'blue', title: 't'}).add(pyramid(['Review', 'Base'])), {name: 'x.svg', budget: 'cacheOnly', html: true});
  assert.match(result.html ?? '', /Review/);
  assert.match(result.svg, /Review/);
});

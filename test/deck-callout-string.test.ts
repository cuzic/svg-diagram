// A slide's callout written as a string ("label: text"), and the wider table column `flex` (1 to 12). The wording in the examples is made up.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {deckSchema, validateDeck} from '../lib/deck-spec.ts';
import {calloutOf, STRING_CALLOUT_HINT, withCalloutObjects} from '../lib/deck-spec-core.ts';
import {loadDeck} from '../lib/deck-load.ts';
import {renderDeckPptxEdge} from '../lib/pptx-deck-edge.ts';
import {validateSpec} from '../lib/spec.ts';
import {renderSpec} from '../lib/spec-render.ts';
import {realEngine} from './helpers/text-engine.ts';
import {unzipEntry} from './helpers/pptx/unzip.ts';
import {closeMeasurer} from '../lib/dsl.ts';

test.after(() => closeMeasurer());

test('calloutOf: a string with a label field is split at its first ": " or "：", else it is the text', () => {
  assert.deepEqual(calloutOf('見出し語: 本文です'), {label: '見出し語: ', text: '本文です'});
  assert.deepEqual(calloutOf('見出し語：本文です'), {label: '見出し語：', text: '本文です'});
  assert.deepEqual(calloutOf('a: b: c'), {label: 'a: ', text: 'b: c'}, 'the first separator wins');
  assert.deepEqual(calloutOf('時刻 12:30 に集合'), {text: '時刻 12:30 に集合'}, 'a colon without a space is not a separator');
  assert.deepEqual(calloutOf('本文だけ'), {text: '本文だけ'});
  assert.deepEqual(calloutOf(': 先頭'), {text: ': 先頭'}, 'nothing before the separator: all text');
  assert.deepEqual(calloutOf('末尾: '), {text: '末尾: '}, 'nothing after it: all text');
  assert.deepEqual(calloutOf('１２：３０に集合'), {text: '１２：３０に集合'}, 'a full-width colon between digits is a time');
  assert.deepEqual(calloutOf('3：1 の比: 説明'), {label: '3：1 の比: ', text: '説明'}, 'the next separator is used');
  assert.deepEqual(calloutOf('見出し：３０分'), {label: '見出し：', text: '３０分'}, 'digits only after it still split');
  const long = 'あ'.repeat(70) + '：本文';
  assert.deepEqual(calloutOf(long), {text: long}, 'a label over 60 characters: kept whole');
  assert.deepEqual(calloutOf('あ'.repeat(59) + '：本文'), {label: 'あ'.repeat(59) + '：', text: '本文'});
  const obj = {label: 'x', text: 'y'};
  assert.equal(calloutOf(obj), obj);
});

test('withCalloutObjects turns string callouts into objects, leaves a deck without them as the same value, and never changes its input', () => {
  const deck = {slides: [{title: 'a', callouts: ['印: 文', {text: '文'}]}, {title: 'b'}]};
  const copy = JSON.parse(JSON.stringify(deck));
  assert.deepEqual(withCalloutObjects(deck), {slides: [{title: 'a', callouts: [{label: '印: ', text: '文'}, {text: '文'}]}, {title: 'b'}]});
  assert.deepEqual(deck, copy);
  const plain = {slides: [{title: 'a', callouts: [{text: '文'}]}]};
  assert.equal(withCalloutObjects(plain), plain);
});

test('validateDeck accepts string callouts and checks them as the objects they mean', () => {
  assert.deepEqual(validateDeck({slides: [{title: 'a', callouts: ['ラベル: 本文', {text: '本文'}, '本文だけ']}]}), []);
  // an issue in a string callout is placed on the string, with how it was read and how to keep it whole
  const bad = validateDeck({slides: [{title: 'a', callouts: ['x'.repeat(301), '', '印: ' + 'y'.repeat(301)]}]});
  assert.deepEqual(bad.map(i => i.path), ['slides[0].callouts[0]', 'slides[0].callouts[1]', 'slides[0].callouts[2]']);
  for (const i of bad) assert.ok(i.message.endsWith(`(${STRING_CALLOUT_HINT})`), i.message);
  assert.match(STRING_CALLOUT_HINT, /\{"text"/);
  assert.deepEqual(validateDeck({slides: [{title: 'a', callouts: [{text: 'x'.repeat(301)}]}]}).map(i => i.path), ['slides[0].callouts[0].text'], 'an object keeps its own place');
  assert.deepEqual(validateDeck({slides: [{title: 'a', callouts: [{label: 'x'}]}]}).map(i => [i.path, i.message]), [['slides[0].callouts[0].text', 'is required']]);
  assert.deepEqual(validateDeck({slides: [{title: 'a', callouts: ['あ'.repeat(70) + '：' + 'い'.repeat(100)]}]}), [], 'a long label part is kept whole as text, not refused as a label');
  assert.deepEqual(validateDeck({slides: [{title: 'a', callouts: ['1', '2', '3', '4']}]}).map(i => i.path), ['slides[0].callouts']);
  assert.deepEqual(validateDeck({slides: [{title: 'a', callouts: [3]}]}).map(i => i.path), ['slides[0].callouts[0]']);
  const items = (deckSchema as any).properties.slides.items.properties.callouts.items;
  assert.deepEqual(items.oneOf.map((b: {type: string}) => b.type), ['object', 'string']);
  assert.equal(items.oneOf[1].maxLength, items.oneOf[0].properties.text.maxLength, 'the string branch allows what a string with no separator is allowed');
});

test('loadDeck and the .pptx draw a string callout as its label and text', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deck-callout-'));
  try {
    const file = path.join(dir, 'deck.json');
    fs.writeFileSync(file, JSON.stringify({slides: [{title: '題', callouts: ['見本の印：見本の本文']}]}));
    const got = loadDeck(file);
    assert.ok(got.ok);
    assert.deepEqual((got.ok ? got.loaded.deck.slides[0]?.callouts : null), [{label: '見本の印：', text: '見本の本文'}]);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
  const r = await renderDeckPptxEdge({slides: [{title: '題', callouts: ['見本の印：見本の本文']}]}, realEngine(), {rasterize: () => new Uint8Array()});
  assert.deepEqual([r.issues, r.warnings], [[], []]);
  const xml = unzipEntry(Buffer.from(r.pptx as Uint8Array), 'ppt/slides/slide1.xml').toString();
  // two runs: the label plain (b="0"), the text bold (b="1")
  assert.match(xml, /<a:rPr [^>]*b="0"[^>]*>(?:(?!<\/a:rPr>).)*<\/a:rPr><a:t>見本の印：<\/a:t><\/a:r><a:r><a:rPr [^>]*b="1"[^>]*>(?:(?!<\/a:rPr>).)*<\/a:rPr><a:t>見本の本文<\/a:t>/s);
});

test('table column flex goes up to 12 (a ratio such as 2:9), and 13 is refused at its place', async () => {
  const table = (flexes: number[]) => ({version: 1, title: '例', parts: [{type: 'table', columns: flexes.map((flex, i) => ({label: `列${i}`, flex})), rows: [flexes.map((_, i) => `値${i}`)]}]});
  assert.deepEqual(validateSpec(table([2, 9])), []);
  assert.deepEqual(validateSpec(table([12, 1])), []);
  assert.deepEqual(validateSpec(table([13, 1])).map(i => [i.path, i.message]), [['parts[0].columns[0].flex', 'must be between 1 and 12 (got 13)']]);
  const r = await renderSpec(table([12, 1, 1, 1, 1, 1, 1, 1]));
  assert.equal(r.ok, true);
  assert.deepEqual(r.problems, []);
});

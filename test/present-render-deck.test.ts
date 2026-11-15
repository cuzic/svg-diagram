// ADR 0056 D5: a save redraws only the slides it changed. renderDeck keeps the drawn slides by their input (all but the notes), the
// project's settings and the fonts; a .ts figure is always drawn again (what it imports is not in the key).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {configureMeasure} from '../lib/measure.ts';
import {installResolveHook} from '../lib/resolve-hook.ts';
import {loadDeck} from '../lib/deck-load.ts';
import {renderDeck, type SlideCache} from '../lib/present/render-deck.ts';
import type {Config} from '../lib/types/project.ts';
import {JA_FONTS} from './helpers/text-engine.ts';

const cfg: Config = {measure: 'font', fonts: JA_FONTS};
installResolveHook();
configureMeasure(cfg);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'render-deck-'));
test.after(() => fs.rmSync(dir, {recursive: true, force: true}));
const figure = (label: string) => ({version: 1, title: '流れ', parts: [{type: 'flowchart', nodes: [{id: 'a', label}, {id: 'b', label: '出口'}], edges: [{from: 'a', to: 'b'}]}]});
const write = (slides: unknown[]) => { const f = path.join(dir, 'deck.json'); fs.writeFileSync(f, JSON.stringify({slides})); const r = loadDeck(f); assert.ok(r.ok); return r.loaded; };

test('a slide drawn before comes from the cache; a changed one, or a changed setting, is drawn again; the notes need no drawing', async () => {
  const cache: SlideCache = new Map();
  const first = await renderDeck(write([{title: 'A', figure: figure('入口')}, {title: 'B', notes: 'メモ'}]), cfg, {cache, fontStamp: 'f1'});
  assert.deepEqual(first.errors, []);
  assert.equal(cache.size, 2);
  const same = await renderDeck(write([{title: 'A', figure: figure('入口')}, {title: 'B', notes: '直したメモ'}]), cfg, {cache, fontStamp: 'f1'});
  assert.deepEqual(same.slides.map(s => s?.hash), first.slides.map(s => s?.hash));
  assert.equal(same.slides[1]?.notes, '直したメモ', 'the notes are the deck\'s now, not the cached ones');
  const edited = await renderDeck(write([{title: 'A', figure: figure('入り口')}, {title: 'B'}]), cfg, {cache, fontStamp: 'f1'});
  assert.notEqual(edited.slides[0]?.hash, first.slides[0]?.hash, 'the figure changed');
  assert.equal(edited.slides[1]?.hash, first.slides[1]?.hash);
  assert.equal(cache.size, 2, 'only this deck\'s slides are kept');
  // the cache is keyed by the settings and fonts too: the same input under another font stamp is a new entry
  await renderDeck(write([{title: 'A', figure: figure('入り口')}, {title: 'B'}]), cfg, {cache, fontStamp: 'f2'});
  assert.equal(cache.size, 2);
  assert.ok([...cache.keys()].every(k => !first.slides.some(s => s?.hash === k)));
});

test('a .ts figure is never taken from the cache', async () => {
  fs.writeFileSync(path.join(dir, 'fig.ts'), `import {diagram, box} from 'svg-diagram';\nexport default () => diagram({theme: 'blue', title: 'ts'}).add(box({id: 'a', title: 'ソース'}));\n`);
  const cache: SlideCache = new Map();
  await renderDeck(write([{title: 'T', figure: 'fig.ts'}, {title: 'U'}]), cfg, {cache});
  assert.equal(cache.size, 1, 'only the slide without a .ts figure');
});

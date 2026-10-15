// ADR 0018 unit A: the deck viewer's state transitions (lib/deck-viewer/state.js) — pure, tested without a DOM.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {initialState, reduce, parseHash, formatHash, keyToInput} from '../lib/deck-viewer/state.js';
import type {DeckInput} from '../lib/deck-viewer/state.js';

const run = (total: number, ...inputs: DeckInput[]) => inputs.reduce(reduce, initialState(total));

test('next / prev stop at the ends (no wrap-around)', () => {
  assert.equal(run(3, {type: 'next'}, {type: 'next'}, {type: 'next'}, {type: 'next'}).index, 2);
  assert.equal(run(3, {type: 'prev'}).index, 0);
  assert.equal(run(3, {type: 'last'}).index, 2);
  assert.equal(run(3, {type: 'last'}, {type: 'first'}).index, 0);
  assert.equal(run(1, {type: 'next'}).index, 0);
  assert.equal(run(0, {type: 'next'}).index, 0);
});

test('goto takes the 1-based number and rounds into range', () => {
  assert.equal(run(5, {type: 'goto', n: 3}).index, 2);
  assert.equal(run(5, {type: 'goto', n: 99}).index, 4);
  assert.equal(run(5, {type: 'goto', n: 0}).index, 0);
  assert.equal(run(5, {type: 'goto', n: -4}).index, 0);
  assert.equal(run(5, {type: 'goto', n: 2.6}).index, 2);
  assert.equal(run(5, {type: 'last'}, {type: 'goto', n: Number.NaN}).index, 0);
});

test('reduce does not mutate its input, and ignores an unknown input', () => {
  const s = initialState(4, 1);
  const frozen = Object.freeze({...s});
  const t = reduce(frozen, {type: 'next'});
  assert.equal(frozen.index, 1);
  assert.equal(t.index, 2);
  assert.deepEqual(reduce(s, {type: 'nope'} as unknown as DeckInput), s);
  assert.deepEqual(reduce(s, null), s);
});

test('grid and zoom: no zoom in the grid; leaving a slide drops its zoom; select closes the grid', () => {
  assert.equal(run(3, {type: 'toggleZoom'}).zoom, true);
  assert.equal(run(3, {type: 'toggleZoom'}, {type: 'toggleZoom'}).zoom, false);
  const g = run(3, {type: 'toggleGrid'}, {type: 'toggleZoom'});
  assert.equal(g.grid, true);
  assert.equal(g.zoom, false);
  assert.equal(run(3, {type: 'toggleZoom'}, {type: 'toggleGrid'}).zoom, false);
  assert.equal(run(3, {type: 'toggleZoom'}, {type: 'next'}).zoom, false);
  assert.equal(run(3, {type: 'last'}, {type: 'toggleZoom'}, {type: 'goto', n: 3}).zoom, true, 'staying on the slide keeps the zoom');
  const sel = run(5, {type: 'toggleGrid'}, {type: 'select', n: 4});
  assert.deepEqual([sel.index, sel.grid], [3, false]);
  assert.equal(run(3, {type: 'toggleGrid'}, {type: 'closeGrid'}).grid, false);
  assert.equal(run(3, {type: 'toggleGrid'}, {type: 'toggleGrid'}).grid, false);
});

test('parseHash: number, name, grid; out-of-range and invalid fall back to the first slide', () => {
  const names = ['flow', 'gap', 's-3'];
  assert.deepEqual(parseHash('#2', names, 3), {index: 1, grid: false});
  assert.deepEqual(parseHash('3', names, 3), {index: 2, grid: false});
  assert.deepEqual(parseHash('#gap', names, 3), {index: 1, grid: false});
  assert.deepEqual(parseHash('#%67ap', names, 3), {index: 1, grid: false}, 'percent-encoding is decoded');
  assert.deepEqual(parseHash('#grid', names, 3, 2), {index: 2, grid: true});
  assert.deepEqual(parseHash('#grid', names, 3, 99), {index: 2, grid: true});
  for (const bad of ['', '#', '#0', '#4', '#-1', '#1.5', '#nope', '#%E0%A4%A', '#2x']) {
    assert.deepEqual(parseHash(bad, names, 3), {index: 0, grid: false}, bad);
  }
  assert.deepEqual(parseHash('#1', [], 0), {index: 0, grid: false});
});

test('formatHash writes what parseHash reads back', () => {
  const names = ['a', 'b', 'c', 'd'];
  for (const s of [initialState(4, 0), initialState(4, 3), {...initialState(4, 2), grid: true}]) {
    assert.deepEqual(parseHash(formatHash(s), names, s.total, s.index), {index: s.index, grid: s.grid});
  }
  assert.equal(formatHash(initialState(8, 2)), '#3');
  assert.equal(formatHash({...initialState(8, 2), grid: true}), '#grid');
});

test('keyToInput: the key table', () => {
  const k = (key: string, more: object = {}, ctx: object = {}) => keyToInput({key, ...more}, ctx);
  assert.deepEqual(k('ArrowRight'), {type: 'next'});
  assert.deepEqual(k('PageDown'), {type: 'next'});
  assert.deepEqual(k('ArrowLeft'), {type: 'prev'});
  assert.deepEqual(k('PageUp'), {type: 'prev'});
  assert.deepEqual(k('Home'), {type: 'first'});
  assert.deepEqual(k('End'), {type: 'last'});
  assert.deepEqual(k(' '), {type: 'next'});
  assert.deepEqual(k(' ', {shiftKey: true}), {type: 'prev'});
  assert.deepEqual(k('g'), {type: 'toggleGrid'});
  assert.deepEqual(k('z'), {type: 'toggleZoom'});
  assert.deepEqual(k('Escape', {}, {grid: true}), {type: 'closeGrid'});
  assert.equal(k('Escape'), null, 'Esc outside the grid is not ours');
  assert.equal(k('q'), null);
  assert.equal(k('Enter'), null);
});

test('keyToInput leaves the key alone with Ctrl / Alt / Meta, in a text field, and Space on a button or link', () => {
  for (const mod of ['ctrlKey', 'altKey', 'metaKey']) {
    assert.equal(keyToInput({key: 'ArrowLeft', [mod]: true}), null, mod);
    assert.equal(keyToInput({key: 'g', [mod]: true}), null, mod);
  }
  for (const key of ['ArrowRight', ' ', 'g', 'z', 'Home']) assert.equal(keyToInput({key}, {typing: true}), null, key);
  assert.equal(keyToInput({key: ' '}, {interactive: true}), null);
  assert.equal(keyToInput({key: ' ', shiftKey: true}, {interactive: true}), null);
  assert.deepEqual(keyToInput({key: 'ArrowRight'}, {interactive: true}), {type: 'next'}, 'only Space / Enter belong to the focused control');
});

test('state.js uses no DOM, no window, no imports (ADR 0018: pure)', () => {
  const src = fs.readFileSync(path.resolve(import.meta.dirname, '../lib/deck-viewer/state.js'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(src, /\b(window|document|globalThis|location|history|navigator|process|require)\b/);
  assert.doesNotMatch(src, /^\s*import\b/m);
});

// ADR 0017 U1: canvas.minText range, the project's fontFloor, and the applyConfig permission check.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {applyConfig, loadConfig} from '../lib/config.ts';
import {diagram} from '../lib/dsl.ts';
import {MIN_TEXT_ABSOLUTE, canvasFontScale} from '../lib/tokens.ts';

const cfgIn = (json: object): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'font-floor-'));
  fs.writeFileSync(path.join(dir, '.svg-diagram.json'), JSON.stringify(json));
  return dir;
};

test('canvas.minText: 10 is the absolute floor; below it, NaN and non-numbers throw', () => {
  assert.equal(MIN_TEXT_ABSOLUTE, 10);
  assert.doesNotThrow(() => diagram({theme: 'blue', canvas: {minText: 10}}));
  assert.doesNotThrow(() => diagram({theme: 'blue', canvas: {minText: 14}}));
  for (const bad of [9, 9.99, NaN, Infinity, '10', null]) assert.throws(() => diagram({theme: 'blue', canvas: {minText: bad as never}}), /minText/, String(bad));
});

test('canvas.minText sets the font scale from the tokens (no measuring)', () => {
  assert.equal(canvasFontScale(10), 0.72);
  assert.equal(canvasFontScale(14), 1);
});

test('fontFloor: loadConfig accepts 10..14, throws on a non-number, 9 and 15', () => {
  assert.equal(loadConfig(cfgIn({fontFloor: 10})).fontFloor, 10);
  assert.equal(loadConfig(cfgIn({fontFloor: 14})).fontFloor, 14);
  assert.equal(loadConfig(cfgIn({})).fontFloor, undefined);
  for (const bad of ['10', 9, 15, null]) assert.throws(() => loadConfig(cfgIn({fontFloor: bad})), /fontFloor/, String(bad));
});

test('applyConfig: a canvas minText below the project fontFloor (default 14) throws; allowed when fontFloor is lower', () => {
  const dense = () => diagram({theme: 'blue', canvas: {minText: 10}});
  assert.throws(() => applyConfig(dense(), {}), /fontFloor \(14\)/);
  assert.throws(() => applyConfig(dense(), {fontFloor: 12}), /fontFloor \(12\)/);
  assert.doesNotThrow(() => applyConfig(dense(), {fontFloor: 10}));
  assert.doesNotThrow(() => applyConfig(diagram({theme: 'blue', canvas: {minText: 11}}), {fontFloor: 11}));
});

test('applyConfig: fontFloor alone changes nothing; slide canvas, no canvas and a document figure are never affected', () => {
  assert.doesNotThrow(() => applyConfig(diagram({theme: 'blue', canvas: 'slide'}), {fontFloor: 10}));
  assert.doesNotThrow(() => applyConfig(diagram({theme: 'blue'}), {}));
  assert.doesNotThrow(() => applyConfig(diagram({theme: 'blue', canvas: 'slide'}), {}));
});

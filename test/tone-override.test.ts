// diagram({tones}) / .svg-diagram.json "tones" (issue #117): validated, drawn, and checked like the built-in tone colours.
import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {box, checkDiagram, closeMeasurer, diagram, renderDiagram} from '../lib/dsl.ts';
import {applyConfig, loadConfig} from '../lib/config.ts';
import type {ToneOverrides} from '../lib/tokens.ts';
type Opts = {appearance?: 'light' | 'dark'; tones?: ToneOverrides};
import {TONES, toneStyle, withTones} from '../lib/tokens.ts';

test.after(() => closeMeasurer());

const pair = async (opts: Opts = {}) => {
  const d = diagram({theme: 'blue', ...opts});
  d.add(box({id: 'a', title: 'a'}), box({id: 'b', title: 'b', tone: 'accent'}));
  return d;
};
const svgOf = async (opts?: Opts) => (await renderDiagram(await pair(opts), {name: 'd.svg', budget: 'cacheOnly'})).svg;
const collisions = async (opts?: Opts) => (await checkDiagram(await pair(opts))).verdict.findings.filter(f => f.rule === 'gray-tone-collision');
const findings = async (rule: string, opts?: Opts) => (await checkDiagram(await pair(opts))).verdict.findings.filter(f => f.rule === rule);

test('a darker accent fill clears gray-tone-collision and is what gets drawn', async () => {
  assert.equal((await collisions()).length, 1);
  assert.deepEqual(await collisions({tones: {accent: {fill: '#b8cfe8'}}}), []);
  const svg = await svgOf({tones: {accent: {fill: '#b8cfe8'}}});
  assert.match(svg, /fill="#b8cfe8"/);
});

test('the override is scoped to the diagram: toneStyle is back to the table afterwards', async () => {
  await svgOf({tones: {accent: {fill: '#b8cfe8'}}});
  assert.equal(toneStyle('accent'), TONES.accent);
  assert.equal(withTones({accent: {fill: '#112233'}}, () => toneStyle('accent').fill), '#112233');
  assert.equal(withTones({accent: {fill: '#112233'}}, () => toneStyle('ok').fill), '#112233', 'aliases follow');
});

test('an overridden fill is held to the text-contrast check', async () => {
  assert.deepEqual(await findings('a11y-text-contrast'), []);
  const hit = await findings('a11y-text-contrast', {tones: {accent: {fill: '#303030'}}});
  assert.ok(hit.length > 0, 'dark text on a near-black fill');
});

test('the gray-tone-collision message names both remedies', async () => {
  const [f] = await collisions();
  assert.match(f.message, /tones/);
  assert.match(f.message, /accept/);
});

test('dark appearance: the dark colour is drawn and judged, the light one is not', async () => {
  const opts = {appearance: 'dark' as const, tones: {accent: {fill: '#b8cfe8', dark: {fill: '#2a4a70'}}}};
  const svg = await svgOf(opts);
  assert.match(svg, /fill="#2a4a70"/);
  assert.doesNotMatch(svg, /fill="#b8cfe8"/);
  assert.match(svg, /data-tone-colors="[^"]*#2a4a70/);
  // without a dark colour the light one stays: a pale fill on the dark page is a contrast finding
  const pale = await findings('a11y-text-contrast', {appearance: 'dark', tones: {accent: {fill: '#f5f5f5'}}});
  assert.ok(pale.length > 0);
});

test('validation: unknown tone, unknown colour key, non-hex values throw', () => {
  const bad = (tones: unknown, re: RegExp) => assert.throws(() => diagram({theme: 'blue', tones: tones as never}), re);
  bad({nope: {fill: '#ffffff'}}, /unknown tone "nope"/);
  bad({ok: {fill: '#ffffff'}}, /alias of "accent"/);
  bad({accent: {fil: '#ffffff'}}, /unknown colour "fil"/);
  bad({accent: {fill: 'red'}}, /#rrggbb/);
  bad({accent: {fill: '#fff'}}, /#rrggbb/);
  bad({accent: {dark: {fill: 'x'}}}, /tones\}\)\.accent\.dark\.fill/);
  bad([], /must be an object/);
});

test('.svg-diagram.json: loaded, validated, and a diagram\'s own colours win per colour', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tones-'));
  fs.writeFileSync(path.join(dir, '.svg-diagram.json'), JSON.stringify({tones: {accent: {fill: '#b8cfe8', stroke: '#112233'}}}));
  const cfg = loadConfig(dir);
  const d = applyConfig(diagram({theme: 'blue', tones: {accent: {fill: '#aabbcc'}}}), cfg);
  assert.deepEqual(d.tones, {accent: {fill: '#aabbcc', stroke: '#112233'}});
  fs.writeFileSync(path.join(dir, '.svg-diagram.json'), JSON.stringify({tones: {accent: {fill: 'blue'}}}));
  assert.throws(() => loadConfig(dir), /\.svg-diagram\.json: "tones"\.accent\.fill must be a #rrggbb/);
  fs.writeFileSync(path.join(dir, '.svg-diagram.json'), JSON.stringify({tones: {bogus: {}}}));
  assert.throws(() => loadConfig(dir), /unknown tone "bogus"/);
});

test('a diagram rendered after one with overrides gets the built-in colours (no leak), and a throw restores the table', async () => {
  const over = await svgOf({tones: {accent: {fill: '#b8cfe8'}}});
  const plain = await svgOf();
  assert.match(over, /#b8cfe8/);
  assert.doesNotMatch(plain, /#b8cfe8|data-tone-colors/);
  assert.equal(await svgOf(), plain);
  assert.throws(() => withTones({accent: {fill: '#112233'}}, () => { throw new Error('boom'); }), /boom/);
  assert.equal(toneStyle('accent'), TONES.accent);
});

test('solid: an overridden text colour is what the box text is drawn in and judged by', async () => {
  const solid = async (tones: ToneOverrides) => {
    const d = diagram({theme: 'blue', tones});
    d.add(box({id: 'a', title: 'a', tone: 'solid'}));
    return {svg: (await renderDiagram(d, {name: 'd.svg', budget: 'cacheOnly'})).svg, findings: (await checkDiagram(d)).verdict.findings.map(f => f.rule)};
  };
  const ok = await solid({solid: {text: '#fff4e0'}});
  assert.match(ok.svg.replace(/data-tone-colors="[^"]*"/, ''), /fill="#fff4e0"/);
  const bad = await solid({solid: {text: '#3070b0'}});
  assert.ok(bad.findings.includes('a11y-text-contrast'), 'blue text on the blue solid fill');
});

test('dark colours: none for a built-in light colour, one per light colour', async () => {
  assert.throws(() => diagram({theme: 'blue', tones: {accent: {fill: '#ffffff', dark: {fill: '#334455'}}}}), /#ffffff is a built-in colour/);
  await assert.rejects(svgOf({appearance: 'dark', tones: {accent: {fill: '#aabbcc', dark: {fill: '#111111'}}, new: {fill: '#aabbcc', dark: {fill: '#222222'}}}}), /two dark colours/);
});

test('lint-svg: override colours are not off-token in the diagram that declares them', async () => {
  const {execFileSync} = await import('node:child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tones-lint-'));
  const run = (name: string, svg: string) => { const f = path.join(dir, name); fs.writeFileSync(f, svg); return execFileSync(process.execPath, [new URL('../lint-svg.ts', import.meta.url).pathname, f], {encoding: 'utf8'}); };
  const light = await svgOf({tones: {accent: {fill: '#b8cfe8', stroke: '#2a4a70'}}});
  const dark = await svgOf({appearance: 'dark', tones: {accent: {fill: '#b8cfe8', dark: {fill: '#2a4a70'}}}});
  assert.doesNotMatch(run('light.svg', light), /off-token-color/);
  assert.doesNotMatch(run('dark.svg', dark), /off-token-color/);
  assert.match(run('stripped.svg', light.replace(/ data-tone-colors="[^"]*"/, '')), /off-token-color[\s\S]*#b8cfe8/);
});

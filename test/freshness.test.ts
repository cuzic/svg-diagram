// lib/freshness.ts and lib/error-format.ts (ADR 0013)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {freshness, locateSource, ownsOutput, readProvenance} from '../lib/freshness.ts';
import {depsSha256} from '../lib/source-deps.ts';
import {formatBuildError} from '../lib/error-format.ts';

const sha = (f: string) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const svgWith = (meta: object | null) => `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">${meta ? `<metadata id="svg-diagram">${esc(JSON.stringify(meta))}</metadata>` : ''}</svg>`;

function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fresh-'));
  const w = (rel: string, body: string) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), {recursive: true}); fs.writeFileSync(f, body); return f; };
  return {root, w};
}

test('freshness: matching hashes are fresh; a changed source is stale (reason source)', () => {
  const {root, w} = project();
  const src = w('src/a.ts', 'export default 1;\n');
  const svg = w('svg/a.svg', svgWith({source: 'src/a.ts', sourceSha256: sha(src)}));
  assert.deepEqual(freshness(svg, root), {state: 'fresh', source: src});
  fs.writeFileSync(src, 'export default 2;\n');
  assert.deepEqual(freshness(svg, root), {state: 'stale', reason: 'source', source: src});
});

test('freshness: a changed import is stale (reason deps), and an unchanged one is fresh', () => {
  const {root, w} = project();
  w('src/part.ts', 'export const x = 1;\n');
  const src = w('src/a.ts', `import {x} from './part.ts';\nexport default x;\n`);
  const svg = w('svg/a.svg', svgWith({source: 'src/a.ts', sourceSha256: sha(src), depsSha256: depsSha256(src)}));
  assert.equal(freshness(svg, root).state, 'fresh');
  // depsSha256 caches file contents per process, so the changed import is a second project whose recorded hash differs
  const copy = project();
  copy.w('src/part.ts', 'export const x = 2;\n'); copy.w('src/a.ts', fs.readFileSync(src, 'utf8'));
  const svg2 = copy.w('svg/a.svg', svgWith({source: 'src/a.ts', sourceSha256: sha(path.join(copy.root, 'src/a.ts')), depsSha256: 'not-the-hash'}));
  assert.deepEqual(freshness(svg2, copy.root), {state: 'stale', reason: 'deps', source: path.join(copy.root, 'src/a.ts')});
});

test('freshness: no metadata, no sourceSha256 or a source that cannot be found is unknown (never a warning)', () => {
  const {root, w} = project();
  const hand = w('svg/hand.svg', svgWith(null));
  assert.equal(freshness(hand, root).state, 'unknown');
  const nohash = w('svg/nohash.svg', svgWith({source: 'src/a.ts'}));
  assert.equal(freshness(nohash, root).state, 'unknown');
  const lost = w('svg/lost.svg', svgWith({source: 'src/gone.ts', sourceSha256: 'x'}));
  assert.equal(freshness(lost, root).state, 'unknown');
  assert.equal(freshness(path.join(root, 'svg/missing.svg'), root).state, 'unknown');
  assert.equal(readProvenance(w('svg/bad.svg', '<svg><metadata id="svg-diagram">{nope</metadata></svg>')), null);
});

test('locateSource: the cwd, then the parent of the SVG directory, then the directory of .svg-diagram.json', () => {
  const {root, w} = project();
  const src = w('proj/src/a.ts', 'export default 1;\n');
  const svg = w('proj/svg/a.svg', svgWith({source: 'src/a.ts', sourceSha256: sha(src)}));
  const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'fresh-cwd-'));
  const prov = readProvenance(svg)!;
  assert.equal(locateSource(prov, {svgPath: svg, cwd: path.join(root, 'proj')}), src, 'the cwd');
  assert.equal(locateSource(prov, {svgPath: svg, cwd: elsewhere}), src, 'the parent of the svg directory');
  const nested = w('proj/out/deep/a.svg', svgWith({source: 'src/a.ts', sourceSha256: sha(src)}));
  assert.equal(locateSource(prov, {svgPath: nested, cwd: elsewhere}), null, 'nowhere to look');
  w('proj/.svg-diagram.json', '{}');
  assert.equal(locateSource(prov, {svgPath: nested, cwd: elsewhere}), src, 'beside .svg-diagram.json');
});

test('freshness: a reveal stage file carries the same provenance', () => {
  const {root, w} = project();
  const src = w('src/a.ts', 'export default 1;\n');
  const stage = w('svg/a.reveal1.svg', svgWith({source: 'src/a.ts', sourceSha256: sha(src), reveal: 1}));
  assert.equal(freshness(stage, root).state, 'fresh');
  fs.writeFileSync(src, 'changed\n');
  assert.equal(freshness(stage, root).state, 'stale');
});

test('ownsOutput: decided by the embedded source path alone, not by the hashes', () => {
  const {root, w} = project();
  w('src/a.ts', 'x'); w('src/b.ts', 'x');
  const mine = w('svg/a.svg', svgWith({source: 'src/a.ts', sourceSha256: 'does-not-match'}));
  assert.equal(ownsOutput(mine, 'src/a.ts', root), true);
  assert.equal(ownsOutput(mine, 'src/b.ts', root), false, 'another source');
  assert.equal(ownsOutput(w('svg/hand.svg', svgWith(null)), 'src/a.ts', root), false, 'hand-made');
  assert.equal(ownsOutput(path.join(root, 'svg/none.svg'), 'src/a.ts', root), false, 'no file');
});

test('formatBuildError: one "✗ source: message" line, no stack; multi-line messages are kept; SVG_DIAGRAM_DEBUG adds the stack', () => {
  const err = new Error('boom\n  second line');
  assert.equal(formatBuildError('src/x.ts', err, {}), '✗ src/x.ts: boom\n  second line');
  assert.doesNotMatch(formatBuildError('src/x.ts', err, {}), /\n\s+at /);
  assert.match(formatBuildError('src/x.ts', err, {SVG_DIAGRAM_DEBUG: '1'}), /\n\s+at /);
  assert.equal(formatBuildError('s', 'plain string', {}), '✗ s: plain string');
});

test('freshness: any candidate that hashes as recorded makes it fresh; stale only when every existing candidate differs', () => {
  const {root, w} = project();
  const text = 'export default 1;\n';
  const mine = w('A/src/a.ts', text);
  w('B/src/a.ts', 'something else\n'); // another project, same relative path, found first from the cwd
  const svg = w('A/svg/a.svg', svgWith({source: 'src/a.ts', sourceSha256: sha(mine)}));
  assert.deepEqual(freshness(svg, path.join(root, 'B')), {state: 'fresh', source: mine});
  fs.writeFileSync(mine, 'edited\n');
  assert.equal(freshness(svg, path.join(root, 'B')).state, 'stale');
});

test('freshness: when no candidate is fresh, the one whose source hash matches is reported (deps), not another project\'s file', () => {
  const {root, w} = project();
  const mine = w('A/src/a.ts', 'export default 1;\n');
  w('B/src/a.ts', 'something else\n');
  const svg = w('A/svg/a.svg', svgWith({source: 'src/a.ts', sourceSha256: sha(mine), depsSha256: 'not-the-recorded-deps'}));
  assert.deepEqual(freshness(svg, path.join(root, 'B')), {state: 'stale', reason: 'deps', source: mine});
});

test('freshness: a failure while reading is no claim (unknown), not an exception', () => {
  const {root, w} = project();
  const src = w('src/a.ts', 'x');
  const svg = w('svg/a.svg', svgWith({source: 'src/a.ts', sourceSha256: sha(src)}));
  fs.chmodSync(src, 0o000);
  try { assert.ok(['unknown', 'fresh'].includes(freshness(svg, root).state)); } finally { fs.chmodSync(src, 0o644); }
});

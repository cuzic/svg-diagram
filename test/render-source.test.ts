// renderSource(): the programmatic entry (`svg-diagram/render`) — a source file in, an SVG string out, nothing on disk.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {renderSource, close} from '../lib/render-source.ts';

test.after(() => close());

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'render-source-'));

test('renders a source that imports from "svg-diagram" and lists the files it depends on', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'helper.ts'), `export const title = '見出し';\n`);
  const src = path.join(dir, 'ok.ts');
  fs.writeFileSync(src, `import {diagram, box} from 'svg-diagram';\nimport {title} from './helper.ts';\nexport default function define() { return diagram({theme: 'blue'}).add(box({title, body: '本文'})); }\n`);
  const r = await renderSource(src);
  assert.equal(r.ok, true);
  assert.match(r.svg, /^<svg\b/);
  assert.deepEqual(r.deps, [src, path.join(dir, 'helper.ts')]);
  assert.deepEqual(fs.readdirSync(dir).sort(), ['helper.ts', 'ok.ts']);
  fs.rmSync(dir, {recursive: true});
});

test('a source that fails verification still returns its picture, with ok: false and the problems', async () => {
  const dir = tmp();
  const src = path.join(dir, 'crowded.ts');
  fs.writeFileSync(src, `import {diagram, row, box, connect} from 'svg-diagram';\nexport default function define() {\n  return diagram({theme: 'blue'}).add(row([box({id: 'a', title: '左', body: '本文'}), box({id: 'b', title: '右', body: '本文'})], {gap: 24}), connect('a:right', 'b:left', {label: '長めのラベルです', chip: true, route: 'elbow'}));\n}\n`);
  const r = await renderSource(src);
  assert.equal(r.ok, false);
  assert.ok(r.problems.length > 0);
  assert.match(r.svg, /^<svg\b/);
  fs.rmSync(dir, {recursive: true});
});

test('fresh: true re-reads an edited source; a source without a default export function throws', async () => {
  const dir = tmp();
  const src = path.join(dir, 'edit.ts');
  const body = (t: string) => `import {diagram, box} from 'svg-diagram';\nexport default function define() { return diagram({theme: 'blue'}).add(box({title: '${t}'})); }\n`;
  fs.writeFileSync(src, body('first'));
  assert.match((await renderSource(src, {fresh: true})).svg, /first/);
  fs.writeFileSync(src, body('second'));
  const r = await renderSource(src, {fresh: true});
  assert.match(r.svg, /second/);
  fs.writeFileSync(path.join(dir, 'bad.ts'), `export const x = 1;\n`);
  await assert.rejects(renderSource(path.join(dir, 'bad.ts')), /no default export function/);
  fs.rmSync(dir, {recursive: true});
});

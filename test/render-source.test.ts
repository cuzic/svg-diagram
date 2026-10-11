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

const ROOT = path.resolve(import.meta.dirname, '..');
const body = (title: string) => `import {diagram, box} from 'svg-diagram';\nexport default function define() { return diagram({theme: 'blue'}).add(box({title: '${title}'})); }\n`;
const rootAttr = (svg: string, name: string) => Number(new RegExp(`<svg\\b[^>]*\\s${name}="([0-9.]+)"`).exec(svg)![1]);

test('deps lists the source first, then everything it imports, however deep, and nothing from node_modules', async () => {
  const dir = tmp();
  fs.mkdirSync(path.join(dir, 'lib'));
  fs.writeFileSync(path.join(dir, 'lib', 'c.ts'), `export const c = 'C';\n`);
  fs.writeFileSync(path.join(dir, 'lib', 'b.ts'), `import {c} from './c.ts';\nexport const b = c + 'B';\n`);
  const src = path.join(dir, 'a.ts');
  fs.writeFileSync(src, `import {diagram, box} from 'svg-diagram';\nimport {b} from './lib/b.ts';\nexport default function define() { return diagram({theme: 'blue'}).add(box({title: b})); }\n`);
  const r = await renderSource(src);
  assert.equal(r.deps[0], src);
  assert.deepEqual(new Set(r.deps), new Set([src, path.join(dir, 'lib', 'b.ts'), path.join(dir, 'lib', 'c.ts')]));
  assert.ok(r.deps.every(d => path.isAbsolute(d) && !d.includes('node_modules')));
  assert.match(r.svg, /CB/);
  fs.rmSync(dir, {recursive: true});
});

test('a path relative to the working directory works and gives the same figure as the absolute one', async () => {
  const dir = tmp();
  const src = path.join(dir, 'rel.ts');
  fs.writeFileSync(src, body('relative'));
  const cwd = process.cwd();
  process.chdir(dir);
  try {
    const rel = await renderSource('./rel.ts', {fresh: true});
    const abs = await renderSource(src, {fresh: true});
    assert.equal(rel.svg, abs.svg);
    assert.deepEqual(rel.deps, [fs.realpathSync(src) === src ? src : path.resolve('rel.ts')]);
  } finally { process.chdir(cwd); fs.rmSync(dir, {recursive: true}); }
});

test('without fresh, an edited source is not re-read in the same process (that is what fresh is for)', async () => {
  const dir = tmp();
  const src = path.join(dir, 'cache.ts');
  fs.writeFileSync(src, body('first'));
  assert.match((await renderSource(src)).svg, /first/);
  fs.writeFileSync(src, body('second'));
  assert.match((await renderSource(src)).svg, /first/);
  assert.match((await renderSource(src, {fresh: true})).svg, /second/);
  fs.rmSync(dir, {recursive: true});
});

test('errors in the source reach the caller with their own message: syntax, define(), a missing file', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'syntax.ts'), `export default function define( {\n`);
  fs.writeFileSync(path.join(dir, 'throws.ts'), `export default function define() { throw new Error('define blew up'); }\n`);
  fs.writeFileSync(path.join(dir, 'notdiagram.ts'), `export default function define() { return 42; }\n`);
  await assert.rejects(renderSource(path.join(dir, 'syntax.ts'), {fresh: true}));
  await assert.rejects(renderSource(path.join(dir, 'throws.ts'), {fresh: true}), /define blew up/);
  await assert.rejects(renderSource(path.join(dir, 'notdiagram.ts'), {fresh: true}));
  await assert.rejects(renderSource(path.join(dir, 'missing.ts')), /missing\.ts/);
  fs.rmSync(dir, {recursive: true});
});

test('width and height are the root attributes of the SVG', async () => {
  const dir = tmp();
  const src = path.join(dir, 'size.ts');
  fs.writeFileSync(src, body('size'));
  const r = await renderSource(src);
  assert.equal(r.width, rootAttr(r.svg, 'width'));
  assert.equal(r.height, rootAttr(r.svg, 'height'));
  fs.rmSync(dir, {recursive: true});
});

test('the SVG is well-formed XML and says nothing in notes for a plain figure', async () => {
  const dir = tmp();
  const src = path.join(dir, 'plain.ts');
  fs.writeFileSync(src, body('a & b <c>'));
  const r = await renderSource(src);
  assert.equal(r.ok, true);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.notes, []);
  assert.ok(!/<(?!\/?[a-zA-Z!?])/.test(r.svg), 'a stray < in the SVG');
  assert.match(r.svg, /a &amp; b &lt;c&gt;/);
  fs.rmSync(dir, {recursive: true});
});

test('a figure for a slide with no measured budget is drawn at the default size with a note, and starts nothing (cacheOnly)', async () => {
  const dir = tmp();
  const src = path.join(dir, 'slide.ts');
  fs.writeFileSync(src, `import {diagram, box} from 'svg-diagram';\nexport default function define() { return diagram({theme: 'blue', slide: {page: 'no-such-page.md', heading: 'x'}}).add(box({title: 'a'})); }\n`);
  const r = await renderSource(src);
  assert.equal(r.ok, true);
  assert.equal(r.notes.length, 1);
  assert.match(r.notes[0], /未計測|キャッシュ/);
  fs.rmSync(dir, {recursive: true});
});

test('.svg-diagram.json is read from the source\'s directory by default, and from configFrom when given', async () => {
  const dir = tmp(), other = tmp();
  fs.writeFileSync(path.join(dir, '.svg-diagram.json'), JSON.stringify({measure: 'font', fonts: {sans: {regular: '/no/such/font.ttf', bold: '/no/such/font.ttf'}}}));
  const src = path.join(dir, 'cfg.ts');
  fs.writeFileSync(src, body('cfg'));
  await assert.rejects(renderSource(src, {fresh: true}), /font\.ttf/);
  assert.equal((await renderSource(src, {fresh: true, configFrom: other})).ok, true);
  fs.rmSync(dir, {recursive: true}); fs.rmSync(other, {recursive: true});
});

test('a figure that fails verification still comes back with its size, ok false, and each problem as a string', async () => {
  const dir = tmp();
  const src = path.join(dir, 'crowded.ts');
  fs.writeFileSync(src, `import {diagram, row, box, connect} from 'svg-diagram';\nexport default function define() {\n  return diagram({theme: 'blue'}).add(row([box({id: 'a', title: '左', body: '本文'}), box({id: 'b', title: '右', body: '本文'})], {gap: 24}), connect('a:right', 'b:left', {label: '長めのラベルです', chip: true, route: 'elbow'}));\n}\n`);
  const bad = await renderSource(src, {fresh: true});
  assert.equal(bad.ok, false);
  assert.ok(bad.problems.length > 0 && bad.problems.every(p => typeof p === 'string' && p.length > 0));
  assert.equal(bad.width, rootAttr(bad.svg, 'width'));
  fs.rmSync(dir, {recursive: true});
});

test('several renders at once give what the same renders one after another give', async () => {
  const dir = tmp();
  const files = ['one', 'two', 'three'].map(n => { const f = path.join(dir, `${n}.ts`); fs.writeFileSync(f, body(n)); return f; });
  const together = await Promise.all(files.map(f => renderSource(f, {fresh: true})));
  const apart = [];
  for (const f of files) apart.push(await renderSource(f, {fresh: true}));
  assert.deepEqual(together.map(r => r.svg), apart.map(r => r.svg));
  assert.ok(together[0].svg !== together[1].svg);
  fs.rmSync(dir, {recursive: true});
});

test('renders the same picture the committed example SVGs show (what `svg-diagram build` wrote)', async () => {
  for (const name of ['inventory-flow', 'inventory-wireframe', 'inventory-component-spec']) {
    const r = await renderSource(path.join(ROOT, 'examples', `${name}.ts`));
    assert.equal(r.ok, true, name);
    const golden = fs.readFileSync(path.join(ROOT, 'examples', 'out', `${name}.svg`), 'utf8');
    assert.equal(r.width, rootAttr(golden, 'width'), name);
    assert.equal(r.height, rootAttr(golden, 'height'), name);
  }
});

test('close() can be called more than once', async () => {
  await close();
  await close();
});

test('package.json exposes ./render, and the build covers it', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.exports['./render'].default, './dist/lib/render-source.js');
  assert.equal(pkg.exports['./render'].types, './dist/lib/render-source.d.ts');
  assert.ok(pkg.files.includes('dist'));
  const build = JSON.parse(fs.readFileSync(path.join(ROOT, 'tsconfig.build.json'), 'utf8'));
  assert.ok(build.include.includes('lib/**/*.ts'));
  assert.ok(fs.existsSync(path.join(ROOT, 'lib', 'render-source.ts')));
});

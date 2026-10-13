// expandMarkdown() / `svg-diagram md`: ![alt](source.diagram.ts) in a page becomes the drawn figure.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {expandMarkdown} from '../lib/markdown.ts';
import {close} from '../lib/render-source.ts';

test.after(() => close());

const ROOT = path.resolve(import.meta.dirname, '..');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'markdown-'));
const ok = (t: string) => `import {diagram, box} from 'svg-diagram';\nexport default function define() { return diagram({theme: 'blue'}).add(box({title: '${t}'})); }\n`;

test('an image that targets a .ts source becomes an image of its SVG; code is left alone', async () => {
  const dir = tmp();
  fs.mkdirSync(path.join(dir, 'd'));
  fs.writeFileSync(path.join(dir, 'd', 'flow.diagram.ts'), ok('流れ'));
  const page = path.join(dir, 'page.md');
  const md = ['# 題', '![流れ図](d/flow.diagram.ts "題名")', '`![x](d/flow.diagram.ts)` と ![外](https://e.com/a.ts)', '```md', '![y](d/flow.diagram.ts)', '```', '![再掲](d/flow.diagram.ts)'].join('\n');
  const r = await expandMarkdown(md, {file: page});
  assert.deepEqual(r.problems, []);
  assert.equal(r.figures.length, 1);
  assert.equal(r.figures[0].name, 'flow.svg');
  assert.match(r.figures[0].svg, /^<svg\b/);
  assert.equal(r.markdown, ['# 題', '![流れ図](svg/flow.svg "題名")', '`![x](d/flow.diagram.ts)` と ![外](https://e.com/a.ts)', '```md', '![y](d/flow.diagram.ts)', '```', '![再掲](svg/flow.svg)'].join('\n'));
  fs.rmSync(dir, {recursive: true});
});

test('same-named sources in different folders get different file names; inline mode embeds the svg', async () => {
  const dir = tmp();
  for (const d of ['a', 'b']) { fs.mkdirSync(path.join(dir, d)); fs.writeFileSync(path.join(dir, d, 'f.diagram.ts'), ok(d)); }
  const page = path.join(dir, 'p.md');
  const r = await expandMarkdown('![](a/f.diagram.ts)\n![](b/f.diagram.ts)', {file: page, svgDir: '../img'});
  assert.deepEqual(r.figures.map(f => f.name), ['f.svg', 'f-2.svg']);
  assert.equal(r.markdown, '![](../img/f.svg)\n![](../img/f-2.svg)');
  const inl = await expandMarkdown('前\n![図の説明](a/f.diagram.ts)\n後', {file: page, mode: 'inline'});
  assert.match(inl.markdown, /\n\n<svg role="img" aria-label="図の説明"[^]*<\/svg>\n\n\n後$/);
  assert.doesNotMatch(inl.markdown, /<\?xml/);
  fs.rmSync(dir, {recursive: true});
});

test('a source that cannot load is a problem and its image stays as written', async () => {
  const dir = tmp();
  const r = await expandMarkdown('![](nope.diagram.ts)', {file: path.join(dir, 'p.md')});
  assert.equal(r.problems.length, 1);
  assert.match(r.problems[0], /^nope\.diagram\.ts: /);
  assert.equal(r.markdown, '![](nope.diagram.ts)');
  fs.rmSync(dir, {recursive: true});
});

test('the CLI writes the Markdown and the SVGs, and writes nothing when a figure fails', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'flow.diagram.ts'), ok('流れ'));
  fs.writeFileSync(path.join(dir, 'in.md'), '![流れ](flow.diagram.ts)\n');
  const run = (...a: string[]) => spawnSync(path.join(ROOT, 'bin/svg-diagram'), ['md', ...a], {encoding: 'utf8', cwd: dir});
  const good = run('in.md', '--out', 'out/out.md', '--svg-dir', 'out/img');
  assert.equal(good.status, 0, good.stderr);
  assert.equal(fs.readFileSync(path.join(dir, 'out/out.md'), 'utf8'), '![流れ](img/flow.svg)\n');
  assert.match(fs.readFileSync(path.join(dir, 'out/img/flow.svg'), 'utf8'), /^<svg\b/);
  fs.writeFileSync(path.join(dir, 'bad.md'), '![](missing.diagram.ts)\n');
  const bad = run('bad.md', '--out', 'bad-out.md');
  assert.equal(bad.status, 1);
  assert.equal(fs.existsSync(path.join(dir, 'bad-out.md')), false);
  fs.rmSync(dir, {recursive: true});
});

test('only *.diagram.ts is a diagram source; render html (or #html) embeds the HTML/CSS form, #svg wins over render', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'flow.diagram.ts'), ok('流れ'));
  const page = path.join(dir, 'p.md');
  const plain = await expandMarkdown('![](other.ts) ![](notes.diagram.txt)', {file: page});
  assert.deepEqual(plain.problems, []);
  assert.equal(plain.markdown, '![](other.ts) ![](notes.diagram.txt)');
  const html = await expandMarkdown('![a](flow.diagram.ts)', {file: page, render: 'html'});
  assert.deepEqual(html.problems, []);
  assert.match(html.markdown, /^\n\n<style>[^]*<div\b[^]*<\/div>\s*$/);
  assert.doesNotMatch(html.markdown.trim(), /\n\s*\n/);
  assert.match(html.markdown, /流れ/);
  const one = await expandMarkdown('![a](flow.diagram.ts#html)\n![b](flow.diagram.ts)', {file: page});
  assert.match(one.markdown, /<div\b[^]*!\[b\]\(svg\/flow\.svg\)$/);
  const svg = await expandMarkdown('![a](flow.diagram.ts#svg)', {file: page, render: 'html', mode: 'inline'});
  assert.match(svg.markdown, /<svg\b/);
  fs.rmSync(dir, {recursive: true});
});

test('the CLI --html embeds the HTML form', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'flow.diagram.ts'), ok('流れ'));
  fs.writeFileSync(path.join(dir, 'in.md'), '![流れ](flow.diagram.ts)\n');
  const r = spawnSync(path.join(ROOT, 'bin/svg-diagram'), ['md', 'in.md', '--html', '--out', 'out.md'], {encoding: 'utf8', cwd: dir});
  assert.equal(r.status, 0, r.stderr);
  assert.match(fs.readFileSync(path.join(dir, 'out.md'), 'utf8'), /<div\b[^>]*class="sd"/);
  assert.equal(fs.existsSync(path.join(dir, 'svg')), false);
  fs.rmSync(dir, {recursive: true});
});

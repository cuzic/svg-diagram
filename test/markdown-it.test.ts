// The markdown-it plugin: ![alt](source.diagram.ts) renders as the figure's inline <svg>.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import svgDiagram from '../lib/markdown-it.ts';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'md-it-'));
const ok = (t: string) => `import {diagram, box} from 'svg-diagram';\nexport default function define() { return diagram({theme: 'blue'}).add(box({title: '${t}'})); }\n`;

test('a diagram source renders inline, relative to the page; other images and code are untouched', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'flow.diagram.ts'), ok('流れ'));
  const md = new MarkdownIt().use(svgDiagram);
  const html = md.render('![流れ図](flow.diagram.ts)\n\n![x](a.png) `![y](flow.diagram.ts)`\n', {path: path.join(dir, 'page.md')});
  assert.match(html, /<svg role="img" aria-label="流れ図"[^]*<\/svg>/);
  assert.match(html, /<img src="a\.png" alt="x">/);
  assert.match(html, /<code>!\[y\]\(flow\.diagram\.ts\)<\/code>/);
  fs.rmSync(dir, {recursive: true});
});

test('an edited source is drawn again; a missing one throws unless strict is off', () => {
  const dir = tmp();
  const src = path.join(dir, 'f.diagram.ts');
  fs.writeFileSync(src, ok('first'));
  const md = new MarkdownIt().use(svgDiagram);
  const env = {path: path.join(dir, 'p.md')};
  assert.match(md.render('![](f.diagram.ts)', env), /first/);
  fs.writeFileSync(src, ok('second'));
  fs.utimesSync(src, new Date(), new Date(Date.now() + 5000));
  assert.match(md.render('![](f.diagram.ts)', env), /second/);
  assert.throws(() => md.render('![](nope.diagram.ts)', env));
  const soft = new MarkdownIt().use(svgDiagram, {strict: false});
  assert.match(soft.render('![](nope.diagram.ts)', env), /class="svg-diagram-error"/);
  fs.rmSync(dir, {recursive: true});
});

test('render html draws the HTML/CSS form; a figure alone in its paragraph is a block, not inside <p>; #svg / #html pick per figure', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'f.diagram.ts'), ok('流れ'));
  fs.writeFileSync(path.join(dir, 'other.ts'), `export const x = 1;\n`);
  const env = () => ({path: path.join(dir, 'p.md')});
  const html = new MarkdownIt().use(svgDiagram, {render: 'html'}).render('![](f.diagram.ts)\n', env());
  assert.match(html, /^<style>[^]*<div\b[^>]*class="sd"/);
  assert.doesNotMatch(html, /<p>/);
  const svg = new MarkdownIt().use(svgDiagram).render('![](f.diagram.ts)\n\n![](f.diagram.ts#html)\n\n![](other.ts)\n', env());
  assert.match(svg, /^<svg\b[^]*<\/svg>\s*<style>[^]*<div\b[^>]*class="sd"/);
  assert.match(svg, /<p><img src="other\.ts" alt=""><\/p>/);
  const inline = new MarkdownIt().use(svgDiagram).render('見て ![](f.diagram.ts) ね\n', env());
  assert.match(inline, /^<p>見て <svg\b[^]*<\/svg> ね<\/p>/);
  fs.rmSync(dir, {recursive: true});
});

// The markdown-it plugin: ![alt](source.ts) renders as the figure's inline <svg>.
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
  fs.writeFileSync(path.join(dir, 'flow.ts'), ok('流れ'));
  const md = new MarkdownIt().use(svgDiagram);
  const html = md.render('![流れ図](flow.ts)\n\n![x](a.png) `![y](flow.ts)`\n', {path: path.join(dir, 'page.md')});
  assert.match(html, /<svg role="img" aria-label="流れ図"[^]*<\/svg>/);
  assert.match(html, /<img src="a\.png" alt="x">/);
  assert.match(html, /<code>!\[y\]\(flow\.ts\)<\/code>/);
  fs.rmSync(dir, {recursive: true});
});

test('an edited source is drawn again; a missing one throws unless strict is off', () => {
  const dir = tmp();
  const src = path.join(dir, 'f.ts');
  fs.writeFileSync(src, ok('first'));
  const md = new MarkdownIt().use(svgDiagram);
  const env = {path: path.join(dir, 'p.md')};
  assert.match(md.render('![](f.ts)', env), /first/);
  fs.writeFileSync(src, ok('second'));
  fs.utimesSync(src, new Date(), new Date(Date.now() + 5000));
  assert.match(md.render('![](f.ts)', env), /second/);
  assert.throws(() => md.render('![](nope.ts)', env));
  const soft = new MarkdownIt().use(svgDiagram, {strict: false});
  assert.match(soft.render('![](nope.ts)', env), /class="svg-diagram-error"/);
  fs.rmSync(dir, {recursive: true});
});

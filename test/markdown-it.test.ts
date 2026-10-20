// The markdown-it plugin: ![alt](source.diagram.ts) renders as the figure, inline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import svgDiagram from '../lib/markdown-it.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'md-it-'));
const ok = (t: string) => `import {diagram, box} from 'svg-diagram';\nexport default function define() { return diagram({theme: 'blue'}).add(box({title: '${t}'})); }\n`;
const use = (o: object = {}) => new MarkdownIt().use(svgDiagram, {root: os.tmpdir(), ...o});

test('a diagram source renders inline, relative to the page; other images and code are untouched', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'flow.diagram.ts'), ok('流れ'));
  const html = use().render('![**流れ** 図](flow.diagram.ts)\n\n![x](a.png) `![y](flow.diagram.ts)`\n', {path: path.join(dir, 'page.md')});
  assert.match(html, /<svg [^>]*aria-label="流れ 図"/);
  assert.match(html, /<img src="a\.png" alt="x">/);
  assert.match(html, /<code>!\[y\]\(flow\.diagram\.ts\)<\/code>/);
  fs.rmSync(dir, {recursive: true});
});

test('an edited source, and an edited .svg-diagram.json, are drawn again; a missing source throws unless strict is off', () => {
  const dir = tmp();
  const src = path.join(dir, 'f.diagram.ts');
  fs.writeFileSync(src, ok('first'));
  const md = use();
  const env = {path: path.join(dir, 'p.md'), includes: [] as string[]};
  assert.match(md.render('![](f.diagram.ts)', env), /first/);
  fs.writeFileSync(src, ok('second'));
  fs.utimesSync(src, new Date(), new Date(Date.now() + 5000));
  assert.match(md.render('![](f.diagram.ts)', env), /second/);
  // the settings the figure was drawn with are among the files the page depends on
  fs.writeFileSync(path.join(dir, '.svg-diagram.json'), '{}');
  md.render('![](f.diagram.ts)', {path: path.join(dir, 'p.md')});
  fs.utimesSync(src, new Date(), new Date(Date.now() + 9000));
  const env2 = {path: path.join(dir, 'p.md'), includes: [] as string[]};
  md.render('![](f.diagram.ts)', env2);
  assert.ok(env2.includes.includes(path.join(dir, '.svg-diagram.json')));
  assert.throws(() => md.render('![](nope.diagram.ts)', env));
  const soft = use({strict: false});
  assert.match(soft.render('![](nope.diagram.ts)', env), /class="svg-diagram-error"/);
  fs.rmSync(dir, {recursive: true});
});

test('render html draws the HTML/CSS form; a figure alone in its paragraph is a block, not inside <p>; #svg / #html pick per figure', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'f.diagram.ts'), ok('流れ'));
  fs.writeFileSync(path.join(dir, 'other.ts'), `export const x = 1;\n`);
  const env = () => ({path: path.join(dir, 'p.md')});
  const html = use({render: 'html'}).render('![説明](f.diagram.ts)\n', env());
  assert.match(html, /^<div class="svg-diagram" role="figure" aria-label="説明"><style>[^]*<div\b[^>]*class="sd"/);
  assert.doesNotMatch(html, /<p>/);
  const svg = use().render('![](f.diagram.ts)\n\n![](f.diagram.ts#html)\n\n![](other.ts)\n', env());
  assert.match(svg, /^<svg\b[^]*<\/svg>\s*<div class="svg-diagram"><style>[^]*class="sd"/);
  assert.match(svg, /<p><img src="other\.ts" alt=""><\/p>/);
  const inline = use().render('見て ![](f.diagram.ts) ね\n', env());
  assert.match(inline, /^<p>見て <svg\b[^]*<\/svg> ね<\/p>/);
  const inlineHtml = use({render: 'html'}).render('見て ![](f.diagram.ts) ね\n', env());
  assert.match(inlineHtml, /^<p>見て <svg\b[^]*<\/svg> ね<\/p>/, 'a <div> would end the <p>');
  fs.rmSync(dir, {recursive: true});
});

test('two figures on a page keep ids, names and styles of their own; the same figure twice does not repeat an id', () => {
  const dir = tmp();
  const titled = (t: string) => `import {diagram, box} from 'svg-diagram';\nexport default function define() { return diagram({theme: 'blue', title: '${t}', desc: '${t}の説明'}).add(box({title: '${t}'})); }\n`;
  fs.writeFileSync(path.join(dir, 'b.diagram.ts'), titled('B'));
  fs.writeFileSync(path.join(dir, 'c.diagram.ts'), titled('C'));
  const html = use().render('![bの説明](b.diagram.ts)\n\n![cの説明](c.diagram.ts)\n\n![再掲](b.diagram.ts)\n', {path: path.join(dir, 'p.md')});
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length, `ids repeat: ${ids.join(' ')}`);
  assert.match(html, /aria-label="cの説明"/);
  assert.doesNotMatch(html, /aria-labelledby="svg-title/);
  for (const m of html.matchAll(/aria-labelledby="([^"]+)"/g)) for (const t of m[1]!.split(' ')) assert.ok(ids.includes(t), `${t} names an element`);
  assert.match(html, /<style>\s*#sd[0-9a-f]+ text/);
  fs.rmSync(dir, {recursive: true});
});

test('vue: each figure is the value of a v-html, so a template never reads {{ }} in it', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'f.diagram.ts'), ok('A {{ 1 + 1 }} x'));
  const html = use({vue: true}).render('![](f.diagram.ts)\n', {path: path.join(dir, 'p.md')});
  assert.match(html, /^<div class="svg-diagram-vue" v-html="&quot;&lt;svg /);
  assert.doesNotMatch(html, /<svg|<style/);
  assert.match(html, /\{\{ 1 \+ 1 \}\}/);
  fs.rmSync(dir, {recursive: true});
});

test('a source that prints to stdout, a source outside root, and a source that never ends are errors with a reason', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'log.diagram.ts'), `console.log('debug: loading');\n${ok('L')}`);
  assert.match(use().render('![](log.diagram.ts)', {path: path.join(dir, 'p.md')}), /<svg\b/);
  assert.throws(() => use({root: path.join(dir, 'sub')}).render('![](log.diagram.ts)', {path: path.join(dir, 'p.md')}), /outside/);
  assert.throws(() => use().render('![](/etc/x.diagram.ts)', {path: path.join(dir, 'p.md')}), /absolute path/);
  fs.writeFileSync(path.join(dir, 'loop.diagram.ts'), `import {diagram} from 'svg-diagram';\nexport default function define() { for (;;) {} return diagram(); }\n`);
  assert.throws(() => use({timeout: 4000}).render('![](loop.diagram.ts)', {path: path.join(dir, 'p.md')}), /ETIMEDOUT|timeout|killed/i);
  fs.rmSync(dir, {recursive: true});
});

test('the plugin works from a folder whose path has spaces and non-ASCII characters', async () => {
  const dir = tmp();
  const lib = path.join(dir, '図 dir');
  fs.cpSync(path.join(ROOT, 'lib'), path.join(lib, 'lib'), {recursive: true});
  fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(lib, 'package.json'));
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(lib, 'node_modules'));
  fs.writeFileSync(path.join(dir, 'f.diagram.ts'), ok('流れ'));
  const {default: plugin} = await import(path.join(lib, 'lib/markdown-it.ts'));
  const html = new MarkdownIt().use(plugin, {root: os.tmpdir()}).render('![](f.diagram.ts)', {path: path.join(dir, 'p.md')});
  assert.match(html, /<svg\b/);
  fs.rmSync(dir, {recursive: true});
});

test('a source that ignores SIGTERM is still stopped by the timeout; the HTML form twice repeats no id; a vue error is a v-html value with no build path', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'stubborn.diagram.ts'), `import {diagram} from 'svg-diagram';\nprocess.on('SIGTERM', () => {});\nexport default function define() { for (;;) {} return diagram(); }\n`);
  const t0 = Date.now();
  assert.throws(() => use({timeout: 4000}).render('![](stubborn.diagram.ts)', {path: path.join(dir, 'p.md')}), /ETIMEDOUT|timeout|killed/i);
  assert.ok(Date.now() - t0 < 30000, 'returned long before the 120 s default');
  fs.writeFileSync(path.join(dir, 'a.diagram.ts'), ok('A'));
  const html = use({render: 'html'}).render('![](a.diagram.ts)\n\n![](a.diagram.ts)\n', {path: path.join(dir, 'p.md')});
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length);
  const err = use({vue: true, strict: false}).render('![](nope{{1}}.diagram.ts)\n', {path: path.join(dir, 'p.md')});
  assert.match(err, /^<div class="svg-diagram-vue" v-html=/);
  assert.doesNotMatch(err, new RegExp(dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  fs.rmSync(dir, {recursive: true});
});

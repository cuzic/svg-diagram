// VitePress: the plugin in a real site build, and the files a page depends on for `vitepress dev`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import svgDiagram from '../lib/vitepress.ts';
import {build} from 'vitepress';

const ROOT = path.resolve(import.meta.dirname, '..');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vitepress-'));
const ok = (t: string) => `import {diagram, box} from 'svg-diagram';\nexport default function define() { return diagram({theme: 'blue'}).add(box({title: '${t}'})); }\n`;

test('the figure and the files it imports are listed in env.includes, so VitePress watches them', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'title.ts'), `export const title = '見出し';\n`);
  fs.writeFileSync(path.join(dir, 'f.ts'), `import {diagram, box} from 'svg-diagram';\nimport {title} from './title.ts';\nexport default function define() { return diagram({theme: 'blue'}).add(box({title})); }\n`);
  const md = new MarkdownIt();
  svgDiagram()(md);
  const env = {path: path.join(dir, 'p.md'), includes: [] as string[]};
  md.render('![](f.ts)', env);
  assert.deepEqual(env.includes, [path.join(dir, 'f.ts'), path.join(dir, 'title.ts')]);
  fs.rmSync(dir, {recursive: true});
});

test('a VitePress site build renders the figure into the page', {timeout: 240000}, async () => {
  // Inside the repo, so the site resolves vue from its node_modules.
  const dir = fs.mkdtempSync(path.join(ROOT, '.vitepress-test-'));
  fs.mkdirSync(path.join(dir, '.vitepress'));
  fs.writeFileSync(path.join(dir, 'flow.ts'), ok('流れ'));
  fs.writeFileSync(path.join(dir, 'index.md'), '# 題\n\n![流れ図](./flow.ts)\n');
  fs.writeFileSync(path.join(dir, '.vitepress/config.mts'), `import svgDiagram from '${path.join(ROOT, 'lib/vitepress.ts')}';\nexport default {title: 't', markdown: {config: svgDiagram()}};\n`);
  await build(dir);
  const html = fs.readFileSync(path.join(dir, '.vitepress/dist/index.html'), 'utf8');
  assert.match(html, /<svg [^>]*role="img" aria-label="流れ図"/);
  assert.match(html, /<text\b[^>]*>[^<]*流れ/);
  fs.rmSync(dir, {recursive: true});
});

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

test('the figure, the files it imports and its settings are listed in env.includes, so VitePress watches them', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'title.ts'), `export const title = '見出し';\n`);
  fs.writeFileSync(path.join(dir, '.svg-diagram.json'), '{}');
  fs.writeFileSync(path.join(dir, 'f.diagram.ts'), `import {diagram, box} from 'svg-diagram';\nimport {title} from './title.ts';\nexport default function define() { return diagram({theme: 'blue'}).add(box({title})); }\n`);
  const md = new MarkdownIt();
  svgDiagram({root: os.tmpdir()})(md);
  const env = {path: path.join(dir, 'p.md'), includes: [] as string[]};
  md.render('![](f.diagram.ts)', env);
  assert.deepEqual([...env.includes].sort(), [path.join(dir, '.svg-diagram.json'), path.join(dir, 'f.diagram.ts'), path.join(dir, 'title.ts')].sort());
  fs.rmSync(dir, {recursive: true});
});

test('a VitePress site build keeps both forms: the figure is in the page, its CSS is in the client bundle, {{ }} in it is text', {timeout: 240000}, async () => {
  // Inside the repo (not node_modules: Node does not strip types there), so the site resolves vue from its node_modules.
  const dir = fs.mkdtempSync(path.join(ROOT, '.vitepress-test-'));
  try {
    fs.mkdirSync(path.join(dir, '.vitepress'));
    fs.writeFileSync(path.join(dir, 'flow.diagram.ts'), ok('流れ'));
    fs.writeFileSync(path.join(dir, 'tmpl.diagram.ts'), ok('A {{ 1 + 1 }} x'));
    fs.writeFileSync(path.join(dir, 'index.md'), '# 題\n\n![流れ図](./flow.diagram.ts)\n\n![HTML版](./flow.diagram.ts#html)\n\n見て ![文中](./flow.diagram.ts#html) ね\n\n![式](./tmpl.diagram.ts)\n');
    fs.writeFileSync(path.join(dir, '.vitepress/config.mts'), `import svgDiagram from '${path.join(ROOT, 'lib/vitepress.ts')}';\nexport default {title: 't', markdown: {config: svgDiagram()}};\n`);
    await build(dir);
    const html = fs.readFileSync(path.join(dir, '.vitepress/dist/index.html'), 'utf8');
    assert.match(html, /<svg [^>]*aria-label="流れ図"/);
    assert.match(html, /<div class="svg-diagram" role="figure" aria-label="HTML版">/);
    assert.match(html, /<text\b[^>]*>[^<]*流れ/);
    assert.match(html, /A \{\{ 1 \+ 1 \}\} x/);
    assert.doesNotMatch(html, /A 2 x/);
    const assets = path.join(dir, '.vitepress/dist/assets');
    const client = fs.readdirSync(assets).filter(f => /^index\.md\..*\.js$/.test(f)).map(f => fs.readFileSync(path.join(assets, f), 'utf8')).join('');
    assert.match(client, /\.sd-b \{ position: absolute/, 'the HTML form\'s CSS reaches the client');
    assert.match(client, /A \{\{ 1 \+ 1 \}\} x/);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

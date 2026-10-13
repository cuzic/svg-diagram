// The remark plugin: ![alt](source.diagram.ts) becomes the figure's inline <svg>.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {unified} from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import svgDiagram from '../lib/remark.ts';
import {close} from '../lib/render-source.ts';

test.after(() => close());

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'remark-'));
const ok = (t: string) => `import {diagram, box} from 'svg-diagram';\nexport default function define() { return diagram({theme: 'blue'}).add(box({title: '${t}'})); }\n`;
const html = (opts = {}) => unified().use(remarkParse).use(svgDiagram, opts).use(remarkRehype).use(rehypeStringify);

test('a diagram source renders inline, relative to the file; other images and code are untouched', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'flow.diagram.ts'), ok('流れ'));
  const out = String(await html().process({path: path.join(dir, 'page.md'), value: '![流れ図](flow.diagram.ts)\n\n![x](a.png) `![y](flow.diagram.ts)`\n\n```md\n![z](flow.diagram.ts)\n```\n'}));
  assert.match(out, /<svg [^>]*role="img" aria-label="流れ図"[^]*<\/svg>/);
  assert.match(out, /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"[^>]* viewBox="0 0 \d+ \d+"/);
  assert.match(out, /<text\b[^>]*>[^<]*流れ/);
  assert.match(out, /<img src="a\.png" alt="x">/);
  assert.match(out, /<code>!\[y\]\(flow\.diagram\.ts\)<\/code>/);
  assert.match(out, /!\[z\]\(flow\.diagram\.ts\)/);
  fs.rmSync(dir, {recursive: true});
});

test('a missing source fails the file; strict: false leaves the image and adds a message', async () => {
  const dir = tmp();
  const file = () => ({path: path.join(dir, 'p.md'), value: '![](nope.diagram.ts)'});
  await assert.rejects(html().process(file()), /nope\.diagram\.ts/);
  const soft = await html({strict: false}).process(file());
  assert.equal(soft.messages.length, 1);
  assert.match(String(soft), /<img src="nope\.diagram\.ts"/);
  fs.rmSync(dir, {recursive: true});
});

test('render html (or #html) gives the HTML/CSS form as real elements, with no raw html', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'flow.diagram.ts'), ok('流れ'));
  fs.writeFileSync(path.join(dir, 'other.ts'), `export const x = 1;\n`);
  const run = (value: string, opts = {}) => html(opts).process({path: path.join(dir, 'p.md'), value}).then(String);
  const out = await run('![](flow.diagram.ts)', {render: 'html'});
  assert.match(out, /<div class="svg-diagram"><style>[^]*<div id="[^"]*" class="sd"/);
  assert.match(out, /流れ/);
  assert.doesNotMatch(out, /<svg\b[^>]*role=/);
  assert.match(await run('![](flow.diagram.ts#html)'), /class="sd"/);
  assert.match(await run('![](flow.diagram.ts#svg)', {render: 'html'}), /^<p><svg\b/);
  assert.match(await run('![](other.ts)'), /<img src="other\.ts"/);
  fs.rmSync(dir, {recursive: true});
});

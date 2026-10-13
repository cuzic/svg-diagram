// The remark plugin: ![alt](source.diagram.ts) becomes the figure's elements.
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
const html = (opts = {}) => unified().use(remarkParse).use(svgDiagram, {root: os.tmpdir(), ...opts}).use(remarkRehype).use(rehypeStringify);
const run = (dir: string, value: string, opts = {}) => html(opts).process({path: path.join(dir, 'p.md'), value}).then(f => ({out: String(f), file: f}));

test('a diagram source renders inline, relative to the file; other images and code are untouched; a lone figure replaces its paragraph', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'flow.diagram.ts'), ok('流れ'));
  const {out, file} = await run(dir, '![流れ図](flow.diagram.ts)\n\n![x](a.png) `![y](flow.diagram.ts)`\n\n```md\n![z](flow.diagram.ts)\n```\n');
  assert.match(out, /^<svg (?=[^>]*role="img")(?=[^>]*aria-label="流れ図")[^]*<\/svg>/);
  assert.doesNotMatch(out, /<p><svg/);
  assert.match(out, /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"[^>]* viewBox="0 0 \d+ \d+"/);
  assert.match(out, /<text\b[^>]*>[^<]*流れ/);
  assert.match(out, /<img src="a\.png" alt="x">/);
  assert.match(out, /<code>!\[y\]\(flow\.diagram\.ts\)<\/code>/);
  assert.match(out, /!\[z\]\(flow\.diagram\.ts\)/);
  assert.deepEqual((file.data as {svgDiagramDeps: string[]}).svgDiagramDeps, [path.join(dir, 'flow.diagram.ts')]);
  fs.rmSync(dir, {recursive: true});
});

test('the tree uses hast property names (className, strokeWidth, ariaLabel), not raw XML attribute names', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'f.diagram.ts'), ok('流れ'));
  const proc = html();
  const file = {path: path.join(dir, 'p.md'), value: '![説明](f.diagram.ts)'};
  const tree = (await proc.run(proc.parse(file), file as never)) as unknown as {children: any[]};
  const svg = tree.children[0];
  assert.equal(svg.tagName, 'svg');
  assert.equal(svg.properties.ariaLabel, '説明');
  assert.equal(svg.properties['aria-label'], undefined);
  const all: any[] = [];
  const walk = (n: any) => { all.push(n); n.children?.forEach(walk); };
  walk(svg);
  assert.ok(all.some(n => n.properties?.strokeWidth !== undefined), 'stroke-width became strokeWidth');
  assert.ok(all.every(n => !n.properties || !Object.keys(n.properties).some(k => k.includes('-'))), 'no hyphenated property names');
  fs.rmSync(dir, {recursive: true});
});

test('a source edited in the same process is drawn again; ids stay unique with the same figure twice', async () => {
  const dir = tmp();
  const src = path.join(dir, 's.diagram.ts');
  fs.writeFileSync(src, ok('FIRST'));
  assert.match((await run(dir, '![](s.diagram.ts)')).out, /FIRST/);
  fs.writeFileSync(src, ok('SECOND'));
  fs.utimesSync(src, new Date(), new Date(Date.now() + 5000));
  const again = (await run(dir, '![](s.diagram.ts)\n\n![](s.diagram.ts)')).out;
  assert.match(again, /SECOND/);
  assert.doesNotMatch(again, /FIRST/);
  const ids = [...again.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length);
  fs.rmSync(dir, {recursive: true});
});

test('a missing source, a source outside root and a % in the target fail the file; strict: false adds a message and keeps the image', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'a.diagram.ts'), ok('A'));
  await assert.rejects(run(dir, '![](nope.diagram.ts)'), /nope\.diagram\.ts/);
  await assert.rejects(run(dir, '![](a.diagram.ts)', {root: path.join(dir, 'sub')}), /outside/);
  await assert.rejects(run(dir, '![](/etc/x.diagram.ts)'), /absolute path/);
  for (const t of ['nope.diagram.ts', '100%.diagram.ts']) {
    const soft = await run(dir, `![](${t})`, {strict: false});
    assert.equal(soft.file.messages.length, 1, t);
    assert.match(soft.out, /<img src="/, t);
  }
  const plain = await run(dir, '![](other.ts)');
  assert.match(plain.out, /<img src="other\.ts"/);
  fs.rmSync(dir, {recursive: true});
});

test('render html (or #html) gives the HTML/CSS form as real elements with the alt as its label, and a lone one replaces its paragraph', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'flow.diagram.ts'), ok('流れ'));
  const out = (await run(dir, '![説明](flow.diagram.ts)', {render: 'html'})).out;
  assert.match(out, /^<div class="svg-diagram" role="figure" aria-label="説明"><style>[^]*<div id="[^"]*" class="sd"/);
  assert.match(out, /流れ/);
  assert.doesNotMatch(out, /<p>|<svg\b[^>]*role=/);
  assert.match((await run(dir, '![](flow.diagram.ts#html)')).out, /class="sd"/);
  assert.match((await run(dir, '![](flow.diagram.ts#svg)', {render: 'html'})).out, /^<svg\b/);
  // inside running text the HTML form (made of <div>s, which end a <p>) is drawn as an <svg>
  assert.match((await run(dir, '見て ![](flow.diagram.ts#html) ね')).out, /^<p>見て <svg\b[^]*<\/svg> ね<\/p>/);
  fs.rmSync(dir, {recursive: true});
});

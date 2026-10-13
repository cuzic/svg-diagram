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
const expand = (md: string, dir: string, o: object = {}) => expandMarkdown(md, {file: path.join(dir, 'page.md'), root: os.tmpdir(), ...o});
const img = (name: string) => new RegExp(`!\\[[^\\]]*\\]\\(svg/${name}-[0-9a-f]{8}\\.svg`);

test('an image that targets a .diagram.ts source becomes an image of its SVG; code is left alone', async () => {
  const dir = tmp();
  fs.mkdirSync(path.join(dir, 'd'));
  fs.writeFileSync(path.join(dir, 'd', 'flow.diagram.ts'), ok('流れ'));
  const md = ['# 題', '![流れ図](d/flow.diagram.ts "題名")', '`![x](d/flow.diagram.ts)` と ![外](https://e.com/a.diagram.ts)', '```md', '![y](d/flow.diagram.ts)', '```', '![再掲](d/flow.diagram.ts)'].join('\n');
  const r = await expand(md, dir);
  assert.deepEqual(r.problems, []);
  assert.equal(r.figures.length, 1);
  assert.match(r.figures[0].name, /^flow-[0-9a-f]{8}\.svg$/);
  assert.match(r.figures[0].svg, /^<svg\b/);
  const out = r.markdown.split('\n');
  assert.match(out[1], new RegExp(`^!\\[流れ図\\]\\(svg/${r.figures[0].name} "題名"\\)$`));
  assert.equal(out[2], '`![x](d/flow.diagram.ts)` と ![外](https://e.com/a.diagram.ts)');
  assert.deepEqual(out.slice(3, 6), ['```md', '![y](d/flow.diagram.ts)', '```']);
  assert.match(out[6], img('flow'));
  fs.rmSync(dir, {recursive: true});
});

test('what a renderer would not read as an image is left alone: indented code, quoted and nested fences, comments, \\!, CRLF', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'a.diagram.ts'), ok('A'));
  const keep = [
    'para\n\n    ![a](a.diagram.ts)',
    '- item\n\n    ```md\n    ![a](a.diagram.ts)\n    ```',
    '> ```md\n> ![a](a.diagram.ts)\n> ```',
    '<!-- ![a](a.diagram.ts) -->',
    '<!--\n![a](a.diagram.ts)\n-->',
    '\\![a](a.diagram.ts)',
    '```md\r\n![a](a.diagram.ts)\r\n```',
  ];
  for (const k of keep) { const r = await expand(k, dir); assert.deepEqual([r.problems, r.markdown, r.figures.length], [[], k, 0], JSON.stringify(k)); }
  const lst = await expand('- ![a](a.diagram.ts)\r\n', dir);
  assert.match(lst.markdown, /^- !\[a\]\(svg\/a-[0-9a-f]{8}\.svg\)\r\n$/);
  fs.rmSync(dir, {recursive: true});
});

test('a code span in the alt, and a % in the target, do not crash; the % is a problem or an image, not an exception', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'a.diagram.ts'), ok('A'));
  const r = await expand('![a `]` b](a.diagram.ts)', dir);
  assert.deepEqual(r.problems, []);
  assert.match(r.markdown, /^!\[a `\]` b\]\(svg\/a-[0-9a-f]{8}\.svg\)$/);
  const pct = await expand('![](100%.diagram.ts)', dir);
  assert.equal(pct.problems.length, 1);
  assert.match(pct.problems[0], /100%\.diagram\.ts/);
  fs.rmSync(dir, {recursive: true});
});

test('same-named sources get different file names, in one page and across pages; inline mode embeds the svg with ids of its own', async () => {
  const dir = tmp();
  for (const d of ['a', 'b']) { fs.mkdirSync(path.join(dir, d)); fs.writeFileSync(path.join(dir, d, 'f.diagram.ts'), ok(d)); }
  const r = await expand('![](a/f.diagram.ts)\n![](b/f.diagram.ts)', dir, {svgDir: '../img'});
  assert.equal(new Set(r.figures.map(f => f.name)).size, 2);
  assert.match(r.markdown, /^!\[\]\(\.\.\/img\/f-[0-9a-f]{8}\.svg\)\n!\[\]\(\.\.\/img\/f-[0-9a-f]{8}\.svg\)$/);
  const again = await expand('![](a/f.diagram.ts)', dir);
  assert.equal(again.figures[0].name, r.figures.find(f => f.source.includes('/a/'))!.name);
  const inl = await expand('前\n\n![図の説明](a/f.diagram.ts)\n\n![同じ図](a/f.diagram.ts)\n\n後', dir, {mode: 'inline'});
  assert.match(inl.markdown, /<svg [^>]*aria-label="図の説明"/);
  const ids = [...inl.markdown.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique across the page');
  assert.doesNotMatch(inl.markdown, /<\?xml/);
  fs.rmSync(dir, {recursive: true});
});

test('an inline figure in a list, a quote or a table falls back to a file image (a note); the HTML form there is a problem', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'a.diagram.ts'), ok('A'));
  for (const md of ['- ![a](a.diagram.ts)\n- next', '> ![a](a.diagram.ts)', '| ![a](a.diagram.ts) |', '前 ![a](a.diagram.ts) 後']) {
    const r = await expand(md, dir, {mode: 'inline'});
    assert.equal(r.notes.length, 1, md);
    assert.doesNotMatch(r.markdown, /<svg/, md);
    assert.match(r.markdown, /\]\(svg\/a-[0-9a-f]{8}\.svg\)/, md);
    const h = await expand(md, dir, {render: 'html'});
    assert.equal(h.problems.length, 1, md);
    assert.equal(h.markdown, md);
  }
  fs.rmSync(dir, {recursive: true});
});

test('a source outside root, or an absolute path, is a problem; it is never imported', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'a.diagram.ts'), `throw new Error('ran');\n`);
  const outside = await expandMarkdown('![](a.diagram.ts)', {file: path.join(dir, 'p.md'), root: path.join(dir, 'sub')});
  assert.match(outside.problems[0], /outside/);
  for (const t of ['/etc/x.diagram.ts', '//host/share/x.diagram.ts', 'C:/x.diagram.ts']) {
    const r = await expand(`![](${t})`, dir);
    assert.match(r.problems[0], /absolute path/, t);
  }
  fs.rmSync(dir, {recursive: true});
});

test('a source that cannot load is a problem and its image stays as written', async () => {
  const dir = tmp();
  const r = await expand('![](nope.diagram.ts)', dir);
  assert.equal(r.problems.length, 1);
  assert.match(r.problems[0], /^nope\.diagram\.ts: /);
  assert.equal(r.markdown, '![](nope.diagram.ts)');
  fs.rmSync(dir, {recursive: true});
});

test('only *.diagram.ts is a diagram source; render html (or #html) embeds the HTML/CSS form with the alt as its label, #svg wins over render', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'flow.diagram.ts'), ok('流れ'));
  const plain = await expand('![](other.ts) ![](notes.diagram.txt)', dir);
  assert.deepEqual(plain.problems, []);
  assert.equal(plain.markdown, '![](other.ts) ![](notes.diagram.txt)');
  const html = await expand('![説明](flow.diagram.ts)', dir, {render: 'html'});
  assert.deepEqual(html.problems, []);
  assert.match(html.markdown, /^\n\n<div class="svg-diagram" role="figure" aria-label="説明"><style>[^]*<div\b[^]*<\/div><\/div>\n\n$/);
  assert.doesNotMatch(html.markdown.trim(), /\n\s*\n/);
  const one = await expand('![a](flow.diagram.ts#html)\n![b](flow.diagram.ts)', dir);
  assert.match(one.markdown, /<div\b[^]*!\[b\]\(svg\/flow-[0-9a-f]{8}\.svg\)$/);
  const svg = await expand('![a](flow.diagram.ts#svg)', dir, {render: 'html', mode: 'inline'});
  assert.match(svg.markdown, /<svg\b/);
  fs.rmSync(dir, {recursive: true});
});

test('the CLI writes the Markdown and the SVGs, and writes nothing when a figure fails; --html embeds the HTML form', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'flow.diagram.ts'), ok('流れ'));
  fs.writeFileSync(path.join(dir, 'in.md'), '![流れ](flow.diagram.ts)\n');
  const run = (...a: string[]) => spawnSync(path.join(ROOT, 'bin/svg-diagram'), ['md', ...a], {encoding: 'utf8', cwd: dir});
  const good = run('in.md', '--out', 'out/out.md', '--svg-dir', 'out/img');
  assert.equal(good.status, 0, good.stderr);
  const md = fs.readFileSync(path.join(dir, 'out/out.md'), 'utf8');
  const name = /\]\(img\/(flow-[0-9a-f]{8}\.svg)\)/.exec(md)![1];
  assert.match(fs.readFileSync(path.join(dir, 'out/img', name), 'utf8'), /^<svg\b/);
  fs.writeFileSync(path.join(dir, 'bad.md'), '![](missing.diagram.ts)\n');
  const bad = run('bad.md', '--out', 'bad-out.md');
  assert.equal(bad.status, 1);
  assert.equal(fs.existsSync(path.join(dir, 'bad-out.md')), false);
  assert.equal(run('in.md').status, 2, 'no --out for a file-mode run');
  assert.equal(run('in.md', '--out').status, 2, '--out without a value');
  const h = run('in.md', '--html', '--out', 'h.md');
  assert.equal(h.status, 0, h.stderr);
  assert.match(fs.readFileSync(path.join(dir, 'h.md'), 'utf8'), /class="sd"/);
  fs.rmSync(dir, {recursive: true});
});

test('two pages that share one svg folder do not overwrite each other\'s figures', () => {
  const dir = tmp();
  for (const d of ['a', 'b']) { fs.mkdirSync(path.join(dir, d)); fs.writeFileSync(path.join(dir, d, 'flow.diagram.ts'), ok(`図${d}`)); fs.writeFileSync(path.join(dir, `p${d}.md`), `![](${d}/flow.diagram.ts)\n`); }
  const run = (...a: string[]) => spawnSync(path.join(ROOT, 'bin/svg-diagram'), ['md', ...a], {encoding: 'utf8', cwd: dir});
  assert.equal(run('pa.md', '--out', 'out/pa.md').status, 0);
  assert.equal(run('pb.md', '--out', 'out/pb.md').status, 0);
  const files = fs.readdirSync(path.join(dir, 'out/svg'));
  assert.equal(files.length, 2);
  const target = (p: string) => /\]\((svg\/[^)]+)\)/.exec(fs.readFileSync(path.join(dir, 'out', p), 'utf8'))![1];
  assert.match(fs.readFileSync(path.join(dir, 'out', target('pa.md')), 'utf8'), /図a/);
  assert.match(fs.readFileSync(path.join(dir, 'out', target('pb.md')), 'utf8'), /図b/);
  fs.rmSync(dir, {recursive: true});
});

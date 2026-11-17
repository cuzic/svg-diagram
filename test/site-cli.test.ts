// ADR 0067 D2, D9-D11: `svg-diagram site` in a temp project — two decks in folders with their own settings, the same bytes twice, no notes,
// a broken slide writes nothing and leaves DIR as it was, a DIR site did not write (or that someone added to) is refused, extra files copied.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {JA_FONTS} from './helpers/text-engine.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'site-cli-'));
test.after(() => fs.rmSync(proj, {recursive: true, force: true}));
const figure = {version: 1, title: '流れ', parts: [{type: 'flowchart', nodes: [{id: 'a', label: '入口'}, {id: 'b', label: '出口'}], edges: [{from: 'a', to: 'b'}]}]};
const write = (rel: string, v: unknown) => { const f = path.join(proj, rel); fs.mkdirSync(path.dirname(f), {recursive: true}); fs.writeFileSync(f, typeof v === 'string' ? v : JSON.stringify(v)); return f; };
write('one/.svg-diagram.json', {measure: 'font', fonts: JA_FONTS});
write('two/.svg-diagram.json', {measure: 'font', fonts: JA_FONTS, wrap: 'char'});
write('one/deck.json', {title: 'ひとつめ', slides: [{layout: 'cover', title: '表紙', notes: 'NOTE-SECRET-1'}, {title: '図', figure, notes: 'NOTE-SECRET-2'}]});
write('two/talk.json', {slides: [{title: '二つめの最初'}, {title: '次', lead: 'リード'}]});
const wide = {version: 1, title: '長い名前', parts: [{type: 'flowchart', nodes: [{id: 'a', label: '要件を決定メモに書き出してから受け入れテストの観点を洗い出す'}, {id: 'b', label: '出口'}], edges: [{from: 'a', to: 'b'}]}]};
write('two/wide.json', {slides: [{title: '折り返し', figure: wide}]});
write('one/wide.json', {slides: [{title: '折り返し', figure: wide}]});
write('files/CNAME', 'slides.example.com\n');
const site = write('site.json', {title: '試験のサイト', decks: [{deck: 'one/deck.json'}, {deck: 'two/talk.json', slug: 'second'}], extra: {CNAME: 'files/CNAME'}});
const run = (...args: string[]) => spawnSync(process.execPath, [path.join(ROOT, 'site-diagram.ts'), ...args], {cwd: proj, encoding: 'utf8', timeout: 120_000});
const out = path.join(proj, 'dist');
const tree = (dir: string): Record<string, string> => Object.fromEntries((fs.readdirSync(dir, {recursive: true}) as string[]).filter(f => fs.statSync(path.join(dir, f)).isFile()).sort().map(f => [f, fs.readFileSync(path.join(dir, f), 'utf8')]));

test('two decks: index, viewer, print, slides.json, hashed slides, _headers, manifest, extra; no notes', () => {
  const r = run(site, '--out', out);
  assert.equal(r.status, 0, r.stderr);
  const files = tree(out);
  const m = JSON.parse(files['manifest.json'] as string) as {title: string; files: string[]; decks: {slug: string; title: string; slides: number; cover: string}[]};
  assert.deepEqual(m.decks.map(d => [d.slug, d.title, d.slides]), [['one', 'ひとつめ', 2], ['second', '二つめの最初', 2]]);
  assert.deepEqual(m.files, Object.keys(files).map(f => f.split(path.sep).join('/')).sort());
  for (const f of ['index.html', '_headers', 'CNAME', 'one/index.html', 'one/print.html', 'one/slides.json', 'second/index.html']) assert.ok(files[f] !== undefined, f);
  assert.equal(files['CNAME'], 'slides.example.com\n');
  assert.ok(m.files.some(f => /^assets\/present\.[0-9a-f]{16}\.js$/.test(f)) && m.files.some(f => /^assets\/site\.[0-9a-f]{16}\.css$/.test(f)));
  const slides = JSON.parse(files['one/slides.json'] as string) as {slides: {url: string}[]};
  for (const s of slides.slides) assert.ok(files[path.join('one', s.url)]?.startsWith('<svg'), s.url);
  for (const [f, body] of Object.entries(files)) assert.ok(!body.includes('NOTE-SECRET'), `notes in ${f}`);
  assert.ok((files['index.html'] as string).includes('href="one/"'));
});

test('the same input writes the same bytes', () => {
  const before = tree(out);
  const r = run(site, '--out', out);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(tree(out), before);
  assert.deepEqual(fs.readdirSync(proj).filter(n => /^dist\.(tmp|old)-/.test(n)), []);
});

test('a slide that cannot be drawn: nothing written, DIR as it was', () => {
  const before = tree(out);
  write('two/talk.json', {slides: [{title: '二つめの最初'}, {title: '壊れた図', figure: {version: 1, parts: [{type: 'no-such-part'}]}}]});
  const r = run(site, '--out', out);
  write('two/talk.json', {slides: [{title: '二つめの最初'}, {title: '次', lead: 'リード'}]});
  assert.equal(r.status, 1);
  assert.match(r.stderr, /nothing was written/);
  assert.deepEqual(tree(out), before);
});

test('DIR refused: not written by site, added to since, a link, or holding an input', () => {
  const other = path.join(proj, 'other');
  fs.mkdirSync(other); fs.writeFileSync(path.join(other, 'keep.txt'), 'mine');
  assert.match(run(site, '--out', other).stderr, /not written by svg-diagram site/);
  assert.equal(fs.readFileSync(path.join(other, 'keep.txt'), 'utf8'), 'mine');
  fs.writeFileSync(path.join(out, 'robots.txt'), 'x');
  const added = run(site, '--out', out);
  assert.equal(added.status, 1);
  assert.match(added.stderr, /did not write.*robots\.txt/);
  fs.rmSync(path.join(out, 'robots.txt'));
  fs.writeFileSync(path.join(out, '.DS_Store'), '');
  assert.equal(run(site, '--out', out).status, 0); // an OS's file is not the user's
  fs.symlinkSync(out, path.join(proj, 'link'));
  assert.match(run(site, '--out', path.join(proj, 'link')).stderr, /symbolic link/);
  // the decks' own folder as DIR: it is not empty and not site's
  assert.match(run(site, '--out', path.join(proj, 'one')).stderr, /not written by svg-diagram site/);
});

test('deck files as arguments: slugs from their names; two on one slug refused before drawing', () => {
  const r = run(path.join(proj, 'one/deck.json'), path.join(proj, 'two/talk.json'), '--out', path.join(proj, 'args'));
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual((JSON.parse(fs.readFileSync(path.join(proj, 'args/manifest.json'), 'utf8')) as {decks: {slug: string}[]}).decks.map(d => d.slug), ['one', 'talk']);
  write('x/one/deck.json', {slides: [{title: 'a'}]});
  const twice = run(path.join(proj, 'one/deck.json'), path.join(proj, 'x/one/deck.json'), '--out', path.join(proj, 'twice'));
  assert.equal(twice.status, 1);
  assert.match(twice.stderr, /slug "one"/);
  assert.ok(!fs.existsSync(path.join(proj, 'twice')));
  assert.match(run(site, path.join(proj, 'one/deck.json'), '--out', path.join(proj, 'mixed')).stderr, /site\.json goes alone/);
  assert.equal(run(site).status, 2);
});

test('each deck is drawn with its own folder\'s settings, whatever is drawn before it', () => {
  const slidesOf = (dir: string, slug: string) => (JSON.parse(fs.readFileSync(path.join(dir, slug, 'slides.json'), 'utf8')) as {slides: {url: string}[]}).slides.map(s => s.url);
  const both = path.join(proj, 'both'), alone = path.join(proj, 'alone');
  assert.match(run(path.join(proj, 'one/wide.json'), path.join(proj, 'two/wide.json'), '--out', both).stderr, /slug "wide"/); // both are "wide"
  write('order.json', {decks: [{deck: 'one/wide.json', slug: 'a'}, {deck: 'two/wide.json', slug: 'b'}]});
  write('alone.json', {decks: [{deck: 'two/wide.json', slug: 'b'}]});
  assert.equal(run(path.join(proj, 'order.json'), '--out', both).status, 0);
  assert.equal(run(path.join(proj, 'alone.json'), '--out', alone).status, 0);
  assert.notDeepEqual(slidesOf(both, 'a'), slidesOf(both, 'b'), 'wrap: char in two/ changes the figure');
  assert.deepEqual(slidesOf(both, 'b'), slidesOf(alone, 'b'));
});

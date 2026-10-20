// ADR 0018 unit D: `svg-diagram deck` run as a child process in a temp project — inputs, the all-or-nothing rule, exit codes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const DECK = path.join(ROOT, 'deck-diagram.ts');
const run = (cwd: string, ...args: string[]) => spawnSync(process.execPath, [DECK, ...args], {cwd, encoding: 'utf8'});
const text = (r: ReturnType<typeof run>) => `${r.stdout}\n${r.stderr}`;

const GOOD_TS = `import {diagram, caption, box, row, connect} from 'svg-diagram';
export default function define() {
  const a = box({id: 'a', title: '入口'}), b = box({id: 'b', title: '出口'});
  return diagram({theme: 'blue', title: '試験図'}).add(caption('キャプション'), row([a, b]), connect(a.right, b.left));
}
`;
// the same source as test/render-source.test.ts uses for "fails verification, still draws"
const CROWDED_TS = `import {diagram, row, box, connect} from 'svg-diagram';
export default function define() {
  return diagram({theme: 'blue'}).add(row([box({id: 'a', title: '左', body: '本文'}), box({id: 'b', title: '右', body: '本文'})], {gap: 24}), connect('a:right', 'b:left', {label: '長めのラベルです', chip: true, route: 'elbow'}));
}
`;
const THROWS_TS = `export default () => { throw new Error('boom from define'); };\n`;
const SVG = fs.readFileSync(path.join(ROOT, 'examples/out/bars.svg'), 'utf8');

const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'deck-cli-'));
const w = (rel: string, body: string) => { const f = path.join(proj, rel); fs.mkdirSync(path.dirname(f), {recursive: true}); fs.writeFileSync(f, body); return f; };
w('flow.ts', GOOD_TS); w('bars.svg', SVG); w('crowded.ts', CROWDED_TS); w('throws.ts', THROWS_TS);
w('broken.svg', '<svg xmlns="http://www.w3.org/2000/svg"><g data-badge></g></svg>\n');
const read = (rel: string) => fs.readFileSync(path.join(proj, rel), 'utf8');
const blocks = (html: string, tag: string) => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'g'))].map(m => m[1]);

test('a .ts and an .svg make one deck.html with two sections, in the order given, and write nothing else', () => {
  const r = run(proj, 'flow.ts', 'bars.svg');
  assert.equal(r.status, 0, text(r));
  assert.match(r.stdout, /wrote deck\.html \(2 slides\)/);
  const html = read('deck.html');
  const sections = [...html.matchAll(/<section\b[^>]*>/g)].map(m => m[0]);
  assert.equal(sections.length, 2);
  assert.match(sections[0]!, /aria-label="1 \/ 2: 試験図"/);
  assert.match(sections[1]!, /data-name="bars"/);
  assert.equal(blocks(html, 'style').length, 1);
  assert.equal(blocks(html, 'script').length, 1);
  assert.doesNotMatch(html, /<metadata|\ssrc=|href="http/);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), []);
  assert.deepEqual(fs.readdirSync(proj).filter(f => !['flow.ts', 'bars.svg', 'crowded.ts', 'throws.ts', 'broken.svg', 'deck.html'].includes(f)), [], 'no intermediate file, no svg/ directory');
});

test('the same inputs give the same bytes on a second run; --out makes the directory; --title, --cols and --csp reach the document', () => {
  const a = path.join('out', 'nested', 'a.html'), b = path.join('out', 'b.html');
  assert.equal(run(proj, 'flow.ts', 'bars.svg', '--out', a, '--title', 'レビュー用', '--cols', '3', '--csp').status, 0);
  assert.equal(run(proj, 'flow.ts', 'bars.svg', '--out', b, '--title', 'レビュー用', '--cols', '3', '--csp').status, 0);
  assert.equal(read(a), read(b));
  const html = read(a);
  assert.match(html, /<title>レビュー用<\/title>/);
  assert.match(html, /--deck-cols: 3/);
  const policy = /Content-Security-Policy" content="([^"]+)"/.exec(html)?.[1] ?? '';
  assert.match(policy, /style-src 'sha256-[A-Za-z0-9+/=]+'; script-src 'sha256-[A-Za-z0-9+/=]+'/);
  assert.doesNotMatch(read('deck.html'), /Content-Security-Policy/, 'no policy without --csp');
});

test('one failing input (verification, a throw, a broken .svg, a missing file) fails the whole: exit 1, nothing written', () => {
  for (const bad of ['crowded.ts', 'throws.ts', 'broken.svg', 'missing.svg']) {
    const out = path.join('fail', `${bad}.html`);
    const r = run(proj, 'flow.ts', bad, '--out', out);
    assert.equal(r.status, 1, `${bad}: ${text(r)}`);
    assert.match(r.stderr, new RegExp(`✗ ${bad.replace('.', '\\.')}`));
    assert.match(r.stderr, /nothing was written/);
    assert.equal(fs.existsSync(path.join(proj, out)), false, `${bad}: no output`);
  }
  assert.match(run(proj, 'flow.ts', 'throws.ts', '--out', 'fail/x.html').stderr, /boom from define/);
  // every failure is reported, not only the first
  const both = run(proj, 'throws.ts', 'broken.svg', '--out', 'fail/y.html');
  assert.match(both.stderr, /✗ throws\.ts/);
  assert.match(both.stderr, /✗ broken\.svg/);
  assert.match(both.stderr, /2 of 2 inputs failed/);
});

test('a failure leaves an existing deck.html byte for byte as it was, and says so; a file that is not a deck is not mentioned', () => {
  assert.equal(run(proj, 'flow.ts', '--out', 'keep.html').status, 0);
  const before = read('keep.html');
  const mtime = fs.statSync(path.join(proj, 'keep.html')).mtimeMs;
  const r = run(proj, 'flow.ts', 'throws.ts', '--out', 'keep.html');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /the previous keep\.html is still there, untouched/);
  assert.equal(read('keep.html'), before);
  assert.equal(fs.statSync(path.join(proj, 'keep.html')).mtimeMs, mtime);
  w('other.html', '<p>mine</p>');
  const o = run(proj, 'throws.ts', '--out', 'other.html');
  assert.equal(o.status, 1);
  assert.doesNotMatch(o.stderr, /previous/);
  assert.equal(read('other.html'), '<p>mine</p>');
});

// the cases of the command line are in test/deck-args.test.ts; this proves the entry prints the usage and exits 2 without writing
test('a usage error is exit 2 with the usage line, and writes nothing', () => {
  const r = run(proj, 'flow.ts', '--cols', '0', '--out', 'usage.html');
  assert.equal(r.status, 2, text(r));
  assert.match(r.stderr, /Usage: svg-diagram deck/);
  assert.equal(fs.existsSync(path.join(proj, 'usage.html')), false);
});

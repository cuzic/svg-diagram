// CLI usability (from a large book-series work): check --docs on a static SVG, check skipping helpers, lint path resolution,
// the browser-missing message, typecheck without a tsconfig, and build's "outDir".
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {resolveTargets} from '../lib/target-resolve.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const BIN = path.join(ROOT, 'bin', 'svg-diagram');
const BLOCK = pathToFileURL(path.join(import.meta.dirname, 'helpers', 'block-playwright-register.ts')).href;
const svgd = (cwd: string, args: string[], env: Record<string, string> = {}) => spawnSync(BIN, args, {cwd, encoding: 'utf8', env: {...process.env, ...env}});
const out = (r: ReturnType<typeof svgd>) => `${r.stdout}\n${r.stderr}`;
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cli-usab-'));
const put = (root: string, rel: string, text: string) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), {recursive: true}); fs.writeFileSync(f, text); return f; };
const GOOD_TS = `import {diagram, caption, box, row, connect} from 'svg-diagram';
import type {Diagram} from 'svg-diagram';
export default function define(): Diagram {
  const a = box({id: 'a', title: '入口'}), b = box({id: 'b', title: '出口'});
  const d = diagram({theme: 'blue', title: '試験図'});
  d.add(caption('キャプション'), row([a, b]), connect(a.right, b.left));
  return d;
}
`;
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>';

// ---- 1. check --docs: an SVG with no source -------------------------------------------------
test('check --docs: a referenced SVG whose source was removed is a warning (error with --strict); a source, or an accept, clears it', () => {
  const root = tmp();
  put(root, 'images/foo.svg', SVG);
  put(root, 'diagrams/other.ts', GOOD_TS);
  put(root, 'docs/p.md', '# P\n\n![図の説明](../images/foo.svg)\n');
  const args = ['check', '--docs', 'docs', '--src-dir', 'diagrams'];
  const warn = svgd(root, args);
  assert.equal(warn.status, 0, out(warn));
  assert.match(warn.stdout, /\[doc-svg-no-source\].*foo\.svg に対応する図のソースがない/);
  const strict = svgd(root, [...args, '--strict']);
  assert.equal(strict.status, 1, out(strict));
  // the default source folder is ./diagrams when --src-dir is not given
  assert.match(svgd(root, ['check', '--docs', 'docs']).stdout, /\[doc-svg-no-source\]/);
  // accepted in .svg-diagram.json: info, with the reason
  put(root, '.svg-diagram.json', JSON.stringify({accept: {'doc-svg-no-source': '手描きの写真'}}));
  const acc = svgd(root, [...args, '--strict']);
  assert.equal(acc.status, 0, out(acc));
  assert.match(acc.stdout, /許容: 手描きの写真/);
  fs.rmSync(path.join(root, '.svg-diagram.json'));
  put(root, 'diagrams/foo.ts', GOOD_TS);
  const ok = svgd(root, [...args, '--strict']);
  assert.equal(ok.status, 0, out(ok));
  assert.doesNotMatch(out(ok), /doc-svg-no-source/);
});

test('check --docs: an SVG that records a source which no longer exists is reported even without a source folder', () => {
  const root = tmp();
  put(root, 'images/foo.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><metadata id="svg-diagram">${JSON.stringify({generator: 'svg-diagram', toolVersion: '0', source: 'gone/foo.ts', sourceSha256: 'x'})}</metadata></svg>`);
  put(root, 'docs/p.md', '# P\n\n![図の説明](../images/foo.svg)\n');
  assert.match(svgd(root, ['check', '--docs', 'docs']).stdout, /\[doc-svg-no-source\].*gone\/foo\.ts/);
  // a hand-made SVG with nothing to say where it came from is left alone
  put(root, 'images/foo.svg', SVG);
  assert.doesNotMatch(svgd(root, ['check', '--docs', 'docs']).stdout, /doc-svg-no-source/);
});

// ---- 2. check skips what is not a diagram -----------------------------------------------------
test('check: a _helper.ts and a file without a default export are skipped with an info message, not failed', () => {
  const root = tmp();
  put(root, 'diagrams/_base.ts', 'export const unit = 8;\n');
  put(root, 'diagrams/util.ts', 'export const unit = 8;\n');
  put(root, 'diagrams/a.ts', GOOD_TS);
  const r = svgd(root, ['check', '--strict', 'diagrams/_base.ts', 'diagrams/util.ts', 'diagrams/a.ts']);
  assert.equal(r.status, 0, out(r));
  assert.match(r.stdout, /_base\.ts: 先頭が _/);
  assert.match(r.stdout, /util\.ts: 図ではない/);
  assert.match(r.stdout, /✓ diagrams\/a\.ts/);
  // a diagram that really is broken still fails
  put(root, 'diagrams/bad.ts', 'export default function define() { throw new Error("boom"); }\n');
  assert.equal(svgd(root, ['check', 'diagrams/bad.ts']).status, 1);
});

// ---- 3. lint path resolution -----------------------------------------------------------------
test('lint: a repo-root-relative path, a .ts source and a quoted glob all find their SVG; a miss says what was tried', () => {
  const root = tmp();
  put(root, 'book/chapters/diagrams/x.ts', GOOD_TS);
  put(root, 'book/.svg-diagram.json', JSON.stringify({outDir: 'chapters/images'}));
  const book = path.join(root, 'book');
  const b = svgd(book, ['build', 'chapters/diagrams/x.ts']);
  assert.equal(b.status, 0, out(b));
  assert.ok(fs.existsSync(path.join(book, 'chapters/images/x.svg')), 'outDir is where build wrote it');
  fs.mkdirSync(path.join(root, '.git'));
  // from inside the book, with the path as seen from the repository root
  const fromRoot = svgd(path.join(book, 'chapters'), ['lint', '--strict', 'book/chapters/images/x.svg']);
  assert.equal(fromRoot.status, 0, out(fromRoot));
  assert.match(fromRoot.stdout, /Scanned 1 file/);
  // a source stands for its SVG
  const bySource = svgd(book, ['lint', '--strict', 'chapters/diagrams/x.ts']);
  assert.equal(bySource.status, 0, out(bySource));
  assert.match(bySource.stdout, /Scanned 1 file/);
  // a glob the shell did not expand
  assert.equal(svgd(book, ['lint', 'chapters/images/*.svg']).status, 0);
  // default (no arguments): outDir
  assert.match(svgd(book, ['lint']).stdout, /Scanned 1 file/);
  // misses
  const miss = svgd(book, ['lint', 'nope/y.svg']);
  assert.equal(miss.status, 2);
  assert.match(miss.stderr, /no such SVG.*working directory.*Looked for: .*nope\/y\.svg/s);
  fs.rmSync(path.join(book, 'chapters/images'), {recursive: true});
  const noSvg = svgd(book, ['lint', 'chapters/diagrams/x.ts']);
  assert.equal(noSvg.status, 2);
  assert.match(noSvg.stderr, /is a diagram source; lint checks the SVG it builds.*Build it first/s);
});

test('resolveTargets: cwd first, then each folder above; a source maps to the SVG beside it', () => {
  const files = new Set(['/r/book/ch/images/x.svg', '/r/book/ch/images/y.svg', '/r/book/z.svg']);
  const io = {isFile: (f: string) => files.has(f), glob: () => []};
  const t = resolveTargets(['book/ch/images/x.svg', 'ch/images/y.svg', 'ch/diagrams/y.ts', 'z.svg', 'none.svg'], {cwd: '/r/book/ch', io: {...io, isFile: f => files.has(f) || f === '/r/book/ch/diagrams/y.ts'}, svgDirs: []});
  assert.deepEqual(t.files, ['/r/book/ch/images/x.svg', '/r/book/ch/images/y.svg', '/r/book/z.svg']);
  assert.equal(t.problems.length, 1);
  assert.equal(t.problems[0]?.arg, 'none.svg');
});

// ---- 4. lint --engine browser without a browser ----------------------------------------------------
test('lint --engine browser without playwright names the cause and the geometry fallback', () => {
  const root = tmp();
  put(root, 'a.svg', SVG);
  const r = svgd(root, ['lint', '--engine', 'browser', 'a.svg'], {NODE_OPTIONS: `--import ${BLOCK}`});
  assert.equal(r.status, 2, out(r));
  assert.match(r.stderr, /playwright-chromium is not installed/);
  assert.match(r.stderr, /svg-diagram lint --engine geometry/);
});

// ---- 5. typecheck without tsconfig.json --------------------------------------------------------------------
test('typecheck: without a tsconfig.json it runs with the defaults (and says so)', () => {
  const root = tmp();
  put(root, 'package.json', '{"type":"module"}\n');
  put(root, 'diagrams/a.ts', GOOD_TS);
  const wrap = path.join(root, 'bin');
  put(root, 'bin/tsc', `#!/bin/sh\nexec "${path.join(ROOT, 'node_modules', '.bin', 'tsc')}" "$@"\n`);
  fs.chmodSync(path.join(wrap, 'tsc'), 0o755);
  const env = {PATH: `${wrap}${path.delimiter}${process.env['PATH']}`};
  const ok = svgd(root, ['typecheck'], env);
  assert.equal(ok.status, 0, out(ok));
  assert.match(ok.stderr, /tsconfig\.json がない/);
  assert.equal(fs.existsSync(path.join(root, '.svg-diagram-tsconfig.json')), false);
  put(root, 'diagrams/a.ts', GOOD_TS + 'const n: number = "x";\n');
  const bad = svgd(root, ['typecheck'], env);
  assert.equal(bad.status, 1, out(bad));
  assert.match(out(bad), /TS2322/);
});

// ---- 6. build outDir ---------------------------------------------------------------------------------------
test('build: "outDir" in .svg-diagram.json is the default output folder; --out-dir and --out win', () => {
  const root = tmp();
  put(root, 'a.ts', GOOD_TS);
  put(root, '.svg-diagram.json', JSON.stringify({outDir: 'images'}));
  assert.equal(svgd(root, ['build', 'a.ts', '--no-lint']).status, 0);
  assert.ok(fs.existsSync(path.join(root, 'images/a.svg')));
  assert.equal(svgd(root, ['build', 'a.ts', '--no-lint', '--out-dir', 'other']).status, 0);
  assert.ok(fs.existsSync(path.join(root, 'other/a.svg')));
  assert.equal(svgd(root, ['build', 'a.ts', '--no-lint', '--out', 'one.svg']).status, 0);
  assert.ok(fs.existsSync(path.join(root, 'one.svg')));
  assert.equal(fs.existsSync(path.join(root, 'svg')), false);
  // check --drift looks in outDir too
  assert.equal(svgd(root, ['check', '--drift', 'a.ts']).status, 0);
  // a bad value is told
  put(root, '.svg-diagram.json', JSON.stringify({outDir: 3}));
  assert.match(out(svgd(root, ['build', 'a.ts', '--no-lint'])), /"outDir" must be a folder name/);
});

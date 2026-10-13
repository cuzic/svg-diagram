// The command line: build-diagram.ts, check-diagram.ts and bin/svg-diagram, run as child processes in a temp project.
// Diagram sources are written both as .ts and as .mjs and import the DSL as 'svg-diagram' (resolved by lib/resolve-hook.ts).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const BUILD = path.join(ROOT, 'build-diagram.ts'), CHECK = path.join(ROOT, 'check-diagram.ts'), BIN = path.join(ROOT, 'bin', 'svg-diagram');
const node = (cwd: string, script: string, ...args: string[]) => spawnSync(process.execPath, [script, ...args], {cwd, encoding: 'utf8'});
const out = (r: ReturnType<typeof node>) => `${r.stdout}\n${r.stderr}`;

const GOOD_TS = `import {diagram, caption, box, row, connect} from 'svg-diagram';
import type {Diagram} from 'svg-diagram';
export default function define(): Diagram {
  const a = box({id: 'a', title: '入口'}), b = box({id: 'b', title: '出口'});
  const d = diagram({theme: 'blue', title: '試験図'});
  d.add(caption('キャプション'), row([a, b]), connect(a.right, b.left));
  return d;
}
`;
const GOOD_MJS = `import {diagram, caption, box, row, connect} from 'svg-diagram';
export default () => {
  const d = diagram({theme: 'teal', title: '試験図 mjs'});
  d.add(caption('キャプション'), row([box({id: 'a', title: '入口'}), box({id: 'b', title: '出口'})]), connect('a:right', 'b:left'));
  return d;
};
`;
// a wide diagram: the doc-width rule warns (exit 0 normally, 1 with --strict)
const WIDE_TS = GOOD_TS.replace("title: '試験図'}", "title: '試験図', width: 1200}");

const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-'));
fs.mkdirSync(path.join(proj, 'src'));
const w = (rel: string, body: string) => { const f = path.join(proj, rel); fs.mkdirSync(path.dirname(f), {recursive: true}); fs.writeFileSync(f, body); return f; };
w('src/flow.ts', GOOD_TS); w('src/legacy.mjs', GOOD_MJS); w('src/wide.ts', WIDE_TS);
w('src/nodefault.ts', `import {box} from 'svg-diagram';\nexport const x = box({title: 'no default'});\n`);
w('src/throws.ts', `export default () => { throw new Error('boom from define'); };\n`);

test('build: .ts and .mjs sources both build to svg/<basename without extension>.svg, importing from svg-diagram', () => {
  const r = node(proj, BUILD, 'src/flow.ts', 'src/legacy.mjs');
  assert.equal(r.status, 0, out(r));
  assert.match(r.stdout, /✓ svg\/flow\.svg/);
  assert.match(r.stdout, /✓ svg\/legacy\.svg/);
  for (const n of ['flow', 'legacy']) {
    const svg = fs.readFileSync(path.join(proj, 'svg', `${n}.svg`), 'utf8');
    assert.match(svg, /^<svg\b/);
    assert.match(svg, /<title[^>]*>試験図/);
    // provenance embedded for `check --drift`
    const meta = /<metadata id="svg-diagram">([^<]*)<\/metadata>/.exec(svg);
    assert.ok(meta, 'metadata present');
    const j = JSON.parse(meta[1].replace(/&quot;/g, '"'));
    assert.equal(j.generator, 'svg-diagram');
    assert.match(j.source, new RegExp(`src/${n === 'flow' ? 'flow\\.ts' : 'legacy\\.mjs'}$`));
    assert.match(j.sourceSha256, /^[0-9a-f]{64}$/);
    assert.equal(j.toolVersion, JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version);
  }
  assert.equal(fs.existsSync(path.join(proj, 'svg', 'flow.ts.svg')), false);
});

test('build: --out overrides the output path (and creates directories); the default path is then not written', () => {
  const target = path.join(proj, 'elsewhere', 'deep', 'custom.svg');
  const r = node(proj, BUILD, 'src/legacy.mjs', '--out', target);
  assert.equal(r.status, 0, out(r));
  assert.ok(fs.existsSync(target));
  assert.match(r.stdout, /custom\.svg/);
  const r2 = node(proj, BUILD, 'src/flow.ts', '--out', path.join(proj, 'o.svg'));
  assert.equal(r2.status, 0, out(r2));
  assert.ok(fs.existsSync(path.join(proj, 'o.svg')));
});

test('build: usage errors exit 2 (no input; --out with several inputs)', () => {
  const none = node(proj, BUILD);
  assert.equal(none.status, 2);
  assert.match(none.stderr, /Usage: svg-diagram build/);
  const many = node(proj, BUILD, 'src/flow.ts', 'src/legacy.mjs', '--out', 'x.svg');
  assert.equal(many.status, 2);
  assert.match(many.stderr, /--out only makes sense with exactly one input module/);
});

test('build: a source without a default export function fails with exit 1 and a message naming the file; the others still build', () => {
  fs.rmSync(path.join(proj, 'svg', 'flow.svg'));
  const r = node(proj, BUILD, 'src/nodefault.ts', 'src/flow.ts');
  assert.equal(r.status, 1, out(r));
  assert.match(r.stderr, /✗ src\/nodefault\.ts: no default export function/);
  assert.ok(fs.existsSync(path.join(proj, 'svg', 'flow.svg')), 'later inputs are still built');
  assert.equal(fs.existsSync(path.join(proj, 'svg', 'nodefault.svg')), false);
});

test('build: an error thrown while defining the diagram is reported per file with exit 1', () => {
  const r = node(proj, BUILD, 'src/throws.ts');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /✗ src\/throws\.ts: boom from define/);
  const missing = node(proj, BUILD, 'src/does-not-exist.ts');
  assert.notEqual(missing.status, 0);
});

// ---- check ------------------------------------------------------------------------------------------
test('check: a clean diagram passes, with --strict too; .ts and .mjs both load', () => {
  const r = node(proj, CHECK, '--strict', 'src/flow.ts', 'src/legacy.mjs');
  assert.equal(r.status, 0, out(r));
  assert.match(r.stdout, /✓ src\/flow\.ts/);
  assert.match(r.stdout, /✓ src\/legacy\.mjs/);
});

test('check: warnings exit 0 normally and 1 with --strict; --format json carries them', () => {
  const plain = node(proj, CHECK, 'src/wide.ts');
  assert.equal(plain.status, 0, out(plain));
  assert.match(plain.stdout, /△ src\/wide\.ts（警告 1）/);
  assert.match(plain.stdout, /\[doc-width\]/);
  const strict = node(proj, CHECK, '--strict', 'src/wide.ts');
  assert.equal(strict.status, 1);
  const j = JSON.parse(node(proj, CHECK, '--format', 'json', 'src/wide.ts').stdout);
  assert.equal(j.errors, 0); assert.equal(j.warnings, 1);
  assert.equal(j.findings[0].rule, 'doc-width');
  assert.match(node(proj, CHECK, '--format', 'github', 'src/wide.ts').stdout, /^::warning file=src\/wide\.ts,title=doc-width::/m);
  assert.equal(node(proj, CHECK, '--format', 'xml', 'src/wide.ts').status, 2);
});

test('check: .svg-diagram.json accept (found by walking up) turns the warning into info, so --strict passes', () => {
  const sub = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-cfg-'));
  fs.mkdirSync(path.join(sub, 'deep', 'er'), {recursive: true});
  fs.writeFileSync(path.join(sub, '.svg-diagram.json'), JSON.stringify({accept: {'doc-width': '幅は承知'}}));
  const src = path.join(sub, 'deep', 'er', 'wide.ts');
  fs.writeFileSync(src, WIDE_TS);
  const r = node(path.join(sub, 'deep', 'er'), CHECK, '--strict', '--verbose', 'wide.ts');
  assert.equal(r.status, 0, out(r));
  assert.match(r.stdout, /ℹ \[doc-width\].*許容: 幅は承知/);
});

test('check: a layout error (unknown anchor) exits 1 and names the id; a bad config file is an error too', () => {
  w('src/badref.ts', `import {diagram, box, connect} from 'svg-diagram';
export default () => { const d = diagram({theme: 'blue', title: 't'}); d.add(box({id: 'a', title: 'A'}), connect('a', 'zzz' as 'a')); return d; };\n`);
  const r = node(proj, CHECK, 'src/badref.ts');
  assert.equal(r.status, 1);
  assert.match(out(r), /unknown anchor id "zzz"/);
  const bad = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-badcfg-'));
  fs.writeFileSync(path.join(bad, '.svg-diagram.json'), '{nope');
  fs.writeFileSync(path.join(bad, 'f.ts'), GOOD_TS);
  const rb = node(bad, CHECK, 'f.ts');
  assert.notEqual(rb.status, 0);
  assert.match(out(rb), /\.svg-diagram\.json/);
});

test('check: usage error without sources exits 2', () => {
  const r = node(proj, CHECK);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Usage: svg-diagram check/);
});

test('check --drift: up to date passes; a changed source is stale; a missing svg and one without provenance are errors', () => {
  const drift = (...a: string[]) => node(proj, CHECK, '--drift', ...a);
  // legacy.svg and flow.svg were built from the current sources above
  node(proj, BUILD, 'src/flow.ts', 'src/legacy.mjs');
  const ok = drift('src/flow.ts', 'src/legacy.mjs');
  assert.equal(ok.status, 0, out(ok));
  assert.match(ok.stdout, /✓ src\/flow\.ts: svg\/flow\.svg は最新/);

  const missing = drift('src/wide.ts');
  assert.equal(missing.status, 1);
  assert.match(out(missing), /svg\/wide\.svg がない（未生成）/);

  w('svg/plain.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>');
  w('src/plain.ts', GOOD_TS);
  const nometa = drift('src/plain.ts');
  assert.equal(nometa.status, 1);
  assert.match(out(nometa), /生成元の情報/);

  const src = path.join(proj, 'src', 'flow.ts');
  const orig = fs.readFileSync(src, 'utf8');
  fs.writeFileSync(src, orig + '\n// edited\n');
  try {
    const stale = drift('src/flow.ts');
    assert.equal(stale.status, 1);
    assert.match(out(stale), /ソースが変わっているのに svg\/flow\.svg が再生成されていない/);
    const j = JSON.parse(drift('--format', 'json', 'src/flow.ts').stdout);
    assert.equal(j.findings[0].rule, 'drift-stale');
  } finally { fs.writeFileSync(src, orig); }
  assert.equal(drift('src/flow.ts').status, 0, 'restoring the source makes it current again');
  const other = drift('--svg-dir', 'nowhere', 'src/flow.ts');
  assert.equal(other.status, 1, '--svg-dir is honoured');
});

test('check --drift --rebuild: identical rebuild passes; a hand-edited svg is reported with an explanation', () => {
  const ok = node(proj, CHECK, '--drift', '--rebuild', 'src/flow.ts');
  assert.equal(ok.status, 0, out(ok));
  const f = path.join(proj, 'svg', 'flow.svg');
  const orig = fs.readFileSync(f, 'utf8');
  fs.writeFileSync(f, orig.replace(/(<text\b[^>]*>)入口/, '$1入口X'));
  try {
    const r = node(proj, CHECK, '--drift', '--rebuild', 'src/flow.ts');
    assert.equal(r.status, 1);
    assert.match(out(r), /再生成した SVG が svg\/flow\.svg と一致しない/);
    assert.match(out(r), /文字の増減/);
  } finally { fs.writeFileSync(f, orig); }
});

// ---- check --docs: the source lookup finds <name>.ts and <name>.mjs --------------------------------------
test('check --docs --src-dir: figures whose source is .ts and .mjs are both matched against the page notes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-docs-'));
  for (const d of ['docs', 'src', 'svg']) fs.mkdirSync(path.join(root, d));
  const wf = (title: string) => `import {diagram, wireframe, wf} from 'svg-diagram';
export default () => { const d = diagram({theme: 'blue', title: 't'}); d.add(wireframe(wf.btn('a', {n: 1}), {title: 'S', notes: [{title: '${title}', text: '本文'}]})); return d; };\n`;
  fs.writeFileSync(path.join(root, 'src', 'viats.ts'), wf('甲'));
  fs.writeFileSync(path.join(root, 'src', 'viamjs.mjs'), wf('乙'));
  for (const n of ['viats', 'viamjs']) fs.writeFileSync(path.join(root, 'svg', `${n}.svg`), '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>');
  const md = (a: string, b: string) => `# P\n\n![ボタン画面](../svg/viats.svg)\n\n1. **${a}**：本文\n\n![別のボタン画面](../svg/viamjs.svg)\n\n1. **${b}**：本文\n`;
  const run = (body: string) => { fs.writeFileSync(path.join(root, 'docs', 'p.md'), body); return node(root, CHECK, '--docs', 'docs', '--svg-dir', 'svg', '--src-dir', 'src', '--strict'); };
  const good = run(md('甲', '乙'));
  assert.equal(good.status, 0, out(good));
  const badTs = run(md('違う', '乙'));
  assert.equal(badTs.status, 1);
  assert.match(badTs.stdout, /viats: 注釈 1 の題名が違う/);
  const badMjs = run(md('甲', '違う'));
  assert.equal(badMjs.status, 1);
  assert.match(badMjs.stdout, /viamjs: 注釈 1 の題名が違う/);
  assert.doesNotMatch(badMjs.stdout, /viats: 注釈/);
  // without --src-dir nothing is compared
  fs.writeFileSync(path.join(root, 'docs', 'p.md'), md('違う', '違う'));
  assert.equal(node(root, CHECK, '--docs', 'docs', '--strict').status, 0);
});

// ---- bin/svg-diagram ----------------------------------------------------------------------------------
const bin = (cwd: string, ...args: string[]) => spawnSync('bash', [BIN, ...args], {cwd, encoding: 'utf8'});

test('bin/svg-diagram: no arguments or an unknown command prints the usage and exits 2', () => {
  for (const args of [[], ['frobnicate']]) {
    const r = bin(proj, ...args);
    assert.equal(r.status, 2);
    assert.match(r.stdout, /svg-diagram build <source\.ts>/);
    assert.match(r.stdout, /svg-diagram check/);
  }
});

test('bin/svg-diagram: build and check dispatch to the scripts (also through a symlink), passing arguments and exit codes on', () => {
  const link = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cli-bin-')), 'svg-diagram');
  fs.symlinkSync(BIN, link);
  const b = spawnSync(link, ['build', 'src/legacy.mjs', '--out', path.join(proj, 'viabin.svg')], {cwd: proj, encoding: 'utf8'});
  assert.equal(b.status, 0, out(b));
  assert.ok(fs.existsSync(path.join(proj, 'viabin.svg')));
  assert.equal(bin(proj, 'check', '--strict', 'src/wide.ts').status, 1);
  const lint = bin(proj, 'lint', path.join(proj, 'svg', 'flow.svg'), '--strict');
  assert.equal(lint.status, 0, out(lint));
});

test('bin/svg-diagram diff: explains the change between two svgs', () => {
  const a = path.join(proj, 'svg', 'flow.svg'), b = path.join(proj, 'svg', 'legacy.svg');
  const same = bin(proj, 'diff', a, a);
  assert.equal(same.status, 0, out(same));
  assert.match(same.stdout, /同一/);
  assert.match(bin(proj, 'diff', a, b).stdout, /文字|図形|メタデータ|キャンバス/);
});

test('init makes a project that typechecks its type setting, and never overwrites', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svgd-init-'));
  fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"x"}\n');
  fs.writeFileSync(path.join(dir, 'tsconfig.json'), '{"keep":true}\n');
  const r = spawnSync(BIN, ['init'], {cwd: dir, encoding: 'utf8'});
  assert.equal(r.status, 0, out(r));
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).type, 'module');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'tsconfig.json'), 'utf8')), {keep: true});
  const fresh = fs.mkdtempSync(path.join(os.tmpdir(), 'svgd-init-'));
  assert.equal(spawnSync(BIN, ['init'], {cwd: fresh, encoding: 'utf8'}).status, 0);
  assert.ok(JSON.parse(fs.readFileSync(path.join(fresh, 'tsconfig.json'), 'utf8')).compilerOptions.noEmit);
  // the browser is optional: init creates no pnpm-workspace.yaml for it, and says how to add it
  assert.equal(fs.existsSync(path.join(fresh, 'pnpm-workspace.yaml')), false);
  fs.writeFileSync(path.join(dir, 'pnpm-workspace.yaml'), 'packages: []\n');
  assert.match(out(spawnSync(BIN, ['init'], {cwd: dir, encoding: 'utf8'})), /playwright-chromium/);
  assert.equal(fs.readFileSync(path.join(dir, 'pnpm-workspace.yaml'), 'utf8'), 'packages: []\n'); // left alone
  const noTsc = (process.env.PATH ?? '').split(path.delimiter).filter(d => !fs.existsSync(path.join(d, 'tsc'))).join(path.delimiter);
  const t = spawnSync(BIN, ['typecheck'], {cwd: dir, encoding: 'utf8', env: {...process.env, PATH: noTsc}});
  assert.equal(t.status, 2); // no typescript in a bare temp project, none on PATH: says how to install it
  assert.match(out(t), /typescript/);
});

test('typecheck works with this tool run globally: a tsc on PATH, `svg-diagram` and node types resolved from the tool, not the project', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svgd-tc-'));
  fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"x"}\n');
  assert.equal(spawnSync(BIN, ['init'], {cwd: dir, encoding: 'utf8'}).status, 0);
  fs.mkdirSync(path.join(dir, 'diagrams'));
  const src = (extra: string) => `${GOOD_TS}\n${extra}`;
  const tscBin = path.join(ROOT, 'node_modules', '.bin', 'tsc');
  const wrap = path.join(dir, 'bin');
  fs.mkdirSync(wrap);
  fs.writeFileSync(path.join(wrap, 'tsc'), `#!/bin/sh\nexec "${tscBin}" "$@"\n`, {mode: 0o755});
  const env = {...process.env, PATH: `${wrap}${path.delimiter}${process.env.PATH}`};
  fs.writeFileSync(path.join(dir, 'diagrams', 'a.ts'), src('console.log(process.argv.length);\n'));
  const ok = spawnSync(BIN, ['typecheck'], {cwd: dir, encoding: 'utf8', env});
  assert.equal(ok.status, 0, out(ok));
  assert.equal(fs.existsSync(path.join(dir, '.svg-diagram-tsconfig.json')), false); // the temporary config is removed
  fs.writeFileSync(path.join(dir, 'diagrams', 'a.ts'), src('const n: number = "x";\n'));
  const bad = spawnSync(BIN, ['typecheck'], {cwd: dir, encoding: 'utf8', env});
  assert.equal(bad.status, 1, out(bad));
  assert.match(out(bad), /TS2322/);
});

test('build: --no-lint skips the lint pass but still writes the SVG', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-nolint-'));
  fs.writeFileSync(path.join(dir, 'a.ts'), GOOD_TS);
  const r = node(dir, BUILD, 'a.ts', '--no-lint', '--out-dir', 'out');
  assert.equal(r.status, 0, out(r));
  assert.ok(fs.existsSync(path.join(dir, 'out', 'a.svg')));
});

test('a change in a local file the source imports makes the SVG stale (--stale rebuilds, check --drift complains)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-deps-'));
  fs.mkdirSync(path.join(dir, 'lib'));
  fs.writeFileSync(path.join(dir, 'lib', 'common.ts'), "export const T = '入口';\n");
  fs.writeFileSync(path.join(dir, 'a.ts'), GOOD_TS.replace("import type", "import {T} from './lib/common.ts';\nimport type").replace("title: '入口'", 'title: T'));
  const b = () => node(dir, BUILD, 'a.ts', '--out-dir', 'out', '--stale', '--no-lint');
  assert.equal(b().status, 0);
  assert.match(b().stdout, /スキップ/);
  assert.equal(node(dir, CHECK, '--drift', '--svg-dir', 'out', 'a.ts').status, 0);
  fs.writeFileSync(path.join(dir, 'lib', 'common.ts'), "export const T = '玄関';\n");
  const c = node(dir, CHECK, '--drift', '--svg-dir', 'out', 'a.ts');
  assert.equal(c.status, 1);
  assert.match(out(c), /import している/);
  assert.match(b().stdout, /1 件を生成/);
  assert.equal(node(dir, CHECK, '--drift', '--svg-dir', 'out', 'a.ts').status, 0);
});

test('build: --out-dir writes every source into one directory; --stale skips what is current and rebuilds what changed', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-stale-'));
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', 'a.ts'), GOOD_TS);
  fs.writeFileSync(path.join(dir, 'src', 'b.mjs'), GOOD_MJS);
  const first = node(dir, BUILD, 'src/a.ts', 'src/b.mjs', '--out-dir', 'out', '--stale');
  assert.equal(first.status, 0, out(first));
  assert.match(first.stdout, /2 件を生成、0 件は最新でスキップ/);
  assert.ok(fs.existsSync(path.join(dir, 'out', 'a.svg')) && fs.existsSync(path.join(dir, 'out', 'b.svg')));
  const again = node(dir, BUILD, 'src/a.ts', 'src/b.mjs', '--out-dir', 'out', '--stale');
  assert.match(again.stdout, /0 件を生成、2 件は最新でスキップ/);
  fs.writeFileSync(path.join(dir, 'src', 'a.ts'), GOOD_TS.replace('入口', '入口2'));
  const third = node(dir, BUILD, 'src/a.ts', 'src/b.mjs', '--out-dir', 'out', '--stale');
  assert.match(third.stdout, /1 件を生成、1 件は最新でスキップ/);
  assert.match(fs.readFileSync(path.join(dir, 'out', 'a.svg'), 'utf8'), /入口2/);
  // a project config change makes every SVG stale
  fs.writeFileSync(path.join(dir, '.svg-diagram.json'), '{"accept": {"doc-width": "ok"}}');
  assert.match(node(dir, BUILD, 'src/a.ts', 'src/b.mjs', '--out-dir', 'out', '--stale').stdout, /2 件を生成/);
  // without --stale everything is rebuilt, and --out with --out-dir is a usage error
  assert.doesNotMatch(node(dir, BUILD, 'src/a.ts', '--out-dir', 'out').stdout, /スキップ/);
  assert.equal(node(dir, BUILD, 'src/a.ts', '--out', 'x.svg', '--out-dir', 'out').status, 2);
});

test('notes prints the figure notes as a list that check --docs accepts; check --docs --map prints the table', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-notes-'));
  const ex = path.join(ROOT, 'examples');
  const notes = bin(dir, 'notes', path.join(ex, 'inventory-flow.ts'));
  assert.equal(notes.status, 1); // no wireframe notes in a flow
  const r = bin(dir, 'notes', path.join(ex, 'inventory-wireframe.ts'));
  assert.equal(r.status, 0, out(r));
  assert.match(r.stdout, /^1\. \*\*.+\*\*：/m);
  fs.mkdirSync(path.join(dir, 'svg'));
  fs.writeFileSync(path.join(dir, 'svg', 'inventory-wireframe.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  fs.writeFileSync(path.join(dir, 'svg', 'orphan.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  fs.writeFileSync(path.join(dir, 'a.md'), '![在庫画面](svg/inventory-wireframe.svg)\n');
  const m = bin(dir, 'check', '--docs', '.', '--svg-dir', 'svg', '--map');
  assert.match(m.stdout, /^\| inventory-wireframe \| — \| `svg\/inventory-wireframe.svg` \| `a.md:1` \|$/m);
  assert.match(m.stdout, /\| orphan \|.*（参照なし）/);
  assert.doesNotMatch(m.stdout, /doc-orphan/); // findings stay on stderr
});

test('init leaves the workspace file to an enclosing pnpm workspace; --map needs --docs and text format', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-ws-'));
  fs.writeFileSync(path.join(root, 'pnpm-workspace.yaml'), 'packages: ["docs/*"]\n');
  const sub = path.join(root, 'docs', 'diagrams');
  assert.equal(bin(root, 'init', sub).status, 0);
  assert.ok(!fs.existsSync(path.join(sub, 'pnpm-workspace.yaml')));
  assert.equal(bin(root, 'check', '--map', 'x.ts').status, 2);
  assert.equal(bin(root, 'check', '--docs', '.', '--map', '--format', 'json').status, 2);
});

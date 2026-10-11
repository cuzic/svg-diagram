// playwright-chromium is an optional peer dependency: with it missing, everything that needs no browser still works, and what
// does need one says how to get it. Each case runs in a child process in which the package cannot be imported.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const BLOCK = path.join(import.meta.dirname, 'helpers', 'block-playwright-register.ts');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'optional-browser-'));
// NODE_OPTIONS, not a flag: build starts lint-svg as a child of its own, and the block has to reach it too
const node = (args: string[], cwd = ROOT) => spawnSync(process.execPath, args, {cwd, encoding: 'utf8', env: {...process.env, SVG_DIAGRAM_MEASURE: '', NODE_OPTIONS: `--import ${pathToFileURL(BLOCK).href}`}});
const all = (r: ReturnType<typeof node>) => `${r.stdout}\n${r.stderr}`;

const CLEAN = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100"><rect x="0" y="0" width="200" height="100" fill="#ffffff"/><text x="20" y="40" font-size="16" font-family="'Hiragino Sans','Yu Gothic',sans-serif" fill="#22201b">ok</text></svg>`;

test('the package really cannot be imported in these child processes (the premise of the other tests)', () => {
  const r = node(['--input-type=module', '-e', `try { await import('playwright-chromium'); console.log('IMPORTED'); } catch (e) { console.log('BLOCKED ' + e.code); }`]);
  assert.match(r.stdout, /BLOCKED ERR_MODULE_NOT_FOUND/);
});

test('launchChromium without the package says what to add, with pnpm', () => {
  const dir = tmp();
  const script = path.join(dir, 's.ts');
  fs.writeFileSync(script, `import {launchChromium} from ${JSON.stringify(path.join(ROOT, 'lib', 'browser.ts'))};\ntry { await launchChromium(); console.log('LAUNCHED'); } catch (e) { console.log((e as Error).message); }\n`);
  const r = node([script]);
  assert.match(r.stdout, /playwright-chromium is not installed/);
  assert.match(r.stdout, /pnpm add -D playwright-chromium/);
  assert.match(r.stdout, /pnpm exec playwright install chromium/);
  assert.match(r.stdout, /layout, build and the default checks need no browser/);
  assert.doesNotMatch(r.stdout, /\bn[p]m (i|install)\b/); // pnpm only
  fs.rmSync(dir, {recursive: true});
});

test('an error that is not "package missing" is not turned into the hint', () => {
  const dir = tmp();
  const script = path.join(dir, 's.ts');
  // the package is there; the executable is not: that is the other message
  fs.writeFileSync(script, `import {launchChromium} from ${JSON.stringify(path.join(ROOT, 'lib', 'browser.ts'))};\ntry { await launchChromium({executablePath: '/nonexistent/chrome'}); } catch (e) { console.log((e as Error).message.split('\\n')[0]); }\n`);
  const r = spawnSync(process.execPath, [script], {cwd: ROOT, encoding: 'utf8'});
  assert.doesNotMatch(r.stdout, /is not installed, and this needs a browser/);
  assert.match(r.stdout, /nonexistent\/chrome|Executable|browser/i);
  fs.rmSync(dir, {recursive: true});
});

test('the chromium measuring engine, asked for explicitly, fails with the hint instead of a stack trace', () => {
  const dir = tmp();
  const script = path.join(dir, 's.ts');
  fs.writeFileSync(script, `import {configureMeasure, measureAll} from ${JSON.stringify(path.join(ROOT, 'lib', 'measure.ts'))};\nconfigureMeasure({measure: 'chromium'});\ntry { await measureAll(new Map([['k', {text: 'x', size: 16}]])); console.log('MEASURED'); } catch (e) { console.log((e as Error).message); }\n`);
  const r = node([script]);
  assert.match(r.stdout, /playwright-chromium is not installed/);
  fs.rmSync(dir, {recursive: true});
});

test('layout and build need no browser: an example builds even though its lint cannot render', () => {
  const dir = tmp();
  const r = node([path.join(ROOT, 'build-diagram.ts'), path.join(ROOT, 'examples', 'inventory-flow.ts'), '--out', path.join(dir, 'f.svg')]);
  assert.equal(r.status, 0, all(r));
  assert.doesNotMatch(all(r), /Cannot find package|ERR_MODULE_NOT_FOUND/);
  assert.match(fs.readFileSync(path.join(dir, 'f.svg'), 'utf8'), /^<svg\b/);
  fs.rmSync(dir, {recursive: true});
});

test('lint without a browser still runs the static checks, reports the others as not run, and passes a clean file', () => {
  const dir = tmp();
  const clean = path.join(dir, 'clean.svg'), bad = path.join(dir, 'bad.svg');
  fs.writeFileSync(clean, CLEAN);
  fs.writeFileSync(bad, CLEAN.replace('y="40" ', '').replace('<text ', '<text writing-mode="tb" '));
  const ok = node([path.join(ROOT, 'lint-svg.ts'), clean]);
  assert.equal(ok.status, 0, all(ok));
  assert.match(ok.stdout, /checks on the rendering .* were NOT run/s);
  assert.match(ok.stdout, /pnpm add -D playwright-chromium/);
  const ng = node([path.join(ROOT, 'lint-svg.ts'), bad]);
  assert.equal(ng.status, 1, all(ng));
  assert.match(ng.stdout, /\[text-missing-y\]/);
  assert.match(ng.stdout, /\[writing-mode-tb\]/);
  assert.match(ng.stdout, /NOT run/);
  fs.rmSync(dir, {recursive: true});
});

test('package.json: playwright-chromium is an optional peer and a dev dependency, not a dependency', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.dependencies['playwright-chromium'], undefined);
  assert.ok(pkg.peerDependencies['playwright-chromium']);
  assert.equal(pkg.peerDependenciesMeta['playwright-chromium'].optional, true);
  assert.ok(pkg.devDependencies['playwright-chromium']);
  assert.ok(pkg.dependencies.harfbuzzjs && pkg.dependencies.sixel);
});

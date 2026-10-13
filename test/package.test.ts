// What gets published: package.json against the files that are really there, and against what the code imports at run time.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {builtinModules} from 'node:module';

const ROOT = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const sources = (dir: string): string[] => fs.readdirSync(path.join(ROOT, dir), {withFileTypes: true}).flatMap(e => e.isDirectory() ? sources(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : []);
const shipped = [...fs.readdirSync(ROOT).filter(f => f.endsWith('.ts')), ...sources('lib')]; // what tsconfig.build.json compiles into dist/

test('it can be published: not private, a name, a version, a licence, a public access setting', () => {
  assert.equal(pkg.private, undefined);
  assert.equal(pkg.name, 'svg-diagram');
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
  assert.equal(pkg.license, 'MIT');
  assert.ok(fs.existsSync(path.join(ROOT, 'LICENSE')));
  assert.equal(pkg.publishConfig.access, 'public');
  assert.match(pkg.repository.url, /cuzic\/svg-diagram/);
  assert.match(pkg.engines.node, /^>=22\.\d+$/);
});

test('dist/ is built before every pack and publish, from scratch', () => {
  assert.match(pkg.scripts.prepack, /rm -rf dist/);
  assert.match(pkg.scripts.prepack, /tsc -p tsconfig\.build\.json/);
  const build = JSON.parse(read('tsconfig.build.json'));
  assert.equal(build.compilerOptions.outDir, 'dist');
  assert.ok(build.include.includes('lib/**/*.ts') && build.include.includes('*.ts'));
});

test('what `files` lists is what ships: bin, skills, README and LICENSE exist, dist comes from the build, and nothing else is listed', () => {
  assert.deepEqual([...pkg.files].sort(), ['LICENSE', 'README.md', 'bin', 'dist', 'skills']);
  for (const f of pkg.files.filter((f: string) => f !== 'dist')) assert.ok(fs.existsSync(path.join(ROOT, f)), f);
  assert.ok(fs.readdirSync(path.join(ROOT, 'skills')).length > 0);
});

test('the command is the bash wrapper, executable, and runs the compiled files when dist/ is there', () => {
  assert.equal(pkg.bin['svg-diagram'], './bin/svg-diagram');
  const f = path.join(ROOT, 'bin', 'svg-diagram');
  assert.ok(fs.statSync(f).mode & 0o111, 'bin/svg-diagram is not executable');
  assert.match(read('bin/svg-diagram'), /^#!\/usr\/bin\/env bash/);
  assert.match(read('bin/svg-diagram'), /dist\/build-diagram\.js/);
});

test('the entry points are in dist/ and are what the build produces from lib/', () => {
  assert.deepEqual(Object.keys(pkg.exports).sort(), ['.', './markdown', './markdown-it', './remark', './render', './vitepress']);
  for (const [name, e] of Object.entries(pkg.exports) as [string, {types: string; default: string}][]) {
    for (const f of [e.types, e.default]) assert.match(f, /^\.\/dist\//, `${name}: ${f}`);
    assert.ok(fs.existsSync(path.join(ROOT, e.default.replace('./dist/', '').replace(/\.js$/, '.ts'))), `${name} has a source`);
  }
  assert.equal(pkg.types, pkg.exports['.'].types);
});

test('every package the shipped code imports is a dependency; playwright-chromium only on demand', () => {
  const declared = new Set(Object.keys(pkg.dependencies));
  const optional = new Set(Object.keys(pkg.peerDependenciesMeta ?? {}).filter(k => pkg.peerDependenciesMeta[k].optional));
  assert.deepEqual([...optional], ['playwright-chromium']);
  assert.ok(pkg.peerDependencies['playwright-chromium']);
  assert.equal(pkg.dependencies['playwright-chromium'], undefined);
  const seen = new Set<string>();
  for (const f of shipped) {
    const src = read(f);
    for (const m of src.matchAll(/^\s*(?:import|export)\s+(type\s+)?[^'"\n]*?from\s+['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)|\bimport\.meta\.resolve\(\s*['"]([^'"]+)['"]\s*\)/gm)) {
      const typeOnly = !!m[1], spec = m[2] ?? m[3] ?? m[4];
      if (spec.startsWith('.') || spec.startsWith('node:') || spec === 'svg-diagram') continue;
      const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
      if (builtinModules.includes(name)) continue;
      seen.add(name);
      if (name === 'playwright-chromium') {
        // never a run-time import except from the one place that loads it on demand
        if (!typeOnly) assert.ok(m[3] !== undefined && f === path.join('lib', 'browser.ts'), `${f} imports playwright-chromium at run time`);
        continue;
      }
      assert.ok(declared.has(name), `${f} imports ${spec}, but ${name} is not in dependencies`);
    }
  }
  for (const d of declared) assert.ok(seen.has(d), `${d} is a dependency nothing imports`);
});

test('no shipped file reaches for the tests, the examples or the sources of the repository', () => {
  for (const f of shipped) assert.doesNotMatch(read(f), /from\s+['"]\.\.?\/(test|examples)\//, f);
});

test('the README says what it needs: Node, and that a browser is optional', () => {
  const readme = read('README.md');
  assert.match(readme, /playwright-chromium/);
  assert.match(readme, /ブラウザ/);
});

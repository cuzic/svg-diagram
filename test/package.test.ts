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

test('what `files` lists is what ships: bin, schema, skills, README and LICENSE exist, dist comes from the build, and nothing else is listed', () => {
  assert.deepEqual([...pkg.files].sort(), ['LICENSE', 'README.md', 'bin', 'dist', 'schema', 'skills']);
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

test('the spec CLI allowlist names every published spec part', async () => {
  const {specPartLoaders} = await import('../lib/spec-cli-parts.ts');
  assert.deepEqual(Object.keys(specPartLoaders).sort(),
    Object.keys(pkg.exports).filter(key => key.startsWith('./spec/parts/')).map(key => key.slice('./spec/parts/'.length)).sort());
});

test('the entry points are in dist/ and are what the build produces from lib/', () => {
  assert.deepEqual(Object.keys(pkg.exports).sort(), ['.', './bands/areas', './bands/banner', './bands/bars', './bands/bowtie', './bands/box', './bands/bpmn', './bands/bubble', './bands/butterfly', './bands/caption', './bands/catplot', './bands/causal', './bands/cause', './bands/chevron', './bands/classes', './bands/cloud', './bands/clustermap', './bands/combo', './bands/compare', './bands/concentric', './bands/connect', './bands/curve', './bands/cycle', './bands/dependency', './bands/distplot', './bands/dots', './bands/emblem', './bands/fta', './bands/funnel', './bands/gantt', './bands/grid', './bands/group', './bands/group-row', './bands/harvey', './bands/heatmap', './bands/image', './bands/image/node', './bands/legend', './bands/math', './bands/multiplot', './bands/people', './bands/pert', './bands/plane', './bands/pyramid', './bands/quadrant', './bands/radar', './bands/raw', './bands/regplot', './bands/row', './bands/sankey', './bands/screens', './bands/sequence', './bands/spacer', './bands/stacked', './bands/states', './bands/status', './bands/swimlane', './bands/table', './bands/timeline', './bands/tornado', './bands/tree', './bands/treemap', './bands/value-chain', './bands/venn', './bands/waterfall', './bands/wireframe', './bands/wireframe/basic', './bands/wordart', './browser', './compose/arrow-diagram', './compose/canvas', './compose/hero', './compose/icon-row', './compose/versus', './compose/why-why-tree', './core', './html', './html/bands', './html/bands/box', './html/bands/table', './html/overlay', './html/selective', './markdown', './markdown-it', './measure/browser', './measure/node', './plugin', './png', './pptx', './pptx/bands/box', './pptx/bands/cause', './pptx/bands/flow', './pptx/bands/group', './pptx/bands/legend', './pptx/bands/pyramid', './pptx/bands/quadrant', './pptx/bands/states', './pptx/bands/swimlane', './pptx/bands/table', './pptx/bands/timeline', './pptx/bands/tree',  './pptx/deck/edge', './pptx/edge', './pptx/selective/edge', './pptx/svg-shapes', './remark', './render', './schema/*.json', './spec', './spec/edge', './spec/parts/affinity', './spec/parts/bars', './spec/parts/board', './spec/parts/bowtie', './spec/parts/boxplot', './spec/parts/bpmn', './spec/parts/bubble', './spec/parts/burndown', './spec/parts/burnup', './spec/parts/butterfly', './spec/parts/causal-loop', './spec/parts/cause-tree', './spec/parts/check-sheet', './spec/parts/chevron', './spec/parts/class-diagram', './spec/parts/cloud', './spec/parts/combo', './spec/parts/compare', './spec/parts/concentric', './spec/parts/control-chart', './spec/parts/cycle', './spec/parts/dependency-network', './spec/parts/fault-tree', './spec/parts/flowchart', './spec/parts/fmea', './spec/parts/funnel', './spec/parts/gantt', './spec/parts/harvey', './spec/parts/heatmap', './spec/parts/histogram', './spec/parts/is-is-not', './spec/parts/journey-map', './spec/parts/lines', './spec/parts/matrix', './spec/parts/mekko', './spec/parts/mindmap', './spec/parts/pareto', './spec/parts/pdpc', './spec/parts/pert', './spec/parts/pyramid', './spec/parts/qfd', './spec/parts/quadrant', './spec/parts/raci', './spec/parts/radar', './spec/parts/range-bars', './spec/parts/relation-diagram', './spec/parts/sankey', './spec/parts/scatter', './spec/parts/sequence', './spec/parts/stacked-bars', './spec/parts/state-diagram', './spec/parts/steps', './spec/parts/strategy-canvas', './spec/parts/swimlane', './spec/parts/table', './spec/parts/timeline', './spec/parts/tornado', './spec/parts/tree', './spec/parts/treemap', './spec/parts/value-chain', './spec/parts/venn', './spec/parts/versus', './spec/parts/waterfall', './spec/parts/why-why-table', './spec/parts/why-why-tree', './spec/selective', './spec/selective/edge', './spec/selective/node', './verify/document', './vitepress', './wireframe/parts', './wireframe/renderers', './zip']);
  assert.equal(pkg.exports['./schema/*.json'], './schema/*.json'); // the JSON Schema files (ADR 0071), shipped as they are: test/schema-files.test.ts
  for (const [name, e] of Object.entries(pkg.exports).filter(([name]) => name !== './schema/*.json') as [string, {types: string; default?: string; node?: string}][]) {
    const runtime = e.default ?? e.node;
    assert.ok(runtime, `${name} has a runtime entry`);
    for (const f of [e.types, runtime]) assert.match(f, /^\.\/dist\//, `${name}: ${f}`);
    assert.ok(fs.existsSync(path.join(ROOT, runtime.replace('./dist/', '').replace(/\.js$/, '.ts'))), `${name} has a source`);
  }
  assert.equal(pkg.types, pkg.exports['.'].types);
});

test('every package the shipped code imports is a dependency; playwright-chromium and mathjax-full only on demand', () => {
  const declared = new Set(Object.keys(pkg.dependencies));
  const optional = new Set(Object.keys(pkg.peerDependenciesMeta ?? {}).filter(k => pkg.peerDependenciesMeta[k].optional));
  assert.deepEqual([...optional].sort(), ['mathjax-full', 'playwright-chromium']);
  assert.ok(pkg.peerDependencies['playwright-chromium'] && pkg.peerDependencies['mathjax-full']);
  assert.equal(pkg.dependencies['playwright-chromium'], undefined);
  assert.equal(pkg.dependencies['mathjax-full'], undefined); // loaded by lib/math-tex.ts with createRequire, on the first math()
  const seen = new Set<string>();
  for (const f of shipped) {
    const src = read(f);
    for (const m of src.matchAll(/^\s*(?:import|export)\s+(type\s+)?[^'"\n]*?from\s+['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)|\bimport\.meta\.resolve\(\s*['"]([^'"]+)['"]\s*\)/gm)) {
      const typeOnly = !!m[1], spec = m[2] ?? m[3] ?? m[4];
      if (spec!.startsWith('.') || spec!.startsWith('node:') || spec === 'svg-diagram') continue;
      const name = spec!.startsWith('@') ? spec!.split('/').slice(0, 2).join('/') : spec!.split('/')[0];
      if (builtinModules.includes(name!)) continue;
      seen.add(name!);
      if (name === 'playwright-chromium') {
        // never a run-time import except from the one place that loads it on demand
        if (!typeOnly) assert.ok(m[3] !== undefined && f === path.join('lib', 'browser.ts'), `${f} imports playwright-chromium at run time`);
        continue;
      }
      assert.ok(declared.has(name!), `${f} imports ${spec}, but ${name} is not in dependencies`);
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

test('deck spec loading resolves every catalog discriminant to its published part', async () => {
  const {loadSpecPartsFor} = await import('../lib/spec-cli-parts.ts');
  const {partCatalog} = await import('../lib/spec.ts');
  for (const {type, example} of partCatalog()) {
    const parts = await loadSpecPartsFor({parts: [example, example]});
    assert.deepEqual(parts?.map(part => part.type), [type], type);
  }
});

// ADR 0007 §4: the core of rendering (layout, verify, emit, ...) does no I/O. A listed file may not reach — through static
// or dynamic imports, transitively — anything that touches the filesystem, a process, a browser or a font file, and may not
// read process.env. Type-only imports are erased and do not count. Shell files (measure.ts, layout-measured.ts, dsl.ts, the
// CLIs) are where those effects live.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const LIB = path.resolve(import.meta.dirname, '../lib');
// versus.ts is not here either: it is an authoring helper that builds bands with dsl.ts's constructors (group, row, connect), and dsl.ts is the shell.
// emit-html.ts is not here: it reads font metrics (font-metrics.ts → textBox) while it draws.
const CORE = ['atoms', 'bars', 'emit', 'fit', 'layout', 'plane', 'reveal', 'rich', 'rules', 'seq-table', 'spotlight', 'timeline', 'tokens', 'types/index', 'verify', 'icons', 'wrap', 'wireframe', 'math'];
const FORBIDDEN = /^(node:)?(fs|fs\/promises|child_process|net|http|https|os|worker_threads|crypto|process|module|vm|dns|tty|readline|zlib)$|^playwright|^@resvg|^harfbuzzjs|^sixel$/;

function importsOf(file: string): {local: string[]; external: string[]; usesEnv: boolean} {
  // line comments first: a `/*` inside `// lib/*.ts` must not open a block comment
  const src = fs.readFileSync(file, 'utf8').replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const local: string[] = [], external: string[] = [];
  const add = (spec: string) => (spec.startsWith('.') ? local : external).push(spec);
  for (const m of src.matchAll(/^\s*(import|export)\s+(?!type\b)[^;'"]*?from\s+['"]([^'"]+)['"]/gm)) add(m[2]);
  for (const m of src.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) add(m[1]);
  for (const m of src.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) add(m[1]);
  return {local, external, usesEnv: /\bprocess\b(?!\s*:)/.test(src)};
}

test('the rendering core reaches no I/O (transitive imports, process.*)', () => {
  const problems: string[] = [];
  for (const name of CORE) {
    const seen = new Set<string>();
    const walk = (file: string, via: string[]): void => {
      if (seen.has(file)) return;
      seen.add(file);
      const {local, external, usesEnv} = importsOf(file);
      const chain = [...via, path.basename(file)].join(' → ');
      for (const e of external) if (FORBIDDEN.test(e)) problems.push(`${name}: ${chain} imports '${e}'`);
      if (usesEnv) problems.push(`${name}: ${chain} uses process.*`);
      for (const l of local) walk(path.resolve(path.dirname(file), l.replace(/\.js$/, '.ts')), [...via, path.basename(file)]);
    };
    walk(path.join(LIB, name + '.ts'), []);
  }
  assert.deepEqual(problems, []);
});

// ADR 0007 §1: the core draws with the roles of the layout (LaidOutDiagram.roles), never with the global table, which holds
// the unscaled sizes — reading it there measures at the scaled size and draws at 1x again. Every file the core reaches is checked.
test('nothing the rendering core reaches imports the global ROLES table', () => {
  const offenders: string[] = [];
  const seen = new Set<string>();
  const walk = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = fs.readFileSync(file, 'utf8');
    if (path.basename(file) !== 'tokens.ts' && (/import\s*\{[^}]*\bROLES\b[^}]*\}\s*from\s*['"]\.\/tokens/.test(src) || /import\s*\*\s*as\s+\w+\s+from\s*['"]\.\/tokens/.test(src))) offenders.push(path.basename(file));
    for (const l of importsOf(file).local) walk(path.resolve(path.dirname(file), l.replace(/\.js$/, '.ts')));
  };
  for (const name of CORE) walk(path.join(LIB, name + '.ts'));
  assert.deepEqual(offenders, []);
});

// lib/dsl/: the builders (caption, box, row, charts, ...) are pure; only render.ts (the measured layout, the slide budget) and io.ts
// (build(), image(): fs / child_process / path) are shells. lib/dsl.ts stays the package entry point and just re-exports them all.
// The one declared exception is icon-registry.ts: box({icon}) / iconRow() / sequence() ... resolve an installed glyph through it, and
// it reads svg-diagram.icons.json from process.cwd() (the shell side of icons.ts). Its own imports are still walked.
test('lib/dsl builders reach no I/O (everything but render.ts and io.ts)', () => {
  const SHELLS = new Set(['render.ts', 'io.ts']);
  const problems: string[] = [];
  for (const name of fs.readdirSync(path.join(LIB, 'dsl')).filter(f => f.endsWith('.ts') && !SHELLS.has(f))) {
    const seen = new Set<string>();
    const walk = (file: string, via: string[]): void => {
      if (seen.has(file)) return;
      seen.add(file);
      const {local, external, usesEnv} = importsOf(file);
      const chain = [...via, path.basename(file)].join(' → ');
      const declared = path.basename(file) === 'icon-registry.ts';
      for (const e of external) if (!declared && FORBIDDEN.test(e)) problems.push(`dsl/${name}: ${chain} imports '${e}'`);
      if (usesEnv && !declared) problems.push(`dsl/${name}: ${chain} uses process.*`);
      for (const l of local) walk(path.resolve(path.dirname(file), l.replace(/\.js$/, '.ts')), [...via, path.basename(file)]);
    };
    walk(path.join(LIB, 'dsl', name), []);
  }
  assert.deepEqual(problems, []);
});

test('lib/dsl modules import each other without a cycle, and the builders never import render.ts or io.ts', () => {
  const dir = path.join(LIB, 'dsl');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));
  const graph = new Map(files.map(f => [f, importsOf(path.join(dir, f)).local.filter(l => l.startsWith('./')).map(l => path.basename(l))]));
  const cycles: string[] = [], state = new Map<string, number>();
  const visit = (n: string, via: string[]): void => {
    if (state.get(n) === 1) { cycles.push([...via, n].join(' → ')); return; }
    if (state.get(n) === 2) return;
    state.set(n, 1);
    for (const m of graph.get(n) ?? []) visit(m, [...via, n]);
    state.set(n, 2);
  };
  for (const f of files) visit(f, []);
  assert.deepEqual(cycles, []);
  const shellImports = files.filter(f => f !== 'render.ts' && f !== 'io.ts').flatMap(f => (graph.get(f) ?? []).filter(m => m === 'render.ts' || m === 'io.ts').map(m => `${f} → ${m}`));
  assert.deepEqual(shellImports, []);
});

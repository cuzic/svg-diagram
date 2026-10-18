// ADR 0031 §1 (after ADR 0007 §4): every lib file is the functional core unless it is listed in SHELL below, with its reason.
// A core file may not reach the filesystem, a process, the network, a browser or a font file, read the clock, a random source
// or the working directory, depend on the default locale, or keep module-level mutable state. It may not import a SHELL file
// either — except one declared `through: 'allow'`, whose own effects are accepted but whose imports are still walked.
// Type-only imports are erased and do not count. New files are checked without being registered anywhere.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {LIB, importsOf, libFiles, resolveLocal, violations} from './helpers/purity.ts';

interface Shell {reason: string; through?: 'allow'; declared?: true}
/** Where effects live. `declared`: kept for the context it runs in (not for an effect the check can see), so it is not tested for staleness. */
const SHELL: Record<string, Shell> = {
  // the effects themselves
  'browser': {reason: 'launches Chromium (playwright)'},
  'config': {reason: 'reads .svg-diagram.json from the working directory'},
  'deck-viewer': {reason: 'reads the viewer assets'},
  'dsl/io': {reason: 'build() / image(): fs and child_process'},
  'emoji-color': {reason: 'reads colour-emoji glyphs with harfbuzz'},
  'error-format': {reason: 'reads process.stderr for colour'},
  'export-and-check': {reason: 'the export / check CLI step: fs, child_process, os'},
  'font-metrics': {reason: 'reads font files (fs, child_process, harfbuzz)'},
  'font-subset': {reason: 'writes font subsets (fs)'},
  'freshness': {reason: 'hashes the source on disk; stage 5 of ADR 0031 splits the judgement out'},
  'icon-find': {reason: 'looks for icons from the working directory'},
  'icon-install': {reason: 'installs icon packs (fs, process)'},
  'icon-pack': {reason: 'fetches icon packs (fs, os, child_process)'},
  'icon-registry': {reason: 'resolves an installed glyph: reads svg-diagram.icons.json from process.cwd() and keeps the icon.use() setting', through: 'allow'},
  'image-file': {reason: 'reads images relative to the source directory'},
  'layout-measured': {reason: 'the measured layout: awaits the measurer'},
  'markdown-it': {reason: 'the markdown-it plugin: fs, child_process'},
  'markdown-target': {reason: 'resolves a figure source on disk (realpath, cwd); stage 5 separates resolveSource'},
  'math-tex': {reason: 'loads MathJax through node:module'},
  'measure': {reason: 'the measurer: the browser or the font files; its settings are process-wide (ADR 0031 stage 4)'},
  'pptx/emit': {reason: 'writes the PPTX: fs and resvg'},
  'pptx/zip': {reason: 'node:zlib'},
  'raster': {reason: 'rasterises with resvg / a browser (fs, os)'},
  'remark': {reason: 'the remark plugin: fs'},
  'render-source': {reason: 'loads a source file through node:module'},
  'render-sync-worker': {reason: 'the synchronous render worker: fs, process'},
  'slide-budget': {reason: 'asks a Slidev dev server (fs, net, child_process)'},
  'slide-index': {reason: 'reads slide files (fs)'},
  'source-deps': {reason: 'scans a source for its imports on disk (fs)'},
  'terminal': {reason: 'the terminal: tty, fs, process'},
  'today': {reason: 'the one place that reads the clock'},
  // shells because of what they import; each leaves with the stage that cuts the dependency
  'changed': {reason: 'imports source-deps'},
  'contact': {reason: 'imports raster'},
  'deck-html': {reason: 'imports markdown-target'},
  'dsl': {reason: 'the package entry point: re-exports dsl/io'},
  'dsl/render': {reason: 'the measured render: imports layout-measured'},
  'emit-html': {reason: 'measures glyph ascent through font-metrics (ADR 0031 stage 4 bakes it into LaidOutDiagram.fontBox)'},
  'load-source': {reason: 'imports image-file'},
  'markdown': {reason: 'imports render-source (ADR 0031 stage 5 splits the scanner out)'},
  'pipeline': {reason: 'imports emit-html (leaves with it, stage 4)'},
  'svg-geom': {reason: 'measures text through font-metrics (ADR 0031 stage 5 passes it in)'},
  'svg-lint': {reason: 'imports svg-geom (leaves with it, stage 5)'},
  'vitepress': {reason: 'imports markdown-it'},
  // kept for the context it runs in
  'resolve-hook': {reason: 'a Node module-loader hook: runs in the loader thread', declared: true},
};

/** Core files that break a rule today, and the stage of ADR 0031 that removes each. An entry that no longer matches fails the test. */
const KNOWN: {file: string; rule: string; removedIn: number}[] = [
  {file: 'wrap', rule: 'top-level let', removedIn: 3}, {file: 'wrap', rule: 'top-level let', removedIn: 3},
  {file: 'dsl/text-bands', rule: 'top-level let', removedIn: 5},
  {file: 'fta-analysis', rule: 'localeCompare without a locale', removedIn: 6},
  {file: 'qc', rule: 'localeCompare without a locale', removedIn: 6},
  {file: 'wordart-vertical', rule: 'depends on the default locale', removedIn: 6},
];

/** State that is kept on purpose: a cache keyed by its whole input, or a marker keyed by object identity. */
const CACHES: {file: string; rule: string; why: string}[] = [
  {file: 'tokens', rule: 'top-level mutable Map', why: 'MAPS: the dark colour table per appearance, keyed by the whole appearance'},
  {file: 'tokens', rule: 'top-level mutable WeakMap', why: 'ENVS: the resolved tone overrides, keyed by the overrides object'},
  {file: 'toc', rule: 'top-level mutable WeakSet', why: 'movedAside: marks route arrays already moved, keyed by identity'},
  {file: 'dsl/wireframe-numbering', rule: 'top-level mutable WeakSet', why: 'SHELLED: marks bands already numbered, keyed by identity'},
];

const files = libFiles();
const fileOf = (name: string): string => path.join(LIB, name + '.ts');
const shellDeny = (name: string): boolean => SHELL[name] !== undefined && SHELL[name].through !== 'allow';

test('every SHELL entry names a file that exists and still has a reason to be a shell', () => {
  const problems: string[] = [];
  for (const [name, s] of Object.entries(SHELL)) {
    if (!files.includes(name)) { problems.push(`${name}: no such file in lib/`); continue; }
    if (s.declared) continue;
    const direct = violations(fileOf(name)).some(v => v.startsWith('imports ') || v === 'uses process');
    const viaShell = importsOf(fileOf(name)).local.some(l => shellDeny(resolveLocal(name, l)));
    if (!direct && !viaShell) problems.push(`${name}: touches no effect and imports no shell — take it out of SHELL`);
  }
  assert.deepEqual(problems, []);
});

test('the rendering core reaches no I/O and holds no module-level state (everything not in SHELL)', () => {
  const left = [...KNOWN.map(k => ({file: k.file, rule: k.rule})), ...CACHES.map(c => ({file: c.file, rule: c.rule}))];
  const problems: string[] = [];
  for (const name of files) {
    if (SHELL[name]) continue;
    for (const v of violations(fileOf(name))) {
      const i = left.findIndex(k => k.file === name && k.rule === v);
      if (i >= 0) left.splice(i, 1); else problems.push(`${name}: ${v}`);
    }
    for (const l of importsOf(fileOf(name)).local) if (shellDeny(resolveLocal(name, l))) problems.push(`${name}: imports the shell file ${resolveLocal(name, l)}`);
  }
  for (const k of left) problems.push(`${k.file}: "${k.rule}" is listed as known / kept but no longer occurs — take it out`);
  assert.deepEqual(problems, []);
});

// ADR 0007 §1: the core draws with the roles of the layout (LaidOutDiagram.roles), never with the global table, which holds
// the unscaled sizes — reading it there measures at the scaled size and draws at 1x again.
// Builders run before the layout and read the unscaled table on purpose. charts-lines.ts:136 is one that should not: the label lift of a
// target line is computed from the 1x size, so in a fill figure (fonts scaled up) the label sits a little close to its line — a finding of
// this check, left for its own change.
const ROLES_AT_BUILD = ['dsl/text-bands', 'charts-lines'];
test('nothing the rendering core reaches imports the global ROLES table', () => {
  const importsRoles = (name: string): boolean => {
    const src = fs.readFileSync(fileOf(name), 'utf8');
    return /import\s*\{[^}]*\bROLES\b[^}]*\}\s*from\s*['"]\.\.?\/tokens/.test(src) || /import\s*\*\s*as\s+\w+\s+from\s*['"]\.\.?\/tokens/.test(src);
  };
  const offenders = files.filter(name => !SHELL[name] && name !== 'tokens' && !ROLES_AT_BUILD.includes(name) && importsRoles(name));
  const stale = ROLES_AT_BUILD.filter(name => !importsRoles(name));
  assert.deepEqual({offenders, stale}, {offenders: [], stale: []});
});

test('lib/dsl modules import each other without a cycle, and the builders never import render.ts or io.ts', () => {
  const dir = path.join(LIB, 'dsl');
  const dsl = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));
  const graph = new Map(dsl.map(f => [f, importsOf(path.join(dir, f)).local.filter(l => l.startsWith('./')).map(l => path.basename(l))]));
  const cycles: string[] = [], state = new Map<string, number>();
  const visit = (n: string, via: string[]): void => {
    if (state.get(n) === 1) { cycles.push([...via, n].join(' → ')); return; }
    if (state.get(n) === 2) return;
    state.set(n, 1);
    for (const m of graph.get(n) ?? []) visit(m, [...via, n]);
    state.set(n, 2);
  };
  for (const f of dsl) visit(f, []);
  assert.deepEqual(cycles, []);
  const shellImports = dsl.filter(f => f !== 'render.ts' && f !== 'io.ts').flatMap(f => (graph.get(f) ?? []).filter(m => m === 'render.ts' || m === 'io.ts').map(m => `${f} → ${m}`));
  assert.deepEqual(shellImports, []);
});

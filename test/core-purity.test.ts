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
import {SHELL} from './helpers/shell.ts';

/** Core files that break a rule today, and the stage of ADR 0031 that removes each. An entry that no longer matches fails the test. */
const KNOWN: {file: string; rule: string; removedIn: number}[] = [
  {file: 'dsl/text-bands', rule: 'top-level let', removedIn: 7}, // boxSizeWarned: box({size}) warns once per process. Needs a decision (a lint rule, or the throw the message announces); not a refactor
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

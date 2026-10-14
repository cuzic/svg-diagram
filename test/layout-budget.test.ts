// node --test test/   — the layout-* findings of every example may not grow (ADR 0014 "図の回帰").
// The numbers are the measured counts at the time they were fixed; a generator change that lowers one should lower it here too
// (an example missing from the table has a budget of 0 for every rule). More is a regression; fewer fails too, so the table is lowered with the fix.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const BUDGET: Record<string, Record<string, number>> = {
  'bracket-callout': {'layout-sibling-size': 1},
  'canvas-bmc': {'layout-sibling-size': 1, 'layout-unused-space': 3},
  'canvas-empathy': {'layout-unused-space': 7},
  'canvas-five-forces': {'layout-unused-space': 5},
  'canvas-seven-s': {'layout-unused-space': 7},
  'canvas-swot': {'layout-unused-space': 3},
  'canvas-vpc': {'layout-unused-space': 4},
  'chevron-vertical': {'layout-figure-narrow': 1},
  'cloud-architecture': {'layout-sibling-size': 1},
  'column-grid': {'layout-sibling-size': 2},
  'dark-theme': {'layout-sibling-size': 1},
  'emphasis': {'layout-sibling-size': 2},
  'emphasis-tiers': {'layout-sibling-size': 2},
  'facet': {'layout-sibling-size': 3},
  'hero': {'layout-unused-space': 3},
  'icons': {'layout-sibling-size': 7},
  'math-formula': {'layout-figure-offset': 1},
  'people': {'layout-figure-narrow': 1},
  'qc-affinity': {'layout-sibling-size': 1},
  'quadrant-ge': {'layout-gutter-uneven': 3},
  'quadrant-risk': {'layout-sibling-size': 3, 'layout-gutter-uneven': 3},
  'reveal': {'layout-sibling-size': 1},
  'reveal-replace': {'layout-sibling-size': 1},
  'spotlight': {'layout-sibling-size': 1},
  'spotlight-between': {'layout-sibling-size': 1},
  'stat': {'layout-sibling-size': 1},
  'steps': {'layout-sibling-size': 1},
  'versus': {'layout-sibling-size': 1},
  'versus-manual': {'layout-sibling-size': 1},
};

test('layout-* findings per example stay within their budget', () => {
  const root = path.resolve(import.meta.dirname, '..');
  const r = spawnSync(process.execPath, ['--import', './test/helpers/strict-width.ts', 'check-diagram.ts', '--format', 'json', ...fs.readdirSync(path.join(root, 'examples')).filter(f => f.endsWith('.ts')).sort().map(f => path.join('examples', f))], {encoding: 'utf8', cwd: root, maxBuffer: 64 * 1024 * 1024});
  const found: Record<string, Record<string, number>> = {};
  for (const f of JSON.parse(r.stdout).findings as {file: string; rule: string}[]) {
    if (!f.rule.startsWith('layout-')) continue;
    const name = path.basename(f.file, '.ts');
    found[name] ??= {};
    found[name][f.rule] = (found[name][f.rule] ?? 0) + 1;
  }
  const off: string[] = [];
  for (const name of new Set([...Object.keys(found), ...Object.keys(BUDGET)])) for (const rule of new Set([...Object.keys(found[name] ?? {}), ...Object.keys(BUDGET[name] ?? {})])) {
    const n = found[name]?.[rule] ?? 0, max = BUDGET[name]?.[rule] ?? 0;
    if (n !== max) off.push(`${name}: ${rule} ${n} (budget ${max})${n < max ? ' - improved: lower the budget' : ''}`);
  }
  assert.deepEqual(off, []);
});

// node --test test/   — the layout-* findings of every example may not grow (ADR 0014 "図の回帰").
// The numbers are the measured counts at the time they were fixed; a generator change that lowers one should lower it here too
// (an example missing from the table has a budget of 0 for every rule). Raising a number needs a reason in the PR.
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
  'cloud-architecture': {'layout-edge-misalign': 1},
  'emphasis-tiers': {'layout-sibling-size': 2},
  'facet': {'layout-sibling-size': 1},
  'hero': {'layout-unused-space': 3, 'layout-align-mixed': 1},
  'icons': {'layout-sibling-size': 6},
  'image-backdrop': {'layout-unused-space': 1},
  'math-formula': {'layout-figure-offset': 1},
  'people': {'layout-figure-narrow': 1},
  'qc-affinity': {'layout-gutter-uneven': 1},
  'spotlight': {'layout-sibling-size': 1},
  'spotlight-between': {'layout-sibling-size': 1},
  'wordart': {'layout-figure-narrow': 1},
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
  const over: string[] = [];
  for (const [name, rules] of Object.entries(found)) for (const [rule, n] of Object.entries(rules)) {
    const max = BUDGET[name]?.[rule] ?? 0;
    if (n > max) over.push(`${name}: ${rule} ${n} > ${max}`);
  }
  assert.deepEqual(over, []);
});

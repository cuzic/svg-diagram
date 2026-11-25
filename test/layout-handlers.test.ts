import {readFileSync} from 'node:fs';
import type {ChartKind} from '../lib/charts-base.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FULL_DEFINITIONS, UNDEFINED_BANDS} from '../lib/full-definitions.ts';

const chartKinds = {
  waterfall: true, tornado: true, heatmap: true, stacked: true, radar: true, treemap: true,
  sankey: true, catplot: true, distplot: true, multiplot: true, regplot: true, clustermap: true,
  bubble: true, butterfly: true, combo: true, harvey: true, compare: true, pert: true,
  causal: true, dependency: true,
} satisfies Record<ChartKind, true>;

test('the tree-shaking checklist lists every band and chart kind once', () => {
  const checklist = readFileSync(new URL('../docs/tree-shaking-checklist.md', import.meta.url), 'utf8');
  const bandSections = checklist.slice(checklist.indexOf('## 共通・接続'), checklist.indexOf('## 合成・入出力'));
  const entries = [...bandSections.matchAll(/^( {0,2})- \[[ x]\] `([^`]+)`/gm)];
  const namesAt = (indent: string) => entries.filter(match => match[1] === indent).map(match => match[2]).sort();

  assert.deepEqual(namesAt(''), [...Object.keys(FULL_DEFINITIONS), ...Object.keys(UNDEFINED_BANDS)].sort(), 'band checklist rows');
  assert.deepEqual(namesAt('  '), Object.keys(chartKinds).sort(), 'chart kind checklist rows');
});

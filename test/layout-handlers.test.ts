import {readFileSync} from 'node:fs';
import type {ChartKind} from '../lib/charts-base.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ALL_BANDS_HANDLED, LAYOUT_HANDLERS} from '../lib/layout-handlers.ts';

// The compile-time half is UnhandledBandTypes (tsc fails when a Band type has no handler); this is the run-time half.
test('every band type has a layout handler', () => {
  assert.equal(ALL_BANDS_HANDLED, true);
  for (const [type, handler] of Object.entries(LAYOUT_HANDLERS)) assert.equal(typeof handler, 'function', type);
  for (const type of ['caption', 'box', 'banner', 'row', 'grid', 'group', 'swimlane', 'connect', 'spacer']) assert.ok(type in LAYOUT_HANDLERS, type);
});

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

  assert.deepEqual(namesAt(''), Object.keys(LAYOUT_HANDLERS).sort(), 'band checklist rows');
  assert.deepEqual(namesAt('  '), Object.keys(chartKinds).sort(), 'chart kind checklist rows');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {box, caption, checkDiagram, closeMeasurer, diagram, row} from '../lib/dsl.ts';
import {loadDiagram} from '../lib/load-source.ts';
import {installResolveHook} from '../lib/resolve-hook.ts';
import {at, fromSources} from '../lib/finding-rules.ts';
import {mergeFindingSides} from '../lib/appearance-auto.ts';
import {captureSourceLocations, sourceOf, SourceRef, withSource} from '../lib/source-ref.ts';
import type {Diagram, LintTarget, RuleId} from '../lib/types/index.ts';
import {ruleLocationFixtures} from './fixtures/rule-locations.ts';
import * as rules from '../lib/rules.ts';

test('every documented rule declares its location scope', () => {
  assert.deepEqual(Object.keys(rules.RULE_LOCATION ?? {}).sort(), Object.keys(rules.RULE_DOCS).sort());
});

test('lint findings keep their messages, severities and order without capture', () => {
  const headline = '見出し'.repeat(16);
  const d = diagram({theme: 'blue', medium: 'doc', appearance: 'auto', legend: false,
    accept: {'box-size-ignored': '既存の設定'}}).add(
    caption(headline, {role: 'title'}),
    caption(headline, {role: 'title'}),
    row([box({title: 'A', size: 24}), box({title: 'B'})]));
  assert.deepEqual(rules.lintDiagram(d), [
    {rule: 'box-size-ignored', severity: 'info', message: "box({size}) は効果がない(1 個の箱)。大きい文字は役割を使う: stat() / stat({size: 'display'})・caption({role: 'display'})・banner({headlineRole})・bars / plane({labelRole})。次の版で throw する（許容: 既存の設定）"},
    {rule: 'cjk-line-long', severity: 'warn', message: '見出しの 1 行が全角 48 字ぶんで、40 字の目安（title。本文幅 600px に収まる字数）を超える: 「見出し見出し見出し見出し見出し見…」。短くするか、改行して分ける'},
  ]);
});

test('at and fromSources keep the first distinct source and its related parts', () => {
  const first = new SourceRef(), second = new SourceRef();
  assert.deepEqual(at({}), {});
  assert.deepEqual(at({}, withSource({}, first), withSource({}, second), withSource({}, first)), {loc: first, related: [second]});
  assert.deepEqual(fromSources([undefined, first, first]), {loc: first});
});

test('mergeFindingSides merges the same location and keeps a distinct dark-only location', () => {
  const a = new SourceRef(), b = new SourceRef();
  const finding = {rule: 'a11y-text-contrast', severity: 'warn' as const, message: '同じ文言'};
  assert.deepEqual(mergeFindingSides([{...finding, loc: a}], [{...finding, loc: a}, {...finding, loc: b}]), [
    {...finding, loc: a}, {...finding, loc: b, message: '同じ文言 (暗い配色)'},
  ]);
  assert.deepEqual(mergeFindingSides([finding], [finding, finding]), [finding]);
});

test('rule location coverage uses the marked part or diagram', async t => {
  installResolveHook();
  captureSourceLocations(true);
  t.after(() => { captureSourceLocations(false); closeMeasurer(); });

  const examples: Record<string, RuleId[]> = {
    'areas-trace': ['layout-unused-space', 'graph-disconnected'],
    bowtie: ['auto-fit-applied'],
    'bracket-callout': ['layout-sibling-size'],
    'chart-multi': ['aspect-tall'],
    'chevron-vertical': ['layout-figure-narrow'],
    'column-grid': ['connect-label-covers-arrow', 'gray-tone-collision', 'graph-orphan-node'],
    'drama-triangle': ['arrow-labels'],
    'emblem-flow-symbols': ['title-duplicated'],
    emphasis: ['legend-missing'],
    fta: ['fta-undeveloped-left', 'fta-single-point'],
    'math-formula': ['layout-figure-offset'],
    'service-blueprint': ['swimlane-hand-offs'],
    stat: ['stat-fit-shrunk'],
    'toc-compact': ['toc-legend-suggested', 'toc-ude-count', 'toc-role-indistinct'],
    'toc-hop-all': ['edge-parallel'],
  };
  const covered = new Set<RuleId>();
  function check(input: LintTarget, expected: RuleId[]): void {
    const figure = sourceOf(input);
    assert.ok(figure, 'diagram() captured a position');
    const parts = new Set<SourceRef>();
    const walk = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      const ref = sourceOf(value);
      if (ref && ref !== figure) parts.add(ref);
      for (const child of Object.values(value)) walk(child);
    };
    walk(input.bands);
    walk(input.laidOut);
    walk(input.connects);
    const findings = rules.lintDiagram(input);
    for (const id of expected) {
      const hits = findings.filter(f => f.rule === id);
      assert.ok(hits.length > 0, `${id} did not fire; got ${findings.map(f => f.rule).join(', ')}`);
      for (const f of hits) {
        if (rules.RULE_LOCATION[id] === 'diagram') assert.equal(f.loc, figure, id);
        else assert.ok(f.loc && parts.has(f.loc), `${id} must point to a marked part`);
      }
      covered.add(id);
    }
  }

  for (const [file, ids] of Object.entries(examples)) {
    await t.test(file, async () => {
      const source = new URL(`../examples/${file}.ts`, import.meta.url);
      const {laidOut} = await checkDiagram(await loadDiagram(fileURLToPath(source)));
      check(laidOut, ids);
    });
  }
  for (const {input, rules: ids, layout} of ruleLocationFixtures()) {
    await t.test(ids.join(', '), async () => {
      check(layout ? (await checkDiagram(input as Diagram)).laidOut : input, ids);
    });
  }
  assert.deepEqual(Object.keys(rules.RULE_DOCS).filter(id => !covered.has(id as RuleId)).sort(), Object.keys(OUTSIDE_FIGURE).sort());
});

// Document rules report Markdown lines via --docs and do not run through lintDiagram.
const DOC_LOCATION = 'Markdown location from --docs; no diagram() call';
const OUTSIDE_FIGURE = {
  'doc-image-missing': DOC_LOCATION,
  'doc-alt-empty': DOC_LOCATION,
  'doc-alt-long': DOC_LOCATION,
  'doc-notes-missing': DOC_LOCATION,
  'doc-notes-mismatch': DOC_LOCATION,
  'doc-png-has-svg': DOC_LOCATION,
  'doc-png-no-source': DOC_LOCATION,
  'doc-orphan-png': DOC_LOCATION,
  'doc-svg-no-source': DOC_LOCATION,
  'doc-orphan-svg': DOC_LOCATION,
} satisfies Partial<Record<RuleId, string>>;

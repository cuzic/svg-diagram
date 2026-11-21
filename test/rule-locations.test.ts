import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {areas, box, caption, checkDiagram, closeMeasurer, connect, diagram, grid, legend, row, stat} from '../lib/dsl.ts';
import {loadDiagram} from '../lib/load-source.ts';
import {installResolveHook} from '../lib/resolve-hook.ts';
import {at, fromSources} from '../lib/finding-rules.ts';
import {captureSourceLocations, sourceOf, SourceRef, withSource} from '../lib/source-ref.ts';
import type {Diagram, LintTarget, RuleId} from '../lib/types/index.ts';
import {ruleLocationFixtures} from './fixtures/rule-locations.ts';
import {lintDiagram, mergeFindingSides, RULE_DOCS, RULE_LOCATION} from '../lib/rules.ts';

test('every documented rule declares its location scope', () => {
  assert.deepEqual(Object.keys(EXPECTED_SCOPE).sort(), Object.keys(RULE_DOCS).sort());
  assert.deepEqual(RULE_LOCATION, EXPECTED_SCOPE);
});

test('lint findings keep their messages, severities and order without capture', () => {
  const headline = '見出し'.repeat(16);
  const d = diagram({theme: 'blue', medium: 'doc', appearance: 'auto', legend: false,
    accept: {'box-size-ignored': '既存の設定'}}).add(
    caption(headline, {role: 'title'}),
    caption(headline, {role: 'title'}),
    row([box({title: 'A', size: 24}), box({title: 'B'})]));
  assert.deepEqual(lintDiagram(d), [
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
  const finding = {rule: 'cjk-line-long', severity: 'warn' as const, message: '同じ文言'};
  assert.deepEqual(mergeFindingSides([{...finding, loc: a}], [{...finding, loc: a}, {...finding, loc: b}]), [
    {...finding, loc: a}, {...finding, loc: b, message: '同じ文言 (暗い配色)'},
  ]);
  assert.deepEqual(mergeFindingSides([finding], [finding, finding]), [finding]);
});

test('auto appearance merges grouped findings with the same wording across locations', () => {
  const a = new SourceRef(), b = new SourceRef(), c = new SourceRef();
  const finding = {rule: 'a11y-text-contrast', severity: 'warn' as const, message: '同じ文言'};
  const light = {...finding, loc: a, related: [b]};
  assert.deepEqual(mergeFindingSides([light], [{...finding, loc: a, related: [c]}]), [light]);
  assert.deepEqual(mergeFindingSides([], [light, {...finding, loc: b}]), [{...light, message: '同じ文言 (暗い配色)'}]);
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
  function check(input: LintTarget, expected: RuleId[], expectedPart?: SourceRef): void {
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
    const findings = lintDiagram(input);
    for (const id of expected) {
      const hits = findings.filter(f => f.rule === id);
      assert.ok(hits.length > 0, `${id} did not fire; got ${findings.map(f => f.rule).join(', ')}`);
      for (const f of hits) {
        if (EXPECTED_SCOPE[id] === 'diagram') assert.equal(f.loc, figure, id);
        else if (expectedPart) assert.equal(f.loc, expectedPart, `${id} must point to the inner box`);
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
  for (const kind of ['row', 'grid', 'areas'] as const) {
    await t.test(`${kind} findings point to the inner box`, async () => {
      const first = box({title: 'First', tone: 'accent', align: 'left'});
      const second = box({title: 'Second', align: 'center'});
      const container = kind === 'row' ? row([first, second])
        : kind === 'grid' ? grid([first, second], {cols: 2})
        : areas('a b', {a: first, b: box({title: 'Second', body: '本文\n'.repeat(8)})});
      const input = diagram({theme: 'blue', legend: false, tones: {accent: {fill: '#808080'}}}).add(container);
      const {laidOut} = await checkDiagram(input);
      const inner = sourceOf(first);
      assert.ok(inner);
      assert.notEqual(inner, sourceOf(container));
      check(laidOut, ['a11y-text-contrast', kind === 'areas' ? 'layout-unused-space' : 'layout-align-mixed'], inner);
    });
  }
  assert.deepEqual(Object.keys(RULE_DOCS).filter(id => !covered.has(id as RuleId)).sort(), Object.keys(OUTSIDE_FIGURE).sort());
});

test('an unmarked band finding falls back to diagram()', t => {
  const unmarked = stat(10, '件');
  assert.equal(sourceOf(unmarked), undefined);
  captureSourceLocations(true);
  t.after(() => captureSourceLocations(false));
  const d = diagram({theme: 'blue', evidenceCheck: 'info'});
  const hit = lintDiagram({...d, bands: [unmarked]}).find(f => f.rule === 'stat-no-source');
  assert.ok(hit);
  assert.ok(sourceOf(d));
  assert.equal(hit.loc, sourceOf(d));
});

test('legend-incomplete points to the parts using missing notation', t => {
  captureSourceLocations(true);
  t.after(() => captureSourceLocations(false));
  const first = box({title: '新規 A', tone: 'new'});
  const second = box({title: '新規 B', tone: 'new'});
  const covered = box({title: '注意', tone: 'danger'});
  const key = legend([{tone: 'danger', label: '注意'}]);
  const d = diagram({theme: 'blue'}).add(key, covered, row([first, second]));
  const hits = lintDiagram(d).filter(f => f.rule === 'legend-incomplete');
  assert.equal(hits.length, 1);
  assert.equal(hits[0]?.loc, sourceOf(first));
  assert.deepEqual(hits[0]?.related, [sourceOf(second)]);
});

test('graph-disconnected points to the nodes outside the largest component', async t => {
  captureSourceLocations(true);
  t.after(() => { captureSourceLocations(false); closeMeasurer(); });
  const fourth = box({id: 'd', title: 'D'});
  const fifth = box({id: 'e', title: 'E'});
  const d = diagram({theme: 'blue'}).add(
    row([box({id: 'a', title: 'A'}), box({id: 'b', title: 'B'}), box({id: 'c', title: 'C'})]),
    row([fourth, fifth]),
    connect('a:right', 'b:left'), connect('b:right', 'c:left'), connect('d:right', 'e:left'));
  const {laidOut} = await checkDiagram(d);
  const hits = lintDiagram(laidOut).filter(f => f.rule === 'graph-disconnected');
  assert.equal(hits.length, 1);
  assert.equal(hits[0]?.loc, sourceOf(fourth));
  assert.deepEqual(hits[0]?.related, [sourceOf(fifth)]);
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

// This table pins the location contract independently of the rule producers.
const EXPECTED_SCOPE = {
  'a11y-text-contrast': 'band-grouped',
  'a11y-color-only-emphasis': 'band-grouped',
  'a11y-nontext-contrast': 'band-grouped',
  'title-duplicated': 'band',
  'a11y-no-title': 'diagram',
  'bars-values-hidden': 'diagram',
  'bars-thin-bar': 'band',
  'image-large': 'band',
  'cjk-line-long': 'band',
  'draft-status': 'diagram',
  'source-wraps': 'diagram',
  'legend-missing': 'diagram',
  'legend-incomplete': 'band-grouped',
  'swimlane-lane-order': 'band',
  'text-mid-word-break': 'band-grouped',
  'glyph-missing': 'band-grouped',
  'connect-label-covers-arrow': 'band-grouped',
  'chart-axis-mismatch': 'band-grouped',
  'wrap-fell-back': 'diagram',
  'shrink-narrow-text': 'band',
  'gray-tone-collision': 'band-grouped',
  'rowheader-tone-collides': 'band',
  'semantic-table-warning': 'band',
  'swimlane-lanes': 'band',
  'swimlane-hand-offs': 'band',
  'edge-crossings': 'band-grouped',
  'edge-bends': 'band',
  'edge-parallel': 'band',
  'quadrant-item-moved': 'band',
  'quadrant-size-floor': 'band',
  'quadrant-empty-cell': 'band',
  'quadrant-tone-only': 'band',
  'funnel-values-rise': 'band',
  'toc-ude-count': 'band',
  'toc-no-desired-result': 'band',
  'toc-parts': 'band',
  'toc-nbr-parts': 'band',
  'toc-nbr-no-tipping': 'band',
  'toc-nbr-tipping-not-and': 'band',
  'toc-nbr-trim-too-late': 'band',
  'toc-tt-unit': 'band',
  'toc-prt-bottom-not-action': 'band',
  'toc-prt-one-to-one': 'band',
  'toc-obstacle-phrase': 'band',
  'toc-injection-to-obstacle': 'band',
  'toc-role-indistinct': 'band',
  'toc-legend-suggested': 'diagram',
  'toc-mirror': 'band',
  'fta-gate-one-input': 'band',
  'fta-vote-degenerate': 'band',
  'fta-top-is-leaf': 'band',
  'fta-undeveloped-left': 'band',
  'isisnot-no-isnot': 'band',
  'isisnot-no-distinct-at-all': 'band',
  'isisnot-no-hypothesis-stands': 'band',
  'whywhy-no-root': 'band',
  'whywhy-measure-without-root': 'band',
  'whywhy-single-chain': 'band',
  'whywhy-dig-below-root': 'band',
  'bowtie-barrier-missing': 'band',
  'fta-single-point': 'band',
  'toc-source-has-cause': 'band',
  'toc-chain-only': 'band',
  'toc-orphan': 'band',
  'toc-cycle-undeclared': 'band',
  'graph-orphan-node': 'band-grouped',
  'graph-disconnected': 'band-grouped',
  'term-variant': 'band-grouped',
  'term-avoid': 'band-grouped',
  'table-sum-mismatch': 'band',
  'table-share-not-100': 'band',
  'arrow-labels': 'diagram',
  'canvas-region-empty': 'band',
  'one-story': 'diagram',
  'slide-min-text': 'diagram',
  'font-floor-lowered': 'diagram',
  'box-size-ignored': 'band-grouped',
  'stat-no-source': 'band',
  'stat-fit-shrunk': 'band',
  'slide-canvas-overflow': 'diagram',
  'aspect-tall': 'diagram',
  'doc-width': 'diagram',
  'flowchart-decision-edges': 'band',
  'auto-fit-applied': 'band',
  'cause-line-scale-dropped': 'band-grouped',
  'density-compact-restored': 'band-grouped',
  'density': 'diagram',
  'concentric-label-crossing': 'band',
  'wf-callout-no-note': 'band',
  'wf-note-no-callout': 'band',
  'wf-callout-gap': 'band',
  'wf-callout-duplicate': 'band',
  'wf-states-todo': 'band',
  'wf-states-required': 'band',
  'wf-states-ragged': 'band',
  'wf-callout-order': 'band',
  'layout-sibling-size': 'band',
  'layout-edge-misalign': 'band',
  'layout-gutter-uneven': 'band',
  'layout-unused-space': 'band',
  'layout-figure-offset': 'diagram',
  'layout-figure-narrow': 'diagram',
  'layout-align-mixed': 'band',
  'doc-image-missing': 'diagram',
  'doc-alt-empty': 'diagram',
  'doc-alt-long': 'diagram',
  'doc-notes-missing': 'diagram',
  'doc-notes-mismatch': 'diagram',
  'doc-png-has-svg': 'diagram',
  'doc-png-no-source': 'diagram',
  'doc-orphan-png': 'diagram',
  'doc-svg-no-source': 'diagram',
  'doc-orphan-svg': 'diagram',
} satisfies Record<RuleId, 'band' | 'band-grouped' | 'diagram'>;

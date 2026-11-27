import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {areas, box, caption, checkDiagram, closeMeasurer, connect, diagram, grid, legend, row, stat} from '../lib/dsl.ts';
import {loadDiagram} from '../lib/load-source.ts';
import {installResolveHook} from '../lib/resolve-hook.ts';
import {at, findingAcceptanceHint, fromSources} from '../lib/finding-rules.ts';
import {captureSourceLocations, markSpecPart, sourceOf, SourceRef, withSource} from '../lib/source-ref.ts';
import type {Finding, LintTarget, RuleId} from '../lib/types/index.ts';
import {ruleLocationFixtures} from './fixtures/rule-locations.ts';
import {RULE_DOCS, RULE_LOCATION} from '../lib/rules.ts';

test('findingAcceptanceHint uses the same rule in both configuration forms', () => {
  const hint = findingAcceptanceHint('rowheader-tone-collides');
  assert.ok(hint.includes("diagram({accept: {'rowheader-tone-collides': '理由'}})"));
  assert.ok(hint.includes('{"accept": {"rowheader-tone-collides": "理由"}}'));
  assert.ok(hint.includes('check --explain rowheader-tone-collides'));
});

test('markSpecPart shares a path while keeping distinct builder call sites', () => {
  const stack = {stack: 'builder'};
  const first = withSource({}, new SourceRef(stack));
  const sameCall = withSource({}, new SourceRef(stack));
  const noStack = {};
  markSpecPart([first, sameCall, noStack], 'parts[2]');
  assert.equal(sourceOf(first)?.specPath, 'parts[2]');
  assert.equal(sourceOf(first)?.stackHolder, stack);
  assert.equal(sourceOf(sameCall), sourceOf(first));
  assert.equal(sourceOf(noStack)?.specPath, 'parts[2]');
  assert.notEqual(sourceOf(noStack), sourceOf(first));
});

test('every documented rule declares its location scope', () => {
  assert.deepEqual(Object.keys(EXPECTED_SCOPE).sort(), Object.keys(RULE_DOCS).sort());
  assert.deepEqual(RULE_LOCATION, EXPECTED_SCOPE);
});

test('check findings keep their messages and severities without capture', async () => {
  const headline = '見出し'.repeat(16);
  const d = diagram({theme: 'blue', medium: 'doc', appearance: 'auto', legend: false,
    accept: {'box-size-ignored': '既存の設定'}}).add(
    caption(headline, {role: 'title'}),
    caption(headline, {role: 'title'}),
    row([box({title: 'A', size: 24}), box({title: 'B'})]));
  const {verdict} = await checkDiagram(d);
  const expected = [
    {rule: 'box-size-ignored', severity: 'info', message: "box({size}) は効果がない(1 個の箱)。大きい文字は役割を使う: stat() / stat({size: 'display'})・caption({role: 'display'})・banner({headlineRole})・bars / plane({labelRole})。次の版で throw する（許容: 既存の設定）"},
    {rule: 'cjk-line-long', severity: 'warn', message: '見出しの 1 行が全角 48 字ぶんで、40 字の目安（title。本文幅 600px に収まる字数）を超える: 「見出し見出し見出し見出し見出し見…」。短くするか、改行して分ける'},
  ];
  for (const finding of expected) assert.deepEqual(verdict.findings.find(f => f.rule === finding.rule), finding);
});

test('arrow contrast locates only arrows of the first failing colour', async t => {
  t.after(() => { captureSourceLocations(false); closeMeasurer(); });

  async function checkArrows() {
    const first = connect('a:right', 'b:left', {tone: 'muted'});
    const sameColour = connect('c:right', 'd:left', {tone: 'muted'});
    const d = diagram({theme: 'blue', legend: false, tones: {muted: {ink: '#c8c8c8'}, danger: {ink: '#d0d0d0'}}}).add(
      row([box({id: 'a', title: 'A'}), box({id: 'b', title: 'B'}), box({id: 'c', title: 'C'}), box({id: 'd', title: 'D'}), box({id: 'e', title: 'E'})]),
      first, connect('b:right', 'c:left', {tone: 'danger'}), sameColour, connect('d:right', 'e:left', {tone: 'danger'}));
    const {verdict} = await checkDiagram(d);
    const hits = verdict.findings.filter(f => f.rule === 'a11y-nontext-contrast');
    return {first, sameColour, hits};
  }

  // main (bda4684) reports this single finding for the same diagram.
  const expected = [{rule: 'a11y-nontext-contrast', severity: 'warn', message: '矢印の色 #c8c8c8 のコントラスト比が 1.7:1'}];
  assert.deepEqual((await checkArrows()).hits, expected);

  captureSourceLocations(true);
  const {first, sameColour, hits} = await checkArrows();
  assert.deepEqual(hits.map(({loc, related, ...finding}) => finding), expected);
  const [hit] = hits;
  assert.ok(hit?.loc);
  assert.equal(hit.loc, sourceOf(first));
  assert.equal(hit.related?.length, 1);
  assert.equal(hit.related?.[0], sourceOf(sameColour));
});

test('at and fromSources keep the first distinct source and its related parts', () => {
  const first = new SourceRef(), second = new SourceRef();
  assert.deepEqual(at({}), {});
  assert.deepEqual(at({}, withSource({}, first), withSource({}, second), withSource({}, first)), {loc: first, related: [second]});
  assert.deepEqual(fromSources([undefined, first, first]), {loc: first});
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
  function check(input: LintTarget, findings: Finding[], expected: RuleId[], expectedPart?: SourceRef): void {
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
      const {laidOut, verdict} = await checkDiagram(await loadDiagram(fileURLToPath(source)));
      check(laidOut, verdict.findings, ids);
    });
  }
  for (const {input, rules: ids, findings} of ruleLocationFixtures()) {
    await t.test(ids.join(', '), async () => {
      if (findings) {
        check(input, findings(input).map(finding => finding.loc ? finding : {...finding, ...at(input)}), ids);
      } else {
        const {laidOut, verdict} = await checkDiagram(input);
        check(laidOut, verdict.findings, ids);
      }
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
      const {laidOut, verdict} = await checkDiagram(input);
      const inner = sourceOf(first);
      assert.ok(inner);
      assert.notEqual(inner, sourceOf(container));
      check(laidOut, verdict.findings, ['a11y-text-contrast', kind === 'areas' ? 'layout-unused-space' : 'layout-align-mixed'], inner);
    });
  }
  assert.deepEqual(Object.keys(RULE_DOCS).filter(id => !covered.has(id as RuleId)).sort(), Object.keys(OUTSIDE_FIGURE).sort());
});

test('an unmarked band finding falls back to diagram()', async t => {
  const unmarked = stat(10, '件');
  assert.equal(sourceOf(unmarked), undefined);
  captureSourceLocations(true);
  t.after(() => captureSourceLocations(false));
  const d = diagram({theme: 'blue', evidenceCheck: 'info'});
  // add() would mark the band with its own call site, so hand the unmarked band to the check directly.
  const {verdict} = await checkDiagram({...d, bands: [unmarked]});
  const hit = verdict.findings.find(f => f.rule === 'stat-no-source');
  assert.ok(hit);
  assert.ok(sourceOf(d));
  assert.equal(hit.loc, sourceOf(d));
});

test('legend-incomplete points to the parts using missing notation', async t => {
  captureSourceLocations(true);
  t.after(() => captureSourceLocations(false));
  const first = box({title: '新規 A', tone: 'new'});
  const second = box({title: '新規 B', tone: 'new'});
  const covered = box({title: '注意', tone: 'danger'});
  const key = legend([{tone: 'danger', label: '注意'}]);
  const d = diagram({theme: 'blue'}).add(key, covered, row([first, second]));
  const hits = (await checkDiagram(d)).verdict.findings.filter(f => f.rule === 'legend-incomplete');
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
  const {verdict} = await checkDiagram(d);
  const hits = verdict.findings.filter(f => f.rule === 'graph-disconnected');
  assert.equal(hits.length, 1);
  assert.equal(hits[0]?.loc, sourceOf(fourth));
  assert.deepEqual(hits[0]?.related, [sourceOf(fifth)]);
});

// These rules are reported by entry points outside checkDiagram.
const DOC_LOCATION = 'Markdown location from --docs; no diagram() call';
const COMIC_VALUE_LOCATION = 'slot id in renderComic findings; no checkDiagram source location';
const CHAT_PROBLEM_LOCATION = 'a problem of the placed chat: verdict.problems carries no source location';
const OUTSIDE_FIGURE = {
  'chat-self-missing': CHAT_PROBLEM_LOCATION,
  'chat-speaker-unknown': CHAT_PROBLEM_LOCATION,
  'chat-name-wide': CHAT_PROBLEM_LOCATION,
  'comic-value-invalid': COMIC_VALUE_LOCATION,
  'comic-values-unknown': COMIC_VALUE_LOCATION,
  'slot-overflow': COMIC_VALUE_LOCATION,
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
  'bpmn-deprecated': 'band',
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
  'comic-bubble-wide': 'band',
  'comic-orphan-line': 'band',
  'comic-follower-split': 'band',
  'chat-self-missing': 'band',
  'chat-speaker-unknown': 'band',
  'chat-name-wide': 'band',
  'comic-value-invalid': 'band',
  'comic-values-unknown': 'band',
  'slot-overflow': 'band',
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
  'ladder-height-bound': 'band',
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

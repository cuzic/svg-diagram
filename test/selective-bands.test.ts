import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {TreeItem} from '../lib/types/diagrams.ts';
import {caption, captionDefinition} from '../lib/bands/caption.ts';
import {canvas} from '../lib/compose/selective/canvas.ts';
import {hero} from '../lib/compose/selective/hero.ts';
import {iconRow} from '../lib/compose/selective/icon-row.ts';
import {versus} from '../lib/compose/selective/versus.ts';
import {canvas as legacyCanvas, hero as legacyHero, iconRow as legacyIconRow, versus as legacyVersus} from '../lib/web.ts';
import {image} from '../lib/bands/image.ts';
import {image as legacyImage} from '../lib/dsl.ts';
import {combo} from '../lib/bands/combo.ts';
import {compare} from '../lib/bands/compare.ts';
import {pert} from '../lib/bands/pert.ts';
import {causalLoop} from '../lib/bands/causal.ts';
import {dependencyNetwork} from '../lib/bands/dependency.ts';
import {combo as legacyCombo, compare as legacyCompare, pert as legacyPert, causalLoop as legacyCausal, dependencyNetwork as legacyDependency} from '../lib/web.ts';
import {catplot, boxplot} from '../lib/bands/catplot.ts';
import {displot, histplot} from '../lib/bands/distplot.ts';
import {hist2d, jointplot} from '../lib/bands/multiplot.ts';
import {regplot, residplot} from '../lib/bands/regplot.ts';
import {clustermap} from '../lib/bands/clustermap.ts';
import {catplot as legacyCat, boxplot as legacyBoxplot, displot as legacyDist, histplot as legacyHist, hist2d as legacyHist2d, jointplot as legacyJoint, regplot as legacyReg, residplot as legacyResid, clustermap as legacyCluster} from '../lib/web.ts';
import {tornado} from '../lib/bands/tornado.ts';
import {butterfly} from '../lib/bands/butterfly.ts';
import {bubble} from '../lib/bands/bubble.ts';
import {harvey} from '../lib/bands/harvey.ts';
import {tornado as legacyTornado, butterfly as legacyButterfly, bubble as legacyBubble, harvey as legacyHarvey} from '../lib/web.ts';
import {stackedBars, mekko} from '../lib/bands/stacked.ts';
import {treemap} from '../lib/bands/treemap.ts';
import {stackedBars as legacyStackedBars, mekko as legacyMekko, treemap as legacyTreemap} from '../lib/web.ts';
import {sankey} from '../lib/bands/sankey.ts';
import {heatmap} from '../lib/bands/heatmap.ts';
import {radar} from '../lib/bands/radar.ts';
import {waterfall} from '../lib/bands/waterfall.ts';
import {swimlane} from '../lib/bands/swimlane.ts';
import {causeTree, relationDiagram, pdpc} from '../lib/bands/cause.ts';
import {tree, mindmap} from '../lib/bands/tree.ts';
import {stateDiagram, flowchart} from '../lib/bands/states.ts';
import {classDiagram} from '../lib/bands/classes.ts';
import {bpmn} from '../lib/bands/bpmn.ts';
import {cloud} from '../lib/bands/cloud.ts';
import {faultTree} from '../lib/bands/fta.ts';
import {bowtie} from '../lib/bands/bowtie.ts';
import {wireframe, wf} from '../lib/bands/wireframe.ts';
import {screens} from '../lib/bands/screens.ts';
import {sequence} from '../lib/bands/sequence.ts';
import {table, cell} from '../lib/bands/table.ts';
import {bars, histogram, pareto, rangeBars} from '../lib/bands/bars.ts';
import {plane} from '../lib/bands/plane.ts';
import {emitSvg} from '../lib/emit.ts';
import {quadrant} from '../lib/bands/quadrant.ts';
import {legend} from '../lib/bands/legend.ts';
import {draftStatusFinding, status} from '../lib/bands/status.ts';
import {wordart} from '../lib/bands/wordart.ts';
import {people} from '../lib/bands/people.ts';
import {dots} from '../lib/bands/dots.ts';
import {timeline} from '../lib/bands/timeline.ts';
import {chevron} from '../lib/bands/chevron.ts';
import {cycle} from '../lib/bands/cycle.ts';
import {funnel} from '../lib/bands/funnel.ts';
import {venn} from '../lib/bands/venn.ts';
import {concentric} from '../lib/bands/concentric.ts';
import {emblem} from '../lib/bands/emblem.ts';
import {valueChain} from '../lib/bands/value-chain.ts';
import {curve} from '../lib/bands/curve.ts';
import {pyramid} from '../lib/bands/pyramid.ts';
import {banner} from '../lib/bands/banner.ts';
import {raw} from '../lib/bands/raw.ts';
import {areas} from '../lib/bands/areas.ts';
import {groupRow} from '../lib/bands/group-row.ts';
import {group} from '../lib/bands/group.ts';
import {spacer} from '../lib/bands/spacer.ts';
import {box} from '../lib/bands/box.ts';
import {connect, connectDefinition} from '../lib/bands/connect.ts';
import {row} from '../lib/bands/row.ts';
import {grid} from '../lib/bands/grid.ts';
import {gantt} from '../lib/bands/gantt.ts';
import {math} from '../lib/bands/math.ts';
import {comicDefinition} from '../lib/bands/comic.ts';
import {band, DEF, plain} from '../lib/band-def.ts';
import type {BandDef} from '../lib/band-def.ts';
import type {LaidOutType} from '../lib/band-table.ts';
import {prepareBands, renderBands} from '../lib/core.ts';
import {contentBox} from '../lib/layout-fit-width.ts';
import {rowSlotStages} from '../lib/reveal-row.ts';
import {resolveRevealId, warnConnectorReveal, warnEarlyReveal} from '../lib/reveal-warnings.ts';
import {emptyScopes} from '../lib/scope-table.ts';
import {em} from '../lib/rich.ts';
import {markSpecPart} from '../lib/source-ref.ts';
import type {LaidOutBand} from '../lib/types/index.ts';
import type {CheckRect} from '../lib/types/verdicts.ts';
import {VERIFY_HANDLERS} from '../lib/verify-handlers.ts';
import type {VerifyHandler} from '../lib/verify-handlers.ts';
import {captionRects} from '../lib/verify-caption.ts';
import {comicRects, comicSlotOwners} from '../lib/verify-comic-rects.ts';
import {childRects, emblemRects, figureRects, overlappingFigureRects, statusRects} from '../lib/verify-rects.ts';
import {comic as legacyComic} from '../lib/web.ts';
import {sankey as legacySankey, heatmap as legacyHeatmap, radar as legacyRadar, waterfall as legacyWaterfall, swimlane as legacySwimlane, causeTree as legacyCauseTree, relationDiagram as legacyRelationDiagram, pdpc as legacyPdpc, tree as legacyTree, mindmap as legacyMindmap, stateDiagram as legacyStateDiagram, flowchart as legacyFlowchart, classDiagram as legacyClassDiagram, bpmn as legacyBpmn, cloud as legacyCloud, faultTree as legacyFaultTree, bowtie as legacyBowtie, wireframe as legacyWireframe, screens as legacyScreens, sequence as legacySequence, table as legacyTable, bars as legacyBars, rangeBars as legacyRangeBars, histogram as legacyHistogram, pareto as legacyPareto, plane as legacyPlane, quadrant as legacyQuadrant, legend as legacyLegend, wordart as legacyWordart, people as legacyPeople, dots as legacyDots, timeline as legacyTimeline, chevron as legacyChevron, cycle as legacyCycle, funnel as legacyFunnel, venn as legacyVenn, concentric as legacyConcentric, emblem as legacyEmblem, valueChain as legacyValueChain, curve as legacyCurve, pyramid as legacyPyramid, areas as legacyAreas, banner as legacyBanner, raw as legacyRaw, box as legacyBox, group as legacyGroup, caption as legacyCaption, spacer as legacySpacer, connect as legacyConnect, diagram, gantt as legacyGantt, grid as legacyGrid, renderInBrowser, row as legacyRow} from '../lib/web.ts';

const measure = ({text, size}: {text: string; size: number}) => ({w: [...text].length * size * 0.6, h: size});
const rows = [{id: 'draft', label: 'Draft', start: '2026-11-23', days: 3}] as const;

test('selective fit width and fit report match the browser renderer for a box row', async () => {
  const first = {title: 'Review'}, second = {title: 'Next'};
  const bands = [row([box(first), box(second)])];
  const selected = await renderBands(bands, {width: 'fit', measure});
  const legacy = await renderInBrowser(diagram({theme: 'blue', width: 'fit'})
    .add(legacyRow([legacyBox(first), legacyBox(second)])), {measure});
  assert.equal(selected.width, legacy.width);
  assert.deepEqual(selected.fit, legacy.fit);
  assert.equal(selected.fontScale, 1);
  const prepared = await prepareBands(bands, {width: 'fit', measure});
  assert.deepEqual(prepared.fit, selected.fit);
  assert.equal(prepared.fontScale, selected.fontScale);
  assert.deepEqual(prepared.placed, selected.laidOut);
});

test('selective fit width stops at 320 and leaves fixed width at 940', async () => {
  const bands = [pyramid(['Plan', 'Do'], {width: 260})];
  const fitted = await renderBands(bands, {width: 'fit', measure});
  const fixed = await renderBands(bands, {width: 940, measure});
  assert.equal(fitted.width, 320);
  assert.equal(fixed.width, 940);
  assert.equal(fitted.laidOut.width, 320);
  assert.equal(fitted.laidOut.laidOut[0]?.x, 30);
  assert.match(fitted.svg, /viewBox="0 0 320 /);
});

test('selective fit width measures the drawn flow shape', async () => {
  const rings = [{label: 'Team'}, {label: 'Clients'}, {label: 'Society'}];
  const options = {order: 'inner-first', labels: 'side', centre: 'User'} as const;
  const selected = await renderBands([concentric(rings, options)], {width: 'fit', measure});
  const legacy = await renderInBrowser(diagram({theme: 'blue', width: 'fit'})
    .add(legacyConcentric(rings, options)), {measure});
  assert.ok(legacy.width < 940);
  assert.equal(selected.width, legacy.width);
  const drawn = contentBox(selected.laidOut.laidOut, true);
  const allocated = contentBox(selected.laidOut.laidOut);
  assert.ok(drawn && allocated && drawn.w < allocated.w);
});

test('selective canvas reports its existing font scale and rejects fit width', async () => {
  const bands = [box({title: 'Review', body: 'Details'})];
  const canvas = {minText: 28};
  const selected = await renderBands(bands, {canvas, measure});
  const legacy = await renderInBrowser(diagram({theme: 'blue', canvas})
    .add(legacyBox({title: 'Review', body: 'Details'})), {measure});
  assert.equal(selected.fontScale, 2);
  assert.deepEqual(selected.fit, legacy.fit);
  await assert.rejects(prepareBands(bands, {canvas, width: 'fit', measure}), /use canvas.width/);
});

test('selective box and Gantt use the existing geometry and SVG emitters', async () => {
  const opts = {title: 'A & B', body: 'Body', step: 1, align: 'center', tag: 'Plan', stamp: '2026'} as const;
  const legacy = await renderInBrowser(diagram({theme: 'blue', legend: false})
    .add(legacyBox(opts)).add(legacyGantt(rows, {today: '2026-11-24'})), {measure});
  const selective = await renderBands([box(opts), gantt(rows, {today: 'auto'})], {measure, today: '2026-11-24'});
  assert.deepEqual(selective.xml, []);
  assert.equal(selective.verdict.ok, true);
  assert.equal(selective.height, legacy.height);
  const painted = (svg: string) => [...svg.matchAll(/<text\b[^>]*>[\s\S]*?<\/text>/g)].map(m => m[0]);
  assert.deepEqual(painted(selective.svg), painted(legacy.svg));
});

test('selective rendering measures once and preserves the stack across reveal stages', async () => {
  const bands = [box({id: 'first', title: 'Review', until: 2}), box({id: 'second', title: 'Review', reveal: 2})];
  const measured: string[] = [];
  const first = await renderBands(bands, {stage: 0, measure: async request => {
    measured.push(JSON.stringify(request));
    return measure(request);
  }});
  const final = await renderBands(bands, {measure});
  assert.equal(new Set(measured).size, measured.length);
  assert.equal((first.svg.match(/>Review<\/text>/g) ?? []).length, 1);
  assert.equal((final.svg.match(/>Review<\/text>/g) ?? []).length, 1);
  assert.notEqual(first.svg, final.svg);
  assert.equal(first.height, final.height);
});

test('rejects duplicate ids and invalid reveal intervals', async () => {
  await assert.rejects(renderBands([box({id: 'same'}), gantt(rows, {id: 'same'})], {measure}), /duplicate band id/);
  await assert.rejects(renderBands([box({reveal: 2, until: 2})], {measure}), /until must be later/);
});

test('selected rows, grids and labelled deferred connectors match legacy SVG', async () => {
  const from = {id: 'one', title: 'One', body: 'Review'} as const;
  const to = {id: 'two', title: 'Two', body: 'Confirm', bodyMono: true} as const;
  const link = {label: 'check', route: 'straight', tone: 'accent'} as const;
  const legacy = diagram({theme: 'blue', title: 'Plan', legend: false})
    .add(legacyRow([legacyBox(from), legacyBox({title: 'Side'})]))
    .add(legacyGrid([legacyBox(to), legacyBox({title: 'Notes'})], {cols: 2}))
    .add(legacyConnect('one:bottom', 'two:top', link));
  const selected = await renderBands([
    connect('one:bottom', 'two:top', link),
    row([box(from), box({title: 'Side'})]),
    grid([box(to), box({title: 'Notes'})], {cols: 2}),
  ], {measure, title: 'Plan'});
  const rendered = await renderInBrowser(legacy, {measure});
  assert.deepEqual(selected.xml, []);
  assert.match(selected.svg, /id="dsl-arrow-accent"/);
  assert.equal(selected.verdict.ok, true, JSON.stringify(selected.verdict.problems));
  assert.equal(selected.height, rendered.height);
  // The selective path uses an explicit accessible title. The frame, text and connector SVG are identical.
  const body = (svg: string) => svg.slice(svg.indexOf('  <defs>'));
  assert.equal(body(selected.svg), body(rendered.svg));
});

test('row child widths and inter-box arrows respect reveal', async () => {
  const bands = [row([box({title: 'Review'}), box({title: 'Later', reveal: 1})], {arrows: 'between'})];
  const early = await renderBands(bands, {measure, stage: 0});
  const later = await renderBands(bands, {measure, stage: 1});
  assert.equal(early.height, later.height);
  assert.doesNotMatch(early.svg, /Later|marker-end=/);
  assert.match(later.svg, /Later/);
  assert.match(later.svg, /marker-end="url\(#dsl-arrow\)"/);
});

test('a connector inherits the reveal of its named endpoints', async () => {
  const bands = [box({id: 'a', title: 'Before'}), box({id: 'b', title: 'Later', reveal: 2}), connect('a:bottom', 'b:top')];
  const first = await renderBands(bands, {measure, stage: 1});
  const last = await renderBands(bands, {measure});
  assert.doesNotMatch(first.svg, /marker-end=/);
  assert.match(last.svg, /marker-end=/);
});

const warningSet = ({verdict}: Awaited<ReturnType<typeof renderBands>>) => new Set(verdict.warnings);

test('reveal diagnostics keep anchor references in messages and compare strict stage boundaries', () => {
  const authored = {from: 'plot.a:right@0.5', to: 'b:top', reveal: 2, until: 4};
  const scopes = emptyScopes();
  assert.equal(resolveRevealId(scopes, authored.from, () => true), 'plot.a');
  assert.equal(resolveRevealId(scopes, 'b', () => true), 'b');
  const warnings: string[] = [];
  warnConnectorReveal(warnings, authored, {start: 2, end: 4});
  warnConnectorReveal(warnings, authored, {start: 3});
  warnEarlyReveal(warnings, 'plane() path 1', 2, 3);
  assert.deepEqual(warnings, [
    'connect(plot.a:right@0.5 -> b:top) reveal 2 is earlier than an endpoint (reveal 3)',
    'plane() path 1 reveal 2 is earlier than an endpoint (reveal 3)',
  ]);
});

test('row slot stages follow spans and leave unoccupied columns out', () => {
  const cells = row([box({col: 2, span: 2, reveal: 2, until: 4}), box({reveal: 1})], {id: 'cells', cols: 4});
  assert.deepEqual(rowSlotStages(cells), new Map([
    ['cells#2', {start: 2, end: 4}], ['cells#3', {start: 2, end: 4}], ['cells#4', {start: 1, end: undefined}],
  ]));
});

test('selected connectors warn about reveal and until outside their endpoints', async () => {
  const opts = {theme: 'blue', legend: false, title: 'T'} as const;
  for (const [timing, expected] of [
    [{reveal: 1}, ['connect(a:bottom -> b:top) reveal 1 is earlier than an endpoint (reveal 2)']],
    [{until: 4}, ["connect(a:bottom -> b:top) until 4 is later than an endpoint's (vanishes at 3)"]],
    [{reveal: 2, until: 3}, []],
    [{}, []],
  ] as const) {
    const from = {id: 'a', title: 'A', until: 'until' in timing ? 4 : undefined} as const;
    const to = {id: 'b', title: 'B', reveal: 2, until: 'until' in timing ? 3 : undefined} as const;
    const legacy = await renderInBrowser(diagram(opts).add(legacyBox(from), legacyBox(to),
      legacyConnect('a:bottom', 'b:top', timing)), {measure});
    const selected = await renderBands([box(from), box(to), connect('a:bottom', 'b:top', timing)],
      {...opts, measure, connectors: connectDefinition});
    assert.deepEqual(warningSet(selected), new Set(expected));
    assert.deepEqual(warningSet(legacy), warningSet(selected));
  }
});

test('selected connectors report reveal warnings at row slots', async () => {
  const next = {id: 'next', title: 'Next'} as const;
  const child = {reveal: 2, until: 4};
  const timing = {reveal: 1, until: 5};
  const opts = {theme: 'blue', legend: false, title: 'T'} as const;
  const slot = 'cells#2:bottom';
  const rows = [
    [row([box({title: 'First'}), box({title: 'Later', ...child})], {id: 'cells'}),
      legacyRow([legacyBox({title: 'First'}), legacyBox({title: 'Later', ...child})], {id: 'cells'})],
    [groupRow([group(box({title: 'Inside'}), {title: 'Group', span: 2, ...child}), box({title: 'Last'})], {id: 'cells', cols: 3}),
      legacyRow([legacyGroup(legacyBox({title: 'Inside'}), {title: 'Group', span: 2, ...child}), legacyBox({title: 'Last'})], {id: 'cells', cols: 3})],
  ] as const;
  for (const [selectedRow, legacyRow] of rows) {
    const legacy = await renderInBrowser(diagram(opts).add(legacyRow, legacyBox(next), legacyConnect(slot, 'next:top', timing)), {measure});
    const selected = await renderBands([selectedRow, box(next), connect(slot, 'next:top', timing)], {...opts, measure});
    assert.deepEqual(warningSet(legacy), new Set([
      'connect(cells#2:bottom -> next:top) reveal 1 is earlier than an endpoint (reveal 2)',
      "connect(cells#2:bottom -> next:top) until 5 is later than an endpoint's (vanishes at 4)",
    ]));
    assert.deepEqual(warningSet(selected), warningSet(legacy));
  }
});

test('selected connectors compare authored reveal against inherited stages and scoped anchors', async () => {
  const next = {id: 'next', title: 'Next'} as const;
  const values = [{id: 'later', label: '値', value: 4, reveal: 3}];
  const barsOpts = {scope: 'plot', max: 8};
  const timing = {reveal: 1};
  const groupOpts = {reveal: 2};
  const opts = {theme: 'blue', legend: false, title: 'T'} as const;
  const legacy = await renderInBrowser(diagram(opts).add(legacyGroup([
    legacyBars(values, barsOpts), legacyBox(next), legacyConnect('later:bottom', 'next:top', timing),
  ], groupOpts)), {measure});
  const selected = await renderBands([group([
    bars(values, barsOpts), box(next), connect('later:bottom', 'next:top', timing),
  ], groupOpts)], {...opts, measure});
  assert.ok(warningSet(legacy).has('connect(later:bottom -> next:top) reveal 1 is earlier than an endpoint (reveal 3)'));
  assert.deepEqual(warningSet(selected), warningSet(legacy));
});

test('connect can target a row column with no explicit box id', async () => {
  const plan = row([box({title: 'Review'}), box({title: 'Pick'})], {id: 'plan'});
  const result = await renderBands([plan, box({id: 'next', title: 'Next'}), connect(plan.col(1).bottom, 'next:top')], {measure});
  assert.ok(result.verdict.ok, JSON.stringify(result.verdict.problems));
  assert.match(result.svg, /marker-end=/);
});

test('selected rows can opt into implicit loop-back connectors', async () => {
  const options = {loopBack: {from: 2, to: 1, label: 'retry'}, arrows: 'between'} as const;
  const first = {title: 'Review', body: 'retry()', bodyMono: true};
  const selected = await renderBands([
    row([box(first), box({title: 'Next'})], options),
    box({title: 'Finish'}),
  ], {measure, connectors: connectDefinition});
  const rendered = await renderInBrowser(diagram({theme: 'blue', legend: false})
    .add(legacyRow([legacyBox(first), legacyBox({title: 'Next'})], options))
    .add(legacyBox({title: 'Finish'})), {measure});
  assert.equal(selected.svg, rendered.svg);
  assert.ok(selected.verdict.ok, JSON.stringify(selected.verdict.problems));
});

test('a row with a loop explains how to opt into connector code', async () => {
  const input = [row([box({title: 'First'}), box({title: 'Next'})], {loopBack: {from: 2, to: 1}})];
  await assert.rejects(renderBands(input, {measure}), /connectDefinition/);
});

test('selective captions and spacers match shared browser placement and output', async () => {
  const opts = {align: 'left', mono: true} as const;
  const input = diagram({theme: 'blue', legend: false, title: 'Review'})
    .add(legacyCaption('Review', opts), legacySpacer(24), legacyCaption('Next'));
  const result = await renderBands([caption('Review', opts), spacer(24), caption('Next')], {measure, title: 'Review'});
  assert.equal(result.svg, (await renderInBrowser(input, {measure})).svg);
  assert.ok(result.verdict.ok);
});

test('selected groups lay out their generated titles and nested bands like the browser entry', async () => {
  const options = {title: 'Plan', stamp: 'Draft', pad: 24} as const;
  const result = await renderBands([group([box({title: 'Review'}), group(caption('Nested'))], options)], {measure, title: 'Example'});
  const expected = await renderInBrowser(diagram({theme: 'blue', title: 'Example', legend: false})
    .add(legacyGroup([legacyBox({title: 'Review'}), legacyGroup(legacyCaption('Nested'))], options)), {measure});
  assert.equal(result.svg.slice(result.svg.indexOf('  <style>')), expected.svg.slice(expected.svg.indexOf('  <style>')));
  assert.ok(result.verdict.ok, JSON.stringify(result.verdict.problems));
});

test('selected group reveal applies to its title and contents', async () => {
  const input = [group(box({title: 'Review'}), {title: 'Plan', reveal: 2})];
  const early = await renderBands(input, {measure, stage: 1});
  const later = await renderBands(input, {measure, stage: 2});
  assert.equal(early.height, later.height);
  assert.doesNotMatch(early.svg, /Review|Plan/);
  assert.match(later.svg, /Review/);
  assert.match(later.svg, /Plan/);
});

test('selected mixed group rows preserve stretch geometry and synthetic box cells', async () => {
  const nested = [box({id: 'start', title: 'Review'}), box({title: 'Next'})];
  const opts = {title: 'Plan', valign: 'stretch'} as const;
  const result = await renderBands([
    groupRow([group(nested, opts), box({id: 'finish', title: 'Finish'})], {gap: 80}),
    connect('start:right', 'finish:left', {label: 'go'}),
  ], {measure, title: 'Example'});
  const expected = await renderInBrowser(diagram({theme: 'blue', title: 'Example', legend: false})
    .add(legacyRow([legacyGroup([legacyBox({id: 'start', title: 'Review'}), legacyBox({title: 'Next'})], opts), legacyBox({id: 'finish', title: 'Finish'})], {gap: 80}))
    .add(legacyConnect('start:right', 'finish:left', {label: 'go'})), {measure});
  assert.equal(result.svg.slice(result.svg.indexOf('  <defs>')), expected.svg.slice(expected.svg.indexOf('  <defs>')));
  assert.deepEqual(result.xml, []);
});

test('loop-back expansion also binds the generated connector inside a group', async () => {
  const result = await renderBands([group(row([box({title: 'Review'}), box({title: 'Next'})],
    {loopBack: {from: 2, to: 1, label: 'Retry'}}))], {measure, connectors: connectDefinition});
  assert.match(result.svg, /Retry/);
  assert.ok(result.verdict.ok, JSON.stringify(result.verdict.problems));
});

test('selected areas preserve spans, generated group wrappers and labelled connections', async () => {
  const template = ['head head', 'left right'];
  const options = {cols: [1, 2], gap: 8};
  const link = {label: 'Review again', route: 'straight'} as const;
  const selected = await renderBands([
    areas(template, {head: caption('Plan'), left: box({title: 'Review'}), right: group(box({title: 'Next'}), {title: 'Work'})}, options),
    connect('left:right', 'right:left', link),
  ], {measure, title: 'Example'});
  const expected = await renderInBrowser(diagram({theme: 'blue', title: 'Example', legend: false})
    .add(legacyAreas(template, {head: legacyCaption('Plan'), left: legacyBox({title: 'Review'}), right: legacyGroup(legacyBox({title: 'Next'}), {title: 'Work'})}, options))
    .add(legacyConnect('left:right', 'right:left', link)), {measure});
  assert.deepEqual(selected.xml, []);
  assert.equal(selected.height, expected.height);
  assert.equal(selected.svg.slice(selected.svg.indexOf('  <defs>')), expected.svg.slice(expected.svg.indexOf('  <defs>')));
});

test('selective banners and raw bands preserve rich text, stamps and custom geometry', async () => {
  const options = {headline: ['Review ', em.accent('plan')], sub: 'Next step', stamp: 'Draft'} as const;
  const shape = {h: 32, draw: ({x, y, w}: {x: number; y: number; w: number}) => `<rect x="${x}" y="${y}" width="${w}" height="24" fill="#ffffff"/>`};
  const selected = await renderBands([banner(options), raw(shape)], {measure, title: 'Plan'});
  const expected = await renderInBrowser(diagram({theme: 'blue', title: 'Plan', legend: false})
    .add(legacyBanner(options), legacyRaw(shape)), {measure});
  assert.deepEqual(selected.xml, []);
  assert.equal(selected.height, expected.height);
  assert.equal(selected.svg.slice(selected.svg.indexOf('  <style>')), expected.svg.slice(expected.svg.indexOf('  <style>')));
});

test('selective curves and pyramids preserve axis labels, drop lines and wrapped layers', async () => {
  const selected = await renderBands([
    curve([{y: 0.25, dropLine: true}, {y: 0.9, emphasis: 'accent'}], {xLabel: '推移', yTopLabel: '上限'}),
    pyramid(['広い層のラベル', '狭い層の長い日本語ラベル'], {width: 280, layerHeight: 100}),
  ], {measure, title: 'Plan'});
  const expected = await renderInBrowser(diagram({theme: 'blue', title: 'Plan', legend: false})
    .add(legacyCurve([{y: 0.25, dropLine: true}, {y: 0.9, emphasis: 'accent'}], {xLabel: '推移', yTopLabel: '上限'}),
      legacyPyramid(['広い層のラベル', '狭い層の長い日本語ラベル'], {width: 280, layerHeight: 100})), {measure});
  assert.deepEqual(selected.xml, []);
  assert.equal(selected.height, expected.height);
  assert.equal(selected.svg.slice(selected.svg.indexOf('  <style>')), expected.svg.slice(expected.svg.indexOf('  <style>')));
});

const flowSteps = [{id: 'a', label: '計画'}, {id: 'b', label: '実行'}, {id: 'c', label: '評価'}] as const;

test('selective chevron allows a connector to end on an individual step', async () => {
  const next = {id: 'x', title: '結果'};
  const legacy = await renderInBrowser(diagram({theme: 'blue', title: 'T', legend: false})
    .add(legacyChevron(flowSteps), legacyBox(next), legacyConnect('x:top', 'b:bottom')), {measure});
  const selected = await renderBands([
    chevron(flowSteps), box(next), connect('x:top', 'b:bottom'),
  ], {measure, title: 'T', connectors: connectDefinition});
  assert.deepEqual(legacy.verdict.problems, []);
  assert.deepEqual(selected.verdict.problems, legacy.verdict.problems);
  assert.deepEqual(selected.verdict.warnings, legacy.verdict.warnings);
  assert.equal(selected.svg, legacy.svg);
});

const funnelStages = [{id: 'a', label: '候補', value: 10}, {id: 'b', label: '採用', value: 5}] as const;
const vennSets = [{id: 'a', name: '企画'}, {id: 'b', name: '運用'}] as const;
const concentricRings = [{id: 'a', label: '外側'}, {id: 'b', label: '内側'}] as const;
const emblemItems = [{id: 'a', label: '確認', shape: 'triangle'}] as const;
const chainParts = {primary: flowSteps.slice(0, 2)};

for (const [name, selectedBand, legacyBand] of [
  ['funnel', funnel(funnelStages), legacyFunnel(funnelStages)],
  ['cycle', cycle(flowSteps), legacyCycle(flowSteps)],
  ['venn', venn(vennSets), legacyVenn(vennSets)],
  ['concentric', concentric(concentricRings), legacyConcentric(concentricRings)],
  ['emblem', emblem(emblemItems), legacyEmblem(emblemItems)],
  ['valueChain', valueChain(chainParts), legacyValueChain(chainParts)],
] as const) {
  test(`selective ${name} matches browser overlap verification next to a connected box`, async () => {
    const next = {id: 'next', title: '結果'};
    const opts = {title: 'T', gap: 40};
    const selected = await renderBands([
      selectedBand, box(next), connect('next:top', 'a:bottom'),
    ], {...opts, measure, connectors: connectDefinition});
    const legacy = await renderInBrowser(diagram({...opts, theme: 'blue', legend: false})
      .add(legacyBand, legacyBox(next), legacyConnect('next:top', 'a:bottom')), {measure});
    assert.deepEqual(selected.verdict.problems, legacy.verdict.problems);
    assert.deepEqual(selected.verdict.warnings, legacy.verdict.warnings);
    assert.equal(selected.svg, legacy.svg);
  });
}

test('selective status matches browser overlap verification next to a box', async () => {
  const opts = {title: 'T', gap: 0};
  const next = {id: 'next', title: '結果'};
  // The browser adds the draft prefix to its accessible description.
  const selected = await renderBands([status('draft'), box(next)], {...opts, desc: '(下書き) 結果', measure});
  const legacy = await renderInBrowser(diagram({...opts, desc: '結果', theme: 'blue', legend: false, status: 'draft'})
    .add(legacyBox(next)), {measure});
  assert.deepEqual(selected.verdict.problems, legacy.verdict.problems);
  assert.deepEqual(selected.verdict.warnings, legacy.verdict.warnings);
  assert.equal(selected.svg, legacy.svg);
});

test('selected status reports the draft-status finding unless accepted', async () => {
  const opts = {theme: 'blue', legend: false, title: 'T'} as const;
  const bands = [status('draft', 'レビュー中'), box({title: '内容'})];
  const draftFindings = ({verdict}: Awaited<ReturnType<typeof renderBands>>) => verdict.findings.filter(f => f.rule === 'draft-status');
  const legacy = await renderInBrowser(diagram({...opts, status: 'draft', statusLabel: 'レビュー中'}).add(legacyBox({title: '内容'})), {measure});
  const expected = {rule: 'draft-status', severity: 'info', message: "この図は下書き(status: 'draft')。公開前に外す"};
  assert.deepEqual(draftStatusFinding('draft'), expected);
  assert.deepEqual(draftFindings(legacy), [expected]);
  assert.deepEqual(draftFindings(await renderBands(bands, {...opts, measure})), draftFindings(legacy));
  assert.deepEqual(draftFindings(await renderBands(bands, {...opts, measure, accept: {'draft-status': '検討中の図'}})), []);
  assert.deepEqual(draftFindings(await renderBands([box({title: '内容'})], {...opts, measure})), []);
});

test('selective captions distinguish the group title ink from standalone captions in overlap checks', async () => {
  const top = {id: 'top', title: '開始'};
  const bottom = {id: 'bottom', title: '結果'};
  const label = '途中の説明';
  const link = {route: 'straight'} as const;
  const opts = {title: 'T', gap: 40};
  const title = {title: label, titleAlign: 'center'} as const;
  const selectedGroup = group(box(bottom), title), browserGroup = legacyGroup(legacyBox(bottom), title);
  const selectedLink = connect('top:bottom', 'bottom:top', link), browserLink = legacyConnect('top:bottom', 'bottom:top', link);
  markSpecPart([selectedGroup, browserGroup], 'parts[2]');
  markSpecPart([selectedLink, browserLink], 'parts[3]');
  const selected = await renderBands([
    box(top), caption('補足'), selectedGroup, selectedLink,
  ], {...opts, measure, connectors: connectDefinition});
  const legacy = await renderInBrowser(diagram({...opts, theme: 'blue', legend: false})
    .add(legacyBox(top), legacyCaption('補足'), browserGroup, browserLink), {measure});
  assert.deepEqual(selected.verdict.problems, legacy.verdict.problems);
  assert.deepEqual(selected.verdict.warnings, legacy.verdict.warnings);
  assert.equal(selected.svg, legacy.svg);
  const collision = ({verdict}: typeof selected) =>
    verdict.issues?.find(issue => issue.message.includes('path overlaps "group title'));
  assert.equal(collision(legacy)?.loc?.specPath, 'parts[3]');
  assert.deepEqual(collision(legacy)?.related?.map(ref => ref.specPath), ['parts[2]']);
  assert.deepEqual(collision(selected), collision(legacy));
});

test('selective whole-band obstacles keep the legacy diagnostic label', async () => {
  const top = {id: 'top', title: '開始'}, bottom = {id: 'bottom', title: '結果'};
  const obstacle = {headline: '注意'};
  const link = {route: 'straight'} as const;
  const selected = await renderBands([
    box(top), banner(obstacle), box(bottom), connect('top:bottom', 'bottom:top', link),
  ], {measure, connectors: connectDefinition});
  const legacy = await renderInBrowser(diagram({theme: 'blue', legend: false})
    .add(legacyBox(top), legacyBanner(obstacle), legacyBox(bottom), legacyConnect('top:bottom', 'bottom:top', link)), {measure});
  assert.ok(legacy.verdict.problems.some(problem => problem.includes('path overlaps "注意"')));
  assert.deepEqual(selected.verdict.problems, legacy.verdict.problems);
});

test('selective flow figures preserve labels, item anchors and generated shapes', async () => {
  const steps = [{label: 'Review', id: 'review'}, {label: 'Revise'}, {label: 'Approve', id: 'approve'}];
  const next = {id: 'release', title: 'Release'};
  const stages = [{label: 'Requests', value: 10}, {label: 'Accepted', value: 5}];
  const sets = [{name: 'Design'}, {name: 'Operations'}];
  const rings = [{label: 'Outer'}, {label: 'Inner'}];
  const parts = {primary: ['Build', 'Ship'], support: ['Train']};
  const options = {loopBack: {from: 'approve', to: 'review', label: 'Retry'}};
  const selected = await renderBands([
    chevron(steps, options), box(next), connect('approve', 'release'),
    funnel(stages, {showRate: true}), cycle(steps.map(({label}) => ({label})), {links: 'all'}),
    venn(sets), concentric(rings), emblem('重要', {shape: 'triangle'}), valueChain(parts),
  ], {measure, title: 'Plan', connectors: connectDefinition});
  const expected = await renderInBrowser(diagram({theme: 'blue', title: 'Plan', legend: false})
    .add(legacyChevron(steps, options), legacyBox(next), legacyConnect('approve', 'release'),
      legacyFunnel(stages, {showRate: true}), legacyCycle(steps.map(({label}) => ({label})), {links: 'all'}),
      legacyVenn(sets), legacyConcentric(rings), legacyEmblem('重要', {shape: 'triangle'}), legacyValueChain(parts)), {measure});
  assert.deepEqual(selected.xml, []);
  assert.equal(selected.height, expected.height);
  assert.equal(selected.svg.slice(selected.svg.indexOf('  <style>')), expected.svg.slice(expected.svg.indexOf('  <style>')));
});

test('selective people, dots and both timeline variants preserve browser SVG', async () => {
  const iconOpts = {cols: 5, side: {value: '7 人', label: '回答者'}, id: 'people'} as const;
  const values = [0.2, 0.2, {at: 0.8, tone: 'accent'}] as const;
  const dates = {
    from: '2026-01', to: '2027-06', now: {at: '2026-04'},
    deadline: {at: '2027-03', label: '締切'}, marks: [{at: '2026-09', label: '中間報告'}],
  };
  const numeric = {unit: 'ms', from: 0, to: 80, lanes: ['処理'], events: [{at: 20, label: '開始', lane: '処理'}]};
  const selected = await renderBands([
    people(10, [3, 4], iconOpts), dots(values, {lowLabel: '低', highLabel: '高'}), timeline(dates), timeline(numeric),
  ], {measure, title: 'Plan', gap: 17});
  const expected = await renderInBrowser(diagram({theme: 'blue', title: 'Plan', legend: false, gap: 17})
    .add(legacyPeople(10, [3, 4], iconOpts), legacyDots(values, {lowLabel: '低', highLabel: '高'}), legacyTimeline(dates), legacyTimeline(numeric)), {measure});
  assert.deepEqual(selected.xml, []);
  assert.equal(selected.height, expected.height);
  assert.equal(selected.svg.slice(selected.svg.indexOf('  <style>')), expected.svg.slice(expected.svg.indexOf('  <style>')));
});

test('selective status and horizontal and vertical wordart preserve browser SVG', async () => {
  const vertical = {style: 'sticker', writing: 'vertical', size: 36} as const;
  const horizontal = {style: 'gradient', size: 40, rotate: -6} as const;
  const selected = await renderBands([
    status('draft', 'レビュー中'), wordart('進捗報告', vertical), wordart('Review', horizontal),
  ], {measure, title: 'Plan', gap: 17});
  const expected = await renderInBrowser(diagram({
    theme: 'blue', title: 'Plan', legend: false, gap: 17, status: 'draft', statusLabel: 'レビュー中',
  }).add(legacyWordart('進捗報告', vertical), legacyWordart('Review', horizontal)), {measure});
  assert.deepEqual(selected.xml, []);
  assert.equal(selected.height, expected.height);
  assert.equal(selected.svg.slice(selected.svg.indexOf('  <style>')), expected.svg.slice(expected.svg.indexOf('  <style>')));
});

test('selective legend preserves wrapping, line markers and semantic swatches', async () => {
  const items = [
    {label: 'Review', line: 'dashed', arrow: 'both'},
    {label: '重要な関係', weight: 'strong'},
    {label: '根本原因', role: 'root'},
    {label: '基本事象', ftaEvent: 'basic'},
  ] satisfies Parameters<typeof legend>[0];
  const opts = {width: 280, title: 'Plan'};
  const result = await renderBands([legend(items)], {...opts, measure});
  const expected = await renderInBrowser(diagram({...opts, theme: 'blue', legend: false})
    .add(legacyLegend(items)), {measure});
  assert.equal(result.height, expected.height);
  assert.deepEqual(result.xml, []);
  assert.match(result.svg, /<marker id="dsl-arrow"/);
  assert.match(result.svg, /<marker id="dsl-arrow-strong"/);
  assert.equal(result.svg.slice(result.svg.indexOf('  <defs>')), expected.svg.slice(expected.svg.indexOf('  <defs>')));
});

test('a selective cycle supplies its own SVG arrow marker', async () => {
  const steps = [{label: 'Plan'}, {label: 'Do'}, {label: 'Review'}];
  const result = await renderBands([cycle(steps)], {measure});
  assert.match(result.svg, /<marker id="dsl-arrow"/);
  assert.match(result.svg, /marker-end="url\(#dsl-arrow\)"/);
});

test('a selective concentric map supplies the marker for movement between rings', async () => {
  const radar = concentric(4, {
    sectors: [{label: 'Work'}, {label: 'Health'}],
    marks: [{label: 'Review', sector: 1, r: 0.3, from: {r: 0.7}}],
  });
  const result = await renderBands([radar], {measure});
  assert.match(result.svg, /<marker id="dsl-arrow"/);
  assert.match(result.svg, /marker-end="url\(#dsl-arrow\)"/);
});

test('selective quadrant preserves preset axes, bubble sizing, motion arrows and item anchors', async () => {
  const opts = {
    id: 'portfolio', scope: 'cases', sizeTitle: '売上', sizeUnit: '億円',
    items: [
      {id: 'alpha', label: '製品 A', at: [0.8, 0.8], size: 20},
      {id: 'beta', label: '製品 B', cell: [0, 1], size: 10},
    ],
    arrows: [{from: 'alpha', to: [0.68, 0.72]}],
  } satisfies NonNullable<Parameters<typeof quadrant.preset>[1]>;
  const next = {id: 'next', title: 'Review'} as const;
  const result = await renderBands([quadrant.preset('bcg', opts), box(next), connect('cases.beta', 'next')], {measure, title: 'Plan', gap: 17});
  const expected = await renderInBrowser(diagram({theme: 'blue', title: 'Plan', gap: 17, legend: false})
    .add(legacyQuadrant.preset('bcg', opts), legacyBox(next), legacyConnect('cases.beta', 'next')), {measure});
  assert.deepEqual(result.xml, []);
  assert.deepEqual(result.verdict.problems, expected.verdict.problems);
  assert.equal(result.height, expected.height);
  assert.equal(result.svg.slice(result.svg.indexOf('  <defs>')), expected.svg.slice(expected.svg.indexOf('  <defs>')));
});

test('selective plane preserves axes, growing paths and staged point labels', async () => {
  const opts = {
    x: {max: 30, step: 10}, y: {max: 10, step: 5}, grid: true,
    points: [
      {id: 'a', at: [4, 2], label: '開始'},
      {id: 'b', at: [15, 4], label: '中間', reveal: 1},
      {id: 'c', at: [25, 8], label: 'Review', reveal: 3},
    ],
    paths: [{through: ['a', 'b', 'c'], grow: true, arrow: true}],
  } satisfies Parameters<typeof plane>[0];
  const figure = diagram({theme: 'blue', title: 'Plan', legend: false}).add(legacyPlane(opts));
  const expected = await renderInBrowser(figure, {measure});
  const body = (svg: string) => svg.slice(svg.indexOf('  <style>'));
  for (const stage of [0, 1, 3, undefined]) {
    const result = await renderBands([plane(opts)], {measure, title: 'Plan', stage});
    assert.deepEqual(result.xml, []);
    assert.deepEqual(result.verdict.problems, expected.verdict.problems);
    assert.equal(result.height, expected.height);
    assert.equal(body(result.svg), body(emitSvg(expected.laidOut, {reveal: stage})));
    if (stage === 1) assert.doesNotMatch(result.svg, />Review<\/text>/);
    if (stage === undefined) assert.match(result.svg, />Review<\/text>/);
  }
  assert.equal(opts.points[0]?.reveal, undefined);
});

test('selected planes report reveal warnings for lines, fixed paths and dimensions', async () => {
  const input = {
    x: {max: 10}, y: {max: 10},
    points: [{id: 'a', at: [1, 1]}, {id: 'b', at: [5, 5], reveal: 3}],
    lines: [{from: 'a', to: 'b', reveal: 2}],
    paths: [{through: ['a', 'b'], reveal: 2}, {through: ['a', 'b'], reveal: 2, grow: true}],
    dims: [{from: 'a', to: 'b', label: '距離', reveal: 2}],
  } satisfies Parameters<typeof plane>[0];
  const opts = {theme: 'blue', legend: false, title: 'T'} as const;
  const legacy = await renderInBrowser(diagram(opts).add(legacyPlane(input)), {measure});
  const selected = await renderBands([plane(input)], {...opts, measure});
  assert.deepEqual(warningSet(legacy), new Set([
    'plane() line 1 (a -> b) reveal 2 is earlier than an endpoint (reveal 3)',
    'plane() path 1 reveal 2 is earlier than an endpoint (reveal 3)',
    'plane() dim "距離" reveal 2 is earlier than an endpoint (reveal 3)',
  ]));
  assert.deepEqual(warningSet(selected), warningSet(legacy));
});

test('selective bars preserve replacement stages and the range, Pareto and histogram variants', async () => {
  const data = [
    {id: 'before', label: '旧計画', value: 5},
    {id: 'after', label: '新計画', value: 8, reveal: 2, replaces: 'before'},
  ];
  const ranges = [{label: '範囲', range: [2, 6]}] as const;
  const counts = [{label: 'A', value: 8}, {label: 'B', value: 4}];
  const values = [1, 2, 2, 3, 4, 5];
  const opts = {title: 'Plan', measure};
  const result = (stage?: number) => renderBands([
    bars(data), rangeBars(ranges), pareto(counts), histogram(values),
  ], {...opts, stage});
  const expected = await renderInBrowser(diagram({theme: 'blue', title: 'Plan', legend: false})
    .add(legacyBars(data), legacyRangeBars(ranges), legacyPareto(counts), legacyHistogram(values)), {measure});
  for (const stage of [0, 2, undefined]) {
    const actual = await result(stage);
    const body = (svg: string) => svg.slice(svg.indexOf('  <style>'));
    assert.deepEqual(actual.xml, []);
    assert.deepEqual(actual.verdict.problems, expected.verdict.problems);
    assert.doesNotMatch(actual.svg, stage === 0 ? />新計画<\/text>/ : />旧計画<\/text>/);
    assert.equal(body(actual.svg), body(emitSvg(expected.laidOut, {reveal: stage ?? 2})));
  }
  assert.equal('until' in data[0]!, false);
});

test('a connection to a replaced bar follows its scoped endpoint lifetime', async () => {
  const chart = bars([
    {id: 'old', label: 'Old', value: 4},
    {id: 'new', label: 'New', value: 8, reveal: 2, replaces: 'old'},
  ], {scope: 'plan'});
  const input = [chart, box({id: 'summary', title: 'Summary'}), connect('plan.old:bottom', 'summary:top', {label: 'Previous'})];
  const before = await renderBands(input, {measure, stage: 0});
  const after = await renderBands(input, {measure, stage: 2});
  assert.match(before.svg, />Previous<\/text>/);
  assert.doesNotMatch(after.svg, />Previous<\/text>/);
});

test('selective sequence and table preserve message markers and monospace cells', async () => {
  const {describeSequence, describeTable} = await import('../lib/diagram-description.ts');
  const actors = [{id: 'ui', label: '画面'}, {id: 'api', label: 'API'}] as const;
  const steps = [{from: 'ui', to: 'api', label: '送信'}, {self: 'api', label: '検証'}] as const;
  const cols = [{label: '項目'}, {label: '値', mono: true}];
  const rows = [['識別子', cell('ABC-123')]];
  const options = {rowHeader: true, title: '結果'};
  assert.equal(describeSequence(sequence([...actors], [...steps])), '参加者: 画面、API');
  assert.equal(describeTable(table(cols, rows, options)), '表「結果」: 列 項目、値');
  const result = await renderBands([sequence([...actors], [...steps]), table(cols, rows, options)], {measure, title: 'Plan'});
  const expected = await renderInBrowser(diagram({theme: 'blue', title: 'Plan', legend: false})
    .add(legacySequence([...actors], [...steps]), legacyTable(cols, rows, options)), {measure});
  const content = (svg: string) => svg.slice(svg.indexOf('  <defs>'));
  assert.deepEqual(result.xml, []);
  assert.equal(content(result.svg), content(expected.svg));
  assert.match(result.svg, /id="dsl-arrow"/);
  assert.match(result.svg, /monospace/);
});

test('selective wireframes and screens preserve callouts and screen-frame anchors', async () => {
  const make = () => wf.col([wf.region('レビュー', {n: true})]);
  const opts = {id: 'source', title: '入力', notes: ['説明']};
  const items = [{id: 'next', title: '確認', root: wf.col([wf.region('内容')])}];
  const link = {label: '次へ'};
  const selected = await renderBands([
    wireframe(make(), opts), screens(items, {cols: 1}), connect('source:bottom', 'next:top', link),
  ], {measure, title: 'Plan', gap: 37});
  const expected = await renderInBrowser(diagram({theme: 'blue', legend: false, title: 'Plan', gap: 37})
    .add(legacyWireframe(make(), opts), legacyScreens(items, {cols: 1}), legacyConnect('source:bottom', 'next:top', link)), {measure});
  assert.deepEqual(selected.xml, []);
  assert.deepEqual(selected.verdict.problems, expected.verdict.problems);
  assert.equal(selected.svg.slice(selected.svg.indexOf('  <defs>')), expected.svg.slice(expected.svg.indexOf('  <defs>')));
});

test('selective fault trees and bow-ties preserve gates, barriers and event anchors', async () => {
  const tree = {label: '停止', gate: 'or', children: [{id: 'event' as const, label: '電源', kind: 'basic'}, {label: '回線', kind: 'basic'}]} satisfies Parameters<typeof faultTree>[0];
  const risk = {top: '中断', threats: [{label: '故障', barriers: ['点検']}], consequences: [{label: '遅延', barriers: ['復旧']}]};
  const link = {label: 'Review'};
  const result = await renderBands([faultTree(tree), bowtie(risk, {id: 'risk'}), connect('event:bottom', 'risk:top', link)], {measure, title: 'Plan', gap: 56});
  const expected = await renderInBrowser(diagram({theme: 'blue', legend: false, title: 'Plan', gap: 56})
    .add(legacyFaultTree(tree), legacyBowtie(risk, {id: 'risk'}), legacyConnect('event:bottom', 'risk:top', link)), {measure});
  const body = (svg: string) => svg.slice(svg.indexOf('  <defs>'));
  assert.deepEqual(result.xml, []);
  assert.deepEqual(result.verdict.problems, expected.verdict.problems);
  assert.equal(body(result.svg), body(expected.svg));
});

test('selective cloud preserves conflict, assumptions and scoped anchors', async () => {
  const boxes = {a: {id: 'goal', text: '成功'}, b: '品質', c: '市場', d: '検証', d2: '公開'} as const;
  const opts = {scope: 'choices', conflictLabel: '対立', assumptions: [{on: 'bd', text: '長い検証が必要', injection: '自動化'}]} satisfies NonNullable<Parameters<typeof cloud>[1]>;
  const next = {id: 'next', title: 'Review'} as const;
  const link = {label: '目的'};
  const selected = await renderBands([cloud(boxes, opts), box(next), connect('choices.goal:bottom', 'next:top', link)], {measure, title: 'Plan', gap: 56});
  const expected = await renderInBrowser(diagram({theme: 'blue', title: 'Plan', legend: false, gap: 56})
    .add(legacyCloud(boxes, opts), legacyBox(next), legacyConnect('choices.goal:bottom', 'next:top', link)), {measure});
  assert.deepEqual(selected.xml, []);
  assert.deepEqual(selected.verdict.problems, expected.verdict.problems);
  assert.equal(selected.svg.slice(selected.svg.indexOf('  <defs>')), expected.svg.slice(expected.svg.indexOf('  <defs>')));
});

test('selective class and BPMN diagrams preserve relations, lanes and both orientations', async () => {
  const classes = [{id: 'base', name: '親クラス', methods: ['run()']}, {id: 'child', name: '子クラス'}] satisfies Parameters<typeof classDiagram>[0];
  const relations = [{from: 'child', to: 'base', kind: 'inherit'}] as const;
  const lanes = [{id: 'work', label: '担当'}];
  const nodes = [{id: 'start', lane: 'work', kind: 'start'}, {id: 'task', lane: 'work', label: 'Review'}, {id: 'end', lane: 'work', kind: 'end'}] as const;
  const flows = [{from: 'start', to: 'task'}, {from: 'task', to: 'end'}];
  const opts = {measure, title: 'Plan', gap: 17};
  const result = await renderBands([
    classDiagram(classes, relations), bpmn(lanes, nodes, flows, {scope: 'horizontal'}), bpmn(lanes, nodes, flows, {dir: 'v', scope: 'vertical'}),
  ], opts);
  const expected = await renderInBrowser(diagram({theme: 'blue', title: opts.title, gap: opts.gap, legend: false})
    .add(legacyClassDiagram(classes, relations), legacyBpmn(lanes, nodes, flows, {scope: 'horizontal'}), legacyBpmn(lanes, nodes, flows, {dir: 'v', scope: 'vertical'})), {measure});
  const body = (svg: string) => svg.slice(svg.indexOf('  <style>'));
  assert.deepEqual(result.xml, []);
  assert.deepEqual(result.verdict.problems, expected.verdict.problems);
  assert.equal(body(result.svg), body(expected.svg));
});

test('selective states and flowcharts preserve loops, decisions and scoped anchors', async () => {
  const states = [{id: 'idle', label: '待機'}, {id: 'active', label: 'Review', final: true}] as const;
  const transitions = [{from: 'idle', to: 'active', label: '開始'}, {from: 'active', to: 'active', label: '継続'}];
  const nodes = [{id: 'start', label: '開始', kind: 'terminator'}, {id: 'active', label: '承認する？', kind: 'decision'}, {id: 'done', label: '完了'}] as const;
  const flows = [{from: 'start', to: 'active'}, {from: 'active', to: 'done', label: 'はい'}];
  const a = {initial: 'idle', scope: 'state'};
  const b = {scope: 'flow'};
  const link = {label: '次へ'};
  const opts = {measure, title: 'Plan', gap: 60};
  const result = await renderBands([stateDiagram(states, transitions, a), flowchart(nodes, flows, b), connect('state.active:bottom', 'flow.start:top', link)], opts);
  const legacy = await renderInBrowser(diagram({theme: 'blue', title: opts.title, gap: opts.gap, legend: false})
    .add(legacyStateDiagram(states, transitions, a), legacyFlowchart(nodes, flows, b), legacyConnect('state.active:bottom', 'flow.start:top', link)), {measure});
  assert.deepEqual(result.xml, []);
  assert.deepEqual(result.verdict.problems, legacy.verdict.problems);
  const body = (svg: string) => svg.slice(svg.indexOf('  <defs>'));
  assert.equal(body(result.svg), body(legacy.svg));
});

test('selective trees and mindmaps preserve nested bands, funnel edges and stages', async () => {
  const input = (root: TreeItem['band'], child: TreeItem['band']): TreeItem => ({
    label: '親', band: root, w: 400, children: [{label: '子', band: child, from: 'target', w: 210}],
  });
  const map = {label: '議題', children: [{label: '選択肢'}, {label: '条件'}]};
  const draw = (stage: number) => renderBands([
    tree(input(row([box({id: 'target', title: '起点'})]), box({title: '詳細', reveal: 2})), {dir: 'down'}),
    mindmap(map, {edges: 'curve'}),
  ], {measure, title: 'Plan', stage});
  const expected = await renderInBrowser(diagram({theme: 'blue', title: 'Plan', legend: false})
    .add(legacyTree(input(legacyRow([legacyBox({id: 'target', title: '起点'})]),
      legacyBox({title: '詳細', reveal: 2})), {dir: 'down'}), legacyMindmap(map, {edges: 'curve'})), {measure});
  const body = (svg: string) => svg.slice(svg.indexOf('  <style>'));
  for (const stage of [0, 2]) {
    const selected = await draw(stage);
    assert.deepEqual(selected.xml, []);
    assert.equal(body(selected.svg), body(emitSvg(expected.laidOut, {reveal: stage})));
    assert.equal(selected.svg.includes('>詳細</text>'), stage === 2);
  }
});

test('selective cause diagrams preserve AND arcs, relation counts and PDPC branches', async () => {
  const nodes = [{id: 'a', label: 'Review'}, {id: 'b', label: '手順'}, {id: 'c', label: '結果'}];
  const links = [{from: 'a', to: 'b'}, {from: 'a', to: 'c'}];
  const and = [{from: ['a', 'b'], to: 'c'}];
  const opts = {measure, title: 'Plan'};
  const result = await renderBands([
    causeTree(nodes, and, {scope: 'cause'}), relationDiagram(nodes, links, {scope: 'relation'}), pdpc(nodes, links, {scope: 'plan'}),
  ], opts);
  const expected = await renderInBrowser(diagram({theme: 'blue', title: opts.title, legend: false})
    .add(legacyCauseTree(nodes, and, {scope: 'cause'}), legacyRelationDiagram(nodes, links, {scope: 'relation'}), legacyPdpc(nodes, links, {scope: 'plan'})), {measure});
  const body = (svg: string) => svg.slice(svg.indexOf('  <style>'));
  assert.deepEqual(result.xml, []);
  assert.deepEqual(result.verdict.problems, expected.verdict.problems);
  assert.match(result.svg, /出 2・入 0/);
  assert.equal(body(result.svg), body(expected.svg));
});

test('selective swimlanes preserve lane frames, step reveal and labelled hand-offs', async () => {
  const {describeSwimlane} = await import('../lib/diagram-description.ts');
  const lanes = [{id: 'a', label: '画面'}, {id: 'b', label: '処理'}];
  const steps = [{id: 'start', lane: 'a', title: '開始', body: 'ABC', bodyMono: true}, {id: 'done', lane: 'b', title: '完了', reveal: 2}];
  const options = {flows: [{from: 'start', to: 'done', label: 'Review'}], boundaries: [{after: 'a', label: '境界'}]};
  const selected = swimlane(lanes, steps, options, connectDefinition);
  const laneBand = selected.find(band => band.type === 'swimlane');
  assert.ok(laneBand);
  assert.equal(describeSwimlane(laneBand, 1), 'レーン: 画面、処理。手順: 開始');
  const expected = await renderInBrowser(diagram({theme: 'blue', title: 'Plan', legend: false})
    .add(legacySwimlane(lanes, steps, options)), {measure});
  for (const stage of [0, 2]) {
    const result = await renderBands(selected, {measure, title: 'Plan', stage});
    assert.deepEqual(result.xml, []);
    const body = (svg: string) => svg.slice(svg.indexOf('  <style>'));
    assert.equal(body(result.svg), body(emitSvg(expected.laidOut, {reveal: stage})));
  }
});

test('selective radar and waterfall coexist and preserve legacy drawing and checks', async () => {
  const axes = ['品質', '価格', '納期'];
  const series = [{label: 'Review', values: [4, 3, 5]}];
  const totals = [{label: '前期', value: 100}, {label: '増加', value: 25}, {label: '今期', kind: 'total'}] as const;
  const result = await renderBands([radar(axes, series, {max: 5}), waterfall(totals)], {measure, title: 'Plan'});
  const expected = await renderInBrowser(diagram({theme: 'blue', title: 'Plan', legend: false})
    .add(legacyRadar(axes, series, {max: 5}), legacyWaterfall(totals)), {measure});
  const body = (svg: string) => svg.slice(svg.indexOf('  <style>'));
  assert.deepEqual(result.xml, []);
  assert.deepEqual(result.verdict.problems, expected.verdict.problems);
  assert.equal(body(result.svg), body(expected.svg));
});

test('selective Sankey and heatmap preserve labelled flows, missing cells and scales', async () => {
  const nodes = ['入力', '出力'];
  const links = [{from: '入力', to: '出力', value: 5}];
  const rows = ['甲', '乙'], cols = ['前期', '今期'], values = [[1, null], [2, 5]];
  const selected = await renderBands([sankey(nodes, links, {linkLabels: true}), heatmap(rows, cols, values, {scale: true})], {measure, title: 'Plan'});
  const legacy = await renderInBrowser(diagram({theme: 'blue', title: 'Plan', legend: false})
    .add(legacySankey(nodes, links, {linkLabels: true}), legacyHeatmap(rows, cols, values, {scale: true})), {measure});
  const body = (svg: string) => svg.slice(svg.indexOf('  <style>'));
  assert.deepEqual(selected.xml, []);
  assert.deepEqual(selected.verdict.problems, legacy.verdict.problems);
  assert.equal(body(selected.svg), body(legacy.svg));
});

test('selective stacked bars, Mekko and treemap preserve labels and anchors', async () => {
  const columns = [
    {label: '前期', id: 'previous', parts: [{label: '甲', value: 2}, {label: '乙', value: 3}]},
    {label: '今期', id: 'current', parts: [{label: '甲', value: 4}, {label: '乙', value: 5}]},
  ];
  const nodes = {label: '全体', id: 'total', children: [{label: '一部', id: 'part', value: 6}, {label: '残り', value: 4}]};
  const selected = await renderBands([
    stackedBars(columns, {id: 'stack', percent: true}),
    mekko(columns.map(({label, parts}) => ({label, parts})), {id: 'mekko'}),
    treemap(nodes, {percent: true}),
  ], {measure, title: 'Plan'});
  const legacy = await renderInBrowser(diagram({theme: 'blue', title: 'Plan', legend: false}).add(
    legacyStackedBars(columns, {id: 'stack', percent: true}),
    legacyMekko(columns.map(({label, parts}) => ({label, parts})), {id: 'mekko'}),
    legacyTreemap(nodes, {percent: true}),
  ), {measure});
  const body = (svg: string) => svg.slice(svg.indexOf('  <style>'));
  assert.deepEqual(selected.xml, []);
  assert.deepEqual(selected.verdict.problems, legacy.verdict.problems);
  assert.equal(body(selected.svg), body(legacy.svg));
});

test('selective tornado, butterfly, bubble and Harvey charts preserve SVG and diagnostics', async () => {
  const cases = [{label: '単価', low: 12, high: 3, id: 'price'}, {label: '数量', low: 6, high: 10}];
  const groups = [{label: '品質', left: 6, right: 7, id: 'quality'}, {label: '価格', left: 5, right: 3}];
  const comparison = {leftLabel: '前期', rightLabel: '今期', sort: 'right' as const};
  const points = [{label: '主力', x: 2, y: 3, size: 8}, {label: '新規', x: 1, y: 7, size: 4}];
  const thresholds = {x: {min: 0, max: 4, line: 1.5, lineLabel: '基準'}, y: {min: 0, max: 9}};
  const rows = [{label: '費用', id: 'cost'}, '機能'], cols = ['甲', '乙'], values = [[4, 1], [null, 2]];
  const selected = await renderBands([
    tornado(cases, {base: 8, domain: [0, 15]}), butterfly(groups, comparison),
    bubble(points, thresholds), harvey(rows, cols, values, {highlight: ['甲']}),
  ], {measure, title: 'Plan'});
  const legacy = await renderInBrowser(diagram({theme: 'blue', title: 'Plan', legend: false}).add(
    legacyTornado(cases, {base: 8, domain: [0, 15]}), legacyButterfly(groups, comparison),
    legacyBubble(points, thresholds), legacyHarvey(rows, cols, values, {highlight: ['甲']}),
  ), {measure});
  const body = (svg: string) => svg.slice(svg.indexOf('  <style>'));
  assert.deepEqual(selected.xml, []);
  assert.deepEqual(selected.verdict.problems, legacy.verdict.problems);
  assert.equal(body(selected.svg), body(legacy.svg));
});

test('selective statistical charts preserve legacy SVG and share each family definition', async () => {
  const values = [1, 2, 3, 3, 5, 7];
  const columns = {x: [1, 2, 3, 4, 5, 6], y: [2, 5, 5, 7, 9, 10]};
  const rows = ['東京', '大阪'], cols = ['朝', '昼'], cells = [[2, 5], [6, 3]];
  const selected = await renderBands([
    catplot({東京: values}, {kind: ['box', 'strip']}), boxplot({大阪: values}),
    displot(values, {kind: ['hist', 'rug']}), histplot(values),
    hist2d(columns), jointplot(columns),
    regplot(columns), residplot(columns),
    clustermap(rows, cols, cells),
  ], {measure, title: 'Plan'});
  const legacy = await renderInBrowser(diagram({theme: 'blue', title: 'Plan', legend: false}).add(
    legacyCat({東京: values}, {kind: ['box', 'strip']}), legacyBoxplot({大阪: values}),
    legacyDist(values, {kind: ['hist', 'rug']}), legacyHist(values),
    legacyHist2d(columns), legacyJoint(columns),
    legacyReg(columns), legacyResid(columns),
    legacyCluster(rows, cols, cells),
  ), {measure});
  const body = (svg: string) => svg.slice(svg.indexOf('  <style>'));
  assert.deepEqual(selected.xml, []);
  assert.deepEqual(selected.verdict.problems, legacy.verdict.problems);
  assert.equal(body(selected.svg), body(legacy.svg));
});

test('selective comparison and network charts preserve legacy SVG and diagnostics', async () => {
  const categories = ['前期', '今期'];
  const series = [{label: '売上', type: 'bar' as const, values: [7, 8]}, {label: '利益率', type: 'line' as const, values: [2, 4]}];
  const axis = {y2: {min: 0, max: 5}};
  const cells = [[['○', '流用'], ['△', '要検討']]] as const;
  const tasks = [{id: 'start', label: '開始', duration: 1}, {id: 'finish', label: '完了', duration: 2, predecessors: ['start']}];
  const nodes = [{id: 'demand', label: '需要'}, {id: 'supply', label: '供給'}];
  const links = [{from: 'demand', to: 'supply', polarity: '+' as const}, {from: 'supply', to: 'demand', polarity: '-' as const, delay: true}];
  const deps = [{id: 'ui', label: '画面', kind: 'app'}, {id: 'api', label: 'API', kind: 'service'}];
  const edges = [{from: 'ui', to: 'api', type: 'uses', weight: 3}];
  const selected = await renderBands([
    combo(categories, series, axis), compare(['費用'], ['案A', '案B'], cells), pert(tasks, {compact: true}),
    causalLoop(nodes, links), dependencyNetwork(deps, edges),
  ], {measure, title: 'Plan'});
  const legacy = await renderInBrowser(diagram({theme: 'blue', title: 'Plan', legend: false}).add(
    legacyCombo(categories, series, axis), legacyCompare(['費用'], ['案A', '案B'], cells), legacyPert(tasks, {compact: true}),
    legacyCausal(nodes, links), legacyDependency(deps, edges),
  ), {measure});
  const body = (svg: string) => svg.slice(svg.indexOf('  <style>'));
  assert.deepEqual(selected.xml, []);
  assert.deepEqual(selected.verdict.problems, legacy.verdict.problems);
  assert.equal(body(selected.svg), body(legacy.svg));
});

const embeddedPixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function scopedComic() {
  return band(comicDefinition, legacyComic({
    version: 1, title: '手順', layout: '1x2', cast: {}, panels: [
      {id: 'panel', stage: [], dialogue: [{id: 'note', kind: 'narration', tpl: '{slot}', slots: {slot: {max: 2, prompt: '次'}}}]},
      {id: 'end', stage: [], dialogue: []},
    ],
  }, {id: 'sheet', scope: 'comic'}));
}

test('figure rectangles preserve anchor names, intentional overlap and emblem bounds', () => {
  const anchor = {id: 'shape', x: 44, y: 28, w: 22, h: 36};
  const bounds = {...anchor, x: 36, w: 38};
  const figure = {id: 'figure', x: 20, y: 24, w: 100, h: 40, anchors: [anchor]};
  const obstacle = {...anchor, label: 'shape', holds: ['figure']};
  assert.deepEqual(figureRects(figure), [obstacle]);
  assert.deepEqual(overlappingFigureRects(figure), [{...obstacle, holds: ['figure', '@intentional-overlap:20,24']}]);
  assert.deepEqual(emblemRects({...figure, bounds: [bounds]}), [{...obstacle, ...bounds}]);
  assert.deepEqual(emblemRects(figure), [obstacle]);
});

test('caption, badge and row rectangles describe only ink, the pill and child boxes', async () => {
  const child = box({id: 'child', title: '内容'});
  markSpecPart([child], 'parts[3].children[0]');
  const {placed} = await prepareBands([
    status('draft'), caption('補足'), group(spacer(12), {title: '見出し'}), row([child]),
  ], {measure});
  const [badge] = placed.laidOut, [standalone, heading] = placed.laidOut.filter(laid => laid.type === 'caption');
  const placedRow = placed.laidOut.find(laid => laid.type === 'row');
  assert.ok(badge?.type === 'status' && standalone && heading?.inkBox && placedRow);
  assert.deepEqual(statusRects(badge), [{id: null, label: 'status badge', ...badge.pill}]);
  assert.deepEqual(captionRects(standalone), []);
  assert.deepEqual(captionRects(heading), [{id: null, label: 'group title "見出し"', ...heading.inkBox}]);
  assert.deepEqual(childRects(placedRow).map(rect => [rect.id, rect.label, rect.loc?.specPath]), [
    ['child', '内容', 'parts[3].children[0]'],
  ]);
});

test('comic rectangles qualify panels and give repeated slots to their first panel', async () => {
  const {placed} = await prepareBands([scopedComic()], {measure});
  const [comic] = placed.laidOut;
  assert.ok(comic?.type === 'comic');
  const [bubble] = comic.bubbles;
  assert.ok(bubble);
  const repeated = {...comic, bubbles: [bubble, {...bubble, panel: 'end'}]};
  assert.equal(comicSlotOwners(repeated).get('slot'), bubble);
  assert.deepEqual(comicRects(repeated).map(rect => [rect.id, rect.holds]), [
    ['comic.panel', ['sheet', 'comic.slot']],
    ['comic.end', ['sheet']],
  ]);
});

test('every selective band type returns the legacy rectangles for the same placement', async () => {
  const child = box({id: 'child', title: '内容'});
  markSpecPart([child], 'parts[0].children[0]');
  type SelectedBands = Parameters<typeof prepareBands>[0];
  const cases = {
    caption: [caption('補足'), group(child, {title: '見出し'})],
    box: [child],
    banner: [banner({headline: '見出し'})],
    group: [group(child)],
    legend: [legend([{label: '注意', tone: 'danger'}])],
    row: [row([child, box({title: '隣'})])],
    grid: [grid([child, box({title: '隣'})], {cols: 2})],
    raw: [raw({h: 32, draw: () => '<rect width="24" height="12"/>'})],
    status: [status('draft')],
    pyramid: [pyramid(['確認', '出荷'])],
    curve: [curve([{y: 0.2}, {y: 0.8}])],
    plane: [plane({x: {max: 10}, y: {max: 10}, points: [{id: 'point', at: [3, 6], label: '測定値'}]})],
    bars: [bars([{id: 'work', label: '計画', value: 2}])],
    chart: [waterfall([{id: 'start', label: '前月', value: 10}, {id: 'gain', label: '変更', value: 2}], {id: 'total'})],
    image: [image(embeddedPixel, {alt: '画像', marks: [{id: 'mark', rect: [0.1, 0.1, 0.3, 0.3], label: '印'}]})],
    people: [people(4, 2)],
    dots: [dots([0.2, 0.8])],
    math: [math('x^2')],
    quadrant: [quadrant({x: {title: '比較'}, y: {title: '効果'}, items: [{id: 'a', label: '実行', at: [0.6, 0.7]}]})],
    chevron: [chevron(flowSteps, {id: 'plan', scope: 'phase'})],
    wordart: [wordart('確認')],
    funnel: [funnel(funnelStages)],
    cycle: [cycle(flowSteps)],
    venn: [venn(vennSets)],
    concentric: [concentric(concentricRings)],
    emblem: [emblem(emblemItems)],
    valueChain: [valueChain(chainParts)],
    timeline: [timeline({from: '2026-01', to: '2026-06', now: {at: '2026-02'}, deadline: {at: '2026-06', label: '締切'}})],
    bowtie: [bowtie({top: '中断', threats: [{label: '故障'}], consequences: [{label: '遅延'}]})],
    comic: [scopedComic()],
    fta: [faultTree({label: '停止', gate: 'or', children: [{id: 'power', label: '電源', kind: 'basic'}, {label: '回線', kind: 'basic'}]})],
    tree: [tree({label: '親', children: [{label: '子', id: 'tip'}]})],
    states: [stateDiagram([{id: 'idle', label: '待機'}, {id: 'done', label: '完了'}], [{from: 'idle', to: 'done'}])],
    cause: [causeTree([{id: 'start', label: '原因'}, {id: 'end', label: '結果'}], [{from: 'start', to: 'end'}])],
    cloud: [cloud({a: {id: 'goal', text: '成功'}, b: '品質', c: '市場', d: '検証', d2: '公開'})],
    gantt: [gantt(rows)],
    classes: [classDiagram([{id: 'base', name: '親'}, {id: 'child', name: '子'}], [{from: 'child', to: 'base', kind: 'inherit'}])],
    bpmn: [bpmn([{id: 'work', label: '担当'}], [{id: 'start', lane: 'work', kind: 'start'}, {id: 'end', lane: 'work', kind: 'end'}], [{from: 'start', to: 'end'}])],
    swimlane: swimlane([{id: 'work', label: '担当'}], [{id: 'step', lane: 'work', title: '計画'}]),
    sequence: [sequence([{id: 'client', label: '画面'}, {id: 'server', label: 'API'}], [{from: 'client', to: 'server', label: '送信'}])],
    table: [table([{label: '状態'}], [['完了']])],
    wireframe: [wireframe(wf.col([wf.region('確認')]))],
    screens: [screens([{id: 'screen', title: '画面', root: wf.col([wf.region('確認')])}], {cols: 1})],
  } satisfies Record<LaidOutType, SelectedBands>;

  const compare = async (type: LaidOutType, bands: SelectedBands) => {
    const {placed} = await prepareBands(bands, {measure, title: '計画'});
    const handler: VerifyHandler<LaidOutBand> = VERIFY_HANDLERS[type] as VerifyHandler<LaidOutBand>;
    const def = bands[0]?.[DEF] as BandDef<unknown, LaidOutBand> | undefined;
    assert.ok(def);
    const matches = placed.laidOut.filter(band => band.type === type);
    assert.ok(matches.length, `missing placed ${type}`);
    for (const laid of matches) {
      const expected = handler.rects?.(laid) ?? [];
      // The legend handler is the legacy whole-band rectangle also used by the selective fallback.
      const actual: CheckRect[] = def.verify?.rects?.(laid) ?? ('h' in laid ? VERIFY_HANDLERS.legend.rects(laid) : []);
      assert.deepEqual(actual, expected, `${def.type} → ${type}`);
    }
  };
  for (const type of Object.keys(cases) as LaidOutType[]) await compare(type, cases[type]);
  await compare('row', [groupRow([child, group(box({title: '隣'}))])]);
  await compare('row', [areas('child', {child})]);
  await compare('box', cases.swimlane);
});

test('selective images preserve annotations, overlaid bands and mark connections', async () => {
  const options = {
    id: 'picture', width: 360, alt: '会議室',
    marks: [{id: 'marked', rect: [0.1, 0.65, 0.3, 0.2], label: '入口', reveal: 2}],
    labels: [{text: '出口', at: [0.7, 0.7]}],
  } as const;
  const bands = [
    image(embeddedPixel, {...options, over: box({title: 'Review'})}),
    box({id: 'details', title: 'Details'}), connect('marked:bottom', 'details:top'),
  ];
  const selected = await renderBands(bands, {measure, title: 'Plan', connectors: connectDefinition});
  const legacy = await renderInBrowser(diagram({theme: 'blue', title: 'Plan', legend: false}).add(
    legacyImage(embeddedPixel, {...options, over: legacyBox({title: 'Review'})}),
    legacyBox({id: 'details', title: 'Details'}), legacyConnect('marked:bottom', 'details:top'),
  ), {measure});
  const body = (svg: string) => svg.slice(svg.indexOf('  <style>'));
  assert.deepEqual(selected.xml, []);
  assert.deepEqual(selected.verdict.problems, legacy.verdict.problems);
  assert.equal(body(selected.svg), body(legacy.svg));
  const early = await renderBands(bands, {measure, stage: 1, connectors: connectDefinition});
  assert.doesNotMatch(early.svg, /入口|marker-end=/);
  assert.match(selected.svg, /入口/);
  assert.match(selected.svg, /marker-end=/);
  assert.throws(() => image('local.png', {alt: 'Picture'}), /data URI/);
});

test('selective composers preserve the SVG of canvas, hero, icon row and versus', async () => {
  const content = {strengths: ['技術'], weaknesses: ['知名度'], opportunities: ['需要'], threats: ['競合']};
  const heroOpts = {banner: {headline: '実績'}, stat: {value: 12, label: '件'}, caption: '見出し', note: '注記'};
  const icons = [{icon: 'check' as const, label: '確認'}];
  const sides = {left: {id: 'left', title: '案A'}, right: {id: 'right', title: '案B'}, shared: {id: 'shared', title: '共通'}};
  const actual = await renderBands([
    canvas('swot', content, {id: 'swot'}),
    ...hero({...heroOpts, flow: [box({title: '申請'})]}), iconRow(icons),
    ...versus({...sides.left, children: box({title: '費用'})}, {...sides.right, children: box({title: '納期'})},
      {shared: {...sides.shared, children: box({title: '品質'})}}),
  ], {measure, title: 'Plan'});
  const expected = await renderInBrowser(diagram({theme: 'blue', title: 'Plan', legend: false}).add(
    legacyCanvas('swot', content, {id: 'swot'}),
    ...legacyHero({...heroOpts, flow: [legacyBox({title: '申請'})]}), legacyIconRow(icons),
    ...legacyVersus({...sides.left, children: legacyBox({title: '費用'})}, {...sides.right, children: legacyBox({title: '納期'})},
      {shared: {...sides.shared, children: legacyBox({title: '品質'})}}),
  ), {measure});
  const body = (svg: string) => svg.slice(svg.indexOf('  <style>'));
  assert.deepEqual(actual.xml, []);
  assert.deepEqual(actual.verdict.problems, expected.verdict.problems);
  assert.equal(body(actual.svg), body(expected.svg));
});

test('selected state matrices preserve the drawing and missing-state findings', async () => {
  const {stateMatrix} = await import('../lib/bands/screens.ts');
  const {stateMatrix: legacyMatrix} = await import('../lib/web.ts');
  const cols: ['通常', '空'] = ['通常', '空'];
  const rows = [{label: '一覧', cells: [wf.text('商品'), undefined] as const}];
  const actual = await renderBands([stateMatrix(cols, rows)], {measure, title: '状態'});
  const old = await renderInBrowser(diagram({theme: 'blue', title: '状態', legend: false}).add(legacyMatrix(cols, rows)), {measure});
  const body = (svg: string) => svg.slice(svg.indexOf('  <style>'));
  assert.equal(body(actual.svg), body(old.svg));
  const missing = ({verdict}: typeof actual) => verdict.findings.filter(f => f.rule === 'wf-states-todo').map(f => f.message);
  assert.ok(missing(old).length);
  assert.deepEqual(missing(actual), missing(old));
});

test('selected arrow diagrams preserve the critical path and omit an optional caption', async () => {
  const {arrowDiagram} = await import('../lib/compose/selective/arrow-diagram.ts');
  const {arrowDiagram: legacyArrow} = await import('../lib/web.ts');
  const links = [{from: 1, to: 2, name: '設計', days: 5}, {from: 2, to: 3, name: '試験', days: 7}];
  for (const summary of [true, false]) {
    const actual = await renderBands(arrowDiagram(links, {summary}), {measure, title: '予定'});
    const old = await renderInBrowser(diagram({theme: 'blue', title: '予定', legend: false}).add(...legacyArrow(links, {summary})), {measure});
    const body = (svg: string) => svg.slice(svg.indexOf('  <style>'));
    assert.equal(body(actual.svg), body(old.svg));
  }
});

test('the table DSL preserves RACI rendering and table handles', async () => {
  const {raci} = await import('../lib/bands/table.ts');
  const {raci: legacyRaci} = await import('../lib/web.ts');
  const modern = raci(['Review'], ['Owner', 'Writer'], [['A', 'R']], {id: 'roles'});
  assert.equal(modern.right, 'roles:right');
  const actual = await renderBands([modern], {measure, title: 'Roles'});
  const old = await renderInBrowser(diagram({theme: 'blue', title: 'Roles', legend: false})
    .add(legacyRaci(['Review'], ['Owner', 'Writer'], [['A', 'R']], {id: 'roles'})), {measure});
  const body = (svg: string) => svg.slice(svg.indexOf('  <style>'));
  assert.equal(body(actual.svg), body(old.svg));
});

test('the selective why-why tree keeps the captions and RCA findings', async () => {
  const {whyWhyTree} = await import('../lib/compose/selective/why-why-tree.ts');
  const {whyWhyTree: legacyTree} = await import('../lib/web.ts');
  const whys = [{why: '検証が遅れた', trueCause: true, measure: '検証を先にする'}] as const;
  const selected = whyWhyTree('リリース遅延', whys, {id: 'analysis'});
  assert.equal(selected[0].right, 'analysis:right');
  const actual = await renderBands(selected, {measure, title: '対策'});
  const old = await renderInBrowser(diagram({theme: 'blue', title: '対策', legend: false})
    .add(...legacyTree('リリース遅延', whys, {id: 'analysis'})), {measure});
  const body = (svg: string) => svg.slice(svg.indexOf('  <style>'));
  assert.equal(body(actual.svg), body(old.svg));
  assert.deepEqual(actual.verdict.findings.filter(f => f.rule.startsWith('whywhy-')).map(f => f.message),
    old.verdict.findings.filter(f => f.rule.startsWith('whywhy-')).map(f => f.message));
});

test('wireframe constructors can be imported and composed independently', async () => {
  const builders = await import('../lib/wireframe-builders.ts');
  assert.deepEqual(Object.keys(builders), Object.keys(wf).sort());
  for (const name of Object.keys(builders) as (keyof typeof builders)[]) assert.equal(builders[name], wf[name]);
  const {col, btn, text: wfText, insight} = builders;
  const modern = col([[wfText('Overview'), false], btn('Next')]);
  assert.deepEqual(modern, wf.col([[wf.text('Overview'), false], wf.btn('Next')]));
  assert.throws(() => insight({title: 'Unread', evidence: []}), /evidence is required/);
  const actual = await renderBands([wireframe(modern)], {measure, title: 'Review'});
  const old = await renderInBrowser(diagram({theme: 'blue', title: 'Review', legend: false}).add(legacyWireframe(modern)), {measure});
  const body = (svg: string) => svg.slice(svg.indexOf('  <style>'));
  assert.equal(body(actual.svg), body(old.svg));
});

test('basic wireframes draw shared widgets and reject widgets outside the selected renderer', async () => {
  const {wireframe: basic} = await import('../lib/bands/wireframe-basic.ts');
  const root = wf.col([wf.text('Overview'), wf.btn('Next')]);
  const actual = await renderBands([basic(root)], {measure, title: 'Review'});
  const expected = await renderBands([wireframe(root)], {measure, title: 'Review'});
  assert.equal(actual.svg, expected.svg);
  await assert.rejects(renderBands([basic(wf.fusion())], {measure}), /fusion/);
  await assert.rejects(renderBands([basic(wf.text('Overview', {state: 'loading'}))], {measure}), /loading/);
});

test('wireframes can register only the widget renderers they use', async () => {
  const {createWireframe, btnRenderer, colRenderer, textRenderer} = await import('../lib/wireframe-renderers.ts');
  assert.throws(() => createWireframe([btnRenderer, btnRenderer]), /already registered/);
  const selected = createWireframe([colRenderer, btnRenderer, textRenderer]);
  const root = wf.col([wf.text('Overview'), wf.btn('Next')]);
  const a = await renderBands([selected(root)], {measure, title: 'Review'});
  const b = await renderBands([wireframe(root)], {measure, title: 'Review'});
  assert.equal(a.svg, b.svg);
  await assert.rejects(renderBands([selected(wf.map())], {measure}), /map/);
});

test('selected monitoring widgets preserve formatted labels without the other renderers', async () => {
  const {createWireframe, batteryRenderer, colRenderer, signalRenderer} = await import('../lib/wireframe-renderers.ts');
  const selected = createWireframe([colRenderer, batteryRenderer, signalRenderer]);
  const root = wf.col([wf.battery(0.15), wf.signal(0)]);
  const a = await renderBands([selected(root)], {measure, title: '監視'});
  const b = await renderBands([wireframe(root)], {measure, title: '監視'});
  assert.equal(a.svg, b.svg);
  assert.match(a.svg, /15% 低下/);
  assert.match(a.svg, /途絶/);
  await assert.rejects(renderBands([selected(wf.fusion())], {measure}), /fusion/);
});

test('wireframe decorations can be selected independently', async () => {
  const {createWireframe, mapRenderer, regionRenderer, robotMarkers, widgetStates} = await import('../lib/wireframe-renderers.ts');
  const loading = wf.region('Review', {state: 'loading'});
  const map = wf.map({markers: [{id: 'A', x: 0.5, y: 0.5, heading: 90, fov: 60}]});
  const stateOnly = createWireframe([regionRenderer, mapRenderer], {states: widgetStates});
  const markerOnly = createWireframe([regionRenderer, mapRenderer], {robotMarkers});
  const regions = (['missing', 'disconnected', 'loading', 'empty', 'stale'] as const)
    .map(state => wf.region('Review', {state}));
  for (const [draw, root] of [...regions.map(region => [stateOnly, region] as const), [markerOnly, map] as const]) {
    const a = await renderBands([draw(root)], {measure});
    const b = await renderBands([wireframe(root)], {measure});
    assert.equal(a.svg, b.svg);
  }
  await assert.rejects(renderBands([stateOnly(map)], {measure}), /robot marker/);
  await assert.rejects(renderBands([markerOnly(loading)], {measure}), /loading/);
});

test('dialog and toast overlays opt in separately and preserve their SVG', async () => {
  const {createWireframe, btnRenderer, dialogRenderer, textRenderer, toastRenderer} = await import('../lib/wireframe-renderers.ts');
  const root = wf.text('Overview');
  const dialog = wf.dialog('Confirm', {body: 'Ready to send?', buttons: [wf.btn('Send')]});
  const toast = wf.toast('Sent');
  const dialogs = createWireframe([textRenderer, btnRenderer], {dialog: dialogRenderer});
  const toasts = createWireframe([textRenderer], {toast: toastRenderer});
  for (const [draw, overlay] of [[dialogs, dialog], [toasts, toast]] as const) {
    const a = await renderBands([draw(root, {overlays: [overlay]})], {measure});
    const b = await renderBands([wireframe(root, {overlays: [overlay]})], {measure});
    assert.equal(a.svg, b.svg);
  }
  await assert.rejects(renderBands([dialogs(root, {overlays: [toast]})], {measure}), /toast/);
  await assert.rejects(renderBands([toasts(root, {overlays: [dialog]})], {measure}), /dialog/);
});

test('selected screens and state matrices use one widget registry', async () => {
  const {createScreenGrid, createScreens, createStateMatrix, textRenderer} = await import('../lib/wireframe-renderers.ts');
  const {screens: legacyScreens, stateMatrix: legacyMatrix} = await import('../lib/bands/screens.ts');
  const {screens, stateMatrix} = createScreens([textRenderer]);
  const items = [{id: 'first', title: '始め', root: wf.text('概要')}, {id: 'next', title: '次', root: wf.text('続き')}];
  const cols: ['通常', '空'] = ['通常', '空'];
  const rows = [{label: '内容', cells: [wf.text('商品'), undefined] as const}];
  const modern = await renderBands([screens(items), stateMatrix(cols, rows)], {measure});
  const original = await renderBands([legacyScreens(items), legacyMatrix(cols, rows)], {measure});
  const screenGrid = createScreenGrid([textRenderer]);
  const matrix = createStateMatrix([textRenderer]);
  const separate = await renderBands([screenGrid(items), matrix(cols, rows)], {measure});
  assert.equal(modern.svg, original.svg);
  assert.deepEqual(plain(separate), plain(modern));
  assert.ok(modern.verdict.findings.some(finding => finding.rule === 'wf-states-todo'));
  await assert.rejects(renderBands([screens([{id: 'first', title: '地図', root: wf.map()}])], {measure}), /map/);
});

test('selective figure findings use the content extent and skip fixed canvases', async () => {
  const findings = ({verdict}: Awaited<ReturnType<typeof renderBands>>) =>
    verdict.findings.filter(f => f.rule === 'layout-figure-offset' || f.rule === 'layout-figure-narrow');
  const opts = {theme: 'blue', legend: false, width: 940} as const;
  const layerOptions = {width: 260};
  const legendItems = [{label: '強調項目', tone: 'accent'}] as const;
  const selected = [status('draft'), caption('図全体の幅を取る説明'),
    pyramid(['計画', '実行'], layerOptions), legend([...legendItems])];
  const legacy = await renderInBrowser(diagram({...opts, status: 'draft'})
    .add(legacyCaption('図全体の幅を取る説明'),
      legacyPyramid(['計画', '実行'], layerOptions), legacyLegend([...legendItems])), {measure});
  assert.ok(findings(legacy).some(f => f.rule === 'layout-figure-narrow'));
  assert.deepEqual(findings(await renderBands(selected, {measure, width: opts.width})), findings(legacy));
  assert.deepEqual(findings(await renderBands(selected, {measure, canvas: {width: opts.width}})), []);

  const narrowGrid = {cols: 4};
  const legacyGridResult = await renderInBrowser(diagram(opts).add(legacyGrid([legacyBox({title: '左端'})], narrowGrid)), {measure});
  const selectedGridResult = await renderBands([grid([box({title: '左端'})], narrowGrid)], {measure, width: opts.width});
  assert.ok(findings(legacyGridResult).some(f => f.rule === 'layout-figure-offset'));
  assert.deepEqual(findings(selectedGridResult), findings(legacyGridResult));
});

test('selective funnels and quadrants preserve their band-specific warnings', async () => {
  const stages = [{label: '入口', value: 1}, {label: '出口', value: 2}];
  const items = {x: {title: '比較'}, y: {title: '効果'}, items: [
    ...Array.from({length: 6}, (_, i) => ({label: `長い名前の項目${i}`, at: [0.35, 0.35] as [number, number], size: 1000, tone: 'danger' as const})),
    {label: '小規模', at: [0.8, 0.8] as [number, number], size: 1, tone: 'muted' as const},
  ]};
  const actual = await renderBands([funnel(stages, {scale: 'value'}), quadrant(items)], {measure});
  const legacy = await renderInBrowser(diagram({theme: 'blue', legend: false})
    .add(legacyFunnel(stages, {scale: 'value'})).add(legacyQuadrant(items)), {measure});
  const notes = ({verdict}: typeof actual) => verdict.findings
    .filter(f => f.rule === 'funnel-values-rise' || f.rule.startsWith('quadrant-'))
    .map(({rule, severity, message}) => ({rule, severity, message})).sort((a, b) => a.rule.localeCompare(b.rule));
  assert.deepEqual(notes(legacy).map(f => f.rule), [
    'funnel-values-rise', 'quadrant-empty-cell', 'quadrant-item-moved', 'quadrant-size-floor', 'quadrant-tone-only',
  ]);
  assert.deepEqual(notes(actual), notes(legacy));
});

test('selective bars report the first thin bar warning once per diagram', async () => {
  const data = [{label: '細', value: 0.5}, {label: '太', value: 100}, {label: 'ゼロ', value: 0}];
  const options = {dir: 'v', labels: 'none', axis: false, height: 60} as const;
  const actual = await renderBands([bars(data, options), bars(data, options)], {measure, title: '比較'});
  const legacy = await renderInBrowser(diagram({theme: 'blue', title: '比較', legend: false})
    .add(legacyBars(data, options)).add(legacyBars(data, options)), {measure});
  const notes = ({verdict}: typeof actual) => verdict.findings.filter(f => f.rule === 'bars-thin-bar')
    .map(({rule, severity, message}) => ({rule, severity, message}));
  assert.equal(notes(legacy).length, 1);
  assert.deepEqual(notes(actual), notes(legacy));
});

test('large image warnings appear in the selective verdict findings', async () => {
  const options = {alt: '会議室'};
  const bytes = 350 * 1024;
  const actual = await renderBands([Object.assign(image(embeddedPixel, options), {bytes})], {measure, title: '写真'});
  const legacy = await renderInBrowser(diagram({theme: 'blue', title: '写真', legend: false})
    .add(Object.assign(legacyImage(embeddedPixel, options), {bytes})), {measure});
  const notes = ({verdict}: typeof actual) => verdict.findings.filter(f => f.rule === 'image-large')
    .map(({rule, severity, message}) => ({rule, severity, message}));
  assert.equal(notes(legacy).length, 1);
  assert.deepEqual(notes(actual), notes(legacy));
});

test('selected flowchart and concentric checks preserve branch and label findings', async () => {
  const nodes = [{id: 'a', label: '確認', kind: 'decision'}, {id: 'b', label: '次'}, {id: 'c', label: '戻る'}] as const;
  const edges = [{from: 'a', to: 'b'}, {from: 'a', to: 'c'}] as const;
  const rings = ['Adopt', 'Trial', 'Assess', 'Hold'].map(label => ({label}));
  const options = {order: 'inner-first', sectors: ['仕事・学び', '人間関係', '成長・健康', '余暇'].map(label => ({label})),
    marks: ['Cloudflare Workers', 'Amazon Web Services'].map(label => ({label, sector: 1, ring: 1}))} as const;
  const selected = await renderBands([flowchart(nodes, edges), concentric(rings, options)], {measure});
  const legacy = await renderInBrowser(diagram({theme: 'blue', legend: false})
    .add(legacyFlowchart(nodes, edges), legacyConcentric(rings, options)), {measure});
  const notes = ({verdict}: typeof selected) => verdict.findings
    .filter(f => f.rule === 'flowchart-decision-edges' || f.rule === 'concentric-label-crossing')
    .map(({rule, severity, message}) => ({rule, severity, message})).sort((a, b) => a.rule.localeCompare(b.rule));
  assert.ok(notes(legacy).some(f => f.rule === 'flowchart-decision-edges'));
  assert.ok(notes(legacy).some(f => f.rule === 'concentric-label-crossing'));
  assert.deepEqual(notes(selected), notes(legacy));
});

test('selected canvases report required empty regions and wrapped source lines', async () => {
  const {captionDefinition} = await import('../lib/bands/caption.ts');
  const content = {strengths: ['技術'], weaknesses: ['知名度']};
  const sourceLine = '出典 ' + '公開統計をもとに集計した結果'.repeat(7);
  const opts = {width: 720, title: '比較', sourceLine};
  const actual = await renderBands([canvas('swot', content, {requireAll: true})], {...opts, measure, captions: captionDefinition});
  const legacy = await renderInBrowser(diagram({...opts, theme: 'blue', legend: false})
    .add(legacyCanvas('swot', content, {requireAll: true})), {measure});
  const notes = ({verdict}: typeof actual) => verdict.findings
    .filter(f => f.rule === 'source-wraps' || f.rule === 'canvas-region-empty')
    .map(({rule, severity, message}) => ({rule, severity, message})).sort((a, b) => a.rule.localeCompare(b.rule));
  assert.deepEqual(notes(legacy).map(f => f.rule), ['canvas-region-empty', 'source-wraps']);
  assert.deepEqual(notes(actual), notes(legacy));
});

test('selective box size warning groups nested boxes once', async () => {
  const opts = {title: '計画'};
  const lanes = [{id: 'team', label: '担当'}];
  const steps = [{id: 'step', lane: 'team', title: '作業', size: 17 as const}];
  const selected = await renderBands([
    box({title: '先頭', size: 20}),
    group([grid([box({title: '内側', size: 18}), box({title: '通常'})], {cols: 2})]),
    ...swimlane(lanes, steps),
  ], {...opts, measure});
  const legacy = await renderInBrowser(diagram({...opts, theme: 'blue', legend: false}).add(
    legacyBox({title: '先頭', size: 20}),
    legacyGroup([legacyGrid([legacyBox({title: '内側', size: 18}), legacyBox({title: '通常'})], {cols: 2})]),
    ...legacySwimlane(lanes, steps),
  ), {measure});
  const warnings = ({verdict}: typeof selected) => verdict.findings.filter(f => f.rule === 'box-size-ignored')
    .map(({rule, severity, message}) => ({rule, severity, message}));
  assert.equal(warnings(legacy).length, 1);
  assert.match(warnings(legacy)[0]?.message ?? '', /3 個の箱/);
  assert.deepEqual(warnings(selected), warnings(legacy));
  const laneOnly = await renderBands(swimlane(lanes, steps), {...opts, measure});
  assert.match(warnings(laneOnly)[0]?.message ?? '', /1 個の箱/);
});

test('selected BPMN and swimlanes report excessively narrow wrapped text', async () => {
  const {fontMeasurer} = await import('../lib/node-measure.ts');
  const {JA_FONTS} = await import('./helpers/text-engine.ts');
  const measure = fontMeasurer(JA_FONTS);
  const lanes = [{id: 'team', label: '担当'}];
  const nodes = Array.from({length: 8}, (_, i) => ({id: `n${i}`, lane: 'team', label: '在庫を確認する'}));
  const flows = nodes.slice(1).map(({id}, i) => ({from: nodes[i]!.id, to: id}));
  const steps = Array.from({length: 11}, (_, i) => ({id: `s${i}`, lane: 'team', col: i + 1, title: '在庫を確認する'}));
  const options = {fit: 'shrink'} as const;
  const actual = await renderBands([bpmn(lanes, nodes, flows, options), ...swimlane(lanes, steps, options)], {measure});
  const legacy = await renderInBrowser(diagram({theme: 'blue', legend: false})
    .add(legacyBpmn(lanes, nodes, flows, options), ...legacySwimlane(lanes, steps, options)), {measure});
  const messages = ({verdict}: typeof actual) => verdict.findings
    .filter(f => f.rule === 'shrink-narrow-text').map(f => f.message);
  assert.equal(messages(legacy).length, 2);
  assert.deepEqual(messages(actual), messages(legacy));
});

test('selected connectors report labels that obscure arrows', async () => {
  const a = {id: 'a', title: '前'} as const, b = {id: 'b', title: '後'} as const;
  const arrow = {label: '長い確認事項を渡す', chip: true, route: 'straight'} as const;
  const columns = {justify: 'start', gap: 8} as const;
  const selected = await renderBands([row([box(a), box(b)], columns), connect('a:right', 'b:left', arrow)], {measure});
  const legacy = await renderInBrowser(diagram({theme: 'blue', legend: false})
    .add(legacyRow([legacyBox(a), legacyBox(b)], columns), legacyConnect('a:right', 'b:left', arrow)), {measure});
  const notes = ({verdict}: typeof selected) => verdict.findings.filter(f => f.rule === 'connect-label-covers-arrow')
    .map(({severity, message}) => ({severity, message}));
  assert.equal(notes(legacy).length, 1);
  assert.deepEqual(notes(selected), notes(legacy));
});

test('selected document width warnings honor the project limit and acceptance', async () => {
  const {documentAcceptHint, documentFindings} = await import('../lib/document-findings.ts');
  const opts = {title: '幅の比較', width: 800, maxWidth: 720, appearance: 'auto'} as const;
  const notes = ({verdict}: Awaited<ReturnType<typeof renderBands>>) => verdict.findings.filter(f => f.rule === 'doc-width')
    .map(({severity, message}) => ({severity, message}));
  for (const accept of [undefined, {'doc-width': '横長の表を表示する'}]) {
    const selected = await renderBands([box({title: '比較'})], {...opts, measure, accept, diagramFindings: documentFindings, diagramAcceptHint: documentAcceptHint});
    const legacy = await renderInBrowser(diagram({...opts, theme: 'blue', legend: false, accept}).add(legacyBox({title: '比較'})), {measure});
    assert.equal(notes(legacy)[0]?.severity, accept ? 'info' : 'warn');
    assert.deepEqual(notes(selected), notes(legacy));
    assert.deepEqual(selected.verdict.warnings, legacy.verdict.warnings);
  }
  assert.deepEqual(notes(await renderBands([box({title: '比較'})],
    {measure, maxWidth: 720, diagramFindings: documentFindings, canvas: {width: 800, height: 400}})), []);
});

test('selected connectors preserve crossing findings and loop-under advice', async () => {
  const boxes = ['調べる', '直す', '確かめる', '出す'].map(title => ({title}));
  for (const dip of [undefined, 60]) {
    const first = {route: 'loop-under', label: 'a'} as const;
    const second = {route: 'loop-under', label: 'b', dip} as const;
    const selected = await renderBands([row(boxes.map(b => box(b)), {id: 's'}),
      connect('s#4:bottom', 's#2:bottom', first), connect('s#3:bottom', 's#1:bottom', second)], {measure});
    const legacy = await renderInBrowser(diagram({theme: 'blue', legend: false}).add(
      legacyRow(boxes.map(b => legacyBox(b)), {id: 's'}),
      legacyConnect('s#4:bottom', 's#2:bottom', first), legacyConnect('s#3:bottom', 's#1:bottom', second)), {measure});
    const finding = ({verdict}: typeof selected) => verdict.findings.find(f => f.rule === 'edge-crossings');
    assert.match(finding(legacy)?.message ?? '', dip ? /交差する/ : /範囲が半端に重なる/);
    assert.deepEqual(finding(selected), finding(legacy));
    const warnings = ({verdict}: typeof selected) => verdict.warnings.filter(warning => warning.startsWith('[edge-crossings]'));
    assert.deepEqual(warnings(selected), warnings(legacy));
  }
});

test('selected rows and grids report dark-only text contrast problems like legacy rendering', async () => {
  const {darkOf} = await import('../lib/tokens.ts');
  const tones = {accent: {fill: '#e6d3bd', dark: {fill: darkOf('#22201b')}}};
  const opts = {appearance: 'auto', tones} as const;
  const input = {title: '入口', body: '本文', tone: 'accent'} as const;
  for (const [selectedBand, legacyBand] of [
    [box(input), legacyBox(input)],
    [row([box(input)]), legacyRow([legacyBox(input)])],
    [grid([box(input)], {cols: 1}), legacyGrid([legacyBox(input)], {cols: 1})],
  ] as const) {
    const selected = await renderBands([selectedBand], {...opts, measure});
    const legacy = await renderInBrowser(diagram({theme: 'blue', ...opts}).add(legacyBand), {measure});
    assert.ok(legacy.verdict.problems.some(problem => problem.includes('low contrast') && problem.endsWith('(暗い配色)')));
    assert.deepEqual(selected.verdict.problems, legacy.verdict.problems);
  }
});

test('selected document checks preserve pictograph, aspect and text budget diagnostics', async () => {
  const {aspectTallFindings, documentAcceptHint, documentFindings, pictographFindings, textBudgetFindings} = await import('../lib/document-findings.ts');
  const {prepareBands} = await import('../lib/core.ts');
  const items = Array.from({length: 31}, (_, index) => ({title: index ? `項目 ${index}` : '確認 ✅'}));
  const document = {diagramFindings: documentFindings, diagramAcceptHint: documentAcceptHint};
  const bands = items.map(item => box(item));
  const selected = await renderBands(bands, {measure, ...document});
  const {placed} = await prepareBands(bands, {measure});
  assert.deepEqual(pictographFindings(placed).map(f => f.rule), ['glyph-missing']);
  assert.equal(textBudgetFindings({...placed, laidOut: placed.laidOut.slice(0, 30)}).length, 0);
  assert.equal(textBudgetFindings(placed).length, 1);
  assert.deepEqual(aspectTallFindings(placed, () => placed.bands).map(f => f.rule), ['aspect-tall']);
  const legacy = await renderInBrowser(diagram({theme: 'blue', legend: false}).add(items.map(legacyBox)), {measure});
  const notes = ({verdict}: Pick<typeof selected, 'verdict'>) => verdict.findings.filter(f => ['glyph-missing', 'aspect-tall', 'density'].includes(f.rule));
  assert.deepEqual(notes(legacy).map(f => f.rule), ['glyph-missing', 'aspect-tall', 'density']);
  assert.deepEqual(notes(selected), notes(legacy));
  const warnings = ({verdict}: Pick<typeof selected, 'verdict'>) => verdict.warnings.filter(w => /^\[(?:glyph-missing|density)\]/.test(w));
  assert.deepEqual(warnings(selected), warnings(legacy));
  const accepted = await renderBands(bands, {measure, ...document, accept: {'glyph-missing': '確認済み', density: '比較のため'}});
  assert.deepEqual(notes(accepted).map(f => f.severity), ['info', 'info', 'info']);
  assert.deepEqual(warnings(accepted), []);
});

test('selected connectors detect orphan boxes and disconnected components like legacy rendering', async () => {
  const {graphFindings} = await import('../lib/verify-connection-graph.ts');
  const {SourceRef, withSource} = await import('../lib/source-ref.ts');
  const {prepareBands} = await import('../lib/core.ts');
  const items = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'orphan'].map(id => ({id, title: id}));
  const refs = items.map((_, index) => new SourceRef(undefined, `parts[${index}]`));
  const bands = [
    ...items.map((item, index) => withSource(box(item), refs[index])),
    connect('alpha', 'beta'), connect('beta', 'gamma'), connect('delta', 'epsilon'),
  ];
  const selected = await renderBands(bands, {measure});
  const {placed} = await prepareBands(bands, {measure});
  assert.deepEqual(graphFindings({...placed, connects: placed.connects.slice(0, 2)}, data => data, () => []), []);
  const legacy = await renderInBrowser(diagram({theme: 'blue', legend: false}).add(
    items.map((item, index) => withSource(legacyBox(item), refs[index])),
    legacyConnect('alpha', 'beta'), legacyConnect('beta', 'gamma'), legacyConnect('delta', 'epsilon'),
  ), {measure});
  const rules = ['graph-orphan-node', 'graph-disconnected'];
  const notes = ({verdict}: Pick<typeof selected, 'verdict'>) => verdict.findings.filter(f => rules.includes(f.rule));
  assert.deepEqual(notes(legacy).map(f => f.rule), rules);
  assert.deepEqual(notes(selected), notes(legacy));
  assert.deepEqual(notes(selected).map(f => f.loc?.specPath), ['parts[5]', 'parts[3]']);
  const warnings = ({verdict}: Pick<typeof selected, 'verdict'>) => verdict.warnings.filter(w => w.startsWith('[graph-'));
  assert.deepEqual(warnings(selected), warnings(legacy));
});

test('selected state diagrams report implicit and requested automatic fit changes', async () => {
  const nodes = Array.from({length: 9}, (_, i) => ({id: `s${i}`, label: `状態の名前が長い${i}`}));
  const links = nodes.slice(1).map((node, i) => ({from: nodes[i]!.id, to: node.id}));
  for (const dir of [undefined, 'auto'] as const) {
    const opts = {width: 700};
    const selected = await renderBands([stateDiagram(nodes, links, {dir})], {measure, ...opts});
    const legacy = await renderInBrowser(diagram({theme: 'blue', legend: false, ...opts}).add(legacyStateDiagram(nodes, links, {dir})), {measure});
    const notes = ({verdict}: Pick<typeof selected, 'verdict'>) => verdict.findings.filter(f => f.rule === 'auto-fit-applied');
    assert.deepEqual(notes(legacy).map(f => f.severity), [dir ? 'info' : 'warn']);
    assert.deepEqual(notes(selected), notes(legacy));
    const warnings = ({verdict}: Pick<typeof selected, 'verdict'>) => verdict.warnings.filter(w => w.startsWith('[auto-fit-applied]'));
    assert.deepEqual(warnings(selected), warnings(legacy));
  }
});

test('selected fault trees report a node width adjustment without suggesting a direction option', async () => {
  const {layoutFitFindings} = await import('../lib/verify-layout-fit.ts');
  const {prepareBands} = await import('../lib/core.ts');
  const children = ['電源設備の故障による停止', '空調設備の故障による停止', '回線の事業者側の障害',
    '保守作業の手順の誤り', '設定変更の検証漏れ', '容量の見積りの誤り'].map(label => ({label, kind: 'basic'} as const));
  const top = {label: '停止', gate: 'or', children} as const;
  const {placed, verdict} = await prepareBands([faultTree(top)], {measure, width: 800});
  const legacy = await renderInBrowser(diagram({theme: 'blue', width: 800, legend: false}).add(legacyFaultTree(top)), {measure});
  const selected = layoutFitFindings(placed.laidOut[0]!);
  assert.equal(selected.length, 1);
  assert.match(selected[0]!.message, /maxNodeW: 'auto'/);
  assert.doesNotMatch(selected[0]!.message, /dir/);
  assert.deepEqual(verdict.findings.filter(f => f.rule === 'auto-fit-applied'), selected);
  assert.deepEqual(selected, legacy.verdict.findings.filter(f => f.rule === 'auto-fit-applied'));
});

test('selected wireframes preserve callout notes and reading order diagnostics', async () => {
  const {calloutNoteFindings, calloutOrderFindings} = await import('../lib/verify-wireframe-callouts.ts');
  const {prepareBands} = await import('../lib/core.ts');
  const {wireframe: basic} = await import('../lib/bands/wireframe-basic.ts');
  const make = () => wf.col([wf.btn('a', {n: 4, h: 80}), wf.btn('b', {n: 2, h: 80}), wf.btn('c', {n: 2, h: 80})]);
  const opts = {title: '画面', notes: [{n: 1, title: 'a', text: '説明'}]};
  const band = basic(make(), opts);
  const {placed} = await prepareBands([band], {measure});
  const laid = placed.laidOut.find(item => item.type === 'wireframe');
  assert.ok(laid);
  assert.equal(calloutNoteFindings(band).length, 4);
  assert.deepEqual(calloutOrderFindings(laid).map(f => f.rule), ['wf-callout-order']);
  const legacy = await renderInBrowser(diagram({theme: 'blue', legend: false, title: '比較'}).add(legacyWireframe(make(), opts)), {measure});
  const findings = ({verdict}: Pick<typeof legacy, 'verdict'>) => verdict.findings
    .filter(f => f.rule.startsWith('wf-callout-') || f.rule === 'wf-note-no-callout').toSorted((a, b) => a.rule.localeCompare(b.rule));
  assert.equal(findings(legacy).length, 5);
  for (const build of [wireframe, basic]) {
    const result = await renderBands([build(make(), opts)], {measure, title: '比較'});
    assert.deepEqual(findings(result), findings(legacy));
    assert.deepEqual(result.verdict.warnings, legacy.verdict.warnings);
  }
});

test('selected bands infer one accessible title with the legacy precedence', async () => {
  const selected = await renderBands([chevron([{label: '手順'}]), group(box({title: '内容'}), {title: '枠'}),
    banner({headline: '見出し'}), caption('後の説明')], {measure});
  const legacy = await renderInBrowser(diagram({theme: 'blue', legend: false}).add(
    legacyChevron([{label: '手順'}]), legacyGroup(legacyBox({title: '内容'}), {title: '枠'}),
    legacyBanner({headline: '見出し'}), legacyCaption('後の説明')), {measure});
  assert.match(legacy.svg, /<title id="svg-title">見出し<\/title>/);
  assert.equal(selected.svg.match(/<title[^>]*>[^<]*<\/title>/)?.[0], legacy.svg.match(/<title[^>]*>[^<]*<\/title>/)?.[0]);
  assert.match(selected.svg, /aria-labelledby="svg-title svg-desc"/);
});

test('selected document checks warn when no accessible title can be inferred', async () => {
  const {definedDiagramTitle} = await import('../lib/diagram-title.ts');
  const {documentFindings, documentAcceptHint, missingTitleFindings} = await import('../lib/document-findings.ts');
  const band = box({title: '内容'});
  assert.equal(definedDiagramTitle({title: '  題名\n  続き  ', bands: [band]}), '題名 続き');
  assert.deepEqual(missingTitleFindings({medium: 'doc'}, '題名'), []);
  const result = await renderBands([band], {measure, diagramFindings: documentFindings, diagramAcceptHint: documentAcceptHint});
  const legacy = await renderInBrowser(diagram({theme: 'blue', legend: false}).add(legacyBox({title: '内容'})), {measure});
  const warnings = ({verdict}: Pick<typeof result, 'verdict'>) => verdict.warnings.filter(w => w.startsWith('[a11y-no-title]'));
  assert.equal(warnings(legacy).length, 1);
  assert.deepEqual(warnings(result), warnings(legacy));
  assert.doesNotMatch(result.svg, /<title id="svg-title"/);
});

test('selected hidden bar values are described when titled and warned about when unnamed', async () => {
  const {hiddenBarsDescription} = await import('../lib/diagram-description.ts');
  const {hiddenBarsTitleFindings} = await import('../lib/verify-bars.ts');
  const data = [{label: '前', value: 20}, {label: '後', value: 40, reveal: 2}];
  const opts = {labels: 'none', axis: false} as const;
  const band = bars(data, opts);
  assert.equal(hiddenBarsDescription(band, 1), '値: 前 20');
  assert.equal(hiddenBarsDescription(bars(data)), '');
  assert.deepEqual(hiddenBarsTitleFindings({medium: 'doc', bands: [band]}, () => '比較', items => items), []);
  const named = await renderBands([band], {measure, title: '比較', stage: 1});
  assert.match(named.svg, /<desc id="svg-desc">値: 前 20<\/desc>/);
  assert.doesNotMatch(named.svg, /後 40/);
  const unnamed = await renderBands([bars(data, opts)], {measure});
  const legacy = await renderInBrowser(diagram({theme: 'blue', legend: false}).add(legacyBars(data, opts)), {measure});
  const warnings = ({verdict}: Pick<typeof unnamed, 'verdict'>) => verdict.warnings.filter(w => w.startsWith('[bars-values-hidden]'));
  assert.equal(warnings(legacy).length, 1);
  assert.deepEqual(warnings(unnamed), warnings(legacy));
  assert.deepEqual(warnings(named), []);
});

test('selected captions flag a duplicated title except when showTitle is enabled', async () => {
  const {duplicateTitleFindings} = await import('../lib/verify-caption.ts');
  assert.deepEqual(duplicateTitleFindings({medium: 'doc', title: '先頭', bands: [caption('別'), caption('先頭')]}, items => items), []);
  for (const showTitle of [false, true]) {
    const input = {title: '比較', showTitle};
    const selected = await renderBands([caption('比較')], {measure, captions: captionDefinition, ...input});
    const legacy = await renderInBrowser(diagram({theme: 'blue', legend: false, ...input}).add(legacyCaption('比較')), {measure});
    const findings = ({verdict}: Pick<typeof selected, 'verdict'>) => verdict.findings.filter(f => f.rule === 'title-duplicated');
    assert.equal(findings(legacy).length, showTitle ? 0 : 1);
    assert.deepEqual(findings(selected), findings(legacy));
  }
});

test('selected SVG descriptions assemble visible band summaries in the legacy order', async () => {
  const {joinBandDescriptions} = await import('../lib/diagram-description.ts');
  const {describeChart} = await import('../lib/selective-chart.ts');
  const chart = heatmap(['状態'], ['結果'], [[1]], {alt: '分布'});
  assert.deepEqual(describeChart(chart), ['chart', '分布']);
  assert.equal(joinBandDescriptions([['image', '画像'], ['box', '要素'], describeChart(chart)]), '要素: 要素。画像。分布');
  const src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  const rows = [{label: '対象'}], values = [{label: '前', value: 20}];
  const opts = {labels: 'none', axis: false} as const;
  const selected = await renderBands([
    image(src, {alt: '画像の説明', width: 120}),
    box({title: '補足'}), table(rows, [['内容']], {title: '結果'}),
    bars(values, opts), chart,
  ], {measure, title: '比較'});
  const legacy = await renderInBrowser(diagram({theme: 'blue', title: '比較', legend: false}).add(
    legacyImage(src, {alt: '画像の説明', width: 120}),
    legacyBox({title: '補足'}), legacyTable(rows, [['内容']], {title: '結果'}),
    legacyBars(values, opts), legacyHeatmap(['状態'], ['結果'], [[1]], {alt: '分布'}),
  ), {measure});
  const desc = (svg: string) => svg.match(/<desc id="svg-desc">([^<]*)<\/desc>/)?.[1];
  assert.equal(desc(legacy.svg), '表「結果」: 列 対象。画像: 画像の説明。値: 前 20。分布');
  assert.equal(desc(selected.svg), desc(legacy.svg));
  const early = await renderBands([image(src, {alt: 'あとで表示', reveal: 2, width: 120}), box({title: '先に表示'})],
    {measure, title: '比較', stage: 1});
  assert.equal(desc(early.svg), '要素: 先に表示');
});

test('selected placement provides the same content inventory as the complete layout', async () => {
  const {prepareBands} = await import('../lib/core.ts');
  const input = [
    caption('比較'),
    row([box({id: 'a', title: '案 A'}), box({id: 'b', title: '案 B'})], {arrows: 'between'}),
    grid([box({title: '補足'})], {cols: 1}),
    connect('a:bottom', 'b:bottom', {label: '再検討'}),
    bars([{label: '例', value: 2}]),
  ];
  const {placed} = await prepareBands(input, {measure});
  const {laidOut} = await renderInBrowser(diagram({theme: 'blue'}).add(...input), {measure});
  assert.deepEqual(placed.inventory, laidOut.inventory);
  assert.ok(placed.inventory.items.some(item => item.kind === 'arrowhead'));
});

test('selected tree endpoints follow a plot that retains its fractional origin', async () => {
  const {prepareBands} = await import('../lib/core.ts');
  const input = (before: TreeItem['band'], child: TreeItem['band']): TreeItem => ({
    label: '親', children: [{label: '前の枝', band: before, w: 160}, {label: '子', band: child, w: 290}],
  });
  const opts = {x: {max: 20, step: 10}, y: {max: 10, step: 5}, points: [{at: [10, 5], label: '確認'}]} satisfies Parameters<typeof plane>[0];
  const shape = {h: 33, draw: () => ''};
  const selected = await prepareBands([tree(input(raw(shape), plane(opts)), {dir: 'right'})], {measure});
  const expected = await renderInBrowser(diagram({theme: 'blue', legend: false})
    .add(legacyTree(input(legacyRaw(shape), legacyPlane(opts)), {dir: 'right'})), {measure});
  const selectedTree = selected.placed.laidOut.find(band => band.type === 'tree');
  const expectedTree = expected.laidOut.laidOut.find(band => band.type === 'tree');
  assert.ok(selectedTree && expectedTree);
  const plot = selected.placed.laidOut.find(band => band.type === 'plane');
  assert.ok(plot);
  assert.notEqual(plot.y % 4, 0);
  assert.equal(selectedTree.nodes[2]?.y, plot.y);
  assert.deepEqual(selectedTree.edges, expectedTree.edges);
});

test('selected loop-side connectors diagnose canvas overflow like the full renderer', async () => {
  const a = {id: 'a', title: 'a'} as const, b = {id: 'b', title: 'b'} as const, c = {id: 'c', title: 'c'} as const;
  const options = {route: 'loop-side'} as const;
  const selected = await renderBands([box(a), box(b), box(c), connect('c:left', 'a:left', options)], {measure});
  const legacy = await renderInBrowser(diagram({theme: 'blue', legend: false})
    .add(legacyBox(a), legacyBox(b), legacyBox(c), legacyConnect('c:left', 'a:left', options)), {measure});
  assert.match(legacy.verdict.problems.join('\n'), /runs outside the .* canvas/);
  assert.deepEqual(selected.verdict.problems, legacy.verdict.problems);
});

test('selected brackets, callouts and branches preserve the full renderer geometry', async () => {
  const {bracket, branch, callout} = await import('../lib/bands/connect.ts');
  const {bracket: legacyBracket, branch: legacyBranch, callout: legacyCallout} = await import('../lib/web.ts');
  const source = {id: 'source', title: '開始'} as const;
  const left = {id: 'left', title: '確認'} as const;
  const right = {id: 'right', title: '承認'} as const;
  const span = {label: '対象の範囲', side: 'below'} as const;
  const note = {text: '開始条件', side: 'above'} as const;
  const selected = await renderBands([box(source), row([box(left), box(right)]),
    bracket('left:left', 'right:right', span), callout('source', note),
    ...branch('source:bottom', [{to: 'left:top'}, {to: 'right:top'}])], {measure});
  const legacy = await renderInBrowser(diagram({theme: 'blue', legend: false}).add(
    legacyBox(source), legacyRow([legacyBox(left), legacyBox(right)]),
    legacyBracket('left:left', 'right:right', span), legacyCallout('source', note),
    legacyBranch('source:bottom', [{to: 'left:top'}, {to: 'right:top'}])), {measure});
  assert.equal(selected.svg, legacy.svg);
  assert.deepEqual(selected.verdict.problems, legacy.verdict.problems);
});

test('selected steps preserve numbered boxes, focus and loop-back connectors', async () => {
  const {steps} = await import('../lib/bands/row.ts');
  const {steps: legacySteps} = await import('../lib/web.ts');
  const items = [{title: '確認'}, {title: '修正'}, {title: '承認'}];
  const opts = {id: 'workflow', numbered: true, focus: 2, loopBack: {from: 3, to: 1, label: '差し戻し'}} as const;
  const selected = await renderBands([steps(items, opts)], {measure, connectors: connectDefinition});
  const legacy = await renderInBrowser(diagram({theme: 'blue', legend: false}).add(legacySteps(items, opts)), {measure});
  assert.match(selected.svg, /差し戻し/);
  assert.equal(selected.svg, legacy.svg);
});

test('selected affinity diagrams preserve nested groups and card columns', async () => {
  const {affinity} = await import('../lib/compose/selective/affinity.ts');
  const {affinity: legacyAffinity} = await import('../lib/web.ts');
  const groups = [
    {title: '準備', groups: [{title: '資料', cards: ['更新日を確認する', '配布用の版を作る']}]},
    {title: '連絡', cards: ['共有先を確認する', '締切を知らせる']},
  ];
  const opts = {cols: 2, cardCols: 2};
  const title = '改善の分類';
  const selected = await renderBands(affinity(groups, opts), {measure, title});
  const legacy = await renderInBrowser(diagram({theme: 'blue', legend: false, title})
    .add(legacyAffinity(groups, opts)), {measure});
  assert.match(selected.svg, /配布用の版を作る/);
  assert.equal(selected.svg, legacy.svg);
});

test('selected node and stat boxes preserve top icons and source labels', async () => {
  const {node, stat} = await import('../lib/bands/box.ts');
  const {node: legacyNode, stat: legacyStat} = await import('../lib/web.ts');
  const item = {label: '承認', sub: '次の工程', icon: 'check'} as const;
  const value = {source: '月次集計', confidence: 'primary'} as const;
  const selected = await renderBands([grid([node(item), stat(12, '処理件数', value)], {cols: 2})], {measure});
  const legacy = await renderInBrowser(diagram({theme: 'blue', legend: false})
    .add(legacyGrid([legacyNode(item), legacyStat(12, '処理件数', value)], {cols: 2})), {measure});
  assert.match(selected.svg, /月次集計/);
  assert.equal(selected.svg, legacy.svg);
});

test('selected state diagrams preserve long words when the layout enables keepWords', async () => {
  const word = 'シャドウトラフィックコンフィギュレーション';
  const states = [{id: 'a', label: word}, {id: 'b', label: '完了'}];
  const transitions = [{from: 'a', to: 'b'}];
  const shape = {dir: 'down', maxNodeW: 88} as const;
  const options = {theme: 'blue', title: '状態', legend: false} as const;
  for (const keepWords of [false, true]) {
    const selected = await renderBands([stateDiagram(states, transitions, shape)], {...options, measure, keepWords});
    const legacy = await renderInBrowser(diagram({...options, keepWords}).add(legacyStateDiagram(states, transitions, shape)), {measure});
    assert.equal(selected.svg, legacy.svg);
    assert.equal(selected.svg.includes('>' + word + '</text>'), keepWords);
  }
});

test('selected cause trees retry without the word-width floor if it cannot fit', async () => {
  const word = 'シャドウトラフィックコンフィギュレーション';
  const causes = Array.from({length: 8}, (_, index) => ({id: `cause-${index}`, label: `${word}${'ス'.repeat(index)}の${index}`}));
  const nodes = [...causes, {id: 'effect', label: '結果'}];
  const links = causes.map(({id}) => ({from: id, to: 'effect'}));
  const shape = {dir: 'up', maxNodeW: 80, tree: 'crt'} as const;
  const options = {theme: 'blue', title: '要因', legend: false} as const;
  const plain = await renderBands([causeTree(nodes, links, shape)], {...options, measure});
  const selected = await renderBands([causeTree(nodes, links, shape)], {...options, measure, keepWords: true});
  const legacy = await renderInBrowser(diagram({...options, keepWords: true})
    .add(legacyCauseTree(nodes, links, shape)), {measure});
  assert.equal(selected.svg, legacy.svg);
  assert.equal(selected.svg, plain.svg);
  assert.doesNotMatch(selected.svg, new RegExp('>' + word + '</text>'));
});

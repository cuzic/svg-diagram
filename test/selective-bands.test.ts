import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {TreeItem} from '../lib/types/diagrams.ts';
import {caption} from '../lib/bands/caption.ts';
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
import {status} from '../lib/bands/status.ts';
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
import {renderBands} from '../lib/core.ts';
import {em} from '../lib/rich.ts';
import {sankey as legacySankey, heatmap as legacyHeatmap, radar as legacyRadar, waterfall as legacyWaterfall, swimlane as legacySwimlane, causeTree as legacyCauseTree, relationDiagram as legacyRelationDiagram, pdpc as legacyPdpc, tree as legacyTree, mindmap as legacyMindmap, stateDiagram as legacyStateDiagram, flowchart as legacyFlowchart, classDiagram as legacyClassDiagram, bpmn as legacyBpmn, cloud as legacyCloud, faultTree as legacyFaultTree, bowtie as legacyBowtie, wireframe as legacyWireframe, screens as legacyScreens, sequence as legacySequence, table as legacyTable, bars as legacyBars, rangeBars as legacyRangeBars, histogram as legacyHistogram, pareto as legacyPareto, plane as legacyPlane, quadrant as legacyQuadrant, legend as legacyLegend, wordart as legacyWordart, people as legacyPeople, dots as legacyDots, timeline as legacyTimeline, chevron as legacyChevron, cycle as legacyCycle, funnel as legacyFunnel, venn as legacyVenn, concentric as legacyConcentric, emblem as legacyEmblem, valueChain as legacyValueChain, curve as legacyCurve, pyramid as legacyPyramid, areas as legacyAreas, banner as legacyBanner, raw as legacyRaw, box as legacyBox, group as legacyGroup, caption as legacyCaption, spacer as legacySpacer, connect as legacyConnect, diagram, gantt as legacyGantt, grid as legacyGrid, renderInBrowser, row as legacyRow} from '../lib/web.ts';

const measure = ({text, size}: {text: string; size: number}) => ({w: [...text].length * size * 0.6, h: size});
const rows = [{id: 'draft', label: 'Draft', start: '2026-11-23', days: 3}] as const;

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
  const from = {id: 'one', title: 'One', body: 'Review', bodyMono: true} as const;
  const to = {id: 'two', title: 'Two'} as const;
  const link = {label: 'check', route: 'straight'} as const;
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

test('connect can target a row column with no explicit box id', async () => {
  const plan = row([box({title: 'Review'}), box({title: 'Pick'})], {id: 'plan'});
  const result = await renderBands([plan, box({id: 'next', title: 'Next'}), connect(plan.col(1).bottom, 'next:top')], {measure});
  assert.ok(result.verdict.ok, JSON.stringify(result.verdict.problems));
  assert.match(result.svg, /marker-end=/);
});

test('selected rows can opt into implicit loop-back connectors', async () => {
  const options = {loopBack: {from: 2, to: 1, label: 'retry'}, arrows: 'between'} as const;
  const selected = await renderBands([
    row([box({title: 'Review'}), box({title: 'Next'})], options),
    box({title: 'Finish'}),
  ], {measure, connectors: connectDefinition});
  const rendered = await renderInBrowser(diagram({theme: 'blue', legend: false})
    .add(legacyRow([legacyBox({title: 'Review'}), legacyBox({title: 'Next'})], options))
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
  const options = {cols: [1, 2], gap: 80};
  const link = {label: 'go', route: 'straight'} as const;
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
  const actors = [{id: 'ui', label: '画面'}, {id: 'api', label: 'API'}] as const;
  const steps = [{from: 'ui', to: 'api', label: '送信'}, {self: 'api', label: '検証'}] as const;
  const cols = [{label: '項目'}, {label: '値', mono: true}];
  const rows = [['識別子', cell('ABC-123')]];
  const options = {rowHeader: true, title: '結果'};
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
  const lanes = [{id: 'a', label: '画面'}, {id: 'b', label: '処理'}];
  const steps = [{id: 'start', lane: 'a', title: '開始', body: 'ABC', bodyMono: true}, {id: 'done', lane: 'b', title: '完了', reveal: 2}];
  const options = {flows: [{from: 'start', to: 'done', label: 'Review'}], boundaries: [{after: 'a', label: '境界'}]};
  const selected = swimlane(lanes, steps, options, connectDefinition);
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

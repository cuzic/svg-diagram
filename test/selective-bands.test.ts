import assert from 'node:assert/strict';
import {test} from 'node:test';
import {caption} from '../lib/bands/caption.ts';
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
import {wireframe as legacyWireframe, screens as legacyScreens, sequence as legacySequence, table as legacyTable, bars as legacyBars, rangeBars as legacyRangeBars, histogram as legacyHistogram, pareto as legacyPareto, plane as legacyPlane, quadrant as legacyQuadrant, legend as legacyLegend, wordart as legacyWordart, people as legacyPeople, dots as legacyDots, timeline as legacyTimeline, chevron as legacyChevron, cycle as legacyCycle, funnel as legacyFunnel, venn as legacyVenn, concentric as legacyConcentric, emblem as legacyEmblem, valueChain as legacyValueChain, curve as legacyCurve, pyramid as legacyPyramid, areas as legacyAreas, banner as legacyBanner, raw as legacyRaw, box as legacyBox, group as legacyGroup, caption as legacyCaption, spacer as legacySpacer, connect as legacyConnect, diagram, gantt as legacyGantt, grid as legacyGrid, renderInBrowser, row as legacyRow} from '../lib/web.ts';

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

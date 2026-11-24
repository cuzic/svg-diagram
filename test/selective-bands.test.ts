import assert from 'node:assert/strict';
import {test} from 'node:test';
import {caption} from '../lib/bands/caption.ts';
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
import {chevron as legacyChevron, cycle as legacyCycle, funnel as legacyFunnel, venn as legacyVenn, concentric as legacyConcentric, emblem as legacyEmblem, valueChain as legacyValueChain, curve as legacyCurve, pyramid as legacyPyramid, areas as legacyAreas, banner as legacyBanner, raw as legacyRaw, box as legacyBox, group as legacyGroup, caption as legacyCaption, spacer as legacySpacer, connect as legacyConnect, diagram, gantt as legacyGantt, grid as legacyGrid, renderInBrowser, row as legacyRow} from '../lib/web.ts';

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

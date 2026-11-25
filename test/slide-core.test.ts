import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {box} from '../lib/bands/box.ts';
import {renderBands} from '../lib/core.ts';
import {banner, diagram, group} from '../lib/dsl-pure.ts';
import {renderDiagram} from '../lib/dsl/render.ts';
import {renderLegacyDiagramWithCore} from '../lib/legacy-core.ts';
import {closeMeasurer} from '../lib/measure.ts';
import {fillTextSize, imageFillTextSize} from '../lib/slide-fill.ts';
import {rolesAt} from '../lib/tokens.ts';
import type {MeasureRequest} from '../lib/types/core.ts';
import {slideCacheKeyForTest} from './helpers/slide-fixture.ts';

const budget = {maxHeight: 450, contentWidth: 640};
const slide = {page: 'pages/p.md', heading: '見出し'};
const measure = ({text, size}: MeasureRequest) => ({w: [...text].length * size * 0.6, h: size});
const cwd = process.cwd();
const dir = mkdtempSync(path.join(tmpdir(), 'slide-core-'));
test.before(() => process.chdir(dir));
test.after(async () => {
  await closeMeasurer();
  process.chdir(cwd);
  rmSync(dir, {recursive: true});
});

test('fill uses the same width, height and font scale as the legacy renderer', async () => {
  const budget = {maxHeight: 280, contentWidth: 640};
  slideCacheKeyForTest(dir, budget);
  const bands = [box({title: 'Review', body: 'Plan'}), box({title: 'Release', body: 'Done'})];
  const diagramData = diagram({day: 2, slide, fill: true, width: 500}).add(bands);
  const legacy = await renderDiagram(diagramData, {name: 'p.svg', budget: 'cacheOnly'});
  const core = await renderBands(bands, {measure, slide: budget, fill: true, width: 500});
  const adapted = await renderLegacyDiagramWithCore(diagramData, {measure, budget});
  assert.equal(legacy.budgetSource, 'cache');
  assert.equal(core.width, budget.contentWidth);
  assert.ok(core.fontScale > 1 && core.fontScale < 1.7);
  assert.ok(core.height <= budget.maxHeight);
  for (const result of [core, adapted]) {
    assert.equal(result.fontScale, legacy.fontScale);
    assert.equal(result.height, legacy.height);
    assert.equal(result.width, legacy.width);
    assert.deepEqual(result.fit, legacy.fit);
  }
  assert.deepEqual(adapted.unsupported, []);
});

test('a nested opt-in headline role limits the slide fill scale', async () => {
  slideCacheKeyForTest(dir, budget);
  const diagramData = diagram({day: 2, slide, fill: true})
    .add(group(banner({headline: 'Review', headlineRole: 'display'})));
  const legacy = await renderDiagram(diagramData, {name: 'p.svg', budget: 'cacheOnly'});
  const core = await renderLegacyDiagramWithCore(diagramData, {measure, budget});
  assert.ok(core.fontScale > 1 && core.fontScale < 1.5);
  assert.equal(core.fontScale, legacy.fontScale);
});

test('the image fill limit considers the largest opted-in role on the image or its plates', () => {
  const roles = rolesAt(false, 1);
  assert.equal(fillTextSize(roles), 0);
  assert.equal(fillTextSize(roles, 'display'), roles.display);
  const mark = {rect: [0, 0, 1, 1] as const, role: 'stat' as const};
  const label = {text: 'Note', at: [0, 0] as const, role: 'banner' as const};
  assert.equal(imageFillTextSize({labelRole: 'note', marks: [mark], labels: [label]}, roles), roles.stat);
  assert.equal(imageFillTextSize({labelRole: 'note', labels: [label]}, roles), roles.banner);
  assert.equal(imageFillTextSize({labelRole: 'banner'}, roles), roles.banner);
});

test('a slide that is too tall at 1x reports the same fit warning as the legacy renderer', async () => {
  const tight = {...budget, maxHeight: 64};
  slideCacheKeyForTest(dir, tight);
  const bands = [box({title: 'Review', body: 'Plan'}), box({title: 'Release', body: 'Done'})];
  const legacy = await renderDiagram(diagram({day: 2, slide, fill: true}).add(bands), {name: 'p.svg', budget: 'cacheOnly'});
  const core = await renderBands(bands, {measure, slide: tight, fill: true});
  assert.equal(core.fontScale, 1);
  assert.ok(core.fit.scale < 1);
  assert.match(core.fit.warnings[0] ?? '', /on-slide text/);
  assert.deepEqual(core.fit, legacy.fit);
});

test('fill without a slide budget rejects with instructions to supply it', async () => {
  await assert.rejects(renderBands([box({title: 'Review'})], {measure, fill: true}), /fill.*slide.*maxHeight.*contentWidth/);
});

test('an uncached legacy slide keeps the requested width and reports the default fit', async () => {
  const input = diagram({day: 2, slide, fill: true, width: 1000}).add(box({title: 'Review'}));
  const legacy = await renderDiagram(input, {name: 'uncached.svg', budget: 'cacheOnly'});
  const core = await renderLegacyDiagramWithCore(input, {measure, budget: null});
  assert.equal(legacy.budgetSource, 'default');
  assert.equal(core.width, 1000);
  assert.equal(core.fontScale, 1);
  assert.deepEqual(core.fit, legacy.fit);
  assert.deepEqual(core.notes, legacy.notes.slice(-1));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {banner, box, caption, causeTree, connect, diagram, em, grid, group, plane, row, steps} from '../lib/dsl-pure.ts';
import {boxTextPlacement, captionTextPlacement, stampGeometry, tagGeometry} from '../lib/emit-boxes.ts';
import {runLineOrigin} from '../lib/emit-common.ts';
import {band} from '../lib/band-def.ts';
import {boxDefinition} from '../lib/bands/box.ts';
import {renderLegacyDiagramWithCore} from '../lib/legacy-core.ts';
import {connectorInventory} from '../lib/inventory-lines.ts';
import {BOX_PAD_X, BOX_PAD_Y, STEP_INDENT} from '../lib/layout-util.ts';
import {CONNECT_LABEL_SIZE, SLIDE_CANVAS} from '../lib/tokens.ts';
import type {Arrow, DiagramData, InventoryItem, LaidOutDiagram, Point, Rect} from '../lib/types/index.ts';

const widthOf = (text: string, size: number) => text.length * size / 2;
const draw = (d: DiagramData) => renderLegacyDiagramWithCore(d, {
  measure: ({text, size}) => ({w: widthOf(text, size), h: size}),
});
const layout = async (d: DiagramData) => (await draw(d)).laidOut;
const figure = (width?: number) => diagram({theme: 'blue', width});
const title = '要確認';
const change = 'ここが変更点';

const singleBox = (align?: 'left' | 'center' | 'right') => figure().add(box({title, id: 'a', align}));
const wrappedBox = (align?: 'left' | 'center' | 'right') => figure(120).add(box({title: 'ここが変更点です', align}));
const boxesInRow = (gap?: number) => row([box({title, id: 'a'}), box({title: change, id: 'b'})], {gap});
const captions = () => figure().add(caption(change, {align: 'left'}), caption(change));
const linkedBoxes = (arrow?: Arrow, chip?: boolean) =>
  figure().add(boxesInRow(), connect('a:right', 'b:left', {label: title, arrow, chip}));

const texts = (d: LaidOutDiagram, owner?: string) =>
  d.inventory.items.filter((item): item is Extract<InventoryItem, {kind: 'text'}> =>
    item.kind === 'text' && (owner === undefined || item.owner === owner));
const frames = (d: LaidOutDiagram) => d.inventory.items.filter(item => item.kind === 'frame');
const arrowheads = (d: LaidOutDiagram) => d.inventory.items.filter(item => item.kind === 'arrowhead');

function near(actual: number, expected: number, eps = 0.01): void {
  assert.ok(Math.abs(actual - expected) <= eps, `${actual} is not within ${eps}px of ${expected}`);
}

function contains(r: Rect, p: Point): boolean {
  return r.x <= p.x && p.x <= r.x + r.w && r.y <= p.y && p.y <= r.y + r.h;
}

function svgTexts(svg: string) {
  return [...svg.matchAll(/<text\b([^>]*)>(.*?)<\/text>/g)].map(([, attrs, content]) => {
    const get = (name: string) => attrs!.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
    return {content: content!, x: Number(get('x')), y: Number(get('y')), size: Number(get('font-size')), anchor: get('text-anchor') ?? 'start'};
  });
}

test('T1: a left-aligned box records its text and a clockwise frame', async () => {
  const {laidOut: d, svg} = await draw(singleBox());
  const b = d.laidOut[0]!;
  assert.equal(b.type, 'box');
  const run = b.wrappedRuns[0]!;
  const ts = texts(d, 'a');
  assert.equal(ts.length, 1);
  const [t] = ts;
  assert.equal(t!.size, run.size);
  near(t!.rect.w, 3 * run.size / 2 + 0.25 * run.size);
  near(t!.rect.x, b.x + BOX_PAD_X - 0.125 * run.size);
  const baseline = b.y + BOX_PAD_Y + run.lineYs[0]!;
  near(t!.rect.y, baseline - run.size);
  near(t!.rect.y + t!.rect.h, baseline + 0.3 * run.size);
  const fs = frames(d);
  assert.equal(fs.length, 1);
  assert.equal(fs[0]!.owner, 'a');
  const drawn = svg.match(/<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)" rx="8"/);
  assert.ok(drawn);
  const [x, y, w, h] = drawn.slice(1).map(Number) as [number, number, number, number];
  assert.deepEqual(fs[0]!.poly, [{x, y}, {x: x + w, y}, {x: x + w, y: y + h}, {x, y: y + h}]);
});

test('T1: the title starts after the step indent', async () => {
  const {laidOut: d, svg} = await draw(figure().add(box({title, id: 'a', step: 1})));
  const b = d.laidOut[0]!;
  assert.equal(b.type, 'box');
  const ts = texts(d, 'a');
  assert.equal(ts.length, 1);
  const x = b.x + BOX_PAD_X + STEP_INDENT;
  near(ts[0]!.rect.x, x - 0.125 * ts[0]!.size);
  assert.deepEqual(runLineOrigin(b.wrappedRuns[0]!, boxTextPlacement(b)), {lx: x, anchor: 'start'});
  near(svgTexts(svg).find(t => t.content === title)!.x, x);
});

test('T2: a right-aligned step title wraps within the indented space and reaches the right padding', async () => {
  const {laidOut: d, svg} = await draw(figure(160).add(box({title: change, id: 'a', step: 1, align: 'right'})));
  const b = d.laidOut[0]!;
  assert.equal(b.type, 'box');
  const right = b.x + b.w - BOX_PAD_X;
  const rendered = svgTexts(svg).filter(t => t.anchor === 'end');
  assert.deepEqual(rendered.map(t => t.content), ['ここが', '変更点']);
  assert.equal(texts(d, 'a').length, 2);
  for (const t of rendered) near(t.x, right);
  for (const {rect, size} of texts(d, 'a')) {
    near(rect.x + rect.w, right + 0.125 * size);
    assert.ok(rect.x + 0.125 * size >= b.x + BOX_PAD_X + STEP_INDENT);
  }
});

test('T2: boxes respect the center and right text alignment', async () => {
  const center = await layout(singleBox('center'));
  const cb = center.laidOut[0]!, ct = texts(center, 'a')[0]!.rect;
  near(ct.x + ct.w / 2, cb.x + cb.w / 2);
  const right = await layout(singleBox('right'));
  const rb = right.laidOut[0]!, {rect: rt, size} = texts(right, 'a')[0]!;
  near(rt.x + rt.w, rb.x + rb.w - BOX_PAD_X + 0.125 * size);
});

test('T3: a wrapped title records each line at its own baseline and width', async () => {
  for (const align of ['left', 'center', 'right'] as const) {
    const d = await layout(wrappedBox(align));
    const b = d.laidOut[0]!;
    assert.equal(b.type, 'box');
    const run = b.wrappedRuns[0]!, ts = texts(d);
    assert.deepEqual(run.lines, ['ここが', '変更点です']);
    assert.equal(ts.length, 2);
    assert.ok(ts[0]!.rect.y < ts[1]!.rect.y);
    ts.forEach(({rect}, i) => {
      near(rect.y, b.y + BOX_PAD_Y + run.lineYs[i]! - run.size);
      const w = widthOf(run.lines[i]!, run.size);
      near(rect.w, w + 0.25 * run.size);
      const left = align === 'left' ? b.x + BOX_PAD_X : align === 'center' ? b.x + (b.w - w) / 2 : b.x + b.w - BOX_PAD_X - w;
      near(rect.x, left - 0.125 * run.size);
    });
  }
});

test('T4: row children keep their IDs at different gaps', async () => {
  for (const gap of [12, 40]) {
    const d = await layout(figure().add(boxesInRow(gap)));
    assert.deepEqual(texts(d).map(t => t.owner), ['a', 'b']);
    assert.deepEqual(frames(d).map(t => t.owner), ['a', 'b']);
    const b = d.laidOut[0]!;
    assert.equal(b.type, 'row');
    b.children.forEach((child, i) => {
      const {rect, size} = texts(d)[i]!;
      near(rect.x, child.x + BOX_PAD_X - 0.125 * size);
    });
  }
});

test('T5: captions use explicit left alignment and default center alignment', async () => {
  const d = await layout(captions());
  const [left, center] = d.laidOut;
  const [lt, ct] = texts(d);
  assert.equal(center?.type, 'caption');
  assert.deepEqual(captionTextPlacement(center), {originX: center.x, originY: center.y, w: center.w, align: 'center'});
  assert.deepEqual(texts(d).map(t => t.owner), ['caption[0]', 'caption[1]']);
  near(lt!.rect.x, left!.x - 0.125 * lt!.size);
  near(ct!.rect.x + ct!.rect.w / 2, center!.x + center!.w / 2);
});

test('T6: a labelled connector records its polyline, end arrowhead and label box', async () => {
  const d = await layout(linkedBoxes());
  const c = d.connects[0]!;
  const connectors = d.inventory.items.filter(item => item.kind === 'connector');
  assert.deepEqual(connectors, [{kind: 'connector', owner: 'a>b', points: c.points}]);
  const heads = arrowheads(d);
  assert.equal(heads.length, 1);
  const {rect, owner} = heads[0]!;
  assert.equal(owner, 'a>b');
  assert.ok(contains(rect, c.to));
  assert.ok(rect.w <= 20 && rect.h <= 20);
  assert.deepEqual(texts(d, 'a>b'), [{kind: 'text', owner: 'a>b', rect: c.labelBox, size: CONNECT_LABEL_SIZE}]);
});

test('T7: arrowheads are recorded at the requested ends only', async () => {
  const both = await layout(linkedBoxes('both'));
  const c = both.connects[0]!;
  const heads = arrowheads(both);
  assert.equal(heads.length, 2);
  for (const end of [c.from, c.to]) assert.equal(heads.filter(h => contains(h.rect, end)).length, 1);
  const start = await layout(linkedBoxes('start'));
  assert.equal(arrowheads(start).length, 1);
  assert.ok(contains(arrowheads(start)[0]!.rect, start.connects[0]!.from));
  assert.equal(arrowheads(await layout(linkedBoxes('none'))).length, 0);
});

test('M1: steps record the between-box arrows and the loop back to the first box', async () => {
  const input = figure().add(steps([{title}, {title: change}, {title}], {
    id: 'steps', loopBack: {from: 3, to: 1},
  }));
  const d = await layout(input);
  const r = d.laidOut[0]!;
  assert.equal(r.type, 'row');
  assert.equal(r.arrows.length, 2);
  const loop = d.connects[0]!;
  assert.equal(loop.route, 'loop-under');
  const connectors = d.inventory.items.filter(item => item.kind === 'connector');
  assert.deepEqual(connectors, [
    ...r.arrows.map(({x1, y1, x2, y2}, i) => ({kind: 'connector', owner: `steps>${i}`, points: [{x: x1, y: y1}, {x: x2, y: y2}]})),
    {kind: 'connector', owner: 'steps#3>steps#1', points: loop.points},
  ]);
  const heads = arrowheads(d);
  assert.deepEqual(heads.map(h => h.owner), connectors.map(c => c.owner));
  r.arrows.forEach(({x2, y2}, i) => {
    assert.deepEqual(heads[i]!.rect, {x: x2 - 16, y: y2 - 4, w: 20, h: 8});
  });
  assert.ok(contains(heads[2]!.rect, loop.to));
  assert.ok(!contains(heads[2]!.rect, loop.from));
});

test('T8: a chip contributes one label rectangle with the actual connector font size', async () => {
  const d = await layout({...linkedBoxes(undefined, true), canvas: {...SLIDE_CANVAS, minText: 18}});
  const c = d.connects[0]!;
  assert.ok(c.chipBox);
  assert.deepEqual(texts(d, 'a>b'), [{kind: 'text', owner: 'a>b', rect: c.chipBox, size: 18}]);
});

test('T9: an unsupported band contributes its whole rectangle once', async () => {
  const d = await layout(figure().add(plane({x: {max: 2}, y: {max: 2}})));
  const b = d.laidOut[0]!;
  assert.equal(b.type, 'plane');
  const {x, y, w, h} = b;
  assert.deepEqual(d.inventory.items, [{kind: 'whole', owner: 'plane[0]', band: 'plane', rect: {x, y, w, h}}]);
});

test('T10: wrapped text position and padded width agree with SVG and connector labels use their layout baselines', async () => {
  const styled = figure().add(caption('「要確認」。', {mono: true}), box({body: ['Check ', em.b('this'), '.']}));
  for (const input of [singleBox(), singleBox('center'), singleBox('right'), wrappedBox(), figure().add(boxesInRow()), captions(), linkedBoxes(), styled]) {
    const {laidOut: d, svg} = await draw(input);
    const rendered = svgTexts(svg);
    for (const c of d.connects) {
      const label = rendered.pop(); // Connectors are drawn after all the bands.
      assert.ok(label);
      assert.equal(label.content, c.label);
      near(label.y, c.labelY!, 0.5);
    }
    const connectorOwners = new Set(d.inventory.items.filter(item => item.kind === 'connector').map(item => item.owner));
    const wrapped = texts(d).filter(item => !connectorOwners.has(item.owner));
    const matches = ({rect, size}: (typeof wrapped)[number], t: (typeof rendered)[number]) => {
      const pad = 0.125 * size;
      const x = t.anchor === 'middle' ? rect.x + rect.w / 2 : t.anchor === 'end' ? rect.x + rect.w - pad : rect.x + pad;
      const text = t.content.replace(/<[^>]+>/g, '');
      return size === t.size && Math.abs(x - t.x) <= 0.5 && Math.abs(rect.y + size - t.y) <= 0.5
        && Math.abs(rect.w - (widthOf(text, t.size) + 2 * pad)) <= 0.5;
    };
    assert.ok(rendered.every(t => wrapped.some(r => matches(r, t))));
    assert.ok(wrapped.every(r => rendered.some(t => matches(r, t))));
    // Pin the centered anchor independently so a change shared by inventory and SVG is visible.
    d.laidOut.forEach((b, i) => {
      if ((b.type === 'box' && b.align === 'center') || (b.type === 'caption' && b.align !== 'left')) {
        assert.equal(rendered[i]!.anchor, 'middle');
        near(rendered[i]!.x, b.x + b.w / 2, 0.5);
      }
    });
  }
});

test('an inventory hook exception escapes bunsetsu-soft without retrying', async () => {
  const error = new Error('inventory failure');
  let calls = 0;
  const data = band({
    ...boxDefinition,
    inventory: () => { calls++; throw error; },
  }, box({title, id: 'a'}));
  const input = diagram({theme: 'blue', wrap: 'bunsetsu-soft'}).add(data);
  await assert.rejects(layout(input), caught => caught === error);
  assert.equal(calls, 1);
});

test('T12: inventory also records text when bunsetsu-soft falls back to phrase', async () => {
  // The seven-to-one tree from wrap-soft.test.ts, with widths and labels that trigger the fallback using widthOf.
  const leaves = Array.from({length: 7}, (_, i) => ({id: `n${i}`, label: 'ここが変更点確認してください'}));
  const nodes = [...leaves, {id: 'top', label: change}];
  const edges = leaves.map(({id}) => ({from: id, to: 'top'}));
  const input = diagram({theme: 'blue', width: 840, wrap: 'bunsetsu-soft'}).add(
    box({title, id: 'a'}), causeTree(nodes, edges, {dir: 'up', maxNodeW: 80, tree: 'frt'}),
  );
  const d = await layout(input);
  assert.equal(d.wrapFellBack, true);
  assert.equal(texts(d, 'a').length, 1);
  assert.deepEqual(d.inventory, (await layout({...input, wrap: 'phrase'})).inventory);
});

test('T13: laying out the same input twice gives the same inventory', async () => {
  const input = linkedBoxes('both', true);
  const first = await layout(input), second = await layout(input);
  assert.ok(first.inventory.items.length > 0);
  assert.equal(JSON.stringify(first.inventory), JSON.stringify(second.inventory));
});

test('banner and group headings, grid children, and tag and stamp boxes are recorded', async () => {
  const {laidOut: d, svg} = await draw(figure().add(
    banner({id: 'header', headline: title}),
    group(grid([box({title, tag: title, stamp: change})], {cols: 1}), {id: 'group', title: change, stamp: title}),
  ));
  assert.deepEqual(texts(d).map(t => t.owner), ['header', 'caption[2]', 'grid[3]/0']);
  assert.deepEqual(frames(d).map(t => t.owner), ['header', 'group', 'grid[3]/0']);
  const b = d.laidOut[0]!;
  assert.equal(b.type, 'banner');
  const headline = texts(d, 'header')[0]!.rect;
  near(headline.x + headline.w / 2, b.x + b.w / 2);

  const g = d.laidOut[3]!;
  assert.equal(g.type, 'grid');
  const tags = d.inventory.items.filter(item => item.kind === 'badge' && item.what === 'tag');
  const drawnTag = svg.match(/<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)" rx="12"/);
  assert.ok(drawnTag);
  const [x, y, w, h] = drawnTag.slice(1).map(Number);
  const tagRect = {x, y, w, h};
  const rawTag = g.children[0]!.tagBox;
  assert.ok(rawTag);
  assert.notDeepEqual(tagRect, rawTag);
  assert.deepEqual(tagGeometry(rawTag), tagRect);
  assert.deepEqual(tags, [{kind: 'badge', owner: 'grid[3]/0', what: 'tag', rect: tagRect}]);

  const stamps = d.inventory.items.filter(item => item.kind === 'badge').filter(item => item.what === 'stamp');
  assert.deepEqual(stamps.map(s => s.owner), ['group', 'grid[3]/0']);
  const child = g.children[0]!;
  assert.deepEqual(stampGeometry(child, child.stampW!), stamps[1]!.rect);
  const drawnStamps = [...svg.matchAll(/<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="24" rx="4"/g)];
  assert.deepEqual(stamps.map(s => s.rect), drawnStamps.map(([, x, y, w]) => ({x: Number(x), y: Number(y), w: Number(w), h: 24})));
});

test('connector inventory keeps its own copies of points and label rectangles', async () => {
  for (const chip of [false, true]) {
    const d = await layout(linkedBoxes(undefined, chip));
    const c = d.connects[0]!;
    const snapshot = structuredClone(d.inventory);
    c.points[0]!.x += 100;
    c.points.pop();
    (c.chipBox ?? c.labelBox)!.y += 100;
    assert.deepEqual(d.inventory, snapshot);
  }
});

test('the arrowhead follows a short leg around its bend and repeated links have distinct owners', async () => {
  const c = (await layout(linkedBoxes())).connects[0]!;
  const points = [{x: 0, y: 0}, {x: 0, y: 0}, {x: 6, y: 0}, {x: 6, y: 20}];
  const items = connectorInventory([
    {...c, points, arrow: 'start'}, {...c, arrow: 'none'}, {...c, toId: 'b[1]', arrow: 'none'},
  ]);
  const owners = items.filter(item => item.kind === 'connector').map(item => item.owner);
  assert.equal(owners.length, 3);
  assert.equal(owners[2], 'a>b[1]');
  assert.equal(new Set(owners).size, 3);
  assert.deepEqual(items.filter(item => item.kind === 'arrowhead'), [
    {kind: 'arrowhead', owner: owners[0], rect: {x: -4, y: -4, w: 14, h: 14}},
  ]);
});

test('unframed boxes still contribute hidden and dimmed text', async () => {
  const input = figure().add(row([box({title, frame: false, reveal: 2}), box({title: change, frame: false, until: 1})], {id: 'row'}));
  const b = input.bands[0]!;
  assert.equal(b.type, 'row');
  Object.assign(b.children[1]!, {dim: true});
  const d = await layout(input);
  const placed = d.laidOut[0]!;
  assert.equal(placed.type, 'row');
  assert.equal(placed.children[1]!.dim, true);
  assert.deepEqual(texts(d).map(t => t.owner), ['row/0', 'row/1']);
  assert.equal(frames(d).length, 0);
});

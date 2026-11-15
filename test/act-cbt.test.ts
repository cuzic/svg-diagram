// ADR 0065: the parts of an ACT / CBT worksheet — concentric with sectors and marks (the Values Bullseye, a technology radar) and cycle with
// links and a frame (the CBT five-part model). The quadrant preset actMatrix and its `centre` are tested with the other presets (quadrant.test.ts).
import test from 'node:test';
import './helpers/strict-width.ts'; // a label the layout did not register for measuring throws instead of measuring 0 wide
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {build, checkDiagram, closeMeasurer, concentric, connect, cycle, diagram, quadrant} from '../lib/dsl.ts';
import {concentricBand, cycleBand} from '../lib/flow-shapes.ts';
import {partCatalog, specToDiagram, validateSpec} from '../lib/spec.ts';
import {STEP_REF, refIssue, type SpecIssue} from '../lib/spec-kit.ts';
import type {ConcentricMark, LaidOutFlowShape} from '../lib/flow-shapes.ts';
import type {Rect} from '../lib/types/core.ts';

test.after(() => closeMeasurer());

const laid = async (...bands: unknown[]): Promise<{shape: LaidOutFlowShape; problems: string[]; warnings: string[]}> => {
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue'}).add(...(bands as never[])));
  const shape = laidOut.laidOut.find((b): b is LaidOutFlowShape => b.type === 'concentric' || b.type === 'cycle')!;
  return {shape, problems: verdict.problems, warnings: verdict.warnings};
};
const meet = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const circles = (s: LaidOutFlowShape) => s.primitives.flatMap(p => p.k === 'circle' ? [p] : []);
const paths = (s: LaidOutFlowShape) => s.primitives.flatMap(p => p.k === 'path' ? [p] : []);
const DOMAINS = [{label: '仕事・学び'}, {label: '人間関係'}, {label: '成長・健康'}, {label: '余暇'}];
const RADAR = [{label: 'Adopt'}, {label: 'Trial'}, {label: 'Assess'}, {label: 'Hold'}];

/** Every line a label could cross: the ring outlines and the sector cuts, as points every 2px. */
function linePoints(s: LaidOutFlowShape): [number, number][] {
  const rings = circles(s).filter(c => c.opacity === .07), out: [number, number][] = [];
  for (const c of rings) for (let a = 0; a < 2 * Math.PI; a += 2 / c.r) out.push([c.cx + c.r * Math.cos(a), c.cy + c.r * Math.sin(a)]);
  for (const p of paths(s).filter(x => x.thin)) {
    const [x1, y1, x2, y2] = p.d.replace(/[ML]/g, '').split(/[ ,]+/).filter(Boolean).map(Number) as [number, number, number, number];
    const n = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 2);
    for (let i = 0; i <= n; i++) out.push([x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n]);
  }
  return out;
}
const crosses = (box: Rect, pts: [number, number][]) => pts.some(([x, y]) => x > box.x + 1 && x < box.x + box.w - 1 && y > box.y + 1 && y < box.y + box.h - 1);

// ---- concentric with sectors -------------------------------------------------------------------------------------------------

test('concentricBand with sectors: a mark at a ring (as written, or by name) or at r; rings may be a count; mistakes name the mark', () => {
  const b = concentricBand(RADAR, {order: 'inner-first', sectors: DOMAINS, marks: [{label: 'a', sector: 2, ring: 'Trial'}, {label: 'b', sector: '余暇', r: .9, from: {ring: 1}}]});
  assert.deepEqual(b.marks?.map(m => [m.sector, m.at, m.from]), [[1, {ring: 1}, undefined], [3, {r: .9}, {sector: 3, at: {ring: 0}}]]);
  // outer-first (the default): ring 1 is the outermost
  assert.deepEqual(concentricBand([{label: '外'}, {label: '内'}], {sectors: DOMAINS, marks: [{label: 'x', sector: 1, ring: 1}]}).marks?.[0]?.at, {ring: 1});
  assert.equal(concentricBand(4, {sectors: DOMAINS}).rings.length, 4);
  assert.throws(() => concentricBand(4), /only with sectors/);
  assert.throws(() => concentricBand(RADAR, {marks: []}), /give sectors too/);
  assert.throws(() => concentricBand(RADAR, {sectors: DOMAINS, labels: 'side'}), /labels: 'side'/);
  const bad = (m: ConcentricMark, rx: RegExp) => assert.throws(() => concentricBand(4, {sectors: DOMAINS, marks: [m]}), rx);
  bad({label: 'x', sector: 5, r: .5}, /mark 1 "x" sector 5 is not one of them/);
  bad({label: 'x', sector: 1}, /needs a ring/);
  bad({label: 'x', sector: 1, ring: 1, r: .2}, /both ring and r/);
  bad({label: 'x', sector: 1, r: 1.2}, /from 0 \(the centre\) to 1/);
  bad({label: 'x', sector: 1, ring: 'Adopt'}, /rings have no names/);
  bad({label: 'x', sector: 1, r: .5, from: {}}, /from needs a ring/);
  assert.throws(() => concentricBand(4, {sectors: DOMAINS, fromLegend: ['前回'] as never}), /two words/);
});

test('concentric with sectors: each mark lies in its sector, near its distance or inside its ring', async () => {
  const marks = [{label: '今週の仕事', sector: 1, r: .3}, {label: 'TS', sector: 2, ring: 1}, {label: 'Go', sector: 2, ring: 1}, {label: 'Rust', sector: 2, ring: 1}, {label: '外', sector: 4, ring: 4}];
  const {shape, problems} = await laid(concentric(RADAR, {order: 'inner-first', sectors: DOMAINS, marks}));
  assert.deepEqual(problems, []);
  const rings = circles(shape).filter(c => c.opacity === .07).map(c => c.r).sort((a, b) => a - b), R = rings.at(-1)!, cy = circles(shape)[0]!.cy, cx = circles(shape)[0]!.cx;
  const dots = circles(shape).filter(c => c.r === 6);
  marks.forEach((m, i) => {
    const d = dots[i]!, turn = ((Math.atan2(d.cy - cy, d.cx - cx) + Math.PI / 2) / (2 * Math.PI) + 1) % 1; // 0 at 12 o'clock, clockwise
    assert.ok(turn >= (m.sector - 1) / 4 && turn <= m.sector / 4, `${m.label} is in sector ${m.sector}`);
    const r = Math.hypot(d.cx - cx, d.cy - cy);
    if (m.r !== undefined) assert.ok(Math.abs(r - m.r * R) <= R * .08 + 4, `${m.label} near r ${m.r}`);
    else assert.ok(r >= (m.ring! > 1 ? rings[m.ring! - 2]! : 0) - 4 && r <= rings[m.ring! - 1]! + 4, `${m.label} inside ring ${m.ring}`);
  });
});

test('concentric with sectors: a label crosses no ring, no cut, no other text and no dot — or the crossing is reported', async () => {
  const names = ['TypeScript', 'Effect', 'Biome', 'pnpm', 'Bun', 'Fly.io', 'Kubernetes', 'ADR', 'モブプロ', 'Deno', 'Vite', 'Turborepo'];
  const marks = names.map((label, i) => ({label, sector: i % 4 + 1, ring: (i * 7) % 4 + 1}));
  for (const band of [
    concentric(RADAR, {order: 'inner-first', sectors: DOMAINS, marks}),
    concentric(3, {sectors: DOMAINS, centre: '価値に沿った生き方', marks: [{label: '資格の勉強', sector: 1, r: .3, from: {r: .7}}, {label: '家族と夕食', sector: 2, r: .25}, {label: '週 1 で運動', sector: 3, r: .65, from: {r: .45}}, {label: '読書の時間', sector: 4, r: .8}]}),
  ]) {
    const {shape, problems, warnings} = await laid(band);
    assert.deepEqual(problems, []);
    const pts = linePoints(shape), dots = circles(shape).filter(c => c.r === 6).map(c => ({x: c.cx - 6, y: c.cy - 6, w: 12, h: 12}));
    const labels = shape.labelBoxes.filter(b => band.marks!.some(m => b.label === m.label));
    for (const l of labels) {
      for (const d of dots) assert.ok(!meet(l, d), `${l.label} on a dot`);
      for (const o of shape.labelBoxes) if (o.label !== l.label) assert.ok(!meet(l, o), `${l.label} on "${o.label}"`);
      const reported = (shape.crossings ?? []).includes(l.label);
      if (!reported) assert.ok(!crosses(l, pts), `${l.label} crosses a line without being reported`);
      if (reported) assert.ok(warnings.some(w => w.startsWith('[concentric-label-crossing]') && w.includes(`"${l.label}"`)));
    }
  }
});

test('concentric with sectors: a crowded ring reports what crosses, and verify says which mark', async () => {
  const marks = ['Cloudflare Workers', 'Amazon Web Services', 'Google Cloud Platform', 'Microsoft Azure'].map(label => ({label, sector: 1, ring: 1}));
  const {shape, warnings} = await laid(concentric(RADAR, {order: 'inner-first', sectors: DOMAINS, marks}));
  assert.ok((shape.crossings ?? []).length > 0);
  for (const label of shape.crossings ?? []) assert.ok(warnings.some(w => w.startsWith('[concentric-label-crossing]') && w.includes(`"${label}"`)));
  // through a spec, the finding says where the mark is
  const spec = {version: 1, title: 't', parts: [{type: 'concentric', order: 'inner-first', rings: RADAR, sectors: DOMAINS, marks}]};
  const {renderSpec} = await import('../lib/spec-render.ts');
  const r = await renderSpec(spec);
  const f = r.findings.filter(x => x.rule === 'concentric-label-crossing');
  assert.ok(f.length > 0 && f.every(x => /^parts\[0\]\.marks\[\d\]/.test(x.path ?? '')), JSON.stringify(f));
});

test('concentric with sectors: from gets a dotted ring and an arrow; the key draws the same marks; labels keep off the arrow', async () => {
  const {shape, problems} = await laid(concentric(4, {sectors: DOMAINS, centre: '価値に沿った生き方', marks: [{label: '資格の勉強', sector: 1, r: .3, from: {r: .8}}, {label: '家族と夕食', sector: 3, r: .5}]}));
  assert.deepEqual(problems, []);
  const was = circles(shape).filter(c => c.dash === '2,2'), arrows = paths(shape).filter(p => p.arrow);
  assert.equal(was.length, 2, 'one in the figure, one in the key');
  assert.equal(arrows.length, 2);
  assert.ok(shape.texts.some(t => t.text === '前回') && shape.texts.some(t => t.text === '今回'));
  assert.ok(shape.texts.some(t => t.text === '価値に沿った生き方'), 'the centre word on one line: the innermost ring grows for it');
  const [x1, y1, x2, y2] = arrows[0]!.d.replace(/[ML]/g, '').split(/[ ,]+/).filter(Boolean).map(Number) as [number, number, number, number];
  const trail: [number, number][] = Array.from({length: 33}, (_v, i) => [x1 + (x2 - x1) * i / 32, y1 + (y2 - y1) * i / 32]);
  assert.ok(!crosses(shape.labelBoxes.find(b => b.label === '資格の勉強')!, trail), 'the label is off its own arrow');
  const none = await laid(concentric(4, {sectors: DOMAINS, marks: [{label: 'x', sector: 1, r: .3, from: {r: .8}}], fromLegend: false}));
  assert.ok(!none.shape.texts.some(t => t.text === '前回'));
});

test('concentric with sectors: a mark that moved from another sector keeps its dotted ring off the marks that live there', async () => {
  for (const r of [.4, .5, .6, .8]) {
    const {shape, problems} = await laid(concentric(3, {sectors: DOMAINS, marks: [{label: 'x', sector: 1, r}, {label: '移った', sector: 3, r, from: {sector: 1, r}}]}));
    assert.deepEqual(problems, []);
    const was = circles(shape).find(c => c.dash === '2,2')!, x = circles(shape).find(c => c.r === 6)!;
    assert.ok(Math.hypot(was.cx - x.cx, was.cy - x.cy) >= 12, `r ${r}: the ring where it was is ${Math.hypot(was.cx - x.cx, was.cy - x.cy).toFixed(1)}px from mark x`);
  }
});

test('concentric with one ring and a centre word still draws the sector cuts', async () => {
  const {shape} = await laid(concentric(1, {sectors: DOMAINS, centre: '中心のことば'}));
  const cuts = paths(shape).filter(p => p.thin).map(p => p.d.replace(/[ML]/g, '').split(/[ ,]+/).filter(Boolean).map(Number));
  assert.equal(cuts.length, 4);
  for (const [x1, y1, x2, y2] of cuts as [number, number, number, number][]) assert.ok(Math.hypot(x2 - x1, y2 - y1) > 20, 'a cut has length');
});

test('concentric: two sectors (or named rings) with one label, or one id twice, are refused', () => {
  assert.throws(() => concentricBand(2, {sectors: [{label: 'A'}, {label: 'A'}]}), /two sectors are labelled "A"/);
  assert.throws(() => concentricBand([{label: 'x'}, {label: 'x'}], {sectors: DOMAINS}), /two rings are labelled "x"/);
  assert.throws(() => concentricBand([{label: 'x', id: 'k'}, {label: 'y'}], {sectors: [{label: 'A', id: 'k'}]}), /duplicate id "k"/);
});

test('concentric without sectors is drawn as before', async () => {
  const {shape} = await laid(concentric([{label: '境界'}, {label: 'アプリ'}, {label: 'データ'}], {centre: '重要情報'}));
  assert.equal(paths(shape).length, 0);
  assert.equal(circles(shape).length, 3);
});

test('concentric: ring, sector and mark ids are anchors that connect() reaches', async () => {
  const {problems} = await laid(concentric(2, {sectors: [{label: '仕事', id: 'work'}, {label: '家族'}], marks: [{label: '今', sector: 'work', r: .4, id: 'now'}]}), connect('now', 'work'));
  assert.deepEqual(problems, []);
});

// ---- concentric with sectors, layout: 'stack' -----------------------------------------------------------------------------------

/** The grid of a stack: the outline, its columns (one per sector) and rows (one per ring, the innermost at the top). */
function grid(s: LaidOutFlowShape, cols: number, rows: number) {
  const r = s.primitives.find(p => p.k === 'rect')!;
  if (r.k !== 'rect') throw new Error('no grid');
  const colW = r.w / cols, rowH = r.h / rows;
  return {r, col: (x: number) => Math.floor((x - r.x) / colW), row: (y: number) => Math.floor((y - r.y) / rowH), rowH};
}

test("concentric layout: 'stack' needs sectors and is 'circle' or 'stack'; in a spec too", () => {
  assert.throws(() => concentricBand(RADAR, {layout: 'stack'}), /give sectors too/);
  assert.throws(() => concentricBand(4, {sectors: DOMAINS, layout: 'grid' as never}), /'circle' or 'stack'/);
  assert.equal(concentricBand(4, {sectors: DOMAINS, layout: 'stack'}).layout, 'stack');
  assert.deepEqual(validateSpec({version: 1, title: 't', parts: [{type: 'concentric', rings: RADAR, layout: 'stack'}]}).map(i => i.path), ['parts[0].layout']);
  assert.deepEqual(validateSpec({version: 1, title: 't', parts: [{type: 'concentric', rings: 3, sectors: DOMAINS, layout: 'stack'}]}), []);
});

test("concentric layout: 'stack': a column per sector, a row per ring (the innermost on top); each mark in its own box, r as the height in its row", async () => {
  const marks = [{label: 'TS', sector: 1, ring: 'Adopt'}, {label: 'Go', sector: 1, ring: 'Adopt'}, {label: 'Rust', sector: 1, ring: 'Adopt'}, {label: 'Bun', sector: 2, ring: 'Trial'}, {label: 'k8s', sector: 4, ring: 'Hold'}, {label: '近い', sector: 3, r: .05}, {label: '遠い', sector: 3, r: .95}];
  const {shape, problems} = await laid(concentric(RADAR, {order: 'inner-first', layout: 'stack', sectors: DOMAINS, centre: '中心', marks}));
  assert.deepEqual(problems, []);
  const g = grid(shape, 4, 4), dots = circles(shape).filter(c => c.r === 6);
  const rowOf: Record<string, number> = {Adopt: 0, Trial: 1, Assess: 2, Hold: 3};
  marks.forEach((m, i) => {
    const d = dots[i]!;
    assert.equal(g.col(d.cx), m.sector - 1, `${m.label} in column ${m.sector}`);
    if (m.ring) assert.equal(g.row(d.cy), rowOf[m.ring], `${m.label} in the row of ${m.ring}`);
  });
  assert.equal(g.row(dots[5]!.cy), 0, 'r .05: the top row');
  // r is a height inside its ring's row: the further out, the lower (the rings cut r as the circle does: edges at ((i + 1) / n)^0.75)
  const heights = await laid(concentric(3, {layout: 'stack', sectors: DOMAINS, marks: [.02, .2, .42, .46, .7, .76, .98].map((r, i) => ({label: `m${i}`, sector: i % 4 + 1, r}))}));
  const hg = grid(heights.shape, 4, 3), hy = circles(heights.shape).filter(c => c.r === 6).map(c => c.cy);
  assert.deepEqual(hy.map(y => hg.row(y)), [0, 0, 0, 1, 1, 2, 2]);
  for (let i = 1; i < hy.length; i++) assert.ok(hy[i]! > hy[i - 1]!, `r rises down the rows (${hy.join(', ')})`);
  assert.ok(hy[2]! - hg.r.y > hg.rowH * .6, 'r .42 sits low in the top row (its edge is at .44)');
  assert.equal(g.row(dots[6]!.cy), 3, 'r .95: the bottom row');
  // the centre word heads the columns; the sector names sit under them; the ring names left of the rows
  const label = (t: string) => shape.labelBoxes.find(b => b.label === t)!;
  assert.ok(label('中心').y + label('中心').h <= g.r.y);
  for (const s of DOMAINS) assert.ok(label(s.label).y >= g.r.y + g.r.h);
  for (const r of RADAR) assert.ok(label(r.label).x + label(r.label).w <= g.r.x);
  // the same data drawn as a circle has no grid
  assert.ok(!(await laid(concentric(RADAR, {order: 'inner-first', sectors: DOMAINS, marks}))).shape.primitives.some(p => p.k === 'rect'));
});

test("concentric layout: 'stack': however crowded a box, its labels stay inside it (inside the frame), off every line, text, dot and arrow — the row grows", async () => {
  const names = ['TypeScript', 'Effect', 'Biome', 'pnpm', 'Bun', 'Fly.io', 'Kubernetes', 'ADR', 'モブプロ', 'Deno', 'Vite', 'Turborepo'];
  const spread = names.map((label, i) => ({label, sector: i % 4 + 1, ring: (i * 7) % 4 + 1}));
  const many = (k: number, at: {ring: number} | {r: number}) => Array.from({length: k}, (_v, i) => ({label: `${['Cloudflare Workers', 'Amazon Web Services', 'Google Cloud Platform', 'Microsoft Azure'][i % 4]} ${i + 1}`, sector: 1, ...at}));
  // a move across three columns: the marks in between keep off its arrow
  const across = [{label: '移った', sector: 4, ring: 1, from: {sector: 1, ring: 1}}, {label: 'Bx', sector: 2, ring: 1}, {label: 'Cx', sector: 3, ring: 1}];
  for (const marks of [spread, many(20, {ring: 1}), many(8, {r: .44}), many(8, {r: 0}), many(8, {r: 1}), across]) {
    const band = concentric(RADAR, {order: 'inner-first', layout: 'stack', sectors: DOMAINS, marks});
    const {shape, problems} = await laid(band);
    assert.deepEqual(problems, []);
    assert.deepEqual(shape.crossings ?? [], [], 'the row is as tall as its box needs: nothing has to cross a line');
    const g = grid(shape, 4, 4), pts = linePoints(shape), dots = circles(shape).filter(c => c.r === 6);
    const arrows = paths(shape).filter(p => p.arrow).map(p => p.d.replace(/[ML]/g, '').split(/[ ,]+/).filter(Boolean).map(Number) as [number, number, number, number]);
    for (const l of shape.labelBoxes.filter(b => marks.some(m => b.label === m.label))) {
      const m = marks.find(x => x.label === l.label)!, d = dots[marks.indexOf(m)]!;
      assert.ok(l.x >= g.r.x && l.x + l.w <= g.r.x + g.r.w && l.y >= g.r.y && l.y + l.h <= g.r.y + g.r.h, `${l.label} inside the frame`);
      assert.equal(g.col(l.x + l.w / 2), m.sector - 1, `${l.label} in its column`);
      assert.equal(g.row(l.y + l.h / 2), g.row(d.cy), `${l.label} in its dot's row`);
      for (const o of dots) assert.ok(!meet(l, {x: o.cx - 6, y: o.cy - 6, w: 12, h: 12}), `${l.label} on a dot`);
      for (const o of shape.labelBoxes) if (o.label !== l.label) assert.ok(!meet(l, o), `${l.label} on "${o.label}"`);
      assert.ok(!crosses(l, pts), `${l.label} crosses a line`);
    }
    for (const [x1, y1, x2, y2] of arrows) for (const d of dots) {
      const L = Math.hypot(x2 - x1, y2 - y1), u = ((d.cx - x1) * (x2 - x1) + (d.cy - y1) * (y2 - y1)) / L / L;
      if (u > .02 && u < .98) assert.ok(Math.hypot(x1 + u * (x2 - x1) - d.cx, y1 + u * (y2 - y1) - d.cy) >= 7, `a dot at ${d.cx},${d.cy} on an arrow`);
    }
  }
});

test("concentric layout: 'stack': too narrow a band is an error that says how wide; long ring names make the rows taller", async () => {
  const eight = Array.from({length: 8}, (_v, i) => ({label: `S${i + 1}`}));
  await assert.rejects(checkDiagram(diagram({theme: 'blue', width: 360}).add(concentric(RADAR, {order: 'inner-first', layout: 'stack', sectors: eight}))), /layout 'stack' with 8 sectors needs a band at least \d+px wide/);
  const long = [{label: 'とても長い輪の名前がここに入ります二十四字'}, {label: 'もうひとつとても長い輪の名前がここに入る'}, {label: 'さらに長い輪の名前がここにありますよ三'}];
  const {shape, problems} = await laid(concentric(long, {layout: 'stack', sectors: DOMAINS, marks: [{label: 'x', sector: 1, ring: 1}]}));
  assert.deepEqual(problems, []);
  const g = grid(shape, 4, 3);
  for (const r of long) { const b = shape.labelBoxes.find(x => x.label === r.label)!; assert.ok(b.h + 8 <= g.rowH, `${r.label}: its row holds it`); }
});

test("concentric layout: 'stack': from is an arrow up or down its column; from another column it starts mid-column, clear of the marks there", async () => {
  const {shape, problems} = await laid(concentric(3, {layout: 'stack', sectors: DOMAINS, centre: '価値に沿った生き方', marks: [{label: '資格の勉強', sector: 1, r: .3, from: {r: .7}}, {label: '週 1 で運動', sector: 3, r: .65, from: {r: .45}}]}));
  assert.deepEqual(problems, []);
  const arrows = paths(shape).filter(p => p.arrow).map(p => p.d.replace(/[ML]/g, '').split(/[ ,]+/).filter(Boolean).map(Number) as [number, number, number, number]);
  assert.equal(arrows.length, 3, 'two moves and the key');
  const [up, down] = arrows as [[number, number, number, number], [number, number, number, number]];
  assert.ok(Math.abs(up[0] - up[2]) < 1 && up[3] < up[1], 'closer to the values: up');
  assert.ok(Math.abs(down[0] - down[2]) < 1 && down[3] > down[1], 'further: down');
  assert.ok(shape.texts.some(t => t.text === '前回'));
  for (const r of [.2, .5, .8]) {
    const moved = await laid(concentric(3, {layout: 'stack', sectors: DOMAINS, marks: [{label: 'x', sector: 1, r}, {label: 'y', sector: 1, r}, {label: '移った', sector: 3, r, from: {sector: 1, r}}]}));
    assert.deepEqual(moved.problems, []);
    const was = circles(moved.shape).find(c => c.dash === '2,2')!, g = grid(moved.shape, 4, 3);
    assert.ok(Math.abs(was.cx - (g.r.x + g.r.w / 8)) <= 2, 'it was in the middle of column 1');
    for (const d of circles(moved.shape).filter(c => c.r === 6)) assert.ok(Math.hypot(was.cx - d.cx, was.cy - d.cy) >= 24, `r ${r}: a dot ${Math.hypot(was.cx - d.cx, was.cy - d.cy).toFixed(1)}px from where it was`);
  }
});

// ---- cycle with links --------------------------------------------------------------------------------------------------------

test('cycleBand with links: every pair, or the links given (by number, id or label); bad links are refused', () => {
  const four = [{label: '思考'}, {label: '感情'}, {label: '身体'}, {label: '行動', id: 'act'}];
  assert.equal(cycleBand(four, {links: 'all'}).links?.length, 6);
  assert.deepEqual(cycleBand(four, {links: [{from: 1, to: 'act', label: '促す', direction: 'forward'}, {from: '感情', to: '身体'}]}).links, [{from: 0, to: 3, label: '促す', both: false}, {from: 1, to: 2, both: true}]);
  assert.equal(cycleBand(four).links, undefined, 'no links: the cycle of arrows round the ring');
  assert.throws(() => cycleBand(four, {links: [{from: 1, to: 1}]}), /to itself/);
  assert.throws(() => cycleBand(four, {links: [{from: 1, to: 9}]}), /link 1 to 9 is not one of them/);
  assert.throws(() => cycleBand(four, {links: [{from: 1, to: 2}, {from: 2, to: 1}]}), /two links join/);
  assert.throws(() => cycleBand(four, {links: 'all', direction: 'ccw'}), /direction/);
  assert.throws(() => cycleBand(Array.from({length: 7}, (_v, i) => ({label: `${i}`})), {links: 'all'}), /up to 6/);
  assert.throws(() => cycleBand(four, {frame: ' '}), /frame/);
});

test('cycle with links: the steps sit on a regular polygon (four on a square), each link runs between two circles without entering one', async () => {
  for (const n of [3, 4, 5, 6]) {
    const steps = Array.from({length: n}, (_v, i) => ({label: `要素${i + 1}`}));
    const {shape, problems, warnings} = await laid(cycle(steps, {links: 'all', frame: '状況・環境'}));
    assert.deepEqual(problems, [], `${n}`);
    assert.deepEqual(warnings, [], `${n}`);
    const nodes = circles(shape);
    assert.equal(nodes.length, n);
    const cx = nodes.reduce((a, c) => a + c.cx, 0) / n, cy = nodes.reduce((a, c) => a + c.cy, 0) / n;
    // the polygon may be wider than tall: measure the angles with both axes scaled to one (Σdx² = n Rx² / 2 on a regular polygon)
    const rx = Math.sqrt(2 * nodes.reduce((a, c) => a + (c.cx - cx) ** 2, 0) / n), ry = Math.sqrt(2 * nodes.reduce((a, c) => a + (c.cy - cy) ** 2, 0) / n);
    const angles = nodes.map(c => Math.atan2((c.cy - cy) / ry, (c.cx - cx) / rx)).sort((a, b) => a - b);
    angles.forEach((a, i) => { if (i) assert.ok(Math.abs(a - angles[i - 1]! - 2 * Math.PI / n) < .2, `${n}: evenly spaced`); });
    if (n === 4) assert.equal(new Set(nodes.map(c => c.cy)).size, 2, 'a square: two rows');
    assert.equal(paths(shape).length, n * (n - 1), 'every pair, two arrows each');
    for (const p of paths(shape)) {
      const [x, y] = p.d.split(' ').at(-1)!.replace('L', '').split(',').map(Number) as [number, number];
      for (const c of nodes) assert.ok(Math.hypot(x - c.cx, y - c.cy) >= c.r, 'a head stops at the circle');
    }
    // the frame holds the figure and is no wider than it needs
    const frame = shape.primitives.find(p => p.k === 'rect') as Rect;
    const left = Math.min(...nodes.map(c => c.cx - c.r)), right = Math.max(...nodes.map(c => c.cx + c.r));
    assert.ok(frame.x < left && frame.x + frame.w > right, `${n}: the frame holds the circles`);
    assert.ok(left - frame.x <= 48 && frame.x + frame.w - right <= 48, `${n}: the frame fits them (${left - frame.x}, ${frame.x + frame.w - right})`);
  }
});

test('cycle with links: words fit their circles on one line when they can; a centre sits on its own disc; link labels are written', async () => {
  const {shape, problems} = await laid(cycle([{label: '思考', sub: 'また失敗した'}, {label: '感情', sub: '不安・恥ずかしさ'}, {label: '身体', sub: '肩がこわばる'}, {label: '行動', sub: '返事を先延ばし'}], {centre: '本人', links: [{from: 1, to: 2, label: '強める'}, {from: 1, to: 3}]}));
  assert.deepEqual(problems, []);
  for (const s of ['また失敗した', '不安・恥ずかしさ', '肩がこわばる', '返事を先延ばし']) assert.ok(shape.texts.some(t => t.text === s), `${s} on one line`);
  assert.ok(circles(shape).some(c => c.fill === 'plain'), 'the centre disc');
  assert.ok(shape.texts.some(t => t.text === '強める'));
});

test('cycle with links: labels of links that cross in the middle sit off the other link', async () => {
  const {shape, problems} = await laid(cycle([{label: '思考'}, {label: '感情'}, {label: '身体'}, {label: '行動'}], {links: [{from: 1, to: 3, label: '強める'}, {from: 2, to: 4, label: '弱める'}]}));
  assert.deepEqual(problems, []);
  const segs = paths(shape).map(p => p.d.replace(/[ML]/g, '').split(/[ ,]+/).filter(Boolean).map(Number) as [number, number, number, number]);
  for (const name of ['強める', '弱める']) {
    const box = shape.labelBoxes.find(b => b.label === name)!;
    // each label is clear of the link it does not belong to (two arrows each: the label's own link is the pair written first or second)
    const own = name === '強める' ? segs.slice(0, 2) : segs.slice(2);
    const other = segs.filter(sg => !own.includes(sg)).flatMap(([x1, y1, x2, y2]) => Array.from({length: 33}, (_v, i) => [x1 + (x2 - x1) * i / 32, y1 + (y2 - y1) * i / 32] as [number, number]));
    assert.ok(!crosses(box, other), `${name} is off the other link`);
  }
  const all = await laid(cycle([{label: 'A'}, {label: 'B'}, {label: 'C'}, {label: 'D'}], {links: [[1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]].map(([from, to]) => ({from: from!, to: to!, label: `${from}-${to}`}))}));
  assert.deepEqual(all.problems, []);
});

test('cycle with links: too narrow a band is an error that says how wide, not overlapping circles', () => {
  const four = [{label: '思考'}, {label: '感情'}, {label: '身体'}, {label: '行動'}];
  return assert.rejects(checkDiagram(diagram({theme: 'blue'}).add(cycle(four, {links: 'all', width: 240}))), /need a band at least \d+px wide/);
});

test('a frame round an ordinary cycle', async () => {
  const {shape, problems} = await laid(cycle([{label: '計画'}, {label: '実行'}, {label: '評価'}, {label: '改善'}], {frame: 'チームの 1 か月'}));
  assert.deepEqual(problems, []);
  assert.equal(shape.primitives.filter(p => p.k === 'rect').length, 1);
  assert.ok(shape.texts.some(t => t.text === 'チームの 1 か月'));
});

// ---- specs and the strict lint ---------------------------------------------------------------------------------------------

test('STEP_REF takes a number from 1 or a name; refIssue reports one that is neither, with the names it could be', () => {
  assert.deepEqual(STEP_REF('x').oneOf?.map(o => o.type), ['integer', 'string']);
  const issues: SpecIssue[] = [];
  refIssue(2, 3, ['a'], 'p1', 'steps', issues);
  refIssue('a', 3, ['a'], 'p2', 'steps', issues);
  refIssue(undefined, 3, ['a'], 'p3', 'steps', issues);
  refIssue(4, 3, ['a', 'b'], 'p4', 'steps', issues);
  refIssue('z', 3, [], 'p5', 'steps', issues);
  assert.deepEqual(issues.map(i => i.path), ['p4', 'p5']);
  assert.match(issues[0]!.message, /3 steps .*"a", "b"/);
  assert.match(issues[1]!.message, /none are named/);
});

test('the spec parts: sectors, marks and links validate, and a wrong ring, sector or link is reported where it is', async () => {
  const ok = [
    {type: 'concentric', rings: 3, centre: '価値に沿った生き方', sectors: DOMAINS, marks: [{label: '資格の勉強', sector: 1, r: .3, from: {r: .7}}]},
    {type: 'cycle', frame: '状況：上司に頼まれた', links: 'all', steps: [{label: '思考'}, {label: '感情'}, {label: '行動'}, {label: '身体'}]},
  ];
  for (const part of ok) {
    const spec = {version: 1, title: 't', parts: [part]};
    assert.deepEqual(validateSpec(spec), [], part.type);
    const {verdict} = await checkDiagram(specToDiagram(spec));
    assert.deepEqual(verdict.problems, [], part.type);
  }
  const bad = validateSpec({version: 1, title: 't', parts: [{type: 'concentric', sectors: [{label: 'A'}], rings: [{label: 'x'}, {label: 'y'}], marks: [{label: 'm', sector: 2, ring: 'z'}, {label: 'n', sector: 1}]}]});
  assert.deepEqual(bad.map(i => i.path), ['parts[0].marks[0].sector', 'parts[0].marks[0].ring', 'parts[0].marks[1]']);
  assert.deepEqual(validateSpec({version: 1, title: 't', parts: [{type: 'concentric', rings: 3}]}).map(i => i.path), ['parts[0].rings']);
  assert.deepEqual(validateSpec({version: 1, title: 't', parts: [{type: 'concentric', rings: 2, sectors: [{label: 'A'}, {label: 'A'}]}]}).map(i => i.path), ['parts[0].sectors[1].label']);
  const selfAndTwice = validateSpec({version: 1, title: 't', parts: [{type: 'cycle', steps: [{label: 'a'}, {label: 'b'}, {label: 'c'}], links: [{from: 1, to: 'a'}, {from: 1, to: 2}, {from: 'b', to: 'a'}]}]});
  assert.deepEqual(selfAndTwice.map(i => i.path), ['parts[0].links[0]', 'parts[0].links[2]']);
  const centre = (part: object) => validateSpec({version: 1, title: 't', parts: [{type: 'quadrant', x: {title: 'x'}, y: {title: 'y'}, ...part}]}).map(i => i.path);
  assert.deepEqual(centre({centre: '私'}), ['parts[0].centre']);
  assert.deepEqual(centre({centre: '私', crosshair: true}), []);
  assert.deepEqual(centre({centre: '私', crosshair: true, grid: [3, 3]}), ['parts[0].centre']);
  assert.deepEqual(validateSpec({version: 1, title: 't', parts: [{type: 'quadrant', preset: 'actMatrix', grid: [3, 3]}]}).map(i => i.path), ['parts[0].preset']);
  assert.deepEqual(validateSpec({version: 1, title: 't', parts: [{type: 'quadrant', preset: 'actMatrix', grid: [3, 3], centre: ''}]}), []);
  const links = validateSpec({version: 1, title: 't', parts: [{type: 'cycle', steps: [{label: 'a'}, {label: 'b'}, {label: 'c'}], links: [{from: 1, to: 'd'}], direction: 'ccw'}]});
  assert.deepEqual(links.map(i => i.path), ['parts[0].direction', 'parts[0].links[0].to']);
  // lang: 'en' gives every concentric the key's words: one without sectors still draws
  const en = {version: 1, title: 't', lang: 'en', parts: [{type: 'concentric', rings: [{label: 'Core'}, {label: 'Edge'}]}]};
  assert.deepEqual(validateSpec(en), []);
  assert.deepEqual((await checkDiagram(specToDiagram(en))).verdict.problems, []);
  const enMarks = specToDiagram({version: 1, title: 't', lang: 'en', parts: [{type: 'concentric', rings: 2, sectors: [{label: 'Work'}], marks: [{label: 'now', sector: 1, r: .3, from: {r: .6}}]}]});
  const {laidOut} = await checkDiagram(enMarks);
  assert.ok((laidOut.laidOut.find(b => b.type === 'concentric') as LaidOutFlowShape).texts.some(t => t.text === 'Last time'));
  assert.ok(partCatalog().find(p => p.type === 'concentric')!.description.includes('Bullseye'));
});

test('the new figures and the ACT Matrix pass the strict SVG lint (build), in a dark appearance too', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'act-cbt-'));
  const bands = [
    quadrant.preset('actMatrix', {items: [{label: '不安', cell: [0, 1]}, {label: '先延ばし', cell: [0, 0]}, {label: '家族', cell: [1, 1]}, {label: '電話する', cell: [1, 0]}]}),
    concentric(3, {sectors: DOMAINS, centre: '価値に沿った生き方', marks: [{label: '資格の勉強', sector: 1, r: .3, from: {r: .8}}, {label: '家族と夕食', sector: 2, r: .6}]}),
    cycle([{label: '思考'}, {label: '感情'}, {label: '身体'}, {label: '行動'}], {links: 'all', frame: '状況・環境', centre: '本人'}),
    concentric(RADAR, {order: 'inner-first', layout: 'stack', sectors: DOMAINS, marks: [{label: 'Biome', sector: 2, ring: 'Adopt', from: {ring: 'Trial'}}, {label: 'Bun', sector: 2, ring: 'Trial'}]}),
  ];
  for (const [i, band] of bands.entries()) for (const dark of [false, true]) {
    const file = path.join(dir, `${i}-${dark}.svg`);
    await build(diagram({theme: 'blue', title: 'x', ...(dark ? {appearance: 'dark'} : {})} as never).add(band as never), file); // build() runs lint-svg --strict and throws on a finding
    const svg = fs.readFileSync(file, 'utf8');
    if (i > 0) assert.ok(svg.includes('id="dsl-arrow"') && svg.includes('marker-end="url(#dsl-arrow'), `${i} ${dark}: the arrow head is defined and used`);
  }
});

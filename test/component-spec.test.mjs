// Tools for specifying a component and its states: state matrix, frames, states on any widget, anatomy numbers, regions.
import test from 'node:test';
import assert from 'node:assert/strict';
import {wf, layoutWireframe, layoutScreens, collectTextRequests} from '../lib/wireframe.mjs';
import {wireframe, stateMatrix, screens, diagram} from '../lib/dsl.mjs';
import {lintDiagram} from '../lib/rules.mjs';

const widthOf = (atom, size) => [...atom].length * size * 0.6;
const wfLayout = (root, opts = {}, w = 900) => layoutWireframe({type: 'wireframe', root, h: 420, ...opts}, 0, 0, w, widthOf);
const texts = (b) => b.prims.filter(p => p.k === 'text').map(p => p.s);
const robot = (o = {}) => wf.robot({name: 'A', battery: 0.82, link: 3, last: '1 秒前', ...o});

test('robot card: the signal never overlaps the battery text, whatever its length', () => {
  const b = wfLayout(wf.col([robot({battery: 0.12, compact: false})]), {}, 400);
  const bat = b.prims.find(p => p.k === 'text' && p.s.startsWith('12%')), sigBars = b.prims.filter(p => p.k === 'rect' && p.w === 6 && p.h === 6)[0];
  assert.ok(sigBars.x > bat.x + widthOf(bat.s, 14) - 1, 'the signal starts after the battery text');
});

test('robot card: a narrow frame stacks its rows (nothing sticks out)', () => {
  const b = wfLayout(wf.col([robot({mode: '巡回中'})]), {}, 150);
  assert.ok(b.prims.every(p => p.k !== 'text' || p.x <= 150), 'inside the frame');
  const rows = new Set(b.prims.filter(p => p.k === 'text').map(p => Math.round(p.y)));
  assert.ok(rows.size >= 4, 'name, battery, signal and last-received sit on separate rows');
});

test('callouts get an invisible backing rect of their own (so a number on a frame edge is not "spilling")', () => {
  const b = wfLayout(wf.col([wf.btn('x', {n: 1})]));
  const backing = b.prims.find(p => p.k === 'rect' && p.fill === 'bg' && p.op === 0 && p.w === 24);
  assert.ok(backing, 'backing rect');
});

test('state works on any widget: loading = skeleton, empty = message, stale = readable with a badge', () => {
  const loading = wfLayout(wf.col([wf.stat('5', '稼働', {state: 'loading'})]));
  assert.ok(texts(loading).includes('読み込み中') && !texts(loading).includes('稼働'), 'content replaced by a skeleton');
  const empty = wfLayout(wf.col([wf.card([wf.text('x')], {title: 'T', state: 'empty', stateNote: 'まだない', h: 90})]));
  assert.ok(texts(empty).includes('データなし') && texts(empty).includes('まだない'));
  const stale = wfLayout(wf.col([wf.stat('5', '稼働', {state: 'stale', stateNote: '10:24'})]));
  assert.ok(texts(stale).includes('稼働') && texts(stale).includes('古い情報 10:24'), 'the data stays; a badge says it is old');
  assert.throws(() => wfLayout(wf.col([wf.chip('x', {state: 'loading'})])), /at least 80x40px/);
});

test('a state that replaces the content hides what was drawn under it', () => {
  const b = wfLayout(wf.col([wf.video({live: true, overlay: ['良好'], state: 'disconnected', label: 'Go2-A'})]));
  assert.ok(!texts(b).includes('LIVE') && !texts(b).includes('良好'), 'stale chips are gone');
  assert.ok(texts(b).includes('Go2-A'), 'but the frame keeps its name');
});

test('fusion: a layer with a state is shown disabled and the rest keep working', () => {
  const b = wfLayout(wf.fusion({layers: ['カメラ', {label: '点群', state: 'missing'}, '赤外線']}), {}, 600);
  assert.ok(texts(b).includes('点群（データ欠損中）'));
  assert.equal(b.prims.filter(p => p.k === 'rect' && p.w === 36 && p.h === 20 && p.fill === 'accent').length, 2, 'two layers on');
});

test('anatomy: numbers on the inner parts of a component', () => {
  const b = wfLayout(wf.col([wf.insight({title: 'T', evidence: [{kind: 'k', at: 't'}], parts: {level: 1, title: 2, evidence: 3, reference: 4}})]));
  const nums = b.prims.filter(p => p.k === 'text' && p.fill === 'bg' && /^[1-4]$/.test(p.s)).map(p => p.s).sort();
  assert.deepEqual(nums, ['1', '2', '3', '4']);
});

test('frame: "light" and "none" drop the heavy screen border; h: "fit" hugs the content', () => {
  const heavy = wfLayout(wf.col([robot()]), {h: 300});
  const light = wfLayout(wf.col([robot()]), {frame: 'light', h: 'fit'});
  const none = wfLayout(wf.col([robot()]), {frame: 'none', h: 'fit'});
  assert.ok(heavy.prims.some(p => p.k === 'rect' && p.sw === 2.5 && p.stroke === 'text'));
  assert.ok(!light.prims.some(p => p.k === 'rect' && p.sw === 2.5 && p.stroke === 'text'));
  assert.ok(!none.prims.some(p => p.k === 'rect' && p.sw === 2.5 && p.stroke === 'text'));
  assert.ok(light.h < heavy.h && none.h <= light.h, 'fit is shorter than the fixed 300');
});

test('stateMatrix: cells are designs, "対象外" (with a reason) or "未設計"', () => {
  const band = stateMatrix(['通常', '空'], [{label: '一覧', cells: [wf.text('x', {h: 30}), 'na']}, {label: 'カード', cells: [wf.text('y', {h: 30}), undefined]}]);
  const b = layoutScreens(band, 0, 0, 900, widthOf);
  const t = texts(b);
  for (const s of ['通常', '空', '一覧', 'カード', '対象外', '未設計']) assert.ok(t.includes(s), s);
  assert.equal(b.anchors.length, 2, 'the two designed cells');
  const asked = new Set(collectTextRequests(band).map(r => r[0]));
  assert.ok(asked.has('未設計') && asked.has('通常'), 'matrix strings are measured');
});

test('check: unfinished state matrices and missing required states are reported', () => {
  const d = diagram({theme: 'blue', title: 't'});
  d.add(stateMatrix(['通常', '空'], [{label: '一覧', cells: [wf.text('x'), undefined]}], {required: ['通常', '読み込み中']}));
  const f = lintDiagram({...d, laidOut: [], connects: []});
  assert.ok(f.some(x => x.rule === 'wf-states-todo' && /一覧×空/.test(x.message)));
  assert.ok(f.some(x => x.rule === 'wf-states-required' && /読み込み中/.test(x.message)));
});

test('check: callout numbers and notes must match one to one', () => {
  const run = (root, notes) => { const d = diagram({theme: 'blue', title: 't'}); d.add(wireframe(root, {notes, title: 'S'})); return lintDiagram({...d, laidOut: [], connects: []}).map(x => x.rule); };
  assert.deepEqual(run(wf.col([wf.btn('a', {n: 1})]), [{title: 'a', text: 'x'}]).filter(r => r.startsWith('wf-')), []);
  assert.ok(run(wf.col([wf.btn('a', {n: 1}), wf.btn('b', {n: 2})]), [{title: 'a', text: 'x'}]).includes('wf-callout-no-note'));
  assert.ok(run(wf.col([wf.btn('a', {n: 1})]), [{title: 'a', text: 'x'}, {title: 'b', text: 'y'}]).includes('wf-note-no-callout'));
  assert.ok(run(wf.col([wf.btn('a', {n: 1}), wf.btn('b', {n: 3})]), [{title: 'a', text: 'x'}, {title: 'b', text: 'y'}, {title: 'c', text: 'z'}]).includes('wf-callout-gap'));
});

test('autoNumber: n: true numbers callouts in reading order, after explicit ones', () => {
  const root = wf.col([wf.row([wf.btn('a', {n: true}), wf.btn('b', {n: 1})]), wf.btn('c', {n: true}), wf.insight({title: 'T', evidence: [{kind: 'k', at: 't'}], parts: {level: true}})]);
  wireframe(root, {});
  assert.equal(root.children[0].children[0].n, 2);
  assert.equal(root.children[1].n, 3);
  assert.equal(root.children[2].parts.level, 4);
});

test('region: a named block for a coarse screen, with a reading-order number', () => {
  const b = wfLayout(wf.row([wf.region('地図', {n: 1, emphasis: 'primary', hint: '約 2/3'}), wf.region('一覧')]));
  assert.ok(texts(b).includes('地図') && texts(b).includes('約 2/3') && texts(b).includes('一覧'));
});

test('stateMatrix: a row shorter than the columns gets "未設計" cells (never blanks); a longer row is an error', () => {
  const band = stateMatrix(['通常', '空', 'エラー'], [{label: 'A', cells: [wf.text('x', {h: 30})]}]);
  const b = layoutScreens(band, 0, 0, 900, widthOf);
  assert.equal(texts(b).filter(t => t === '未設計').length, 2);
  const d = diagram({theme: 'blue', title: 't'});
  d.add(stateMatrix(['通常', '空', 'エラー'], [{label: 'A', cells: [wf.text('x')]}]));
  assert.match(lintDiagram({...d, laidOut: [], connects: []}).find(x => x.rule === 'wf-states-todo').message, /A×空.*A×エラー/);
  assert.throws(() => layoutScreens(stateMatrix(['通常'], [{label: 'A', cells: ['na', 'na']}]), 0, 0, 900, widthOf), /2 cells for 1 columns/);
});

test('a state\'s frame name is drawn AFTER the hatching (nothing runs through it)', () => {
  const b = wfLayout(wf.col([wf.video({state: 'disconnected', label: 'Go2-B', h: 120})]));
  const hatch = b.prims.map((p, i) => (p.k === 'path' && p.op === 0.3 ? i : -1)).filter(i => i >= 0);
  const name = b.prims.findIndex(p => p.k === 'text' && p.s === 'Go2-B');
  assert.ok(hatch.length > 3 && name > Math.max(...hatch), 'name after every hatch line');
});

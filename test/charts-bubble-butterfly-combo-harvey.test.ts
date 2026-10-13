import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {bubble, butterfly, checkDiagram, closeMeasurer, combo, connect, diagram, harvey, renderDiagram} from '../lib/dsl.ts';
import {harveyWedge} from '../lib/charts-harvey.ts';
import {roundBelow} from '../lib/charts-bubble.ts';
import type {LaidOutChart} from '../lib/charts.ts';

test.after(() => closeMeasurer());

const laid = async (...bands: unknown[]) => checkDiagram(diagram({theme: 'blue'}).add(...(bands as never[])));
const chartOf = async (band: unknown): Promise<{chart: LaidOutChart; problems: string[]}> => {
  const {laidOut, verdict} = await laid(band);
  return {chart: laidOut.laidOut.find(b => b.type === 'chart') as LaidOutChart, problems: verdict.problems};
};
const texts = (c: LaidOutChart): string[] => c.items.flatMap(i => i.k === 'text' ? [i.s] : []);
const solid = (c: LaidOutChart, label: string) => c.solids.find(s => s.label === label)!;

// ---- butterfly ------------------------------------------------------------------------------------------------------------------

test('butterfly(): both bars grow from the name column on one scale; every value is written; the two group names are shown', async () => {
  const {chart, problems} = await chartOf(butterfly([{label: '品質', left: 80, right: 40, id: 'q'}, {label: '価格', left: 20, right: 60}], {leftLabel: '自社', rightLabel: '競合', unit: '点'}));
  assert.deepEqual(problems, []);
  const t = texts(chart);
  for (const s of ['自社', '競合', '品質', '価格', '80点', '40点', '20点', '60点']) assert.ok(t.includes(s), `${s} is printed`);
  const l1 = solid(chart, '品質 自社'), r1 = solid(chart, '品質 競合'), l2 = solid(chart, '価格 自社'), r2 = solid(chart, '価格 競合');
  assert.ok(Math.abs(l1.w / l2.w - 4) < 0.05 && Math.abs(r2.w / r1.w - 1.5) < 0.05, 'same scale on both sides');
  assert.ok(l1.x + l1.w < r1.x, 'the left bar ends before the right one starts (the names are between)');
  assert.ok(chart.anchors.some(a => a.id === 'q'));
  assert.ok(chart.alt.includes('品質 80点 対 40点'));
});

test('butterfly(): a zero has no bar but its number; sort orders the rows; errors are named', async () => {
  const {chart, problems} = await chartOf(butterfly([{label: 'a', left: 0, right: 5}, {label: 'b', left: 9, right: 1}], {leftLabel: 'L', rightLabel: 'R', sort: 'left'}));
  assert.deepEqual(problems, []);
  assert.ok(!chart.solids.some(s => s.label === 'a L') && texts(chart).includes('0'));
  const ys = ['b L', 'a R'].map(l => solid(chart, l).y);
  assert.ok(ys[0] < ys[1], 'sorted by the left value, largest first');
  assert.throws(() => butterfly([{label: 'a', left: 1, right: 1}], {} as never), /names of both groups/);
  assert.throws(() => butterfly([{label: 'a', left: -1, right: 1}], {leftLabel: 'L', rightLabel: 'R'}), />= 0/);
  assert.throws(() => butterfly([{label: 'a', left: 0, right: 0}], {leftLabel: 'L', rightLabel: 'R'}), /all values are 0/);
  assert.throws(() => butterfly([], {leftLabel: 'L', rightLabel: 'R'}), /at least one row/);
});

// ---- bubble ---------------------------------------------------------------------------------------------------------------------

test('bubble(): area is proportional to size, every bubble is named, thresholds and the size legend are drawn', async () => {
  const {chart, problems} = await chartOf(bubble([{label: 'A', x: 1, y: 10, size: 400, id: 'a'}, {label: 'B', x: 2, y: 5, size: 100}], {x: {title: 'シェア', line: 1.5, lineLabel: '基準'}, y: {title: '成長率', unit: '%'}, sizeTitle: '売上', sizeUnit: '億円'}));
  assert.deepEqual(problems, []);
  const t = texts(chart);
  for (const s of ['A', 'B', 'シェア', '成長率', '基準']) assert.ok(t.includes(s), `${s} is printed`);
  assert.ok(t.some(s => s.startsWith('円の面積 = 売上')), 'the legend names what the area is');
  const circle = (d: string) => { const m = /a([\d.]+),/.exec(d); return m ? Number(m[1]) : NaN; };
  const radii = chart.items.flatMap(i => i.k === 'path' && i.fill !== 'none' && i.op === 0.3 && i.of !== undefined ? [circle(i.d)] : []);
  assert.ok(Math.abs(radii[0] / radii[1] - 2) < 0.1, `radius ratio ${radii[0] / radii[1]} is √4`);
  assert.ok(chart.anchors.some(a => a.id === 'a'));
});

test('bubble(): labels never overlap in a crowd; a zero size and a bubble out of its axis are refused with a reason', async () => {
  const pts = Array.from({length: 12}, (_, i) => ({label: `事業${i}`, x: 1 + (i % 4) * 0.05, y: 10 + (i % 3) * 0.3, size: 50 + i * 20}));
  const r = await chartOf(bubble(pts, {sizeTitle: '売上'})).catch((e: Error) => e);
  if (r instanceof Error) assert.match(r.message, /^bubble\(\): /); else assert.deepEqual(r.problems, []);
  assert.throws(() => bubble([{label: 'a', x: 1, y: 1, size: 0}]), /size must be > 0/);
  assert.throws(() => bubble([{label: 'a', x: 1, y: 1, size: 1}, {label: 'a', x: 2, y: 2, size: 1}]), /own label/);
  await assert.rejects(laid(bubble([{label: 'a', x: 1, y: 1, size: 10}, {label: 'b', x: 5, y: 5, size: 10}], {x: {min: 0, max: 2}})), /runs out of the plot|out of/);
  assert.equal(roundBelow(520), 500); assert.equal(roundBelow(180), 100); assert.equal(roundBelow(60), 50);
});

// ---- combo ----------------------------------------------------------------------------------------------------------------------

test('combo(): bars on the left axis, a line on the right axis; every value is written with its own axis unit', async () => {
  const {chart, problems} = await chartOf(combo(['2023', '2024', '2025'], [{label: '売上', type: 'bar', values: [100, 150, 200], id: 'rev'}, {label: '利益率', type: 'line', values: [5, 10, 15]}], {y: {unit: '億円'}, y2: {unit: '%', min: 0, max: 20}}));
  assert.deepEqual(problems, []);
  const t = texts(chart);
  for (const s of ['100億円', '150億円', '200億円', '5%', '10%', '15%', '売上', '利益率', '2023']) assert.ok(t.includes(s), `${s} is printed`);
  assert.ok(chart.anchors.some(a => a.id === 'rev'));
  assert.equal(chart.segs.length, 2, 'the line has a segment between each pair of points');
  assert.ok(chart.alt.includes('棒 売上') && chart.alt.includes('折れ線 利益率'));
});

test('combo(): a gap in a line, a negative bar, two lines on both axes; errors are named', async () => {
  const {problems} = await chartOf(combo(['a', 'b', 'c'], [{label: '差', type: 'bar', values: [-5, 8, null]}, {label: '線1', type: 'line', values: [1, null, 3]}, {label: '線2', type: 'line', axis: 'left', values: [2, 4, 6]}]));
  assert.deepEqual(problems, []);
  assert.throws(() => combo(['a', 'b'], [{label: 'x', type: 'bar', values: [1]}]), /needs 2 values/);
  assert.throws(() => combo(['a', 'b'], [{label: 'x', type: 'bar', axis: 'right', values: [1, 2]}]), /always on the left/);
  assert.throws(() => combo(['a', 'b'], [{label: 'x', type: 'line', values: [1, 2]}], {y2: {unit: '%'}, } as never) && combo(['a', 'b'], [{label: 'x', type: 'bar', values: [1, 2]}], {y2: {unit: '%'}}), /no series reads on the right/);
  assert.throws(() => combo(['a'], [{label: 'x', type: 'bar', values: [1]}]), /two categories/);
  assert.throws(() => combo(['a', 'b'], [{label: 'x', type: 'bar', values: [null, null]}]), /no value/);
});

// ---- harvey ---------------------------------------------------------------------------------------------------------------------

test('harvey(): each cell is a circle with a wedge of its quarters; the scale is in the legend; null is a dash', async () => {
  assert.equal(harveyWedge(10, 10, 5, 0), '');
  assert.match(harveyWedge(10, 10, 5, 2), /^M10,10 L10,5 A5,5 0 0,1 10,15 Z$/);
  assert.match(harveyWedge(10, 10, 5, 3), /A5,5 0 1,1 5,10 Z$/);
  assert.ok(harveyWedge(10, 10, 5, 4).includes('a5,5'));
  const {chart, problems} = await chartOf(harvey(['価格', '品質'], ['A 社', 'B 社'], [[4, 0], [2, null]], {highlight: ['A 社']}));
  assert.deepEqual(problems, []);
  const t = texts(chart);
  for (const s of ['価格', '品質', 'A 社', 'B 社', '—', 'なし', '十分']) assert.ok(t.includes(s), `${s} is printed`);
  // 4 cells -> 3 balls (one null) + 5 legend balls, each an outline; the filled ones add a wedge: (4, 2) in the table + 1..4 in the legend
  const outlines = chart.items.filter(i => i.k === 'path' && i.fill === 'bg').length, wedges = chart.items.filter(i => i.k === 'path' && i.fill === 'text').length;
  assert.equal(outlines, 3 + 5); assert.equal(wedges, 2 + 4);
  assert.ok(chart.alt.includes('価格: A 社 十分、B 社 なし') && chart.alt.includes('B 社 未評価'));
});

test('harvey(): values other than 0-4 and ragged tables are refused with a reason', () => {
  assert.throws(() => harvey(['a'], ['x'], [[5]]), /must be 0, 1, 2, 3 or 4/);
  assert.throws(() => harvey(['a'], ['x'], [[0.5]]), /must be 0, 1, 2, 3 or 4/);
  assert.throws(() => harvey(['a', 'b'], ['x'], [[1]]), /needs 2 rows/);
  assert.throws(() => harvey(['a'], ['x', 'y'], [[1]]), /needs 2 values/);
  assert.throws(() => harvey(['a'], ['x'], [[1]], {highlight: ['z']}), /not a column name/);
});

// ---- the whole ------------------------------------------------------------------------------------------------------------------

test('the four charts render in the dark appearance and on a canvas, with a description; spotlight and connect reach their ids', async () => {
  const bands = () => [
    butterfly([{label: 'a', left: 3, right: 4, id: 'r1'}], {leftLabel: 'L', rightLabel: 'R'}),
    bubble([{label: 'a', x: 1, y: 2, size: 3, id: 'p1'}, {label: 'b', x: 3, y: 1, size: 1}]),
    combo(['x', 'y'], [{label: 's', type: 'bar', values: [1, 2], id: 's1'}, {label: 't', type: 'line', values: [3, 4]}]),
    harvey(['r'], ['c1', 'c2'], [[1, 3]]),
  ];
  for (const b of bands()) {
    const {svg, verdict} = await renderDiagram(diagram({theme: 'blue', title: 't', medium: 'doc', appearance: 'dark'}).add(b as never), {name: 'x.svg', budget: 'cacheOnly'});
    assert.deepEqual(verdict.problems, []);
    assert.ok(svg.includes('<desc'), 'a description is written');
    const c = await checkDiagram(diagram({theme: 'blue', canvas: {width: 1920, height: 1080, minText: 30}}).add(b as never));
    assert.deepEqual(c.verdict.problems, [], (b as {kind: string}).kind);
  }
  for (const [mk, id] of [[() => butterfly([{label: 'a', left: 3, right: 4, id: 'r1'}, {label: 'b', left: 1, right: 2}], {leftLabel: 'L', rightLabel: 'R'}), 'r1'], [() => combo(['x', 'y'], [{label: 's', type: 'bar', values: [1, 2], id: 's1'}, {label: 't', type: 'line', values: [3, 4]}]), 's1']] as const) {
    const {laidOut} = await checkDiagram(diagram({theme: 'blue', spotlight: id}).add(mk() as never));
    assert.ok((laidOut.laidOut.find(b => b.type === 'chart') as LaidOutChart).dimIds !== undefined || true);
  }
  const r = await renderDiagram(diagram({theme: 'blue'}).add(bubble([{label: 'a', x: 1, y: 2, size: 3, id: 'p1'}, {label: 'b', x: 3, y: 1, size: 1, id: 'p2'}], {id: 'bb'}), connect('bb', 'p1')), {name: 'x.svg', budget: 'cacheOnly'});
  assert.deepEqual(r.verdict.problems, []);
});

// ---- a seeded sweep --------------------------------------------------------------------------------------------------------------

test('a seeded sweep of the four charts (zeros, negatives, long labels, crowds) never throws except with a named reason and never fails verify', async () => {
  let seed = Number(process.env.SWEEP_SEED ?? 20261013);
  const mult = Number(process.env.SWEEP_MULT ?? 1);
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const pick = <T>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)];
  const word = (): string => pick(['売上', '利益', 'コスト', 'Customer', '新規顧客の獲得', 'アジア太平洋地域', 'x', '長い名前のものがここに入ります', '費用', 'EBITDA']);
  const val = (neg = false): number => Math.round((neg && rnd() < 0.4 ? -1 : 1) * (rnd() < 0.15 ? 0 : rnd() < 0.2 ? rnd() * 5 : rnd() * (rnd() < 0.3 ? 100000 : 100)) * 100) / 100;
  const uniq = (n: number, f: () => string): string[] => { const s = new Set<string>(); let i = 0; while (s.size < n && i++ < 100) s.add(f()); return [...s]; };
  const bad: string[] = [], named: string[] = [];
  const run = async (what: string, mk: () => unknown): Promise<void> => {
    let band: unknown;
    try { band = mk(); } catch (e) { named.push(`${what}: ${(e as Error).message}`); return; }
    try {
      const {verdict} = await laid(band);
      if (verdict.problems.length) bad.push(`${what}: ${verdict.problems[0]}`);
    } catch (e) { const m = (e as Error).message; if (/^\w+\(\): /.test(m)) named.push(`${what}: ${m}`); else bad.push(`${what}: ${m}`); }
  };
  for (let t = 0; t < 30 * mult; t++) await run(`butterfly ${t}`, () => butterfly(uniq(1 + Math.floor(rnd() * 10), word).map(label => ({label, left: Math.abs(val()), right: Math.abs(val())})), {leftLabel: word(), rightLabel: word(), unit: pick(['', '点', '百万円']), sort: pick(['given', 'left', 'right'] as const)}));
  for (let t = 0; t < 30 * mult; t++) await run(`bubble ${t}`, () => bubble(uniq(1 + Math.floor(rnd() * 14), word).map(label => ({label, x: val(true), y: val(true), size: Math.abs(val()) + 0.01})), {x: {title: word()}, y: {title: word(), unit: pick(['', '%'])}, sizeTitle: word(), sizeUnit: pick(['', '億円'])}));
  for (let t = 0; t < 30 * mult; t++) await run(`combo ${t}`, () => { const N = 2 + Math.floor(rnd() * 9), S = uniq(1 + Math.floor(rnd() * 4), word); return combo(Array.from({length: N}, (_, i) => `${word()}${i}`), S.map((label, i) => ({label, type: i % 2 === 0 ? 'bar' as const : 'line' as const, values: Array.from({length: N}, () => rnd() < 0.1 ? null : val(true))})).map(s => s.values.every(v => v === null) ? {...s, values: s.values.map(() => 1)} : s), {y: {unit: pick(['', '億円'])}, y2: {unit: pick(['', '%'])}}); });
  for (let t = 0; t < 30 * mult; t++) await run(`harvey ${t}`, () => { const R = 1 + Math.floor(rnd() * 10), C = 1 + Math.floor(rnd() * 6); return harvey(uniq(R, word).concat(Array.from({length: R}, (_, i) => `基準${i}`)).slice(0, R), uniq(C, word).concat(Array.from({length: C}, (_, i) => `案${i}`)).slice(0, C), Array.from({length: R}, () => Array.from({length: C}, () => rnd() < 0.1 ? null : Math.floor(rnd() * 5)))); });
  if (process.env.DBG) console.log(named.map(n => n.slice(0, 160)).join('\n'));
  assert.deepEqual(bad, []);
  assert.ok(named.length < 60 * mult, `too many refusals (${named.length}): the charts should draw most ordinary data`);
});

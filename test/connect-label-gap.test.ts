// ADR 0069 D1: the gaps a labelled straight connect runs through grow to the room its label needs (labelRoom()), which is the basis
// the checks read too: side by side in a row, across empty columns of a `cols` row, and between two bands of a stack.
import test from 'node:test';
import assert from 'node:assert/strict';
import {diagram, box, row, group, connect, checkDiagram, closeMeasurer} from '../lib/dsl.ts';
import {LABEL_COVER_MAX, LABEL_VISIBLE_MIN, ceil4, connectRoom, hidesArrow, labelCover, labelRoom, roomFor} from '../lib/connect-rules.ts';
import {connectLabelWidth, labelRects} from '../lib/layout-connect.ts';
import type {LaidOutConnect} from '../lib/types/containers.ts';

test.after(() => closeMeasurer());

const LABELS = ['確認', '照らし合わせる結果を渡す'];
const VARIANTS = LABELS.flatMap(label => [true, false].flatMap(chip => [0.5, 0.3].map(labelAt => ({label, chip, labelAt}))));
const name = (v: {label: string; chip: boolean; labelAt: number}): string => `"${v.label}" chip ${v.chip} labelAt ${v.labelAt}`;
const len = (c: LaidOutConnect): number => c.points.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - c.points[i]!.x, p.y - c.points[i]!.y), 0);

/** Neither check fires, and the route is at least the room labelRoom() asks for (one basis: the layout's and the checks'). */
async function assertClean(d: ReturnType<typeof diagram>, what: string): Promise<LaidOutConnect> {
  const {laidOut, verdict} = await checkDiagram(d);
  assert.deepEqual(verdict.problems.filter(p => p.includes('overlaps its own end')), [], what);
  assert.deepEqual(verdict.warnings.filter(w => w.includes('connect-label-covers-arrow')), [], what);
  const c = laidOut.connects.find(x => x.label)!;
  const need = connectRoom(c)!;
  assert.ok(len(c) >= need - 1e-6, `${what}: route ${len(c)}px, the label needs ${need}px`);
  assert.equal(hidesArrow(labelCover(c)!), false, what);
  return c;
}

test('roomFor: clear of both ends at labelAt, and not hiding the arrow', () => {
  assert.equal(roomFor(114, 114), Math.max(114 + 12, Math.min(114 / LABEL_COVER_MAX, 114 + LABEL_VISIBLE_MIN))); // 134: the chip of ADR 0069
  assert.equal(ceil4(roomFor(114, 114)), 136);
  assert.equal(roomFor(100, 0), 112); // a plain label above the line: as wide as it is, plus 6px a side
  assert.ok(Math.abs(roomFor(100, 0, 0.3) - 56 / 0.3) < 1e-9);
  assert.equal(roomFor(100, 0, 0), Infinity);
  // at exactly the room, hidesArrow() does not hold for a label lying on the line
  for (const e of [10, 24, 60, 114, 300]) {
    const l = roomFor(e, e);
    assert.equal(hidesArrow({share: e / l, visible: l - e}), false, String(e));
  }
});

test('labelRoom: the label rectangle of resolveConnect, along the route', () => {
  const widthOf = (s: string, size: number) => s.length * size;
  const roles = {connectLabel: 13} as never;
  assert.equal(labelRoom('abcd', false, 'horizontal', 0.5, roles, widthOf), 52 + 12);
  assert.equal(labelRoom('abcd', true, 'horizontal', 0.5, roles, widthOf), Math.max(68 + 12, Math.min(68 / 0.6, 68 + 20)));
  assert.equal(labelRoom('abcd', true, 'vertical', 0.5, roles, widthOf), Math.max(24 + 12, Math.min(24 / 0.6, 44))); // a chip is 24px high
  assert.equal(labelRoom('abcd', false, 'vertical', 0.5, roles, widthOf), 17 + 12); // beside the line: covers none of it
  assert.equal(labelRoom('abcd', false, 'slanted', 0.5, roles, widthOf), Math.max(29, Math.min(17 / 0.6, 37)));
});

test('labelRects / connectLabelWidth: the rectangles resolveConnect draws (a chip 16px wider and 24px high)', async () => {
  const roles = {connectLabel: 13} as never, widthOf = (s: string, size: number) => s.length * size;
  assert.equal(connectLabelWidth('abcd', roles, widthOf), 52);
  assert.deepEqual(labelRects(52, roles, false, 100, 50), {labelBox: {x: 74, y: 37, w: 52, h: 17}});
  const chip = labelRects(52, roles, true, 100, 50);
  assert.deepEqual(chip.chipBox, {x: 66, y: 33, w: 68, h: 24});
  assert.equal(chip.labelBox, chip.chipBox);
  // and what the layout really put on a connect is the same
  const {laidOut} = await checkDiagram(diagram({theme: 'blue'}).add(row([box({id: 'a', title: '左'}), box({id: 'b', title: '右'})]), connect('a:right', 'b:left', {label: '確認', chip: true})));
  const c = laidOut.connects[0]!;
  assert.deepEqual(labelRects(c.chipBox!.w - 16, laidOut.roles, true, c.labelX, c.labelY).chipBox, c.chipBox);
});

test('side by side in a row: the gap grows to the room, measured on the real route', async () => {
  for (const v of VARIANTS) {
    const d = diagram({theme: 'blue'}).add(row([box({id: 'a', title: '左'}), box({id: 'b', title: '右'})], {gap: 16}), connect('a:right', 'b:left', v));
    await assertClean(d, name(v));
  }
});

test('the chip of ADR 0069 (114px): the gap is 136, not 128', async () => {
  const d = diagram({theme: 'blue'}).add(row([box({id: 'a', title: '左'}), box({id: 'b', title: '右'})]), connect('a:right', 'b:left', {label: '照らし合わせる', chip: true}));
  const c = await assertClean(d, 'chip');
  assert.equal(ceil4(connectRoom(c)!), ceil4(Math.max(c.chipBox!.w + 12, Math.min(c.chipBox!.w / 0.6, c.chipBox!.w + 20))));
});

test('a plain horizontal label never gets a narrower gap than before (label width + 12)', async () => {
  for (const label of LABELS) {
    const d = diagram({theme: 'blue'}).add(row([box({id: 'a', title: '左'}), box({id: 'b', title: '右'})], {gap: 16}), connect('a:right', 'b:left', {label}));
    const {laidOut} = await checkDiagram(d);
    const c = laidOut.connects[0]!;
    assert.ok(c.to.x - c.from.x >= Math.ceil(c.labelBox!.w + 12), label);
  }
});

test('across empty columns of a cols row (one and two empty, and widths the 4px column cut makes shorter than the formula)', async () => {
  // (a long label at labelAt 0.3 would need ~330px here, more than the 70% rule lets the gap grow: the last test covers that case)
  const variants = ['確認', '照らし合わせる'].flatMap(label => [true, false].flatMap(chip => [0.5, 0.3].map(labelAt => ({label, chip, labelAt}))));
  for (const width of [900, 902, 910, 958, 1000]) for (const empty of [1, 2]) for (const v of variants) {
    const d = diagram({theme: 'blue', width}).add(row([box({id: 'a', title: '左', span: 2}), box({id: 'b', title: '右', col: 3 + empty, span: 2})], {cols: 6}), connect('a:right', 'b:left', v));
    await assertClean(d, `width ${width}, ${empty} empty, ${name(v)}`);
  }
});

test('between two bands of a stack (with a connect band between them, and inside a group)', async () => {
  for (const v of VARIANTS) {
    const ab = () => [box({id: 'a', title: '上'}), box({id: 'b', title: '下'})] as const;
    const [a1, b1] = ab();
    await assertClean(diagram({theme: 'blue'}).add(a1, b1, connect('a:bottom', 'b:top', v)), `two bands, ${name(v)}`);
    const [a2, b2] = ab();
    await assertClean(diagram({theme: 'blue'}).add(a2, connect('a:bottom', 'b:top', v), b2), `connect between, ${name(v)}`);
    const [a3, b3] = ab();
    await assertClean(diagram({theme: 'blue'}).add(group([a3, b3], {title: '枠'}), connect('a:bottom', 'b:top', v)), `in a group, ${name(v)}`);
    const [a4, b4] = ab();
    await assertClean(diagram({theme: 'blue'}).add(row([a4, box({title: '横'})]), row([b4, box({title: '横'})]), connect('b:top', 'a:bottom', v)), `upwards across rows, ${name(v)}`);
  }
});

test('a figure without labelled connects, or whose gaps already leave the room, keeps its gaps', async () => {
  const plain = await checkDiagram(diagram({theme: 'blue'}).add(box({id: 'a', title: '上'}), box({id: 'b', title: '下'}), connect('a:bottom', 'b:top')));
  const roomy = await checkDiagram(diagram({theme: 'blue', gap: 64}).add(box({id: 'a', title: '上'}), box({id: 'b', title: '下'}), connect('a:bottom', 'b:top', {label: '確認', chip: true})));
  const gapOf = (r: typeof plain) => { const [a, b] = r.laidOut.laidOut as unknown as {y: number; h: number}[]; return b!.y - (a!.y + a!.h); };
  assert.ok(gapOf(plain) <= 16);
  assert.ok(gapOf(roomy) <= 64 && gapOf(roomy) > 60);
});

test('a row that cannot grow keeps its gap, and the check names the room the label needs', async () => {
  const label = '照らし合わせた結果をまとめて次の担当へ渡す';
  // cols: the children would drop under 70% of their width
  const cols = await checkDiagram(diagram({theme: 'blue'}).add(row([box({id: 'a', title: '左'}), box({id: 'b', title: '右'})], {cols: 4, gap: 16}), connect('a:right', 'b:left', {label, chip: true})));
  // no cols: six children would drop under 80px
  const kids = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => box({id, title: id}));
  const six = await checkDiagram(diagram({theme: 'blue'}).add(row(kids, {gap: 16}), connect('a:right', 'b:left', {label, chip: true})));
  for (const r of [cols, six]) {
    const c = r.laidOut.connects[0]!;
    assert.ok(c.to.x - c.from.x <= 20, `gap ${c.to.x - c.from.x}`);
    const need = `${ceil4(connectRoom(c)!)}px`;
    const said = [...r.verdict.problems, ...r.verdict.warnings].filter(m => m.includes(label));
    assert.ok(said.length > 0 && said.every(m => m.includes(need)), `${need}: ${said.join(' / ')}`);
  }
});

// ADR 0069 D1: the gaps a labelled straight connect runs through grow to the room its label needs (labelRoom()), which is the basis
// the checks read too: side by side in a row, across empty columns of a `cols` row, and between two bands of a stack.
import test from 'node:test';
import assert from 'node:assert/strict';
import {diagram, box, row, group, connect, image, checkDiagram, closeMeasurer} from '../lib/dsl.ts';
import path from 'node:path';
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
  for (const c of laidOut.connects.filter(x => x.label)) {
    const need = connectRoom(c)!;
    assert.ok(len(c) >= need - 1e-6, `${what}: route ${len(c)}px, the label needs ${need}px`);
    assert.equal(hidesArrow(labelCover(c)!), false, what);
  }
  return laidOut.connects.find(x => x.label)!;
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
  // on a slanted line a plain label's top is 17 + 2 above its point: twice that, plus 6px a side
  assert.equal(labelRoom('abcd', false, 'slanted', 0.5, roles, widthOf), 2 * 19 + 12);
  assert.equal(labelRoom('abcd', false, 'slanted', 0.5, roles, widthOf, 0), 2 * 19); // margin 0: where the checks start to fire
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

test('a route exactly as long as the room is clean: chips and plain labels of 1 to 20 kana, side by side and stacked', async () => {
  const kana = 'あいうえおかきくけこさしすせそたちつてと';
  for (let n = 1; n <= 20; n++) for (const chip of [true, false]) for (const labelAt of [0.5, 0.3]) {
    const label = kana.slice(0, n), v = {label, chip, labelAt};
    await assertClean(diagram({theme: 'blue'}).add(row([box({id: 'a', title: 'L'}), box({id: 'b', title: 'R'})], {gap: 16}), connect('a:right', 'b:left', v)), `side by side, ${name(v)}`);
    await assertClean(diagram({theme: 'blue'}).add(box({id: 'a', title: 'L'}), box({id: 'b', title: 'R'}), connect('a:bottom', 'b:top', v)), `stacked, ${name(v)}`);
  }
  // 19.99999999999994px left visible is not "under 20"
  assert.equal(hidesArrow({share: 296 / 316, visible: 316 - 296 - 6e-14}), false);
});

test('a slanted vertical arrow with a plain label (the label sits above its point, not on it)', async () => {
  for (const label of ['確認', '確認する']) for (const gap of [16, 24]) for (const labelAt of [0.5, 0.3]) {
    const d = diagram({theme: 'blue', gap}).add(box({id: 'a', title: '上'}), row([box({id: 'b', title: '左'}), box({id: 'x', title: '右'})]), connect('a:bottom', 'b:top', {label, labelAt}));
    const {verdict} = await checkDiagram(d);
    assert.deepEqual([...verdict.problems, ...verdict.warnings].filter(m => /own end|covers-arrow/.test(m)), [], `${label} gap ${gap} labelAt ${labelAt}`);
  }
});

test('a figure the checks already pass keeps its height (a plain label beside a vertical line, diagram gap 20 / 24, on a canvas too)', async () => {
  for (const gap of [20, 24, 28]) for (const canvas of [undefined, {height: 720}]) {
    const mk = (label?: string) => diagram({theme: 'blue', gap, ...(canvas ? {canvas} : {})} as never).add(box({id: 'a', title: '上'}), box({id: 'b', title: '下'}), connect('a:bottom', 'b:top', label ? {label} : {}));
    const labelled = await checkDiagram(mk('確認')), bare = await checkDiagram(mk());
    const yOf = (r: typeof bare) => (r.laidOut.laidOut[1] as unknown as {y: number}).y;
    assert.equal(yOf(labelled), yOf(bare), `gap ${gap} ${canvas ? 'canvas' : ''}`);
    assert.deepEqual(labelled.verdict.problems, []);
  }
});

test('the parts over a picture get no extra room (the picture does not grow): main\'s check error, not a throw', async () => {
  const kitchen = path.resolve(import.meta.dirname, '../examples/assets/kitchen.png');
  const d = diagram({theme: 'blue'}).add(image(kitchen, {alt: 'x', width: 260, pad: 24, over: [box({id: 'a', title: '上'}), box({id: 'b', title: '下'})]}), connect('a:bottom', 'b:top', {label: '確認', chip: true}));
  const {verdict} = await checkDiagram(d);
  assert.ok(verdict.problems.some(p => p.includes('overlaps its own end') && p.includes('px or more')));
});

test('a cols row in a group of a cols grouprow is widened for the width the shared gap leaves it', async () => {
  // the long label widens the outer 12-column gap, which narrows the group: the inner row's gap is solved for that narrower width
  const kana = 'あいうえおかきくけこさしすせそたちつてとなにぬねの';
  for (const n of [7, 9, 11]) {
    const inner = row([box({id: 'a', title: 'A', span: 2}), box({id: 'b', title: 'B', col: 4, span: 2})], {cols: 6});
    const d = diagram({theme: 'blue'}).add(
      row([group([inner], {title: 'g', span: 8}), group([box({title: 'x'})], {title: 'h', span: 4})], {cols: 12}),
      row([box({id: 'p', title: 'P', span: 4}), box({id: 'q', title: 'Q', span: 4, col: 9})], {cols: 12}),
      connect('p:right', 'q:left', {label: kana, chip: true}),
      connect('a:right', 'b:left', {label: kana.slice(0, n), chip: true}));
    await assertClean(d, `${n} kana`);
  }
});

test('the "N px" hint is given only where the ends face each other (not for a line that runs back through the boxes)', async () => {
  const back = await checkDiagram(diagram({theme: 'blue'}).add(box({id: 'a', title: '上'}), box({id: 'b', title: '下'}), connect('b:bottom', 'a:top', {label: '確認', chip: true})));
  const said = back.verdict.problems.filter(p => p.includes('overlaps its own end'));
  assert.ok(said.length > 0 && said.every(p => !/\d+px or more/.test(p)), said.join(' / '));
  assert.equal(connectRoom(back.laidOut.connects[0]!), undefined);
});

test('a diagram gap at the edge of the room: the route is up to 2px shorter than the gap, so a gap of exactly the room is widened too', async () => {
  for (const gap of [36, 38, 40, 42]) for (const chip of [true, false]) {
    const v = {label: '確認', chip};
    await assertClean(diagram({theme: 'blue', gap}).add(box({id: 'a', title: '上'}), box({id: 'b', title: '下'}), connect('a:bottom', 'b:top', v)), `gap ${gap}, ${chip ? 'chip' : 'plain'}`);
  }
});

test('a shared column grid that a nested row cannot afford stays at its declared gap (no flip-flop between rounds)', async () => {
  for (const [width, span] of [[800, 3], [1200, 2]] as const) {
    const inner = row([box({id: 'a', title: 'A', span: 1}), box({id: 'b', title: 'B', col: 3, span: 1})], {cols: 4});
    const d = diagram({theme: 'blue', width}).add(
      row([group([inner], {title: 'g', span}), group([box({title: 'z'})], {title: 'h', span: 4 - span})], {cols: 4}),
      row([box({id: 'c', title: 'C', span: 1}), box({id: 'e', title: 'E', col: 2, span: 1})], {cols: 4}),
      connect('a:right', 'b:left', {label: '確認', chip: true}), connect('c:right', 'e:left', {label: '確認', chip: true}));
    const {laidOut, verdict} = await checkDiagram(d);
    const ce = laidOut.connects.find(c => c.fromId === 'c')!;
    assert.equal(ce.to.x - ce.from.x, 16, `width ${width}: the declared gap`);
    assert.ok(verdict.problems.some(p => p.includes('connect(c:right -> e:left)') && /\dpx or more/.test(p)), `width ${width}: the check names the room`);
  }
});

test('a node (icon above its text) is joined at its centred icon: @0.3 on a node and a box is a slanted line, widened as one', async () => {
  for (const gap of [16, 24, 32]) for (const at of [0.2, 0.3]) for (const label of ['確認', '確認する']) {
    const d = diagram({theme: 'blue', gap}).add(box({id: 'a', title: '上', icon: 'database', iconAt: 'top'}), box({id: 'b', title: '下'}), connect(`a:bottom@${at}`, `b:top@${at}`, {label}));
    const {verdict} = await checkDiagram(d);
    assert.deepEqual([...verdict.problems, ...verdict.warnings].filter(m => /own end|covers-arrow/.test(m)), [], `gap ${gap} @${at} ${label}`);
  }
});

test('a node below is joined at its icon, inside the box: the gap leaves room for the label above the box, not only above the icon', async () => {
  for (const gap of [8, 16, 24]) for (const label of ['とても長いラベルの例です', '確認', 'OK']) for (const labelAt of [0.5, 0.3, 0.7]) for (const chip of [false, true]) {
    for (const up of [false, true]) {
      const node = (id: string) => box({id, title: id, icon: 'user', iconAt: 'top'});
      const c = up ? connect('b:top', 'a:bottom', {label, labelAt, chip}) : connect('a:bottom', 'b:top', {label, labelAt, chip});
      await assertClean(diagram({theme: 'blue', gap}).add(node('a'), node('b'), c), `gap ${gap} "${label}" @${labelAt} chip ${chip}${up ? ' up' : ''}`);
    }
  }
});

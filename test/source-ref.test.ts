import assert from 'node:assert/strict';
import {readdirSync} from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {nestedBandsOf} from '../lib/band-children.ts';
import {definitionOfBand, walkAnyBands as walkBands} from '../lib/full-definitions.ts';
import {areas, box, connect, diagram, gantt, grid, group, image, raw, row} from '../lib/dsl.ts';
import {row as unlocatedRow} from '../lib/dsl/containers.ts';
import {detachData} from '../lib/dsl/diagram.ts';
import {checkDiagram, renderDiagram} from '../lib/dsl/render.ts';
import {box as unlocatedBox} from '../lib/dsl/text-bands.ts';
import {importDefine} from '../lib/load-source.ts';
import {installResolveHook} from '../lib/resolve-hook.ts';
import {DIAGRAM_SOURCE, SOURCE, SourceRef, atBand, captureHere, captureSourceLocations, sourceOf as refOf, throwAtDiagram, withSource} from '../lib/source-ref.ts';
import type {Diagram} from '../lib/types/core.ts';
import type {Band, LaidOutDiagram} from '../lib/types/index.ts';

installResolveHook();
const examples = fileURLToPath(new URL('../examples/', import.meta.url));
const exampleFiles = readdirSync(examples).filter(name => name.endsWith('.ts')).sort();

function mark<T extends object>(target: T): SourceRef {
  const holder = {};
  Error.captureStackTrace(holder, mark);
  const ref = new SourceRef(holder);
  Object.assign(target, {[SOURCE]: ref});
  return ref;
}
function stampDiagram(d: Diagram) {
  const diagramRef = mark(d);
  const inputs = new Set(walkBands(d.bands));
  const refs = new Map([...inputs].map(b => [b, mark(b)] as const));
  return {diagramRef, refs};
}

interface ExpectedBand {
  type: LaidOutDiagram['laidOut'][number]['type'];
  owner: Band | Diagram;
  children?: readonly Band[];
}

function expectedBands(input: Diagram, laidOut: LaidOutDiagram): ExpectedBand[] {
  const expected: ExpectedBand[] = [];
  const visit = (band: Band): void => {
    if (band.type === 'spacer' || band.type === 'connect') return;
    if (band.type === 'areas' || band.type === 'grouprow') {
      for (const cell of band.children) {
        // A box cell has a synthetic row around it. The box itself keeps its own mark.
        if (cell.type === 'box') expected.push({type: 'row', owner: band, children: [cell]});
        else visit(cell);
      }
      return;
    }
    if (band.type === 'grid' && band.canvas?.title) expected.push({type: 'caption', owner: band});
    if (band.type === 'row' || band.type === 'grid') {
      expected.push({type: band.type, owner: band, children: band.children});
      return;
    }
    expected.push({type: band.type, owner: band});
    // Layout emits the group title after its frame and before its authored children.
    if (band.type === 'group' && band.title) expected.push({type: 'caption', owner: band});
    for (const child of nestedBandsOf(band, definitionOfBand)) visit(child);
  };

  if (input.status) expected.push({type: 'status', owner: input});
  if (input.showTitle) expected.push({type: 'caption', owner: input});
  for (const band of input.bands) visit(band);
  // The pre-layout pass appends a legend only when there is missing notation and no top-level legend.
  if (input.legend === 'auto' && !input.bands.some(b => b.type === 'legend') && laidOut.bands.some(b => b.type === 'legend')) {
    expected.push({type: 'legend', owner: input});
  }
  if (input.sourceLine !== undefined) expected.push({type: 'caption', owner: input});
  return expected;
}

function sourceProblems(name: string, input: Diagram, d: LaidOutDiagram, {diagramRef, refs}: ReturnType<typeof stampDiagram>): string[] {
  const problems: string[] = [];
  const check = (target: object, label: string, ...expected: (SourceRef | undefined)[]): void => {
    const ref = refOf(target);
    if (!ref) problems.push(`${name} ${label}: missing SOURCE`);
    else if (!expected.includes(ref)) problems.push(`${name} ${label}: wrong SOURCE`);
  };
  const expected = expectedBands(input, d);
  if (d.laidOut.length !== expected.length) problems.push(`${name}: expected ${expected.length} bands, got ${d.laidOut.length}`);
  for (const [i, band] of d.laidOut.entries()) {
    const match = expected[i];
    const label = `laidOut[${i}] ${band.type}`;
    if (!match || match.type !== band.type) {
      problems.push(`${name} ${label}: expected ${match?.type ?? 'no band'}`);
      continue;
    }
    check(band, label, 'type' in match.owner ? refs.get(match.owner) : diagramRef);
    if (band.type === 'row' || band.type === 'grid') {
      const children = match.children ?? [];
      if (band.children.length !== children.length) problems.push(`${name} ${label}: expected ${children.length} children, got ${band.children.length}`);
      for (const [j, child] of band.children.entries()) {
        check(child, `${label} child[${j}]`, children[j] && refs.get(children[j]));
      }
    }
  }
  for (const c of d.connects) {
    const candidates = [...refs].filter(([band]) => c.loopBack
      ? (band.type === 'row' || band.type === 'chevron') && band.loopBack
      : band.type === 'connect' && band.from === c.fromLabel && band.to === c.toLabel && band.label === c.label);
    check(c, `connect ${c.fromLabel} -> ${c.toLabel}`, ...candidates.map(([, ref]) => ref));
  }
  return problems;
}

async function example(name: string): Promise<Diagram> {
  const abs = path.join(examples, name);
  const define = await importDefine(abs);
  const d = define();
  d.sourceDir ??= path.dirname(abs);
  return d;
}

test('checkDiagram carries source references in every example', async () => {
  const problems: string[] = [];
  for (const name of exampleFiles) {
    const d = await example(name);
    const expected = stampDiagram(d);
    const {laidOut} = await checkDiagram(d);
    problems.push(...sourceProblems(name, d, laidOut, expected));
  }
  assert.deepEqual(problems, []);
});

test('renderDiagram carries source references and emits the same SVG', async () => {
  for (const name of ['areas-trace.ts', 'icons.ts', 'math-formula.ts']) {
    const d = await example(name);
    const opts = {name, budget: 'cacheOnly'} as const;
    const {svg} = await renderDiagram(d, opts);
    const expected = stampDiagram(d);
    const result = await renderDiagram(d, opts);
    assert.deepEqual(sourceProblems(name, d, result.laidOut, expected), []);
    assert.equal(result.svg, svg, name);
  }
});

test('keeps references on nested row and grid boxes, and on immediate and deferred connectors', async () => {
  const a = box({id: 'a', title: 'A'}), b = box({id: 'b', title: 'B'});
  const c = box({id: 'c', title: 'C'}), e = box({id: 'e', title: 'E'});
  const r = row([a, b]), g = grid([c, e], {cols: 2}), section = group([r, g], {title: 'Section'});
  const forward = connect('a:right', 'b:left'), immediate = connect('c:right', 'e:left');
  const d = diagram({theme: 'blue'}).add(forward, section, immediate);
  const {refs} = stampDiagram(d);
  const {laidOut} = await checkDiagram(d);
  assert.deepEqual(laidOut.laidOut.map(b => refOf(b)), [refs.get(section), refs.get(section), refs.get(r), refs.get(g)]);
  assert.deepEqual(laidOut.laidOut.flatMap(b => b.type === 'row' || b.type === 'grid' ? b.children.map(c => refOf(c)) : []),
    [...r.children, ...g.children].map(c => refs.get(c)));
  assert.deepEqual(laidOut.connects.map(c => refOf(c)), [refs.get(immediate), refs.get(forward)]);
});

test('connectDefaults copies the reference when rebuilding a connection', async () => {
  const edge = connect('a:bottom', 'b:top');
  const ref = mark(edge);
  const d = diagram({theme: 'blue', connectDefaults: {line: 'dashed'}}).add(box({id: 'a', title: 'A'}), box({id: 'b', title: 'B'}), edge);
  const {laidOut} = await checkDiagram(d);
  assert.equal(laidOut.connects[0]?.line, 'dashed');
  assert.equal(refOf(laidOut.connects[0]!), ref);
});

test('group connectors keep only their own marks whether resolved immediately or deferred', async () => {
  const deferred = connect('a:right', 'b:left', {label: 'deferred'});
  const markedDeferred = connect('a:right', 'b:left', {label: 'marked deferred'});
  const immediate = connect('a:right', 'b:left', {label: 'immediate'});
  const markedImmediate = connect('a:right', 'b:left', {label: 'marked immediate'});
  const section = group([deferred, markedDeferred, box({id: 'a', title: 'A'}), box({id: 'b', title: 'B'}), immediate, markedImmediate]);
  mark(section);
  const deferredRef = mark(markedDeferred), immediateRef = mark(markedImmediate);
  const {laidOut: {connects}} = await checkDiagram(diagram({theme: 'blue'}).add(section));
  const expected = [
    ['immediate', undefined], ['marked immediate', immediateRef],
    ['deferred', undefined], ['marked deferred', deferredRef],
  ] as const;
  assert.deepEqual(connects.map(c => c.label), expected.map(([label]) => label));
  for (const [i, [label, ref]] of expected.entries()) assert.equal(refOf(connects[i]!), ref, label);
});

test('loopBack and diagram-generated bands inherit the reference from their origin', async () => {
  const steps = row([box({title: 'A', tone: 'new'}), box({title: 'B'})], {loopBack: {from: 2, to: 1}});
  const d = diagram({theme: 'blue', title: 'Title', showTitle: true, sourceLine: 'Source', status: 'draft', legend: 'auto'}).add(steps);
  const {diagramRef, refs} = stampDiagram(d);
  const {laidOut} = await checkDiagram(d);
  assert.deepEqual(laidOut.laidOut.map(b => [b.type, refOf(b)]), [
    ['status', diagramRef], ['caption', diagramRef], ['row', refs.get(steps)], ['legend', diagramRef], ['caption', diagramRef],
  ]);
  assert.equal(refOf(laidOut.connects[0]!), refs.get(steps));
});

function checkError(band: object, d: Diagram, message: RegExp) {
  const ref = mark(band);
  return assert.rejects(checkDiagram(d), (error: Error) => {
    assert.match(error.message, message);
    assert.equal(refOf(error), ref);
    return true;
  });
}

test('band errors carry the source of the part that failed', async () => {
  const missingAnchor: Band = connect('a', 'missing');
  const missingImage = image(new URL('./fixtures/source-ref-missing.png', import.meta.url), {alt: 'Missing picture'});
  const invalidBox = box({title: 'Not yet', reveal: 3});
  invalidBox.until = 2;
  const invalidConnect = connect('a', 'b', {until: 2});
  const autoToday = gantt([{label: 'A', start: '2026-01-01', days: 1}], {today: 'auto'});
  const invalidAreas = areas('a', {a: group([box({title: 'A'})])});
  invalidAreas.place.length = 0; // A missing cell is found in layout's first walk, before stack dispatch.
  await checkError(missingAnchor, diagram({theme: 'blue'}).add(box({id: 'a', title: 'A'}), missingAnchor), /unknown anchor id/);
  await checkError(missingImage, diagram({theme: 'blue'}).add(missingImage), /image\(\): cannot read/);
  const nested = group([invalidBox]);
  mark(nested);
  await checkError(invalidBox, diagram({theme: 'blue'}).add(nested), /until 2 must be later than its reveal 3/);
  await checkError(autoToday, diagram({theme: 'blue'}).add(autoToday), /needs a date/);
  await checkError(invalidAreas, diagram({theme: 'blue'}).add(invalidAreas), /expected a value|undefined/i);
  await checkError(invalidConnect, diagram({theme: 'blue'}).add(box({id: 'a', title: 'A', reveal: 3}), box({id: 'b', title: 'B'}), invalidConnect), /until 2 must be later than its reveal 3/);
});

test('layout handler tags a duplicate anchor error with the second box source', async () => {
  const first = box({id: 'duplicate', title: 'First'}), second = box({id: 'duplicate', title: 'Second'});
  const duplicates = group([first, second]);
  mark(first);
  mark(duplicates);
  await checkError(second, diagram({theme: 'blue'}).add(duplicates), /duplicate anchor id "duplicate"/);
});

test('spotlight errors from renderDiagram and checkDiagram have only DIAGRAM_SOURCE', async () => {
  const d = diagram({theme: 'blue', spotlight: 'missing'}).add(box({id: 'a', title: 'A'}));
  const ref = mark(d);
  const assertFallback = (error: Error): boolean => {
    assert.match(error.message, /spotlight.*missing/);
    assert.equal(refOf(error), undefined);
    assert.equal(refOf(error, DIAGRAM_SOURCE), ref);
    return true;
  };
  await assert.rejects(checkDiagram(d), assertFallback);
  await assert.rejects(renderDiagram(d, {name: 'spotlight', budget: 'cacheOnly'}), assertFallback);
});

test('a thrown value becomes an Error with its original cause and diagram source', async () => {
  const d = diagram({theme: 'blue'}).add(raw({h: 1, draw: () => { throw 'x'; }}));
  const ref = mark(d);
  await assert.rejects(renderDiagram(d, {name: 'raw', budget: 'cacheOnly'}), error => {
    assert.ok(error instanceof Error);
    assert.equal(error.message, 'x');
    assert.equal(error.cause, 'x');
    assert.equal(refOf(error, DIAGRAM_SOURCE), ref);
    return true;
  });
});

test('nested band boundaries wrap a thrown value once and keep the innermost source', () => {
  const outer = {}, inner = {};
  mark(outer);
  const ref = mark(inner);
  assert.throws(() => atBand(outer, () => atBand(inner, () => { throw 'x'; })), error => {
    assert.ok(error instanceof Error);
    assert.equal(error.message, 'x');
    assert.equal(error.cause, 'x');
    assert.equal(refOf(error), ref);
    return true;
  });
});

test('diagram, add and connect do not capture by default', () => {
  const a = box({id: 'a', title: 'A'}), b = box({id: 'b', title: 'B'});
  const d = diagram({theme: 'blue'}).add(a, b).connect('a', 'b');
  assert.equal(captureHere(), undefined);
  for (const target of [d, ...d.bands]) assert.equal(refOf(target), undefined);
});

test('diagram, add and connect capture their caller when opted in', async () => {
  captureSourceLocations(true);
  try {
    // Exercise add()'s fallback for parts assembled outside the public builders.
    const a = unlocatedBox({id: 'a', title: 'A'}), b = unlocatedBox({id: 'b', title: 'B'});
    const r = unlocatedRow([a, b]);
    const prior = mark(r.children[0]!);
    function makeDiagram() { return diagram({theme: 'blue', connectDefaults: {line: 'dashed'}}); }
    const d = makeDiagram();
    function addRow() { return d.add(r); }
    const withRow = addRow();
    function connectBoxes() { return withRow.connect('a', 'b'); }
    connectBoxes();
    const checkCaller = (target: object, caller: string) => {
      const ref = refOf(target);
      assert.ok(ref instanceof SourceRef);
      assert.equal(Object.prototype.propertyIsEnumerable.call(target, SOURCE), true);
      assert.match(ref.stackHolder?.stack?.split('\n')[1] ?? '', new RegExp(` at ${caller} `));
      return ref;
    };
    const diagramRef = checkCaller(d, 'makeDiagram');
    const addRef = checkCaller(r, 'addRow');
    assert.equal(refOf(r.children[0]!), prior);
    assert.equal(refOf(r.children[1]!), addRef);
    const connectRef = checkCaller(d.bands[1]!, 'connectBoxes');
    const {laidOut} = await checkDiagram(d);
    assert.equal(refOf(laidOut), diagramRef);
    assert.equal(refOf(laidOut.connects[0]!), connectRef);
    assert.equal(laidOut.connects[0]?.line, 'dashed');
  } finally {
    captureSourceLocations(false);
  }
});

test('opting in is a no-op without V8 captureStackTrace', () => {
  const capture = Error.captureStackTrace;
  Object.defineProperty(Error, 'captureStackTrace', {value: undefined});
  captureSourceLocations(true);
  try {
    assert.equal(captureHere(), undefined);
    const d = diagram({theme: 'blue'}).add(box({id: 'a', title: 'A'}), box({id: 'b', title: 'B'})).connect('a', 'b');
    for (const target of [d, ...d.bands]) assert.equal(refOf(target), undefined);
  } finally {
    Object.defineProperty(Error, 'captureStackTrace', {value: capture});
    captureSourceLocations(false);
  }
});

test('detaching the tree copies only the two source symbols by reference', () => {
  const b = box({title: 'A'});
  const d = diagram({theme: 'blue'}).add(b);
  const ref = mark(b);
  const fallback = new SourceRef(undefined, 'parts[0]');
  const other = Symbol('other');
  Object.assign(b, {[DIAGRAM_SOURCE]: fallback, [other]: true});
  const copy = detachData(d).bands[0]!;
  assert.notEqual(copy, b);
  assert.equal(refOf(copy), ref);
  assert.equal(refOf(copy, DIAGRAM_SOURCE), fallback);
  assert.deepEqual(Object.getOwnPropertySymbols(copy), [SOURCE, DIAGRAM_SOURCE]);
});

test('a group stretched inside a row keeps its source on the frame and title', async () => {
  const short = group([box({title: 'Short'})], {title: 'Short group'});
  const tall = group([box({title: 'One'}), box({title: 'Two'}), box({title: 'Three'})]);
  const r = row([short, tall]);
  const d = diagram({theme: 'blue'}).add(r);
  const {refs} = stampDiagram(d);
  const {laidOut} = await checkDiagram(d);
  const [frame, title, child, tallFrame] = laidOut.laidOut;
  assert.ok(frame?.type === 'group' && title?.type === 'caption' && child?.type === 'box' && tallFrame?.type === 'group');
  assert.equal(frame.h, tallFrame.h);
  assert.equal(refOf(frame), refs.get(r.children[0]!));
  assert.equal(refOf(title), refOf(frame));
  assert.equal(refOf(child), refs.get(short.children[0]!));
  assert.equal(refOf(tallFrame), refs.get(r.children[1]!));
});


test('withSource preserves an existing mark and throwAtDiagram preserves the original Error', () => {
  const target = {};
  const ref = mark(target);
  const other = new SourceRef(undefined, 'parts[1]');
  const error = new Error('failure');
  assert.equal(withSource(error, ref), error);
  assert.equal(refOf(error), ref);
  withSource(error, other);
  assert.equal(refOf(error), ref);
  assert.throws(() => throwAtDiagram(error, target), thrown => {
    assert.equal(thrown, error);
    assert.equal(refOf(error, DIAGRAM_SOURCE), undefined);
    return true;
  });
});

import assert from 'node:assert/strict';
import {readdirSync} from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {areas, box, connect, diagram, gantt, grid, group, image, raw, row} from '../lib/dsl.ts';
import {detachData} from '../lib/dsl/diagram.ts';
import {checkDiagram, renderDiagram} from '../lib/dsl/render.ts';
import {importDefine} from '../lib/load-source.ts';
import {installResolveHook} from '../lib/resolve-hook.ts';
import {walkBands} from '../lib/rules.ts';
import {DIAGRAM_SOURCE, SOURCE, SourceRef, atBand, captureHere, captureSourceLocations, sourceOf as refOf} from '../lib/source-ref.ts';
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

function sourceProblems(name: string, d: LaidOutDiagram, {diagramRef, refs}: ReturnType<typeof stampDiagram>): string[] {
  const inputs = [...refs.keys()];
  const inputByRef = new Map([...refs].map(([band, ref]) => [ref, band]));
  const problems: string[] = [];
  const check = (target: object, label: string, expected?: SourceRef): void => {
    const ref = refOf(target);
    if (!ref) problems.push(`${name} ${label}: missing SOURCE`);
    else if (expected ? ref !== expected : !inputByRef.has(ref)) problems.push(`${name} ${label}: wrong SOURCE`);
  };
  for (const [i, band] of d.laidOut.entries()) {
    const generated = band.type === 'status'
      || (band.type === 'caption' && (band.titleLine || band.sourceLine))
      || (band.type === 'legend' && !inputs.some(b => b.type === 'legend'));
    const label = `laidOut[${i}] ${band.type}`;
    const sameId = 'id' in band && band.id !== undefined
      ? inputs.filter(b => 'id' in b && b.id === band.id && b.type === band.type) : [];
    check(band, label, generated ? diagramRef : sameId.length === 1 ? refs.get(sameId[0]!) : undefined);
    const ref = refOf(band);
    const owner = ref && inputByRef.get(ref);
    const children = band.type === 'row' || band.type === 'grid' ? band.children : [];
    for (const [j, child] of children.entries()) {
      const sameBox = inputs.filter(b => b.type === 'box' && b.id === child.id && b.title === child.title);
      const input = owner?.type === 'row' || owner?.type === 'grid' ? owner.children[j]
        : sameBox.length === 1 ? sameBox[0] : undefined;
      check(child, `${label} child[${j}]`, input && refs.get(input));
    }
  }
  for (const c of d.connects) {
    const matching = inputs.filter(b => b.type === 'connect' && b.from === c.fromLabel && b.to === c.toLabel && b.label === c.label);
    check(c, `connect ${c.fromLabel} -> ${c.toLabel}`, matching.length === 1 ? refs.get(matching[0]!) : undefined);
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
    problems.push(...sourceProblems(name, laidOut, expected));
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
    assert.deepEqual(sourceProblems(name, result.laidOut, expected), []);
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

test('band errors carry the source of the part that failed', async () => {
  const missingAnchor: Band = connect('a', 'missing');
  const missingImage = image(new URL('./fixtures/source-ref-missing.png', import.meta.url), {alt: 'Missing picture'});
  const invalidBox = box({title: 'Not yet', reveal: 3});
  invalidBox.until = 2;
  const invalidConnect = connect('a', 'b', {until: 2});
  const autoToday = gantt([{label: 'A', start: '2026-01-01', days: 1}], {today: 'auto'});
  const invalidAreas = areas('a', {a: group([box({title: 'A'})])});
  invalidAreas.place.length = 0; // A missing cell is found in layout's first walk, before stack dispatch.
  const checkError = (band: object, d: Diagram, message: RegExp) => {
    const ref = mark(band);
    return assert.rejects(checkDiagram(d), (error: Error) => {
      assert.match(error.message, message);
      assert.equal(refOf(error), ref);
      return true;
    });
  };
  await checkError(missingAnchor, diagram({theme: 'blue'}).add(box({id: 'a', title: 'A'}), missingAnchor), /unknown anchor id/);
  await checkError(missingImage, diagram({theme: 'blue'}).add(missingImage), /image\(\): cannot read/);
  const nested = group([invalidBox]);
  mark(nested);
  await checkError(invalidBox, diagram({theme: 'blue'}).add(nested), /until 2 must be later than its reveal 3/);
  await checkError(autoToday, diagram({theme: 'blue'}).add(autoToday), /needs a date/);
  await checkError(invalidAreas, diagram({theme: 'blue'}).add(invalidAreas), /expected a value|undefined/i);
  await checkError(invalidConnect, diagram({theme: 'blue'}).add(box({id: 'a', title: 'A', reveal: 3}), box({id: 'b', title: 'B'}), invalidConnect), /until 2 must be later than its reveal 3/);
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
    const a = box({id: 'a', title: 'A'}), b = box({id: 'b', title: 'B'});
    const r = row([a, b]);
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

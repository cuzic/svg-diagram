// ADR 0054: the shapes of one part (a class, a series, a legend entry) are a group in the PowerPoint export, named after the part.
import test from 'node:test';
import assert from 'node:assert/strict';
import {closeMeasurer} from '../lib/dsl.ts';
import {partCatalog} from '../lib/spec.ts';
import {renderPptxEdge} from '../lib/pptx-edge.ts';
import {marked, parsePart, partAttr, partStep, partsOn, withParts} from '../lib/parts.ts';
import {assembleParts, crosses, partName, type Piece} from '../lib/pptx/parts-group.ts';
import {xmlProblems} from '../lib/xml-check.ts';
import {realEngine} from './helpers/text-engine.ts';
import {unzipEntry} from './helpers/pptx/unzip.ts';

test.after(() => closeMeasurer());
const spec = (...parts: unknown[]) => ({version: 1, title: '例', parts});
const example = (type: string) => partCatalog().find(p => p.type === type)?.example;
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** A slide's shapes as a tree: each group with its name and children, each shape as its name. */
interface Node {name: string; kids?: Node[]}
function treeOf(xml: string): Node[] {
  const root: Node = {name: '', kids: []}, stack = [root];
  for (const m of xml.matchAll(/<p:grpSp>|<\/p:grpSp>|<p:(?:sp|cxnSp|graphicFrame|pic)>[\s\S]*?<p:cNvPr id="\d+" name="([^"]*)"|<p:nvGrpSpPr><p:cNvPr id="\d+" name="([^"]*)"/g)) {
    const top = stack[stack.length - 1] as Node;
    if (m[0] === '<p:grpSp>') { const g: Node = {name: '', kids: []}; top.kids?.push(g); stack.push(g); }
    else if (m[0] === '</p:grpSp>') stack.pop();
    else if (m[2] !== undefined) top.name = m[2];
    else top.kids?.push({name: m[1] ?? ''});
  }
  return root.kids ?? [];
}
const groups = (nodes: Node[]): Node[] => nodes.flatMap(n => n.kids ? [n, ...groups(n.kids)] : []);
async function slideOf(...parts: unknown[]): Promise<string> {
  const r = await renderPptxEdge(spec(...parts), realEngine(), {rasterize: () => PNG});
  assert.deepEqual(r.issues, []);
  assert.ok(r.pptx);
  assert.equal(r.pictures, 0);
  const slide = unzipEntry(Buffer.from(r.pptx), 'ppt/slides/slide1.xml').toString();
  assert.deepEqual(xmlProblems(slide), []);
  return slide;
}

test('partStep, partAttr, parsePart: a part path survives / | % and quotes in its labels; nothing is written unless asked', () => {
  const step = partStep('class', 'u/1', 'A|B "%"'), inner = partStep('entry', 2, '凡例');
  assert.deepEqual(parsePart(`${step}/${inner}`), [{kind: 'class', key: 'u/1', label: 'A|B "%"'}, {kind: 'entry', key: '#2', label: '凡例'}]);
  assert.equal(partAttr(false, step), '');
  assert.equal(partAttr(true), '');
  assert.match(partAttr(true, step), /^ data-part="class:u%2F1\|A%7CB &quot;%25&quot;"$/);
  assert.equal(marked('<rect x="1"/><text x="2"><tspan>a</tspan></text>', ' data-part="p"'), '<rect data-part="p" x="1"/><text data-part="p" x="2"><tspan>a</tspan></text>');
  assert.equal(marked('<rect/>', ''), '<rect/>');
  const d = withParts({laidOut: [{type: 'caption'}]} as never);
  assert.equal(partsOn(d.laidOut[0] as object), true);
  assert.equal(partsOn({}), false);
});

test('partName: kind and label, and the DSL id when the part has one (not an index)', () => {
  assert.equal(partName(partStep('class', 'Order', '注文')), 'class: 注文 [Order]');
  assert.equal(partName(partStep('series', 0, '渋谷店')), 'series: 渋谷店');
  assert.equal(partName(partStep('axis', 'x', '')), 'axis [x]');
});

test('crosses: areas overlap, a line near an area, two lines within their widths; touching is not crossing', () => {
  const r = (x: number, y: number, w: number, h: number) => ({kind: 'rect' as const, r: {x, y, w, h}});
  const l = (w: number, ...p: number[]) => ({kind: 'poly' as const, w, pts: Array.from({length: p.length / 2}, (_, i) => ({x: p[2 * i] as number, y: p[2 * i + 1] as number}))});
  assert.equal(crosses(r(0, 0, 10, 10), r(5, 5, 10, 10)), true);
  assert.equal(crosses(r(0, 0, 10, 10), r(10, 0, 10, 10)), false);
  assert.equal(crosses(l(2, 0, 5, 20, 5), r(8, 0, 4, 10)), true);
  assert.equal(crosses(l(2, 0, 20, 20, 20), r(8, 0, 4, 10)), false);
  // a polyline's box covers both: only its segments count
  assert.equal(crosses(l(2, 0, 0, 0, 30, 30, 30), r(10, 5, 5, 5)), false);
  assert.equal(crosses(l(2, 0, 0, 10, 10), l(2, 0, 10, 10, 0)), true);
  assert.equal(crosses(l(2, 0, 0, 10, 0), l(2, 0, 10, 10, 10)), false);
});

test('assembleParts: a part is gathered where no moved shape crosses what is drawn between; a shape that would is left out', () => {
  let id = 100;
  const next = () => id++;
  const rect = (order: number, x: number, part: string[]): Piece => ({order, xml: `<p:sp><p:nvSpPr><p:cNvPr id="${order}" name="s${order}"/></p:nvSpPr></p:sp>`, part, geo: {kind: 'rect', r: {x, y: 0, w: 10, h: 10}}});
  const A = partStep('class', 'a', 'A'), B = partStep('class', 'b', 'B');
  // A's pieces at 0 and 2, B's at 1: apart, so A is written at its last piece
  const apart = assembleParts([rect(0, 0, [A]), rect(1, 50, [B]), rect(2, 0, [A])], next);
  assert.match(apart, /^<p:sp>.*name="class: B \[b\]".*<p:grpSp>.*name="class: A \[a\]".*name="s0".*name="s2"/s);
  // the middle shape covers A's: the last place would raise s0 over it, the first would lower s2 under it; so s0 or s2 stays out
  const left: Piece[] = [];
  const clash = assembleParts([rect(0, 0, [A]), rect(1, 5, []), rect(2, 0, [A])], next, 0, left);
  assert.equal(left.length, 1);
  assert.doesNotMatch(clash, /<p:grpSp>/);
  assert.match(clash, /name="class: A \[a\]"/);
  // a part of one shape is that shape, renamed
  assert.match(assembleParts([rect(0, 0, [B])], next), /name="class: B \[b\]"/);
});

test('a class diagram: each class is a group of its box, dividers and lines; each relation of its line, mark and labels', async () => {
  const slide = await slideOf(example('classDiagram'));
  const gs = groups(treeOf(slide)).map(g => g.name);
  assert.ok(gs.some(n => /^class: .+ \[.+\]$/.test(n)), gs.join(', '));
  assert.ok(gs.some(n => /^relation: .+ → .+$/.test(n)), gs.join(', '));
  for (const g of groups(treeOf(slide)).filter(g => g.name.startsWith('class: '))) assert.ok((g.kids?.length ?? 0) >= 2, g.name);
});

// The board spec part (ADR 0069 D4, lib/spec-parts/board.ts): boxes, groups and captions placed by named areas and joined by links. A
// board builds the DSL calls a source writes (areas + group / box / caption + connect({via})), so the same figure is the same SVG; its
// mistakes are reported at their place; the sides of a link follow from where the nodes sit; and a deck figure can be a board.
import test from 'node:test';
import assert from 'node:assert/strict';
import {areas, box, caption, closeMeasurer, connect, diagram, group, renderDiagram} from '../lib/dsl.ts';
import {layoutIssue, locateMessage, partCatalog, specToDiagram, validateSpec} from '../lib/spec.ts';
import {renderSpec} from '../lib/spec-render.ts';
import {validateDeck} from '../lib/deck-spec.ts';
import {BOARD_MAX_NODES} from '../lib/spec-parts/board.ts';
import type {Diagram} from '../lib/types/index.ts';

test.after(() => closeMeasurer());

const svgOf = async (d: Diagram) => (await renderDiagram(d, {name: 'x.svg', budget: 'cacheOnly'})).svg;
const spec = (...parts: unknown[]) => ({version: 1, title: '例', legend: false, parts});
const dsl = (...bands: unknown[]) => diagram({theme: 'blue', title: '例', legend: false}).add(...(bands as never[])) as unknown as Diagram;
const pathsOf = (input: unknown) => validateSpec(input).map(i => i.path);
const board = (p: Record<string, unknown>): Record<string, unknown> => ({type: 'board', ...p});

// nov27 s04 (examples/areas-memo.ts), with a connect per conversation instead of branch(): a board has no fan (ADR 0069 未決 7)
const s04Board = board({
  areas: ['head memo convs'], cols: [4, 3, 4], gap: 64,
  nodes: [
    {id: 'head', kind: 'group', title: '担当者の頭の中', tone: 'muted', children: [{title: '提出先の手引き'}, {title: '社内ルール'}, {title: '環境の制約'}]},
    {id: 'memo', kind: 'group', title: '書き出す先', children: [{id: 'note', title: '決定メモ', body: '1枚に書き出す', tone: 'solid'}]},
    {id: 'convs', kind: 'group', title: '同じ前提で始まる', tone: 'accent', children: [{id: 'c1', title: '今の会話'}, {id: 'c2', title: '新しい会話'}, {id: 'c3', title: '別の人・別のAI'}]},
  ],
  links: [{from: 'head', to: 'note'}, {from: 'note', to: 'c1', via: 'to'}, {from: 'note', to: 'c2', via: 'to'}, {from: 'note', to: 'c3', via: 'to', label: '渡す', chip: true}],
});
const s04Dsl = () => dsl(
  areas('head memo convs', {
    head: group([box({title: '提出先の手引き'}), box({title: '社内ルール'}), box({title: '環境の制約'})], {title: '担当者の頭の中', tone: 'muted'}),
    memo: group([box({id: 'note', title: '決定メモ', body: '1枚に書き出す', tone: 'solid'})], {title: '書き出す先'}),
    convs: group([box({id: 'c1', title: '今の会話'}), box({id: 'c2', title: '新しい会話'}), box({id: 'c3', title: '別の人・別のAI'})], {title: '同じ前提で始まる', tone: 'accent'}),
  }, {cols: [4, 3, 4], gap: 64}),
  connect('head:right', 'note:left'),
  connect('note:right', 'c1:left', {via: {to: 'group'}}),
  connect('note:right', 'c2:left', {via: {to: 'group'}}),
  connect('note:right', 'c3:left', {via: {to: 'group'}, label: '渡す', chip: true}),
);

test('the s04 memo figure as a board is byte for byte the SVG of the same figure in the DSL', async () => {
  assert.deepEqual(validateSpec(spec(s04Board)), []);
  const json = await svgOf(specToDiagram(spec(s04Board)));
  assert.equal(json, await svgOf(s04Dsl()));
  // the sides were inferred: written out, they change nothing
  const written = {...s04Board, links: (s04Board['links'] as Record<string, unknown>[]).map(l => ({...l, fromSide: 'right', toSide: 'left'}))};
  assert.equal(await svgOf(specToDiagram(spec(written))), json);
});

test('the catalog example of board is valid and draws without a problem or a finding', async () => {
  const ex = partCatalog().find(p => p.type === 'board');
  assert.ok(ex);
  assert.ok(ex.description.includes('Prefer a typed part when one fits'));
  const r = await renderSpec(spec(ex.example));
  assert.equal(r.ok, true);
  assert.deepEqual([r.issues, r.problems, r.findings], [[], [], []]);
});

test('a board without areas puts its nodes in one row; a group without areas stacks its children; captions and nested groups build as in the DSL', async () => {
  const b = board({
    nodes: [
      {id: 'a', title: 'A', lines: ['一', '二']},
      {id: 'g', kind: 'group', title: 'G', dashed: true, valign: 'top', children: [
        {id: 'x', title: 'X', stamp: '新'},
        {kind: 'caption', text: '注記', bold: true, tone: 'text'},
        {id: 'inner', kind: 'group', title: '内側', tone: 'plain', areas: ['p q'], gap: 24, children: [{id: 'p', title: 'P'}, {id: 'q', kind: 'caption', text: 'Q'}]},
      ]},
      {id: 'n', kind: 'caption', text: '右の注記', tone: 'accent'},
    ],
    links: [{from: 'a', to: 'x'}, {from: 'x', to: 'p'}],
  });
  assert.deepEqual(validateSpec(spec(b)), []);
  const same = dsl(
    areas(['a g n'], {
      a: box({id: 'a', title: 'A', lines: ['一', '二']}),
      g: group([
        box({id: 'x', title: 'X', stamp: '新'}),
        caption('注記', {bold: true, tone: 'text'}),
        group([areas(['p q'], {p: box({id: 'p', title: 'P'}), q: caption('Q')}, {gap: 24})], {id: 'inner', title: '内側', tone: 'plain'}),
      ], {id: 'g', title: 'G', dashed: true, valign: 'top'}),
      n: caption('右の注記', {tone: 'accent'}),
    }),
    connect('a:right', 'x:left'),
    connect('x:bottom', 'p:top'),
  );
  assert.equal(await svgOf(specToDiagram(spec(b))), await svgOf(same));
});

test('the sides of a link follow from the areas: side by side, one above the other, a box in a group, two boxes of one group', async () => {
  const nodes = [
    {id: 'a', title: 'A'},
    {id: 'b', title: 'B'},
    {id: 'g', kind: 'group', title: 'G', areas: ['p q'], children: [{id: 'p', title: 'P'}, {id: 'q', title: 'Q'}]},
    {id: 's', kind: 'group', title: 'S', children: [{id: 'u', title: 'U'}, {id: 'v', title: 'V'}]},
  ];
  const tpl = ['a b', 'g s'];
  const links = [
    {from: 'b', to: 'a', label: '左へ'}, // side by side, right to left: b:left -> a:right
    {from: 'a', to: 'p'}, // a above g: a:bottom -> p:top
    {from: 'p', to: 'q'}, // in g, side by side
    {from: 'v', to: 'u'}, // in the stack s: v is below u
    {from: 'q', to: 'u'}, // g and s side by side, across the groups
  ];
  const sides = [['left', 'right'], ['bottom', 'top'], ['right', 'left'], ['top', 'bottom'], ['right', 'left']];
  const inferred = board({areas: tpl, rowGap: 48, nodes, links});
  assert.deepEqual(validateSpec(spec(inferred)), []);
  const svg = await svgOf(specToDiagram(spec(inferred)));
  const written = board({areas: tpl, rowGap: 48, nodes, links: links.map((l, i) => ({...l, fromSide: sides[i]?.[0], toSide: sides[i]?.[1]}))});
  assert.equal(await svgOf(specToDiagram(spec(written))), svg);
  const same = dsl(
    areas(tpl, {
      a: box({id: 'a', title: 'A'}), b: box({id: 'b', title: 'B'}),
      g: group([areas(['p q'], {p: box({id: 'p', title: 'P'}), q: box({id: 'q', title: 'Q'})})], {id: 'g', title: 'G'}),
      s: group([box({id: 'u', title: 'U'}), box({id: 'v', title: 'V'})], {id: 's', title: 'S'}),
    }, {rowGap: 48}),
    connect('b:left', 'a:right', {label: '左へ'}), connect('a:bottom', 'p:top'), connect('p:right', 'q:left'), connect('v:top', 'u:bottom'), connect('q:right', 'u:left'),
  );
  assert.equal(svg, await svgOf(same));
});

test('board mistakes are reported at their place', () => {
  const at = (p: Record<string, unknown>) => pathsOf(spec(board(p)));
  const two = [{id: 'a', title: 'A'}, {id: 'b', title: 'B'}];
  assert.deepEqual(at({nodes: two}), []);
  // the template: a name that is not a rectangle, at its row; names and ids that do not match; the column ratios
  assert.deepEqual(at({areas: ['a b', 'a c', 'a b'], nodes: [...two, {id: 'c', title: 'C'}]}), ['parts[0].areas[1]']);
  assert.deepEqual(at({areas: ['a b', 'a　b'], nodes: two}), ['parts[0].areas[1]']);
  assert.deepEqual(at({areas: ['a b c'], nodes: two}), ['parts[0].areas']);
  assert.deepEqual(at({areas: ['a'], nodes: two}), ['parts[0].nodes[1].id']);
  assert.deepEqual(at({areas: ['a b'], cols: [1, 2, 3], nodes: two}), ['parts[0].cols']);
  assert.deepEqual(at({cols: [1], nodes: two}), ['parts[0].cols']);
  // ids: a repeat (in a group too), a name that is no area name, a top-level node without one
  assert.deepEqual(at({nodes: [...two, {id: 'a', title: 'C'}]}), ['parts[0].nodes[2].id']);
  assert.deepEqual(at({nodes: [...two, {id: 'g', kind: 'group', children: [{id: 'b', title: 'C'}]}]}), ['parts[0].nodes[2].children[0].id']);
  assert.deepEqual(at({nodes: [...two, {id: '決定', title: 'C'}]}), ['parts[0].nodes[2].id']);
  assert.deepEqual(at({nodes: [...two, {title: 'C'}]}), ['parts[0].nodes[2].id']);
  assert.deepEqual(at({nodes: [...two, {id: 'g', kind: 'group', children: [{id: 'x:y', title: 'C'}]}]}), ['parts[0].nodes[2].children[0].id']);
  // a field that is not the kind's, a missing one, a tone of another kind
  assert.deepEqual(at({nodes: [two[0], {id: 'b', title: 'B', text: '本文'}]}), ['parts[0].nodes[1].text']);
  assert.deepEqual(at({nodes: [two[0], {id: 'b', kind: 'caption', text: 'x', title: 'B'}]}), ['parts[0].nodes[1].title']);
  assert.deepEqual(at({nodes: [two[0], {id: 'b', kind: 'group', title: 'B', body: 'x', children: [{title: 'C'}]}]}), ['parts[0].nodes[1].body']);
  assert.deepEqual(at({nodes: [two[0], {id: 'b', body: 'x'}]}), ['parts[0].nodes[1].title']);
  assert.deepEqual(at({nodes: [two[0], {id: 'b', kind: 'group', title: 'B'}]}), ['parts[0].nodes[1].children']);
  assert.deepEqual(at({nodes: [two[0], {id: 'b', kind: 'group', tone: 'solid', children: [{title: 'C'}]}]}), ['parts[0].nodes[1].tone']);
  assert.deepEqual(at({nodes: [two[0], {id: 'b', kind: 'caption', text: 'x', tone: 'plain'}]}), ['parts[0].nodes[1].tone']);
  assert.deepEqual(at({nodes: [two[0], {id: 'b', kind: 'group', gap: 24, children: [{title: 'C'}]}]}), ['parts[0].nodes[1].gap']);
  // a group with areas: its children need ids that are names
  assert.deepEqual(at({nodes: [{id: 'g', kind: 'group', areas: ['p q'], children: [{id: 'p', title: 'P'}, {title: 'Q'}]}]}), ['parts[0].nodes[0].children[1].id', 'parts[0].nodes[0].areas']);
  assert.deepEqual(at({nodes: [{id: 'g', kind: 'group', areas: ['p q', 'p r'], children: [{id: 'p', title: 'P'}, {id: 'q', title: 'Q'}, {id: 'r', title: 'R'}]}]}), []);
  assert.deepEqual(at({nodes: [{id: 'g', kind: 'group', areas: ['p q', 'q p'], children: [{id: 'p', title: 'P'}, {id: 'q', title: 'Q'}]}]}), ['parts[0].nodes[0].areas[0]']); // the first row that breaks p's rectangle
});

test('board links: ends of this board that are boxes or groups, sides that can be told, via on a box in a group', () => {
  const nodes = [
    {id: 'a', title: 'A'},
    {id: 'b', title: 'B'},
    {id: 'g', kind: 'group', title: 'G', children: [{id: 'x', title: 'X'}, {id: 'y', title: 'Y'}]},
    {id: 'n', kind: 'caption', text: '注記'},
  ];
  const at = (links: unknown[], areasOf: string[] = ['a b', 'g n']) => pathsOf(spec(board({areas: areasOf, nodes, links})));
  assert.deepEqual(at([{from: 'a', to: 'b'}, {from: 'a', to: 'x', via: 'to'}, {from: 'x', to: 'y'}, {from: 'b', to: 'a', fromSide: 'bottom', toSide: 'bottom', route: 'elbow'}]), []);
  assert.deepEqual(at([{from: 'a', to: 'zz'}]), ['parts[0].links[0].to']);
  assert.deepEqual(at([{from: 'a', to: 'n'}]), ['parts[0].links[0].to']);
  assert.deepEqual(at([{from: 'a', to: 'a'}]), ['parts[0].links[0].to']);
  // diagonal cells: a (row 0, col 0) and n's neighbour ... b (row 0, col 1) and g (row 1, col 0)
  assert.deepEqual(at([{from: 'a', to: 'b'}, {from: 'b', to: 'g'}]), ['parts[0].links[1].fromSide']);
  assert.deepEqual(at([{from: 'a', to: 'b'}, {from: 'b', to: 'g', fromSide: 'left'}]), ['parts[0].links[1].toSide']);
  assert.deepEqual(at([{from: 'a', to: 'b'}, {from: 'b', to: 'g', fromSide: 'bottom', toSide: 'right'}]), []);
  // a group and a box inside it: no side follows from their places
  assert.deepEqual(at([{from: 'g', to: 'x'}]), ['parts[0].links[0].fromSide']);
  assert.deepEqual(at([{from: 'g', to: 'x', fromSide: 'top', toSide: 'top'}]), []);
  // via: the end must be a box in a group that leaves out the other end
  assert.deepEqual(at([{from: 'a', to: 'b'}, {from: 'b', to: 'x'}, {from: 'a', to: 'b', via: 'to'}]), ['parts[0].links[1].fromSide', 'parts[0].links[2].via']);
  assert.deepEqual(at([{from: 'a', to: 'g', via: 'to'}]), ['parts[0].links[0].via']);
  assert.deepEqual(at([{from: 'x', to: 'y', via: 'from'}]), ['parts[0].links[0].via']);
  assert.deepEqual(at([{from: 'a', to: 'b', via: 'both'}]), ['parts[0].links[0].via']);
  assert.deepEqual(at([{from: 'x', to: 'a', via: 'both'}]), []);
  // another part's ids are not this board's
  const flow = {type: 'flowchart', nodes: [{id: 'f', label: 'F'}], edges: []};
  assert.deepEqual(pathsOf(spec(board({nodes: [{id: 'a', title: 'A'}], links: [{from: 'a', to: 'f'}]}), flow)), ['parts[0].links[0].to']);
  // and an id another part has is a repeat in the figure, at its nested place
  assert.deepEqual(pathsOf(spec(flow, board({nodes: [{id: 'g', kind: 'group', children: [{id: 'f', title: 'F'}]}]}))), ['parts[1].nodes[0].children[0].id']);
});

test('board limits: three levels of groups, the nodes nested ones included, a row without areas', () => {
  const at = (p: Record<string, unknown>) => pathsOf(spec(board(p)));
  const deep = {id: 'g', kind: 'group', children: [{id: 'h', kind: 'group', children: [{id: 'i', kind: 'group', children: [{title: 'x'}]}]}]};
  assert.ok(at({nodes: [deep]}).some(p => p.startsWith('parts[0].nodes[0].children[0].children[0]')));
  assert.deepEqual(at({nodes: [{id: 'g', kind: 'group', children: [{id: 'h', kind: 'group', children: [{id: 'i', kind: 'group'}]}]}]}), ['parts[0].nodes[0].children[0].children[0].kind']);
  assert.deepEqual(at({nodes: [{id: 'g', kind: 'group', children: [{id: 'h', kind: 'group', children: [{title: 'x'}]}]}]}), []);
  // 24 nodes in all is the limit: 3 groups of 7 boxes and 3 more boxes is 27 nodes (the groups count)
  const groups = ['p', 'q', 'r'].map(g => ({id: g, kind: 'group', children: Array.from({length: 7}, (_, i) => ({title: `${g}${i}`}))}));
  assert.deepEqual(at({nodes: [...groups, {id: 's', title: 's'}, {id: 't', title: 't'}, {id: 'u', title: 'u'}]}), ['parts[0].nodes']);
  assert.equal(3 + 3 * 7 + 3 > BOARD_MAX_NODES && 2 + 2 * 7 + 1 <= BOARD_MAX_NODES, true);
  assert.deepEqual(at({nodes: [...groups.slice(0, 2), {id: 's', title: 's'}]}), []);
  // 13 nodes without areas: one row would be 13 columns
  const thirteen = Array.from({length: 13}, (_, i) => ({id: `n${i}`, title: `${i}`}));
  assert.deepEqual(at({nodes: thirteen}), ['parts[0].areas']);
  assert.deepEqual(at({nodes: thirteen, areas: [thirteen.slice(0, 7).map(n => n.id).join(' '), `${thirteen.slice(7).map(n => n.id).join(' ')} .`]}), []);
});

test('a deck slide can hold a board figure', () => {
  assert.deepEqual(validateDeck({slides: [{title: '決定メモ', figure: spec(s04Board)}]}), []);
  const bad = validateDeck({slides: [{title: '決定メモ', figure: spec(board({nodes: [{id: 'a', title: 'A'}], links: [{from: 'a', to: 'b'}]}))}]});
  assert.deepEqual(bad.map(i => i.path), ['slides[0].figure.parts[0].links[0].to']);
});

test('a written side that a via end cannot stop on is reported at the side, before the layout', () => {
  const mk = (link: Record<string, unknown>, areasOf = ['g z']) => spec(board({areas: areasOf, nodes: [{id: 'g', kind: 'group', title: 'G', children: [{id: 'x', title: 'X'}, {id: 'w', title: 'W'}]}, {id: 'z', title: 'Z'}], links: [link]}));
  assert.deepEqual(pathsOf(mk({from: 'x', to: 'z', fromSide: 'left', toSide: 'left', via: 'from'})), ['parts[0].links[0].fromSide']);
  assert.deepEqual(pathsOf(mk({from: 'x', to: 'z', fromSide: 'bottom', toSide: 'left', via: 'from', route: 'elbow'})), ['parts[0].links[0].fromSide']);
  assert.deepEqual(pathsOf(mk({from: 'z', to: 'x', fromSide: 'left', toSide: 'left', via: 'to'})), ['parts[0].links[0].toSide']);
  assert.deepEqual(pathsOf(mk({from: 'z', to: 'x', fromSide: 'left', toSide: 'top', via: 'both'})), ['parts[0].links[0].toSide']);
  assert.deepEqual(pathsOf(mk({from: 'z', to: 'x', fromSide: 'left', toSide: 'right', via: 'both'})), []);
  assert.deepEqual(pathsOf(mk({from: 'x', to: 'z', fromSide: 'right', toSide: 'left', via: 'from'})), []);
  assert.deepEqual(pathsOf(mk({from: 'x', to: 'z', fromSide: 'bottom', toSide: 'top', via: 'from'}, ['g', 'z'])), []);
  assert.deepEqual(pathsOf(mk({from: 'x', to: 'z', fromSide: 'right', toSide: 'top', via: 'from'}, ['g', 'z'])), ['parts[0].links[0].fromSide']);
  // a side without via is the author's to choose
  assert.deepEqual(pathsOf(mk({from: 'x', to: 'z', fromSide: 'left', toSide: 'left'})), []);
});

test('a link written twice is reported; a layout message about a connect points at its link; a narrow area gets advice a spec can follow', () => {
  const two = [{id: 'a', title: 'A'}, {id: 'b', title: 'B'}];
  assert.deepEqual(pathsOf(spec(board({nodes: two, links: [{from: 'a', to: 'b'}, {from: 'b', to: 'a'}, {from: 'a', to: 'b'}]}))), ['parts[0].links[2]']);
  const s = spec({type: 'flowchart', nodes: [{id: 'f', label: 'F'}], edges: []}, board({nodes: two, links: [{from: 'a', to: 'b'}, {from: 'b', to: 'a', fromSide: 'left', toSide: 'right'}]}));
  assert.equal(locateMessage(s, 'connect(b:left -> a:right): the label covers the arrow'), 'parts[1].links[1]');
  assert.equal(locateMessage(s, 'connect(a:right -> b:left@0.3): something'), 'parts[1].links[0]');
  const issue = layoutIssue(spec(board({nodes: two})), 'areas: area "a" is only 84px wide (at least 96px): give its columns a larger share (cols), use a smaller gap, or widen the figure (diagram({width}))');
  assert.equal(issue.path, 'parts[0].nodes[0].id');
  assert.ok(!issue.message.includes('diagram({width})') && issue.message.includes('more rows (areas)'), issue.message);
});

test('the catalog entry of board stays small: nested nodes refer to the top-level descriptions', () => {
  const entry = partCatalog().find(p => p.type === 'board');
  assert.ok(JSON.stringify(entry).length < 12_000, String(JSON.stringify(entry).length));
});

test('a caption in a stack is no anchor, so another part may use its id', () => {
  const flow = {type: 'flowchart', nodes: [{id: 'n', label: 'F'}], edges: []};
  assert.deepEqual(pathsOf(spec(flow, board({nodes: [{id: 'g', kind: 'group', children: [{title: 'A'}, {id: 'n', kind: 'caption', text: '注'}]}]}))), []);
  assert.deepEqual(pathsOf(spec(flow, board({nodes: [{id: 'n', kind: 'caption', text: '注'}]}))), ['parts[1].nodes[0].id']);
});

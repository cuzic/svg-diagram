// ADR 0086 U1: swimlane() with `kind` and `cols: 'auto'`, and bpmn() as its deprecated alias.
// D11 (a)-(f), the D1 throw coverage, laneOrder and the alias/auto equivalence (the 3 alias examples'
// byte identity against examples/out is verified by golden-docker.sh, the authoritative check).
import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {bpmn, checkDiagram, closeMeasurer, diagram, em, renderDiagram, swimlane} from '../lib/dsl.ts';
import {swimlaneDefinition} from '../lib/bands/swimlane.ts';
import {nestedBandsOf} from '../lib/band-children.ts';
import {loadConfig} from '../lib/config.ts';
import {describeSwimlaneAuto, describeSwimlaneFigure} from '../lib/diagram-description.ts';
import {emitPptx} from '../lib/pptx/emit.ts';
import {FULL_DEFINITIONS} from '../lib/full-definitions.ts';
import {loadDiagram} from '../lib/load-source.ts';
import {installResolveHook} from '../lib/resolve-hook.ts';
import {locationsMap} from '../lib/locations-map.ts';
import {placedDefinitionOf} from '../lib/placed-definitions.ts';
import {captureSourceLocations} from '../lib/source-ref.ts';
import type {BpmnFlow, BpmnNode, LaidOutBpmn} from '../lib/types/diagrams.ts';
import type {LaidOutLegend} from '../lib/types/containers.ts';
import type {SwimlaneAutoBand, SwimlaneLane} from '../lib/types/sequence-table-swimlane.ts';
import {unzipEntry} from './helpers/pptx/unzip.ts';

installResolveHook();
test.after(() => closeMeasurer());

// generic example wording (public repo)
const LANES = [{id: 'cust', label: 'Customer'}, {id: 'shop', label: 'Shop'}];
const NODES: BpmnNode[] = [
  {id: 's', lane: 'cust', kind: 'start', label: 'Order'},
  {id: 'chk', lane: 'shop', label: 'Check stock'},
  {id: 'g', lane: 'shop', kind: 'xor', label: 'In stock'},
  {id: 'e', lane: 'cust', kind: 'end', label: 'Done'},
];
const FLOWS: BpmnFlow[] = [
  {from: 's', to: 'chk'}, {from: 'chk', to: 'g'}, {from: 'g', to: 'e', label: 'yes'},
];
const nodeSteps = () => NODES.map(n => ({
  id: n.id, lane: n.lane, ...(n.kind === undefined ? {} : {kind: n.kind}), ...(n.label === undefined ? {} : {title: n.label}),
}));
const autoFigure = (opts: {dir?: 'v'; fit?: 'shrink'} = {}) => swimlane(LANES, nodeSteps(), {cols: 'auto', flows: [...FLOWS], ...opts});
const aliasFigure = (opts: {dir?: 'v'; fit?: 'shrink'} = {}) => bpmn(LANES, NODES, FLOWS, opts);
const svgOf = async (bands: unknown) =>
  (await renderDiagram(diagram({theme: 'blue', title: 't'}).add(bands as never), {name: 't.svg', budget: 'cacheOnly'})).svg;
const autoBandOf = (bands: ReturnType<typeof autoFigure>): SwimlaneAutoBand => {
  const [band] = bands;
  assert.ok(band?.type === 'swimlane' && band.arrange === 'auto');
  return band;
};

test("swimlane({cols: 'auto'}): the band holds nodes and flows, not steps and cols; title/body map to label/sub", () => {
  const [band] = autoFigure();
  assert.equal(band?.type, 'swimlane');
  assert.ok(band && !('steps' in band) && !('cols' in band) && !('via' in band));
  const auto = autoBandOf(autoFigure());
  assert.equal(auto.arrange, 'auto');
  assert.deepEqual(auto.lanes, LANES);
  assert.deepEqual(auto.nodes.map(n => [n.id, n.lane, n.kind ?? 'task', n.label, n.sub ?? '']), [
    ['s', 'cust', 'start', 'Order', ''], ['chk', 'shop', 'task', 'Check stock', ''],
    ['g', 'shop', 'xor', 'In stock', ''], ['e', 'cust', 'end', 'Done', ''],
  ]);
  assert.deepEqual(auto.flows, [...FLOWS]);
  // the definition reports an auto figure's node ids (graph-disconnected attribution)
  assert.deepEqual(swimlaneDefinition.ids?.(auto), ['s', 'chk', 'g', 'e']);
  // a task step keeps no `kind`; a body maps to `sub`
  const [one] = swimlane(LANES, [{id: 't', lane: 'cust', title: 'T', body: 'second'}], {cols: 'auto', flows: []});
  assert.ok(one?.type === 'swimlane' && one.arrange === 'auto');
  assert.deepEqual(one.nodes, [{id: 't', lane: 'cust', label: 'T', sub: 'second'}]);
  // 8 literal lanes compile with cols: 'auto' (LaneCheck-8; the 6-lane cap for explicit columns is unchanged)
  swimlane(
    [{id: 'l1', label: 'L1'}, {id: 'l2', label: 'L2'}, {id: 'l3', label: 'L3'}, {id: 'l4', label: 'L4'},
      {id: 'l5', label: 'L5'}, {id: 'l6', label: 'L6'}, {id: 'l7', label: 'L7'}, {id: 'l8', label: 'L8'}],
    [{id: 's', lane: 'l1', title: 'S'}],
    {cols: 'auto', flows: []},
  );
});

test('the alias builds the same band as swimlane({cols: auto}) plus via, and draws the same bytes (h, v, shrink)', async () => {
  const variants: [string, {dir?: 'v'; fit?: 'shrink'}][] = [[
    'h', {},
  ], [
    'v', {dir: 'v'},
  ], [
    'shrink', {fit: 'shrink'},
  ]];
  // the alias stays undescribed while the auto figure is described (M1, pinned in (b)): compare without the description
  const withoutDesc = (svg: string): string =>
    svg.replace('aria-labelledby="svg-title svg-desc"', 'aria-labelledby="svg-title"').replace(/ {2}<desc id="svg-desc">[^]*?<\/desc>\n/, '');
  for (const [name, opts] of variants) {
    const alias = aliasFigure(opts), auto = autoBandOf(autoFigure(opts));
    assert.deepEqual({...auto, via: 'bpmn' as const}, alias, name);
    const [svgAlias, svgAuto] = await Promise.all([svgOf(alias), svgOf(autoFigure(opts))]);
    assert.equal(svgAlias, withoutDesc(svgAuto), `${name}: the alias draws what swimlane({cols: 'auto'}) draws`);
  }
});

test('(a) the alias keeps its PPTX image band, data-node names and locations (B1)', async () => {
  const {laidOut} = await renderDiagram(diagram({theme: 'blue', title: 't'}).add(aliasFigure()), {name: 't.svg', budget: 'cacheOnly'});
  const placed = laidOut.laidOut.find(b => b.type === 'bpmn') as LaidOutBpmn | undefined;
  assert.ok(placed);
  // the placed figure resolves to the kept bpmn definition, which draws it
  const kept = FULL_DEFINITIONS.bpmn;
  assert.ok(typeof kept !== 'function' && typeof kept.emit === 'function');
  assert.equal(typeof placedDefinitionOf(placed)?.emit, 'function');
  // PPTX: an image band, converted to native shapes through the placed definition. The figure's own shape
  // names equal the committed output (the slide's byte identity is pinned by the pptx-golden workflow instead:
  // PPTX goldens are only compared there, so this test pins the names, not the bytes).
  const slide = unzipEntry(emitPptx(laidOut, {rasterFonts: []}), 'ppt/slides/slide1.xml').toString();
  const own = [...slide.matchAll(/name="([^"]+)"/g)].map(m => m[1] as string)
    .filter(name => name === 'bpmn' || /^(lane|task|event|gateway|box|text): /.test(name)).sort();
  assert.deepEqual(own, ['box: Customer', 'box: Shop', 'box: yes', 'bpmn', 'event: Done [e]', 'event: Order [s]',
    'gateway: In stock [g]', 'lane: Customer [cust]', 'lane: Shop [shop]', 'task: Check stock [chk]',
    'text: Done', 'text: In stock', 'text: Order']);
  // --node-ids: the task node is named, events and gateways are not
  const svg = (await renderDiagram(diagram({theme: 'blue', title: 't'}).add(aliasFigure()), {name: 't.svg', budget: 'cacheOnly', nodeIds: true})).svg;
  assert.deepEqual([...svg.matchAll(/data-node="([^"]+)"/g)].map(m => m[1]), ['chk']);
  // locations: every node is an entry; a task frame is snapped, an event rect is raw
  captureSourceLocations(true);
  try {
    const located = await checkDiagram(diagram({theme: 'blue', title: 't'}).add(aliasFigure()));
    const map = locationsMap(located.laidOut, 'fig.ts',
      {sourceSha256: 's', configSha256: 'c', noSourceLine: true, depsSha256: 'd', tool: 'test'},
      () => ({loc: {file: 'fig.ts', line: 1, column: 1}, via: []}));
    assert.deepEqual(map.parts.filter(p => p.node).map(p => p.node).sort(), ['chk', 'e', 'g', 's']);
    const def = placedDefinitionOf(placed);
    const taskIdx = placed.nodes.findIndex((_, i) => placed.anchors[i]?.id === 'chk');
    const eventIdx = placed.nodes.findIndex((_, i) => placed.anchors[i]?.id === 's');
    assert.equal(def?.locations?.drawsFrame?.(placed, taskIdx), true);
    assert.equal(def?.locations?.drawsFrame?.(placed, eventIdx), false);
  } finally {
    captureSourceLocations(false);
  }
});

test('(b) via stays undescribed (byte identity) while cols: auto is described (M1)', async () => {
  const alias = aliasFigure(), auto = autoBandOf(autoFigure());
  assert.equal(describeSwimlaneFigure(alias), undefined);
  assert.equal(describeSwimlaneAuto(auto), 'レーン: Customer、Shop。手順: Order、Check stock、In stock、Done');
  assert.equal(describeSwimlaneFigure(auto), 'レーン: Customer、Shop。手順: Order、Check stock、In stock、Done');
  const timed = swimlane(LANES, [{id: 'a', lane: 'cust', title: 'A'}])[0];
  assert.ok(timed?.type === 'swimlane' && timed.arrange !== 'auto');
  assert.equal(describeSwimlaneFigure(timed), 'レーン: Customer、Shop。手順: A');
  const [svgAlias, svgAuto] = await Promise.all([svgOf(alias), svgOf(autoFigure())]);
  assert.doesNotMatch(svgAlias, /<desc[ >]/);
  assert.match(svgAuto, /<desc[^>]*>レーン: Customer、Shop。手順: Order、Check stock、In stock、Done<\/desc>/);
});

test('(c) via does not count for one-story (M2)', async () => {
  const timed = (title: string) => swimlane(LANES, [{id: title, lane: 'cust', title}]);
  const rulesOf = async (bands: unknown[]) =>
    (await checkDiagram(diagram({theme: 'blue'}).add(...(bands.flat() as never[])))).verdict.findings.map(f => f.rule);
  const twoAliases = await rulesOf([aliasFigure(), bpmn(LANES, [{id: 'n', lane: 'cust', label: 'N'}], [])]);
  assert.deepEqual(twoAliases.filter(r => r === 'bpmn-deprecated').length, 2);
  assert.ok(!twoAliases.includes('one-story'), 'two aliases: no one-story');
  assert.ok((await rulesOf([timed('a'), autoFigure()])).includes('one-story'), 'timed + cols:auto counts two stories');
  assert.ok(!(await rulesOf([timed('a'), aliasFigure()])).includes('one-story'), 'timed + alias counts one story');
});

test("(d) an auto figure's content is not walked, and legend: auto reads it like a bpmn figure (M3)", async () => {
  assert.deepEqual(nestedBandsOf(autoBandOf(autoFigure())), []);
  const toneItems = async (...bands: unknown[]) => {
    const {laidOut} = await checkDiagram(diagram({theme: 'blue', legend: 'auto'}).add(...(bands as never[])));
    const l = laidOut.laidOut.find(b => b.type === 'legend') as LaidOutLegend | undefined;
    return (l?.items ?? []).map(i => i.tone ?? (i.line ? `line:${i.line}` : '?'));
  };
  const byAlias = await toneItems(bpmn([{id: 'l1', label: 'L1'}, {id: 'l2', label: 'L2'}],
    [{id: 'a', lane: 'l1', label: 'A', tone: 'removed'}, {id: 'b', lane: 'l2', label: 'B'}],
    [{from: 'a', to: 'b', line: 'dashed'}]));
  const byAuto = await toneItems(swimlane([{id: 'l1', label: 'L1'}, {id: 'l2', label: 'L2'}],
    [{id: 'a', lane: 'l1', title: 'A', tone: 'removed'}, {id: 'b', lane: 'l2', title: 'B'}],
    {cols: 'auto', flows: [{from: 'a', to: 'b', line: 'dashed'}]}));
  assert.deepEqual([...byAlias].sort(), ['line:dashed', 'line:solid', 'removed']);
  assert.deepEqual(byAuto, byAlias);
  // focus runs on the nodes like a bpmn figure's
  const [focused] = swimlane([{id: 'l', label: 'L'}],
    [{id: 's', lane: 'l', kind: 'start', title: 'S'}, {id: 't', lane: 'l', title: 'T'}, {id: 'g', lane: 'l', kind: 'xor', title: 'G'}, {id: 'u', lane: 'l', title: 'U'}],
    {cols: 'auto', flows: [{from: 's', to: 't'}, {from: 't', to: 'g'}, {from: 'g', to: 'u'}], focus: 'g'});
  assert.ok(focused?.type === 'swimlane' && focused.arrange === 'auto');
  assert.deepEqual(focused.nodes.map(n => n.tone), ['muted', 'accent', 'solid', 'accent']);
  assert.deepEqual(focused.focused, ['g']);
});

test('(e) bpmn-deprecated warns, and the 3 alias examples are accepted (M4)', async () => {
  const {verdict} = await checkDiagram(diagram({theme: 'blue'}).add(aliasFigure()));
  assert.deepEqual(verdict.findings.filter(f => f.rule === 'bpmn-deprecated').map(f => [f.severity, f.message]), [
    ['warn', '`bpmn()` は非推奨です。`swimlane()` に `kind` と `cols: \'auto\'` を書いてください（ADR 0086）'],
  ]);
  const {verdict: autoVerdict} = await checkDiagram(diagram({theme: 'blue'}).add(...autoFigure()));
  assert.ok(!autoVerdict.findings.some(f => f.rule === 'bpmn-deprecated'), 'no warn without via');
  // the repository accepts the rule for the 3 alias examples, kept as byte-identity evidence
  const root = path.join(import.meta.dirname, '..');
  const config = JSON.parse(fs.readFileSync(path.join(root, '.svg-diagram.json'), 'utf8')) as {accept: Record<string, string>};
  assert.equal(config.accept['bpmn-deprecated'], '別名のバイト一致の証拠として v1.0 まで残す');
  for (const name of ['bpmn.ts', 'bpmn-vertical.ts', 'bpmn-shrink.ts']) {
    const d = await loadDiagram(path.join(root, 'examples', name), loadConfig(path.join(root, 'examples')));
    const hit = (await checkDiagram(d)).verdict.findings.find(f => f.rule === 'bpmn-deprecated');
    assert.ok(hit, name);
    assert.equal(hit.severity, 'info', `${name}: accepted`);
  }
});

test('(f) raw {type: bpmn} data throws saying how to rebuild it (m3)', async () => {
  await assert.rejects(
    checkDiagram({bands: [{type: 'bpmn', lanes: LANES, nodes: [{id: 'n', lane: 'cust', label: 'N'}], flows: []}]} as never),
    /帯「bpmn」のデータは描けなくなりました。`bpmn\(\)` か `swimlane\({cols: 'auto'}\)` で作り直してください（ADR 0086）/,
  );
});

test('D1: explicit columns refuse kind and dir', () => {
  assert.throws(() => swimlane(LANES, [{id: 'a', lane: 'cust', kind: 'xor', title: 'A'}]), /step "a" has kind 'xor': add cols: 'auto' or drop kind/);
  assert.throws(() => swimlane(LANES, [{id: 'a', lane: 'cust', title: 'A'}], {dir: 'v'}), /dir needs cols: 'auto'/);
  assert.throws(() => swimlane(LANES, [{id: 'a', lane: 'cust', title: 'A'}], {dir: 'x' as never}), /dir must be 'h' or 'v'/);
  // dir: 'h' is the documented default: accepted and ignored on explicit columns
  const [h] = swimlane(LANES, [{id: 'a', lane: 'cust', title: 'A'}], {dir: 'h'});
  assert.ok(h?.type === 'swimlane' && h.arrange !== 'auto' && !('dir' in h));
  // explicit columns report no ids, as before
  assert.deepEqual(swimlaneDefinition.ids?.(h), []);
  assert.throws(() => swimlane(LANES, [{id: 'a', lane: 'cust', title: 'A'}], {cols: 'x' as never}), /cols must be 'auto'/);
  // kind: 'task' on explicit columns is the box step it always was
  const [timed] = swimlane(LANES, [{id: 'a', lane: 'cust', kind: 'task', title: 'A'}]);
  assert.ok(timed?.type === 'swimlane' && timed.arrange !== 'auto');
});

test('D1: an auto step takes id/lane/kind/title/body/icon/iconTone/tone only', () => {
  const step = (extra: object) => () => swimlane(LANES, [{id: 'a', lane: 'cust', title: 'A', ...extra}], {cols: 'auto', flows: []});
  for (const key of ['col', 'span', 'row', 'reveal', 'until']) {
    assert.throws(step({[key]: 1}), new RegExp(`step "a" has ${key}, which needs explicit columns`), key);
  }
  for (const [key, value] of [['tag', 'T'], ['note', 'N'], ['size', 20], ['padX', 4], ['dashed', true], ['step', 1], ['lines', [{text: 'L'}]]] as const) {
    assert.throws(step({[key]: value}), new RegExp(`step "a" has ${key}; with cols: 'auto' a step takes`), key);
  }
  assert.throws(step({kind: 'timer'}), /step "a" has kind timer \(use task \| start \| end \| xor \| and \| or\)/);
  assert.throws(step({title: ['A', em.accent('B')]}), /step "a" title must be a plain string/);
  assert.throws(step({body: ['b', em.b('c')]}), /step "a" body must be a plain string/);
  assert.throws(step({tone: 'foo'}), /step "a" has tone foo/);
  assert.throws(step({kind: 'xor', icon: 'user'}), /step "a" is a xor event\/gateway; only a task takes an icon/);
  assert.throws(step({iconTone: 'accent'}), /step "a" has iconTone but no icon/);
  assert.throws(() => swimlane([] as SwimlaneLane[], [{id: 'a', lane: 'cust', title: 'A'}], {cols: 'auto', flows: []}), /needs at least one lane/);
  assert.throws(() => swimlane(LANES, [], {cols: 'auto', flows: []}), /needs at least one step/);
});

test('D1: an auto flow takes from/to/label/line only, and auto figures refuse timed opts', async () => {
  const flow = (extra: object) => () => swimlane(LANES,
    [{id: 'a', lane: 'cust', title: 'A'}, {id: 'b', lane: 'shop', title: 'B'}],
    {cols: 'auto', flows: [{from: 'a', to: 'b', ...extra}]});
  for (const key of ['chip', 'labelAt', 'bend', 'bendOffset', 'arrow', 'tone']) {
    assert.throws(flow({[key]: key === 'labelAt' ? 0.5 : key === 'bendOffset' ? 8 : key === 'tone' ? 'accent' : key === 'bend' ? 'auto' : key === 'arrow' ? 'both' : true}),
      new RegExp(`flow a -> b has ${key}; with cols: 'auto' a flow takes from, to, label, line only`), key);
  }
  assert.throws(() => swimlane(LANES,
    [{id: 'a', lane: 'cust', title: 'A'}, {id: 'b', lane: 'shop', title: 'B'}],
    {cols: 'auto', flows: [{from: 'a:right', to: 'b'}]}), /'id:side@t' needs explicit columns/);
  for (const line of ['dotted', 'double']) {
    assert.throws(flow({line}), new RegExp(`flow a -> b has line ${line} \\(use solid \\| dashed\\)`), line);
  }
  // a task step without a title says `title` (a step's word), not `label` (the alias's word for a node)
  await assert.rejects(svgOf(swimlane(LANES, [{id: 't', lane: 'cust'}], {cols: 'auto', flows: []})),
    /swimlane\(\): task "t" needs a title/);
  const opts = (extra: object) => () => swimlane(LANES, [{id: 'a', lane: 'cust', title: 'A'}], {cols: 'auto', flows: [], ...extra});
  assert.throws(opts({phases: [{label: 'P', from: 1, to: 1}]}), /phases needs explicit columns/);
  assert.throws(opts({boundaries: [{after: 'cust'}]}), /boundaries needs explicit columns/);
  assert.throws(opts({labelW: 100}), /labelW needs explicit columns/);
  assert.throws(opts({colGap: 40}), /colGap needs explicit columns/);
  assert.throws(opts({dir: 'x'}), /dir must be 'h' or 'v'/);
  assert.throws(opts({dir: 'v', fit: 'shrink'}), /takes its column width from the lanes/);
  assert.throws(opts({fit: 'auto'}), /fit must be 'shrink'/);
});

test("laneOrder: 'auto' orders an auto figure's lanes by its flows", async () => {
  const lanesBad = [{id: 'c', label: 'Warehouse'}, {id: 'a', label: 'Customer'}, {id: 'b', label: 'Shop'}];
  const steps: {id: string; lane: string; kind?: 'task' | 'start' | 'end' | 'xor' | 'and' | 'or'; title: string}[] = [
    {id: 's', lane: 'a', kind: 'start', title: 'Order'},
    {id: 'chk', lane: 'b', title: 'Check stock'},
    {id: 'g', lane: 'b', kind: 'xor', title: 'In stock'},
    {id: 'ship', lane: 'c', title: 'Ship'},
    {id: 'e', lane: 'c', kind: 'end', title: 'Done'},
  ];
  const flows = [
    {from: 's', to: 'chk'}, {from: 'chk', to: 'g'}, {from: 'g', to: 'ship', label: 'yes'},
    {from: 'ship', to: 'e'},
  ];
  const a = swimlane(lanesBad, steps, {cols: 'auto', flows, laneOrder: 'auto'});
  const [bandA] = a;
  assert.ok(bandA?.type === 'swimlane' && bandA.arrange === 'auto');
  const order = bandA.lanes.map(l => l.id).join(',');
  assert.ok(['a,b,c', 'c,b,a'].includes(order), `reordered to an optimum, got ${order}`);
  const handOrdered = order.split(',').map(id => ({id, label: lanesBad.find(l => l.id === id)!.label}));
  const [svgA, svgB, svgC] = await Promise.all([
    svgOf(a),
    svgOf(swimlane(handOrdered, steps, {cols: 'auto', flows})),
    svgOf(swimlane(lanesBad, steps, {cols: 'auto', flows})),
  ]);
  assert.equal(svgA, svgB, 'laneOrder:auto draws exactly the hand-ordered figure');
  assert.notEqual(svgC, svgA, 'control: without laneOrder the bad order draws differently');
  const {verdict} = await checkDiagram(diagram({theme: 'blue', title: 't'}).add(...a));
  assert.deepEqual(verdict.problems, []);
  assert.deepEqual(verdict.warnings, []);
});

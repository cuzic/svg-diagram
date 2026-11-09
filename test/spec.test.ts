// A diagram as JSON (lib/spec.ts): the input of a caller that must not run a source file. The checks that matter: it draws what the DSL draws,
// it says where a mistake is, and nothing outside the schema reaches a builder.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import * as pure from '../lib/dsl-pure.ts';
import {build as bundle} from 'esbuild';
import {closeMeasurer, diagram, flowchart, renderDiagram, sequence} from '../lib/dsl.ts';
import {MEMO_LIMIT, currentMeasure, measureAtoms, measureMemoSize} from '../lib/measure.ts';
import {xmlProblems} from '../lib/xml-check.ts';
import {installResolveHook} from '../lib/resolve-hook.ts';
import {MAX_EMOJI, MAX_ISSUES, MAX_SWIMLANE_COLS, MAX_TOTAL_TEXT, SpecError, locateMessage, locateVerdict, partCatalog, specSchema, specToDiagram, validateSpec} from '../lib/spec.ts';
import {MAX_PNG_PIXELS, lintMessages, lintRendering, renderSpec, svgToPng} from '../lib/spec-render.ts';
import type {Diagram} from '../lib/types/index.ts';

test.after(() => closeMeasurer());

const ROOT = path.resolve(import.meta.dirname, '..');
const svgOf = async (d: Diagram) => (await renderDiagram(d, {name: 'x.svg', budget: 'cacheOnly'})).svg;
const spec = (...parts: unknown[]) => ({version: 1, title: '例', parts});
const flow = {type: 'flowchart', nodes: [{id: 'a', label: '開始'}, {id: 'b', label: '終了'}], edges: [{from: 'a', to: 'b'}]};
const pathsOf = (input: unknown) => validateSpec(input).map(i => i.path);

test('a flowchart spec draws the same SVG as the DSL', async () => {
  const nodes = [{id: 's', kind: 'terminator', label: '受付'}, {id: 'q', kind: 'decision', label: '在庫はある？'}, {id: 'a', label: '発送する', sub: '当日'}] as const;
  const edges = [{from: 's', to: 'q'}, {from: 'q', to: 'a', label: 'Yes'}];
  const dsl = diagram({theme: 'teal', title: '注文'}).add(flowchart(nodes, edges));
  const json = specToDiagram({version: 1, title: '注文', theme: 'teal', parts: [{type: 'flowchart', nodes, edges}]});
  assert.equal(await svgOf(json), await svgOf(dsl as unknown as Diagram));
});

test('the service-blueprint example, written as a spec, draws the same SVG', async () => {
  installResolveHook();
  const {default: define} = await import(path.join(ROOT, 'examples/service-blueprint.ts')) as {default: () => Diagram};
  const json = specToDiagram({version: 1, title: 'ミールキット宅配の注文（架空の例）', parts: [{
    type: 'swimlane',
    lanes: [{id: 'ev', label: '物的証拠', tone: 'muted'}, {id: 'cust', label: '顧客の行動'}, {id: 'front', label: '表の業務（接点）'}, {id: 'back', label: '裏の業務'}, {id: 'sys', label: '支援システム', tone: 'muted'}],
    steps: [
      {lane: 'ev', title: 'アプリの画面', col: 1}, {lane: 'ev', title: '配達の箱とチラシ', col: 3},
      {id: 'c1', lane: 'cust', title: '献立を選ぶ', col: 1}, {id: 'c2', lane: 'cust', title: '注文を確定する'}, {id: 'c3', lane: 'cust', title: '箱を受け取る', tag: '待ち'},
      {id: 'f1', lane: 'front', title: '注文を受け付ける', col: 2}, {id: 'f2', lane: 'front', title: '配達員が手渡す', col: 3},
      {id: 'b1', lane: 'back', title: '食材を小分けする', col: 2, tag: '失敗点'},
      {id: 's1', lane: 'sys', title: '在庫・注文の管理', col: 2, span: 2},
    ],
    boundaries: [{between: ['cust', 'front'], label: '相互作用線'}, {between: ['front', 'back'], label: '可視線'}, {between: ['back', 'sys'], label: '内部相互作用線'}],
    flows: [{from: 'c1', to: 'c2'}, {from: 'c2', to: 'c3'}, {from: 'c2', to: 'f1'}, {from: 'f1', to: 'b1'}, {from: 'b1', to: 'f2'}, {from: 'f2', to: 'c3'}, {from: 's1', to: 'b1'}],
    phases: [{label: '注文', from: 1, to: 2}, {label: '受け取り', from: 3, to: 3}],
  }]});
  assert.equal(await svgOf(json), await svgOf(define()));
});

test('a sequence spec draws the same SVG as the DSL', async () => {
  const actors = [{id: 'u', label: '利用者'}, {id: 'api', label: 'API'}];
  const steps = [{divider: '認証'}, {from: 'u', to: 'api', label: 'ログインする'}, {self: 'api', label: '検証する'}, {note: '30 分で失効', over: ['api']}, {from: 'api', to: 'u', label: 'トークン', line: 'dashed'}];
  const dsl = diagram({theme: 'blue', title: '例'}).add(sequence(actors as never, steps as never));
  assert.equal(await svgOf(specToDiagram(spec({type: 'sequence', actors, steps}))), await svgOf(dsl as unknown as Diagram));
});

test('every example of the catalog is valid and draws without a problem', async () => {
  for (const {type, example} of partCatalog()) {
    assert.deepEqual(validateSpec(spec(example)), [], type);
    const r = await renderSpec(spec(example));
    assert.deepEqual(r.problems, [], type);
    assert.equal(r.ok, true, type);
    assert.match(r.svg ?? '', /^<svg\b/, type);
  }
});

test('a mistake is reported at its place', () => {
  assert.deepEqual(pathsOf({title: '例', parts: [flow]}), ['version']);
  assert.deepEqual(pathsOf(spec({...flow, extra: 1})), ['parts[0].extra']);
  assert.deepEqual(pathsOf(spec({type: 'bpmn'})), ['parts[0].type']);
  assert.deepEqual(pathsOf(spec({...flow, nodes: [{id: 'a', label: 3}, {id: 'b', label: '終'}]})), ['parts[0].nodes[0].label']);
  assert.deepEqual(pathsOf(spec({...flow, edges: [{from: 'a', to: 'z'}]})), ['parts[0].edges[0].to']);
  assert.deepEqual(pathsOf(spec({...flow, nodes: [{id: 'a', label: '一'}, {id: 'a', label: '二'}], edges: []})), ['parts[0].nodes[1].id']);
  assert.deepEqual(pathsOf(spec({type: 'sequence', actors: [{id: 'u', label: '人'}], steps: [{note: '注', over: ['x']}]})), ['parts[0].steps[0].over[0]']);
  assert.deepEqual(pathsOf(spec({type: 'sequence', actors: [{id: 'u', label: '人'}], steps: [{label: '形が無い'}]})), ['parts[0].steps[0]']);
  assert.deepEqual(pathsOf(spec({type: 'swimlane', lanes: [{id: 'l', label: '人'}], steps: [{id: 's', lane: 'l', title: '手順'}], flows: [{from: 'nope:right', to: 's'}]})), ['parts[0].flows[0].from']);
});

test('what the schema does not list is refused, and specToDiagram throws for it before any builder', () => {
  for (const bad of [{...spec(flow), sourceDir: '/etc'}, spec({type: 'image', src: '/etc/passwd'}), spec({type: 'raw', svg: '<script/>'})]) assert.throws(() => specToDiagram(bad), SpecError);
  // the features that read a file or need a dev server are not fields of a spec
  assert.deepEqual(pathsOf({...spec(flow), slide: 1}), ['slide']);
  assert.deepEqual(pathsOf({...spec(flow), fill: true}), ['fill']);
  assert.deepEqual(pathsOf({...spec(flow), sourceDir: '/etc'}), ['sourceDir']);
  assert.deepEqual(pathsOf(spec({type: 'image', src: '/etc/passwd'})), ['parts[0].type']);
  assert.deepEqual(pathsOf(spec({type: 'raw', svg: '<script/>'})), ['parts[0].type']);
  // JSON.parse makes these own keys; a lookup on a plain object would find Object.prototype's
  assert.deepEqual(pathsOf(JSON.parse('{"version":1,"title":"例","parts":[],"__proto__":{"x":1}}')), ['parts', '__proto__']);
  assert.deepEqual(pathsOf({...spec(flow), constructor: 'x'}), ['constructor']);
  assert.deepEqual(pathsOf(spec({type: 'constructor'})), ['parts[0].type']);
});

test('text cannot break out of the SVG, in any text field of any part', async () => {
  const x = '<script>a</script>"/><image href="x"/>&amp;';
  const specs = [
    spec({type: 'flowchart', nodes: [{id: x, label: x, sub: x}, {id: 'b', label: x, kind: 'decision'}], edges: [{from: x, to: 'b', label: x}], dir: 'right'}),
    spec({type: 'swimlane', lanes: [{id: x, label: x}, {id: 'l', label: x}], steps: [{id: 's', lane: x, title: x, body: x, note: x, tag: x}, {id: 't', lane: 'l', title: x, col: 2}], flows: [{from: 's', to: 't', label: x}], phases: [{label: x, from: 1, to: 2}], boundaries: [{after: x, label: x}]}),
    spec({type: 'sequence', actors: [{id: x, label: x}, {id: 'b', label: x}], steps: [{from: x, to: 'b', label: x}, {self: 'b', label: x}, {note: x, over: ['b']}, {divider: x}]}),
    {...spec(flow), title: x, desc: x, sourceLine: x, showTitle: true},
  ];
  let drawn = 0;
  for (const s of specs) {
    const r = await renderSpec(s);
    if (r.svg === null) continue; // too crowded to draw is fine; drawn wrong is not
    drawn++;
    assert.doesNotMatch(r.svg, /<script|<image/);
    assert.deepEqual(xmlProblems(r.svg), []);
  }
  assert.ok(drawn >= 2, 'at least some of these must have been drawn');
});

test('oversized input is refused before it is laid out', () => {
  const nodes = Array.from({length: 41}, (_, i) => ({id: `n${i}`, label: 'x'}));
  assert.deepEqual(pathsOf(spec({type: 'flowchart', nodes, edges: []})), ['parts[0].nodes']);
  assert.deepEqual(pathsOf(spec({...flow, nodes: [{id: 'a', label: 'あ'.repeat(121)}, {id: 'b', label: '終'}]})), ['parts[0].nodes[0].label']);
  assert.deepEqual(pathsOf(spec(...Array.from({length: 5}, () => flow))), ['parts']);
  const wide = (p: number) => ({type: 'sequence', actors: [{id: `u${p}`, label: '人'}], steps: Array.from({length: 50}, () => ({self: `u${p}`, label: 'あ'.repeat(120)}))});
  const issues = validateSpec(spec(wide(0), wide(1)));
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.path, '');
  assert.match(issues[0]?.message ?? '', new RegExp(`limit is ${MAX_TOTAL_TEXT}`));
});

test('a flow end must be well-formed: no NaN reaches the drawing', async () => {
  const lane = (from: string, stepId = 's') => spec({type: 'swimlane', lanes: [{id: 'a', label: '人'}], steps: [{id: stepId, lane: 'a', title: '一'}, {id: 't', lane: 'a', title: '二'}], flows: [{from, to: 't'}]});
  for (const bad of ['s:right@x', 's:bogus', 's:right@9', 's:right@-1', 's:', ':right']) assert.deepEqual(pathsOf(lane(bad)), ['parts[0].flows[0].from'], bad);
  for (const good of ['s', 's:right', 's:right@0.5', 's:bottom@1', 's:center']) assert.deepEqual(validateSpec(lane(good)), [], good);
  assert.deepEqual(pathsOf(lane('a:b', 'a:b')).includes('parts[0].steps[0].id'), true);
  const r = await renderSpec(lane('s:right@0.5'));
  assert.doesNotMatch(r.svg ?? '', /NaN/);
});

test('a character that cannot be drawn is refused at its field, and renderSpec does not throw for it', async () => {
  const labelled = (label: string) => spec({...flow, nodes: [{id: 'a', label}, {id: 'b', label: '終'}]});
  for (const c of ['\u0001', '\n', '\ufffe', '\uffff', '\ud800']) {
    assert.deepEqual(pathsOf(labelled(`x${c}y`)), ['parts[0].nodes[0].label'], JSON.stringify(c));
    const r = await renderSpec(labelled(`x${c}y`));
    assert.equal(r.svg, null);
    assert.equal(r.issues[0]?.path, 'parts[0].nodes[0].label');
  }
  assert.deepEqual(validateSpec(labelled('絵文字 😀 も可')), []);
  const r = await renderSpec({...spec(flow), sourceLine: 'a\nb'});
  assert.equal(r.issues[0]?.path, 'sourceLine');
  assert.deepEqual(xmlProblems('<svg>\uffff</svg>').length, 1);
});

test('a figure that cannot be laid out comes back as an issue at its own part, not an exception', async () => {
  const seq = {type: 'sequence', actors: [{id: 'u', label: '人'}], steps: [{self: 'u', label: '確認'}]};
  const n = 40, wide = {type: 'flowchart', nodes: Array.from({length: n}, (_, i) => ({id: `n${i}`, label: '処理の内容を説明する文章です'})), edges: Array.from({length: 60}, (_, i) => ({from: `n${i % n}`, to: `n${(i * 7 + 3) % n}`}))};
  const r = await renderSpec(spec(seq, wide));
  assert.equal(r.ok, false);
  assert.equal(r.svg, null);
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0]?.path, 'parts[1]');
  assert.match(r.issues[0]?.message ?? '', /flowchart\(\).*does not fit/s);
});

test('a swimlane stays within the columns it has room for, and says so before layout', () => {
  const steps = (n: number) => Array.from({length: n}, (_, i) => ({id: `s${i}`, lane: 'a', title: '手順'}));
  const lane = (s: unknown[]) => spec({type: 'swimlane', lanes: [{id: 'a', label: '人'}], steps: s});
  assert.deepEqual(validateSpec(lane(steps(MAX_SWIMLANE_COLS))), []);
  assert.deepEqual(pathsOf(lane(steps(MAX_SWIMLANE_COLS + 1))), ['parts[0].steps']);
  assert.deepEqual(pathsOf(lane([{id: 's', lane: 'a', title: '手順', col: MAX_SWIMLANE_COLS + 1}])), ['parts[0].steps[0].col']);
  assert.match(validateSpec(lane(steps(12)))[0]?.message ?? '', /same col/);
});

test('boundaries are checked against the lane order, at the boundary', () => {
  const lane = (boundaries: unknown[]) => spec({type: 'swimlane', lanes: [{id: 'a', label: '一'}, {id: 'b', label: '二'}, {id: 'c', label: '三'}], steps: [{id: 's', lane: 'a', title: '手順'}], boundaries});
  assert.deepEqual(pathsOf(lane([{between: ['a', 'c']}])), ['parts[0].boundaries[0].between']);
  assert.deepEqual(pathsOf(lane([{between: ['b', 'a']}])), ['parts[0].boundaries[0].between']);
  assert.deepEqual(pathsOf(lane([{after: 'c'}])), ['parts[0].boundaries[0].after']);
  assert.deepEqual(validateSpec(lane([{between: ['a', 'b']}, {after: 'b'}])), []);
});

test('a spec with too many emoji is refused: they are what makes a picture slow', () => {
  const emoji = (n: number) => spec({...flow, nodes: [{id: 'a', label: '😀'.repeat(n)}, {id: 'b', label: '終'}]});
  assert.deepEqual(validateSpec(emoji(MAX_EMOJI)), []);
  const issues = validateSpec(emoji(MAX_EMOJI + 1));
  assert.equal(issues.length, 1);
  assert.match(issues[0]?.message ?? '', /emoji/);
});

test('the list of issues is bounded, however bad the spec', () => {
  const many = {...spec(flow), ...Object.fromEntries(Array.from({length: 25_000}, (_, i) => [`k${i}`, 1]))};
  const issues = validateSpec(many);
  assert.equal(issues.length, MAX_ISSUES + 1);
  assert.match(issues[MAX_ISSUES]?.message ?? '', /24980 more/);
});

test('a label with no room is reported at its flow, with advice in the fields of a spec', async () => {
  const r = await renderSpec(spec({type: 'swimlane', lanes: [{id: 'a', label: '人'}], steps: [{id: 's', lane: 'a', title: '申請する', col: 1}, {id: 't', lane: 'a', title: '確認する', col: 2}], flows: [{from: 's', to: 't', label: '承認された'}]}));
  assert.equal(r.ok, false);
  const p = r.problems[0];
  assert.equal(p?.path, 'parts[0].flows[0].label');
  assert.doesNotMatch(p?.message ?? '', /route|elbow/);
  assert.match(p?.fix ?? '', /colGap/);
});

test('colGap makes room for a short label between neighbouring columns', async () => {
  const lane = (extra: object) => spec({type: 'swimlane', lanes: [{id: 'a', label: '人'}], steps: [{id: 's', lane: 'a', title: '申請する', col: 1}, {id: 't', lane: 'a', title: '確認する', col: 2}], flows: [{from: 's', to: 't', label: '可'}], ...extra});
  assert.equal((await renderSpec(lane({}))).ok, false);
  assert.equal((await renderSpec(lane({colGap: 48}))).ok, true);
});

test('a step id with a flow-end character is refused', () => {
  assert.deepEqual(pathsOf(spec({type: 'swimlane', lanes: [{id: 'a', label: '人'}], steps: [{id: 'x@y', lane: 'a', title: '手順'}]})), ['parts[0].steps[0].id']);
});

test('a figure taller than the limit is refused, whatever the schema allowed', async () => {
  const r = await renderSpec(spec(flow), {maxHeight: 50});
  assert.equal(r.svg, null);
  assert.match(r.issues[0]?.message ?? '', /limit is 50px/);
});

test('svgToPng refuses a scale or a size that would allocate too much, before allocating', async () => {
  const small = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>';
  for (const scale of [0, -1, 4.5, Number.NaN]) await assert.rejects(svgToPng(small, {scale}), RangeError, String(scale));
  const side = Math.ceil(Math.sqrt(MAX_PNG_PIXELS)) + 1;
  await assert.rejects(svgToPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}"/>`), RangeError);
  // sizes that look small, or are not what a simple reader finds first
  for (const root of ['<svg width="3e4" height="3e4" viewBox="0 0 1 1"/>', '<svg width="300in" height="300in"/>', '<!-- <svg width="1" height="1"> --><svg width="3e4" height="3e4"/>', '<svg viewBox="0 0 30000 30000"/>', '<!DOCTYPE svg><svg width="1" height="1"/>']) await assert.rejects(svgToPng(root), RangeError, root);
});

test('a machine failure throws, instead of telling the caller to change the spec', async () => {
  await assert.rejects(renderSpec(spec(flow), {config: {measure: 'font', fonts: {sans: {regular: '/nonexistent.ttf', bold: '/nonexistent.ttf'}}}}));
});

test('renderSpec leaves the process-wide measuring settings alone', async () => {
  const before = currentMeasure();
  await renderSpec(spec(flow), {config: {measure: 'font'}});
  assert.deepEqual(currentMeasure(), before);
});

test('the same ids in two parts, phases past the columns, and a message to oneself are caught by validateSpec', () => {
  assert.deepEqual(pathsOf(spec(flow, flow)), ['parts[1].nodes[0].id', 'parts[1].nodes[1].id']);
  const lane = (phases: unknown[]) => spec({type: 'swimlane', lanes: [{id: 'a', label: '人'}], steps: [{id: 's', lane: 'a', title: '一'}, {id: 't', lane: 'a', title: '二'}], phases});
  assert.deepEqual(pathsOf(lane([{label: '期', from: 2, to: 1}])), ['parts[0].phases[0].to']);
  assert.deepEqual(pathsOf(lane([{label: '期', from: 1, to: 9}])), ['parts[0].phases[0].to']);
  assert.deepEqual(validateSpec(lane([{label: '期', from: 1, to: 2}])), []);
  assert.deepEqual(pathsOf(spec({type: 'sequence', actors: [{id: 'u', label: '人'}], steps: [{from: 'u', to: 'u', label: '自分へ'}]})), ['parts[0].steps[0].to']);
});

test('lanes and actors may repeat between parts: only anchors must be unique', async () => {
  const lane = (s: string) => ({type: 'swimlane', lanes: [{id: 'a', label: '人'}], steps: [{id: s, lane: 'a', title: '手順'}]});
  const seq = {type: 'sequence', actors: [{id: 'a', label: '人'}], steps: [{self: 'a', label: '確認'}]};
  const r = await renderSpec(spec(lane('s1'), lane('s2'), seq, seq));
  assert.deepEqual(r.issues, []);
  assert.equal(r.ok, true);
});

test('the width memo stops growing at its limit', async () => {
  await measureAtoms(Array.from({length: MEMO_LIMIT + 50}, (_, i) => `memo-${i}`), {size: 14});
  assert.equal(measureMemoSize(), MEMO_LIMIT);
});

test('a finding names the place of the text it is about', async () => {
  // the arrow labels of this figure sit a few pixels past the diamond: an advisory that does not fail it
  const r = await renderSpec(spec(partCatalog().find(p => p.type === 'flowchart')?.example));
  assert.equal(r.ok, true);
  const yes = r.findings.find(f => f.message.includes('"Yes"'));
  assert.equal(yes?.path, 'parts[0].edges[1].label');
});

test('locateMessage reads only quoted text, and says nothing when the text is ambiguous', () => {
  const one = spec(flow), two = spec(flow, {type: 'sequence', actors: [{id: 'user', label: '利用者さん'}], steps: [{self: 'user', label: '確認の処理を実行する'}]});
  assert.equal(locateMessage(two, 'box "利用者さん" is too wide'), 'parts[1].actors[0].label');
  assert.equal(locateMessage(two, '判断「user」から'), 'parts[1].actors[0].id');
  assert.equal(locateMessage(two, 'nothing here is named'), null);
  assert.equal(locateMessage(two, 'user is a word of the message, not a mention'), null);
  assert.equal(locateMessage(two, 'text out of its box: "確認の処理を実…"'), 'parts[1].steps[0].label'); // shortened by the check
  assert.equal(locateMessage(two, 'text out of its box: "処理を"'), 'parts[1].steps[0].label'); // one wrapped line
  assert.equal(locateMessage(one, 'nothing here is named'), 'parts[0]');
  // the same label on two arrows of one part: the part, not the first arrow
  const yes = spec({...flow, edges: [{from: 'a', to: 'b', label: 'Yes'}, {from: 'b', to: 'a', label: 'Yes'}]}, flow);
  assert.equal(locateMessage(yes, 'text "Yes"'), 'parts[0]');
  // the message's own quoted words first, an id later
  assert.equal(locateMessage(two, '「Yes / No」と "利用者さん"'), 'parts[1].actors[0].label');
});

test('locateVerdict keeps each message, its rule and its fix, and adds the place', () => {
  const v = {ok: false, problems: ['"開始" overflows'], warnings: [], findings: [{rule: 'r', severity: 'warn' as const, message: '"終了" is far', data: {measured: 1, threshold: 0, fix: 'move it'}}]};
  assert.deepEqual(locateVerdict(spec(flow), v), {
    problems: [{path: 'parts[0].nodes[0].label', message: '"開始" overflows', severity: 'problem'}],
    findings: [{path: 'parts[0].nodes[1].label', message: '"終了" is far', rule: 'r', severity: 'warn', fix: 'move it'}],
  });
});

test('lintMessages separates what fails the lint from what it only advises', () => {
  const {errors, advisories} = lintMessages({
    contrast: [{txt: 'a', delta: 1, fg: '#fff', bg: '#fff'}], overflow: {dx: 2, dy: 0}, textOverlap: [{a: 'x', b: 'y', ratio: 0.5}],
    containerOverflow: [{txt: 'b', over: 4}], covered: [{txt: 'c', by: 'rect', how: 'crosses'}],
  });
  assert.deepEqual(errors, ['low contrast: "a" (#fff on #fff)', 'content runs past the canvas by 2px horizontally and 0px vertically', 'text over text: "x" and "y"']);
  assert.deepEqual(advisories, ['text out of its box by 4px: "b"', '"c" is crossed by rect']);
});

test('figures drawn at the same time come out as when drawn one by one', async () => {
  const specs = partCatalog().map(p => spec(p.example));
  const config = {measure: 'font'} as const;
  const alone: (string | null)[] = [];
  for (const s of specs) alone.push((await renderSpec(s, {config})).svg);
  const together = await Promise.all([...specs, ...specs].map(s => renderSpec(s, {config})));
  assert.deepEqual(together.map(r => r.svg), [...alone, ...alone]);
});

test('lintRendering and svgToPng work on a string, without a file', async () => {
  const r = await renderSpec(spec(flow));
  assert.ok(r.svg);
  const checks = lintRendering(r.svg);
  assert.deepEqual(checks?.contrast, []);
  assert.equal(checks?.overflow, null);
  const {png, width} = await svgToPng(r.svg, {scale: 2});
  assert.equal(width, r.width * 2);
  assert.deepEqual([...png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
});

test('the spec entry reaches no node: module, directly or through what it imports', async () => {
  const out = await bundle({entryPoints: [path.join(ROOT, 'lib/spec.ts')], bundle: true, write: false, metafile: true, format: 'esm', platform: 'browser', logLevel: 'silent'});
  const imports = Object.values(out.metafile.outputs).flatMap(o => o.imports.map(i => i.path));
  assert.deepEqual(imports.filter(i => i.startsWith('node:')), []);
});

// A new builder must be decided on: add it to lib/spec.ts, or say here that specs do not have it yet.
const IN_NO_SPEC_YET = new Set(['affinity', 'analyzeCausalLoops', 'analyzeCriticalPath', 'arrowDiagram', 'banner', 'barplot', 'bars', 'bowtie', 'box', 'boxplot', 'bpmn', 'bracket', 'branch', 'bubble', 'burndown', 'burnup', 'butterfly', 'callout', 'canvas', 'caption', 'catplot', 'causalLoop', 'causeTree', 'cell', 'checkSheet', 'chevron', 'classDiagram', 'cloud', 'clustermap', 'combo', 'concentric', 'connect', 'controlChart', 'curve', 'cycle', 'dependencyNetwork', 'diagram', 'displot', 'dots', 'ecdfplot', 'emblem', 'facet', 'faultTree', 'fillScaleLimit', 'fmea', 'funnel', 'gantt', 'grid', 'group', 'harvey', 'heatmap', 'hero', 'hist2d', 'histogram', 'histplot', 'iconRow', 'isIsNot', 'isIsNotTests', 'isType', 'jointplot', 'journeyMap', 'kde2d', 'kdeplot', 'legend', 'lines', 'matrix', 'mekko', 'mindmap', 'node', 'pairplot', 'pareto', 'pdpc', 'people', 'pert', 'plane', 'pointplot', 'pyramid', 'qfd', 'quadrant', 'raci', 'radar', 'rangeBars', 'raw', 'regplot', 'relationDiagram', 'residplot', 'rewrite', 'row', 'rugplot', 'sankey', 'scatter', 'screens', 'spacer', 'stackedBars', 'stat', 'stateDiagram', 'stateMatrix', 'stateRow', 'steps', 'strategyCanvas', 'stripplot', 'styled', 'swarmplot', 'table', 'tally', 'timeline', 'tornado', 'transitionUnits', 'tree', 'treemap', 'valueChain', 'venn', 'versus', 'violinplot', 'waterfall', 'when', 'whyWhyTable', 'whyWhyTree', 'wireframe', 'within', 'wordart', 'xbarR']);

test('every builder is either in the spec or listed as not in it yet', () => {
  const inSpec = new Set(partCatalog().map(p => p.type));
  const builders = Object.entries(pure).filter(([, v]) => typeof v === 'function').map(([k]) => k);
  assert.deepEqual(builders.filter(b => !inSpec.has(b) && !IN_NO_SPEC_YET.has(b)), [], 'decide these in lib/spec.ts or IN_NO_SPEC_YET');
  assert.deepEqual([...inSpec].filter(t => IN_NO_SPEC_YET.has(t)), []);
});

test('the schema is plain JSON', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(specSchema)), specSchema);
});

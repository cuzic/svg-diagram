import test from 'node:test';
import assert from 'node:assert/strict';
import {bars, box, checkDiagram, closeMeasurer, diagram, group, renderDiagram, row, stateDiagram} from '../lib/dsl.ts';

test.after(() => closeMeasurer());

const textsOf = async (b: ReturnType<typeof bars>) => (await renderDiagram(diagram({theme: 'blue', title: 't'}).add(b), {name: 't', budget: 'measure'})).svg;

test('bars: whole numbers are written exactly (1055 is not 1060) (#98)', async () => {
  const svg = await textsOf(bars([{label: 'A', value: 1055}, {label: 'B', value: 1234}, {label: 'C', value: 7}], {}));
  assert.match(svg, />1055</);
  assert.match(svg, />1234</);
  assert.doesNotMatch(svg, />1060</);
  // a fraction keeps its whole part too (3 significant digits would make 1055.5 into 1060)
  const frac = await textsOf(bars([{label: 'A', value: 1055.5}, {label: 'B', value: 0.01234}], {}));
  assert.match(frac, />1056</);
  assert.match(frac, />0\.0123</);
  // a function's result is written as text even when it is not a string
  assert.match(await textsOf(bars([{label: 'A', value: 3}], {valueFormat: ((v: number) => v * 2) as never})), />6</);
});

test('bars: valueFormat exact / decimals / function (#98)', async () => {
  const data = [{label: 'A', value: 1055.25}, {label: 'B', value: 2}];
  assert.match(await textsOf(bars(data, {valueFormat: 'exact'})), />1055.25</);
  assert.match(await textsOf(bars(data, {valueFormat: 1})), />1055.3</);
  assert.match(await textsOf(bars(data, {valueFormat: v => `${v}件`})), />2件</);
  assert.throws(() => bars(data, {valueFormat: 9}), /valueFormat/);
});

test('stateDiagram: solid / solid-danger states draw white text; an unknown tone still throws (#97)', async () => {
  const d = diagram({theme: 'blue', title: 't'}).add(stateDiagram(
    [{id: 'a', label: '受付', sub: '主役', tone: 'solid'}, {id: 'b', label: '却下', tone: 'solid-danger'}, {id: 'c', label: '審査'}],
    [{from: 'a', to: 'c'}, {from: 'c', to: 'b'}, {from: 'b', to: 'a', label: '再提出'}, {from: 'c', to: 'a'}], {initial: 'a'}));
  const {svg} = await renderDiagram(d, {name: 't', budget: 'measure'});
  assert.match(svg, /fill="#ffffff">受付</);
  assert.match(svg, /fill="#ffffff">主役</);
  assert.match(svg, /fill="#ffffff">却下</);
  assert.throws(() => stateDiagram([{id: 'a', label: 'a', tone: 'bogus' as never}], []), /tone/);
  // an end state on a solid fill keeps its double outline: the inner ring is white, not the fill colour
  const fin = (await renderDiagram(diagram({theme: 'blue', title: 't'}).add(stateDiagram([{id: 'a', label: 'a'}, {id: 'z', label: '完了', tone: 'solid', final: true}], [{from: 'a', to: 'z'}])), {name: 't', budget: 'measure'})).svg;
  assert.match(fin, /rx="5" fill="([^"]+)" stroke="#ffffff"/);
  const r = await checkDiagram(d);
  assert.equal(r.verdict === undefined, false);
});

test('group: the gap of the row between groups is honoured; group({gap}) is an error (#100)', async () => {
  const d = diagram({theme: 'blue', width: 700, title: 't'}).add(row([group([box({title: 'A'})], {title: 'G1'}), group([box({title: 'B'})], {title: 'G2'})], {gap: 80}));
  const {svg} = await renderDiagram(d, {name: 't', budget: 'measure'});
  const frames = [...svg.matchAll(/<rect x="(\d+)" y="\d+" width="(\d+)" height="\d+" rx="8" fill="#f6f8fa"/g)].map(m => [Number(m[1]), Number(m[2])]);
  assert.equal(frames.length, 2);
  assert.equal(frames[1][0] - (frames[0][0] + frames[0][1]), 80);
  assert.throws(() => group([box({title: 'A'})], {gap: 40} as never), /no gap option/);
});

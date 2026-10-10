// node --test test/   — the rules must keep catching what they were written to catch.
import test from 'node:test';
import assert from 'node:assert/strict';
import {wcagRatio} from '../lib/tokens.mjs';
import {usedNotation, legendKeys, applyAutoLegend, edgeStats, lintDiagram, diagramTitle} from '../lib/rules.mjs';
import {diagram, caption, box, connect, legend, swimlane} from '../lib/dsl.mjs';

test('wcagRatio: black on white is 21:1, same colour is 1:1', () => {
  assert.equal(Math.round(wcagRatio('#000000', '#ffffff')), 21);
  assert.equal(wcagRatio('#777777', '#777777'), 1);
});

test('usedNotation: non-solid lines and non-plain tones need legend entries (and the plain line too)', () => {
  const bands = [box({id: 'a', title: 'a', tone: 'new'}), box({id: 'b', title: 'b'}), connect('a', 'b', {line: 'dashed'})];
  assert.deepEqual([...usedNotation(bands)].sort(), ['line:dashed', 'line:solid', 'tone:new']);
  assert.equal(usedNotation([box({title: 'x'}), connect('a', 'b')]).size, 0);
});

test("legend: 'auto' adds only what is missing, keeping existing entries", () => {
  const d = diagram({theme: 'blue', legend: 'auto', legendLabels: {'tone:new': '新規'}});
  d.add(box({id: 'a', title: 'a', tone: 'new'}), box({id: 'b', title: 'b'}), connect('a', 'b', {line: 'dashed'}), legend([{line: 'dashed', label: 'WS'}]));
  applyAutoLegend(d);
  const keys = legendKeys(d.bands);
  assert.ok(keys.has('line:dashed') && keys.has('tone:new') && keys.has('line:solid'));
  assert.equal(d.bands.filter(b => b.type === 'legend').length, 1);
  assert.equal(d.bands.find(b => b.type === 'legend').items.find(i => i.tone === 'new').label, '新規');
});

test('edgeStats: counts a crossing, ignores connectors that merely share an endpoint', () => {
  const c = (points, fromId, toId) => ({points, fromId, toId});
  const horizontal = c([{x: 0, y: 50}, {x: 100, y: 50}], 'a', 'b');
  const vertical = c([{x: 50, y: 0}, {x: 50, y: 100}], 'c', 'd');
  assert.equal(edgeStats([horizontal, vertical]).crossings, 1);
  const shared = c([{x: 0, y: 50}, {x: 100, y: 50}], 'a', 'z'); // overlaps `horizontal` but starts at the same box
  assert.equal(edgeStats([horizontal, shared]).overlaps, 0);
});

test('swimlane: suggests a lane order that shortens hand-offs, never moves a fixed lane', async () => {
  const d = diagram({theme: 'blue'});
  d.add(swimlane(
    [{id: 'x', label: 'X'}, {id: 'y', label: 'Y'}, {id: 'z', label: 'Z'}, {id: 'end', label: 'END', fixed: true}],
    [{id: 's1', lane: 'x', title: 's1'}, {id: 's2', lane: 'z', title: 's2'}, {id: 's3', lane: 'y', title: 's3'}, {id: 's4', lane: 'end', title: 's4'}],
    {flows: [{from: 's1', to: 's2'}, {from: 's2', to: 's3'}, {from: 's3', to: 's4'}]},
  ));
  // connects are resolved at layout time; fake the resolved ones the rule reads
  d.connects = [{fromId: 's1', toId: 's2', points: []}, {fromId: 's2', toId: 's3', points: []}, {fromId: 's3', toId: 's4', points: []}];
  const f = lintDiagram({...d, laidOut: [], connects: d.connects}).find(x => x.rule === 'swimlane-lane-order');
  assert.ok(f, 'a better order exists: X → Z → Y puts s2 and s3 in adjacent lanes only after reordering');
  assert.ok(f.message.endsWith('に減る') && f.message.includes('END'));
  assert.ok(f.message.indexOf('END') > f.message.indexOf('Y'), 'END stays last');
});

test('diagramTitle falls back to the first caption', () => {
  const d = diagram({theme: 'blue'});
  d.add(caption('見出し'), box({title: 'x'}));
  assert.equal(diagramTitle(d), '見出し');
  assert.equal(diagramTitle(diagram({theme: 'blue', title: '明示'})), '明示');
});

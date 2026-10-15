import test from 'node:test';
import './helpers/strict-width.ts'; // a label the layout did not register for measuring throws instead of measuring 0 wide
import assert from 'node:assert/strict';
import {checkDiagram, closeMeasurer, diagram, faultTree, renderDiagram} from '../lib/dsl.ts';
import type {LaidOutFta, FtaEvent} from '../lib/types/diagrams.ts';
import {ftaFindings} from '../lib/fta-rules.ts';
import {ftaResolve} from '../lib/fta.ts';

test.after(() => closeMeasurer());

const B = (label: string, extra: object = {}): FtaEvent => ({label, kind: 'basic', ...extra});
const tree = (): FtaEvent => ({
  label: 'top', gate: 'or',
  children: [
    {label: 'db', gate: 'and', children: [B('main'), B('standby', {id: 'sw'})]},
    {label: 'apps', gate: 'vote', k: 2, children: [B('a1'), B('a2'), B('a3')]},
    {label: 'net', gate: 'or', children: [{label: 'fibre', kind: 'undeveloped'}, {ref: 'sw'}]},
  ],
});
const laid = async (band: unknown, opts: object = {}) => {
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue', ...opts}).add(band as never));
  return {t: laidOut.laidOut.find(b => b.type === 'fta') as LaidOutFta, verdict};
};

test('faultTree(): mistakes in the tree throw, naming the event', () => {
  const bad = (top: FtaEvent, re: RegExp) => assert.throws(() => faultTree(top), re);
  bad({label: 'a'}, /needs a gate and children/);
  bad({label: 'a', gate: 'and', children: [B('b')], kind: 'basic'} as never, /takes no gate/);
  bad({label: 'a', gate: 'vote', children: [B('b'), B('c')]}, /needs k/);
  bad({label: 'a', gate: 'vote', k: 3, children: [B('b'), B('c')]}, /from 1 to the number of inputs \(2\)/);
  bad({label: 'a', gate: 'and', k: 1, children: [B('b')]}, /k is for a vote gate/);
  bad({label: 'a', gate: 'inhibit', children: [B('b'), B('c')], condition: {label: 'c'}}, /one input/);
  bad({label: 'a', gate: 'inhibit', children: [B('b')]}, /needs a condition/);
  bad({label: 'a', gate: 'and', children: [B('b')], condition: {label: 'c'}}, /condition is for an inhibit gate/);
  bad({label: 'a', gate: 'and', children: [{label: 'h', kind: 'house'}]}, /needs state/);
  bad({label: 'a', gate: 'and', children: [B('b', {p: 2})]}, /probability/);
  bad({label: 'a', gate: 'and', children: [B('b', {id: 'x'}), B('c', {id: 'x'})]}, /duplicate event id "x"/);
  bad({label: 'a', gate: 'and', children: [{ref: 'nope'}]}, /names no event/);
  bad({label: 'a', gate: 'and', children: [B('b'), {ref: 'g'}, {label: 'g', id: 'g', gate: 'or', children: [B('x'), B('y')]}]}, /repeats an event with a gate/);
  bad({label: 'a', gate: 'and', children: [B('b', {id: 'x'}), {ref: 'x', label: 'again'}]}, /takes no other field/);
  bad({label: 'a', gate: 'and', children: [{label: 'c', kind: 'condition'}]}, /only goes in the `condition`/);
  bad({label: 'a', gate: 'inhibit', children: [B('b', {id: 'b'})], condition: {ref: 'b'}}, /must be one/);
  assert.throws(() => faultTree(tree(), {maxNodeW: 'wide' as never}), /maxNodeW/);
});

test('ftaResolve(): a repeat is a second event with no id; the first keeps the id', () => {
  const {nodes} = ftaResolve(tree());
  const sw = nodes.filter(n => n.label === 'standby');
  assert.equal(sw.length, 2);
  assert.equal(sw.filter(n => n.id === 'sw').length, 1);
  assert.equal(sw.filter(n => n.copyOf === 'sw').length, 1);
});

test('faultTree() lays out: the top above its inputs, a gate under its event centre, every event inside the band, nothing overlaps', async () => {
  const {t, verdict} = await laid(faultTree(tree(), {id: 'f'}));
  assert.equal(verdict.problems.length, 0, verdict.problems.join('\n'));
  const top = t.nodes.find(n => n.kind === 'event' && t.labelBoxes[t.nodes.indexOf(n)].label === 'top')!;
  assert.ok(t.nodes.filter(n => n !== top).every(n => n.y > top.y + top.h), 'every other event lies below the top event');
  const topGate = t.gates.find(g => g.y > top.y)!;
  assert.ok(Math.abs(topGate.x + topGate.w / 2 - (top.x + top.w / 2)) < 1, 'the top gate sits under the centre of the top event');
  for (const n of t.nodes) assert.ok(n.x >= t.x - 0.5 && n.x + n.w <= t.x + t.w + 0.5 && n.y >= t.y - 0.5 && n.y + n.h <= t.y + t.h + 0.5, 'inside the band');
  for (let i = 0; i < t.nodes.length; i++) for (let j = i + 1; j < t.nodes.length; j++) {
    const a = t.nodes[i], b = t.nodes[j];
    assert.ok(!(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h), 'no two event boxes overlap');
  }
  assert.equal(t.anchors.filter(a => a.id === 'sw').length, 1, 'the repeat is not an anchor');
});

test('faultTree() draws gate shapes and symbols; the lines have no arrowheads; a band with an id still has its tree', async () => {
  const band = faultTree(tree(), {id: 'f'});
  assert.ok(band.root.children, 'the tree is not shadowed by the handle named top');
  const svg = (await renderDiagram(diagram({theme: 'blue'}).add(band) as never, {name: 'x.svg', budget: 'cacheOnly'})).svg;
  assert.ok(!svg.includes('<marker') && !svg.includes('<polygon'), 'no arrowheads (no marker, no polygon)');
  const {t} = await laid(band);
  assert.deepEqual(t.gates.map(g => g.gate).sort(), ['and', 'or', 'or', 'vote']);
  assert.equal(t.gates.find(g => g.gate === 'vote')?.label?.text, '2/3');
  assert.equal(t.marks.filter(m => m.kind === 'basic').length, 6);
  assert.equal(t.marks.filter(m => m.kind === 'undeveloped').length, 1);
  const paths = new Set(t.gates.map(g => g.gate));
  assert.equal(paths.size, 3);
});

test('faultTree() inhibit: the condition sits beside the gate, the input below; a house event says what it assumes', async () => {
  const {t, verdict} = await laid(faultTree({label: 'top', gate: 'inhibit', children: [B('in')], condition: {label: 'cond'}}, {id: 'g'}));
  assert.equal(verdict.problems.length, 0, verdict.problems.join('\n'));
  const gate = t.gates[0], cond = t.nodes.find((_, i) => t.labelBoxes[i].label === 'cond')!, input = t.nodes.find((_, i) => t.labelBoxes[i].label === 'in')!;
  assert.ok(cond.x >= gate.x + gate.w, 'the condition is to the right of the gate');
  assert.ok(input.y > gate.y + gate.h, 'the input is below the gate');
  assert.ok(t.marks.some(m => m.kind === 'condition'));
  const house = await laid(faultTree({label: 'top', gate: 'or', children: [{label: 'h', kind: 'house', state: false}, B('b')]}));
  assert.ok(house.t.texts.some(x => x.text.includes('発生しない')), 'the assumption is written under the house event');
});

test('faultTree() width: shrunk with a warning when left out, a note for auto, never when a number is written', async () => {
  const wide = (opts: object) => faultTree({label: 'top', gate: 'or', children: ['電源設備の故障による停止', '空調設備の故障による停止', '回線の事業者側の障害', '保守作業の手順の誤り', '設定変更の検証漏れ', '容量の見積りの誤り'].map(l => B(l))}, opts);
  const fit = async (opts: object) => (await checkDiagram(diagram({theme: 'blue'}).add(wide(opts)))).verdict.findings.filter(f => f.rule === 'auto-fit-applied');
  const left = await fit({});
  assert.equal(left.length, 1);
  assert.equal(left[0].severity, 'warn');
  assert.match(left[0].message, /maxNodeW: 'auto'/);
  const auto = await fit({maxNodeW: 'auto'});
  assert.equal(auto.length, 1);
  assert.equal(auto[0].severity, 'info');
  await assert.rejects(() => checkDiagram(diagram({theme: 'blue'}).add(wide({maxNodeW: 200}))), /does not fit/);
  const wideDiagram = (await checkDiagram(diagram({theme: 'blue', width: 1500}).add(wide({})))).verdict.findings.filter(f => f.rule === 'auto-fit-applied');
  assert.equal(wideDiagram.length, 0, 'a wide enough figure is not changed');
});

test('fta rules: findings of the tree, and their severity in check', async () => {
  const rules = (top: FtaEvent) => ftaFindings({root: top}).map(f => f.rule);
  assert.deepEqual(rules(tree()), ['fta-undeveloped-left']);
  assert.deepEqual(rules({label: 'a', gate: 'and', children: [B('b')]}), ['fta-gate-one-input']);
  assert.deepEqual(rules({label: 'a', gate: 'inhibit', children: [B('b')], condition: {label: 'c'}}), [], 'an inhibit gate has one input by definition');
  assert.deepEqual(rules({label: 'a', gate: 'vote', k: 1, children: [B('b'), B('c')]}), ['fta-vote-degenerate']);
  assert.deepEqual(rules({label: 'a', gate: 'vote', k: 2, children: [B('b'), B('c')]}), ['fta-vote-degenerate']);
  assert.deepEqual(rules({label: 'a', gate: 'vote', k: 2, children: [B('b'), B('c'), B('d')]}), []);
  assert.deepEqual(rules({label: 'a', kind: 'basic'}), ['fta-top-is-leaf']);
  const sev = async (opts: object, top: FtaEvent) => (await checkDiagram(diagram({theme: 'blue', ...opts}).add(faultTree(top)))).verdict.findings.filter(f => f.rule.startsWith('fta-'));
  const one: FtaEvent = {label: 'a', gate: 'and', children: [B('b')]};
  assert.ok((await sev({}, one)).every(f => f.severity === 'info'));
  assert.ok((await sev({rcaCheck: 'strict'}, one)).every(f => f.severity === 'warn'));
  const undeveloped = await sev({rcaCheck: 'strict'}, tree());
  assert.ok(undeveloped.length === 1 && undeveloped[0].severity === 'info', 'fta-undeveloped-left stays info under strict');
  const acc = await sev({rcaCheck: 'strict', accept: {'fta-gate-one-input': '1 入力の例'}}, one);
  assert.ok(acc.every(f => f.severity === 'info'));
});

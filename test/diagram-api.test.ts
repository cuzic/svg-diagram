// diagram().add() at run time (chaining, `this`, flattening, anchor collection) and the `accept` / `legendLabels`
// options flowing through to the rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import {diagram, box, banner, caption, row, grid, group, table, sequence, wireframe, screens, swimlane, connect, branch, legend, wf, checkDiagram, closeMeasurer} from '../lib/dsl.ts';
import {lintDiagram, applyAutoLegend, legendKeys, DEFAULT_LEGEND_LABELS, RULE_DOCS, walkBands} from '../lib/rules.ts';
import type {LegendBand, LegendItem, Finding} from '../lib/types.ts';

test.after(() => closeMeasurer());

test('add() returns the very same diagram (so calls chain), appends in order, and flattens arrays one level', () => {
  const d = diagram({theme: 'blue'});
  const a = box({id: 'a'}), b = box({id: 'b'}), c = caption('c'), s = swimlane([{id: 'l', label: 'L'}], [{id: 's', lane: 'l', title: 'S'}]);
  assert.equal(d.add(a), d);
  assert.equal(d.add(b, c).add(s), d);
  assert.equal(d.add([] as never), d, 'an empty array adds nothing');
  assert.equal(d.bands.length, 4);
  assert.deepEqual(d.bands.map(x => x.type), ['box', 'box', 'caption', 'swimlane']);
  assert.equal(d.bands[0], a, 'the band objects themselves are stored, not copies');
});

test('add() uses `this`: a detached call is bound to the receiver it is called on, and bands is a live view', () => {
  const d1 = diagram({theme: 'blue'}), d2 = diagram({theme: 'teal'});
  d1.add(box({id: 'x'}));
  assert.equal(d1.bands.length, 1);
  assert.equal(d2.bands.length, 0, 'diagrams do not share state');
  const r = d2.add.call(d2, box({id: 'y'}));
  assert.equal(r, d2);
  assert.equal(d2.bands.length, 1);
  assert.notEqual(d1.bands, d2.bands);
});

test('every kind of id-carrying band is a connect() anchor at run time (ids are collected at layout)', async () => {
  const d = diagram({theme: 'blue'});
  d.add(
    banner({id: 'ban', headline: 'H'}),
    row([box({id: 'r1', title: 'r1'}), box({id: 'r2', title: 'r2'})]),
    grid([box({id: 'g1', title: 'g1'}), box({id: 'g2', title: 'g2'})], {cols: 2}),
    group([box({id: 'in1', title: 'in'})], {id: 'zone', title: 'Z'}),
    table([{label: 'c'}], [['v']], {id: 'tbl'}),
    wireframe(wf.text('x'), {id: 'wire'}),
    sequence([{id: 'u', label: 'U'}, {id: 'v', label: 'V'}], [{from: 'u', to: 'v', label: 'x'}], {id: 'seq'}),
    screens([{id: 'sc1', root: wf.text('x'), at: [0, 0]}, {id: 'sc2', root: wf.text('y'), at: [0, 1]}]),
    swimlane([{id: 'dev', label: 'D'}], [{id: 'st1', lane: 'dev', title: 'a'}, {id: 'st2', lane: 'dev', title: 'b'}], {flows: [{from: 'st1', to: 'st2'}]}),
  );
  const ids = ['ban', 'r1', 'r2', 'g1', 'g2', 'in1', 'zone', 'tbl', 'wire', 'seq', 'sc1', 'sc2', 'st1', 'st2'];
  for (let i = 1; i < ids.length; i++) d.add(connect(ids[i - 1], ids[i]));
  d.add(branch('ban', [{to: 'tbl'}, {to: 'wire', label: 'w'}]));
  const r = await checkDiagram(d);
  // 13 chained + 2 branch + 1 swimlane flow
  assert.equal(r.laidOut.connects.length, 13 + 2 + 1);
  const hit = new Set(r.laidOut.connects.flatMap(c => [c.fromId, c.toId]));
  for (const id of ids) assert.ok(hit.has(id), `${id} was resolved as an anchor`);
});

test('walkBands visits bands nested in groups, rows, grids and swimlanes', () => {
  const sw = swimlane([{id: 'l', label: 'L'}], [{id: 's', lane: 'l', title: 'S'}]);
  const bands = [group([row([box({id: 'a'})]), grid([box({id: 'b'})], {cols: 1})]), ...sw];
  const seen = walkBands(bands as never);
  const types = seen.map(b => b.type);
  assert.deepEqual(types.filter(t => t === 'box').length, 3, 'row child, grid child and swimlane step are all boxes');
  assert.ok(types.includes('group') && types.includes('row') && types.includes('grid') && types.includes('swimlane'));
  assert.deepEqual(walkBands([]), []);
});

// ---- accept ------------------------------------------------------------------------------------------
const findingsOf = async (d: ReturnType<typeof diagram>): Promise<Finding[]> => (await checkDiagram(d)).verdict.findings;
const byRule = (fs: Finding[], rule: string) => fs.find(f => f.rule === rule);

test('accept: a finding of that rule becomes info with the reason; others keep their severity', async () => {
  const wide = () => { const d = diagram({theme: 'blue', width: 1200}); d.add(box({title: 'x'})); return d; }; // doc-width + a11y-no-title? (title absent: box title is a caption source? no)
  const before = byRule(await findingsOf(wide()), 'doc-width');
  assert.equal(before?.severity, 'warn');
  const accepted = wide(); accepted.accept = {'doc-width': '表の都合'};
  const f = byRule(await findingsOf(accepted), 'doc-width')!;
  assert.equal(f.severity, 'info');
  assert.ok(f.message.endsWith('（許容: 表の都合）'));
  assert.ok(f.message.startsWith(before!.message), 'the original message is kept');
});

test('accept: set through diagram({accept}) reaches lintDiagram for different rules', async () => {
  const mk = (accept?: Record<string, string>) => {
    const d = diagram({theme: 'blue', width: 1200, accept: accept as never});
    d.add(box({id: 'a', title: 'a'}), box({id: 'b', title: 'b'}), connect('a', 'b', {line: 'dashed'}));
    return d;
  };
  const plain = await findingsOf(mk());
  const rules = new Set(plain.filter(f => f.severity === 'warn').map(f => f.rule));
  assert.ok(rules.has('doc-width') && rules.has('legend-missing') && rules.has('a11y-no-title'), [...rules].join());
  const acc = await findingsOf(mk({'doc-width': 'w', 'legend-missing': 'l'}));
  assert.equal(byRule(acc, 'doc-width')!.severity, 'info');
  assert.equal(byRule(acc, 'legend-missing')!.severity, 'info');
  assert.equal(byRule(acc, 'a11y-no-title')!.severity, 'warn', 'a rule that was not accepted is untouched');
  assert.match(byRule(acc, 'legend-missing')!.message, /許容: l/);
});

test('accept: applies to lintDiagram called directly, including rules that fire from raw data', () => {
  const d = diagram({theme: 'blue', accept: {'one-story': '2 本で 1 話'}});
  d.add(...swimlane([{id: 'l', label: 'L'}], [{id: 's', lane: 'l', title: 'S'}]), ...swimlane([{id: 'm', label: 'M'}], [{id: 't', lane: 'm', title: 'T'}]));
  const f = lintDiagram({...d, laidOut: [], connects: []}).find(x => x.rule === 'one-story')!;
  assert.equal(f.severity, 'info');
  assert.match(f.message, /許容: 2 本で 1 話/);
  assert.equal(lintDiagram({...d, accept: undefined, laidOut: [], connects: []}).find(x => x.rule === 'one-story')!.severity, 'warn');
});

test('accept: an empty reason / unrelated rule id leaves findings alone; every RULE_DOCS key is a string key', () => {
  const d = diagram({theme: 'blue', accept: {'density': 'x'}});
  d.add(swimlane([{id: 'l', label: 'L'}], [{id: 's', lane: 'l', title: 'S'}]), swimlane([{id: 'm', label: 'M'}], [{id: 't', lane: 'm', title: 'T'}]) as never);
  const f = lintDiagram({...d, laidOut: [], connects: []}).find(x => x.rule === 'one-story')!;
  assert.equal(f.severity, 'warn');
  assert.ok(Object.keys(RULE_DOCS).every(k => RULE_DOCS[k as keyof typeof RULE_DOCS].length > 0));
});

// ---- legendLabels ------------------------------------------------------------------------------------
const labelsOf = (d: ReturnType<typeof diagram>) => Object.fromEntries((d.bands.find(b => b.type === 'legend') as LegendBand).items.map((i: LegendItem) => [i.tone ?? `line:${i.line}`, i.label]));

test("legend 'auto' uses legendLabels over DEFAULT_LEGEND_LABELS, per key, and falls back to the default", () => {
  const d = diagram({theme: 'blue', legend: 'auto', legendLabels: {'tone:new': '追加', 'tone:danger': '要注意'}});
  d.add(box({id: 'a', title: 'a', tone: 'new'}), box({id: 'b', title: 'b', tone: 'changed'}), box({id: 'c', title: 'c', tone: 'danger'}), connect('a', 'b'));
  applyAutoLegend(d);
  const l = labelsOf(d);
  assert.equal(l['new'], '追加');
  assert.ok(legendKeys(d.bands).has('tone:changed'));
  assert.equal(l['danger'], '要注意');
  assert.equal(l['changed'], DEFAULT_LEGEND_LABELS['tone:changed']);
});

test("legend 'auto' is not applied without the option, and does not duplicate an entry already listed", () => {
  const off = diagram({theme: 'blue'});
  off.add(box({id: 'a', tone: 'new', title: 'a'}));
  applyAutoLegend(off);
  assert.equal(off.bands.some(b => b.type === 'legend'), false);

  const on = diagram({theme: 'blue', legend: 'auto'});
  on.add(box({id: 'a', tone: 'new', title: 'a'}), legend([{tone: 'new', label: '手書き'}]));
  applyAutoLegend(on);
  assert.equal(on.bands.filter(b => b.type === 'legend').length, 1);
  assert.equal(labelsOf(on)['new'], '手書き', 'a hand-written entry wins over both the default and legendLabels');
  applyAutoLegend(on); // idempotent
  assert.equal((on.bands.find(b => b.type === 'legend') as LegendBand).items.length, 1);
});

test('legendLabels flow through checkDiagram: with legend auto there is no legend-missing / legend-incomplete warning', async () => {
  const d = diagram({theme: 'blue', title: 't', legend: 'auto', legendLabels: {'line:dashed': '非同期'}});
  d.add(box({id: 'a', title: 'a', tone: 'new'}), box({id: 'b', title: 'b'}), connect('a', 'b', {line: 'dashed'}));
  const {verdict, laidOut} = await checkDiagram(d);
  const fs = verdict.findings;
  assert.equal(fs.some(f => f.rule.startsWith('legend-')), false, JSON.stringify(fs));
  assert.equal(d.bands.some(b => b.type === 'legend'), false, 'the input is not changed');
  const l = (laidOut.bands.find(b => b.type === 'legend') as LegendBand).items;
  assert.ok(l.some(i => i.label === '非同期'));
});

test('legend: false declares that no legend is needed: legend-missing / legend-incomplete are not reported', async () => {
  const mk = (legendOpt?: false) => diagram({theme: 'blue', title: 't', ...(legendOpt === undefined ? {} : {legend: legendOpt})}).add(box({id: 'a', title: 'a', tone: 'danger'}), box({id: 'b', title: 'b', tone: 'accent'}), connect('a', 'b', {line: 'dashed'}));
  const rulesOf = async (d: ReturnType<typeof mk>) => new Set((await checkDiagram(d)).verdict.findings.map(f => f.rule));
  const bare = await rulesOf(mk());
  assert.ok(bare.has('legend-missing'), [...bare].join());
  const off = await rulesOf(mk(false));
  assert.ok(!off.has('legend-missing') && !off.has('legend-incomplete'), [...off].join());
  assert.throws(() => diagram({theme: 'blue', legend: true as never}), /diagram\(\{legend\}\) must be 'auto' or false/);
});

test('cjk-line-long: a long title or banner headline line is flagged, a short or line-broken one is not', async () => {
  const {fullWidthUnits} = await import('../lib/rules.ts');
  const {HEADLINE_PX} = await import('../lib/rules.ts');
  const {ROLES} = await import('../lib/tokens.ts');
  for (const [r, px] of Object.entries(HEADLINE_PX)) assert.equal(px, ROLES[r as keyof typeof ROLES], `HEADLINE_PX.${r} follows ROLES`);
  assert.equal(fullWidthUnits('あいabc'), 3.5);
  assert.equal(fullWidthUnits('ｱｲｳ'), 1.5, 'halfwidth katakana is half');
  assert.equal(fullWidthUnits('한국ＡＢ𠮷'), 5);
  const f = (...bands: any[]) => { const d = diagram({theme: 'blue', title: 't'}); for (const b of bands) d.add(b); return lintDiagram({...d, laidOut: [], connects: []}).filter(x => x.rule === 'cjk-line-long'); };
  assert.equal(f(caption('あ'.repeat(41), {role: 'title'})).length, 1);
  assert.equal(f(caption('あ'.repeat(40), {role: 'title'})).length, 0);
  assert.equal(f(caption('あ'.repeat(30) + '\n' + 'い'.repeat(30), {role: 'title'})).length, 0);
  assert.equal(f(banner({headline: 'あ'.repeat(38)})).length, 1);
  assert.equal(f(banner({headline: '短い見出し'})).length, 0);
  // under the budget but wrapped by a narrow diagram
  const narrow = await findingsOf(diagram({theme: 'blue', title: 't', legend: false, width: 320}).add(banner({headline: '承認待ちが三日から一日へ短くなった'})));
  assert.match(narrow.filter(x => x.rule === 'cjk-line-long').map(x => x.message).join(), /自動で折り返している/);
  const wide = await findingsOf(diagram({theme: 'blue', title: 't', legend: false}).add(banner({headline: '承認待ちが三日から一日へ短くなった'})));
  assert.ok(!wide.some(x => x.rule === 'cjk-line-long'));
});

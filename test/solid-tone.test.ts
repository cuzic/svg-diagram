import test from 'node:test';
import assert from 'node:assert/strict';
import {banner, box, checkDiagram, closeMeasurer, diagram, group, legend, renderDiagram, row, sequence, stat, swimlane, table} from '../lib/dsl.ts';
import {em} from '../lib/rich.ts';
import type {LaidOutLegend, LaidOutRow} from '../lib/dsl.ts';

test.after(() => closeMeasurer());

const WHITE = '#ffffff', ACCENT = '#1d5fa8', DANGER = '#b91c1c', MUTED = '#6f6659';
const make = (tone: 'solid' | 'solid-danger', extra: object = {}) => diagram({theme: 'blue', medium: 'doc', title: 'solid', legend: 'auto'}).add(
  row([
    box({title: '主役', body: '説明', note: '注', lines: ['一行目', {text: '二行目', bold: true}], tone, ...extra}),
    stat('76%', '導入前', {tone}),
  ]),
  banner({headline: '見出し', sub: '補足', tone}),
);

for (const tone of ['solid', 'solid-danger'] as const) {
  test(`${tone}: title / body / note / lines / stat / banner pass verify and the rules with no finding`, async () => {
    const {verdict, laidOut} = await checkDiagram(make(tone));
    assert.deepEqual(verdict.problems, []);
    assert.deepEqual(verdict.warnings, []);
    assert.deepEqual(verdict.findings.filter(f => f.severity !== 'info'), []);
    // every run is drawn white (note, stat label and banner sub default to muted on other tones)
    const r = laidOut.laidOut.find((b): b is LaidOutRow => b.type === 'row')!;
    for (const c of r.children) for (const run of c.wrappedRuns) assert.equal(run.tone, undefined, `${c.type} run "${run.text}"`);
  });

  test(`${tone}: the SVG draws every text white on the fill`, async () => {
    const {svg} = await renderDiagram(make(tone), {name: 'solid.svg', budget: 'cacheOnly'});
    const fill = tone === 'solid' ? ACCENT : DANGER;
    assert.match(svg, new RegExp(`<rect [^>]*fill="${fill}"`));
    const texts = [...svg.matchAll(/<text [^>]*fill="(#[0-9a-f]{6})"[^>]*>([^<]*)</g)].filter(m => ['主役', '説明', '注', '一行目', '二行目', '76%', '導入前', '見出し', '補足'].includes(m[2]!));
    const inBoxes = texts.filter(m => m[1] !== '#22201b'); // (the legend swatch label "主役" is page text)
    assert.equal(texts.length - inBoxes.length, tone === 'solid' ? 1 : 0, 'only the legend label (主役) is page text');
    assert.deepEqual(inBoxes.map(m => m[1]), Array(9).fill(WHITE));
  });
}

test('solid: a colour of its own on a run throws (it would be the fill, or dark on it); bold is fine', () => {
  for (const f of ['titleTone', 'bodyTone', 'noteTone', 'iconTone'] as const) {
    const bad = f === 'iconTone' ? {icon: 'check' as const, [f]: 'accent' as const} : {title: 'a', [f]: 'accent'};
    assert.throws(() => box({tone: 'solid', ...bad} as never), new RegExp(`${f} 'accent'`), f);
  }
  assert.throws(() => box({tone: 'solid', title: 'a', bodyTone: 'danger'}), /bodyTone 'danger'/);
  assert.throws(() => box({tone: 'solid-danger', title: 'a', noteTone: 'muted'}), /noteTone 'muted'/);
  assert.throws(() => box({tone: 'solid', lines: [{text: 'a', tone: 'muted'}]}), /lines\[0\]\.tone 'muted'/);
  assert.throws(() => box({tone: 'solid', body: ['a', em.accent('b')]}), /em\.accent\(\) in body/);
  assert.throws(() => box({tone: 'solid', lines: [{text: ['a', em.danger('b')]}]}), /em\.danger\(\) in lines\[0\]/);
  assert.throws(() => box({tone: 'solid', note: ['a', em.muted('b')]}), /em\.muted\(\) in note/);
  assert.throws(() => banner({headline: 'a', tone: 'solid', subTone: 'muted'}), /subTone 'muted'/);
  assert.throws(() => banner({headline: ['a', em.accent('b')], tone: 'solid'}), /em\.accent\(\) in headline/);
  assert.throws(() => swimlane([{id: 'l', label: 'L'}], [{id: 's', lane: 'l', title: 'a', tone: 'solid', titleTone: 'accent'}]), /swimlane\(\) step: .*titleTone/);
  assert.doesNotThrow(() => box({tone: 'solid', body: ['a', em.b('b')], lines: [{text: ['x', em.b('y')]}]}));
});

test('solid: the same options on a non-solid tone are untouched (note stays muted, explicit tones are fine)', async () => {
  const {laidOut} = await checkDiagram(diagram({theme: 'blue'}).add(box({title: 'a', note: 'n', tone: 'accent', bodyTone: 'danger', body: 'b'})));
  const b = laidOut.laidOut.find(x => x.type === 'box')!;
  assert.deepEqual(b.wrappedRuns.map(r => r.tone), [undefined, 'danger', 'muted']);
});

test('solid: a dimmed (spotlight) solid box is white with muted text, the dim branch before the white text', async () => {
  const d = diagram({theme: 'blue', medium: 'doc', title: 't', legend: 'auto', spotlight: {ids: ['other']}}).add(row([
    box({id: 'main', title: '主役', body: '説明', note: '注', tone: 'solid', tag: '新規', step: 1}),
    box({id: 'other', title: '次点', tone: 'accent'}),
  ]));
  const {svg, verdict, laidOut} = await renderDiagram(d, {name: 'solid-dim.svg', budget: 'cacheOnly'});
  assert.deepEqual(verdict.problems, []);
  assert.deepEqual(verdict.warnings, []);
  const r = laidOut.laidOut.find((b): b is LaidOutRow => b.type === 'row')!;
  assert.equal(r.children[0]!.dim, true);
  const rects = [...svg.matchAll(/<rect [^>]*>/g)].map(m => m[0]);
  assert.ok(rects.some(x => x.includes(`fill="${WHITE}"`) && x.includes(`stroke="${MUTED}"`)), 'the dimmed box is a white box with a muted border');
  for (const text of ['主役', '説明', '注']) assert.match(svg, new RegExp(`fill="${MUTED}">${text}<`), text);
  assert.doesNotMatch(svg, new RegExp(`fill="${WHITE}">(主役|説明|注)<`), 'no white text on the white fill');
});

test('solid: the step badge and the tag pill get a white ring so they do not melt into the fill', async () => {
  const {svg, verdict} = await renderDiagram(diagram({theme: 'blue', medium: 'doc', title: 't'}).add(row([
    box({title: '主役', tone: 'solid', step: 1, tag: '新規'}),
    box({title: '次点', tone: 'accent', step: 2, tag: '新規'}),
  ])), {name: 'solid-badge.svg', budget: 'cacheOnly'});
  assert.deepEqual(verdict.problems, []);
  const badges = [...svg.matchAll(/data-badge[^>]*>\s*<circle [^>]*>/g)].map(m => m[0]);
  assert.equal(badges.length, 2);
  assert.match(badges[0]!, new RegExp(`stroke="${WHITE}"`));
  assert.doesNotMatch(badges[1]!, /stroke=/);
  const pills = [...svg.matchAll(/<rect [^>]*rx="12"[^>]*>/g)].map(m => m[0]);
  assert.equal(pills.length, 2);
  assert.match(pills[0]!, new RegExp(`stroke="${WHITE}"`));
  assert.doesNotMatch(pills[1]!, /stroke=/);
});

test('a11y-nontext-contrast: a tone with no border is judged by its fill against the page (no 1.0:1 false positive)', async () => {
  const {verdict} = await checkDiagram(make('solid'));
  assert.equal(verdict.findings.filter(f => f.rule === 'a11y-nontext-contrast').length, 0);
  // a tone whose border is weak is still reported
  const weak = await checkDiagram(diagram({theme: 'blue', medium: 'doc', title: 't'}).add(box({title: 'a', tone: 'new'}), box({title: 'b', tone: 'removed'})));
  assert.ok(weak.verdict.findings.every(f => f.rule !== 'a11y-nontext-contrast' || /new|removed/.test(f.message)));
});

test('solid is for box / banner / stat / swimlane step / legend only: group, table, sequence and lanes throw', () => {
  assert.throws(() => group([box({title: 'a'})], {tone: 'solid' as never}), /group\(\): tone 'solid'/);
  assert.throws(() => group([box({title: 'a'})], {tone: 'solid-danger' as never}), /group\(\)/);
  assert.throws(() => table([{label: 'a'}], [['x']], {tone: 'solid' as never}), /table\(\): tone 'solid'/);
  assert.throws(() => table([{label: 'a'}], [['x'], {cells: ['y'], tone: 'solid' as never}]), /table\(\) row 1: tone 'solid'/);
  assert.throws(() => sequence([{id: 'a', label: 'A', tone: 'solid' as never}, {id: 'b', label: 'B'}], []), /sequence\(\) actor "a"/);
  assert.throws(() => sequence([{id: 'a', label: 'A'}], [{note: 'n', over: 'a', tone: 'solid-danger' as never}]), /sequence\(\) note/);
  assert.throws(() => swimlane([{id: 'l', label: 'L', tone: 'solid' as never}], []), /swimlane\(\) lane "l"/);
  assert.doesNotThrow(() => swimlane([{id: 'l', label: 'L'}], [{id: 's', lane: 'l', title: 'a', tone: 'solid'}]));
});

test('legend: a solid box is "主役", and accent reads as "次点" in a diagram that has one', async () => {
  const d = diagram({theme: 'blue', medium: 'doc', title: 't', legend: 'auto', accept: {'gray-tone-collision': 'the legend wording is under test, not the greys'}}).add(row([
    box({title: '主役', tone: 'solid'}), box({title: '次点', tone: 'accent'}), box({title: '強い異常', tone: 'solid-danger'}), box({title: 'その他'}),
  ]));
  const {laidOut, verdict} = await checkDiagram(d);
  const lg = laidOut.laidOut.find((b): b is LaidOutLegend => b.type === 'legend')!;
  assert.deepEqual(lg.items.map(i => [i.tone, i.label]), [['solid', '主役'], ['accent', '次点'], ['solid-danger', '異常(強)']]);
  assert.deepEqual(verdict.warnings, []);
});

test('legend: without a solid box accent stays "強調"; legendLabels wins over the automatic "次点"', async () => {
  const plain = await checkDiagram(diagram({theme: 'blue', medium: 'doc', title: 't', legend: 'auto'}).add(row([box({title: 'a', tone: 'accent'}), box({title: 'b', tone: 'solid-danger'})])));
  assert.deepEqual((plain.laidOut.laidOut.find((b): b is LaidOutLegend => b.type === 'legend')!).items.map(i => i.label), ['強調', '異常(強)']);
  const custom = await checkDiagram(diagram({theme: 'blue', medium: 'doc', title: 't', legend: 'auto', legendLabels: {'tone:accent': '準主役', 'tone:solid': '本命'}}).add(row([box({title: 'a', tone: 'accent'}), box({title: 'b', tone: 'solid'})])));
  assert.deepEqual((custom.laidOut.laidOut.find((b): b is LaidOutLegend => b.type === 'legend')!).items.map(i => i.label), ['準主役', '本命']);
});

test('legend: an item with a solid tone is accepted, and legend-missing names the effective label', async () => {
  const d = diagram({theme: 'blue', medium: 'doc', title: 't'}).add(row([box({title: 'a', tone: 'solid'}), box({title: 'b', tone: 'accent'})]));
  const {verdict} = await checkDiagram(d);
  const msg = verdict.warnings.find(w => w.includes('legend-missing'))!;
  assert.match(msg, /tone:solid（.*凡例の例: 主役）/);
  assert.match(msg, /tone:accent（.*凡例の例: 次点）/);
  const ok = await checkDiagram(diagram({theme: 'blue', medium: 'doc', title: 't'}).add(row([box({title: 'a', tone: 'solid'}), box({title: 'b', tone: 'accent'})]), legend([{tone: 'solid', label: '主役'}, {tone: 'accent', label: '次点'}])));
  assert.equal(ok.verdict.warnings.some(w => w.includes('legend')), false);
});

test("legend: 'auto' with a tone that has no label throws a clear error instead of a TypeError", async () => {
  const d = diagram({theme: 'blue', medium: 'doc', title: 't', legend: 'auto'}).add({...box({title: 'a'}), tone: 'bogus'} as never);
  await assert.rejects(checkDiagram(d), /no legend label for "tone:bogus" — add it to legendLabels/);
});

test('solid: a swimlane step takes it, and the output stays clean', async () => {
  const d = diagram({theme: 'blue', medium: 'doc', title: 't'}).add(...swimlane(
    [{id: 'a', label: 'A'}, {id: 'b', label: 'B'}],
    [{id: 's1', lane: 'a', title: '一', body: '本文', note: '注', tone: 'solid'}, {id: 's2', lane: 'b', title: '二', tone: 'accent'}],
    {flows: [{from: 's1', to: 's2'}]},
  ));
  const {verdict} = await checkDiagram(d);
  assert.deepEqual(verdict.problems, []);
  assert.equal(verdict.findings.filter(f => f.rule.startsWith('a11y')).length, 0);
});

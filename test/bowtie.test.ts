import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {bowtie, checkDiagram, closeMeasurer, diagram, renderDiagram} from '../lib/dsl.ts';
import type {LaidOutBowtie} from '../lib/types/diagrams.ts';

test.after(() => closeMeasurer());

const INPUT = {
  hazard: '顧客データ', top: '個人情報の漏えい',
  threats: [{label: '不正アクセス', barriers: ['多要素認証', 'アクセス制限']}, {label: '誤送信', barriers: ['宛先の確認']}],
  consequences: [{label: '信用の低下', barriers: ['広報対応']}, {label: '賠償', barriers: ['保険']}, {label: '行政処分', barriers: ['届出']}],
};
const laid = async (band: unknown, opts: object = {}) => {
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue', title: 'ボウタイ', ...opts}).add(band as never));
  return {t: laidOut.laidOut.find(b => b.type === 'bowtie') as LaidOutBowtie, verdict};
};
const boxOf = (t: LaidOutBowtie, label: string) => t.nodes[t.labelBoxes.findIndex(b => b.label === label)];

test('bowtie(): mistakes throw, naming the part', () => {
  assert.throws(() => bowtie({...INPUT, top: ''}), /top is the text/);
  assert.throws(() => bowtie({...INPUT, hazard: ' '}), /hazard is text/);
  assert.throws(() => bowtie({...INPUT, threats: []}), /threats needs at least one/);
  assert.throws(() => bowtie({...INPUT, consequences: []}), /consequences needs at least one/);
  assert.throws(() => bowtie({...INPUT, threats: [{label: ''}]}), /threats 1 needs a label/);
  assert.throws(() => bowtie({...INPUT, threats: [{label: 'a', barriers: ['']}]}), /barrier 1 needs text/);
  assert.throws(() => bowtie(INPUT, {maxNodeW: 10}), /maxNodeW/);
});

test('layout: threats left of the top event, consequences right, the top event in the middle, each row\'s barriers in the order of the flow', async () => {
  const {t, verdict} = await laid(bowtie(INPUT, {id: 'bt', maxNodeW: 'auto'}));
  assert.equal(verdict.problems.length, 0, verdict.problems.join('\n'));
  const top = boxOf(t, '個人情報の漏えい'), threat = boxOf(t, '不正アクセス'), cons = boxOf(t, '賠償');
  assert.ok(threat.x + threat.w < top.x && top.x + top.w < cons.x);
  const first = boxOf(t, '多要素認証'), second = boxOf(t, 'アクセス制限');
  assert.ok(threat.x + threat.w <= first.x && first.x + first.w <= second.x && second.x + second.w <= top.x, 'threat, then its barriers in order, then the top event');
  assert.equal(threat.y + threat.h / 2, first.y + first.h / 2, 'a row is on one line');
  const mit = boxOf(t, '広報対応');
  assert.ok(top.x + top.w <= mit.x && mit.x + mit.w <= boxOf(t, '信用の低下').x, 'the top event, then the mitigating barrier, then the consequence');
  const hazard = boxOf(t, '顧客データ');
  assert.ok(hazard.y + hazard.h < t.knot.cy && t.knot.cy < top.y, 'hazard, knot, top event from the top down');
  assert.ok(Math.abs(hazard.x + hazard.w / 2 - (top.x + top.w / 2)) < 1 && Math.abs(t.knot.cx - (top.x + top.w / 2)) < 1, 'they share a centre line');
  assert.ok(t.nodes.every(n => n.x >= t.x - 0.5 && n.x + n.w <= t.x + t.w + 0.5 && n.y >= t.y - 0.5 && n.y + n.h <= t.y + t.h + 0.5), 'everything inside the band');
});

test('layout: the side with fewer rows is spread over the height (the 2 threats against 3 consequences), no two boxes overlap', async () => {
  const {t} = await laid(bowtie(INPUT, {maxNodeW: 'auto'}));
  const a = boxOf(t, '不正アクセス'), b = boxOf(t, '誤送信');
  assert.ok(a.y + a.h < b.y, 'rows are apart');
  const mid = (n: {y: number; h: number}) => n.y + n.h / 2;
  assert.ok(Math.abs((mid(a) + mid(b)) / 2 - (t.y + t.h / 2)) < 1, 'the two rows are centred on the three');
  for (let i = 0; i < t.nodes.length; i++) for (let j = i + 1; j < t.nodes.length; j++) {
    const p = t.nodes[i], q = t.nodes[j];
    assert.ok(p.x + p.w <= q.x || q.x + q.w <= p.x || p.y + p.h <= q.y || q.y + q.h <= p.y, `${t.labelBoxes[i].label} / ${t.labelBoxes[j].label} overlap`);
  }
});

test('drawing: the knot is a circle, not an ellipse; the flow has arrowheads; the band is the same without hazard', async () => {
  const svg = (await renderDiagram(diagram({theme: 'blue', title: 'x'}).add(bowtie(INPUT, {maxNodeW: 'auto'}) as never), {name: 'x.svg', budget: 'cacheOnly'})).svg;
  assert.equal((svg.match(/<circle /g) ?? []).length, 1);
  assert.ok(!/<ellipse/.test(svg));
  assert.ok((svg.match(/ z" fill=/g) ?? []).length >= 5, 'arrowheads where the flow goes on');
  const {t} = await laid(bowtie({top: INPUT.top, threats: INPUT.threats, consequences: INPUT.consequences}, {maxNodeW: 'auto'}));
  assert.ok(!t.labelBoxes.some(b => b.label === '顧客データ'));
});

test('width: a figure wider than the diagram is narrowed with a warning; maxNodeW "auto" says so as info; a number is never narrowed', async () => {
  const wide = {top: '頂上', threats: [{label: '脅威', barriers: ['バリア 1 の説明を長めに', 'バリア 2 の説明を長めに']}], consequences: [{label: '結果', barriers: ['バリア 3 の説明を長めに']}]};
  const fit = (v: {findings: {rule: string; severity: string}[]}) => v.findings.filter(f => f.rule === 'auto-fit-applied');
  const a = fit((await laid(bowtie(wide))).verdict);
  assert.ok(a.length === 1 && a[0].severity === 'warn');
  const b = fit((await laid(bowtie(wide, {maxNodeW: 'auto'}))).verdict);
  assert.ok(b.length === 1 && b[0].severity === 'info');
  await assert.rejects(() => laid(bowtie(wide, {maxNodeW: 200})), /bowtie\(\)/);
});

test('rca: a threat or a consequence with no barrier; info by default, warn under rcaCheck: strict', async () => {
  const bare = bowtie({top: '頂上', threats: [{label: '脅威 A'}, {label: '脅威 B', barriers: ['防ぐ']}], consequences: [{label: '結果', barriers: []}]});
  const f = async (opts: object) => (await laid(bare, opts)).verdict.findings.filter(x => x.rule === 'bowtie-barrier-missing');
  const lax = await f({});
  assert.ok(lax.length === 2 && lax.every(x => x.severity === 'info'));
  assert.match(lax[0].message, /脅威 A/);
  assert.ok((await f({rcaCheck: 'strict'})).every(x => x.severity === 'warn'));
  assert.ok((await f({rcaCheck: 'strict', accept: {'bowtie-barrier-missing': '調査中'}})).every(x => x.severity === 'info'));
  const ok = await laid(bowtie(INPUT, {maxNodeW: 'auto'}), {rcaCheck: 'strict'});
  assert.equal(ok.verdict.problems.length, 0, ok.verdict.problems.join('\n'));
  assert.deepEqual(ok.verdict.findings.filter(x => x.severity === 'warn'), []);
});

test('rows keep their gap, a side with fewer rows is spread over the same height, consequences end at the right edge, a row near the top event runs straight into it', async () => {
  const {t} = await laid(bowtie(INPUT, {maxNodeW: 'auto'}));
  const cons = ['信用の低下', '賠償', '行政処分'].map(l => boxOf(t, l)), right = Math.max(...cons.map(c => c.x + c.w));
  assert.ok(cons.every(c => Math.abs(c.x + c.w - right) < 0.5), 'every consequence ends at the same right edge');
  const gaps = cons.slice(1).map((c, i) => c.y - (cons[i].y + cons[i].h));
  assert.ok(Math.abs(gaps[0] - gaps[1]) < 6 && gaps.every(g => g >= 19), 'the three rows are one ROW_GAP apart (at least)');
  const a = boxOf(t, '不正アクセス'), b = boxOf(t, '誤送信');
  assert.ok(b.y - (a.y + a.h) > gaps[0], 'two rows are spread wider than three');
});

test('a top event of more than three lines throws; without a hazard the knot is the first thing over the top event', async () => {
  await assert.rejects(() => laid(bowtie({...INPUT, top: 'とても長い頂上事象の説明。'.repeat(12)}, {maxNodeW: 'auto'})), /more than 3 lines/);
  const {t} = await laid(bowtie({top: INPUT.top, threats: INPUT.threats, consequences: INPUT.consequences}, {maxNodeW: 'auto'}));
  const top = boxOf(t, INPUT.top);
  assert.ok(t.knot.cy < top.y && t.knot.cy - t.knot.r >= t.y - 0.5);
});

test('a bow-tie with an id is laid out and reports its rule (no barrier on a side)', async () => {
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue', title: 'x'}).add(bowtie({top: 't', threats: [{label: 'a'}], consequences: [{label: 'b', barriers: ['m']}]}, {id: 'bt'})));
  assert.ok(laidOut.laidOut.some(b => b.type === 'bowtie'));
  assert.ok(verdict.findings.some(f => f.rule === 'bowtie-barrier-missing'));
});

// Wireframe parts for monitoring-style screens: states, fusion, robot status, insight, compare, controls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {wf, collectTextRequests, layoutWireframe} from '../lib/wireframe.ts';
import {wireframe} from '../lib/dsl.ts';
import {NO_TONES} from '../lib/tokens.ts';
import type {PrimRect, PrimText, WfEvidence, WfInsightOpts, WfState} from '../lib/types/wireframe-nodes.ts';
import type {LaidOutWireframe, WfRoot, WireframeOpts} from '../lib/types/wireframe.ts';

// a stand-in for the browser measurer: every character is 0.6em wide
const widthOf = (atom: string, size: number) => [...atom].length * size * 0.6;
const layout = (root: WfRoot, opts: Partial<WireframeOpts> = {}) => layoutWireframe({type: 'wireframe', root, h: 420, ...opts}, 0, 0, 900, widthOf, NO_TONES, 'phrase');
const isText = (p: {k: string}): p is PrimText => p.k === 'text';
const texts = (band: LaidOutWireframe) => band.prims.flatMap(p => p.k === 'badge' || p.k === 'pill' ? [p.label] : isText(p) ? [p.s] : []);

test('wf.insight refuses to exist without evidence and its acquisition time', () => {
  assert.throws(() => wf.insight({title: '異常', text: 'x'} as unknown as WfInsightOpts), /evidence is required/);
  assert.throws(() => wf.insight({title: '異常', evidence: [{kind: '赤外線'}] as unknown as WfEvidence[]}), /acquisition time/);
  assert.doesNotThrow(() => wf.insight({title: '異常', evidence: [{kind: '赤外線', at: '10:42'}]}));
});

test('an insight shows its evidence, its time and that it is a reference (not a judgement)', () => {
  const band = layout(wf.col([wf.insight({title: '前回より高温', level: 'danger', evidence: [{kind: '赤外線', at: '10/09 10:42:03'}]})]));
  const t = texts(band);
  assert.ok(t.includes('赤外線') && t.includes('10/09 10:42:03') && t.includes('参考表示') && t.includes('要確認'));
});

test('state: missing / disconnected / loading are drawn with words and hatching, and unknown states fail', () => {
  for (const [state, word] of [['missing', 'データ欠損中'], ['disconnected', '通信断'], ['loading', '読み込み中']] as [WfState, string][]) {
    const band = layout(wf.col([wf.video({state, h: 160})]));
    assert.ok(texts(band).includes(word), `${state} shows "${word}"`);
    assert.ok(band.prims.filter(p => p.k === 'path' && p.op === 0.3).length > 3, 'hatching lines');
  }
  assert.throws(() => layout(wf.col([wf.video({state: 'bogus' as unknown as WfState, h: 160})])), /unknown state/);
});

test('every string a part may draw by default is measured before layout (no zero-width boxes)', () => {
  const asked = new Set(collectTextRequests({type: 'wireframe', root: wf.col([wf.fusion({}), wf.compare({sync: true}), wf.robot({name: 'A', battery: 0.5, link: 2, last: '3 秒前'}), wf.battery(0.07)])}).map(r => r[0]));
  for (const s of ['再生位置を同期', 'データ欠損中', '重ねる濃さ 60%', '50%', '7% 低下', '最終受信 3 秒前', 'やや弱い', '参考表示']) assert.ok(asked.has(s), `"${s}" is requested`);
});

test('fusion wraps its layer toggles instead of overflowing a narrow frame', () => {
  const band = layout(wf.row([wf.fusion({w: 240}), wf.col([wf.text('x')])]));
  const toggles = band.prims.filter((p): p is PrimRect => p.k === 'rect' && p.w === 36 && p.h === 20);
  assert.equal(toggles.length, 3);
  assert.ok(new Set(toggles.map(p => p.y)).size >= 2, 'toggles sit on more than one row');
  assert.ok(toggles.every(p => p.x + 44 <= 240 + 6), 'inside the frame');
});

test('map markers: a robot is told apart by shape + letter, with an optional heading and view cone', () => {
  const band = layout(wf.map({markers: [{kind: 'robot', x: 0.3, y: 0.5, id: 'A', shape: 'circle', heading: 90, fov: 60}, {kind: 'robot', x: 0.7, y: 0.5, id: 'B', shape: 'square'}]}));
  const t = texts(band);
  assert.ok(t.includes('A') && t.includes('B'));
  assert.ok(band.prims.some(p => p.k === 'path' && p.op === 0.18), 'view cone');
});

test('heat: numeric scale and a probe value', () => {
  const band = layout(wf.heat({scale: [20, 80], probe: {x: 0.5, y: 0.5, value: '72.4℃'}}));
  const t = texts(band);
  assert.ok(t.includes('80℃') && t.includes('50℃') && t.includes('20℃') && t.includes('72.4℃'));
});

test('controls and breadcrumb lay out inside a row', () => {
  const band = layout(wf.col([wf.row([wf.breadcrumb(['倉庫', '棟A', '1F']), wf.toggle('自動更新'), wf.checkbox('異常のみ'), wf.radio('最新'), wf.slider('透過', {value: 0.4, display: '40%'})])]));
  const t = texts(band);
  for (const s of ['倉庫', '棟A', '1F', '自動更新', '異常のみ', '最新', '透過', '40%']) assert.ok(t.includes(s), s);
});

test('wireframe() still passes through its own options', () => {
  assert.equal(wireframe(wf.col([]), {title: 'T'}).title, 'T');
});

test('an insight evidence row that does not fit puts its time on a second line (nothing overflows the card)', () => {
  const long = wf.insight({title: '温度が高い', evidence: [{kind: '赤外線 最高 62.4℃（装置の右側）', at: '10/9 10:24:31'}]});
  const narrow = layoutWireframe({type: 'wireframe', root: wf.col([long]), h: 420}, 0, 0, 330, widthOf, NO_TONES, 'phrase');
  const wide = layoutWireframe({type: 'wireframe', root: wf.col([long]), h: 420}, 0, 0, 900, widthOf, NO_TONES, 'phrase');
  const y = (b: LaidOutWireframe, s: string) => b.prims.find((p): p is PrimText => p.k === 'text' && p.s === s)!.y;
  assert.ok(y(narrow, '10/9 10:24:31') > y(narrow, '赤外線 最高 62.4℃（装置の右側）'), 'narrow: the time sits below');
  assert.equal(y(wide, '10/9 10:24:31'), y(wide, '赤外線 最高 62.4℃（装置の右側）'), 'wide: one line');
});

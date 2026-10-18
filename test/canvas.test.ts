import test from 'node:test';
import './helpers/strict-width.ts'; // a label the layout did not register for measuring throws instead of measuring 0 wide
import assert from 'node:assert/strict';
import {canvas, checkDiagram, closeMeasurer, connect, diagram, group, renderDiagram} from '../lib/dsl.ts';
import {canvasKeys, canvasTemplates, TEMPLATES} from '../lib/canvas.ts';
import {lintDiagram} from '../lib/rules.ts';
import {geometryChecks} from '../lib/geometry-checks.ts';
import type {LaidOutGrid} from '../lib/types/containers.ts';
import type {LaidOutBox} from '../lib/types/text-bands.ts';

test.after(() => closeMeasurer());

type R = {x: number; y: number; w: number; h: number};
const overlap = (a: R, b: R): boolean => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;

const laid = async (...bands: unknown[]) => {
  const d = diagram({theme: 'blue', title: 't'});
  d.add(...(bands as never[]));
  const {laidOut, verdict} = await checkDiagram(d);
  const boxes = (laidOut.laidOut.find(b => b.type === 'grid') as LaidOutGrid).children;
  return {laidOut, verdict, boxes, d, byTitle: (t: string) => boxes.find(b => b.title === t) as LaidOutBox};
};

// sample content for every region of every template
const SAMPLE = (template: keyof typeof TEMPLATES, n = 2): Record<string, string[]> =>
  Object.fromEntries(canvasKeys(template, true).map(k => [k, Array.from({length: n}, (_, i) => `${k} の要点 ${i + 1}`)]));

// ---- the templates ---------------------------------------------------------------------------------------------------------------

test('every template: sample content lays out, regions stay inside the figure and never overlap, verify and lint are clean', async () => {
  for (const name of canvasTemplates() as (keyof typeof TEMPLATES)[]) {
    const content = SAMPLE(name);
    if (name !== 'pest') for (const k of ['legal', 'environmental']) delete content[k];
    const {laidOut, verdict, boxes, d} = await laid(canvas(name, content, {title: name, requireAll: true}));
    assert.deepEqual(verdict.problems, [], name);
    for (const b of boxes) assert.ok(b.x >= 0 && b.x + b.w <= laidOut.width + 0.5 && b.y >= 0 && b.y + b.h <= (laidOut.contentHeight ?? 1e9) + 0.5, `${name}: ${b.title} is outside the figure`);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert.ok(!overlap(boxes[i], boxes[j]), `${name}: ${boxes[i].title} overlaps ${boxes[j].title}`);
    const findings = lintDiagram({...d, laidOut: laidOut.laidOut, connects: laidOut.connects});
    // layout-* are measurements (info; counted by layout-budget.test.ts): a canvas's floor height leaves room under the text on purpose until it is content-driven
    assert.deepEqual(findings.filter(f => f.rule !== 'a11y-no-title' && !f.rule.startsWith('layout-')), [], `${name}: rules`);
    const r = await renderDiagram(diagram({theme: 'blue', title: name}).add(canvas(name, content)), {name, budget: 'measure'});
    assert.deepEqual(geometryChecks(r.svg)!.contrast, [], `${name}: contrast`);
    assert.deepEqual(r.xml, []);
  }
});

test('every template keeps its region ids unique and its cells on the grid', () => {
  for (const [name, t] of Object.entries(TEMPLATES)) {
    const ids = t.regions.map(r => r.id);
    assert.equal(new Set(ids).size, ids.length, name);
    for (const r of t.regions as readonly {id: string; col: number; row: number; cs?: number; rs?: number}[]) {
      assert.ok(r.col + (r.cs ?? 1) <= t.cols.length, `${name}.${r.id} runs past the last column`);
      assert.ok(r.row + (r.rs ?? 1) <= t.rows.length, `${name}.${r.id} runs past the last row`);
    }
    // no two regions share a cell
    const taken = new Set<string>();
    for (const r of t.regions as readonly {id: string; col: number; row: number; cs?: number; rs?: number}[]) {
      for (let c = r.col; c < r.col + (r.cs ?? 1); c++) for (let w = r.row; w < r.row + (r.rs ?? 1); w++) { assert.ok(!taken.has(`${c},${w}`), `${name}.${r.id} shares a cell`); taken.add(`${c},${w}`); }
    }
  }
});

test('bmc: the classic arrangement (partners and segments are full height, value is the middle, cost and revenue share the bottom)', async () => {
  const {boxes, byTitle} = await laid(canvas('bmc', SAMPLE('bmc')));
  assert.equal(boxes.length, 9);
  const [partners, activities, resources, value, rel, channels, segments, cost, revenue] = ['主要パートナー', '主要活動', '主要リソース', '提供価値', '顧客との関係', 'チャネル', '顧客セグメント', 'コスト構造', '収益の流れ'].map(byTitle);
  for (const t of [partners, value, segments]) assert.ok(Math.abs(t.h - (activities.h + resources.h + 12)) < 1, 'a tall region spans the two rows');
  assert.ok(partners.x < activities.x && activities.x < value.x && value.x < rel.x && rel.x < segments.x);
  assert.equal(activities.x, resources.x);
  assert.equal(rel.x, channels.x);
  assert.ok(activities.y < resources.y && rel.y < channels.y);
  assert.ok(cost.y > partners.y + partners.h && revenue.y === cost.y);
  assert.ok(Math.abs(cost.w - revenue.w) <= 4 && Math.abs(cost.x + cost.w + 12 - revenue.x) < 1);
  assert.ok(Math.abs(revenue.x + revenue.w - (segments.x + segments.w)) < 0.5, 'the bottom row is as wide as the canvas');
});

test('vpc: customer side on the right, value side on the left, each row lines up with its counterpart', async () => {
  const {byTitle} = await laid(canvas('vpc', SAMPLE('vpc')));
  const pairs: [string, string][] = [['ゲイン・クリエイター（嬉しさを作る）', 'ゲイン（得たい成果）'], ['製品・サービス', 'ジョブ（片付けたい用事）'], ['ペイン・リリーバー（悩みを取る）', 'ペイン（困りごと）']];
  for (const [l, r] of pairs) { assert.equal(byTitle(l).y, byTitle(r).y); assert.ok(byTitle(l).x < byTitle(r).x); }
  assert.ok(byTitle('ゲイン（得たい成果）').y < byTitle('ジョブ（片付けたい用事）').y && byTitle('ジョブ（片付けたい用事）').y < byTitle('ペイン（困りごと）').y);
});

test('sevenS: the shared values are in the middle row, between the others; hard and soft are named by a tag', async () => {
  const {boxes, byTitle} = await laid(canvas('sevenS', SAMPLE('sevenS')));
  assert.equal(boxes.length, 7);
  const v = byTitle('共通の価値観（Shared Values）');
  for (const t of ['戦略（Strategy）', '組織構造（Structure）']) assert.ok(byTitle(t).y + byTitle(t).h <= v.y);
  for (const t of ['人材（Staff）', 'スキル（Skills）']) assert.ok(byTitle(t).y >= v.y + v.h);
  assert.ok(byTitle('経営スタイル（Style）').x + byTitle('経営スタイル（Style）').w <= v.x && v.x + v.w <= byTitle('制度・仕組み（Systems）').x);
  const tags = Object.fromEntries(boxes.map(b => [b.title, b.tag]));
  assert.equal(tags['戦略（Strategy）'], 'ハード');
  assert.equal(tags['経営スタイル（Style）'], 'ソフト');
});

test('fiveForces: a cross, the rivalry in the centre', async () => {
  const {byTitle} = await laid(canvas('fiveForces', SAMPLE('fiveForces')));
  const c = byTitle('業界内の競争（競合との敵対関係）'), top = byTitle('▼ 新規参入の脅威'), bottom = byTitle('▲ 代替品の脅威'), left = byTitle('▶ 売り手の交渉力（供給者）'), right = byTitle('◀ 買い手の交渉力（顧客）');
  assert.equal(top.x, c.x); assert.equal(bottom.x, c.x); assert.equal(left.y, c.y); assert.equal(right.y, c.y);
  assert.ok(top.y + top.h <= c.y && c.y + c.h <= bottom.y && left.x + left.w <= c.x && c.x + c.w <= right.x);
});

test('empathy: the person is in the middle with says and does at its sides, thinks above and feels below', async () => {
  const {byTitle} = await laid(canvas('empathy', SAMPLE('empathy')));
  const p = byTitle('対象のユーザー'), says = byTitle('言っていること（Says）'), does = byTitle('していること（Does）'), thinks = byTitle('考えていること（Thinks）'), feels = byTitle('感じていること（Feels）');
  assert.ok(says.x + says.w <= p.x && p.x + p.w <= does.x && says.y === p.y && does.y === p.y);
  assert.ok(thinks.y + thinks.h <= p.y && p.y + p.h <= feels.y);
});

test('tows: the four strategies sit in a grid under the S/W row and next to the O/T column', async () => {
  const {byTitle} = await laid(canvas('tows', {so: ['a'], wo: ['b'], st: ['c'], wt: ['d'], strengths: ['x']}));
  const so = byTitle('SO 積極策（強みで機会をつかむ）'), wt = byTitle('WT 防衛策（最悪を避ける）'), s = byTitle('強み（S）'), o = byTitle('機会（O）');
  assert.equal(so.x, s.x); assert.equal(so.y, o.y); assert.ok(wt.x > so.x && wt.y > so.y);
});

test('pest: four regions, PESTLE adds legal and environment (with pestle: true, or when they have content)', async () => {
  assert.equal((await laid(canvas('pest', {political: ['a']}))).boxes.length, 4);
  assert.equal((await laid(canvas('pest', {political: ['a']}, {pestle: true}))).boxes.length, 6);
  assert.equal((await laid(canvas('pest', {legal: ['a']}))).boxes.length, 6);
  assert.deepEqual(canvasKeys('pest'), ['political', 'economic', 'social', 'technological']);
  assert.equal(canvasKeys('pest', true).length, 6);
});

// ---- content and options ---------------------------------------------------------------------------------------------------------

test('content: an array is bullets, a string is a paragraph; a wrong key or template throws and lists the valid ones', async () => {
  const {byTitle} = await laid(canvas('swot', {strengths: ['a', 'b'], weaknesses: '一文で書く'}));
  assert.deepEqual(byTitle('強み（Strengths）').lines, ['・a', '・b']);
  assert.equal(byTitle('弱み（Weaknesses）').body, '一文で書く');
  assert.throws(() => canvas('swot', {strength: ['a']} as never), /"strength" is not a region of this template \(regions: strengths, weaknesses, opportunities, threats\)/);
  assert.throws(() => canvas('swot', {value: ['a']} as never), /content key "value"/);
  assert.throws(() => canvas('swat' as never, {}), /unknown template "swat" \(use bmc \| lean/);
  assert.throws(() => canvas('swot', {strengths: [''] } as never), /non-empty string/);
  assert.throws(() => canvas('swot', {strengths: [3]} as never), /non-empty string/);
  assert.throws(() => canvas('swot', {strengths: 3} as never), /string or an array/);
  assert.throws(() => canvas('swot', null as never), /content is an object/);
  assert.throws(() => canvas('swot', {}, {titles: {x: 'a'}} as never), /titles key "x"/);
  assert.throws(() => canvas('swot', {}, {emphasis: ['x']} as never), /emphasis region "x"/);
  assert.throws(() => canvas('swot', {}, {tone: {x: 'accent'}} as never), /tone key "x"/);
  assert.throws(() => canvas('swot', {}, {pestle: true} as never), /'pest' template only/);
  assert.throws(() => canvas('swot', {}, {h: -1}), /canvas\(\{h\}\) must be a number > 0/);
  assert.throws(() => canvas('swot', {}, {id: 'a b'}), /letters, digits/);
  assert.throws(() => canvas('swot', {}, {title: ' '}), /title/);
  assert.throws(() => canvas('swot', {}, {reveal: {strengths: 0}}), /whole stage/);
});

test('options are checked: an unknown option, a tone that is not one, emphasis that is not an array, a pestle: false that PESTLE content contradicts', () => {
  assert.throws(() => canvas('swot', {}, {titel: 'x'} as never), /unknown option "titel" \(options: title, titles/);
  assert.throws(() => canvas('swot', {}, {width: 600} as never), /unknown option "width"/);
  assert.throws(() => canvas('swot', {}, {tone: {strengths: 'pink'}} as never), /tone\}\): strengths is "pink", not one of plain, accent/);
  assert.throws(() => canvas('swot', {}, {emphasis: 'strengths'} as never), /emphasis\}\) is an array of region ids/);
  assert.throws(() => canvas('swot', {}, {titles: ['a']} as never), /titles\}\) is an object/);
  assert.throws(() => canvas('swot', {}, {requireAll: 'yes'} as never), /requireAll\}\) is true or false/);
  assert.throws(() => canvas('pest', {legal: ['a']}, {pestle: false}), /pestle is false but legal has content/);
  assert.throws(() => canvas('swot', {}, 'x' as never), /opts is an object/);
  assert.doesNotThrow(() => canvas('swot', {}, {tone: {strengths: 'solid', weaknesses: undefined}}));
});

test('a bullet that already has a mark keeps one mark; text is trimmed', async () => {
  const {byTitle} = await laid(canvas('swot', {strengths: ['- a', '・b', '  c  ']}));
  assert.deepEqual(byTitle('強み（Strengths）').lines, ['・a', '・b', '・c']);
});

test('a leading minus or star that is part of the text is kept (only "- " / "* " with a space are bullet marks); a bare mark throws', async () => {
  const {byTitle} = await laid(canvas('swot', {threats: ['-5% の値下げ', '*注 仮の数字', '* 星の箇条', '•黒丸', '−3 pt']}));
  assert.deepEqual(byTitle('脅威（Threats）').lines, ['・-5% の値下げ', '・*注 仮の数字', '・星の箇条', '・黒丸', '・−3 pt']);
  assert.throws(() => canvas('swot', {threats: ['a', '・']}), /threats\[1\] is only a bullet mark/);
  assert.throws(() => canvas('swot', {threats: ['- ']}), /only a bullet mark/);
});

test('titles override the Japanese defaults; tone and emphasis: an emphasised region is accent AND says 重点 in words', async () => {
  const {byTitle, boxes} = await laid(canvas('bmc', {value: ['v']}, {titles: {value: 'ご提供する価値'}, tone: {cost: 'danger'}, emphasis: ['segments']}));
  assert.ok(byTitle('ご提供する価値'));
  assert.equal(boxes.find(b => b.title === 'コスト構造')!.tone, 'danger');
  const seg = byTitle('顧客セグメント');
  assert.equal(seg.tone, 'accent');
  assert.equal(seg.tag, '重点');
  assert.ok(seg.tagBox, 'the pill is drawn');
  // a region that already has a tag keeps it next to 重点
  assert.equal((await laid(canvas('sevenS', {}, {emphasis: ['strategy']}))).byTitle('戦略（Strategy）').tag, '重点・ハード');
});

test('title is a caption above; stamp sits in the corner region', async () => {
  const {laidOut, boxes} = await laid(canvas('swot', {strengths: ['a']}, {title: '現状分析', stamp: '仮説'}));
  const cap = laidOut.laidOut.find(b => b.type === 'caption' && b.text === '現状分析');
  assert.ok(cap);
  assert.ok(boxes.every(b => b.y > (cap as {y: number}).y));
  assert.deepEqual(boxes.filter(b => b.stamp).map(b => b.title), ['脅威（Threats）']);
});

test('stamp: every template draws it exactly once, in the bottom row\'s right-most box (fiveForces has no box in its corner cell)', async () => {
  for (const name of canvasTemplates() as (keyof typeof TEMPLATES)[]) {
    const r = await renderDiagram(diagram({theme: 'blue', title: name}).add(canvas(name, {}, {stamp: '架空の例'})), {name, budget: 'measure'});
    assert.equal(r.svg.split('架空の例').length - 1, 1, `${name}: the stamp is drawn once`);
    const boxes = (r.laidOut.laidOut.find(b => b.type === 'grid') as LaidOutGrid).children;
    const s = boxes.find(b => b.stamp)!, bottom = Math.max(...boxes.map(b => b.y + b.h));
    assert.ok(Math.abs(s.y + s.h - bottom) < 0.5, `${name}: in the bottom row`);
    for (const b of boxes) if (Math.abs(b.y + b.h - bottom) < 0.5) assert.ok(b.x <= s.x, `${name}: right-most`);
  }
  assert.equal((await laid(canvas('fiveForces', {}, {stamp: '仮説'}))).byTitle('▲ 代替品の脅威').stamp, '仮説');
  assert.throws(() => canvas('swot', {}, {stamp: ''}), /stamp\}\) must be a non-empty string/);
  assert.throws(() => canvas('swot', {}, {stamp: 3 as never}), /stamp\}\) must be a non-empty string/);
});

test('h: the canvas is at least that tall (rows share it by weight), and content that needs more throws with the height it needs', async () => {
  const {boxes} = await laid(canvas('swot', {strengths: ['a']}, {h: 900}));
  const top = Math.min(...boxes.map(b => b.y)), bottom = Math.max(...boxes.map(b => b.y + b.h));
  assert.ok(bottom - top >= 900 && bottom - top < 900 + 4 * 2, `${bottom - top}: h, up to the 4px grid per row`);
  const long = Array.from({length: 20}, (_, i) => `項目 ${i} をかなり長めの文で書いて折り返しを起こす`);
  await assert.rejects(laid(canvas('swot', {strengths: long}, {h: 300})), /the regions need \d+px of height but h is 300px/);
});

test('without h a region grows with its text: nothing overflows, every row is as tall as its tallest cell', async () => {
  const long = Array.from({length: 14}, (_, i) => `項目 ${i} をかなり長めの文で書いて折り返しを起こさせる`);
  const {boxes, verdict} = await laid(canvas('swot', {strengths: long, weaknesses: ['短い']}));
  assert.deepEqual(verdict.problems, []);
  const s = boxes.find(b => b.title === '強み（Strengths）')!, w = boxes.find(b => b.title === '弱み（Weaknesses）')!;
  assert.equal(s.h, w.h);
  const textBottom = s.y + 40 + s.wrappedRuns.reduce((n, r) => n + r.lines.length, 0) * 20;
  assert.ok(textBottom <= s.y + s.h);
});

test('bigger text widens a spanning region equally across its rows (a tall bmc region)', async () => {
  const many = Array.from({length: 16}, (_, i) => `パートナー候補 ${i}`);
  const {byTitle} = await laid(canvas('bmc', {partners: many}));
  const p = byTitle('主要パートナー'), a = byTitle('主要活動'), r = byTitle('主要リソース');
  assert.ok(p.h >= p.wrappedRuns.reduce((n, x) => n + x.lines.length, 0) * 18);
  assert.ok(Math.abs(p.h - (a.h + r.h + 12)) < 1);
});

test('every edge is on the 4px grid the emitter snaps to: neighbours share a straight edge and every gutter is the gap (also inside a group)', async () => {
  for (const name of canvasTemplates() as (keyof typeof TEMPLATES)[]) for (const inGroup of [false, true]) {
    const c = canvas(name, SAMPLE(name, 1), {title: name});
    const {boxes} = await laid(inGroup ? group([c], {title: 'G'}) : c);
    for (const b of boxes) for (const v of [b.x - (inGroup ? 36 : 20), b.y, b.w, b.h, b.x + b.w]) assert.ok(Math.abs(v / 4 - Math.round(v / 4)) < 1e-6 || v === b.x + b.w, `${name}${inGroup ? ' in a group' : ''}: ${b.title} ${v} is off the grid`);
    for (const b of boxes) for (const v of [b.y, b.y + b.h]) assert.ok(Math.abs(v / 4 - Math.round(v / 4)) < 1e-6, `${name}: ${b.title} y ${v}`);
    // two regions side by side are a gap apart; the gutters are all the same
    const gutters = new Set<number>();
    for (const a of boxes) for (const b of boxes) if (b.x > a.x + a.w - 0.5 && b.y < a.y + a.h && a.y < b.y + b.h && !boxes.some(o => o !== a && o !== b && o.x >= a.x + a.w - 0.5 && o.x + o.w <= b.x + 0.5 && o.y < a.y + a.h && a.y < o.y + o.h)) gutters.add(Math.round(b.x - a.x - a.w));
    assert.equal(gutters.size, 1, `${name}: gutters ${[...gutters]}`);
  }
});

test('a pill on a region below the first row keeps clear of the region above, and of the caption over the canvas', async () => {
  for (const name of canvasTemplates() as (keyof typeof TEMPLATES)[]) {
    const content = SAMPLE(name, 1);
    if (name !== 'pest') for (const k of ['legal', 'environmental']) delete content[k];
    const {boxes, laidOut} = await laid(canvas(name, content, {title: `${name} の題名をかなり長く書いて右端まで届かせる見出しにする`, emphasis: Object.keys(content) as never[]}));
    const cap = laidOut.laidOut.find(b => b.type === 'caption') as {y: number; h: number};
    for (const b of boxes) {
      assert.ok(b.tagBox, `${name}: ${b.title} has its 重点 pill`);
      assert.ok(b.tagBox!.y >= cap.y + cap.h, `${name}: the pill of ${b.title} meets the caption`);
      for (const o of boxes) if (o !== b) assert.ok(!overlap(b.tagBox!, o), `${name}: the pill of ${b.title} sits on ${o.title}`);
    }
  }
});

test('too narrow: a region below 96px, or a gap that leaves no room, throws and says to widen the figure', async () => {
  const narrow = async (width: number, c: unknown) => { const d = diagram({theme: 'blue', title: 't', width}); d.add(c as never); return checkDiagram(d); };
  await assert.rejects(narrow(360, canvas('bmc', {partners: ['地元の契約農家']})), /canvas\("bmc"\): region "主要パートナー" is only \d+px wide \(at least 96px\): widen the figure/);
  await assert.rejects(narrow(940, canvas('bmc', {}, {gap: 200})), /region "主要パートナー" is only \d+px wide/);
  await assert.doesNotReject(narrow(600, canvas('bmc', {partners: ['地元の契約農家']})));
});

test('a word longer than its region (no place to break) throws with the word and the region, instead of running out of the box', async () => {
  await assert.rejects(laid(canvas('bmc', {partners: ['Supercalifragilisticexpialidociousxxxxxxxxxxxxxxxxx']})), /"Supercalifragilisticexpialidocious\w*" in region "主要パートナー" is wider than the region/);
  await assert.rejects(laid(canvas('bmc', {value: 'https://example.com/very/long/path/without/spaces/at/all/whatsoever'})), /in region "提供価値" is wider than the region/);
  // the same text with spaces wraps; CJK always wraps
  await assert.doesNotReject(laid(canvas('bmc', {partners: ['Super cali fragilistic expiali docious'], segments: ['あ'.repeat(60)]})));
});

test('slide canvas: the canvas keeps to the slide height (its aspect does not push it past 720px); content that needs more still grows', async () => {
  const check = async (c: unknown) => { const d = diagram({theme: 'blue', title: 't', canvas: 'slide'}); d.add(c as never); const {laidOut} = await checkDiagram(d); return {laidOut, f: lintDiagram({...d, laidOut: laidOut.laidOut, connects: [], canvas: d.canvas, contentHeight: laidOut.contentHeight}).map(x => x.rule)}; };
  for (const name of ['bmc', 'swot', 'empathy', 'a3'] as const) {
    const {laidOut, f} = await check(canvas(name, {}, {title: name}));
    assert.ok(laidOut.contentHeight! <= 720, `${name}: ${laidOut.contentHeight}`);
    assert.ok(!f.includes('slide-canvas-overflow'), name);
  }
  const many = Array.from({length: 12}, (_, i) => `項目 ${i}`);
  const {laidOut} = await check(canvas('swot', {strengths: many}));
  const s = (laidOut.laidOut.find(b => b.type === 'grid') as LaidOutGrid).children[0];
  assert.ok(s.y + s.h >= s.wrappedRuns.at(-1)!.lineYs.at(-1)!, 'the region still holds its text');
});

// ---- ids, reveal, spotlight, rules ---------------------------------------------------------------------------------------------------

test('with an id each region is the anchor id-region: connect() lands on it; a duplicate id is refused', async () => {
  const {laidOut, byTitle} = await laid(canvas('swot', SAMPLE('swot'), {id: 'sw'}), connect('sw-strengths:bottom', 'sw-opportunities:top'));
  const s = byTitle('強み（Strengths）'), o = byTitle('機会（Opportunities）');
  assert.equal(s.id, 'sw-strengths');
  const c = laidOut.connects[0] as {from: {x: number; y: number}; to: {x: number; y: number}};
  assert.ok(Math.abs(c.from.y - (s.y + s.h)) < 0.5 && Math.abs(c.to.y - o.y) < 0.5);
  await assert.rejects(laid(canvas('swot', {}, {id: 'sw'}), canvas('swot', {}, {id: 'sw'})), /duplicate anchor id "sw-strengths"/);
});

test('reveal: regions appear at their stage; a connect() to a region appears with it', async () => {
  const d = diagram({theme: 'blue', title: 't'});
  d.add(canvas('swot', SAMPLE('swot'), {id: 'sw', reveal: {strengths: 1, weaknesses: 2}}), connect('sw-strengths:right', 'sw-weaknesses:left'));
  const r = await renderDiagram(d, {name: 'canvas-reveal', budget: 'measure'});
  assert.equal(r.laidOut.maxReveal, 2);
  const c = r.laidOut.connects[0] as {reveal?: number};
  assert.equal(c.reveal, 2, 'the arrow waits for the later region');
});

test('spotlight: a region can be lit and the rest dims', async () => {
  const d = diagram({theme: 'blue', title: 't', spotlight: 'sw-threats'});
  d.add(canvas('swot', SAMPLE('swot'), {id: 'sw'}));
  const {laidOut} = await checkDiagram(d);
  const boxes = (laidOut.laidOut.find(b => b.type === 'grid') as LaidOutGrid).children;
  assert.deepEqual(boxes.filter(b => !b.dim).map(b => b.id), ['sw-threats']);
});

test('requireAll: a missing region is a canvas-region-empty warning; optional regions are not counted; without requireAll nothing is said', async () => {
  const rule = async (c: unknown) => { const {laidOut, d} = await laid(c); return lintDiagram({...d, laidOut: laidOut.laidOut, connects: []}).filter(f => f.rule === 'canvas-region-empty'); };
  const f = await rule(canvas('swot', {strengths: ['a'], weaknesses: ['b']}, {requireAll: true}));
  assert.equal(f.length, 1);
  assert.match(f[0].message, /opportunities、threats/);
  assert.equal(f[0].severity, 'warn');
  assert.deepEqual(await rule(canvas('swot', {strengths: ['a']})), []);
  assert.deepEqual(await rule(canvas('swot', SAMPLE('swot'), {requireAll: true})), []);
  assert.deepEqual(await rule(canvas('empathy', {thinks: ['a'], says: ['a'], does: ['a'], feels: ['a'], pains: ['a'], gains: ['a']}, {requireAll: true})), [], 'the person box is optional');
  assert.deepEqual(await rule(canvas('threeC', {customer: ['a'], competitor: ['a'], company: ['a']}, {requireAll: true})), [], 'the insight box is optional');
  const {laidOut, d} = await laid(canvas('swot', {strengths: ['a']}, {requireAll: true}));
  d.accept = {'canvas-region-empty': '草稿'};
  assert.ok(lintDiagram({...d, laidOut: laidOut.laidOut, connects: []}).some(x => x.rule === 'canvas-region-empty'));
});

test('a tone that a pill explains needs no legend; a plain tone you pick yourself still does', async () => {
  const lint = async (c: unknown) => { const {laidOut, d} = await laid(c); return lintDiagram({...d, laidOut: laidOut.laidOut, connects: []}).filter(f => f.rule === 'legend-missing'); };
  assert.deepEqual(await lint(canvas('sevenS', SAMPLE('sevenS'), {emphasis: ['strategy']})), []);
  assert.equal((await lint(canvas('swot', SAMPLE('swot'), {tone: {threats: 'danger'}}))).length, 1);
});

test('the canvas does not change the caller\'s band, and the same band lays out twice the same', async () => {
  const c = canvas('bmc', SAMPLE('bmc'), {id: 'm'});
  const before = JSON.stringify(c);
  const a = await laid(c), b = await laid(c);
  assert.equal(JSON.stringify(c), before);
  assert.deepEqual(a.boxes.map(x => [x.x, x.y, x.w, x.h]), b.boxes.map(x => [x.x, x.y, x.w, x.h]));
});

test('slide medium: text keeps the slide minimum size', async () => {
  const d = diagram({theme: 'blue', title: 't', canvas: 'slide'});
  d.add(canvas('swot', SAMPLE('swot', 3), {title: 'SWOT'}));
  const {laidOut, verdict} = await checkDiagram(d);
  assert.deepEqual(verdict.problems, []);
  const f = lintDiagram({...d, laidOut: laidOut.laidOut, connects: [], canvas: d.canvas, contentHeight: laidOut.contentHeight});
  assert.deepEqual(f.filter(x => x.rule === 'slide-min-text'), []);
});

// ---- a seeded sweep ----------------------------------------------------------------------------------------------------------------

test('a seeded sweep over text lengths, item counts, widths and templates: no text runs out of a box or meets another, no pill sits on a neighbour; a word too long for its region is refused by name', async () => {
  let seed = 20261012;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
  const words = ['顧客', '価値', 'コスト', 'パートナー', 'Subscription', '定期便', '24h', '在庫', '品質管理', 'ブランド', 'API', '配送網'];
  const names = canvasTemplates() as (keyof typeof TEMPLATES)[];
  let drawn = 0, refused = 0;
  for (let i = 0; i < 40; i++) {
    const name = pick(names), content: Record<string, string[]> = {};
    for (const k of canvasKeys(name, true)) {
      if (name !== 'pest' && (k === 'legal' || k === 'environmental')) continue;
      if (rnd() < 0.15) continue;
      content[k] = Array.from({length: 1 + Math.floor(rnd() * 5)}, () => Array.from({length: 1 + Math.floor(rnd() * 14)}, () => pick(words)).join(rnd() < 0.5 ? '' : ' '));
    }
    const width = pick([700, 940, 1100]);
    const d = diagram({theme: 'blue', title: 't', width});
    d.add(canvas(name, content, {title: `${name} ${i}`, emphasis: rnd() < 0.5 ? [canvasKeys(name)[0] as never] : []}));
    let r;
    try { r = await renderDiagram(d, {name: `sweep-${i}`, budget: 'measure'}); } catch (e) {
      assert.match((e as Error).message, /is wider than the region/, `${name} #${i} w${width}`);
      refused++;
      continue;
    }
    drawn++;
    assert.deepEqual(r.verdict.problems, [], `${name} #${i} w${width}`);
    const g = geometryChecks(r.svg)!;
    assert.deepEqual([g.containerOverflow, g.textOverlap, g.covered, g.overflow], [[], [], [], null], `${name} #${i} w${width}: the drawn SVG`);
    const boxes = (r.laidOut.laidOut.find(b => b.type === 'grid') as LaidOutGrid).children;
    for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) assert.ok(!overlap(boxes[a], boxes[b]), `${name} #${i}: ${boxes[a].title} / ${boxes[b].title}`);
    for (const b of boxes) assert.ok(b.x + b.w <= r.laidOut.width + 0.5, `${name} #${i}`);
    for (const b of boxes) if (b.tagBox) for (const o of boxes) if (o !== b) assert.ok(!overlap(b.tagBox, o), `${name} #${i}: the pill of ${b.title} sits on ${o.title}`);
  }
  assert.ok(drawn >= 30 && refused >= 1, `drawn ${drawn}, refused ${refused}`);
});

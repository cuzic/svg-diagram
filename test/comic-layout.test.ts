// ADR 0074 D1 / D2 / D6: the layout of comic(): the panels, the people's places, the bubbles' places, the tails, and the checks that read them.
import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutComic, lineBudget, panelSize, tailOf, zoneOf} from '../lib/comic/layout.ts';
import {f1} from '../lib/comic/constants.ts';
import {checkBubbleFace, checkTail, tailAngle, tailCrosses} from '../lib/comic/check.ts';
import {renderComicBand} from '../lib/comic/emit.ts';
import {comic, speechBubble} from '../lib/dsl-pure.ts';
import type {ComicAspect, ComicBand, ComicDialogue, ComicLayoutName, ComicPanel, ComicWorksheet} from '../lib/types/comic.ts';
import {ARTIST} from './helpers/comic-character.ts';
import {SAMPLE} from './helpers/comic-sample.ts';

const widthOf = (atom: string) => atom.length * 9;
const lay = (sheet: ComicWorksheet, aspect?: ComicAspect, w = 0, wo: (a: string) => number = widthOf) => layoutComic(comic(sheet, aspect ? {aspect} : {}), 0, 0, w, wo);
const panel = (id: string, stage: [string, 'left' | 'center' | 'right'][], dialogue: ComicDialogue[]): ComicPanel =>
  ({id, stage: stage.map(([who, at]) => ({who, at, expression: 'neutral' as const})), dialogue});
const say = (id: string, who: string, tpl: string, slots?: ComicDialogue['slots']): ComicDialogue => ({id, who, kind: 'say', tpl, ...(slots ? {slots} : {})});
const one = (panels: ComicPanel[], layout: ComicLayoutName = '1x2'): ComicWorksheet => ({version: 1, title: 'テスト', layout, cast: {me: {name: '私'}, col: {name: '同僚'}}, panels});
const rules = (l: ReturnType<typeof lay>) => l.findings.map(f => f.rule);

test('layouts: panel sizes, gutters, margins and the reading order (a column top to bottom, 2x2 by rows left to right)', () => {
  const empty = (n: number) => Array.from({length: n}, (_, i) => panel(`p${i + 1}`, [], []));
  const col = lay(one(empty(4), '1x4'), '7:5');
  assert.deepEqual(col.panels.map(p => [p.x, p.y, p.w, p.h]), [[16, 16, 420, 300], [16, 332, 420, 300], [16, 648, 420, 300], [16, 964, 420, 300]]);
  assert.deepEqual([col.w, col.h], [452, 1280]);
  const grid = lay(one(empty(4), '2x2'));
  assert.deepEqual(grid.panels.map(p => [p.x, p.y, p.w, p.h]), [[16, 16, 360, 360], [392, 16, 360, 360], [16, 392, 360, 360], [392, 392, 360, 360]]);
  assert.deepEqual([grid.w, grid.h], [768, 768]);
  assert.equal(lay(one(empty(3), '1x3')).panels.length, 3);
  assert.equal(lay(one(empty(2), '1x2')).h, 2 * 16 + 2 * panelSize('1x2', undefined).h + 16);
  // the band is centred in the width it is given, on the 4px grid
  assert.equal(lay(one(empty(2)), undefined, 800).x, 176);
});

test('every coordinate of the frame is on the 4px grid, and a bubble box is a whole number of 4px', () => {
  const l = lay(SAMPLE);
  for (const p of l.panels) for (const n of [p.x, p.y, p.w, p.h]) assert.equal(n % 4, 0, `${p.id}`);
  for (const b of l.bubbles) for (const n of [b.x, b.w, b.h]) assert.equal(n % 4, 0, `${b.id}`); // y is not: a stacked bubble sits 6px under the one above (ADR 0074 D1)
});

test('the numbering: a badge per panel (numbers, or labels), or none', () => {
  assert.deepEqual(lay(SAMPLE).panels.map(p => p.label), ['1', '2', '3', '4']);
  assert.deepEqual(lay({...SAMPLE, labels: ['起', '承', '転', '結']}).panels.map(p => p.label), ['起', '承', '転', '結']);
  assert.deepEqual(lay({...SAMPLE, numbering: false}).panels.map(p => p.label), [undefined, undefined, undefined, undefined]);
});

test('the people: left and right are 104px from the sides, the centre is half the width on the grid, the head is 76px above the bottom', () => {
  const l = lay(one([panel('p1', [['me', 'left'], ['col', 'right']], []), panel('p2', [['me', 'center']], [])]), '7:5');
  const [a, b] = l.panels;
  assert.deepEqual(a!.heads.map(h => [h.who, h.cx - a!.x, h.cy - a!.y, h.r]), [['me', 104, 224, 36], ['col', 316, 224, 36]]);
  assert.deepEqual(b!.heads.map(h => [h.cx - b!.x, h.cy - b!.y]), [[208, 224]]);
  assert.deepEqual(a!.heads[0]!.mouth, [a!.heads[0]!.cx, a!.heads[0]!.cy + 15.1]);
  const sq = lay(one([panel('p1', [['me', 'center']], [])], '1x2'), '1:1');
  assert.equal(sq.panels[0]!.heads[0]!.cx - sq.panels[0]!.x, 208);
  assert.equal(lay(one([panel('p1', [['me', 'center']], [])], '2x2')).panels[0]!.heads[0]!.cx - 16, 180);
});

test('the zone over the heads: 168px at 7:5 (4 lines), 220px at 6:5 (6 lines), and a bubble is lines x 26 + 20 on the grid', () => {
  assert.deepEqual(zoneOf(300), {top: 16, bottom: 184});
  assert.equal(lineBudget(300), 4);
  assert.deepEqual(panelSize('1x4', '6:5'), {w: 420, h: 352});
  assert.equal(lineBudget(352), 6);
  assert.equal(lineBudget(360), 7);
  const b = lay(SAMPLE, '7:5').bubbles;
  assert.deepEqual(b.filter(x => x.panel === 'p1' || x.id === 'p3.d1').map(x => [x.id, x.h]), [['p1.d1', 100], ['p3.d1', 72]]);
  assert.equal(b.find(x => x.id === 'p3.d2')!.h, 48);
});

test('a bubble sits over its speaker, kept inside the panel; earlier bubbles to its left share the row, anything else is stacked under', () => {
  // me (left) speaks first, then col (right): 188 + 204 + 6 <= 404, so both stand in the top row
  const side = lay(one([panel('p1', [['me', 'left'], ['col', 'right']], [say('d1', 'me', '先に{a}ね。', {a: {max: 3, prompt: '何を'}}), say('d2', 'col', '最近、{b}ね。', {b: {max: 8, prompt: '変化'}})])]), '7:5');
  const [d1, d2] = side.bubbles;
  assert.equal(d1!.y, d2!.y);
  assert.ok(d1!.x + d1!.w + 6 <= d2!.x, 'side by side');
  assert.equal(d1!.x - side.panels[0]!.x, 12, 'centred on the head (104px) and snapped to the grid');
  assert.equal(d2!.x + d2!.w - (side.panels[0]!.x + 420), -8);
  // the right-hand speaker first, then the left: reading order is left to right, so the second goes under the first
  const swapped = lay(one([panel('p1', [['me', 'left'], ['col', 'right']], [say('d1', 'col', '最近、{b}ね。', {b: {max: 8, prompt: '変化'}}), say('d2', 'me', '先に{a}ね。', {a: {max: 3, prompt: '何を'}})])]), '7:5');
  const [e1, e2] = swapped.bubbles;
  assert.equal(e2!.y, e1!.y + e1!.h + 6);
  // two bubbles of one speaker are stacked
  const same = lay(one([panel('p1', [['me', 'left']], [say('d1', 'me', 'はい。'), say('d2', 'me', 'いいえ。')])]), '7:5');
  assert.equal(same.bubbles[1]!.y, same.bubbles[0]!.y + same.bubbles[0]!.h + 6);
});

test('a narration sits in the corner and has no tail; the other kinds have a tail towards the speaker', () => {
  const l = lay(one([panel('p1', [['me', 'right']], [{id: 'n1', kind: 'narration', tpl: '次の日。'}, {id: 'd1', who: 'me', kind: 'think', tpl: 'ふむ。'}, {id: 'd2', who: 'me', kind: 'shout', tpl: 'やった！'}]), panel('p2', [], [])]), '7:5');
  const [n, t, s] = l.bubbles;
  assert.equal(n!.x - l.panels[0]!.x, 20, 'clear of the number badge');
  assert.equal(n!.tail, undefined);
  assert.equal(t!.tail, undefined, 'the upper bubble of one speaker: its tail would run behind the bubble below, so the lower one carries it');
  assert.ok(s!.tail);
  assert.deepEqual(l.bubbles.map(b => b.kind), ['narration', 'think', 'shout']);
  assert.deepEqual(rules(l), []);
});

test('the tail aims at the speaker\'s mouth (within 10 degrees), its tip stays off the face, and the wedge is on the outline', () => {
  const l = lay(SAMPLE, '7:5');
  for (const p of l.panels) for (const b of l.bubbles.filter(x => x.panel === p.id)) {
    const h = p.heads.find(x => x.who === b.who)!;
    if (b.id === 'p2.d2') continue; // overflowed the zone: it reaches the head, so no tail can be drawn (the zone problem is the report)
    assert.ok(b.tail, b.id);
    assert.ok(tailAngle(b.tail, h.mouth) <= 0.17, `${b.id} ${tailAngle(b.tail, h.mouth)}`);
    assert.ok(Math.hypot(b.tail.tip[0] - h.cx, b.tail.tip[1] - h.cy) >= h.r + 6 - 0.2, `${b.id}: the tip stops 6px outside the head`);
    const [fx, fy] = b.tail.from;
    assert.ok(fx >= b.x && fx <= b.x + b.w && fy >= b.y && fy <= b.y + b.h && (fy === b.y || fy === b.y + b.h || fx === b.x || fx === b.x + b.w), `${b.id}: the wedge starts on the bubble's outline`);
  }
});

test('comic-tail-off-speaker: a tail turned away from the mouth is reported, and the check reads the drawn tail, not the data', () => {
  const l = lay(SAMPLE, '7:5');
  const b = structuredClone(l.bubbles.find(x => x.id === 'p1.d1')!);
  const h = l.panels[0]!.heads[0]!;
  const tailRules = (): string[] => { const seen: string[] = []; checkTail(b, h, rule => seen.push(rule)); return seen; };
  assert.deepEqual(tailRules(), []);
  b.tail!.tip = [b.tail!.tip[0] + 60, b.tail!.tip[1]]; // 60px sideways: well over 10 degrees
  assert.deepEqual(tailRules(), ['comic-tail-off-speaker']);
  assert.ok(tailAngle(tailOf(b, h)!, h.mouth) < 0.17, 'the tail the layout makes is within the limit');
});

test('comic-bubble-covers-face: a bubble within 4px of a head circle is reported; one 4px away is not', () => {
  const h = {id: 'p1.me', who: 'me', name: '私', expression: 'neutral' as const, look: {kind: 'face' as const, hue: 210, hair: 'short' as const}, cx: 100, cy: 100, r: 36, mouth: [100, 115] as [number, number]};
  const bubble = (y: number) => ({id: 'p1.d1', panel: 'p1', kind: 'say' as const, x: 60, y, w: 80, h: 40, lines: [], runs: [], slots: [], title: ''});
  const faceRules = (y: number): string[] => { const seen: string[] = []; checkBubbleFace(bubble(y), h, rule => seen.push(rule)); return seen; };
  assert.deepEqual(faceRules(100 - 36 - 4 - 40 + 1), ['comic-bubble-covers-face']);
  assert.deepEqual(faceRules(100 - 36 - 4 - 40), []);
});

test('ADR sample (7:5): the second panel stacks two 3-line bubbles, so exactly the root causes are reported: comic-bubble-zone and comic-text-budget', () => {
  const l = lay(SAMPLE, '7:5');
  assert.deepEqual(l.findings.map(f => [f.rule, f.where]), [['comic-bubble-zone', 'p2.d2'], ['comic-text-budget', 'p2.d2']]);
  assert.match(l.findings[0]!.message, /222px from the top.*184px/);
  assert.match(l.findings[1]!.message, /6 lines are stacked in p2 \(at most 4\)/);
  // The bubble would cover a face if the layout ran the face check after reporting the overflow.
  const overflow = l.bubbles.find(b => b.id === 'p2.d2')!;
  const faceRules: string[] = [];
  checkBubbleFace(overflow, l.panels[1]!.heads[0]!, rule => faceRules.push(rule));
  assert.deepEqual(faceRules, ['comic-bubble-covers-face']);
  assert.deepEqual(l.bubbles.map(b => [b.id, b.lines.length]), [['p1.d1', 3], ['p2.d1', 3], ['p2.d2', 3], ['p3.d1', 2], ['p3.d2', 1], ['p4.d1', 2]]);
});

test('ADR sample (6:5): the zone is 220px, so the same two 3-line bubbles fit and nothing is reported', () => {
  assert.deepEqual(lay(SAMPLE, '6:5').findings, []);
});

test('text budget: a bubble of 4 lines is one too many, and one report per panel', () => {
  const l = lay(one([panel('p1', [['me', 'left']], [say('d1', 'me', '漢'.repeat(40)), say('d2', 'me', '漢'.repeat(40))])]), '6:5');
  assert.equal(l.findings.filter(f => f.rule === 'comic-text-budget').length, 1);
});

test('the checks of the data: speaker, collisions, panel count, blanks', () => {
  const l = lay(one([
    panel('p1', [['me', 'left'], ['col', 'left']], [say('d1', 'zz', '{a}と{b}と{c}', {a: {max: 12, prompt: 'あ'}, b: {max: 2, prompt: 'いろはにほ'}})]),
  ], '1x4'));
  assert.deepEqual([...new Set(rules(l))].sort(), ['comic-at-collision', 'comic-bubble-wide', 'comic-panel-count', 'comic-slot-max', 'comic-slot-prompt', 'comic-slot-undefined', 'comic-slots-per-panel', 'comic-speaker-unknown']);
  // a speaker who is in cast but not on the stage of the panel is the same mistake
  const off = lay(one([panel('p1', [['me', 'left']], [say('d1', 'col', 'はい。')]), panel('p2', [], [])]));
  assert.deepEqual(off.findings.map(f => f.rule), ['comic-speaker-unknown']);
  assert.match(off.findings[0]!.message, /not on the stage/);
  // a blank id is unique in the whole worksheet; a blank needs max or choices
  const dup = lay(one([panel('p1', [['me', 'left']], [say('d1', 'me', '{a}', {a: {max: 2, prompt: 'あい'}})]), panel('p2', [['me', 'left']], [say('d1', 'me', '{a}', {a: {max: 2, prompt: 'あい'}})])]));
  assert.deepEqual(dup.findings.map(f => f.rule), ['comic-slot-duplicate']);
  assert.deepEqual(lay(one([panel('p1', [['me', 'left']], [say('d1', 'me', '{a}', {a: {prompt: 'あい', choices: ['月曜', '火曜日']}})]), panel('p2', [], [])])).findings, []);
  assert.deepEqual(lay(one([panel('p1', [['me', 'left']], [say('d1', 'me', '{a}', {a: {prompt: 'あい'}})]), panel('p2', [], [])])).findings.map(f => f.rule), ['comic-slot-max']);
});

test('a panel with three blanks is reported once; two are fine', () => {
  const slots = (n: string) => ({[n]: {max: 2, prompt: 'あい'}});
  const two = lay(one([panel('p1', [['me', 'left']], [say('d1', 'me', '{a}と{b}', {...slots('a'), ...slots('b')})]), panel('p2', [], [])]));
  assert.deepEqual(two.findings, []);
  const three = lay(one([panel('p1', [['me', 'left']], [say('d1', 'me', '{a}と{b}', {...slots('a'), ...slots('b')}), say('d2', 'me', '{c}', slots('c'))]), panel('p2', [], [])]));
  assert.deepEqual(three.findings.filter(f => f.rule === 'comic-slots-per-panel').map(f => f.where), ['p1']);
});

test('a blank is a rectangle in the text (max x 1 em wide), and the same data has the same layout whatever the blank would hold', () => {
  const l = lay(SAMPLE, '7:5');
  const b = l.bubbles.find(x => x.id === 'p3.d1')!;
  assert.deepEqual(b.slots.map(s => [s.id, s.w, s.max]), [['change', 144, 8]]);
  assert.deepEqual(b.lines, ['最近、', '{change}ね。']);
  assert.equal(b.title, '最近、＿＿ね。');
});

test('changing only the words of a line does not move the panels or the people', () => {
  const edited: ComicWorksheet = {...SAMPLE, panels: SAMPLE.panels.map(p => ({...p, dialogue: p.dialogue.map(d => ({...d, tpl: d.tpl.replace(/。|ね|！|…/g, '？')}))}))};
  const a = lay(SAMPLE, '7:5'), c = lay(edited, '7:5');
  assert.deepEqual(a.panels, c.panels);
  assert.deepEqual([a.w, a.h], [c.w, c.h]);
});

test('a width wobble of 0.0156px on every measured atom changes no coordinate (full-width text is never measured; the rounding absorbs the rest)', () => {
  const latin: ComicWorksheet = one([panel('p1', [['me', 'left'], ['col', 'right']], [say('d1', 'me', 'Slack で{a}を共有', {a: {max: 3, prompt: '何を'}}), say('d2', 'col', 'OK、3 時に')]), panel('p2', [], [])]);
  const real = (a: string) => a.length * 8.4;
  const base = lay(latin, '7:5', 0, real);
  for (const d of [0.0156, -0.0156]) assert.deepEqual(lay(latin, '7:5', 0, a => real(a) + d), base);
  const fw = lay(SAMPLE, '7:5', 0, () => { throw new Error('measured a full-width atom'); });
  assert.deepEqual(fw, lay(SAMPLE, '7:5'));
});

test('speechBubble() and comic() refuse what cannot be drawn: ids, kinds, templates, the layouts and the options not built yet', () => {
  assert.throws(() => speechBubble({id: 'a.b', who: 'me', kind: 'say', tpl: 'x'}), /id "a\.b"/);
  assert.throws(() => speechBubble({id: 'a', who: 'me', kind: 'yell' as 'say', tpl: 'x'}), /kind/);
  assert.throws(() => speechBubble({id: 'a', kind: 'say', tpl: 'x'}), /who is the speaker/);
  assert.throws(() => speechBubble({id: 'a', who: 'me', kind: 'say', tpl: '{'}), /not a blank/);
  assert.doesNotThrow(() => speechBubble({id: 'a', kind: 'narration', tpl: '次の日'}));
  assert.throws(() => comic({...SAMPLE, version: 2 as 1}), /version must be 1/);
  assert.throws(() => comic({...SAMPLE, layout: '3x3' as '1x4'}), /layout/);
  assert.throws(() => comic(SAMPLE, {writing: 'vertical' as 'horizontal'}), /not implemented/);
  assert.throws(() => comic(SAMPLE, {dir: 'rtl' as 'ltr'}), /not implemented/);
  assert.throws(() => comic(SAMPLE, {aspect: '16:9' as '1:1'}), /aspect/);
  assert.throws(() => comic({...SAMPLE, panels: [SAMPLE.panels[0]!, SAMPLE.panels[0]!]}), /two panels have the id/);
  assert.throws(() => comic({...SAMPLE, panels: [{...SAMPLE.panels[0]!, id: 'p 1'}]}), /id "p 1"/);
  assert.throws(() => comic({...SAMPLE, cast: {'a.b': {name: 'x'}}}), /cast/);
  const band: ComicBand = comic(SAMPLE, {id: 'story', reveal: 1});
  assert.deepEqual([band.id, band.reveal], ['story', 1]);
  assert.notEqual(band.sheet, SAMPLE, 'the band keeps its own copy');
});

test('the drawing: a panel, its badge, the bubbles with a <title> of the empty sentence, the empty blanks (a dotted line and the prompt), the tails', () => {
  const svg = renderComicBand(lay(SAMPLE, '6:5'));
  assert.equal((svg.match(/data-panel=/g) ?? []).length, 4);
  assert.equal((svg.match(/data-bubble=/g) ?? []).length, 6);
  assert.equal((svg.match(/data-slot=/g) ?? []).length, 5);
  assert.ok(svg.includes('<title>最近、＿＿ね。</title>'));
  assert.ok(svg.includes('>曜日</text>') && svg.includes('stroke-dasharray="2 3"'));
  assert.ok(svg.includes('stroke-dasharray="6 3"'), 'a think bubble is dashed');
  assert.ok(!svg.includes('>{day}'), 'a blank is never drawn as its {id}');
  const line = renderComicBand(lay({...SAMPLE, blank: 'line'}, '6:5'));
  assert.ok(!line.includes('>曜日</text>') && line.includes('data-slot="day"'), "blank: 'line' draws the line only");
  assert.equal(renderComicBand(lay(SAMPLE, '6:5')), svg, 'the same data draws the same SVG');
  assert.ok(!/[<&](?![a-z/!])/.test(svg.replace(/<[^>]*>/g, '')), 'text is escaped');
});

test('balloonPath: body and tail are one closed path; the wedge leaves the side the tip is on and stays on the straight part', async () => {
  const {balloonPath, balloonRadius} = await import('../lib/comic/balloon-path.ts');
  const body = {x: 100, y: 100, w: 200, h: 60};
  const down = balloonPath(body, 'say', {tip: [200, 220]});
  assert.equal((down.d.match(/M/g) ?? []).length, 1);
  assert.ok(down.d.endsWith('Z'));
  assert.deepEqual(down.base, [[208, 160], [192, 160]]);
  assert.ok(down.d.includes('L208 160L200 220L192 160'), down.d);
  // a tip far to the side keeps the wedge off the rounded corner
  const far = balloonPath(body, 'say', {tip: [400, 170]});
  assert.ok(far.d.includes('V') && far.base![0][0] === 300, 'the right side');
  const nearCorner = balloonPath(body, 'say', {tip: [110, 230]});
  assert.ok(nearCorner.base![1][0] >= 100 + balloonRadius('say', 60), 'not on the corner arc');
  assert.equal(balloonPath(body, 'narration', {tip: [0, 0]}).base, undefined, 'a narration has no tail');
  assert.equal(balloonPath(body, 'say').base, undefined);
  assert.deepEqual([balloonRadius('say', 48), balloonRadius('say', 100), balloonRadius('think', 100), balloonRadius('shout', 100), balloonRadius('narration', 100)], [24, 24, 24, 6, 0]);
});

const longLine = (n: number) => '漢'.repeat(n);

test('a tail never enters the head: a flush stack of three 2-line bubbles at 2x2 (the fuzz case) leaves the tip outside the circle, and the minimum tail length holds when there is room', () => {
  const l = lay(one([panel('p1', [['me', 'left']], [say('d1', 'me', longLine(15)), say('d2', 'me', longLine(15)), say('d3', 'me', longLine(15))]), panel('p2', [], []), panel('p3', [], []), panel('p4', [], [])], '2x2'));
  assert.deepEqual(l.findings, []);
  const h = l.panels[0]!.heads[0]!;
  const last = l.bubbles[2]!;
  assert.equal(last.y + last.h, l.panels[0]!.y + 244, 'the stack ends flush against the zone');
  assert.ok(last.tail);
  assert.ok(Math.hypot(last.tail.tip[0] - h.cx, last.tail.tip[1] - h.cy) >= h.r + 1 - 0.1, 'the tip is outside the circle');
  assert.deepEqual(l.bubbles.slice(0, 2).map(b => b.tail), [undefined, undefined], "the speaker's upper bubbles carry no tail");
  // with room: a bubble 13px above a head is 10px of tail, not 7 (TAIL_MIN) and not into the circle
  const head = {id: 'p1.me', who: 'me', name: '私', expression: 'neutral' as const, look: {kind: 'face' as const, hue: 210, hair: 'short' as const}, cx: 50, cy: 97, r: 36, mouth: [50, 112] as [number, number]};
  const t = tailOf({x: 0, y: 0, w: 100, h: 48, kind: 'say'}, head)!;
  assert.equal(t.tip[1] - 48, 10, 'the tail is 10px long (the tip 6px from the circle would make it 7)');
  const tight = tailOf({x: 0, y: 0, w: 100, h: 48, kind: 'say'}, {...head, cy: 48 + 4 + 36, mouth: [50, 48 + 4 + 36 + 15]})!;
  assert.ok(tight.tip[1] <= 48 + 4 - 1 + 0.01 && tight.tip[1] > 48, 'with 4px to the circle the tip stays 1px short of it');
});

test('comic-tail-off-speaker also reports a tail that ends inside the head', () => {
  const l = lay(SAMPLE, '7:5');
  const b = structuredClone(l.bubbles.find(x => x.id === 'p1.d1')!);
  const h = l.panels[0]!.heads[0]!;
  b.tail!.tip = [h.cx, h.cy]; // straight down onto the head's centre: the direction is right, the length is wrong
  const seen: string[] = [];
  checkTail(b, h, (rule, _w, msg) => seen.push(`${rule}: ${msg}`));
  assert.equal(seen.length, 1);
  assert.match(seen[0]!, /inside the head/);
});

test('the tilt of a tail: 9 degrees is within the limit, 11 degrees is reported', () => {
  const h = {id: 'p1.me', who: 'me', name: '私', expression: 'neutral' as const, look: {kind: 'face' as const, hue: 210, hair: 'short' as const}, cx: 0, cy: 300, r: 36, mouth: [0, 100] as [number, number]};
  const tilted = (deg: number) => {
    const a = deg * Math.PI / 180;
    const b = {id: 'p1.d1', panel: 'p1', kind: 'say' as const, x: -50, y: -40, w: 100, h: 40, lines: [], runs: [], slots: [], title: '', tail: {from: [0, 0] as [number, number], tip: [100 * Math.sin(a), 100 * Math.cos(a)] as [number, number], base: [[-8, 0], [8, 0]] as [[number, number], [number, number]]}};
    const seen: string[] = [];
    checkTail(b, h, rule => seen.push(rule));
    return seen;
  };
  assert.deepEqual(tilted(9), []);
  assert.deepEqual(tilted(11), ['comic-tail-off-speaker']);
});

test("a speaker's two bubbles: the tail is on the lower one; a tail behind another speaker's bubble is reported (comic-tail-crosses-bubble)", () => {
  const same = lay(one([panel('p1', [['me', 'left']], [say('d1', 'me', 'はい。'), say('d2', 'me', 'いいえ。')]), panel('p2', [], [])]), '6:5');
  assert.deepEqual(same.bubbles.map(b => !!b.tail), [false, true]);
  assert.deepEqual(same.findings, []);
  // me stands in the middle, col at the left; col's short bubble sits between me's first bubble and me's head
  const sheet = (): ComicWorksheet => ({...one([panel('p1', [['me', 'center'], ['col', 'left']], [say('d0', 'me', longLine(11)), say('d1', 'col', longLine(3)), say('d2', 'me', longLine(7))]), panel('p2', [], []), panel('p3', [], []), panel('p4', [], [])], '2x2')});
  const l = lay(sheet());
  assert.deepEqual(l.findings.map(f => [f.rule, f.where]), [['comic-tail-crosses-bubble', 'p1.d1']]);
  const col = l.bubbles[1]!;
  assert.ok(col.tail, 'the tail is drawn, and reported');
  const behind = [l.bubbles[0]!, l.bubbles[2]!].filter(o => tailCrosses(col.tail!, o));
  assert.equal(behind.length, 1);
  assert.equal(tailCrosses(col.tail!, {...behind[0]!, x: behind[0]!.x + 1000}), false);

  // The artwork reaches d1 and d2. The crossing is still there, but d1 already reports its zone problem.
  const withAsset = sheet();
  withAsset.cast = {...withAsset.cast, col: {name: '同僚', asset: ARTIST.id}};
  const anchors = {head: {cx: 75, cy: 240, r: 56}, mouth: [75, 262] as const, top: -45};
  const asset = {...ARTIST, box: [-25, -50, 200, 500] as const, anchors,
    expressions: {neutral: '<rect x="35" y="-45" width="80" height="400" fill="#222222"/>'}};
  const overflow = layoutComic(comic(withAsset, {characters: {[asset.id]: asset}}), 0, 0, 0, widthOf);
  assert.ok(tailCrosses(overflow.bubbles[1]!.tail!, overflow.bubbles[2]!));
  assert.deepEqual(overflow.findings.map(f => [f.rule, f.where]), [
    ['comic-bubble-zone', 'p1.d1'], ['comic-bubble-zone', 'p1.d2'],
  ]);
});

test('slots: a key of slots that the template does not use, and a fallback or a choice longer than max, are reported', () => {
  const l = lay(one([panel('p1', [['me', 'left']], [say('d1', 'me', '{a}です', {a: {max: 3, prompt: 'あい', fallback: 'なしなしなし', choices: ['月曜日', '火曜日曜']}, b: {max: 2, prompt: 'あい'}})]), panel('p2', [], [])]));
  assert.deepEqual(l.findings.map(f => f.rule), ['comic-slot-max', 'comic-slot-max', 'comic-slot-undefined']);
  assert.match(l.findings[0]!.message, /fallback/);
  assert.match(l.findings[1]!.message, /choice "火曜日曜"/);
  assert.match(l.findings[2]!.message, /no \{b\}/);
});

test('one bubble of four lines is one too many (36 full-width characters), three lines are not', () => {
  const four = lay(one([panel('p1', [['me', 'left']], [say('d1', 'me', longLine(36))]), panel('p2', [], [])]), '6:5');
  assert.deepEqual(four.bubbles[0]!.lines.length, 4);
  assert.deepEqual(four.findings.map(f => f.rule), ['comic-text-budget']);
  assert.deepEqual(lay(one([panel('p1', [['me', 'left']], [say('d1', 'me', longLine(27))]), panel('p2', [], [])]), '6:5').findings, []);
});

test('balloonPath: a narrow body gets a narrower wedge, a side with no straight part gets none, and a tip inside the body or not a number draws no tail', async () => {
  const {balloonPath} = await import('../lib/comic/balloon-path.ts');
  const narrow = balloonPath({x: 0, y: 0, w: 60, h: 100}, 'say', {tip: [30, 300]}); // 24px corners leave 12px of straight edge: the wedge is 12 wide, not 16
  assert.deepEqual(narrow.base, [[36, 100], [24, 100]]);
  assert.equal(balloonPath({x: 0, y: 0, w: 40, h: 100}, 'say', {tip: [20, 300]}).base, undefined, 'no straight part at all');
  const sideways = balloonPath({x: 0, y: 0, w: 200, h: 48}, 'say', {tip: [400, 24]}); // a 48px high body is all arc on its right side
  assert.equal(sideways.base, undefined);
  assert.ok(!sideways.d.includes('L'), 'no wedge');
  assert.equal(balloonPath({x: 0, y: 0, w: 200, h: 100}, 'say', {tip: [100, 50]}).base, undefined, 'a tip inside the body');
  const nan = balloonPath({x: 0, y: 0, w: 200, h: 100}, 'say', {tip: [Number.NaN, 300]});
  assert.equal(nan.base, undefined);
  assert.ok(!nan.d.includes('NaN'));
  assert.equal(balloonPath({x: 0, y: 0, w: 10, h: 100}, 'say').d.includes('NaN'), false);
});

test('f1 rounds to a tenth of a pixel (every coordinate of the SVG is written through it)', () => {
  assert.deepEqual([f1(1.26), f1(1.24), f1(-0.04), f1(100)], [1.3, 1.2, -0, 100]);
});

test('tailCrosses: a bubble beside the centre line but inside the wedge is hit through the wedge\'s edge; one outside the wedge is not', () => {
  // the wedge leaves (-8, 0) and (8, 0) and ends at (0, 100); the centre line is x = 0
  const tail = {from: [0, 0] as [number, number], tip: [0, 100] as [number, number], base: [[8, 0], [-8, 0]] as [[number, number], [number, number]]};
  // the right edge of the wedge runs from (8, 0) to (0, 100): at y = 50 it is at x = 4. A box from x = 3 stands in the wedge; the centre line (x = 0) does not touch it
  const inside = {x: 3, y: 40, w: 20, h: 20};
  assert.equal(tailCrosses({...tail, base: [[8, 0], [8, 0]]}, inside), true, 'with the wedge collapsed onto one side, the right edge is the only thing that reaches it');
  assert.equal(tailCrosses({from: tail.from, tip: tail.tip, base: [[0, 0], [0, 0]]}, inside), false, 'the centre line alone misses it: the test is about the wedge edge');
  assert.equal(tailCrosses(tail, inside), true);
  // beside the wedge: at y = 50 the wedge's edge is at x = 4, so a box from x = 6 is clear
  assert.equal(tailCrosses(tail, {x: 6, y: 40, w: 20, h: 20}), false);
  // the left edge works the same
  assert.equal(tailCrosses(tail, {x: -23, y: 40, w: 20, h: 20}), true);
});

test('balloonPath: a body under 48px wide gets a smaller corner radius (half its width), so the outline never doubles back', async () => {
  const {balloonPath} = await import('../lib/comic/balloon-path.ts');
  const radii = (d: string) => [...d.matchAll(/A([\d.]+) ([\d.]+) /g)].map(m => Number(m[1]));
  assert.deepEqual(radii(balloonPath({x: 0, y: 0, w: 100, h: 100}, 'say').d), [24, 24, 24, 24], 'a wide body: the corners of 24');
  assert.deepEqual(radii(balloonPath({x: 0, y: 0, w: 40, h: 100}, 'say').d), [20, 20, 20, 20], '40 wide: half of it');
  assert.deepEqual(radii(balloonPath({x: 0, y: 0, w: 30, h: 100}, 'think').d), [15, 15, 15, 15]);
  assert.deepEqual(radii(balloonPath({x: 0, y: 0, w: 10, h: 100}, 'shout').d), [5, 5, 5, 5], 'a shout: 6 would not fit in 10');
});

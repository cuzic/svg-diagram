// ADR 0074 D7 / U5: chat() lays the same dialogue out as a chat screen. The data is made up for the ADR (the comic's sample, and a short exchange about a notice).
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {bubblePath, renderChatBand} from '../lib/chat/emit.ts';
import {bubbleRadius, layoutChat} from '../lib/chat/layout.ts';
import {chatMeasure} from '../lib/chat/measure.ts';
import {defaultHue} from '../lib/comic/face.ts';
import {checkDialogueSlots, slotInfo} from '../lib/comic/slot-check.ts';
import {slotSvg} from '../lib/comic/slot-svg.ts';
import {dialogueValueFindings} from '../lib/comic/slot-values.ts';
import {parseTemplate} from '../lib/comic/template.ts';
import {chatRects} from '../lib/verify-chat-rects.ts';
import {chatDims, CHAT_W} from '../lib/chat/constants.ts';

const {column: CHAT_COLUMN, inner: CHAT_INNER} = chatDims(CHAT_W);
import {layoutComic} from '../lib/comic/layout.ts';
import {chat} from '../lib/dsl/chat.ts';
import {comic} from '../lib/dsl/comic.ts';
import {renderBands} from '../lib/core.ts';
import {band} from '../lib/band-def.ts';
import {chatDefinition, isLaidOutChat} from '../lib/bands/chat.ts';
import {comicDefinition} from '../lib/bands/comic.ts';
import type {ChatSheet} from '../lib/types/chat.ts';
import type {Values} from '../lib/types/comic.ts';
import {renderChat, renderComic} from '../lib/web.ts';
import {SAMPLE} from './helpers/comic-sample.ts';
import {measure, widthOf} from './helpers/comic-values.ts';

const lay = (sheet: Parameters<typeof chat>[0], opts: Parameters<typeof chat>[1] = {}) => layoutChat(chat(sheet, opts), 0, 0, 0, widthOf);

const NOTICE: ChatSheet = {
  version: 1, title: '案内', cast: {me: {name: '私'}, ai: {name: '案内係', face: {hue: 120}}},
  dialogue: [
    {id: 'ask', who: 'me', kind: 'say', tpl: '来週の{event}の案内を書いてください。', slots: {event: {max: 6, prompt: '行事'}}},
    {id: 'a1', who: 'ai', kind: 'say', tpl: '承知しました。いただいた内容から、参加者に向けた短い案内文の下書きを作ります。'},
    {id: 'a2', who: 'ai', kind: 'say', tpl: '下書きです。'},
    {id: 'note', kind: 'narration', tpl: '三分後'},
    {id: 'again', who: 'me', kind: 'say', tpl: '{day}でお願いします。', slots: {day: {max: 6, prompt: '日時'}}},
  ],
};

test('the speaker named self is on the right, the others on the left with a face and a name (first message of a run)', () => {
  const laid = lay(NOTICE);
  const byId = Object.fromEntries(laid.bubbles.map(b => [b.id, b]));
  assert.equal(byId['ask']!.mine, true);
  assert.equal(byId['ask']!.x + byId['ask']!.w, CHAT_W - 16, 'a right bubble ends at the content edge');
  assert.equal(byId['a1']!.mine, false);
  assert.equal(byId['a1']!.x, 16 + 40 + 8, 'a left bubble starts beside the face');
  assert.equal(byId['a2']!.x, byId['a1']!.x);
  assert.deepEqual(laid.avatars.map(a => [a.id, a.name]), [['a1', '案内係']], 'one face and name for the run of two messages');
  assert.ok(laid.bubbles.every((b, i) => i === 0 || (laid.bubbles[i - 1]!.y + laid.bubbles[i - 1]!.h <= b.y)), 'stacked in dialogue order, none overlapping');
  assert.deepEqual(laid.bubbles.map(b => b.tail), ['right', 'left', undefined, undefined, 'right'], 'a small tail on the first bubble of a run on the outer side; none on a narration');
  const narration = byId['note']!;
  assert.equal(narration.x + narration.w / 2, CHAT_W / 2);
});

test('the self key defaults to me and can be changed; it must be in the cast', () => {
  const sheet = {...NOTICE, cast: {...NOTICE.cast, you: {name: 'あなた'}}, dialogue: [{id: 'x', who: 'you', kind: 'say' as const, tpl: 'こんにちは'}]};
  assert.equal(lay(sheet).bubbles[0]!.mine, false);
  assert.equal(lay(sheet, {self: 'you'}).bubbles[0]!.mine, true);
  assert.throws(() => chat(NOTICE, {self: 'nobody'}), /self "nobody" is not a key of cast/);
});

test('a bubble is as wide as its longest line: at most the column, and at most 70% of it unless a blank is wider', () => {
  const laid = lay(NOTICE);
  for (const b of laid.bubbles) {
    assert.ok(b.w <= CHAT_COLUMN, `${b.id} is within the column`);
    assert.ok(b.w <= CHAT_INNER + 24, `${b.id} wraps at 70% of the column`);
  }
  const long = laid.bubbles.find(b => b.id === 'a1')!;
  assert.ok(long.lines.length >= 2, 'a long line wraps');
  assert.ok(long.w > 200, 'and fills the width it wraps at');
  assert.equal(long.lines.join(''), '承知しました。いただいた内容から、参加者に向けた短い案内文の下書きを作ります。');
});

test('a word wider than the column is broken per character: no bubble leaves its column (a pasted URL)', () => {
  const url = 'https://example.com/very/long/path/to/the/meeting-minutes-2026-11-25-final-version.pdf';
  const laid = lay({...NOTICE, dialogue: [{id: 'w', who: 'me', kind: 'say', tpl: `参考資料は${url}にあります。`}]});
  const b = laid.bubbles[0]!;
  assert.ok(b.w <= CHAT_COLUMN, `${b.w}px is within the ${CHAT_COLUMN}px column`);
  assert.ok(b.x >= 16 + 40 + 8, 'and inside the frame');
  assert.equal(b.lines.join(''), `参考資料は${url}にあります。`, 'no character is lost');
  assert.deepEqual(laid.findings, []);
});

test('a hard line break (\\n) in a template breaks the line, and \\n\\n leaves an empty line', () => {
  const laid = lay({...NOTICE, dialogue: [{id: 'w', who: 'me', kind: 'say', tpl: '次の文を要約してください。\n\n本文です。'}]});
  assert.deepEqual(laid.bubbles[0]!.lines, ['次の文を要約してください。', '', '本文です。']);
  assert.ok(laid.bubbles[0]!.runs.every(r => !r.text.includes('\n')));
});

test('two chat bands in one SVG draw their faces with distinct ids', async () => {
  const a = chat(NOTICE, {id: 'one'}), b = chat({...NOTICE, dialogue: NOTICE.dialogue.map(d => ({...d, id: `b${d.id}`, slots: undefined, tpl: d.tpl.replace(/\{\w+\}/g, 'X')}))}, {id: 'two'});
  const r = await renderBands([band(chatDefinition, a), band(chatDefinition, b)], {width: 560, measure});
  const ids = [...r.svg.matchAll(/ id="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'every id in the SVG is unique');
  assert.equal([...r.svg.matchAll(/data-avatar=/g)].length, 2);
});

test('when self is omitted and the cast has no me, every message is on the left: a finding with the fix', () => {
  const sheet = {...NOTICE, cast: {user: {name: '利用者'}, ai: {name: '案内係'}}, dialogue: [{id: 'x', who: 'user', kind: 'say' as const, tpl: 'こんにちは'}]};
  assert.deepEqual(lay(sheet).findings.map(f => f.rule), ['chat-self-missing']);
  assert.match(lay(sheet).findings[0]!.message, /self: '<cast key>'/);
  assert.deepEqual(lay(sheet, {self: 'user'}).findings, []);
  assert.deepEqual(lay({...NOTICE, cast: {}, dialogue: [{id: 'n', kind: 'narration', tpl: '静か'}]}).findings, [], 'a narration-only chat has no one to put on the right');
});

test('a line id that is also a blank id is rejected with the name to change', () => {
  assert.throws(() => chat({...NOTICE, dialogue: [{id: 'day', who: 'me', kind: 'say', tpl: '{day}です', slots: {day: {max: 3, prompt: '曜日'}}}]}), /line id "day" is also a blank id.*rename/);
});

test('width scales the column and the 70% wrap width; 800px roughly halves the height of a long exchange', () => {
  const long: ChatSheet = {...NOTICE, dialogue: [
    {id: 'a', who: 'me', kind: 'say', tpl: '次の議事録を読んで、決まったことと残っている課題を分けて、担当者ごとに短く整理した一覧を作ってください。'.repeat(3)},
    {id: 'b', who: 'ai', kind: 'say', tpl: '承知しました。決まったことは三つあります。一つ目は来月の公開日を二十日にすること、二つ目は確認の担当を決めること、三つ目は資料を先に共有することです。'.repeat(3)},
  ]};
  const narrow = lay(long), wide = lay(long, {width: 800});
  assert.equal(wide.w, 800);
  assert.equal(wide.column, 800 - 32 - 48);
  assert.ok(wide.bubbles.every(b => b.w <= wide.column));
  assert.ok(wide.h < narrow.h * 0.65, `${wide.h} vs ${narrow.h}`);
  assert.throws(() => chat(NOTICE, {width: 400}), /width is a whole number from 480 to 880/);
  assert.throws(() => chat(NOTICE, {width: 482}), /steps of 4/);
  assert.equal(lay(NOTICE).w, 480, 'the default is unchanged');
});

test('a blank is the same size in the chat as in the comic, whatever the layout around it', () => {
  const inComic = Object.fromEntries(layoutComic(comic(SAMPLE), 0, 0, 0, widthOf).bubbles.flatMap(b => b.slots.map(s => [s.id, [s.w, s.h, s.max, s.prompt, s.fallback]])));
  const inChat = Object.fromEntries(lay(SAMPLE).bubbles.flatMap(b => b.slots.map(s => [s.id, [s.w, s.h, s.max, s.prompt, s.fallback]])));
  assert.deepEqual(Object.keys(inChat).sort(), ['change', 'day', 'prep', 'what', 'wish']);
  assert.deepEqual(inChat, inComic);
});

test('a comic worksheet gives its dialogue in panel order, with ids panel.line, and separators go between panels', () => {
  const plain = lay(SAMPLE), withLines = lay(SAMPLE, {separators: true});
  assert.deepEqual(plain.bubbles.map(b => b.id), ['p1.d1', 'p2.d1', 'p2.d2', 'p3.d1', 'p3.d2', 'p4.d1']);
  assert.equal(plain.separators.length, 0);
  assert.equal(withLines.separators.length, 3);
  assert.equal(withLines.h - plain.h, 3 * (24 - 12), 'a separator replaces the gap of a run with its own');
  assert.deepEqual(plain.anchors.map(a => a.id).filter(id => !id.includes('.')), ['day', 'what', 'prep', 'change', 'wish'], 'every blank is an anchor');
});

test('the message box is drawn at the bottom for input: <text> or true; a placeholder too wide for it is a problem', () => {
  const none = lay(NOTICE), withBox = lay(NOTICE, {input: '指示を入力'}), stock = lay(NOTICE, {input: true});
  assert.equal(none.input, undefined);
  assert.equal(withBox.input?.text, '指示を入力');
  assert.equal(stock.input?.text, 'メッセージを入力');
  assert.equal(withBox.h - none.h, 16 + 48);
  const last = withBox.bubbles.at(-1)!;
  assert.ok(withBox.input!.y >= last.y + last.h, 'below the last bubble');
  assert.deepEqual(withBox.findings, []);
  const wide = layoutChat(chat(NOTICE, {input: 'W'.repeat(20)}), 0, 0, 0, (t, size) => [...t].length * size * 2);
  assert.deepEqual(wide.findings.map(f => f.rule), ['chat-input-wide']);
  assert.throws(() => chat(NOTICE, {input: ''}), /input is true or the placeholder/);
  assert.throws(() => chat(NOTICE, {input: 'a\nb'}), /one line/);
  assert.throws(() => chat(NOTICE, {input: 'あ'.repeat(21)}), /at most 20/);
});

test('the checks of the blanks and the speakers are the comic ones', () => {
  const laid = lay({...NOTICE, dialogue: [
    {id: 'x', who: 'ghost', kind: 'say', tpl: '{open}と{open}', slots: {open: {max: 3, prompt: '穴埋め'}}},
    {id: 'y', who: 'me', kind: 'say', tpl: '{none}'},
  ]});
  assert.deepEqual([...new Set(laid.findings.map(f => f.rule))].sort(), ['chat-speaker-unknown', 'comic-slot-duplicate', 'comic-slot-undefined']);
});

test('the constructors throw on what cannot be drawn', () => {
  assert.throws(() => chat({version: 2} as never), /version must be 1/);
  assert.throws(() => chat({...NOTICE, dialogue: [NOTICE.dialogue[0]!, NOTICE.dialogue[0]!]}), /two lines have the id "ask"/);
  assert.throws(() => chat({...NOTICE, dialogue: [{id: 'a.b', who: 'me', kind: 'say', tpl: 'あ'}]}), /id "a.b" must be letters/);
});

test('renderChat: a filled value shows the same text in the chat as in the comic, and filling does not move anything', async () => {
  const values = {day: '水曜', what: null, change: '早く帰る'};
  const filled = await renderChat(SAMPLE, {measure, values}), empty = await renderChat(SAMPLE, {measure});
  assert.deepEqual(filled.geometry, empty.geometry, 'values never move the layout');
  const comicFilled = await renderComic(SAMPLE, {measure, values});
  // the blank's own drawing, without its position: the clip path, size, weight, colour and the text are the same
  const shape = (svg: string, id: string) => (svg.match(new RegExp(`<g data-slot="${id}"[^>]*>.*?</g>`, 's'))?.[0] ?? '').replace(/ (?:x|y)="[^"]*"/g, '');
  for (const id of ['day', 'what', 'change']) {
    assert.ok(shape(filled.svg, id).includes('<text'), id);
    assert.equal(shape(filled.svg, id), shape(comicFilled.svg, id), id);
  }
  assert.match(filled.svg, /font-weight="700"[^>]*>水曜<\/text>/);
  assert.deepEqual(filled.findings, []);
  assert.match(filled.svg.match(/<g data-bubble="p1\.d1">.*?<\/title>/s)![0], /毎週水曜は/, 'the title reads with the value');
});

test('renderChat: empty, filled, skipped and too-long states keep the same geometry; a value problem is a finding', async () => {
  const states: Values[] = [{}, {day: '水曜'}, {day: null}, {day: '１２３４５６７８９０'}];
  const results = await Promise.all(states.map(values => renderChat(SAMPLE, {measure, values})));
  for (const r of results) assert.deepEqual(r.geometry, results[0]!.geometry);
  assert.ok(results[3]!.findings.some(f => f.rule === 'comic-value-invalid'), 'more than max characters');
  const bad = await renderChat(SAMPLE, {measure, values: {nope: 'x'}});
  assert.deepEqual(bad.findings.map(f => f.rule), ['comic-values-unknown']);
});

test('renderChat draws the message box and the faces; the verdict is clean', async () => {
  const r = await renderChat(NOTICE, {measure, input: true});
  assert.equal(r.verdict.problems.length, 0, r.verdict.problems.join('\n'));
  assert.match(r.svg, /data-input="message"/);
  assert.equal([...r.svg.matchAll(/data-avatar=/g)].length, 1);
  assert.deepEqual(r.xml, []);
});

test('the selective band draws the same SVG fragment as the full renderer, with node ids', async () => {
  const data = chat(NOTICE, {id: 'sheet', scope: 'talk', input: true});
  const selected = await renderBands([band(chatDefinition, data)], {width: 520, measure});
  assert.deepEqual(selected.xml, []);
  assert.deepEqual(selected.verdict.problems, []);
  assert.match(selected.svg, /data-chat="screen"/);
  assert.equal(band(comicDefinition, comic(SAMPLE)).type, 'comic', 'the comic keeps its own definition');
});

test('the pieces of chat(): the bubble outline, the blank checks and the shared helpers', async () => {
  // bubbleRadius: a one-line bubble (48px) has a 14px corner; a very short one is a pill
  assert.equal(bubbleRadius(48), 14);
  assert.equal(bubbleRadius(20), 10);
  // bubblePath draws the tail only on the side it is asked for: the left one steps out left of x, the right one right of x + w
  const box = {x: 100, y: 0, w: 80, h: 48};
  assert.match(bubblePath({...box, tail: 'left'}), /L92 14L100 14/);
  assert.match(bubblePath({...box, tail: 'right'}), /L188 14L180 24/);
  assert.doesNotMatch(bubblePath(box), /L\d+ 14L/);
  // chatMeasure asks only for the Latin runs of the text (full-width atoms are 1 em and never measured), and the message box's text at its own size
  const data = chat({...NOTICE, dialogue: [{id: 'x', who: 'me', kind: 'say', tpl: 'API{event}です', slots: {event: {max: 2, prompt: '行事'}}}]}, {input: 'Ask'});
  assert.deepEqual(chatMeasure(data).map(([text, size]) => [text, size]), [['API', 18], ['Ask', 16]]);
  // slotInfo and checkDialogueSlots (shared with the comic): 4 em without a definition; a blank defined twice is reported
  assert.deepEqual(slotInfo(NOTICE.dialogue[0]!, 'none'), {max: 4, def: undefined});
  const seen = new Set(['event']), found: string[] = [];
  checkDialogueSlots(NOTICE.dialogue[0]!, 'ask', parseTemplate(NOTICE.dialogue[0]!.tpl), seen, rule => found.push(rule));
  assert.deepEqual(found, ['comic-slot-duplicate']);
  // defaultHue: the colour steps by cast position, the same in both bands
  assert.equal(defaultHue({a: 1, b: 2}, 'a'), 210);
  assert.equal(defaultHue({a: 1, b: 2}, 'b'), (210 + 137) % 360);
  // chatRects: one rectangle per message, holding its blanks (the first also the band's own id)
  const laid = lay(NOTICE, {id: 'talk'});
  const rects = chatRects(laid);
  assert.equal(rects.length, laid.bubbles.length);
  assert.deepEqual(rects[0]!.holds, ['talk', 'event']);
  assert.deepEqual(rects[1]?.holds ?? [], []);
  // renderChatBand with no values draws the blank; dialogueValueFindings is empty for no values; slotSvg is what both bands draw a blank with
  const svg = renderChatBand(laid);
  assert.match(svg, /<g data-slot="event">/);
  assert.ok(isLaidOutChat(laid) && !isLaidOutChat({type: 'comic'}));
  assert.deepEqual(dialogueValueFindings(NOTICE.dialogue, laid, {}), []);
  assert.match(slotSvg(laid.bubbles[0]!.slots[0]!, 'prompt', '', undefined), /行事/);
});

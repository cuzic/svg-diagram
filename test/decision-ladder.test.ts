// decisionLadder() (ADR 0083 U1): a chain of yes/no questions down the left, each "yes" answer to its right, "no" straight down.
import test from 'node:test';
import './helpers/strict-width.ts'; // a label the layout did not register for measuring throws instead of measuring 0 wide
import assert from 'node:assert/strict';
import {checkDiagram, closeMeasurer, connect, decisionLadder, diagram} from '../lib/dsl.ts';
import {isNoFit} from '../lib/fit-width.ts';
import {layoutLadder} from '../lib/ladder.ts';
import {statesWords} from '../lib/states-words.ts';
import {ROLES} from '../lib/tokens.ts';
import type {LaidOutStates} from '../lib/types/diagrams.ts';

test.after(() => closeMeasurer());

const STEPS = [
  {q: '貸出票は書いてある？', yes: '窓口で受け付ける'},
  {q: '返却期限は守れる？', yes: '貸出の手続きに進む'},
  {q: '予約の本はある？', yes: '予約棚から取り出す'},
  {q: '館内で読むだけ？', yes: '閲覧席へ案内する'},
  {q: '次回の入荷を待てる？', yes: '入荷の連絡を登録する', sub: '7 日間有効'},
];
const END = '後日の来館をお願いする';
type R = {x: number; y: number; w: number; h: number};
const overlap = (a: R, b: R): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const laid = async (band: ReturnType<typeof decisionLadder>, opts: {width?: number; density?: 'normal' | 'compact'} = {}) => {
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue', title: 't', ...opts}).add(band));
  return {t: laidOut.laidOut.find((b): b is LaidOutStates => b.type === 'states')!, verdict};
};
const rect = (t: LaidOutStates, id: string): R => t.anchors.find(a => a.id === id)!;
const edge = (t: LaidOutStates, from: string, to: string) => { const i = t.edges.findIndex(e => e.from === from && e.to === to); return {e: t.edges[i]!, chip: t.labels.find(l => l.edge === i)}; };

test('the ids are q1..qN, a1..aN and otherwise, as anchors and as handles', async () => {
  const band = decisionLadder(STEPS, END, {id: 'ld'});
  const {t} = await laid(band);
  assert.deepEqual(t.anchors.map(a => a.id), ['q1', 'a1', 'q2', 'a2', 'q3', 'a3', 'q4', 'a4', 'q5', 'a5', 'otherwise']);
  assert.equal(band.anchors['q1']!.id, 'q1');
  assert.equal(band.anchors['otherwise']!.id, 'otherwise');
  assert.equal(band.type, 'states');
  assert.equal(band.arrange, 'ladder');
});

test('a 5 step ladder passes the check with no problems and no readability warning, and takes a 16:9 slide well', async () => {
  const {t, verdict} = await laid(decisionLadder(STEPS, END), {width: 640});
  assert.deepEqual(verdict.problems, []);
  assert.deepEqual(verdict.findings.filter(f => f.severity === 'warn'), []);
  assert.ok(t.w / t.h > 1.3, `wide enough: ${t.w}x${t.h}`); // measured at 940x436 for the unwrapped text; a ladder is not a tall staircase
  const rects = t.anchors;
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) assert.ok(!overlap(rects[i]!, rects[j]!), `${rects[i]!.id} / ${rects[j]!.id}`);
});

test('every arrow is a straight horizontal or vertical line of two points; yes goes right, no goes down', async () => {
  const {t} = await laid(decisionLadder(STEPS, END));
  assert.equal(t.edges.length, 10);
  for (const e of t.edges) {
    assert.equal(e.points.length, 2, `${e.from} -> ${e.to}`);
    const [p, q] = e.points as [{x: number; y: number}, {x: number; y: number}];
    assert.ok(p.x === q.x || p.y === q.y, `${e.from} -> ${e.to} is straight`);
  }
  for (let i = 1; i <= 5; i++) {
    const yes = edge(t, `q${i}`, `a${i}`).e, q = rect(t, `q${i}`), a = rect(t, `a${i}`);
    assert.equal(yes.points[0]!.x, q.x + q.w); assert.equal(yes.points[1]!.x, a.x); assert.equal(yes.points[0]!.y, q.y + q.h / 2); assert.equal(yes.points[0]!.y, yes.points[1]!.y);
    const to = i < 5 ? `q${i + 1}` : 'otherwise', no = edge(t, `q${i}`, to).e, next = rect(t, to);
    assert.equal(no.points[0]!.y, q.y + q.h); assert.equal(no.points[1]!.y, next.y); assert.equal(no.points[0]!.x, no.points[1]!.x);
  }
});

test('the yes label sits above its arrow and touches no box; the no label sits right of its arrow and does not touch the next question', async () => {
  const {t} = await laid(decisionLadder(STEPS, END));
  for (let i = 1; i <= 5; i++) {
    const y = edge(t, `q${i}`, `a${i}`), c = y.chip!;
    assert.equal(c.text, 'はい');
    assert.ok(c.y + c.h <= y.e.points[0]!.y, 'above the arrow');
    for (const a of t.anchors) assert.ok(!overlap(c, a), `yes chip ${i} on ${a.id}`);
    const to = i < 5 ? `q${i + 1}` : 'otherwise', n = edge(t, `q${i}`, to), nc = n.chip!;
    assert.equal(nc.text, 'いいえ');
    assert.ok(nc.x >= n.e.points[0]!.x, 'right of the arrow');
    for (const a of t.anchors) assert.ok(!overlap(nc, a), `no chip ${i} on ${a.id}`);
  }
});

test('the question boxes are all one width, the answer boxes are all one width, and the final box is as wide as a question', async () => {
  const {t} = await laid(decisionLadder([{q: 'はい？', yes: '短い答え'}, ...STEPS], END));
  const w = (ids: string[]) => new Set(ids.map(id => rect(t, id).w));
  assert.equal(w(['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'otherwise']).size, 1);
  assert.equal(w(['a1', 'a2', 'a3', 'a4', 'a5', 'a6']).size, 1);
  assert.equal(rect(t, 'q1').x, rect(t, 'otherwise').x);
  assert.ok(rect(t, 'q1').x + rect(t, 'q1').w < rect(t, 'a1').x);
});

test('a long question that wraps never leaves a last line shorter than 4 characters', async () => {
  const long = '返却期限が過ぎた本が自宅にあり、かつ延滞の連絡も受けていないのは確かですか？';
  for (const maxNodeW of [undefined, 160, 200, 240, 300]) {
    const steps = [{q: long, yes: '延滞の窓口へ案内する'}, {q: long + 'あ', yes: '返却箱の場所を伝える'}, {q: '短い？', yes: '受け付ける'}];
    const {t} = await laid(decisionLadder(steps, END, maxNodeW === undefined ? {} : {maxNodeW}));
    for (const id of ['q1', 'q2']) {
      const r = rect(t, id), lines = t.texts.filter(x => x.bold && x.x > r.x && x.x < r.x + r.w && x.y > r.y && x.y < r.y + r.h).sort((a, b) => a.y - b.y);
      assert.ok(lines.length >= 1);
      if (lines.length > 1) assert.ok([...lines.at(-1)!.text].length >= 4, `maxNodeW ${maxNodeW} ${id}: last line "${lines.at(-1)!.text}"`);
    }
  }
});

test('the wrapped ladder has the fewest lines for its width (a column is not narrower than it has to be)', async () => {
  const wide = await laid(decisionLadder(STEPS, END)), narrow = await laid(decisionLadder(STEPS, END, {maxNodeW: 120}));
  assert.ok(narrow.t.h > wide.t.h);
});

test('yes / no words: figure-wide, per step, and an empty string drops the label', async () => {
  const words = await laid(decisionLadder(STEPS.map((s, i) => i === 1 ? {...s, yesLabel: 'ある', noLabel: 'ない'} : s), END, {yes: 'Yes', no: 'No'}));
  assert.deepEqual(words.t.labels.map(l => l.text), ['Yes', 'No', 'ある', 'ない', 'Yes', 'No', 'Yes', 'No', 'Yes', 'No']);
  assert.deepEqual(words.verdict.problems, []);
  const bare = await laid(decisionLadder(STEPS, END, {yes: '', no: ''}));
  assert.equal(bare.t.labels.length, 0);
  assert.deepEqual(bare.verdict.problems, []);
  assert.ok(bare.verdict.findings.some(f => f.rule === 'flowchart-decision-edges') === false); // rounded boxes are not decisions: the info is for diamonds only
});

test('a wide yes word makes room: the column gap grows and the chip touches nothing', async () => {
  const a = await laid(decisionLadder(STEPS, END)), b = await laid(decisionLadder(STEPS, END, {yes: '条件を満たしている'}));
  assert.ok(rect(b.t, 'a1').x - (rect(b.t, 'q1').x + rect(b.t, 'q1').w) > rect(a.t, 'a1').x - (rect(a.t, 'q1').x + rect(a.t, 'q1').w));
  assert.deepEqual(b.verdict.problems, []);
});

test("question: 'diamond' draws diamonds, with arrows leaving their vertices, and still passes", async () => {
  const {t, verdict} = await laid(decisionLadder(STEPS, END, {question: 'diamond'}));
  assert.deepEqual(verdict.problems, []);
  assert.deepEqual(t.nodes.filter(n => n.shape === 'diamond').length, 5);
  const q = rect(t, 'q2'), yes = edge(t, 'q2', 'a2').e;
  assert.equal(yes.points[0]!.x, q.x + q.w); assert.equal(yes.points[0]!.y, q.y + q.h / 2);
  assert.ok(t.h > (await laid(decisionLadder(STEPS, END))).t.h);
});

test("density: 'compact' closes the gaps between rows and columns only, and stays free of problems", async () => {
  const normal = await laid(decisionLadder(STEPS, END)), compact = await laid(decisionLadder(STEPS, END), {density: 'compact'});
  assert.ok(compact.t.h < normal.t.h, `${compact.t.h} < ${normal.t.h}`);
  assert.deepEqual(compact.verdict.problems, []);
  assert.ok(!compact.t.densityRestored);
});

test('a figure too narrow for two columns stops with the way out, in the ladder words', async () => {
  await assert.rejects(() => checkDiagram(diagram({theme: 'blue', title: 't', width: 240}).add(decisionLadder(STEPS, END))), (e: Error) => {
    assert.match(e.message, /decisionLadder\(\)/);
    assert.match(e.message, /shorten/);
    assert.match(e.message, /width/);
    assert.doesNotMatch(e.message, /stateDiagram|flowchart/);
    return true;
  });
});

test('the words of messages: decisionLadder() for a ladder band, flowchart() and stateDiagram() as before', () => {
  assert.equal(statesWords('flowchart', 'ladder').who, 'decisionLadder()');
  assert.equal(statesWords('flowchart').who, 'flowchart()');
  assert.equal(statesWords(undefined).who, 'stateDiagram()');
});

test('the input is checked, each message says what to write', () => {
  const need = (f: () => unknown, re: RegExp) => assert.throws(f, (e: Error) => { assert.match(e.message, /^decisionLadder\(/); assert.match(e.message, re); return true; });
  need(() => decisionLadder([], END), /at least one step/);
  need(() => decisionLadder(STEPS, undefined as never), /otherwise/);
  need(() => decisionLadder(STEPS, '' as never), /otherwise/);
  need(() => decisionLadder(STEPS, {label: ''}), /otherwise/);
  need(() => decisionLadder([{q: '', yes: 'x'}], END), /step 1.*q/);
  need(() => decisionLadder([{q: 'x?', yes: ''}], END), /step 1.*yes/);
  need(() => decisionLadder([{q: 'x?', yes: 'y', yesLabl: 'ある'} as never], END), /step 1.*yesLabl/);
  need(() => decisionLadder(STEPS, END, {question: 'hexagon' as never}), /question.*'box'.*'diamond'/);
  need(() => decisionLadder(STEPS, END, {dir: 'right'} as never), /dir/);
  need(() => decisionLadder(STEPS, END, {maxNodeW: 10}), /maxNodeW/);
  need(() => decisionLadder(STEPS, END, {yes: 3 as never}), /yes/);
  need(() => decisionLadder([{q: 'x?', yes: 'y', tone: 'loud' as never}], END), /tone/);
});

test('connect() can reach the ladder boxes by id', async () => {
  const {verdict} = await checkDiagram(diagram({theme: 'blue', title: 't', width: 900}).add(decisionLadder(STEPS, END), connect('a1:right', 'a2:right', {route: 'elbow'} as never)));
  assert.ok(verdict);
});

test('the answer box takes its sub line and tone; the final box may be {label, sub, tone}', async () => {
  const {t} = await laid(decisionLadder([{q: '本は借りたい？', yes: '手続きに進む', sub: '身分証が要る', tone: 'accent'}], {label: '案内して終える', sub: '窓口の外', tone: 'muted'}));
  assert.equal(t.nodes[1]!.tone, 'accent');
  assert.equal(t.nodes[2]!.tone, 'muted');
  assert.ok(t.texts.some(x => x.text === '身分証が要る') && t.texts.some(x => x.text === '窓口の外'));
});

test('PPTX: the questions and answers are editable text in native shapes, not a picture', async () => {
  const {prepareBands} = await import('../lib/core.ts');
  const {planPreparedPptx} = await import('../lib/pptx/selective.ts');
  const {statesPptx} = await import('../lib/pptx/states-band.ts');
  const {decisionLadder: ladderBand} = await import('../lib/bands/states.ts');
  const opts = {measure: ({text, size}: {text: string; size: number}) => ({w: [...text].length * size * 0.6, h: size}), title: '受付'};
  const prepared = await prepareBands([ladderBand(STEPS, END)], opts);
  const selected = planPreparedPptx(prepared, {...opts, bands: {states: statesPptx}, strict: true});
  assert.equal(selected.native, 1);
  assert.deepEqual(selected.fallbacks, []);
  assert.doesNotMatch(selected.plan.xml, /<p:pic>/);
  for (const text of ['貸出票は書いてある？', '窓口で受け付ける', END, '7 日間有効', 'はい', 'いいえ']) assert.match(selected.plan.xml, new RegExp(`<a:t>${text}</a:t>`));
});

test('layoutLadder(): the placement itself, at a given width (a laid-out band, or NoFit when two columns cannot fit)', () => {
  const widthOf = (a: string, size: number) => [...a].length * size; // every character a full-width em
  const env = {wrap: 'phrase' as const, keepWords: false};
  const band = decisionLadder(STEPS, END);
  const wide = layoutLadder(band, 0, 0, 900, widthOf, ROLES, env);
  assert.ok(!isNoFit(wide));
  assert.equal(wide.edges.length, 10);
  assert.equal(wide.arrange, 'ladder');
  assert.ok(wide.x === 0 && wide.w === 900);
  const narrow = layoutLadder(band, 0, 0, 150, widthOf, ROLES, env);
  assert.ok(isNoFit(narrow));
  assert.match(narrow.failure(), /^decisionLadder\(\): the figure does not fit 150px\./);
});

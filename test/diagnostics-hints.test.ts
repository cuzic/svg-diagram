// ADR 0037: the findings say what is wrong (which notation, which word, how long a line may be) and how to accept them.
import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {box, causeTree, checkDiagram, closeMeasurer, diagram} from '../lib/dsl.ts';
import {acceptHint, RULE_DOCS} from '../lib/rules.ts';

test.after(() => closeMeasurer());

const verdictOf = async (d: ReturnType<typeof diagram>) => (await checkDiagram(d)).verdict;

test('legend-missing names the tone, how many boxes use it and which', async () => {
  const d = diagram({theme: 'blue'}).add(box({title: '売上 120%', tone: 'accent'}), box({title: '粗利 40%', tone: 'accent'}), box({title: '普通'}));
  const f = (await verdictOf(d)).findings.find(x => x.rule === 'legend-missing');
  assert.ok(f, 'legend-missing');
  assert.match(f.message, /tone:accent/);
  assert.match(f.message, /accent の色の箱 2 枚/);
  assert.match(f.message, /「売上 120%」/);
  assert.match(f.message, /legend: false/);
});

test('acceptHint: the exact snippet for every acceptable rule, nothing for what cannot be accepted', () => {
  assert.match(acceptHint('toc-ude-count'), /diagram\(\{accept: \{'toc-ude-count': '理由'\}\}\)/);
  assert.match(acceptHint('toc-ude-count'), /"accept": \{"toc-ude-count"/);
  assert.equal(acceptHint('layout'), '');
  for (const rule of Object.keys(RULE_DOCS)) assert.ok(acceptHint(rule).includes(`'${rule}'`), rule);
});

test('a warning printed by the build carries its accept snippet', async () => {
  const v = await verdictOf(diagram({theme: 'blue'}).add(box({title: 'x', tone: 'accent'})));
  const w = v.warnings.find(x => x.startsWith('[legend-missing]'));
  assert.ok(w, v.warnings.join('\n'));
  assert.match(w, /→ 許容するなら diagram\(\{accept: \{'legend-missing': '理由'\}\}\)/);
});

const frtNoResult = (accept?: Record<string, string>) => diagram({theme: 'blue', tocCheck: 'strict', legend: false, ...(accept ? {accept} : {})} as never).add(
  causeTree([{id: 'inj', label: '施策を入れる', role: 'injection'}, {id: 'side', label: '副作用が出る'}], [{from: 'inj', to: 'side'}], {tree: 'frt'}));

test('toc-no-desired-result: strict warns, and an accept with a reason (its own key, or the old toc-parts) makes it info', async () => {
  const warn = (await verdictOf(frtNoResult())).findings.filter(f => f.rule === 'toc-no-desired-result');
  assert.equal(warn.length, 1);
  assert.equal(warn[0]?.severity, 'warn');
  assert.match(warn[0]?.message ?? '', /本文に無い文を足して満たさない/);
  assert.ok(!(await verdictOf(frtNoResult())).findings.some(f => f.rule === 'toc-parts'), 'the missing result is no longer toc-parts');
  for (const key of ['toc-no-desired-result', 'toc-parts']) {
    const f = (await verdictOf(frtNoResult({[key]: '本文に結果の文が無い'}))).findings.find(x => x.rule === 'toc-no-desired-result');
    assert.equal(f?.severity, 'info', key);
    assert.match(f?.message ?? '', /許容: 本文に結果の文が無い/);
  }
});

test('toc-ude-count on a partial CRT: the message shows the snippet, and accept turns it into info', async () => {
  const mk = (accept?: Record<string, string>) => diagram({theme: 'blue', tocCheck: 'strict', legend: false, ...(accept ? {accept} : {})} as never).add(
    causeTree([{id: 'r', label: '根本原因', role: 'root'}, {id: 'u1', label: '現象 1', role: 'ude'}, {id: 'u2', label: '現象 2', role: 'ude'}],
      [{from: 'r', to: 'u1'}, {from: 'r', to: 'u2'}], {tree: 'crt'}));
  const f = (await verdictOf(mk())).findings.find(x => x.rule === 'toc-ude-count');
  assert.equal(f?.severity, 'warn');
  assert.match(f?.message ?? '', /accept: \{'toc-ude-count'/);
  const g = (await verdictOf(mk({'toc-ude-count': '第 1 章だけの部分図'}))).findings.find(x => x.rule === 'toc-ude-count');
  assert.equal(g?.severity, 'info');
});

test('source-wraps says how long the line is, and how long it may be', async () => {
  const long = '出典: ' + '総務省統計局の労働力調査と厚生労働省の毎月勤労統計調査をもとに筆者が集計した'.repeat(2);
  const d = diagram({theme: 'blue', sourceLine: long}).add(box({title: '本文'}));
  const f = (await verdictOf(d)).findings.find(x => x.rule === 'source-wraps');
  assert.ok(f, 'source-wraps');
  assert.match(f.message, /全角で約 \d+ 字分。1 行に入るのは約 \d+ 字分/);
  const [, total, fits] = /約 (\d+) 字分。1 行に入るのは約 (\d+) 字分/.exec(f.message) ?? [];
  assert.ok(Number(total) > Number(fits) && Number(fits) > 10, `${total} vs ${fits}`);
});

test('an NBR that has to be folded to fit crosses: the warning points to dir: right and its width cost; a written dir: right gets no such hint', async () => {
  const nbr = (dir?: 'right') => {
    const nodes: object[] = [{id: 'inj', label: '全拠点に週次報告を義務づける', role: 'injection'}], links: object[] = [];
    for (let i = 0; i < 3; i++) {
      nodes.push({id: `a${i}`, label: `副作用の原因${i}が起きて現場が混乱する`}, {id: `c${i}`, label: `条件${i}が重なる`, role: 'precondition'}, {id: `t${i}`, label: `転換点${i}を越えて悪化する`, role: 'tipping'}, {id: `u${i}`, label: `悪い結果${i}が出る`, role: 'ude'}, {id: `x${i}`, label: `対策${i}を先に打つ`, role: 'trim'});
      links.push({from: 'inj', to: `a${i}`}, {from: [`a${i}`, `c${i}`], to: `t${i}`}, {from: `t${i}`, to: `u${i}`}, {from: `x${i}`, to: `t${i}`, kind: 'blocks'});
    }
    return diagram({theme: 'blue', width: 2400, legend: false}).add(causeTree(nodes as never, links as never, {tree: 'nbr', ...(dir ? {dir} : {})}));
  };
  // wide enough: neither direction crosses (the crossings come from narrowing / folding, not from the shape)
  const wide = await verdictOf(nbr());
  assert.ok(!wide.warnings.some(w => w.startsWith('[cause-')), wide.warnings.join('\n'));
  const wideRight = await verdictOf(nbr('right'));
  assert.ok(!wideRight.warnings.some(w => w.startsWith('[cause-')));
  // the hint is only on a top-bottom NBR's own clash warnings (checked on a narrow canvas, where it is folded)
  const narrow = diagram({theme: 'blue', legend: false}).add(...nbr().bands);
  const clashes = (await verdictOf(narrow)).warnings.filter(x => x.startsWith('[cause-'));
  assert.ok(clashes.length > 0, 'the folded 3-branch NBR crosses (if the font changes and it no longer does, this test needs a larger figure)');
  for (const w of clashes) assert.match(w, /dir: 'right'/);
});

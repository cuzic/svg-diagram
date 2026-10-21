import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {caption, checkDiagram, closeMeasurer, diagram, math, renderDiagram} from '../lib/dsl.ts';
import type {LaidOutMath} from '../lib/types/math.ts';

test.after(() => closeMeasurer());

const FRAC = String.raw`x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}`;

test('math() lays a formula out at its natural size and passes verify', async () => {
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue'}).add(math(FRAC)));
  assert.deepEqual(verdict.problems, []);
  const m = laidOut.laidOut.find(b => b.type === 'math') as LaidOutMath;
  assert.ok(m.w > 40 && m.h > 16, `${m.w} x ${m.h}`);
  assert.equal(m.h % 4, 0, 'the height sits on the 4px grid');
});

test('a bigger role draws the same formula bigger', async () => {
  const size = async (role: 'body' | 'stat') => ((await checkDiagram(diagram({theme: 'blue'}).add(math(FRAC, {role})))).laidOut.laidOut.find(b => b.type === 'math') as LaidOutMath).w;
  assert.ok(await size('stat') > 2 * await size('body'));
});

test('the SVG holds the formula as outlines (no <text>, no foreignObject), named by alt', async () => {
  const {svg} = await renderDiagram(diagram({theme: 'blue'}).add(math(FRAC, {alt: '二次方程式の解の公式', tone: 'accent'})), {name: 'm.svg', budget: 'cacheOnly'});
  const g = /<g data-math="".*?<!--\/math-->/s.exec(svg)![0];
  assert.match(g, /aria-label="二次方程式の解の公式"/);
  assert.match(g, /<path /);
  assert.doesNotMatch(g, /<text|foreignObject|currentColor/);
});

test('the alt defaults to the TeX source', async () => {
  const {svg} = await renderDiagram(diagram({theme: 'blue'}).add(math('a^2+b^2=c^2')), {name: 'm.svg', budget: 'cacheOnly'});
  assert.match(svg, /aria-label="a\^2\+b\^2=c\^2"/);
});

test('align moves the formula within the column', async () => {
  const x = async (align: 'left' | 'center' | 'right') => ((await checkDiagram(diagram({theme: 'blue'}).add(caption('wide caption wide caption wide caption'), math('x', {align})))).laidOut.laidOut.find(b => b.type === 'math') as LaidOutMath).x;
  const [l, c, r] = [await x('left'), await x('center'), await x('right')];
  assert.ok(l < c && c < r);
});

test('a formula that is not TeX, and bad options, throw at the call', () => {
  assert.throws(() => math(String.raw`\frac{1}{`), /math\(\): cannot read the TeX/);
  assert.throws(() => math(String.raw`\notacommand{x}`), /cannot read the TeX/);
  assert.throws(() => math('  '), /needs the TeX source/);
  assert.throws(() => math('x', {align: 'top' as never}), /align must be/);
  assert.throws(() => math('x', {role: 'huge' as never}), /role must be/);
  assert.throws(() => math('x', {reveal: 1} as never), /reveal/);
});

test('a formula wider than the column throws with the way out', async () => {
  await assert.rejects(checkDiagram(diagram({theme: 'blue'}).add(math('x+'.repeat(60) + 'x', {role: 'display'}))), /wide at 56px/);
});

test('inline style sets limits smaller than display style', () => {
  const sum = String.raw`\sum_{k=1}^{n} k`;
  assert.ok(math(sum, {inline: true}).drawing.h < math(sum).drawing.h);
});

test('a macro or a label in one formula does not reach the next one', () => {
  math(String.raw`\def\R{\mathbb{R}} x \in \R`);
  assert.throws(() => math(String.raw`y \in \R`), /cannot read the TeX/);
  math(String.raw`\let\frac\sqrt a`);
  assert.ok(math(String.raw`\frac{2}{3}`).drawing.h > math(String.raw`\sqrt{2}`).drawing.h * 1.3, 'frac is still a fraction');
  assert.deepEqual(math(String.raw`\begin{equation}a\end{equation}`).drawing, math(String.raw`\begin{equation}a\end{equation}`).drawing);
});

test('constructs that would write into the picture, or hold a colour of their own, are refused', () => {
  for (const tex of [String.raw`\href{" onload="x}{y}`, String.raw`\href{a<b>&c}{y}`, String.raw`\style{fill:red}{y}`, String.raw`\unicode[" onload="x]{x41}`, String.raw`\color{red}{y}`, String.raw`\textcolor{red}{y}`, String.raw`\bbox[red]{y}`]) {
    assert.throws(() => math(tex), /cannot read the TeX/, tex);
  }
});

test('\\boxed keeps its frame as a frame (not a solid block over the formula)', () => {
  const g = math(String.raw`\boxed{x}`).drawing.inner;
  assert.match(g, /<rect[^>]*fill="none"/);
});

test('CJK in \\text is drawn as a run of text at a pinned width; equation numbers are refused with a way out', () => {
  const g = math(String.raw`\frac{\text{利益}}{\text{売上高}} = pq`).drawing.inner;
  const runs = [...g.matchAll(/<text [^>]*textLength="(\d+)"[^>]*>([^<]*)<\/text>/g)].map(m => [m[2], Number(m[1])]);
  assert.deepEqual(runs, [['利益', 2000], ['売上高', 3000]]); // one element per word, one em per character
  assert.doesNotMatch(g, /font-family|data-variant/);
  assert.throws(() => math(String.raw`a \tag{1}`), /caption beside the formula/);
});

test('a formula in fill mode only grows as far as the column allows', async () => {
  const {slideCacheKeyForTest} = await import('./helpers/slide-fixture.ts');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'math-fill-'));
  const cwd = process.cwd();
  try {
    process.chdir(dir);
    slideCacheKeyForTest(dir, {maxHeight: 900, contentWidth: 200});
    const d = diagram({day: 2, fill: true, slide: {page: 'pages/p.md', heading: '見出し'}}).add(math(FRAC));
    const r = await renderDiagram(d, {name: 'p.svg', budget: 'cacheOnly'}); // it would reject if the width error escaped the search
    assert.equal(r.budgetSource, 'cache');
    assert.ok((r.fontScale ?? 1) >= 1 && (r.fontScale ?? 1) < 1.8, `scale ${r.fontScale}`);
  } finally {
    process.chdir(cwd);
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('the alt is part of the figure description', async () => {
  const {svg} = await renderDiagram(diagram({theme: 'blue', title: '式'}).add(math('a^2', {alt: 'a の二乗'})), {name: 'm.svg', budget: 'cacheOnly'});
  assert.match(svg, /<desc[^>]*>[^<]*数式: a の二乗/);
});

test('what \\mmlToken, \\ref and \\eqref would put in the picture is refused (base cannot be fenced by package)', () => {
  for (const tex of [String.raw`\mmlToken{mi}[href='a" onload="b']{x}`, String.raw`\mmlToken{mi}[href="javascript:1"]{x}`, String.raw`\mmlToken{mi}[mathcolor="red"]{x}`, String.raw`\mmlToken{mi}[mathbackground="red"]{x}`, String.raw`\mmlToken{mi}[style="fill:red"]{x}`, String.raw`\mmlToken{mi}[id="dup"]{x}`, String.raw`\eqref{a}`, String.raw`\ref{a}`]) {
    assert.throws(() => math(tex), /cannot read the TeX|would put/, tex);
  }
});

test('ordinary formulas are not caught by that fence', () => {
  for (const tex of [String.raw`\begin{pmatrix}1&2\\3&4\end{pmatrix}`, String.raw`\begin{aligned}a&=b\\c&=d\end{aligned}`, String.raw`\boxed{x}`, String.raw`\cancel{x}+\overbrace{a+b}^{n}`, String.raw`\xrightarrow{f}\ce{H2O}`, String.raw`\sqrt[3]{x}\degree`, String.raw`\enclose{circle}{x}\operatorname{sgn}x`]) math(tex);
});

test('fill mode also reads a too-wide multi-line formula as "too big"', async () => {
  const {slideCacheKeyForTest} = await import('./helpers/slide-fixture.ts');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'math-fill2-'));
  const cwd = process.cwd();
  try {
    process.chdir(dir);
    slideCacheKeyForTest(dir, {maxHeight: 900, contentWidth: 200});
    const tex = String.raw`x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
`;
    const r = await renderDiagram(diagram({day: 2, fill: true, slide: {page: 'pages/p.md', heading: '見出し'}}).add(math(tex)), {name: 'p.svg', budget: 'cacheOnly'});
    assert.ok((r.fontScale ?? 1) < 1.8);
  } finally {
    process.chdir(cwd);
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('array rules, enclose strokes and a proof tree are drawn (MathJax leaves their width to a stylesheet the SVG does not have)', () => {
  const rules = math(String.raw`\begin{array}{c|c}a&b\\\hline c&d\end{array}`).drawing.inner;
  assert.doesNotMatch(rules, /class=|style=/);
  assert.match(rules, /<line[^>]*stroke-width="70"/);
  assert.match(math(String.raw`\begin{array}{c:c}a&b\\\hdashline c&d\end{array}`).drawing.inner, /stroke-dasharray="140"/);
  assert.match(math(String.raw`\enclose{longdiv}{12}`).drawing.inner, /stroke-width="67"/);
  math(String.raw`\begin{prooftree}\AxiomC{$A$}\AxiomC{$B$}\BinaryInfC{$A \land B$}\end{prooftree}`);
});

test('a double quote in the TeX source (the default alt) keeps the aria-label well-formed', async () => {
  const r = await renderDiagram(diagram({theme: 'blue'}).add(math('\\text{say "hi"}')), {name: 'm.svg', budget: 'cacheOnly'});
  assert.deepEqual(r.xml, []);
});

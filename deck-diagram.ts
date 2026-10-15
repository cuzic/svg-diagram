#!/usr/bin/env node
// svg-diagram deck <a.ts|a.svg>... --out deck.html [--title TEXT] [--cols N] [--csp] [--no-source-line] [--render svg]
// Several figures in one self-contained HTML document to look through (ADR 0018). A .ts source is drawn in memory (renderSource,
// nothing is written); an .svg is read as it is. The order of the arguments is the order of the slides.
//
// It is all or nothing: when any input fails (verification, a broken XML, a missing file) nothing is written, the exit code is 1,
// and an existing deck.html is neither deleted nor rewritten (ADR 0013) — the message says it is still there. A warning is shown and
// does not stop. `deck` does not run lint-svg: it views what `build` / `check` have passed, it does not replace them.
import fs from 'node:fs';
import path from 'node:path';
import {renderSource} from './lib/render-source.ts';
import {closeMeasurer} from './lib/measure.ts';
import {xmlProblems} from './lib/xml-check.ts';
import {formatBuildError} from './lib/error-format.ts';
import {buildDeck, externalRefs} from './lib/deck-html.ts';
import type {DeckSlide} from './lib/deck-html.ts';
import {viewerAssets} from './lib/deck-viewer.ts';

const USAGE = 'Usage: svg-diagram deck <a.ts|a.svg>... [--out deck.html] [--title TEXT] [--cols N] [--csp] [--no-source-line] [--render svg]\n  (a deck views figures that build / check have passed; it does not lint them)';
const args = process.argv.slice(2);
const VALUE = ['--out', '--title', '--cols', '--render'];
const BOOL = ['--csp', '--no-source-line'];
const usage = (msg?: string): never => { console.error(msg ? `✗ ${msg}\n${USAGE}` : USAGE); process.exit(2); };

for (const [i, a] of args.entries()) {
  if (a.startsWith('--') && ![...VALUE, ...BOOL].includes(a)) usage(`unknown option ${a}`);
  if (VALUE.includes(a) && (args[i + 1] === undefined || args[i + 1].startsWith('--'))) usage(`${a} needs a value`);
}
const val = (n: string): string | undefined => { const i = args.indexOf(n); return i === -1 ? undefined : args[i + 1]; };
const files = args.filter((a, i) => !a.startsWith('--') && !VALUE.includes(args[i - 1]));
if (!files.length) usage();
const bad = files.find(f => !/\.(ts|svg)$/.test(f));
if (bad !== undefined) usage(`${bad}: a deck takes .ts sources and .svg files`);
const out = val('--out') ?? 'deck.html';
const colsArg = val('--cols');
const cols = colsArg === undefined ? undefined : Number(colsArg);
if (cols !== undefined && !(Number.isInteger(cols) && cols >= 1)) usage(`--cols needs a whole number of 1 or more (got ${colsArg})`);
const noSourceLine = args.includes('--no-source-line');
const render = val('--render') ?? 'svg';
if (render === 'html') usage('--render html is not available yet (the SVG form is the one deck draws)');
if (render !== 'svg') usage(`--render is svg (got ${render})`);

const base = (f: string) => path.basename(f).replace(/\.[^.]+$/, '');
try {
  const slides: DeckSlide[] = [];
  const failures: string[] = [];
  for (const file of files) {
    try {
      let svg: string;
      let problems: string[] = [];
      if (file.endsWith('.svg')) {
        svg = fs.readFileSync(file, 'utf8');
        if (noSourceLine) console.error(`⚠ ${file}: .svg の出典行は消えない(.ts から描き直す)`);
        problems = xmlProblems(svg);
      } else {
        const r = await renderSource(file, {fresh: false, ...(noSourceLine ? {noSourceLine: true} : {})});
        svg = r.svg;
        problems = r.problems;
        for (const w of r.warnings) console.error(`⚠ ${file}: ${w}`);
      }
      if (problems.length) { failures.push(formatBuildError(file, new Error(problems.join('\n')))); continue; }
      const ext = externalRefs(svg);
      if (ext.length) console.error(`⚠ ${file}: refers to ${ext.slice(0, 3).join(', ')}${ext.length > 3 ? ', …' : ''} — the deck is no longer self-contained`);
      slides.push({name: base(file), svg});
    } catch (e) {
      failures.push(formatBuildError(file, e));
    }
  }
  if (failures.length) {
    for (const f of failures) console.error(f);
    console.error(`✗ ${failures.length} of ${files.length} inputs failed; nothing was written`);
    if (fs.existsSync(out) && /<main id="deck"/.test(fs.readFileSync(out, 'utf8'))) console.error(`  the previous ${out} is still there, untouched — it does not match the current inputs`);
    process.exitCode = 1;
  } else {
    const {css, js} = viewerAssets();
    const html = buildDeck(slides, {css, js, ...(val('--title') !== undefined ? {title: val('--title')} : {}), csp: args.includes('--csp'), ...(cols !== undefined ? {cols} : {})});
    fs.mkdirSync(path.dirname(path.resolve(out)), {recursive: true});
    fs.writeFileSync(out, html);
    console.log(`wrote ${out} (${slides.length} slide${slides.length === 1 ? '' : 's'})`);
  }
} finally {
  await closeMeasurer(); // measuring a text may have started a browser that would keep the process alive
}

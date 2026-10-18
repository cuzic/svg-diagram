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
import {parseDeckArgs, DECK_USAGE} from './lib/deck-args.ts';

const parsed = parseDeckArgs(process.argv.slice(2));
if (!parsed.ok) { console.error(parsed.error ? `✗ ${parsed.error}\n${DECK_USAGE}` : DECK_USAGE); process.exit(2); }
const {files, out, title, cols, csp, noSourceLine} = parsed.args;

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
    const html = buildDeck(slides, {css, js, ...(title !== undefined ? {title} : {}), csp, ...(cols !== undefined ? {cols} : {})});
    fs.mkdirSync(path.dirname(path.resolve(out)), {recursive: true});
    fs.writeFileSync(out, html);
    console.log(`wrote ${out} (${slides.length} slide${slides.length === 1 ? '' : 's'})`);
  }
} finally {
  await closeMeasurer(); // measuring a text may have started a browser that would keep the process alive
}

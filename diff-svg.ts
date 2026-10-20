#!/usr/bin/env node
// svg-diagram diff old.svg new.svg — what changed between two generated SVGs, in words.
// Exit 0 when nothing visible changed (identical, or metadata / invisible backing only), 1 when the picture changes.
//
// svg-diagram diff --text old.svg new.svg [--no-added] [--strict]
//   Text coverage, for redrawing a hand-written SVG in the DSL: the words, numbers and labels of OLD that NEW no longer carries
//   (and, unless --no-added, the ones only NEW has). Line wrapping, <tspan> splits, spacing, width and case do not count; CJK works.
//   Exit 0 unless --strict is given and something of OLD is missing (1). --missing-text is --text --no-added.
import fs from 'node:fs';
import {explainChange} from './lib/svg-diff.ts';
import {formatTextCoverage, textCoverage} from './lib/text-coverage.ts';

const argv = process.argv.slice(2);
const FLAGS = ['--text', '--missing-text', '--no-added', '--strict'];
const unknown = argv.find(a => a.startsWith('--') && !FLAGS.includes(a));
const [a, b] = argv.filter(x => !x.startsWith('--'));
const textMode = argv.includes('--text') || argv.includes('--missing-text');
if (!a || !b || unknown || (!textMode && (argv.includes('--strict') || argv.includes('--no-added')))) {
  if (unknown) console.error(`✗ ${unknown}: 知らないオプション`);
  else if (a && b) console.error('✗ --strict / --no-added は --text と一緒に使う');
  console.error('Usage: svg-diagram diff old.svg new.svg\n       svg-diagram diff --text old.svg new.svg [--no-added] [--strict]');
  process.exit(2);
}
const read = (f: string): string => { try { return fs.readFileSync(f, 'utf8'); } catch (e) { console.error(`✗ ${f}: 読めない（${(e as NodeJS.ErrnoException).code ?? (e as Error).message}）`); process.exit(2); } };
if (textMode) {
  let r;
  try { r = textCoverage(read(a), read(b)); } catch (e) { console.error(`✗ SVG を読めない: ${(e as Error).message}`); process.exit(2); }
  for (const l of formatTextCoverage(r, !argv.includes('--missing-text') && !argv.includes('--no-added'))) console.log(l);
  process.exit(argv.includes('--strict') && r.missing.length ? 1 : 0);
}
const r = explainChange(read(a), read(b));
for (const l of r.lines) console.log(l);
console.log(r.identical ? '→ 同一' : r.visual ? '→ 見た目が変わる' : '→ 見た目は変わらない');
process.exit(r.visual ? 1 : 0);

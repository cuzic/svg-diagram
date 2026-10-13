// Table <-> diagram coverage: does the figure that replaces a table still carry the table's words and numbers?
// Pure string work, so it can run anywhere and be unit-tested.
//
//   readTable(text, kind)        cells of a Markdown table (or CSV)  ->  [{text, line}]
//   figureText(svg)              the <text> content of a built SVG
//   checkCovers(cells, figure)   cells (and the proper-noun / number tokens in them) the figure does not carry

import {parseXml, elements, textOf} from './svg-dom.ts';

import {must} from './must.ts';
export interface Cell {text: string; line: number}
export interface Uncovered {cell: Cell; missing: string[]}

/** width, case and punctuation/space differences do not count: ＡＢＣ１２３ = abc123, "1,200 円" = "1200円" */
// A decimal point stays (3.5 is not 35) and so does a gap between two numbers ("1 23" is not 123); both as private-use
// characters, so that the punctuation/space strip below leaves them alone.
const DOT = '', GAP = '';
export const normalize = (s: string): string =>
  s.normalize('NFKC').toLowerCase()
    .replace(/(\d),(?=\d{3}(?!\d))/g, '$1')
    .replace(/(\d)\.(?=\d)/g, `$1${DOT}`)
    .replace(/(\d)[\s\p{P}\p{S}・　]+(?=\d)/gu, `$1${GAP}`)
    .replace(/[\s\p{P}\p{S}・　]+/gu, '')
    .replace(/[ー−‐-―]/g, '');

const NUM = new RegExp(`[0-9${DOT}]`);
/** `needle` occurs in `hay` and, where it starts or ends with a digit, is not part of a longer number there (30 is not in 300) */
function contains(hay: string, needle: string): boolean {
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + 1)) {
    const before = NUM.test(needle[0]) && i > 0 && NUM.test(hay[i - 1]);
    const after = NUM.test(needle[needle.length - 1]) && NUM.test(hay[i + needle.length] ?? '');
    if (!before && !after) return true;
  }
  return false;
}

// proper nouns and numbers: numbers (with unit sign), latin words, katakana runs, kanji runs. Hiragana and single kanji are glue words.
const TOKEN = /\d[\d.,]*%?|[a-z][a-z0-9._-]*|[ァ-ヺー]{2,}|[一-鿿㐀-䶿々〆]{2,}/giu;
/** the tokens as written in the cell (NFKC), keyed by their normalised form */
function rawTokens(cell: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of cell.normalize('NFKC').matchAll(TOKEN)) {
    const raw = m[0].replace(/[.,]+$/, ''), n = normalize(raw);
    if (n && !out.has(n)) out.set(n, raw);
  }
  return out;
}
export const tokensOf = (cell: string): string[] => [...rawTokens(cell).keys()];

/** CSV rows with the line each row starts on; a quoted field may hold commas, doubled quotes and line breaks */
function csvRows(text: string): {row: string[]; line: number}[] {
  const rows: {row: string[]; line: number}[] = [];
  let row: string[] = [], cur = '', q = false, line = 1, start = 1;
  const endRow = () => { row.push(cur); if (row.some(c => c.trim())) rows.push({row, line: start}); row = []; cur = ''; start = line; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\n') line++;
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { if (cur.endsWith('\r')) cur = cur.slice(0, -1); endRow(); }
    else cur += c;
  }
  if (cur.endsWith('\r')) cur = cur.slice(0, -1);
  endRow();
  return rows;
}

const stripMd = (s: string): string => s.replace(/<br\s*\/?>/gi, ' ').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`~]/g, '').trim();
const DELIM = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const FENCE = /^\s*(```|~~~)/;
const mdRow = (ln: string): string[] =>
  ln.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '').split(/(?<!\\)\|/).map(c => c.replace(/\\\|/g, '|'));

/** Markdown: the GFM tables (a header row, the |---| rule, then rows up to a blank line; outside code fences) */
function mdRows(text: string): {row: string[]; line: number}[] {
  const lines = text.split(/\r?\n/), rows: {row: string[]; line: number}[] = [];
  let fence = false;
  for (let i = 0; i < lines.length; i++) {
    if (FENCE.test(lines[i])) { fence = !fence; continue; }
    // a header needs a pipe and a rule with as many columns ("Title\n---" is a heading, not a table)
    if (fence || !must(lines[i]).includes('|') || !DELIM.test(lines[i + 1] ?? '') || mdRow(lines[i + 1]).length !== mdRow(lines[i]).length) continue;
    rows.push({row: mdRow(lines[i]), line: i + 1});
    for (i += 2; i < lines.length && must(lines[i]).trim() && must(lines[i]).includes('|') && !FENCE.test(lines[i]); i++) rows.push({row: mdRow(lines[i]), line: i + 1});
    i--;
  }
  return rows;
}

export function readTable(text: string, kind: 'md' | 'csv'): Cell[] {
  text = text.replace(/^\uFEFF/, '');
  const cells: Cell[] = [];
  for (const {row, line} of kind === 'csv' ? csvRows(text) : mdRows(text))
    for (const c of row) { const s = kind === 'md' ? stripMd(c) : c.trim(); if (s) cells.push({text: s, line}); }
  return cells;
}

export function figureText(svg: string): string {
  const root = parseXml(svg);
  return elements(root).filter(e => e.tag === 'text').map(textOf).join('\n');
}

export function checkCovers(cells: Cell[], figure: string): Uncovered[] {
  const fig = normalize(figure), out: Uncovered[] = [];
  for (const cell of cells) {
    const whole = normalize(cell.text);
    if (!whole || contains(fig, whole)) continue;
    const toks = rawTokens(cell.text);
    const missing = [...toks].filter(([n]) => !contains(fig, n)).map(([, raw]) => raw);
    if (missing.length) out.push({cell, missing});
    else if (!toks.size) out.push({cell, missing: [cell.text]});   // nothing to judge by: only an exact (normalised) match counts
  }
  return out;
}

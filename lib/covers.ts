// Table <-> diagram coverage: does the figure that replaces a table still carry the table's words and numbers?
// Pure string work, so it can run anywhere and be unit-tested.
//
//   readTable(text, kind)        cells of a Markdown table (or CSV)  ->  [{text, line}]
//   figureText(svg)              the <text> content of a built SVG
//   checkCovers(cells, figure)   cells (and the proper-noun / number tokens in them) the figure does not carry

import {parseXml, elements, textOf} from './svg-dom.ts';

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

function splitCsvLine(l: string): string[] {
  const out: string[] = []; let cur = '', q = false;
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (q) { if (c === '"') { if (l[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  return [...out, cur];
}

const stripMd = (s: string): string => s.replace(/<br\s*\/?>/gi, ' ').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`~]/g, '').trim();

export function readTable(text: string, kind: 'md' | 'csv'): Cell[] {
  const cells: Cell[] = [];
  text.split(/\r?\n/).forEach((ln, i) => {
    if (!ln.trim()) return;
    let row: string[];
    if (kind === 'csv') row = splitCsvLine(ln);
    else {
      const t = ln.trim();
      if (!t.startsWith('|')) return;
      if (/^\|?[\s:|-]+\|?$/.test(t) && t.includes('-')) return;   // the |---|---| rule
      row = t.replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(c => c.replace(/\\\|/g, '|'));
    }
    for (const c of row) { const s = kind === 'md' ? stripMd(c) : c.trim(); if (s) cells.push({text: s, line: i + 1}); }
  });
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

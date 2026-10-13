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
export const normalize = (s: string): string =>
  s.normalize('NFKC').toLowerCase()
    .replace(/(\d),(?=\d{3}\b)/g, '$1')
    .replace(/[\s\p{P}\p{S}・　]+/gu, '')
    .replace(/[ー−‐-―]/g, '');

// proper nouns and numbers: numbers (with unit sign), latin words, katakana runs, kanji runs. Hiragana and single kanji are glue words.
const TOKEN = /\d[\d.,]*%?|[a-z][a-z0-9._-]*|[ァ-ヺー]{2,}|[一-鿿㐀-䶿々〆]{2,}/giu;
export function tokensOf(cell: string): string[] {
  const out = new Set<string>();
  for (const m of cell.normalize('NFKC').matchAll(TOKEN)) { const n = normalize(m[0]); if (n) out.add(n); }
  return [...out];
}

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
    if (!whole || fig.includes(whole)) continue;
    const toks = tokensOf(cell.text);
    const missing = toks.filter(t => !fig.includes(t));
    if (missing.length) out.push({cell, missing});
    else if (!toks.length) out.push({cell, missing: [cell.text]});   // nothing to judge by: only an exact (normalised) match counts
  }
  return out;
}

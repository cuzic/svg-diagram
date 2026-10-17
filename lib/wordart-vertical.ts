// wordart(): vertical text (縦書き) — splits a column of text into units and sets them in columns, right to left (docs/adr/0009). Pure.
import {textWidth} from './atoms.ts';
import {MIN_FONT_SIZE} from './tokens.ts';
import type {FontFamily, WidthOf} from './types/core.ts';

// ---------------------------------------------------------------------------------------------------------------------------
// vertical text
// ---------------------------------------------------------------------------------------------------------------------------

/** A column advances by this many sizes (the gap between columns is 0.4 of a size). */
export const COLUMN_PITCH = 1.4;
export const BASELINE = 0.36; // a glyph box centred on y has its baseline this many sizes below y

const ROTATED: ReadonlySet<string> = new Set(Array.from('ー―—‐－…‥⋯〜～（）［］｛｝「」『』【】〔〕〈〉《》〝〟'));
/** Marks that hang below a full column rather than start the next one. */
const HANG: ReadonlySet<string> = new Set(Array.from('、。，．'));
/** How many cells a run of marks that may not start a column takes along to the next column: the mark and the cell it follows (a longer run only hangs on). */
const MAX_CARRY = 2;
/** Characters that may not start a column: the cell before them goes with them to the next one. */
const NO_START: ReadonlySet<string> = new Set(Array.from('）］｝」』】〕〉》！？ー〜～…‥ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ・：；'));
const NOT_LAST: ReadonlySet<string> = new Set(Array.from('（［｛「『【〔〈《〝'));
const PUNCT: ReadonlySet<string> = new Set(Array.from('、。，．'));
const SMALL: ReadonlySet<string> = new Set(Array.from('ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ'));

/** The characters a person sees (an emoji with its modifiers, or a joined family, is one). */
export const graphemes = (text: string): string[] => Array.from(new Intl.Segmenter(undefined, {granularity: 'grapheme'}).segment(text), x => x.segment);

/** A unit of a vertical column, before any width is known. */
export type VToken =
  | {kind: 'glyph'; ch: string; dx: number; dy: number; turn: boolean}
  /** A run of 1-2 digits set upright in one cell. */
  | {kind: 'tcy'; text: string}
  /** A Latin word / number set on its side, along the column. */
  | {kind: 'side'; text: string}
  | {kind: 'blank'};

const ASCII_RUN = /^[\x21-\x7e]+(?: +[\x21-\x7e]+)*(?!\p{M})/u; // words (and the single spaces between them) of half-width characters

/** Splits one column of text (no newline) into tokens. Pure; independent of any width. */
export function tokenizeColumn(text: string): VToken[] {
  const out: VToken[] = [];
  let rest = text;
  while (rest) {
    const m = ASCII_RUN.exec(rest);
    if (m) {
      out.push(/^\d{1,2}$/.test(m[0]) ? {kind: 'tcy', text: m[0]} : {kind: 'side', text: m[0]});
      rest = rest.slice(m[0].length);
      continue;
    }
    const ch = graphemes(rest)[0];
    rest = rest.slice(ch.length);
    if (ch === ' ' || ch === '\u3000') out.push({kind: 'blank'});
    else if (ROTATED.has(ch)) out.push({kind: 'glyph', ch, dx: 0, dy: 0, turn: true});
    else if (PUNCT.has(ch)) out.push({kind: 'glyph', ch, dx: 0.5, dy: -0.5, turn: false});
    else if (SMALL.has(ch)) out.push({kind: 'glyph', ch, dx: 0.1, dy: -0.1, turn: false});
    else out.push({kind: 'glyph', ch, dx: 0, dy: 0, turn: false});
  }
  return out;
}

/** The size a 1-2 digit run is set at (it must fit one cell). */
export const tcySize = (size: number): number => Math.min(size, Math.max(MIN_FONT_SIZE, Math.round(size * 0.8)));

export interface VCell {token: VToken; /** px from the column's top. */ top: number; /** px along the column. */ len: number}
export interface VColumn {cells: VCell[]; len: number}

/**
 * Sets text in vertical columns (right to left on the page, so `columns[0]` is the rightmost). A newline starts a column; with `limit`
 * (px), a column that would grow past it breaks first — a character that must not start a column (、。）」ー small kana ...) stays on the
 * previous one, an opening bracket never ends one. `spacing` is added after every cell.
 */
export function verticalColumns(text: string, size: number, weight: number, widthOf: WidthOf, opts: {limit?: number; spacing?: number; font?: FontFamily} = {}): VColumn[] {
  const spacing = opts.spacing ?? 0, limit = opts.limit, font = opts.font ?? 'sans';
  // a cell's final token and its length along the column; a 1-2 digit run that does not fit one cell is turned on its side like any word
  const settle = (t: VToken): {token: VToken; len: number} => {
    if (t.kind === 'side') return {token: t, len: textWidth(widthOf, t.text, size, weight, font)};
    if (t.kind === 'tcy') return textWidth(widthOf, t.text, tcySize(size), weight, font) <= size + 0.5 ? {token: t, len: size} : settle({kind: 'side', text: t.text});
    return {token: t, len: size};
  };
  const nameOf = (t: VToken): string => t.kind === 'glyph' ? t.ch : t.kind === 'blank' ? ' ' : t.text;
  const columns: VColumn[] = [];
  const end = (cells: VCell[]): number => cells.length ? cells[cells.length - 1].top + cells[cells.length - 1].len : 0;
  const stacked = (tokens: {token: VToken; len: number}[]): VCell[] => { const cells: VCell[] = []; for (const t of tokens) cells.push({token: t.token, top: cells.length ? end(cells) + spacing : 0, len: t.len}); return cells; };
  for (const para of text.split('\n')) {
    let cells: VCell[] = [], hung = false;
    const fits = (l: number): boolean => limit === undefined || (cells.length ? end(cells) + spacing : 0) + l <= limit + 0.5;
    const isGlyph = (t: VToken, set: ReadonlySet<string>): boolean => t.kind === 'glyph' && set.has(t.ch);
    const noStart = (t: VToken): boolean => isGlyph(t, NO_START) || isGlyph(t, HANG);
    for (const raw of tokenizeColumn(para)) {
      const {token, len: l} = settle(raw);
      let hangs = false;
      if (cells.length && !fits(l)) {
        if (noStart(token) && !hung) hung = hangs = true; // a mark that may not start a column hangs below this one: one cell at most
        else {
          // break before the token; cells that may not end a column (an opening bracket) or whose follower may not start one (a closing mark)
          // go with it, as many as it takes. A column that would be only opening brackets keeps them (nothing to carry them with).
          const carry: VCell[] = [];
          while (cells.length > 1 && ((carry.length < MAX_CARRY && noStart(carry.length ? carry[0].token : token)) || isGlyph(cells[cells.length - 1].token, NOT_LAST))) carry.unshift(cells.pop()!);
          if (cells.every(c => isGlyph(c.token, NOT_LAST))) { cells.push(...carry); carry.length = 0; }
          columns.push({cells, len: end(cells)});
          cells = stacked(carry.map(c => ({token: c.token, len: c.len}))); hung = false;
        }
      }
      // (the carried cells and the token may not fit together: a closing mark hangs, anything else is too long for a column)
      if (!hangs && !fits(l)) {
        if (cells.length && noStart(token) && !hung) hung = true;
        else if (limit !== undefined && l <= limit + 0.5 && cells.length) { /* a carried bracket and a word that fits only alone: the column runs past the limit by the bracket */ }
        else throw new Error(`wordart(): "${nameOf(token)}" is ${Math.round(l)}px long but a column may be ${Math.round(limit!)}px${cells.length ? ` (with what goes before it, ${Math.round(end(cells) + spacing + l)}px)` : ''}: raise limit or shorten the word`);
      }
      cells.push({token, top: cells.length ? end(cells) + spacing : 0, len: l});
    }
    columns.push({cells, len: end(cells)});
  }
  return columns;
}


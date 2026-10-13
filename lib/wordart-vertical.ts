// wordart(): vertical text (縦書き) — splits a column of text into units and sets them in columns, right to left (docs/adr/0009). Pure.
import {textWidth} from './atoms.ts';
import {MIN_FONT_SIZE} from './tokens.ts';
import type {FontFamily, WidthOf} from './types.ts';

// ---------------------------------------------------------------------------------------------------------------------------
// vertical text
// ---------------------------------------------------------------------------------------------------------------------------

/** A column advances by this many sizes (the gap between columns is 0.4 of a size). */
export const COLUMN_PITCH = 1.4;
export const BASELINE = 0.36; // a glyph box centred on y has its baseline this many sizes below y

const ROTATED = new Set(Array.from('ー―—‐－…‥⋯〜～（）［］｛｝「」『』【】〔〕〈〉《》〝〟'));
const HANG = new Set(Array.from('、。，．）］｝」』】〕〉》！？!?ー〜～…‥ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ・：；'));
const NOT_LAST = new Set(Array.from('（［｛「『【〔〈《〝'));
const PUNCT = new Set(Array.from('、。，．'));
const SMALL = new Set(Array.from('ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ'));

/** A unit of a vertical column, before any width is known. */
export type VToken =
  | {kind: 'glyph'; ch: string; dx: number; dy: number; turn: boolean}
  /** A run of 1-2 digits set upright in one cell. */
  | {kind: 'tcy'; text: string}
  /** A Latin word / number set on its side, along the column. */
  | {kind: 'side'; text: string}
  | {kind: 'blank'};

const ASCII_RUN = /^[\x21-\x7e]+(?: +[\x21-\x7e]+)*/; // words (and the single spaces between them) of half-width characters

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
    const ch = Array.from(rest)[0];
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
  for (const para of text.split('\n')) {
    let cells: VCell[] = [], len = 0;
    const flush = (carry?: VCell): void => { columns.push({cells, len}); cells = []; len = 0; if (carry) push(carry.token, carry.len); };
    const push = (token: VToken, l: number): void => { cells.push({token, top: len, len: l}); len += l + spacing; };
    for (const raw of tokenizeColumn(para)) {
      const {token, len: l} = settle(raw);
      if (limit !== undefined && cells.length && len - spacing + l > limit + 0.5) {
        const noStart = token.kind === 'glyph' && HANG.has(token.ch);
        if (!noStart) {
          const last = cells[cells.length - 1], opening = last.token.kind === 'glyph' && NOT_LAST.has(last.token.ch);
          if (opening) { cells.pop(); len = last.top; flush(last); } else flush();
        }
      }
      if (limit !== undefined && !cells.length && l > limit + 0.5) throw new Error(`wordart(): "${nameOf(token)}" is ${Math.round(l)}px long but a column may be ${Math.round(limit)}px: raise limit or shorten the word`);
      push(token, l);
    }
    flush();
  }
  return columns.map(c => ({cells: c.cells, len: Math.max(0, c.len - spacing)}));
}


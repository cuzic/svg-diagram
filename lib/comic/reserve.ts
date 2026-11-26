// Sizing a bubble's text (ADR 0074 D2 "大きさ"): the template with every blank at its widest (max x 1 em), wrapped by bunsetsu. The values are never
// used here, so filling a blank cannot move anything. Shared with chat() (ADR 0074 D7): the one place the line-break rules live.
import {splitAtoms} from '../atoms.ts';
import {wrapStyledAtoms} from '../wrap.ts';
import {FONT} from './constants.ts';
import {isHiragana} from './width.ts';
import type {TemplatePart} from './template.ts';

export interface ReserveAtom {text: string; /** the blank's id, for a blank */ slot?: string; w: number; /** belongs to the atom before it (one unit for breaking) */ glue?: boolean}
export interface ReservedLine {atoms: ReserveAtom[]; w: number}
export type WrapNote = 'orphan-line' | 'bubble-wide' | 'follower-split';
export interface Reserved {lines: ReservedLine[]; /** the width of the text block */ inner: number; notes: WrapNote[]}

/** The hiragana after a blank that are bound to it: a particle, and any other up to two characters while the unit still fits the inner width (`fit2q`). */
const PARTICLES: ReadonlySet<string> = new Set([...'はがをにでのともへや']);
const FOLLOWER_RUN = 3;
function glued(count: number, ch: string, unitW: number, next: string | undefined, font: number): boolean {
  // で is not a particle in です (the copula): the break after the blank is the natural one there
  return count < 2 && (unitW + font <= 9 * font || (count === 0 && PARTICLES.has(ch) && !(ch === 'で' && next === 'す')));
}

/** The atoms of a template: a blank is one atom of `max` full-width characters (4 when it has no definition), the hiragana after it glued as `glued` says. */
export function templateAtoms(parts: readonly TemplatePart[], maxOf: (id: string) => number, atomWidth: (atom: string) => number, font: number = FONT, breakAt = Infinity): ReserveAtom[] {
  const atoms: ReserveAtom[] = [];
  let afterSlot = false, bound = 0, unitW = 0;
  for (const p of parts) {
    if ('slot' in p) {
      unitW = maxOf(p.slot) * font;
      atoms.push({text: `{${p.slot}}`, slot: p.slot, w: unitW});
      afterSlot = true; bound = 0;
      continue;
    }
    const as = splitAtoms(p.lit);
    for (const [k, a] of as.entries()) {
      const glue = afterSlot && isHiragana(a) && glued(bound, a, unitW, as[k + 1], font);
      if (glue) { bound++; unitW += font; } else afterSlot = false;
      // chat(): a word wider than a bubble can be is broken per character, so no bubble leaves its column
      if (atomWidth(a) > breakAt) { for (const ch of a) atoms.push({text: ch, w: atomWidth(ch)}); continue; }
      atoms.push({text: a, w: atomWidth(a), ...(glue ? {glue: true} : {})});
    }
  }
  return atoms;
}

/** Wraps the atoms into the bubble's lines, widening the inner width when a blank and its hiragana are wider than 9 characters, and once or twice to cure an orphan last line. */
/** `cap`: wrap at this width (a row panel's: never wider than the panel lets a bubble be; no widening for an orphan). `shrink`: the text block is as wide as its widest line, not the 9 em floor. `breakAt`: see `templateAtoms`. `cap` and `shrink` are for the row layouts and chat(). */
export interface ReserveOpts {cap?: number; shrink?: boolean; /** a word wider than this is broken per character (chat) */ breakAt?: number}
export function reserveAtoms(atoms: readonly ReserveAtom[], font: number = FONT, opts: ReserveOpts = {}): Reserved {
  const innerMax = 9 * font;
  let unit = 0, widest = 0;
  for (const a of atoms) { unit = a.slot ? a.w : a.glue ? unit + a.w : 0; widest = Math.max(widest, unit); }
  const wrap = (width: number): ReservedLine[] => wrapStyledAtoms([...atoms], {maxWidth: width, atomWidth: a => a.w, mode: 'bunsetsu'}).map(l => ({atoms: l, w: l.reduce((n, a) => n + a.w, 0)}));
  const base = Math.max(opts.cap ?? innerMax, widest);
  let inner = base, lines = wrap(base);
  const orphan = (ls: ReservedLine[]): boolean => ls.length > 1 && (ls[ls.length - 1]?.w ?? Infinity) <= 2 * font;
  for (const extra of opts.cap === undefined ? [font, 2 * font] : []) {
    if (!orphan(lines) || base + extra > innerMax + 2 * font) break; // never widen past the bubble-wide threshold
    const t = wrap(base + extra);
    if (t.length < lines.length || !orphan(t)) { lines = t; inner = base + extra; }
  }
  const notes: WrapNote[] = [];
  if (orphan(lines)) notes.push('orphan-line');
  const widthMax = Math.max(0, ...lines.map(l => l.w));
  if (widthMax > innerMax + 2 * font) notes.push('bubble-wide');
  if (followerSplit(lines)) notes.push('follower-split');
  return {lines, inner: opts.shrink ? widthMax : Math.max(inner, widthMax), notes};
}

/** A short run of hiragana after a blank (3 characters or fewer) that is cut from it: inside the run, or right after the blank before a particle. */
function followerSplit(lines: readonly ReservedLine[]): boolean {
  const flat = lines.flatMap((l, i) => l.atoms.map((a, k) => ({a, line: i, first: k === 0})));
  for (const [i, f] of flat.entries()) {
    if (!f.a.slot) continue;
    const run: typeof flat = [];
    for (let j = i + 1; j < flat.length && isHiragana((flat[j] as typeof f).a.text); j++) run.push(flat[j] as typeof f);
    if (run.length === 0 || run.length > FOLLOWER_RUN) continue;
    const head = run[0] as typeof f;
    const splitInside = run.some(r => r.line !== head.line);
    const parted = head.line !== f.line && PARTICLES.has(head.a.text) && !(head.a.text === 'で' && run[1]?.a.text === 'す');
    if (splitInside || parted) return true;
  }
  return false;
}

export const reserveDialogue = (parts: readonly TemplatePart[], maxOf: (id: string) => number, atomWidth: (atom: string) => number, font: number = FONT, opts: ReserveOpts = {}): Reserved => reserveAtoms(templateAtoms(parts, maxOf, atomWidth, font, opts.breakAt), font, opts);

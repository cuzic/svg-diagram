// Sizing a bubble's text (ADR 0074 D2 "大きさ"): the template with every blank at its widest (max x 1 em), wrapped by bunsetsu. The values are never
// used here, so filling a blank cannot move anything. Shared with chat() (ADR 0074 D7): the one place the line-break rules live.
import {splitAtoms} from '../atoms.ts';
import {wrapStyledAtoms} from '../wrap.ts';
import {FONT, INNER_MAX} from './constants.ts';
import {isHiragana} from './width.ts';
import type {TemplatePart} from './template.ts';

export interface ReserveAtom {text: string; /** the blank's id, for a blank */ slot?: string; w: number; /** belongs to the atom before it (one unit for breaking) */ glue?: boolean}
export interface ReservedLine {atoms: ReserveAtom[]; w: number}
export type WrapNote = 'orphan-line' | 'bubble-wide' | 'follower-split';
export interface Reserved {lines: ReservedLine[]; /** the width of the text block */ inner: number; notes: WrapNote[]}

/** The hiragana after a blank that are bound to it: a particle, and any other up to two characters while the unit still fits the inner width (`fit2q`). */
const PARTICLES: ReadonlySet<string> = new Set([...'はがをにでのともへや']);
const FOLLOWER_RUN = 3;
function glued(count: number, ch: string, unitW: number, innerMax: number, next?: string): boolean {
  // で is not a particle in です (the copula): the break after the blank is the natural one there
  return count < 2 && (unitW + FONT <= innerMax || (count === 0 && PARTICLES.has(ch) && !(ch === 'で' && next === 'す')));
}

/** The atoms of a template: a blank is one atom of `max` full-width characters (4 when it has no definition), the hiragana after it glued as `glued` says. */
export function templateAtoms(parts: readonly TemplatePart[], maxOf: (id: string) => number, atomWidth: (atom: string) => number, innerMax = INNER_MAX, breakAt = Infinity): ReserveAtom[] {
  const atoms: ReserveAtom[] = [];
  let afterSlot = false, bound = 0, unitW = 0;
  for (const p of parts) {
    if ('slot' in p) {
      unitW = maxOf(p.slot) * FONT;
      atoms.push({text: `{${p.slot}}`, slot: p.slot, w: unitW});
      afterSlot = true; bound = 0;
      continue;
    }
    const as = splitAtoms(p.lit);
    for (const [k, a] of as.entries()) {
      const glue = afterSlot && isHiragana(a) && glued(bound, a, unitW, innerMax, as[k + 1]);
      if (glue) { bound++; unitW += FONT; } else afterSlot = false;
      // chat(): a word wider than a bubble can be is broken per character, so no bubble leaves its column
      if (atomWidth(a) > breakAt) { for (const ch of a) atoms.push({text: ch, w: atomWidth(ch)}); continue; }
      atoms.push({text: a, w: atomWidth(a), ...(glue ? {glue: true} : {})});
    }
  }
  return atoms;
}

/** Wraps the atoms into the bubble's lines, widening the inner width when a blank and its hiragana are wider than 9 characters, and once or twice to cure an orphan last line. */
export function reserveAtoms(atoms: readonly ReserveAtom[], innerMax = INNER_MAX, cap = Infinity): Reserved {
  let unit = 0, widest = 0;
  for (const a of atoms) { unit = a.slot ? a.w : a.glue ? unit + a.w : 0; widest = Math.max(widest, unit); }
  const wrap = (width: number): ReservedLine[] => wrapStyledAtoms([...atoms], {maxWidth: width, atomWidth: a => a.w, mode: 'bunsetsu'}).map(l => ({atoms: l, w: l.reduce((n, a) => n + a.w, 0)}));
  const base = Math.min(cap, Math.max(innerMax, widest)); // chat() caps the inner width at its column; comic() has no cap
  let inner = base, lines = wrap(base);
  const orphan = (ls: ReservedLine[]): boolean => ls.length > 1 && (ls[ls.length - 1]?.w ?? Infinity) <= 2 * FONT;
  for (const extra of [FONT, 2 * FONT]) {
    if (!orphan(lines) || base + extra > Math.min(cap, innerMax + 2 * FONT)) break; // never widen past the bubble-wide threshold
    const t = wrap(base + extra);
    if (t.length < lines.length || !orphan(t)) { lines = t; inner = base + extra; }
  }
  const notes: WrapNote[] = [];
  if (orphan(lines)) notes.push('orphan-line');
  const widthMax = Math.max(0, ...lines.map(l => l.w));
  if (widthMax > innerMax + 2 * FONT) notes.push('bubble-wide');
  if (followerSplit(lines)) notes.push('follower-split');
  return {lines, inner: Math.max(inner, widthMax), notes};
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

/** `innerMax` is the inner width a bubble wraps at (comic: nine full-width characters; chat: 70% of its column, ADR 0074 D7); `cap` the most it may widen to. */
export const reserveDialogue = (parts: readonly TemplatePart[], maxOf: (id: string) => number, atomWidth: (atom: string) => number, innerMax = INNER_MAX, cap = Infinity, breakAt = Infinity): Reserved =>
  reserveAtoms(templateAtoms(parts, maxOf, atomWidth, innerMax, breakAt), innerMax, cap);

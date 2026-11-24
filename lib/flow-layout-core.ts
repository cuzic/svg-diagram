import {textWidth} from './atoms.ts';
import {isSolidTone} from './tokens.ts';
import {resolveFocus, sequenceTones} from './focus.ts';
import {wrapText} from './wrap.ts';
import type {Focus, Rect, Roles, WidthOf, WrapMode} from './types/core.ts';
import {must} from './must.ts';
import type {FlowShapeBand, FlowText, FlowTextTone, LaidOutFlowShape} from './flow-types.ts';

export const BOX_TONES: ReadonlySet<string> = new Set<string>(['plain', 'accent', 'new', 'changed', 'removed', 'muted', 'danger', 'solid', 'solid-danger']);
export const TEXT_TONES: ReadonlySet<string> = new Set<string>(['text', 'accent', 'muted', 'danger']);

export function common(name: string, xs: readonly {label?: string; id?: string}[], id?: string): void {
  if (!xs.length) throw new Error(`${name}(): at least one item is required`);
  const ids = new Set<string>();
  for (const [i, x] of xs.entries()) {
    if (!x.label?.trim()) throw new Error(`${name}(): item ${i + 1} needs a non-empty label`);
    if (x.id && (x.id === id || ids.has(x.id))) throw new Error(`${name}(): duplicate id "${x.id}"`);
    if (x.id) ids.add(x.id);
  }
}
/** focus on a sequence (ADR 0051): a copy of the items, the focused ones 'solid' and the rest 'muted' (by id or 1-based number). */
export function focusItems<T extends {id?: string; tone?: string}>(name: string, items: readonly T[], focus: Focus | undefined): T[] {
  if (focus === undefined) return [...items];
  const tones = sequenceTones(items.length, resolveFocus(focus, items.map(x => x.id), `${name}()`, true));
  return items.map((x, i) => ({...x, tone: must(tones[i])}));
}
/** The text tone on a filled (solid) item: white; otherwise the tone given. */
export const onItem = (tone: string | undefined, base: FlowTextTone): FlowTextTone => isSolidTone(tone) ? 'bg' : base;
export function checkTones(name: string, xs: readonly {tone?: string}[], allowed: ReadonlySet<string>): void {
  xs.forEach((x, i) => { if (x.tone && !allowed.has(x.tone)) throw new Error(`${name}(): item ${i + 1} has unknown tone "${x.tone}" (${[...allowed].join(' | ')})`); });
}

/** The advice for a figure too narrow for its band (ADR 0065): its own `width` when that is what holds it in, else the diagram's (the band's
 * plus the default margins, 20px each side). A spec has no width: spec.ts leaves this out (inSpecTerms). */
export const WIDEN = (b: {width?: number}, need: number): string => b.width !== undefined && b.width < need ? `give it width: ${need} or more` : `widen the diagram (diagram({width: ${need + 40}}) or more)`;
/** A 1-based number, or a label / id, as a 0-based index of `xs`. A name two of them answer to (one's label, another's id; or two with one
 * label) is refused: it would silently take the first. */
export function refIndex(name: string, what: string, ref: number | string, xs: readonly {label: string; id?: string}[]): number {
  if (typeof ref === 'string') {
    const all = xs.flatMap((x, k) => x.id === ref || x.label === ref ? [k] : []);
    if (all.length > 1) throw new Error(`${name}(): ${what} ${JSON.stringify(ref)} names ${all.length} of them (${all.map(k => k + 1).join(', ')}: a label or id twice) — give its number, or an id of its own`);
  }
  const i = typeof ref === 'number' ? (Number.isInteger(ref) && ref >= 1 && ref <= xs.length ? ref - 1 : -1) : xs.findIndex(x => x.id === ref || x.label === ref);
  if (i < 0) throw new Error(`${name}(): ${what} ${JSON.stringify(ref)} is not one of them (1..${xs.length}, or ${xs.map(x => `"${x.id ?? x.label}"`).join(' / ')})`);
  return i;
}
/** The item an item's frame names (ADR 0034): the id, when it has one. */
export const nodeOf = (item: {id?: string}): {node?: string} => item.id ? {node: item.id} : {};

export type TextSpec = [text: string, size: number, weight: 400 | 700];

export type Pt = [number, number];
export const LINE = 1.35; // line step, in font sizes
export const g4 = (v: number): number => Math.round(v / 4) * 4; // circle centres and frames sit on the 4px grid (lint: coordinate-grid)

export function placeFlowShape<B extends FlowShapeBand>(b: B, x: number, y: number, cw: number, widthOf: WidthOf, roles: Roles, mode: WrapMode, draw: FlowLayout<B>): LaidOutFlowShape {
  const w = Math.min(cw, b.width ?? cw), ox = x + (cw - w) / 2;
  const out: LaidOutFlowShape = {type: b.type, id: b.id, reveal: b.reveal, until: b.until, x: ox, y, w, h: 0, primitives: [], texts: [], anchors: [], labelBoxes: []};
  const t = new Texts(out, widthOf, roles, mode);
  const anchor = (id: string | undefined, r: Rect, part?: string) => { if (id) out.anchors.push({id, ...r, ...(part ? {part} : {})}); };
  draw(b, out, t, anchor, roles);
  return out;
}

export type FlowLayout<B> = (b: B, out: LaidOutFlowShape, t: Texts, anchor: AnchorFn, roles: Roles) => void;

/** `part`: the part the anchor is grouped in (ADR 0054), so a connector glued to it follows the item's group. */
export type AnchorFn = (id: string | undefined, r: Rect, part?: string) => void;

/** A wrapped text block: measure it first (lines, height), then place it. */
export class Texts {
  private out: LaidOutFlowShape; readonly widthOf: WidthOf; private roles: Roles; private mode: WrapMode;
  constructor(out: LaidOutFlowShape, widthOf: WidthOf, roles: Roles, mode: WrapMode) { this.out = out; this.widthOf = widthOf; this.roles = roles; this.mode = mode; }
  wrap(text: string, maxW: number, weight: 400 | 700 = 700, size = this.roles.note): {text: string; lines: string[]; h: number; w: number; size: number; weight: 400 | 700} {
    const atomWidth = (a: string) => this.widthOf(a, size, weight, 'sans');
    const lines = wrapText(text, {maxWidth: Math.max(24, maxW), atomWidth, mode: this.mode});
    return {text, lines, h: lines.length * size * LINE, w: Math.max(...lines.map(l => textWidth(this.widthOf, l, size, weight))), size, weight};
  }
  width(text: string, weight: 400 | 700 = 700, size = this.roles.note): number { return textWidth(this.widthOf, text, size, weight); }
  /** The height of one line of note text. */
  lineH(): number { return this.roles.note * LINE; }
  /** Places a wrapped block with its top at `top`; `x` is its centre (middle), left edge (start) or right edge (end). */
  /** `xAt`: a line's own x for the height its middle is at (a slanted shape whose room moves sideways with the height), else `x` for every line. */
  place(block: ReturnType<Texts['wrap']>, x0: number, top: number, tone: FlowTextTone = 'text', anchor: FlowText['anchor'] = 'middle', part?: string, xAt?: (y: number) => number): void {
    const {size, weight} = block;
    block.lines.forEach((line, i) => {
      const tw = textWidth(this.widthOf, line, size, weight), ty = top + i * size * LINE + size * ((LINE - 1.2) / 2 + 1); // the glyph box (1.2 sizes) centred in its line
      const x = xAt ? xAt(ty - size * 0.4) : x0;
      const left = anchor === 'middle' ? x - tw / 2 : anchor === 'start' ? x : x - tw;
      const box = {x: left, y: ty - size, w: tw, h: size * 1.2};
      this.out.texts.push({text: line, tx: x, ty, size, weight, anchor, tone, ...box, ...(part ? {part} : {})});
      this.out.labelBoxes.push({label: block.text, ...box});
    });
  }
}

// ADR 0081: the look of the line from a parent to a child of a tree (TreeItem.edge). Pure helpers shared by the layout, the svg and the pptx.
import {PALETTE, colorOf, toneStyle} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import type {TagTone, Theme} from './types/core.ts';
import type {LaidOutTree, TreeItem} from './types/diagrams.ts';

export type EdgeLine = 'solid' | 'dashed' | 'dotted';
export interface EdgeStyle {tone: TagTone; line: EdgeLine}
type LaidOutEdge = LaidOutTree['edges'][number];

export const DEFAULT_EDGE: EdgeStyle = {tone: 'muted', line: 'solid'};
export const sameEdge = (a: EdgeStyle, b: EdgeStyle): boolean => a.tone === b.tone && a.line === b.line;
export const isDefaultEdge = (s: EdgeStyle): boolean => sameEdge(s, DEFAULT_EDGE);

/** The written `edge` of an item with its defaults filled in (`undefined`, `{}` and `{tone: 'muted', line: 'solid'}` are the same). */
export const normalizeEdge = (item: TreeItem): EdgeStyle => ({tone: item.edge?.tone ?? 'muted', line: item.edge?.line ?? 'solid'});

/** Whether any item of the tree asks for a line that is not the default (then the private segment of each line is widened to 24px). */
export const hasStyledEdge = (items: readonly TreeItem[]): boolean => items.some(n => !isDefaultEdge(normalizeEdge(n)));

export interface Stroke {color: string; line: EdgeLine}
const sameStroke = (a: Stroke, b: Stroke): boolean => a.color === b.color && a.line === b.line;

/**
 * The strokes of one line: `trunk` for the part its siblings share, `own` for the part that is the item's alone. A `focus` lit line is accent
 * (the trunk a solid accent so the way to the root stays whole), a dimmed tree (`spotlight`) is muted; both keep the item's line kind (ADR 0081 table).
 * The line is one path when the two are the same.
 */
export function edgeStrokes(e: LaidOutEdge, dim: boolean | undefined, day: Theme, tones: ToneEnv): {own: Stroke; trunk: Stroke} {
  const s = e.style ?? DEFAULT_EDGE, t = e.trunk ?? s;
  const colorFor = (tone: TagTone): string => tone === 'muted' ? PALETTE.muted : colorOf(toneStyle(tones, tone).ink, day);
  if (dim) return {own: {color: PALETTE.muted, line: s.line}, trunk: {color: PALETTE.muted, line: 'solid'}};
  if (e.lit) { const accent = colorOf('accent', day); return {own: {color: accent, line: s.line}, trunk: {color: accent, line: 'solid'}}; }
  return {own: {color: colorFor(s.tone), line: s.line}, trunk: {color: colorFor(t.tone), line: t.line}};
}
export const isOnePath = (own: Stroke, trunk: Stroke): boolean => sameStroke(own, trunk);

/** Drawing order of the lines (svg and pptx): the default ones, then the styled ones, then the lit ones (a lit line is drawn over the trunk it shares). */
const rank = (e: LaidOutEdge): number => e.lit ? 2 : e.style ? 1 : 0;
export const compareEdgeOrder = (p: LaidOutEdge, q: LaidOutEdge): number => rank(p) - rank(q);

/**
 * Decides `style` (S, the item's own last segment) and `trunk` (T, the part siblings share) of each line (ADR 0081 D2). A group is the lines of one parent
 * that leave from the same first point; a two-point line and a funnel (`from`) line share nothing and belong to no group.
 * `focused`: a line that is not lit is muted (its `edge.tone` is not used) with a solid trunk.
 */
export function assignEdgeStyles(edges: LaidOutEdge[], itemOf: (e: LaidOutEdge) => TreeItem | undefined, focused: boolean): void {
  const own = new Map<LaidOutEdge, EdgeStyle>();
  const groups = new Map<string, LaidOutEdge[]>();
  for (const e of edges) {
    const item = itemOf(e);
    if (!item) continue;
    let s = normalizeEdge(item);
    if (focused && !e.lit) s = {tone: 'muted', line: s.line};
    own.set(e, s);
    const p = e.points[0];
    if (e.points.length <= 2 || item.from !== undefined || !p || e.from === undefined) continue;
    const key = `${e.from}|${p.x}|${p.y}`;
    groups.set(key, [...groups.get(key) ?? [], e]);
  }
  const trunkOf = new Map<LaidOutEdge, EdgeStyle>();
  for (const g of groups.values()) {
    const first = own.get(g[0] as LaidOutEdge) as EdgeStyle;
    const same = g.every(e => sameEdge(own.get(e) as EdgeStyle, first));
    for (const e of g) trunkOf.set(e, focused && !e.lit ? DEFAULT_EDGE : same ? first : DEFAULT_EDGE);
  }
  for (const [e, s] of own) {
    const t = trunkOf.get(e) ?? s;
    if (!isDefaultEdge(s)) e.style = s;
    if (!sameEdge(t, s)) e.trunk = t;
  }
}

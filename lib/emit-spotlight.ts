import type {SpotlightHooks} from './band-def.ts';
import {qualify, scopeOf} from './scope-name.ts';
import {resolveAnchor} from './scope-table.ts';
import type {ScopeTable} from './scope-table.ts';
import {PALETTE} from './tokens.ts';
import type {DiagramData, Dimmed, Rect} from './types/core.ts';
import type {LaidOutBand, LaidOutDiagram} from './types/index.ts';

type SpotlightOption = Pick<DiagramData, 'spotlight'>;
type SpotlightOf<T> = (band: T) => SpotlightHooks<never, object> | undefined;

export function spotlightIds({spotlight}: SpotlightOption): string[] {
  if (!spotlight) return [];
  const ids = typeof spotlight === 'string' ? spotlight : spotlight.ids;
  return typeof ids === 'string' ? [ids] : [...ids];
}

/** How a bar outside the spotlight is drawn: a dotted outline (default) or a pale fill. */
export function spotlightDim({spotlight}: SpotlightOption): 'outline' | 'fill' {
  return typeof spotlight === 'object' ? spotlight.dim ?? 'outline' : 'outline';
}

export function spotlightEdges({spotlight}: SpotlightOption): 'touching' | 'between' {
  return typeof spotlight === 'object' ? spotlight.edges ?? 'touching' : 'touching';
}

export function litEdge(between: boolean, from: boolean, to: boolean): boolean {
  return between ? from && to : from || to;
}

const inside = (b: Rect, r: Rect): boolean => b.x >= r.x - 0.5 && b.y >= r.y - 0.5 && b.x + b.w <= r.x + r.w + 0.5 && b.y + b.h <= r.y + r.h + 0.5;

/** Adds the internal dim flag after geometry is fixed. */
export function applySpotlightWith(
  d: LaidOutDiagram, spotlightOf: SpotlightOf<LaidOutBand>, scopes: ScopeTable,
  missingTarget?: (ids: string[]) => never,
): void {
  const written = spotlightIds(d);
  if (!written.length) return;
  const parts = d.laidOut.map(band => {
    const hooks = spotlightOf(band);
    const id = 'id' in band ? band.id : undefined;
    const ownId = id && hooks?.scopedId ? qualify(scopeOf(band), id) : id;
    return {band, hooks, ownId};
  });
  const targetRects = (id: string, endpoint = false): Rect[] => parts.flatMap(({band, hooks, ownId}) => {
    const children = hooks?.targets?.(band as never, id, endpoint) ?? [];
    return ownId && ownId === id && 'h' in band ? [band, ...children] : children;
  });
  // ADR 0012: a unique bare id can refer to a scoped item; ambiguous ids throw.
  const ids = new Set<string>();
  const rects: Rect[] = [];
  const missing: string[] = [];
  for (const id of written) {
    const resolved = scopes.byBare.has(id) ? resolveAnchor(scopes, id, n => targetRects(n).length > 0) ?? id : id;
    const hits = targetRects(resolved);
    if (hits.length) {
      ids.add(resolved);
      rects.push(...hits);
    } else missing.push(id);
  }
  if (missing.length) {
    if (missingTarget) missingTarget(missing);
    throw new Error(`spotlight の ID が見つかりません（${missing.join('、')}）。帯や部分の ID を確認してください`);
  }
  const focus = {ids, contains: (rect: Rect) => rects.some(r => inside(rect, r))};
  for (const {band, hooks} of parts) {
    if (hooks?.dim) hooks.dim(band as never, focus);
    else band.dim = !('h' in band && focus.contains(band));
  }
  const between = spotlightEdges(d) === 'between';
  const endpointIsFocused = (id: string): boolean => {
    if (focus.ids.has(id)) return true;
    const [hit] = targetRects(id, true);
    return !!hit && focus.contains(hit);
  };
  for (const c of d.connects) c.dim = !litEdge(between, endpointIsFocused(c.fromId), endpointIsFocused(c.toId));
}

/** Mute a band whose emitter does not handle dimming itself. */
export function dimBandSvg(svg: string): string {
  return svg
    .replace(/marker-(start|end)="url\(#dsl-arrow(-strong)?\)"/g, 'marker-$1="url(#dsl-arrow$2-dim)"')
    .replace(/stroke="#[0-9a-fA-F]{6}"/g, `stroke="${PALETTE.muted}"`)
    .replace(/fill="(#[0-9a-fA-F]{6})"/g, (_all, fill: string) => `fill="${fill === PALETTE.bg ? PALETTE.bg : PALETTE.muted}"`);
}

/** Find parts by the same scoped name the layout registers. */
export function anchoredSpotlightTarget(band: {anchors: readonly (Rect & {id: string})[]}, id: string): Rect[] {
  const scope = scopeOf(band);
  return band.anchors.filter(a => qualify(scope, a.id) === id);
}

type Container = Dimmed & {children: (Rect & Dimmed)[]};

export const dimChildren: NonNullable<SpotlightHooks<never, Container>['dim']> = (band, focus) => {
  for (const c of band.children) c.dim = !focus.contains(c);
  band.dim = band.children.every(c => c.dim);
};

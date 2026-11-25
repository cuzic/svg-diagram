import type {fitLineScale} from './layout-cause-fit.ts';
// Vertical-stack layout engine. Top-level bands (caption/box/banner/row/
// grid/spacer/raw/connect) are stacked with an auto-advancing y cursor —
// nothing in this file ever asks a caller for a y coordinate. row() and
// grid() additionally distribute width across their children (by flex
// ratio, or fixed width block-centered) and give every child in the same
// row/grid-row a shared height (the tallest child's own required height),
// matching how every hand-authored diagram in this deck aligns box borders
// across a row.
//
// Two passes: measure every string this diagram uses in ONE Chromium round
// trip (widths are computed structurally first, without needing text
// metrics — flex/grid math is pure arithmetic), then walk bands top-to-
// bottom deriving heights bottom-up (wrapped line count -> block height ->
// row height -> cursor advance) and assigning x/y. connect() bands don't
// consume vertical space; they're resolved in a final pass once every named
// anchor (any box/child with an explicit `id`) has a known rect.

import {atBand, sourceOf} from './source-ref.ts';
import {markPlacedSource} from './layout-ctx.ts';
import type {BandLayoutHandler, LayoutCtx, Placed} from './layout-ctx.ts';
import type {layoutBoxLike} from './layout-box-like.ts';
import type {resolveConnect} from './layout-connect.ts';
import type {prepareConnectorGaps} from './layout-connect-gaps.ts';
import {addScoped} from './scope-table.ts';
import type {ScopeTable} from './scope-table.ts';
import {qualify} from './scope-name.ts';
import type {ContentInventory} from './types/inventory.ts';
import {
  anchorRect, snapGrid, topIcon,
} from './layout-util.ts';
import type {AreasBand, LaidOutConnect, ConnectBand} from './types/containers.ts';
import type {areasPrelayout} from './layout-areas-gaps.ts';
import type {DiagramData, Roles, WidthOf, Rect, WrapMode} from './types/core.ts';
import type {LaidOutDiagram, LaidOutBand, Band} from './types/index.ts';
import type {CaptionBand, BoxBand, BannerBand, BoxChrome} from './types/text-bands.ts';
import {toneEnv} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';


type LayoutResult = Omit<LaidOutDiagram, 'inventory'>;

export interface LayoutServices {
  layoutBoxLike?: typeof layoutBoxLike;
  fitLineScale?: typeof fitLineScale;
  offGrid?: (band: Band) => boolean;
  decorate?: (data: DiagramData) => DiagramData;
  resolveConnect: typeof resolveConnect;
  resolve: (band: Band) => BandLayoutHandler<never>;
  hasChildrenHandler: (band: Band) => boolean;
  childrenOf: (band: Band) => Band[];
  stackWidthOf: (band: Band, width: number) => number | null;
  connectorGaps?: typeof prepareConnectorGaps;
  areasPrelayoutFor?: (band: AreasBand) => typeof areasPrelayout | undefined;
  scopesOf: (bands: readonly Band[]) => ScopeTable;
  buildInventory: (bands: LaidOutBand[], connects: LaidOutConnect[], widthOf: WidthOf, labelSize?: number) => ContentInventory;
}

/** Pass 2, synchronous: lay the diagram out with the widths already measured. */
export function createLayoutWith(services: LayoutServices) {
  return function layoutWith(data: DiagramData, roles: Roles, widthOf: WidthOf): LaidOutDiagram {
    const lay = (mode: WrapMode): LayoutResult => {
      const place = (lines?: LayoutCtx['lines']) => layoutBands(
        services, data, roles, widthOf, toneEnv(data.tones), mode, data.keepWords === true, spaceOf(data.density), lines);
      return services.fitLineScale ? services.fitLineScale(data, place) : place();
    };
    const setting = data.wrap ?? 'phrase';
    const layWithFallback = (): LayoutResult => {
      if (setting !== 'bunsetsu-soft') return lay(setting);
      // A figure that does not fit with bunsetsu wrapping is retried with phrase wrapping.
      // A real mistake of the author (a bad id ...) fails again in the second layout, with its own message.
      try { return lay('bunsetsu'); } catch { return {...lay('phrase'), wrapFellBack: true}; }
    };
    const out = layWithFallback();
    // Inventory errors propagate after layout has selected its final geometry.
    return {...out, inventory: services.buildInventory(out.laidOut, out.connects, widthOf, roles.connectLabel)};
  };
}

/** The scale of the gaps of the layered figures (`WrapEnv.space`): 'compact' closes them by a quarter. */
const spaceOf = (density: 'normal' | 'compact' | undefined): number => density === 'compact' ? 0.75 : 1;

function layoutBands(services: LayoutServices, data: DiagramData, roles: Roles, widthOf: WidthOf, tones: ToneEnv, wrap: WrapMode, keepWords: boolean, space = 1, lines = {seen: 0, drop: 0, exchange: true, taller: false}): LayoutResult {
  const {resolve, hasChildrenHandler, childrenOf, scopesOf} = services;
  const d = services.decorate?.(data) ?? data;
  const contentWidth = d.width - 2 * d.pad;

  // A labelled straight connector between two side-by-side children (right side -> left side) needs room in the gap
  // between them: a label wider than the gap lands on both boxes, or straddles the groups' frame lines. The row's gap grows to fit it.
  // A row on a shared column grid (`cols`) keeps its column edges aligned with the other rows of that grid, so the gap grows for
  // every row declaring the same `cols` + `gap` (the widest need wins), not for the one row that has the label.
  // One between two bands that follow each other (bottom side -> top side) widens the space after the first band (ADR 0069 D1).
  // The room a label needs is labelRoom() (lib/connect-rules.ts), what the checks measure too.
  const labelled: ConnectBand[] = [];
  const collectConnects = (bs: Band[]): void => {
    for (const b of bs) {
      // Report missing layout definitions before walking the legacy child table.
      // ADR 0080 D4: U1a-2 replaces this guard by walking children through the band definition.
      if (!hasChildrenHandler(b)) atBand(b, () => resolve(b));
      if (b.type === 'connect' && b.label && b.route === 'straight' && !b.annot) labelled.push(b);
      else collectConnects(childrenOf(b));
    }
  };
  collectConnects(d.bands);
  const gaps = labelled.length ? services.connectorGaps?.(services, d.bands, labelled, contentWidth, d.gap, roles, widthOf) : undefined;

  // ---- pass 2: layout top-to-bottom ----
  const laidOut: LaidOutBand[] = [];
  const anchors = new Map<string, Rect>(); // id -> {x,y,w,h}
  const nodeBottoms = new Map<string, number>(); // a node's anchor is its icon; an arrow leaving its bottom starts under the label
  const areaIds = new Set<string>();       // ids of rows and row columns: anchors that hold other boxes
  const setBox = (id: string, c: Parameters<typeof anchorRect>[0], h: number): void => {
    anchors.set(id, anchorRect(c, h));
    if (c.type === 'box' && topIcon(c)) nodeBottoms.set(id, c.y + h); else nodeBottoms.delete(id);
  };
  const claimed = (id: string, what: string): never => { throw new Error(`duplicate anchor id "${id}": ${what} — every id (and every row's "id#n" column ids) must be unique`); };
  const connects: LaidOutConnect[] = [];
  const deferred: ConnectBand[] = []; // connect()s that came before the boxes they name

  const scopes = scopesOf(d.bands); // every scoped item, read before layout: a bare id is ambiguous whatever order the bands came in
  const placeBoxLike = <B extends CaptionBand | BoxBand | BannerBand>(band: B, x: number, y0: number, w: number, isBoxLike: boolean, scope?: string): Placed<B> => {
    const place = services.layoutBoxLike;
    if (!place) throw new Error(`Missing box-like layout for "${band.type}"`);
    const placed = place(band, x, y0, w, isBoxLike, widthOf, roles, wrap);
    const {y, h} = placed;
    const chrome = band as BoxChrome;
    const name = chrome.id ? qualify(scope, chrome.id) : undefined;
    if (chrome.id && name !== undefined && (areaIds.has(name) || anchors.has(name))) claimed(name, 'a box takes an id that another box, group or row already has');
    if (chrome.id && name !== undefined) { setBox(name, {...band, x, y, w, h} as never, h); if (scope) addScoped(scopes, scope, chrome.id); }
    return placed;
  };

  const register = (id: string, rect: Rect, what: string, scope?: string): void => {
    const name = qualify(scope, id);
    if (anchors.has(name)) claimed(name, what);
    anchors.set(name, rect);
    if (scope) addScoped(scopes, scope, id);
  };
  const ctx: LayoutCtx = {
    d, roles, widthOf, tones, wrap, keepWords, space, lines, y: d.pad, laidOut, anchors, nodeBottoms, areaIds, connects, deferred, scopes,
    setBox, claimed, register, placeBoxLike,
    originOf: (band, y) => services.offGrid?.(band) ? y : snapGrid(y),
    gapForLabels: (band, width) => gaps?.gapForLabels(band, width) ?? band.gap,
    areasGapFor: (band, width) => gaps?.areasGapFor(band, width) ?? {gap: band.gap, rowGap: band.rowGap},
    stack: (bands, padX, cw) => {
      for (const band of bands) atBand(band, () => {
        const start = laidOut.length;
        resolve(band)(band as never, ctx, padX, cw);
        // resolveConnect spreads the input band, keeping its own SOURCE for immediate and deferred connections.
        markPlacedSource(laidOut, start, sourceOf(band));
        const extra = gaps?.bandGaps.get(band); // room for a label on the arrow down to the next band (ADR 0069 D1)
        if (extra) ctx.y += extra;
      });
    },
  };
  ctx.stack(d.bands, d.pad, contentWidth);
  // the framed groups, for connect({via}) (ADR 0069 D2): their final rectangles (a row / areas() has stretched them by now)
  const frames = laidOut.flatMap(b => b.type === 'group' && b.frame !== false ? [{x: b.x, y: b.y, w: b.w, h: b.h, id: b.id}] : []);
  for (const band of deferred) atBand(band, () => {
    connects.push(services.resolveConnect(band, anchors, areaIds, widthOf, roles, nodeBottoms, scopes, frames));
  });

  const contentHeight = Math.round(ctx.y - d.gap + d.pad);
  // canvas: at least its height, unless fit: 'content' (then as tall as the content; an overflow is still drawn and warned)
  const canvasHeight = d.canvas && d.canvas.fit !== 'content' ? Math.max(contentHeight, d.canvas.height) : contentHeight;

  return {...data, laidOut, canvasHeight, ...(data.canvas ? {contentHeight} : {}), connects, roles};
}

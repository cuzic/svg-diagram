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

import {textWidth} from './atoms.ts';
import {layoutHandlerFor} from './layout-handlers.ts';
import type {LayoutCtx, Placed, RowLike} from './layout-ctx.ts';
import {setWrapMode} from './wrap.ts';
import {childrenOf, stackWidthOf} from './band-children.ts';
import {layoutBoxContent, lineWidth} from './layout-text.ts';
import {parseRef, resolveConnect} from './layout-connect.ts';
import {addScoped, qualify, scopesOf} from './anchor-scope.ts';
import {
  BOX_PAD_X, BOX_PAD_Y, ICON_H, STAMP_GAP, STAMP_H, TAG_H, TAG_PAD_X, TOP_ICON_GAP, TOP_ICON_SIZE,
  anchorRect, colSlots, rowChildGeometry, snapGrid, stampChipW, topIcon, withSourceLine,
} from './layout-util.ts';
import type {LaidOutConnect, ConnectBand} from './types/containers.ts';
import type {DiagramData, Roles, WidthOf, Rect} from './types/core.ts';
import type {LaidOutDiagram, LaidOutBand, Band} from './types/index.ts';
import type {CaptionBand, BoxBand, BannerBand, BoxChrome} from './types/text-bands.ts';
import {CONNECT_LABEL_SIZE, TAG_SIZE, withTones} from './tokens.ts';

/** Pass 2, synchronous: lay the diagram out with the widths already measured. */
export function layoutWith(data: DiagramData, roles: Roles, widthOf: WidthOf): LaidOutDiagram {
  const prev = setWrapMode(data.wrap ?? 'phrase');
  try { return withTones(data.tones, () => layoutBands(data, roles, widthOf)); } finally { setWrapMode(prev); }
}

function layoutBands(data: DiagramData, roles: Roles, widthOf: WidthOf): LaidOutDiagram {
  const d = withSourceLine(data);
  const contentWidth = d.width - 2 * d.pad;

  // A labelled straight connector between two side-by-side children (right side -> left side) needs room in the gap
  // between them: a label wider than the gap lands on both boxes, or straddles the groups' frame lines. The row's gap grows to fit it.
  // A row on a shared column grid (`cols`) keeps its column edges aligned with the other rows of that grid, so the gap grows for
  // every row declaring the same `cols` + `gap` (the widest need wins), not for the one row that has the label.
  const labelled: ConnectBand[] = [];
  const collectConnects = (bs: Band[]): void => { for (const b of bs) { if (b.type === 'connect' && b.label && b.route === 'straight') labelled.push(b); else collectConnects(childrenOf(b)); } };
  collectConnects(d.bands);
  const idsIn = (b: Band, out = new Set<string>()): Set<string> => { const x = b as {id?: string}; if (x.id) out.add(x.id); for (const c of childrenOf(b)) idsIn(c, out); return out; };
  const LABEL_MARGIN = 6; // clear space between a label and the boxes / frame lines on either side
  const MIN_CHILD_W = 80;
  // the gap one row needs for the labelled connectors between neighbours that sit side by side
  const gapNeeded = (band: RowLike): number => {
    if (!labelled.length) return band.gap;
    const kids = band.children.map(c => idsIn(c));
    const slots = band.cols ? colSlots(band.children) : null;
    let gap = band.gap;
    for (const c of labelled) {
      const f = parseRef(c.from), t = parseRef(c.to);
      const i = kids.findIndex(k => k.has(f.id)), j = kids.findIndex(k => k.has(t.id));
      if (i < 0 || j < 0 || Math.abs(i - j) !== 1 || !((i < j && f.side === 'right' && t.side === 'left') || (i > j && f.side === 'left' && t.side === 'right'))) continue;
      if (slots) { const [a, b] = i < j ? [slots[i], slots[j]] : [slots[j], slots[i]]; if (b.col !== a.col + a.span) continue; } // empty columns between them already leave room
      gap = Math.max(gap, Math.ceil(textWidth(widthOf, c.label as string, (roles.connectLabel ?? CONNECT_LABEL_SIZE), 400) + (c.chip ? 16 : 0) + 2 * LABEL_MARGIN));
    }
    return gap;
  };
  const sharedGaps = new Map<string, number>(); // `${cols}/${gap}` -> the gap every row of that column grid uses (filled just below)
  const gapForLabels = (band: RowLike, cw: number): number => {
    if (band.cols) return sharedGaps.get(`${band.cols}/${band.gap}`) ?? band.gap;
    if (band.justify !== 'stretch' || !labelled.length) return band.gap; // fixed-width rows would overflow the canvas
    const gap = gapNeeded(band);
    const maxGap = band.children.length > 1 ? (cw - band.children.length * MIN_CHILD_W) / (band.children.length - 1) : band.gap;
    return gap <= maxGap ? gap : band.gap; // would squeeze the children: keep the gap (verify reports the label that does not fit)
  };

  {
    const grids = new Map<string, {need: number; rows: {cw: number; spans: number[]}[]}>();
    const walk = (bs: Band[], cw: number): void => {
      for (const b of bs) {
        const inner = stackWidthOf(b, cw);
        if (inner !== null) walk(childrenOf(b), inner);
        else if ((b.type === 'row' || b.type === 'grouprow') && b.cols) {
          const key = `${b.cols}/${b.gap}`, g = grids.get(key) ?? {need: b.gap, rows: []};
          g.need = Math.max(g.need, gapNeeded(b as RowLike));
          g.rows.push({cw, spans: colSlots((b as RowLike).children).map(s => s.span)});
          grids.set(key, g);
          if (b.type === 'grouprow') { // (nested widths use the declared gap: the shared one is not known until every row has been seen)
            const {widths} = rowChildGeometry(b, cw);
            b.children.forEach((c, i) => { if (c.type === 'group') walk(c.children, widths[i] - 2 * (c.pad ?? 16)); });
          }
        } else if (b.type === 'grouprow') {
          const {widths} = rowChildGeometry({...b, gap: gapForLabels(b as RowLike, cw)}, cw); // the same gap the real pass will use
          b.children.forEach((c, i) => { if (c.type === 'group') walk(c.children, widths[i] - 2 * (c.pad ?? 16)); });
        }
      }
    };
    walk(d.bands, contentWidth);
    for (const [key, g] of grids) {
      const [cols, base] = key.split('/').map(Number);
      const width = (cw: number, span: number, gap: number) => span * ((cw - (cols - 1) * gap) / cols) + (span - 1) * gap;
      // growing must not squeeze a box: each child keeps >= 70% of its width (and >= 40px) or the gap stays as declared (verify reports the label)
      const fits = g.need === base || g.rows.every(r => r.spans.every(sp => width(r.cw, sp, g.need) >= Math.min(width(r.cw, sp, base), Math.max(40, 0.7 * width(r.cw, sp, base)))));
      sharedGaps.set(key, fits ? g.need : base);
    }
  }
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
    const y = snapGrid(y0); // the top sits on the grid, so its text (y + padY + line offset) is always the same distance below the frame the emitter draws
    const chrome = band as BoxChrome; // caption has no padX / padY / tag / id: they read as undefined (its `tone` is a TextTone, unused here)
    const wrapWidth = isBoxLike ? w - 2 * (chrome.padX ?? BOX_PAD_X) : w;
    const content = layoutBoxContent(band, wrapWidth, widthOf, roles);
    // an icon above the text pushes every line down by its own height; a left icon only sets a minimum height
    const topShift = band.type === 'box' && topIcon(band) ? ((band as BoxBand).iconSize ?? TOP_ICON_SIZE) + TOP_ICON_GAP : 0;
    // a left icon is taller than a line or two of text: the text is centred beside it, not hung from the top with the room left below
    const leftIcon = band.type === 'box' && !!band.icon && !topShift;
    const centre = leftIcon && content.textHeight < ICON_H ? Math.round((ICON_H - content.textHeight) / 2) : 0;
    const shift = topShift + centre;
    const wrappedRuns = shift ? content.wrappedRuns.map(r => ({...r, lineYs: r.lineYs.map(y => y + shift)})) : content.wrappedRuns;
    const textHeight = leftIcon ? Math.max(content.textHeight, ICON_H) : content.textHeight + topShift;
    const stamp = isBoxLike ? chrome.stamp : undefined;
    const stampW = stamp ? stampChipW(widthOf, stamp, roles) : undefined;
    if (stampW !== undefined && stampW > w - 16) throw new Error(`stamp "${stamp}" is wider than its box (${Math.round(w)}px): shorten it or widen the box`);
    const h = (isBoxLike ? textHeight + 2 * (chrome.padY ?? BOX_PAD_Y) : textHeight) + (stamp ? STAMP_H + STAMP_GAP : 0);
    const placed = {...band, x, y, w, h, wrappedRuns} as unknown as Placed<B>; // spreading a generic loses the intersection
    if (stampW !== undefined) (placed as Placed<B> & {stampW?: number}).stampW = stampW;
    // a centred / right-aligned title: the step badge sits just before its first line, so emit needs that line's width
    if (band.type === 'box' && band.step != null && band.title && (band.align ?? (topIcon(band) ? 'center' : 'left')) !== 'left') (placed as Placed<B> & {titleW?: number}).titleW = lineWidth(widthOf, wrappedRuns[0], 0);
    if (band.type === 'box') {
      const overflow = wrappedRuns.filter(r => r.nowrap && textWidth(widthOf, r.text, r.size, r.weight, r.mono ? 'mono' : 'sans') > wrapWidth - (r.indent ?? 0) + 0.5).map(r => r.text);
      if (overflow.length) (placed as Placed<BoxBand> & {nowrapOverflow?: string[]}).nowrapOverflow = overflow;
    }
    if (chrome.tag) {
      const tw = textWidth(widthOf, chrome.tag, (roles.tag ?? TAG_SIZE), 700) + 2 * TAG_PAD_X;
      placed.tagBox = {x: chrome.tagAt === undefined ? x + w - tw - 12 : x + w * chrome.tagAt - tw / 2, y: y - TAG_H / 2, w: tw, h: TAG_H};
    }
    const name = chrome.id ? qualify(scope, chrome.id) : undefined;
    if (chrome.id && (areaIds.has(name!) || anchors.has(name!))) claimed(name!, 'a box takes an id that another box, group or row already has');
    if (chrome.id) { setBox(name!, {...band, x, y, w, h} as never, h); if (scope) addScoped(scopes, scope, chrome.id); }
    return placed;
  };

  const register = (id: string, rect: Rect, what: string, scope?: string): void => {
    const name = qualify(scope, id);
    if (anchors.has(name)) claimed(name, what);
    anchors.set(name, rect);
    if (scope) addScoped(scopes, scope, id);
  };
  const ctx: LayoutCtx = {
    d, roles, widthOf, y: d.pad, laidOut, anchors, nodeBottoms, areaIds, connects, deferred, scopes,
    setBox, claimed, register, placeBoxLike, gapForLabels,
    stack: (bands, padX, cw) => {
      for (const band of bands) layoutHandlerFor(band.type)(band as never, ctx, padX, cw);
    },
  };
  ctx.stack(d.bands, d.pad, contentWidth);
  for (const band of deferred) connects.push(resolveConnect(band, anchors, areaIds, widthOf, roles, nodeBottoms, scopes)); // throws "unknown anchor id" if it never appears

  const contentHeight = Math.round(ctx.y - d.gap + d.pad);
  const canvasHeight = d.canvas ? Math.max(contentHeight, d.canvas.height) : contentHeight;

  return {...data, laidOut, canvasHeight, ...(data.canvas ? {contentHeight} : {}), connects, roles};
}

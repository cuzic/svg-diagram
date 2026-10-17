import {PALETTE, colorOf, textColorOf, toneStyle, isSolidTone} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import type {LaidOutBars} from './types/bars.ts';
import type {Theme, ColorKey} from './types/core.ts';
import type {LaidOutTree, LaidOutStates, LaidOutCause, LaidOutCloud, LaidOutClasses, LaidOutBpmn} from './types/diagrams.ts';
import type {LaidOutMath} from './types/math.ts';
import type {LaidOutPlane, PlaneTone} from './types/figures.ts';
import type {LaidOutImage} from './types/image.ts';
import type {LaidOutTimeline, LaidOutGantt} from './types/timeline.ts';
import {iconSvg} from './icon-svg.ts';
import {visibleAt} from './reveal.ts';
import {MARK_STROKE, plateStyle} from './image.ts';
import type {LaidOutQuadrant} from './quadrant.ts';
import type {LaidOutFlowShape} from './flow-shapes.ts';
import {snap4, escapeXml, escapeAttr, emojiSpan, resolveTextColor, lineAttrs, arrowPath, resolveBoxStyle} from './emit-common.ts';
import type {PathCut} from './emit-common.ts';
import {HOP_R} from './cause-hop.ts';
import {renderBoxRect} from './emit-boxes.ts';
import {CORE_BADGE_H, CORE_BADGE_W, CORE_BADGE_GAP} from './toc.ts';

// plane(): axes (with arrowheads), ticks, guides, points, dimension lines with their label chips, then every text.
export function renderPlane(b: LaidOutPlane, day: Theme, tones: ToneEnv, stage?: number): string {
  const col = (t: PlaneTone) => resolveTextColor(tones, t, day);
  const seg = (s: {x1: number; y1: number; x2: number; y2: number}) => `M${Math.round(s.x1)},${Math.round(s.y1)} L${Math.round(s.x2)},${Math.round(s.y2)}`;
  // a filled arrowhead at (x, y) pointing along (dx, dy); drawn as a polygon so it needs no <marker>
  const head = (x: number, y: number, dx: number, dy: number, color: string): string => {
    const len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, L = 10, W = 5;
    const pts = [[x, y], [x - ux * L - uy * W, y - uy * L + ux * W], [x - ux * L + uy * W, y - uy * L - ux * W]];
    return `<polygon points="${pts.map(([a, c]) => `${Math.round(a)},${Math.round(c)}`).join(' ')}" fill="${color}"/>`;
  };
  const out: string[] = [];
  if (b.grid.length) out.push(`<path d="${b.grid.map(seg).join(' ')}" fill="none" stroke="${PALETTE.border}" stroke-width="2"/>`);
  const yEnd = b.yDown ? b.plotB : b.plotT, xEnd = b.plotR;
  out.push(`<path d="${seg({x1: b.axisX, y1: b.axisY, x2: xEnd, y2: b.axisY})} ${seg({x1: b.axisX, y1: b.axisY, x2: b.axisX, y2: yEnd})}" fill="none" stroke="${PALETTE.text}" stroke-width="2"/>`);
  out.push(head(xEnd, b.axisY, 1, 0, PALETTE.text), head(b.axisX, yEnd, 0, b.yDown ? 1 : -1, PALETTE.text));
  if (b.ticks.length) out.push(`<path d="${b.ticks.map(seg).join(' ')}" fill="none" stroke="${PALETTE.text}" stroke-width="2"/>`);
  for (const l of b.lines.filter(l => visibleAt(l, stage))) {
    const c = col(l.tone);
    out.push(`<path d="${seg(l)}" fill="none" stroke="${c}" stroke-width="2"${l.dashed ? ' stroke-dasharray="6,4"' : ''}/>`);
    if (l.arrow) out.push(head(l.x2, l.y2, l.x2 - l.x1, l.y2 - l.y1, c));
  }
  for (const pa of (b.paths ?? []).filter(pa => visibleAt(pa, stage))) {
    const c = col(pa.tone), r = (q: {x: number; y: number}) => `${Math.round(q.x)},${Math.round(q.y)}`;
    // a growing path shows its first `k` pieces at this stage (the full path, or no stage: all of them)
    const total = pa.pts.length - 1;
    const k = pa.segReveal && stage !== undefined ? pa.segReveal.filter(s => s <= stage).length : total;
    if (k < 1) continue;
    const full = k >= total;
    const d = `M${r(pa.pts[0])} ` + (pa.curves.length ? pa.curves.slice(0, k).map(([c1, c2, e]) => `C${r(c1)} ${r(c2)} ${r(e)}`) : pa.pts.slice(1, k + 1).map(q => `L${r(q)}`)).join(' ');
    out.push(`<path d="${d}" fill="none" stroke="${c}" stroke-width="2"${pa.dashed ? ' stroke-dasharray="6,4"' : ''}/>`);
    if (pa.arrow && full) out.push(head(pa.pts[pa.pts.length - 1].x, pa.pts[pa.pts.length - 1].y, pa.tip.dx, pa.tip.dy, c));
  }
  for (const dm of b.dims.filter(dm => visibleAt(dm, stage))) {
    const c = col(dm.tone);
    for (const e of dm.ext) out.push(`<path d="${seg(e)}" fill="none" stroke="${PALETTE.muted}" stroke-width="2" stroke-dasharray="2,4" stroke-linecap="round"/>`);
    out.push(`<path d="${seg(dm.line)}" fill="none" stroke="${c}" stroke-width="2"/>`);
    out.push(head(dm.line.x1, dm.line.y1, dm.line.x1 - dm.line.x2, dm.line.y1 - dm.line.y2, c), head(dm.line.x2, dm.line.y2, dm.line.x2 - dm.line.x1, dm.line.y2 - dm.line.y1, c));
    out.push(`<rect x="${snap4(dm.chip.x)}" y="${snap4(dm.chip.y)}" width="${snap4(dm.chip.x + dm.chip.w) - snap4(dm.chip.x)}" height="${dm.chip.h}" rx="${dm.chip.h / 2}" fill="${PALETTE.bg}"/>`);
  }
  for (const p of b.points.filter(p => visibleAt(p, stage))) {
    const c = col(p.tone), x = snap4(p.x), y = snap4(p.y);
    if (p.shape === 'ring') out.push(`<circle cx="${x}" cy="${y}" r="6" fill="${PALETTE.bg}" stroke="${c}" stroke-width="2.5"/>`);
    else if (p.shape === 'cross') out.push(`<path d="M${x - 6},${y - 6} L${x + 6},${y + 6} M${x - 6},${y + 6} L${x + 6},${y - 6}" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`);
    else if (p.shape === 'disc' || p.shape === 'hole') { const ex = Math.round(p.x), ey = Math.round(p.y); out.push(`<path d="M${ex - 6},${ey} a6,6 0 1 0 12,0 a6,6 0 1 0 -12,0 Z" fill="${p.shape === 'hole' ? PALETTE.bg : c}"${p.shape === 'hole' ? ` stroke="${c}" stroke-width="2.5"` : ''}/>`); }
    else if (p.shape === 'square' || p.shape === 'diamond' || p.shape === 'triangle') {
      const ex = Math.round(p.x), ey = Math.round(p.y);
      const d = p.shape === 'square' ? `M${ex - 6},${ey - 6} H${ex + 6} V${ey + 6} H${ex - 6} Z` : p.shape === 'diamond' ? `M${ex},${ey - 8} L${ex + 8},${ey} L${ex},${ey + 8} L${ex - 8},${ey} Z` : `M${ex},${ey - 8} L${ex + 8},${ey + 6} L${ex - 8},${ey + 6} Z`;
      out.push(`<path d="${d}" fill="${c}"/>`);
    }
    else out.push(`<circle cx="${x}" cy="${y}" r="6" fill="${c}"/>`);
  }
  for (const t of b.texts.filter(t => visibleAt(t, stage))) {
    out.push(`<text x="${Math.round(t.x)}" y="${Math.round(t.y)}"${t.anchor === 'start' ? '' : ` text-anchor="${t.anchor}"`} font-size="${b.labelSize}"${t.bold ? ' font-weight="700"' : ''} fill="${col(t.tone)}">${emojiSpan(t.s)}</text>`);
  }
  return out.join('\n  ');
}


export function renderBars(b: LaidOutBars, day: Theme, stage?: number, dimFill = false): string {
  const col = (k: ColorKey) => colorOf(k, day);
  const out: string[] = [];
  for (const t of b.ticks) out.push(`<path d="M${Math.round(t.x1)},${Math.round(t.y1)} L${Math.round(t.x2)},${Math.round(t.y2)}" fill="none" stroke="${b.dim ? PALETTE.muted : PALETTE.border}" stroke-width="2"/>`);
  for (const r of b.bars.filter(r => visibleAt(r, stage))) {
    const x = Math.round(r.x * 100) / 100, y = Math.round(r.y * 100) / 100;
    const right = Math.round((r.x + r.w) * 100) / 100, bottom = Math.round((r.y + r.h) * 100) / 100;
    if (!r.dim) { out.push(`<path d="M${x},${y} H${right} V${bottom} H${x} Z" fill="${col(r.fill)}"/>`); continue; }
    // spotlight dim 'fill': a pale fill (the border colour) keeps the bar's length readable
    if (dimFill) { out.push(`<path d="M${x},${y} H${right} V${bottom} H${x} Z" fill="${PALETTE.border}"/>`); continue; }
    // a dimmed bar is outlined just inside its rect (so the gap between stacked segments stays open); one too thin to see stays a bare fill
    const thin = r.w < 1 || r.h < 1, i = thin ? 0 : Math.min(1, r.w / 2, r.h / 2);
    out.push(`<path d="M${x + i},${y + i} H${right - i} V${bottom - i} H${x + i} Z" fill="${PALETTE.bg}"${thin ? '' : ` stroke="${PALETTE.muted}" stroke-width="2" stroke-dasharray="2,5" stroke-linecap="round"`}/>`);
  }
  // reference lines, the cumulative line and the curve of a bars() that has them
  const inkOf = (k: ColorKey) => b.dim ? PALETTE.muted : col(k);
  for (const l of b.ink?.lines ?? []) out.push(`<path d="M${Math.round(l.x1)},${Math.round(l.y1)} L${Math.round(l.x2)},${Math.round(l.y2)}" fill="none" stroke="${inkOf(l.fill)}" stroke-width="2"${l.dashed ? ' stroke-dasharray="6,4"' : ''}/>`);
  for (const l of b.ink?.polylines ?? []) out.push(`<path d="M${l.pts.map(p => `${Math.round(p.x * 10) / 10},${Math.round(p.y * 10) / 10}`).join(' L')}" fill="none" stroke="${inkOf(l.fill)}" stroke-width="2.5" stroke-linejoin="round"${l.dashed ? ' stroke-dasharray="6,4"' : ''}/>`);
  // a dot sits exactly on the vertex of the line it marks, so it is a path (a <circle> would be snapped to the 4px grid)
  for (const d of b.ink?.dots ?? []) { const x = Math.round(d.x * 10) / 10, y = Math.round(d.y * 10) / 10; out.push(`<path d="M${x - 4},${y} a4,4 0 1 0 8,0 a4,4 0 1 0 -8,0 Z" fill="${PALETTE.bg}" stroke="${inkOf(d.fill)}" stroke-width="2.5"/>`); }
  for (const t of b.texts.filter(t => visibleAt(t, stage))) {
    const anchor = t.anchor === 'start' ? '' : ` text-anchor="${t.anchor}"`;
    out.push(`<text x="${Math.round(t.x)}" y="${Math.round(t.y)}"${anchor} font-size="${t.size}"${t.bold ? ' font-weight="700"' : ''} fill="${t.dim || b.dim ? PALETTE.muted : col(t.fill)}">${emojiSpan(t.text)}</text>`);
  }
  return out.join('\n  ');
}


export function renderImage(b: LaidOutImage, day: Theme, tones: ToneEnv, stage?: number): string {
  const col = (k: ColorKey) => colorOf(k, day);
  const out: string[] = [];
  const esc = escapeAttr;
  const r4 = (r: {x: number; y: number; w: number; h: number}) => ({x: snap4(r.x), y: snap4(r.y), w: snap4(r.x + r.w) - snap4(r.x), h: snap4(r.y + r.h) - snap4(r.y)});
  const pic = r4(b);
  out.push(`<image x="${pic.x}" y="${pic.y}" width="${pic.w}" height="${pic.h}" href="${b.href}" preserveAspectRatio="none"${b.alt ? ` role="img" aria-label="${esc(b.alt)}"` : ' aria-hidden="true"'}/>`);
  // spotlight: the picture outside the focused marks is veiled (all of it when nothing in it is focused)
  if (b.dim || b.holes?.length) {
    const hole = (m: {x: number; y: number; w: number; h: number}) => { const r = r4(m); return ` M${r.x},${r.y} h${r.w} v${r.h} h${-r.w} Z`; };
    out.push(`<path d="M${pic.x},${pic.y} h${pic.w} v${pic.h} h${-pic.w} Z${b.dim ? '' : (b.holes ?? []).map(hole).join('')}" fill="${PALETTE.bg}" fill-opacity="0.7" fill-rule="evenodd"/>`);
  }
  const marks = b.marks.filter(m => visibleAt(m, stage));
  for (const mk of marks) {
    const m = {...mk, ...r4(mk)};
    const ink = m.dim || b.dim ? PALETTE.muted : col(toneStyle(tones, m.tone).ink);
    out.push(`<rect x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" fill="none" stroke="${ink}" stroke-width="${MARK_STROKE}"${m.dim || b.dim ? ' stroke-dasharray="2,5" stroke-linecap="round"' : ''}/>`);
  }
  for (const p of b.plates.filter(p => visibleAt(p, stage))) {
    const st = plateStyle(tones, p.tone), dim = p.dim || b.dim;
    const x = snap4(p.x), y = snap4(p.y), w = snap4(p.x + p.w) - x;
    out.push(`<rect x="${x}" y="${y}" width="${w}" height="${p.h}" rx="${p.h / 2}" fill="${dim ? PALETTE.bg : col(st.fill)}" stroke="${dim ? PALETTE.muted : col(st.stroke)}" stroke-width="2"/>`);
    out.push(`<text x="${Math.round(x + w / 2)}" y="${Math.round(y + p.h / 2 + p.size * 0.36)}" text-anchor="middle" font-size="${p.size}" font-weight="700" fill="${dim ? PALETTE.muted : col(st.text)}">${emojiSpan(p.text)}</text>`);
  }
  return out.join('\n  ');
}


// quadrant(): the cells, the crosshair, arrows, bubbles (a shape per group), the legend markers, then every text.
export function renderQuadrant(b: LaidOutQuadrant, day: Theme, tones: ToneEnv): string {
  const ink = (k: 'text' | 'muted' | 'accent' | 'danger', dim?: boolean) => dim ? PALETTE.muted : colorOf(k, day);
  const out: string[] = [];
  for (const c of b.cells) {
    const ts = toneStyle(tones, c.tone), fill = b.dim ? PALETTE.bg : colorOf(ts.fill, day);
    const stroke = b.dim ? PALETTE.muted : ts.stroke === null ? colorOf(ts.fill, day) : c.tone === 'plain' ? PALETTE.muted : colorOf(ts.stroke, day);
    // snap the edges, not the width: every gap between two cells comes out the same
    const x0 = snap4(c.x), y0 = snap4(c.y), x1 = snap4(c.x + c.w), y1 = snap4(c.y + c.h);
    out.push(`<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" rx="${b.crosshair ? 0 : 8}" fill="${fill}" stroke="${stroke}" stroke-width="2"${ts.dashed && !b.dim ? ' stroke-dasharray="6,4"' : ''}/>`);
  }
  for (const l of b.lines) out.push(`<path d="M${snap4(l.x1)},${snap4(l.y1)} L${snap4(l.x2)},${snap4(l.y2)}" fill="none" stroke="${PALETTE.muted}" stroke-width="2"/>`); // on the snapped cell edges
  const head = (x: number, y: number, dx: number, dy: number, color: string): string => {
    const L = 10, W = 5, pts = [[x, y], [x - dx * L - dy * W, y - dy * L + dx * W], [x - dx * L + dy * W, y - dy * L - dx * W]];
    return `<polygon points="${pts.map(([a, c]) => `${Math.round(a)},${Math.round(c)}`).join(' ')}" fill="${color}"/>`;
  };
  const shapeSvg = (shape: LaidOutQuadrant['bubbles'][number]['shape'], x: number, y: number, r: number, fill: string, stroke: string, sw: number): string => {
    const f = `fill="${fill}" stroke="${stroke}" stroke-width="${sw}"`, n = (v: number) => Math.round(v * 10) / 10;
    if (shape === 'circle') return `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" ${f}/>`;
    if (shape === 'square') { const s = r * Math.sqrt(Math.PI) / 2; return `<polygon points="${n(x - s)},${n(y - s)} ${n(x + s)},${n(y - s)} ${n(x + s)},${n(y + s)} ${n(x - s)},${n(y + s)}" ${f}/>`; }
    if (shape === 'diamond') { const s = r * Math.sqrt(Math.PI) / Math.SQRT2; return `<polygon points="${n(x)},${n(y - s)} ${n(x + s)},${n(y)} ${n(x)},${n(y + s)} ${n(x - s)},${n(y)}" ${f}/>`; }
    const a = r * Math.sqrt(4 * Math.PI / Math.sqrt(3)), hh = a * Math.sqrt(3) / 2, cy = y - hh / 3 * 0; // an equilateral triangle of area pi r^2, centred on its centroid
    return `<polygon points="${n(x)},${n(cy - hh * 2 / 3)} ${n(x + a / 2)},${n(cy + hh / 3)} ${n(x - a / 2)},${n(cy + hh / 3)}" ${f}/>`;
  };
  for (const a of b.arrows) {
    out.push(`<path d="M${Math.round(a.x1)},${Math.round(a.y1)} L${Math.round(a.x2)},${Math.round(a.y2)}" fill="none" stroke="${PALETTE.text}" stroke-width="2"${a.dashed ? ' stroke-dasharray="6,4"' : ''}/>`);
    out.push(head(a.x2, a.y2, a.tip.dx, a.tip.dy, PALETTE.text));
  }
  for (const c of b.chips) out.push(`<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="4" fill="${PALETTE.bg}"/>`);
  // a hollow marker (groups 5 to 8) is an outline drawn inside the shape's area, so it is told from the filled ones by more than colour
  const marker = (shape: LaidOutQuadrant['bubbles'][number]['shape'], x: number, y: number, r: number, color: string, hollow: boolean | undefined): string =>
    hollow ? shapeSvg(shape, x, y, r - 1.5, PALETTE.bg, color, 3) : shapeSvg(shape, x, y, r, color, PALETTE.bg, 1.5);
  for (const q of b.bubbles) out.push(marker(q.shape, q.x, q.y, q.r, ink(q.tone, q.dim), q.hollow));
  for (const m of b.marks) out.push(m.ring ? shapeSvg(m.shape, m.x, m.y, m.r, 'none', ink(m.tone, b.dim), 2) : marker(m.shape, m.x, m.y, m.r, ink(m.tone, b.dim), m.hollow));
  for (const t of b.texts) {
    const dim = b.dim || (t.item !== undefined && b.bubbles[t.item].dim);
    out.push(`<text x="${Math.round(t.x)}" y="${Math.round(t.y)}"${t.anchor === 'start' ? '' : ` text-anchor="${t.anchor}"`} font-size="${t.size}"${t.bold ? ' font-weight="700"' : ''} fill="${ink(t.fill, dim)}">${emojiSpan(t.text)}</text>`);
  }
  return out.join('\n  ');
}


export function renderFlowShape(b: LaidOutFlowShape, day: Theme, tones: ToneEnv): string {
  const out: string[] = [], n = (v: number) => Math.round(v * 10) / 10;
  for (const p of b.primitives) {
    if (p.k === 'polygon') {
      const s = resolveBoxStyle(tones, p.tone, day);
      out.push(`<polygon points="${p.points.map(q => `${n(q[0])},${n(q[1])}`).join(' ')}" fill="${s.fill}" stroke="${s.stroke}" stroke-width="${p.strong ? 3.5 : 2}"${s.dashed ? ' stroke-dasharray="6,4"' : ''}/>`);
    } else if (p.k === 'circle') {
      const c = colorOf(p.tone, day);
      out.push(`<circle cx="${n(p.cx)}" cy="${n(p.cy)}" r="${n(p.r)}" fill="${c}" fill-opacity="${p.opacity ?? .16}" stroke="${c}" stroke-width="2"${p.dash ? ` stroke-dasharray="${p.dash}"` : ''}/>`);
    } else if (p.k === 'rect') {
      out.push(`<rect x="${n(p.x)}" y="${n(p.y)}" width="${n(p.w)}" height="${n(p.h)}" rx="8" fill="none" stroke="${colorOf(p.tone, day)}" stroke-width="2"/>`);
    } else {
      out.push(`<path d="${p.d}" fill="none" stroke="${colorOf(p.tone, day)}" stroke-width="${p.thin ? 1.5 : 2}"${p.arrow ? ' marker-end="url(#dsl-arrow)"' : ''}/>`);
    }
  }
  for (const t of b.texts) out.push(`<text x="${n(t.tx)}" y="${n(t.ty)}"${t.anchor === 'start' ? '' : ` text-anchor="${t.anchor}"`} font-size="${t.size}" font-weight="${t.weight}" fill="${colorOf(t.tone, day)}">${emojiSpan(t.text)}</text>`);
  return out.join('\n  ');
}


export function renderTimeline(b: LaidOutTimeline, day: Theme): string {
  // a dimmed timeline draws itself muted (so the white knock-out ring around each dot stays white)
  const col = (k: 'text' | 'muted' | 'accent' | 'danger') => b.dim ? PALETTE.muted : colorOf(k, day);
  const out: string[] = [`<path d="M${snap4(b.axis.x1)},${snap4(b.axis.y)} H${snap4(b.axis.x2)}" fill="none" stroke="${PALETTE.muted}" stroke-width="2"/>`];
  if (b.span?.fill) {
    const x1 = snap4(b.span.x1), y1 = snap4(b.span.y - 12);
    out.unshift(`<rect x="${x1}" y="${y1}" width="${snap4(b.span.x2) - x1}" height="24" fill="${b.span.tone === 'accent' && !b.dim ? PALETTE[day].soft : PALETTE.border}"/>`);
  } else if (b.span) out.push(`<path d="M${snap4(b.span.x1)},${snap4(b.span.y)} H${snap4(b.span.x2)}" fill="none" stroke="${col(b.span.tone)}" stroke-width="8"/>`);
  for (const g of b.guides ?? []) out.push(`<path d="M${snap4(g.x1)},${snap4(g.y)} H${snap4(g.x2)}" fill="none" stroke="${PALETTE.border}" stroke-width="1"/>`);
  for (const r of b.bars ?? []) out.push(`<rect x="${snap4(r.x)}" y="${snap4(r.y)}" width="${snap4(r.x + r.w) - snap4(r.x)}" height="${r.h}" fill="${col(r.tone)}" fill-opacity="0.18" stroke="${col(r.tone)}" stroke-width="2"/>`);
  for (const d of b.dims ?? []) out.push(`<path d="M${snap4(d.x1)},${snap4(d.y)} H${snap4(d.x2)} M${snap4(d.x1)},${snap4(d.y - 5)} V${snap4(d.y + 5)} M${snap4(d.x2)},${snap4(d.y - 5)} V${snap4(d.y + 5)}" fill="none" stroke="${col(d.tone)}" stroke-width="2"/>`);
  if (b.fullLine) out.push(`<path d="M${snap4(b.fullLine.x)},${snap4(b.fullLine.y1)} V${snap4(b.fullLine.y2)}" fill="none" stroke="${col('danger')}" stroke-width="2"/>`);
  for (const t of b.ticks) out.push(`<path d="M${snap4(t.x)},${snap4(t.y1)} V${snap4(t.y2)}" fill="none" stroke="${PALETTE.muted}" stroke-width="2"/>`);
  for (const s of b.stems) out.push(`<path d="M${snap4(s.x)},${snap4(s.y1)} V${snap4(s.y2)}" fill="none" stroke="${col(s.tone)}" stroke-width="2"/>`);
  for (const d of b.dots) out.push(`<circle cx="${snap4(d.x)}" cy="${snap4(d.y)}" r="${d.r}" fill="${col(d.tone)}" stroke="${PALETTE.bg}" stroke-width="4"/>`);
  if (b.bracket) { const {x1, x2, y, tone} = b.bracket; out.push(`<path d="M${snap4(x1)},${snap4(y - 4)} V${snap4(y)} H${snap4(x2)} V${snap4(y - 4)}" fill="none" stroke="${col(tone)}" stroke-width="2"/>`); }
  for (const t of b.texts) out.push(`<text x="${Math.round(t.x)}" y="${Math.round(t.y)}"${t.anchor === 'start' ? '' : ` text-anchor="${t.anchor}"`} font-size="${t.size}"${t.bold ? ' font-weight="700"' : ''} fill="${col(t.fill)}">${emojiSpan(t.text)}</text>`);
  return out.join('\n  ');
}


export function renderTree(b: LaidOutTree, day: Theme, tones: ToneEnv): string {
  const out: string[] = [];
  for (const e of b.edges) {
    const [a, z] = [e.points[0], e.points[e.points.length - 1]];
    // curve: a cubic that leaves and arrives along the axis the tree grows on (`curve`), so it reads as one smooth S
    const d = e.curve ? (e.curve === 'x' ? `M${snap4(a.x)},${snap4(a.y)} C${snap4((a.x + z.x) / 2)},${snap4(a.y)} ${snap4((a.x + z.x) / 2)},${snap4(z.y)} ${snap4(z.x)},${snap4(z.y)}` : `M${snap4(a.x)},${snap4(a.y)} C${snap4(a.x)},${snap4((a.y + z.y) / 2)} ${snap4(z.x)},${snap4((a.y + z.y) / 2)} ${snap4(z.x)},${snap4(z.y)}`) : `M${e.points.map(p => `${snap4(p.x)},${snap4(p.y)}`).join(' L')}`;
    out.push(`<path d="${d}" fill="none" stroke="${PALETTE.muted}" stroke-width="${e.bold ? 4 : 2}"/>`);
  }
  for (const br of b.braces ?? []) { // a `{`: two quarter turns in, a point toward the parent, two quarter turns out
    const s = br.side === 'right' ? 1 : -1, r = 8, x = snap4(br.x), xt = snap4(br.tipX), y1 = snap4(br.y1), y2 = snap4(br.y2), ym = snap4(br.ymid);
    out.push(`<path d="M${x + s * r},${y1} Q${x},${y1} ${x},${y1 + r} V${ym - r} Q${x},${ym} ${xt},${ym} Q${x},${ym} ${x},${ym + r} V${y2 - r} Q${x},${y2} ${x + s * r},${y2}" fill="none" stroke="${PALETTE.muted}" stroke-width="2"/>`);
  }
  for (const n of b.nodes) out.push(renderBoxRect({...n, dim: b.dim}, day, tones, 'plain'));
  const nodes = b.nodes;
  const ink = (t: LaidOutTree['texts'][number]): string => {
    if (b.dim) return PALETTE.muted;
    const n = nodes.find(r => t.x >= r.x && t.x <= r.x + r.w && t.y > r.y && t.y <= r.y + r.h);
    // the muted second line is 4.48:1 on a soft (accent / new) fill, under the 4.5 the text rules ask for: it takes the plain text colour there
    if (t.muted) return n && toneStyle(tones, n.tone).fill === 'soft' ? PALETTE.text : PALETTE.muted;
    return colorOf(toneStyle(tones, n?.tone).text, day);
  };
  for (const t of b.texts) out.push(`<text x="${Math.round(t.x)}" y="${Math.round(t.y)}" text-anchor="middle" font-size="${t.size}"${t.bold ? ' font-weight="700"' : ''} fill="${ink(t)}">${emojiSpan(t.text)}</text>`);
  return out.join('\n  ');
}


export function renderStates(b: LaidOutStates, day: Theme, tones: ToneEnv): string {
  const out: string[] = [];
  const stroke = b.dim ? PALETTE.muted : PALETTE.text;
  const inkOf = (tone: 'danger' | 'accent' | 'muted' | undefined): string => b.dim ? PALETTE.muted : tone === undefined ? PALETTE.text : tone === 'muted' ? PALETTE.muted : colorOf(tone, day);
  // arrowheads are drawn as shapes, not markers: a marker on a leftward end is not turned by every renderer (resvg leaves it pointing right)
  for (const e of b.edges) {
    const pts = e.points.slice(), n = pts.length, tip = pts[n - 1], prev = pts[n - 2], color = inkOf(e.tone);
    const dx = Math.sign(tip.x - prev.x), dy = Math.sign(tip.y - prev.y), L = e.strong ? 16 : 12, W = e.strong ? 7 : 5;
    pts[n - 1] = {x: tip.x - dx * (L - 2), y: tip.y - dy * (L - 2)}; // the line stops inside the head
    const head = `M${snap4(tip.x)},${snap4(tip.y)} L${snap4(tip.x - dx * L - dy * W)},${snap4(tip.y - dy * L + dx * W)} L${snap4(tip.x - dx * L + dy * W)},${snap4(tip.y - dy * L - dx * W)} z`;
    out.push(`<path d="M${pts.map(p => `${snap4(p.x)},${snap4(p.y)}`).join(' L')}" fill="none" stroke="${color}" stroke-width="${e.strong ? 4 : 2}"${lineAttrs(e.line === 'solid' ? undefined : e.line)}/>\n  <path d="${head}" fill="${color}"/>`);
  }
  if (b.initial) out.push(`<circle cx="${snap4(b.initial.x)}" cy="${snap4(b.initial.y)}" r="${b.initial.r}" fill="${stroke}"/>`);
  for (const n of b.nodes) {
    if (n.circle) { // an event: a circle in its tone's colours
      const st = b.dim ? {fill: PALETTE.bg, stroke: PALETTE.muted, dashed: false} : resolveBoxStyle(tones, n.tone, day);
      out.push(`<circle cx="${snap4(n.x + n.w / 2)}" cy="${snap4(n.y + n.h / 2)}" r="${snap4(n.w / 2)}" fill="${st.fill}" stroke="${st.stroke}" stroke-width="2.5"/>`);
      continue;
    }
    out.push(renderBoxRect({...n, dim: b.dim}, day, tones, 'plain'));
    // the inner outline of an end state: on a solid fill its stroke would be the fill colour, so it is drawn in the text colour (white)
    const inner = renderBoxRect({x: n.x + 4, y: n.y + 4, w: n.w - 8, h: n.h - 8, tone: n.tone, dim: b.dim}, day, tones, 'plain').replace('rx="8"', 'rx="5"');
    if (n.final) out.push(!b.dim && isSolidTone(n.tone) ? inner.replace(/stroke="[^"]*"/, `stroke="${colorOf(toneStyle(tones, n.tone).text, day)}"`) : inner);
  }
  const ink = (t: LaidOutStates['texts'][number]): string => {
    if (b.dim) return PALETTE.muted;
    const n = b.nodes.find(r => t.x >= r.x && t.x <= r.x + r.w && t.y > r.y && t.y <= r.y + r.h);
    if (n && isSolidTone(n.tone)) return colorOf(toneStyle(tones, n.tone).text, day); // white on the fill, the sub line too
    if (t.muted) return n && toneStyle(tones, n.tone).fill === 'soft' ? PALETTE.text : PALETTE.muted; // muted on a soft fill is 4.48:1, under 4.5
    return colorOf(toneStyle(tones, n?.tone).text, day);
  };
  for (const t of b.texts) out.push(`<text x="${Math.round(t.x)}" y="${Math.round(t.y)}" text-anchor="middle" font-size="${t.size}"${t.bold ? ' font-weight="700"' : ''} fill="${ink(t)}">${emojiSpan(t.text)}</text>`);
  for (const ic of b.icons) out.push(iconSvg({glyph: ic.glyph, name: ic.name, x: ic.x, y: ic.y, size: ic.size, color: b.dim ? PALETTE.muted : colorOf(toneStyle(tones, b.nodes[ic.node].tone).text, day), dim: b.dim, labelled: true}));
  for (const l of b.labels) {
    out.push(`<rect x="${snap4(l.x)}" y="${snap4(l.y)}" width="${snap4(l.w)}" height="${l.h}" fill="${PALETTE.bg}"/>`);
    out.push(`<text x="${Math.round(l.tx)}" y="${Math.round(l.ty)}" text-anchor="middle" font-size="${l.size}" fill="${stroke}">${emojiSpan(l.text)}</text>`);
  }
  return out.join('\n  ');
}


// The core driver (ADR 0015 D4): a thick frame and a small 中核 badge just outside the side of the box away from the arrows that leave it
const CORE_STROKE = 3.5, BADGE_W = CORE_BADGE_W, BADGE_H = CORE_BADGE_H, BADGE_GAP = CORE_BADGE_GAP;
function coreBadge(n: LaidOutCause['nodes'][number], id: string, b: LaidOutCause, day: Theme): string {
  const leave = b.edges.find(e => e.from === id)?.points[0], eps = 1;
  const side = !leave ? 'top' : Math.abs(leave.y - n.y) < eps ? 'bottom' : Math.abs(leave.y - n.y - n.h) < eps ? 'top' : Math.abs(leave.x - n.x) < eps ? 'right' : 'left';
  // wholly outside the frame, so it never covers the label (H7)
  const x = side === 'left' ? n.x - BADGE_W - BADGE_GAP : side === 'right' ? n.x + n.w + BADGE_GAP : n.x + 6;
  const y = side === 'top' ? n.y - BADGE_H - BADGE_GAP : side === 'bottom' ? n.y + n.h + BADGE_GAP : n.y + 6;
  const fill = b.dim ? PALETTE.muted : colorOf('accent', day);
  return `<rect x="${snap4(x)}" y="${snap4(y)}" width="${BADGE_W}" height="${BADGE_H}" rx="8" fill="${fill}"/>\n  <text x="${snap4(x + BADGE_W / 2)}" y="${snap4(y + 16)}" text-anchor="middle" font-size="14" font-weight="700" fill="${PALETTE.bg}">中核</text>`;
}
export function renderCause(b: LaidOutCause, day: Theme, tones: ToneEnv): string {
  const out: string[] = [];
  const stroke = b.dim ? PALETTE.muted : PALETTE.text;
  const cutsOf = (k: number): PathCut[] | undefined => {
    const mine = (b.crossings ?? []).filter(c => !c.skipped && c.over === k);
    return mine.length ? mine.map(c => ({x: c.x, y: c.y, side: c.side, r: HOP_R})) : undefined;
  };
  b.edges.forEach((e, k) => out.push(e.kind === 'blocks' ? arrowPath(e.points, stroke, e.line, 2, 'end', 'bar', cutsOf(k)) : e.back ? arrowPath(e.points, stroke, e.line, 3, 'end', 'arrow', cutsOf(k)) : arrowPath(e.points, stroke, e.line, 2, 'end', 'arrow', cutsOf(k))));
  // the AND arc: across the arrows of one effect, just before their heads
  for (const a of b.ands) out.push(`<path d="M${snap4(a.p0.x)},${snap4(a.p0.y)} Q${snap4(a.c.x)},${snap4(a.c.y)} ${snap4(a.p1.x)},${snap4(a.p1.y)}" fill="none" stroke="${stroke}" stroke-width="2"/>`);
  for (const [i, n] of b.nodes.entries()) {
    if (n.hex) { // an obstacle: a hexagon (pointed left and right), in its tone's colours
      const st = b.dim ? {fill: PALETTE.bg, stroke: PALETTE.muted, dashed: false} : resolveBoxStyle(tones, n.tone, day, n.dashed), k = Math.min(16, n.h / 2), cy = n.y + n.h / 2;
      const pts = [[n.x + k, n.y], [n.x + n.w - k, n.y], [n.x + n.w, cy], [n.x + n.w - k, n.y + n.h], [n.x + k, n.y + n.h], [n.x, cy]].map(([px, py]) => `${snap4(px)},${snap4(py)}`).join(' ');
      out.push(`<polygon points="${pts}" fill="${st.fill}" stroke="${st.stroke}" stroke-width="${n.core ? CORE_STROKE : 2}"${st.dashed ? ' stroke-dasharray="6,4"' : ''} stroke-linejoin="round"/>`);
      if (n.core) out.push(coreBadge(n, b.anchors[i].id, b, day));
      continue;
    }
    const rect = renderBoxRect({...n, dim: b.dim}, day, tones, 'plain');
    out.push(n.core ? rect.replace('stroke-width="2.5"', `stroke-width="${CORE_STROKE}"`) : rect);
    if (n.double) out.push(renderBoxRect({x: n.x + 4, y: n.y + 4, w: n.w - 8, h: n.h - 8, tone: n.tone, dim: b.dim}, day, tones, 'plain').replace('rx="8"', 'rx="5"'));
    if (n.core) out.push(coreBadge(n, b.anchors[i].id, b, day));
  }
  const ink = (t: LaidOutCause['texts'][number]): string => {
    if (b.dim) return PALETTE.muted;
    const n = b.nodes.find(r => t.x >= r.x && t.x <= r.x + r.w && t.y > r.y && t.y <= r.y + r.h);
    if (t.muted) return n && toneStyle(tones, n.tone).fill === 'soft' ? PALETTE.text : PALETTE.muted;
    return colorOf(toneStyle(tones, n?.tone).text, day);
  };
  for (const t of b.texts) out.push(`<text x="${Math.round(t.x)}" y="${Math.round(t.y)}" text-anchor="middle" font-size="${t.size}"${t.bold ? ' font-weight="700"' : ''} fill="${ink(t)}">${emojiSpan(t.text)}</text>`);
  return out.join('\n  ');
}


export function renderCloud(b: LaidOutCloud, day: Theme, tones: ToneEnv): string {
  const out: string[] = [];
  const stroke = b.dim ? PALETTE.muted : PALETTE.text, conflict = b.dim ? PALETTE.muted : colorOf('danger', day), accent = b.dim ? PALETTE.muted : colorOf('accent', day);
  for (const e of b.edges) out.push(e.arrow === 'dd' ? arrowPath(e.points, conflict, undefined, 2.5, 'both') : arrowPath(e.points, stroke, undefined));
  for (const n of b.nodes) out.push(renderBoxRect({...n, dim: b.dim}, day, tones, 'plain'));
  const ink = (t: LaidOutCloud['texts'][number]): string => {
    if (b.dim) return PALETTE.muted;
    if (t.tone) return t.tone === 'danger' ? conflict : accent;
    const n = b.nodes.find(r => t.x >= r.x && t.x <= r.x + r.w && t.y > r.y && t.y <= r.y + r.h);
    return n ? colorOf(toneStyle(tones, n.tone).text, day) : PALETTE.text;
  };
  for (const t of b.texts) out.push(`<text x="${Math.round(t.x)}" y="${Math.round(t.y)}" text-anchor="${t.anchor ?? 'middle'}" font-size="${t.size}"${t.bold ? ' font-weight="700"' : ''} fill="${ink(t)}">${emojiSpan(t.text)}</text>`);
  for (const c of b.chips) {
    out.push(`<rect x="${snap4(c.x)}" y="${snap4(c.y)}" width="${snap4(c.w)}" height="${c.h}" fill="${PALETTE.bg}"/>`);
    out.push(`<text x="${Math.round(c.tx)}" y="${Math.round(c.ty)}" text-anchor="middle" font-size="${c.size}" fill="${c.arrow === 'dd' || c.conflict ? conflict : stroke}">${emojiSpan(c.text)}</text>`);
  }
  return out.join('\n  ');
}


export function renderGantt(b: LaidOutGantt, day: Theme): string {
  const out: string[] = [];
  const ink = b.dim ? PALETTE.muted : PALETTE.text;
  const tone = (t: 'accent' | 'danger' | 'muted'): string => b.dim ? PALETTE.muted : t === 'accent' ? PALETTE[day].accent : t === 'danger' ? PALETTE.danger : PALETTE.muted;
  const soft = (t: 'accent' | 'danger' | 'muted'): string => b.dim ? PALETTE.bg : t === 'accent' ? PALETTE[day].soft : PALETTE.border;
  for (const s of b.sections) out.push(`<rect x="${snap4(s.x)}" y="${snap4(s.y)}" width="${snap4(s.w)}" height="${s.h}" fill="${PALETTE.code}"/>`);
  for (const t of b.ticks) out.push(`<path d="M${snap4(t.x)},${snap4(b.plot.y1)} V${snap4(b.plot.y2)}" fill="none" stroke="${PALETTE.border}" stroke-width="1"/>`);
  out.push(`<path d="M${snap4(b.plot.x1)},${snap4(b.plot.y1)} H${snap4(b.plot.x2)}" fill="none" stroke="${PALETTE.muted}" stroke-width="2"/>`);
  for (const d of b.deps) {
    const pts = d.points.slice(), n = pts.length, tip = pts[n - 1], prev = pts[n - 2], L = 8, W = 4;
    const dx = Math.sign(tip.x - prev.x), dy = Math.sign(tip.y - prev.y);
    pts[n - 1] = {x: tip.x - dx * (L - 1), y: tip.y - dy * (L - 1)};
    out.push(`<path d="M${pts.map(p => `${snap4(p.x)},${snap4(p.y)}`).join(' L')}" fill="none" stroke="${ink}" stroke-width="1.5"/>\n  <path d="M${snap4(tip.x)},${snap4(tip.y)} L${snap4(tip.x - dx * L - dy * W)},${snap4(tip.y - dy * L + dx * W)} L${snap4(tip.x - dx * L + dy * W)},${snap4(tip.y - dy * L - dx * W)} z" fill="${ink}"/>`);
  }
  for (const r of b.bars) {
    if (r.milestone) { const cx = r.x + r.w / 2, cy = r.y + r.h / 2; out.push(`<path d="M${snap4(cx)},${snap4(r.y)} L${snap4(r.x + r.w)},${snap4(cy)} L${snap4(cx)},${snap4(r.y + r.h)} L${snap4(r.x)},${snap4(cy)} z" fill="${tone(r.tone)}" stroke="${PALETTE.bg}" stroke-width="2"/>`); continue; }
    const x = snap4(r.x), y = snap4(r.y), w = snap4(r.w);
    if (r.progress === undefined) out.push(`<rect x="${x}" y="${y}" width="${w}" height="${r.h}" rx="4" fill="${tone(r.tone)}"/>`);
    else {
      out.push(`<rect x="${x}" y="${y}" width="${w}" height="${r.h}" rx="4" fill="${soft(r.tone)}" stroke="${tone(r.tone)}" stroke-width="2"/>`);
      if (r.progress > 0) out.push(`<rect x="${x}" y="${y}" width="${snap4(r.w * r.progress)}" height="${r.h}" rx="4" fill="${tone(r.tone)}"/>`);
    }
  }
  if (b.today) out.push(`<path d="M${snap4(b.today.x)},${snap4(b.today.y1)} V${snap4(b.today.y2)}" fill="none" stroke="${b.dim ? PALETTE.muted : PALETTE.danger}" stroke-width="2"/>`);
  for (const t of b.texts) out.push(`<text x="${Math.round(t.x)}" y="${Math.round(t.y)}"${t.anchor === 'middle' ? ' text-anchor="middle"' : t.anchor === 'end' ? ' text-anchor="end"' : ''} font-size="${t.size}"${t.bold ? ' font-weight="700"' : ''} fill="${b.dim ? PALETTE.muted : t.tone === 'danger' ? PALETTE.danger : t.muted ? PALETTE.muted : PALETTE.text}">${emojiSpan(t.text)}</text>`);
  return out.join('\n  ');
}


export function renderClasses(b: LaidOutClasses, day: Theme, tones: ToneEnv): string {
  const out: string[] = [];
  const ink = b.dim ? PALETTE.muted : PALETTE.text, bg = PALETTE.bg;
  for (const e of b.edges) {
    const pts = e.points, n = pts.length, first = pts[0], second = pts[1], tip = pts[n - 1], prev = pts[n - 2];
    out.push(`<path d="M${pts.map(p => `${snap4(p.x)},${snap4(p.y)}`).join(' L')}" fill="none" stroke="${ink}" stroke-width="2"${e.line === 'dashed' ? ' stroke-dasharray="6,4"' : ''}/>`);
    const at = (p: {x: number; y: number}, q: {x: number; y: number}, L: number, W: number, shape: 'tri' | 'dia' | 'open', fill: string): string => {
      // the mark sits at p, pointing away from q (its body runs back toward q)
      const dx = Math.sign(p.x - q.x), dy = Math.sign(p.y - q.y), f = (a: number, c: number) => `${snap4(p.x - dx * a - dy * c)},${snap4(p.y - dy * a + dx * c)}`;
      if (shape === 'open') return `<path d="M${f(L, W)} L${snap4(p.x)},${snap4(p.y)} L${f(L, -W)}" fill="none" stroke="${ink}" stroke-width="2"/>`;
      return `<path d="M${snap4(p.x)},${snap4(p.y)} L${f(shape === 'tri' ? L : L / 2, W)} ${shape === 'dia' ? `L${f(L, 0)} ` : ''}L${f(shape === 'tri' ? L : L / 2, -W)} z" fill="${fill}" stroke="${ink}" stroke-width="2"/>`;
    };
    if (e.kind === 'inherit' || e.kind === 'implement') out.push(at(tip, prev, 14, 8, 'tri', bg));
    else if (e.kind === 'arrow' || e.kind === 'depend') out.push(at(tip, prev, 12, 6, 'open', bg));
    else if (e.kind === 'compose') out.push(at(first, second, 20, 7, 'dia', ink));
    else if (e.kind === 'aggregate') out.push(at(first, second, 20, 7, 'dia', bg));
  }
  const tone = (t?: string): string => colorOf(toneStyle(tones, t).text, day);
  for (const nd of b.nodes) {
    out.push(renderBoxRect({...nd, dim: b.dim}, day, tones, 'plain'));
    for (const y of nd.dividers) out.push(`<path d="M${snap4(nd.x)},${snap4(y)} H${snap4(nd.x + nd.w)}" fill="none" stroke="${b.dim ? PALETTE.muted : resolveBoxStyle(tones, nd.tone, day).stroke}" stroke-width="2"/>`);
  }
  for (const t of b.texts) {
    const n = b.nodes.find(r => t.x >= r.x && t.x <= r.x + r.w && t.y > r.y && t.y <= r.y + r.h);
    out.push(`<text x="${Math.round(t.x)}" y="${Math.round(t.y)}"${t.anchor === 'middle' ? ' text-anchor="middle"' : ''} font-size="${t.size}"${t.bold ? ' font-weight="700"' : ''} fill="${b.dim ? PALETTE.muted : t.muted ? (n && toneStyle(tones, n.tone).fill === 'soft' ? PALETTE.text : PALETTE.muted) : tone(n?.tone)}">${emojiSpan(t.text)}</text>`);
  }
  for (const l of b.labels) {
    out.push(`<rect x="${snap4(l.x)}" y="${snap4(l.y)}" width="${snap4(l.w)}" height="${l.h}" fill="${bg}"/>`);
    out.push(`<text x="${Math.round(l.tx)}" y="${Math.round(l.ty)}" text-anchor="middle" font-size="${l.size}" fill="${ink}">${emojiSpan(l.text)}</text>`);
  }
  return out.join('\n  ');
}


export function renderBpmn(b: LaidOutBpmn, day: Theme, tones: ToneEnv): string {
  const out: string[] = [];
  const ink = b.dim ? PALETTE.muted : PALETTE.text, bg = PALETTE.bg;
  for (const l of b.lanes) {
    out.push(`<rect x="${snap4(l.x)}" y="${snap4(l.y)}" width="${snap4(l.w)}" height="${snap4(l.h)}" fill="${l.tone === 'plain' ? bg : resolveBoxStyle(tones, l.tone, day).fill}" stroke="${PALETTE.muted}" stroke-width="2"/>`);
    out.push(`<rect x="${snap4(l.x)}" y="${snap4(l.y)}" width="${l.labelW}" height="${snap4(l.h)}" fill="${PALETTE.code}" stroke="${PALETTE.muted}" stroke-width="2"/>`);
  }
  for (const e of b.edges) {
    const pts = e.points.slice(), n = pts.length, tip = pts[n - 1], prev = pts[n - 2];
    const dx = Math.sign(tip.x - prev.x), dy = Math.sign(tip.y - prev.y), L = 11, W = 4.5;
    pts[n - 1] = {x: tip.x - dx * (L - 2), y: tip.y - dy * (L - 2)};
    out.push(`<path d="M${pts.map(p => `${snap4(p.x)},${snap4(p.y)}`).join(' L')}" fill="none" stroke="${ink}" stroke-width="2"${e.line === 'dashed' ? ' stroke-dasharray="6,4"' : ''}/>\n  <path d="M${snap4(tip.x)},${snap4(tip.y)} L${snap4(tip.x - dx * L - dy * W)},${snap4(tip.y - dy * L + dx * W)} L${snap4(tip.x - dx * L + dy * W)},${snap4(tip.y - dy * L - dx * W)} z" fill="${ink}"/>`);
  }
  for (const nd of b.nodes) {
    const cx = nd.x + nd.w / 2, cy = nd.y + nd.h / 2, st = b.dim ? PALETTE.muted : resolveBoxStyle(tones, nd.tone, day).stroke, fill = b.dim ? bg : resolveBoxStyle(tones, nd.tone, day).fill;
    if (nd.kind === 'task') { out.push(renderBoxRect({...nd, dim: b.dim}, day, tones, 'plain')); continue; }
    if (nd.kind === 'start' || nd.kind === 'end') { out.push(`<circle cx="${snap4(cx)}" cy="${snap4(cy)}" r="${nd.w / 2 - 2}" fill="${fill}" stroke="${st}" stroke-width="${nd.kind === 'end' ? 5 : 2}"/>`); continue; }
    const r = nd.w / 2;
    out.push(`<path d="M${snap4(cx)},${snap4(nd.y)} L${snap4(nd.x + nd.w)},${snap4(cy)} L${snap4(cx)},${snap4(nd.y + nd.h)} L${snap4(nd.x)},${snap4(cy)} z" fill="${fill}" stroke="${st}" stroke-width="2"/>`);
    const m = r * 0.42;
    if (nd.kind === 'xor') out.push(`<path d="M${snap4(cx - m)},${snap4(cy - m)} L${snap4(cx + m)},${snap4(cy + m)} M${snap4(cx + m)},${snap4(cy - m)} L${snap4(cx - m)},${snap4(cy + m)}" fill="none" stroke="${st}" stroke-width="3"/>`);
    else if (nd.kind === 'and') out.push(`<path d="M${snap4(cx - m * 1.15)},${snap4(cy)} H${snap4(cx + m * 1.15)} M${snap4(cx)},${snap4(cy - m * 1.15)} V${snap4(cy + m * 1.15)}" fill="none" stroke="${st}" stroke-width="3"/>`);
    else out.push(`<circle cx="${snap4(cx)}" cy="${snap4(cy)}" r="${snap4(m * 1.2)}" fill="none" stroke="${st}" stroke-width="3"/>`);
  }
  for (const t of b.texts) {
    const n = b.nodes.find(r => r.kind === 'task' && t.x >= r.x && t.x <= r.x + r.w && t.y > r.y && t.y <= r.y + r.h);
    out.push(`<text x="${Math.round(t.x)}" y="${Math.round(t.y)}"${t.anchor === 'middle' ? ' text-anchor="middle"' : t.anchor === 'end' ? ' text-anchor="end"' : ''} font-size="${t.size}"${t.bold ? ' font-weight="700"' : ''} fill="${b.dim ? PALETTE.muted : t.muted ? (n && toneStyle(tones, n.tone).fill === 'soft' ? PALETTE.text : PALETTE.muted) : colorOf(toneStyle(tones, n?.tone).text, day)}">${emojiSpan(t.text)}</text>`);
  }
  for (const ic of b.icons) out.push(iconSvg({glyph: ic.glyph, name: ic.name, x: ic.x, y: ic.y, size: ic.size, color: b.dim ? PALETTE.muted : ic.tone ? textColorOf(tones, ic.tone, day) : colorOf(toneStyle(tones, b.nodes[ic.node].tone).text, day), dim: b.dim, labelled: true}));
  for (const l of b.labels) {
    out.push(`<rect x="${snap4(l.x)}" y="${snap4(l.y)}" width="${snap4(l.w)}" height="${l.h}" fill="${bg}"/>`);
    out.push(`<text x="${Math.round(l.tx)}" y="${Math.round(l.ty)}" text-anchor="middle" font-size="${l.size}" fill="${ink}">${emojiSpan(l.text)}</text>`);
  }
  return out.join('\n  ');
}


// math(): the formula's outlines, scaled to the band's font size. The group is marked (data-math ... <!--/math-->) so lint-svg.ts can tell the
// formula's own nested groups from shapes an author placed.
export function renderMath(band: LaidOutMath): string {
  const n = (v: number) => +v.toFixed(2);
  const top = band.y + (band.h - band.drawnH) / 2;
  return `<g data-math="" role="img" aria-label="${escapeAttr(band.alt)}" transform="translate(${n(band.x)} ${n(top)}) scale(${+band.scale.toFixed(6)})" fill="${band.color}" stroke="${band.color}" stroke-width="0">${band.inner}</g><!--/math-->`;
}

// Serializes a layoutDiagram() result (see layout.ts) into an SVG string.
//
// Shape (rect/line) coordinates are snapped to the 4px grid — matching
// lint-svg.ts's coordinate-grid advisory, which only checks
// rect/circle/ellipse/line, never <text>. Text baselines are left at their
// computed (usually off-grid) position, same as every hand-authored diagram
// in this deck.

import {PALETTE, FONT_STACKS, EMOJI_RE, CONNECT_LABEL_SIZE, STRONG_STROKE, STRONG_HEAD, STRONG_HEAD_REF_X, STRONG_TRIM, TAG_SIZE, colorOf, textColorOf, toneStyle, isSolidTone, runColorOf, recolor, customColors, mapOf} from './tokens.ts';
import {badgeSvg, pillSvg} from './badge.ts';
import type {
  LaidOutDiagram, LaidOutBand, LaidOutBox, LaidOutCaption, LaidOutBanner, LaidOutGroup, LaidOutLegend, LaidOutRow,
  LaidOutGrid, LaidOutRaw, LaidOutPyramid, LaidOutCurve, LaidOutPlane, LaidOutBars, LaidOutImage, LaidOutTimeline, LaidOutPeople, LaidOutDots, PlaneTone, LaidOutSwimlane, LaidOutSequence, LaidOutTable,
  LaidOutConnect, LaidOutLegendItem, Point, WrappedRun, Theme, TextTone, BoxTone, EmphasisTone, LineStyle, Arrow, Align, ColorKey, Prim, Rect,
  LaidOutWireframe, LaidOutScreens, RawColorTone, Span, Roles,
} from './types.ts';
import {diagramTitle, diagramDesc} from './rules.ts';
import {BOX_PAD_X, BOX_PAD_Y, ICON_SIZE, STEP_BADGE_R, STEP_BADGE_BASELINE_OFFSET, LEGEND_SWATCH_W} from './layout.ts';
import {visibleAt} from './reveal.ts';
import {spotlightDim} from './spotlight.ts';
import {MARK_STROKE, plateStyle} from './image.ts';
import {PERSON_BOX, PERSON_PATH} from './people.ts';

const EMOJI_G = new RegExp(EMOJI_RE.source, 'gu');

function snap4(n: number): number {
  return Math.round(n / 4) * 4;
}

const XML_ESC: Record<string, string> = {'&': '&amp;', '<': '&lt;', '>': '&gt;'};
function escapeXml(s: string): string {
  return s.replace(/[&<>]/g, (c: string) => XML_ESC[c]);
}

// Wraps emoji codepoints in <tspan class="emoji">, using the SAME EMOJI_RE
// lint-svg.ts checks against — generated text can never trip that check.
function emojiSpan(text: string): string {
  let out = '';
  let last = 0;
  for (const m of text.matchAll(EMOJI_G)) {
    out += escapeXml(text.slice(last, m.index));
    out += `<tspan class="emoji">${escapeXml(m[0])}</tspan>`;
    last = (m.index ?? 0) + m[0].length;
  }
  out += escapeXml(text.slice(last));
  return out;
}

export const resolveTextColor = textColorOf;

export interface BoxStyle {fill: string; stroke: string; dashed: boolean}

export function resolveBoxStyle(tone: EmphasisTone | undefined, day: Theme, dashedOverride?: boolean): BoxStyle {
  const t = toneStyle(tone);
  // doc themes (string keys) use a stroke that reaches 3:1 against the page; the slide decks keep the pale border
  const stroke = typeof day === 'string' ? t.stroke : t.slideStroke ?? t.stroke;
  return {fill: colorOf(t.fill, day), stroke: colorOf(stroke ?? t.fill, day), dashed: dashedOverride ?? t.dashed};
}

const resolveLineColor = textColorOf;

// One line made of bold / coloured pieces: what has the line's own look stays plain text of the <text>, every other piece is a
// <tspan>. No whitespace goes between the tags (it would be drawn); an emoji inside a piece nests in it, so it keeps the piece's weight.
// A dimmed box keeps the bold but loses the colours (its text is all muted).
function spanTspans(spans: Span[], run: WrappedRun, color: string, day: Theme, dim?: boolean): string {
  return spans.map(sp => {
    const fill = !dim && sp.tone ? resolveTextColor(sp.tone, day) : color;
    const attrs = `${sp.bold && run.weight !== 700 ? ' font-weight="700"' : ''}${fill !== color ? ` fill="${fill}"` : ''}`;
    return attrs ? `<tspan${attrs}>${emojiSpan(sp.text)}</tspan>` : emojiSpan(sp.text);
  }).join('');
}

function renderTextRuns(
  wrappedRuns: WrappedRun[],
  {originX, originY, w, align, day, dim, boxTone}: {originX: number; originY: number; w: number; align: Align; day: Theme; dim?: boolean; boxTone?: EmphasisTone},
): string {
  const parts: string[] = [];
  for (const run of wrappedRuns) {
    // the dimmed look comes first: a solid box that is dimmed is a white box, so its (white) text would vanish
    const color = dim ? PALETTE.muted : runColorOf(run.tone, boxTone, day);
    const cls = run.mono ? ' class="mono"' : '';
    const anchor = align === 'center' ? ' text-anchor="middle"' : align === 'right' ? ' text-anchor="end"' : '';
    // A step() badge only ever indents the title run (see layout.ts's
    // textRuns) — every other run's indent is 0, so this is a no-op there.
    const indent = run.indent ?? 0;
    const runOriginX = originX + indent;
    const runW = w - indent;
    const lx = align === 'center' ? runOriginX + runW / 2 : align === 'right' ? runOriginX + runW : runOriginX;
    run.lines.forEach((line, i) => {
      const y = originY + run.lineYs[i];
      const content = run.lineSpans ? spanTspans(run.lineSpans[i], run, color, day, dim) : emojiSpan(line);
      parts.push(`<text x="${lx}" y="${y}"${anchor}${cls} font-size="${run.size}" font-weight="${run.weight}" fill="${color}">${content}</text>`);
    });
  }
  return parts.join('\n  ');
}

// Numbered circle badge for box({step}) — solid accent fill, white number,
// centered on the title's own baseline (same offset every hand-authored
// "① foo" box in this deck used between the badge and its number glyph).
// On a solid box the badge / tag pill has the box's own fill, so a white ring keeps it apart from the box.
const ringed = (band: LaidOutBox): boolean => !band.dim && isSolidTone(band.tone);

function renderStepBadge(band: LaidOutBox, day: Theme): string {
  const titleRun = band.wrappedRuns[0];
  const titleBaselineY = band.y + BOX_PAD_Y + titleRun.lineYs[0];
  const cx = band.x + BOX_PAD_X + STEP_BADGE_R;
  const cy = titleBaselineY - STEP_BADGE_BASELINE_OFFSET;
  return badgeSvg({cx, cy, r: STEP_BADGE_R, w: 2 * STEP_BADGE_R, shape: 'circle', label: String(band.step), aria: `手順 ${band.step}`, size: 16, fill: PALETTE[day].accent, ...(ringed(band) ? {stroke: PALETTE.bg} : {}), baseline: titleBaselineY, snap: snap4, esc: escapeXml});
}

// box({icon}): the icon's path scaled from its source viewBox to ICON_SIZE, at the box's top-left. Its colour is a text tone
// (a dimmed box: muted). With a title the label carries the meaning, so the icon is hidden from assistive technology.
function renderBoxIcon(band: LaidOutBox, day: Theme): string {
  const g = band.iconGlyph!;
  const {vb: [vx, vy, vs]} = g;
  const s = ICON_SIZE / vs;
  const x = band.x + (band.padX ?? BOX_PAD_X), y = band.y + (band.padY ?? BOX_PAD_Y);
  const n = (v: number) => +v.toFixed(4);
  const color = band.dim ? PALETTE.muted : runColorOf(band.iconTone, band.tone, day);
  const a11y = band.title ? 'aria-hidden="true"' : `role="img" aria-label="${band.icon}"`;
  const at = `transform="translate(${n(x - vx * s)} ${n(y - vy * s)}) scale(${n(s)})"`;
  if (g.body === undefined) return `\n  <path d="${g.d}" ${at} fill="${color}"${g.rule ? ' fill-rule="evenodd"' : ''} ${a11y} data-icon="${band.icon}"/>`;
  // shapes drawn the way the set drew them: `currentColor` is the tone colour; an icon with colours of its own keeps them (faded when dimmed)
  const inner = g.body.replaceAll('currentColor', color);
  return `\n  <g ${at} fill="${color}"${g.fixed ? ` data-icon-fixed="true"${band.dim ? ' opacity="0.35"' : ''}` : ''} ${a11y} data-icon="${band.icon}">${inner}</g>`;
}

function renderCaption(band: LaidOutCaption, day: Theme): string {
  return renderTextRuns(band.wrappedRuns, {originX: band.x, originY: band.y, w: band.w, align: band.align ?? 'center', day, dim: band.dim});
}

type BoxLike = Rect & {tone?: EmphasisTone; dashed?: boolean; dim?: boolean};
function renderBoxRect(band: BoxLike, day: Theme, defaultTone: EmphasisTone): string {
  const style = resolveBoxStyle(band.tone ?? defaultTone, day, band.dashed);
  if (band.dim) { style.fill = PALETTE.bg; style.stroke = PALETTE.muted; }
  const dash = style.dashed ? ' stroke-dasharray="6,4"' : band.dim ? ' stroke-dasharray="2,5" stroke-linecap="round"' : '';
  const rx = snap4(band.x), ry = snap4(band.y), rw = snap4(band.w), rh = snap4(band.h);
  return `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="8" fill="${style.fill}" stroke="${style.stroke}" stroke-width="2.5"${dash}/>`;
}

function renderBoxText(band: LaidOutBox | LaidOutBanner, day: Theme, defaultAlign: Align): string {
  const align = band.align ?? defaultAlign;
  const px = band.padX ?? BOX_PAD_X, py = band.padY ?? BOX_PAD_Y;
  const originX = band.x + px;
  return renderTextRuns(band.wrappedRuns, {originX, originY: band.y + py, w: band.w - 2 * px, align, day, dim: band.dim, boxTone: band.tone});
}

function renderTag(band: LaidOutBox, day: Theme, roles: Roles): string {
  const t = band.tagBox as Rect; // caller checked tagBox
  const fill = band.dim ? PALETTE.muted : colorOf(toneStyle(band.tagTone === 'danger' || band.tagTone === 'muted' ? band.tagTone : 'accent').ink, day);
  return pillSvg({x: snap4(t.x), y: snap4(t.y), w: snap4(t.w), h: t.h, fill, cx: t.x + t.w / 2, baseline: t.y + 17, text: PALETTE.bg, ...(ringed(band) ? {stroke: PALETTE.bg} : {}), size: (roles.tag ?? TAG_SIZE), labelHtml: emojiSpan(band.tag as string)});
}

// The stamp chip: bottom-right inside the shape (layout reserved the strip; rows may have stretched the shape since, so it follows the bottom edge).
function renderStamp(band: Rect & {stamp?: string; stampW?: number}, roles: Roles): string {
  if (!band.stamp || band.stampW === undefined) return '';
  const x = snap4(band.x + band.w - 8 - band.stampW), y = snap4(band.y + band.h - 6 - 24);
  return `\n  <rect x="${x}" y="${y}" width="${snap4(band.stampW)}" height="24" rx="4" fill="${PALETTE.bg}" stroke="${PALETTE.border}" stroke-width="1"/>\n  <text x="${snap4(band.x + band.w - 8 - band.stampW / 2)}" y="${y + 17}" font-size="${roles.note}" text-anchor="middle" fill="${PALETTE.muted}">${emojiSpan(band.stamp)}</text>`;
}

function renderBox(band: LaidOutBox, day: Theme, roles: Roles): string {
  const badge = band.step != null ? `\n  ${renderStepBadge(band, day)}` : '';
  const iconText = band.icon ? renderBoxIcon(band, day) : '';
  const tag = band.tagBox ? `\n  ${renderTag(band, day, roles)}` : '';
  return `${renderBoxRect(band, day, 'plain')}\n  ${renderBoxText(band, day, 'left')}${badge}${iconText}${tag}${renderStamp(band, roles)}`;
}

function renderGroup(band: LaidOutGroup, day: Theme, roles: Roles): string {
  if (band.frame === false) return renderStamp(band, roles);
  return renderBoxRect(band, day, 'muted') + renderStamp(band, roles);
}

function lineAttrs(line: LineStyle | undefined): string {
  return line === 'dashed' ? ' stroke-dasharray="6,4"' : line === 'dotted' ? ' stroke-dasharray="2,5" stroke-linecap="round"' : '';
}

function arrowMarkers(arrow: Arrow | undefined, dim = false, strong = false): string {
  const id = `dsl-arrow${strong ? '-strong' : ''}${dim ? '-dim' : ''}`;
  return `${arrow === 'start' || arrow === 'both' ? ` marker-start="url(#${id})"` : ''}${arrow === 'end' || arrow === 'both' ? ` marker-end="url(#${id})"` : ''}`;
}

// A line sample (and optional arrowhead) + label per item, laid out by layout.ts.
function renderLegend(band: LaidOutLegend, day: Theme, roles: Roles): string {
  const parts: string[] = [];
  for (const it of band.items) {
    const cy = it.y + 12;
    if (it.line) {
      const strong = it.weight === 'strong', arrow = it.arrow ?? 'end';
      const [x1, x2] = strong ? trimEnds(it.x, it.x + LEGEND_SWATCH_W, arrow) : [it.x, it.x + LEGEND_SWATCH_W];
      const d = `M${snap4(x1)},${cy} L${snap4(x2)},${cy}`;
      if (strong) {
        parts.push(`<path d="${d}" fill="none" stroke="${PALETTE.text}" stroke-width="${STRONG_STROKE}"${lineAttrs(it.line)}${arrowMarkers(arrow, false, true)}/>`);
      } else if (it.line === 'double') {
        parts.push(`<path d="${d}" fill="none" stroke="${PALETTE.text}" stroke-width="6"/>`);
        parts.push(`<path d="${d}" fill="none" stroke="${PALETTE.bg}" stroke-width="2"${arrowMarkers(it.arrow ?? 'end')}/>`);
      } else {
        parts.push(`<path d="${d}" fill="none" stroke="${PALETTE.text}" stroke-width="2"${lineAttrs(it.line)}${arrowMarkers(it.arrow ?? 'end')}/>`);
      }
    } else {
      const style = resolveBoxStyle(it.tone ?? 'plain', day, it.dashed);
      parts.push(`<rect x="${snap4(it.x + 4)}" y="${snap4(cy - 8)}" width="28" height="16" rx="4" fill="${style.fill}" stroke="${style.stroke}" stroke-width="2.5"${style.dashed ? ' stroke-dasharray="6,4"' : ''}/>`);
    }
    parts.push(`<text x="${Math.round(it.x + LEGEND_SWATCH_W + 8)}" y="${cy + 5}" font-size="${roles.note}" fill="${PALETTE.text}">${emojiSpan(it.label)}</text>`);
  }
  return parts.join('\n  ');
}

function renderBanner(band: LaidOutBanner, day: Theme, roles: Roles): string {
  return `${renderBoxRect(band, day, 'accent')}\n  ${renderBoxText(band, day, 'center')}${renderStamp(band, roles)}`;
}

function renderRow(band: LaidOutRow, day: Theme, roles: Roles, stage?: number): string {
  const boxes = band.children.filter(c => visibleAt(c, stage)).map(c => renderBox(c, day, roles)).join('\n\n  ');
  const arrows = band.arrows.filter((_, i) => visibleAt(band.children[i], stage) && visibleAt(band.children[i + 1], stage)).map(a =>
    `<path d="M${snap4(a.x1)},${Math.round(a.y1)} L${snap4(a.x2)},${Math.round(a.y2)}" fill="none" stroke="${band.dim ? PALETTE.muted : PALETTE.text}" stroke-width="2.5" marker-end="url(#${band.dim ? 'dsl-arrow-dim' : 'dsl-arrow'})"/>`,
  ).join('\n  ');
  return arrows ? `${boxes}\n\n  ${arrows}` : boxes;
}

function renderGrid(band: LaidOutGrid, day: Theme, roles: Roles, stage?: number): string {
  return band.children.filter(c => visibleAt(c, stage)).map(c => renderBox(c, day, roles)).join('\n\n  ');
}

// A strong line stops STRONG_TRIM short of the end(s) that carry an arrowhead, so the head's tip lands on the box edge.
function trimEnds(a: number, b: number, arrow: Arrow | undefined): [number, number] {
  const dir = Math.sign(b - a), len = Math.abs(b - a);
  if (len < STRONG_TRIM * 3) return [a, b];
  return [arrow === 'start' || arrow === 'both' ? a + dir * STRONG_TRIM : a, arrow === 'end' || arrow === 'both' ? b - dir * STRONG_TRIM : b];
}

function trimPoints(points: Point[], arrow: Arrow): Point[] {
  const pts = points.map(p => ({...p}));
  const pull = (tip: Point, prev: Point): void => {
    const len = Math.hypot(tip.x - prev.x, tip.y - prev.y);
    if (len < STRONG_TRIM * 3) return;
    tip.x -= (tip.x - prev.x) / len * STRONG_TRIM;
    tip.y -= (tip.y - prev.y) / len * STRONG_TRIM;
  };
  if (arrow === 'end' || arrow === 'both') pull(pts[pts.length - 1], pts[pts.length - 2]);
  if (arrow === 'start' || arrow === 'both') pull(pts[0], pts[1]);
  return pts;
}

function renderConnectPath(c: LaidOutConnect): string {
  const points = c.weight === 'strong' ? trimPoints(c.points, c.arrow) : c.points;
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${Math.round(p.x)},${Math.round(p.y)}`).join(' ');
}

function renderConnect(c: LaidOutConnect, day: Theme, roles: Roles): string {
  const color = c.dim ? PALETTE.muted : resolveLineColor(c.tone, day);
  const d = renderConnectPath(c);
  const strong = c.weight === 'strong';
  const markers = arrowMarkers(c.arrow, c.dim, strong);
  let path: string;
  if (strong) {
    path = `<path d="${d}" fill="none" stroke="${color}" stroke-width="${STRONG_STROKE}"${lineAttrs(c.line)}${markers}/>`;
  } else if (c.line === 'double') {
    // a thick line with a background-colored core: reads as "=" and keeps the arrowhead on the core
    path = `<path d="${d}" fill="none" stroke="${color}" stroke-width="6"/>\n  <path d="${d}" fill="none" stroke="${PALETTE.bg}" stroke-width="2"${markers}/>`;
  } else {
    path = `<path d="${d}" fill="none" stroke="${color}" stroke-width="2"${lineAttrs(c.line)}${markers}/>`;
  }
  if (!c.label) return path;
  // labelX/labelY (and chipBox) are computed once in layout.ts's resolveConnect()
  // along with labelBox, which verify.ts checks for overlap — reusing them here
  // keeps emit and verify looking at the same point.
  if (c.chipBox) {
    const b = c.chipBox;
    return `${path}\n  ${pillSvg({x: snap4(b.x), y: snap4(b.y), w: snap4(b.w), h: b.h, fill: PALETTE.bg, stroke: color, cx: c.labelX as number, baseline: c.labelY as number, text: color, size: (roles.connectLabel ?? CONNECT_LABEL_SIZE), weight: 400, labelHtml: escapeXml(c.label)})}`;
  }
  return `${path}\n  <text x="${c.labelX}" y="${c.labelY}" text-anchor="middle" font-size="${(roles.connectLabel ?? CONNECT_LABEL_SIZE)}" fill="${color}">${escapeXml(c.label)}</text>`;
}

function renderPyramid(band: LaidOutPyramid, roles: Roles): string {
  return band.layers.map(layer => {
    const pts = layer.points.map(([px, py]) => `${Math.round(px)},${Math.round(py)}`).join(' ');
    const accent = PALETTE[band.day].accent;
    const shape = `<polygon points="${pts}" fill="${accent}" fill-opacity="${layer.opacity}" stroke="${accent}" stroke-width="2.5"/>`;
    const text = layer.lines.map((line, i) =>
      `<text x="${Math.round(layer.cx)}" y="${layer.textYs[i]}" text-anchor="middle" font-size="${roles.title}" font-weight="700" fill="${layer.textColor}">${emojiSpan(line)}</text>`,
    ).join('\n  ');
    return `${shape}\n  ${text}`;
  }).join('\n\n  ');
}

// people(): one person icon per head, the emphasized ones filled and the rest outlines (the count reads without colour).
function renderPeople(band: LaidOutPeople, day: Theme): string {
  const d = PERSON_PATH, s = band.size / PERSON_BOX.size, n = (v: number) => +v.toFixed(4);
  const color = colorOf(toneStyle(band.tone).ink, day), color2 = colorOf(toneStyle(band.tone2).ink, day), rest = colorOf(toneStyle(band.rest).ink, day);
  const icon = (i: {x: number; y: number; on: boolean; second?: true}) => `<path d="${d}" transform="translate(${n(i.x - PERSON_BOX.from * s)} ${n(i.y - PERSON_BOX.from * s)}) scale(${n(s)})" ${i.on ? `fill="${i.second ? color2 : color}"` : `fill="none" stroke="${rest}" stroke-width="${n(1.5 / s)}"`}/>`;
  const texts = band.texts.map(t => `\n  <text x="${Math.round(t.x)}" y="${Math.round(t.y)}" font-size="${t.size}"${t.bold ? ' font-weight="700"' : ''} fill="${textColorOf(t.tone, day)}">${emojiSpan(t.text)}</text>`).join('');
  return `<g role="img" aria-label="${escapeXml(band.alt)}">\n  ${band.icons.map(icon).join('\n  ')}\n  </g>${texts}`;
}

// dots(): a lane (an axis line), bars on the lane for its zones, a dot per value piled above it, labels under it.
function renderDots(band: LaidOutDots, day: Theme): string {
  const color = (tone: string) => colorOf(toneStyle(tone).ink, day), n = (v: number) => +v.toFixed(2);
  const parts = [`<line x1="${n(band.axis.x1)}" y1="${n(band.axis.y)}" x2="${n(band.axis.x2)}" y2="${n(band.axis.y)}" stroke="${PALETTE.muted}" stroke-width="2"/>`];
  for (const z of band.zones) parts.push(`<rect x="${n(z.x)}" y="${n(z.top)}" width="${n(z.w)}" height="${n(z.y - 4 - z.top)}" fill="${color(z.tone)}" fill-opacity="0.12"/>`);
  for (const z of band.zones) parts.push(`<rect x="${n(z.x)}" y="${n(z.y - 4)}" width="${n(z.w)}" height="8" fill="${color(z.tone)}"/>`);
  const dots = band.dots.map(p => `<circle cx="${n(p.x)}" cy="${n(p.y)}" r="${band.r}" fill="${color(p.tone)}"/>`).join('\n    ');
  parts.push(`<g role="img" aria-label="${escapeXml(band.alt)}">\n    ${dots}\n  </g>`);
  for (const t of band.texts) parts.push(`<text x="${n(t.x)}" y="${n(t.y)}" text-anchor="${t.anchor}" font-size="${t.size}" fill="${PALETTE.text}">${emojiSpan(t.text)}</text>`);
  return parts.join('\n  ');
}

function renderCurve(band: LaidOutCurve, day: Theme): string {
  const parts: string[] = [];
  parts.push(`<path d="M${Math.round(band.axisX)},${Math.round(band.axisTop)} L${Math.round(band.axisX)},${Math.round(band.axisBottom)} L${Math.round(band.axisRight)},${Math.round(band.axisBottom)}" fill="none" stroke="${PALETTE.text}" stroke-width="2"/>`);
  parts.push(`<path d="${band.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${Math.round(p.x)},${Math.round(p.y)}`).join(' ')}" fill="none" stroke="${PALETTE.text}" stroke-width="3"/>`);

  const emphColor = (emphasis: string) => colorOf(toneStyle(emphasis === 'accent' || emphasis === 'danger' ? emphasis : 'muted').ink, day);
  band.points.forEach((p, i) => {
    const color = p.emphasis ? emphColor(p.emphasis) : (i === 0 ? PALETTE[day].accent : PALETTE.muted);
    const r = p.emphasis === 'danger' ? 8 : i === 0 ? 6 : 5;
    if (p.dropLine) {
      parts.push(`<path d="M${Math.round(p.x)},${Math.round(p.y)} L${Math.round(p.x)},${Math.round(band.axisBottom)}" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="6,4"/>`);
    }
    parts.push(`<circle cx="${snap4(p.x)}" cy="${snap4(p.y)}" r="${r}" fill="${color}"/>`);
  });

  if (band.yTopLabel) parts.push(`<text x="${Math.round(band.axisX - 8)}" y="${Math.round(band.axisTop + 4)}" text-anchor="end" font-size="14" fill="${PALETTE.muted}">${escapeXml(band.yTopLabel)}</text>`);
  if (band.yBottomLabel) parts.push(`<text x="${Math.round(band.axisX - 8)}" y="${Math.round(band.axisBottom)}" text-anchor="end" font-size="14" fill="${PALETTE.muted}">${escapeXml(band.yBottomLabel)}</text>`);
  if (band.xLabel) parts.push(`<text x="${Math.round(band.axisX)}" y="${Math.round(band.axisBottom + 24)}" font-size="14" fill="${PALETTE.muted}">${escapeXml(band.xLabel)}</text>`);

  return parts.join('\n  ');
}

// plane(): axes (with arrowheads), ticks, guides, points, dimension lines with their label chips, then every text.
function renderPlane(b: LaidOutPlane, day: Theme, stage?: number): string {
  const col = (t: PlaneTone) => resolveTextColor(t, day);
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
    else out.push(`<circle cx="${x}" cy="${y}" r="6" fill="${c}"/>`);
  }
  for (const t of b.texts.filter(t => visibleAt(t, stage))) {
    out.push(`<text x="${Math.round(t.x)}" y="${Math.round(t.y)}"${t.anchor === 'start' ? '' : ` text-anchor="${t.anchor}"`} font-size="${b.labelSize}"${t.bold ? ' font-weight="700"' : ''} fill="${col(t.tone)}">${emojiSpan(t.s)}</text>`);
  }
  return out.join('\n  ');
}

function renderBars(b: LaidOutBars, day: Theme, stage?: number, dimFill = false): string {
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
  for (const t of b.texts.filter(t => visibleAt(t, stage))) {
    const anchor = t.anchor === 'start' ? '' : ` text-anchor="${t.anchor}"`;
    out.push(`<text x="${Math.round(t.x)}" y="${Math.round(t.y)}"${anchor} font-size="${t.size}"${t.bold ? ' font-weight="700"' : ''} fill="${t.dim || b.dim ? PALETTE.muted : col(t.fill)}">${emojiSpan(t.text)}</text>`);
  }
  return out.join('\n  ');
}

function renderImage(b: LaidOutImage, day: Theme, stage?: number): string {
  const col = (k: ColorKey) => colorOf(k, day);
  const out: string[] = [];
  const esc = (s: string) => escapeXml(s).replace(/"/g, '&quot;');
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
    const ink = m.dim || b.dim ? PALETTE.muted : col(toneStyle(m.tone).ink);
    out.push(`<rect x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" fill="none" stroke="${ink}" stroke-width="${MARK_STROKE}"${m.dim || b.dim ? ' stroke-dasharray="2,5" stroke-linecap="round"' : ''}/>`);
  }
  for (const p of b.plates.filter(p => visibleAt(p, stage))) {
    const st = plateStyle(p.tone), dim = p.dim || b.dim;
    const x = snap4(p.x), y = snap4(p.y), w = snap4(p.x + p.w) - x;
    out.push(`<rect x="${x}" y="${y}" width="${w}" height="${p.h}" rx="${p.h / 2}" fill="${dim ? PALETTE.bg : col(st.fill)}" stroke="${dim ? PALETTE.muted : col(st.stroke)}" stroke-width="2"/>`);
    out.push(`<text x="${Math.round(x + w / 2)}" y="${Math.round(y + p.h / 2 + p.size * 0.36)}" text-anchor="middle" font-size="${p.size}" font-weight="700" fill="${dim ? PALETTE.muted : col(st.text)}">${emojiSpan(p.text)}</text>`);
  }
  return out.join('\n  ');
}

function renderTimeline(b: LaidOutTimeline, day: Theme): string {
  // a dimmed timeline draws itself muted (so the white knock-out ring around each dot stays white)
  const col = (k: 'text' | 'muted' | 'accent' | 'danger') => b.dim ? PALETTE.muted : colorOf(k, day);
  const out: string[] = [`<path d="M${snap4(b.axis.x1)},${snap4(b.axis.y)} H${snap4(b.axis.x2)}" fill="none" stroke="${PALETTE.muted}" stroke-width="2"/>`];
  if (b.span?.fill) {
    const x1 = snap4(b.span.x1), y1 = snap4(b.span.y - 12);
    out.unshift(`<rect x="${x1}" y="${y1}" width="${snap4(b.span.x2) - x1}" height="24" fill="${b.span.tone === 'accent' && !b.dim ? PALETTE[day].soft : PALETTE.border}"/>`);
  } else if (b.span) out.push(`<path d="M${snap4(b.span.x1)},${snap4(b.span.y)} H${snap4(b.span.x2)}" fill="none" stroke="${col(b.span.tone)}" stroke-width="8"/>`);
  if (b.fullLine) out.push(`<path d="M${snap4(b.fullLine.x)},${snap4(b.fullLine.y1)} V${snap4(b.fullLine.y2)}" fill="none" stroke="${col('danger')}" stroke-width="2"/>`);
  for (const t of b.ticks) out.push(`<path d="M${snap4(t.x)},${snap4(t.y1)} V${snap4(t.y2)}" fill="none" stroke="${PALETTE.muted}" stroke-width="2"/>`);
  for (const s of b.stems) out.push(`<path d="M${snap4(s.x)},${snap4(s.y1)} V${snap4(s.y2)}" fill="none" stroke="${col(s.tone)}" stroke-width="2"/>`);
  for (const d of b.dots) out.push(`<circle cx="${snap4(d.x)}" cy="${snap4(d.y)}" r="${d.r}" fill="${col(d.tone)}" stroke="${PALETTE.bg}" stroke-width="4"/>`);
  if (b.bracket) { const {x1, x2, y, tone} = b.bracket; out.push(`<path d="M${snap4(x1)},${snap4(y - 4)} V${snap4(y)} H${snap4(x2)} V${snap4(y - 4)}" fill="none" stroke="${col(tone)}" stroke-width="2"/>`); }
  for (const t of b.texts) out.push(`<text x="${Math.round(t.x)}" y="${Math.round(t.y)}"${t.anchor === 'start' ? '' : ` text-anchor="${t.anchor}"`} font-size="${t.size}"${t.bold ? ' font-weight="700"' : ''} fill="${col(t.fill)}">${emojiSpan(t.text)}</text>`);
  return out.join('\n  ');
}

function renderRaw(band: LaidOutRaw, day: Theme): string {
  const ctx = {
    x: band.x, y: band.y, w: band.w, h: band.h, day,
    color: (tone: RawColorTone): string => tone === 'accent' ? PALETTE[day].accent
      : tone === 'accent-soft' ? PALETTE[day].soft
      : PALETTE[tone] ?? PALETTE.text, // unknown tones fall back to text at runtime
  };
  return band.draw(ctx);
}


// ---- sequence() / table() renderers (geometry comes from seq-table.ts) ------
const LH_EM = 1.4;

function strokeLine(d: string, color: string, line: LineStyle | undefined, arrow: Arrow | undefined, width = 2): string {
  if (line === 'double') {
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="6"/>\n  <path d="${d}" fill="none" stroke="${PALETTE.bg}" stroke-width="2"${arrowMarkers(arrow)}/>`;
  }
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}"${lineAttrs(line)}${arrowMarkers(arrow)}/>`;
}

function textLines(
  lines: string[],
  {x, top, size, weight = 400, anchor = 'start', fill, mono = false}: {x: number; top: number; size: number; weight?: number; anchor?: 'start' | 'middle' | 'end'; fill: string; mono?: boolean},
): string {
  const a = anchor === 'middle' ? ' text-anchor="middle"' : anchor === 'end' ? ' text-anchor="end"' : '';
  const cls = mono ? ' class="mono"' : '';
  return lines.map((l, k) =>
    `<text x="${Math.round(x)}" y="${Math.round(top + size + k * size * LH_EM)}"${a}${cls} font-size="${size}" font-weight="${weight}" fill="${fill}">${emojiSpan(l)}</text>`).join('\n  ');
}

function renderSequence(band: LaidOutSequence, day: Theme, roles: Roles): string {
  const parts: string[] = [];
  for (const h of band.heads) {
    parts.push(`<path d="M${Math.round(h.cx)},${Math.round(h.y + h.h)} L${Math.round(h.cx)},${Math.round(band.lifeBottom)}" fill="none" stroke="${PALETTE.border}" stroke-width="2" stroke-dasharray="6,6"/>`);
  }
  for (const h of band.heads) {
    const st = resolveBoxStyle(h.tone ?? 'plain', day);
    parts.push(`<rect x="${snap4(h.x)}" y="${snap4(h.y)}" width="${snap4(h.w)}" height="${snap4(h.h)}" rx="8" fill="${st.fill}" stroke="${st.stroke}" stroke-width="2.5"${st.dashed ? ' stroke-dasharray="6,4"' : ''}/>`);
    parts.push(textLines(h.lines, {x: h.cx, top: h.y + 12, size: roles.title, weight: 700, anchor: 'middle', fill: PALETTE.text}));
  }
  for (const s of band.steps) {
    if (s.kind === 'msg') {
      const color = resolveLineColor(s.tone, day);
      parts.push(strokeLine(`M${Math.round(s.x1)},${Math.round(s.y)} L${Math.round(s.x2)},${Math.round(s.y)}`, color, s.line, s.arrow));
      parts.push(textLines(s.lines, {x: s.lx, top: s.labelTop, size: roles.note, anchor: 'middle', fill: s.tone ? color : PALETTE.text}));
    } else if (s.kind === 'self') {
      const color = resolveLineColor(s.tone, day);
      const dir = s.side === 'left' ? -1 : 1;
      const x0 = Math.round(s.cx), x1 = Math.round(s.cx + dir * 36), y0 = Math.round(s.y), y1 = Math.round(s.y + s.loopH);
      parts.push(strokeLine(`M${x0},${y0} L${x1},${y0} L${x1},${y1} L${x0},${y1}`, color, s.line, 'end'));
      parts.push(textLines(s.lines, {x: s.lx, top: s.labelTop, size: roles.note, anchor: s.side === 'left' ? 'end' : undefined, fill: s.tone ? color : PALETTE.text}));
    } else if (s.kind === 'note') {
      const st = resolveBoxStyle(s.tone, day);
      parts.push(`<rect x="${snap4(s.x)}" y="${snap4(s.y)}" width="${snap4(s.w)}" height="${snap4(s.h)}" rx="8" fill="${st.fill}" stroke="${st.stroke}" stroke-width="2.5"${st.dashed ? ' stroke-dasharray="6,4"' : ''}/>`);
      parts.push(textLines(s.lines, {x: s.x + 12, top: s.y + 8, size: roles.note, fill: PALETTE.text}));
    } else {
      parts.push(`<path d="M${Math.round(s.x1)},${Math.round(s.y)} L${Math.round(s.x2)},${Math.round(s.y)}" fill="none" stroke="${PALETTE.muted}" stroke-width="2" stroke-dasharray="6,4"/>`);
      parts.push(`<rect x="${snap4(s.cx - s.chipW / 2)}" y="${snap4(s.y - 12)}" width="${snap4(s.chipW)}" height="24" rx="12" fill="${PALETTE.bg}" stroke="${PALETTE.muted}" stroke-width="2"/>`);
      parts.push(textLines([s.text], {x: s.cx, top: s.y - 12 + 1, size: roles.note, weight: 700, anchor: 'middle', fill: PALETTE.text}));
    }
  }
  return parts.join('\n  ');
}

// Rounded rectangle path; `r` per corner so table sections can round only the outer corners.
function rrPath(x: number, y: number, w: number, h: number, {tl = 0, tr = 0, br = 0, bl = 0}: {tl?: number; tr?: number; br?: number; bl?: number} = {}): string {
  const X = Math.round(x), Y = Math.round(y), W = Math.round(w), H = Math.round(h);
  return `M${X + tl},${Y} H${X + W - tr} ${tr ? `A${tr},${tr} 0 0 1 ${X + W},${Y + tr}` : ''} V${Y + H - br} ${br ? `A${br},${br} 0 0 1 ${X + W - br},${Y + H}` : ''} H${X + bl} ${bl ? `A${bl},${bl} 0 0 1 ${X},${Y + H - bl}` : ''} V${Y + tl} ${tl ? `A${tl},${tl} 0 0 1 ${X + tl},${Y}` : ''} Z`;
}

function renderTable(band: LaidOutTable, day: Theme, roles: Roles): string {
  const parts: string[] = [];
  const R = 8;
  const last = band.rows.length - 1;
  const titled = !!band.titleBar;
  if (titled) {
    const t = band.titleBar as NonNullable<LaidOutTable['titleBar']>;
    parts.push(`<path d="${rrPath(band.x, t.y, band.w, t.h, {tl: R, tr: R})}" fill="${PALETTE[day].accent}"/>`);
    parts.push(textLines(t.lines, {x: band.x + 12, top: t.y + 8, size: roles.title, weight: 700, fill: PALETTE.bg}));
  }
  band.rows.forEach((row, i) => {
    const top = i === 0 && !titled, bottom = i === last;
    const corners = {tl: top ? R : 0, tr: top ? R : 0, bl: bottom ? R : 0, br: bottom ? R : 0};
    const fill = row.header ? PALETTE[day].soft : row.tone ? resolveBoxStyle(row.tone, day).fill : PALETTE.bg;
    parts.push(`<path d="${rrPath(band.x, row.y, band.w, row.h, corners)}" fill="${fill}"/>`);
    // row-heading cell: always soft, whatever the row's tone; only the outer left corners round
    if (band.rowHeader && !row.header) parts.push(`<path d="${rrPath(band.x, row.y, band.colW[0], row.h, {tl: corners.tl, bl: corners.bl})}" fill="${PALETTE[day].soft}"/>`);
    if (i > 0 || titled) parts.push(`<path d="M${Math.round(band.x)},${Math.round(row.y)} H${Math.round(band.x + band.w)}" stroke="${PALETTE.border}" stroke-width="2"/>`);
  });
  const y0 = band.rows[0].y, y1 = band.rows[last].y + band.rows[last].h;
  for (let i = 1; i < band.colX.length; i++) {
    parts.push(`<path d="M${Math.round(band.colX[i])},${Math.round(y0)} V${Math.round(y1)}" stroke="${PALETTE.border}" stroke-width="2"/>`);
  }
  const firstBody = band.rows.findIndex(r => !r.header);
  if (band.rowHeader && firstBody >= 0) {
    parts.push(`<path d="M${Math.round(band.colX[1])},${Math.round(band.rows[firstBody].y)} V${Math.round(y1)}" stroke="${PALETTE.text}" stroke-width="3"/>`);
  }
  for (const row of band.rows) {
    for (const c of row.cells) {
      if (!c.lines.length) continue;
      const anchor = c.align === 'center' ? 'middle' : c.align === 'right' ? 'end' : 'start';
      const x = c.align === 'center' ? c.x + c.w / 2 : c.align === 'right' ? c.x + c.w - 12 : c.x + 12;
      parts.push(textLines(c.lines, {x, top: c.top, size: roles.body, weight: c.bold ? 700 : 400, anchor, fill: resolveTextColor(c.tone, day), mono: c.mono}));
    }
  }
  const top = band.y, h = band.h;
  parts.push(`<path d="${rrPath(band.x, top, band.w, h, {tl: R, tr: R, bl: R, br: R})}" fill="none" stroke="${PALETTE.text}" stroke-width="2.5"/>`);
  return parts.join('\n  ');
}

function renderSwimlane(b: LaidOutSwimlane, day: Theme, roles: Roles): string {
  const parts: string[] = [];
  const R = 8, n = b.lanes.length, hasPh = b.phaseH > 0;
  const X1 = b.x + b.w;
  if (hasPh) {
    parts.push(`<path d="${rrPath(b.bodyX, b.y, X1 - b.bodyX, b.phaseH, {tr: R})}" fill="${PALETTE[day].soft}"/>`);
    parts.push(`<path d="${rrPath(b.x, b.y, b.labelW, b.phaseH, {tl: R})}" fill="${PALETTE.code}"/>`);
    for (const ph of b.phases) {
      parts.push(`<path d="M${Math.round(ph.x)},${Math.round(b.y)} V${Math.round(b.y + b.phaseH)}" stroke="${PALETTE.border}" stroke-width="2"/>`);
      parts.push(textLines(ph.lines, {x: ph.x + ph.w / 2, top: b.y + 8, size: roles.note, weight: 700, anchor: 'middle', fill: PALETTE[day].accent}));
    }
  }
  b.lanes.forEach((ln, i) => {
    const first = i === 0 && !hasPh, last = i === n - 1;
    const bodyFill = i % 2 === 0 ? PALETTE.bg : PALETTE.code;
    const labelFill = ln.tone === 'accent' ? PALETTE[day].soft : PALETTE.code;
    parts.push(`<path d="${rrPath(b.x, ln.y, b.labelW, ln.h, {tl: first ? R : 0, bl: last ? R : 0})}" fill="${labelFill}"/>`);
    parts.push(`<path d="${rrPath(b.bodyX, ln.y, X1 - b.bodyX, ln.h, {tr: first ? R : 0, br: last ? R : 0})}" fill="${bodyFill}"/>`);
    if (i > 0 || hasPh) parts.push(`<path d="M${Math.round(b.x)},${Math.round(ln.y)} H${Math.round(X1)}" stroke="${PALETTE.border}" stroke-width="2"/>`);
    parts.push(textLines(ln.labelLines, {x: b.x + b.labelW / 2, top: ln.labelTop, size: roles.title, weight: 700, anchor: 'middle', fill: ln.tone === 'accent' ? PALETTE[day].accent : PALETTE.text}));
  });
  parts.push(`<path d="M${Math.round(b.bodyX)},${Math.round(b.y)} V${Math.round(b.y + b.h)}" stroke="${PALETTE.text}" stroke-width="2"/>`);
  parts.push(`<path d="${rrPath(b.x, b.y, b.w, b.h, {tl: R, tr: R, bl: R, br: R})}" fill="none" stroke="${PALETTE.text}" stroke-width="2.5"/>`);
  return parts.join('\n  ');
}

// wireframe() / screens(): a flat list of primitives with token-key colours (see wireframe.ts)
type PaintPrim = Exclude<Prim, {k: 'text' | 'badge' | 'pill'}>;
function renderPrims(b: LaidOutWireframe | LaidOutScreens, day: Theme): string {
  const col = (k: ColorKey | null): string => k == null ? 'none' : colorOf(k, day);
  const stroke = (p: PaintPrim): string => {
    const dash = 'dash' in p ? p.dash : undefined; // circles have no dash
    return p.stroke ? ` stroke="${col(p.stroke)}" stroke-width="${p.sw}"${dash ? ` stroke-dasharray="${dash}"` : ''}` : '';
  };
  const fill = (p: PaintPrim): string => `fill="${col(p.fill)}"${p.op != null && p.fill ? ` fill-opacity="${p.op}"` : ''}`;
  const out: string[] = [];
  for (const p of b.prims) {
    if (p.k === 'rect') {
      const x0 = snap4(p.x), y0 = snap4(p.y), x1 = snap4(p.x + p.w), y1 = snap4(p.y + p.h);
      out.push(`<rect x="${x0}" y="${y0}" width="${Math.max(0, x1 - x0)}" height="${Math.max(0, y1 - y0)}"${p.r ? ` rx="${p.r}"` : ''} ${fill(p)}${stroke(p)}/>`);
    } else if (p.k === 'circle') {
      out.push(`<circle cx="${snap4(p.cx)}" cy="${snap4(p.cy)}" r="${p.r}" ${fill(p)}${stroke(p)}/>`);
    } else if (p.k === 'path') {
      out.push(`<path d="${p.d}" ${fill(p)}${stroke(p)}${p.stroke ? ' stroke-linejoin="round"' : ''}/>`);
    } else if (p.k === 'pill') {
      const x0 = snap4(p.x), y0 = snap4(p.y), x1 = snap4(p.x + p.w), y1 = snap4(p.y + p.h);
      out.push(pillSvg({x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0), fill: col(p.fill), stroke: p.stroke ? col(p.stroke) : null, cx: p.x + p.w / 2, baseline: p.base, text: col(p.text), size: p.size, labelHtml: emojiSpan(p.label)}));
    } else if (p.k === 'badge') {
      out.push(badgeSvg({cx: p.cx, cy: p.cy, r: p.r, w: p.w, shape: p.shape, label: p.label, aria: p.aria, size: p.size, fill: col(p.fill), stroke: PALETTE.bg, sw: 2, snap: snap4, esc: escapeXml}));
    } else if (p.k === 'text') {
      const a = p.anchor === 'middle' ? ' text-anchor="middle"' : p.anchor === 'end' ? ' text-anchor="end"' : '';
      out.push(`<text x="${Math.round(p.x)}" y="${Math.round(p.y)}"${a} font-size="${p.size}" font-weight="${p.weight}" fill="${col(p.fill)}">${emojiSpan(p.s)}</text>`);
    }
  }
  return out.join('\n  ');
}

function renderBandPlain(band: LaidOutBand, day: Theme, roles: Roles, stage?: number, dimFill = false): string {
  switch (band.type) {
    case 'caption': return renderCaption(band, day);
    case 'box': return renderBox(band, day, roles);
    case 'banner': return renderBanner(band, day, roles);
    case 'group': return renderGroup(band, day, roles);
    case 'legend': return renderLegend(band, day, roles);
    case 'swimlane': return renderSwimlane(band, day, roles);
    case 'wireframe': case 'screens': return renderPrims(band, day);
    case 'sequence': return renderSequence(band, day, roles);
    case 'table': return renderTable(band, day, roles);
    case 'row': return renderRow(band, day, roles, stage);
    case 'grid': return renderGrid(band, day, roles, stage);
    case 'raw': return renderRaw(band, day);
    case 'pyramid': return renderPyramid(band, roles);
    case 'curve': return renderCurve(band, day);
    case 'plane': return renderPlane(band, day, stage);
    case 'bars': return renderBars(band, day, stage, dimFill);
    case 'image': return renderImage(band, day, stage);
    case 'people': return renderPeople(band, day);
    case 'dots': return renderDots(band, day);
    case 'timeline': return renderTimeline(band, day);
    default: return '';
  }
}

// bands that draw their own dim state (spotlight) instead of having it painted over their svg
const SELF_DIMMING = new Set<LaidOutBand['type']>(['caption', 'box', 'banner', 'group', 'row', 'grid', 'bars', 'timeline', 'image']);

function renderBand(band: LaidOutBand, day: Theme, roles: Roles, stage?: number, dimFill = false): string {
  const svg = renderBandPlain(band, day, roles, stage, dimFill);
  if (!band.dim || SELF_DIMMING.has(band.type)) return svg;
  return svg
    .replace(/marker-(start|end)="url\(#dsl-arrow(-strong)?\)"/g, 'marker-$1="url(#dsl-arrow$2-dim)"')
    .replace(/stroke="#[0-9a-fA-F]{6}"/g, `stroke="${PALETTE.muted}"`)
    .replace(/fill="(#[0-9a-fA-F]{6})"/g, (_all, fill: string) => `fill="${fill === PALETTE.bg ? PALETTE.bg : PALETTE.muted}"`);
}

function usesArrows(laidOutDiagram: LaidOutDiagram): boolean {
  if (laidOutDiagram.connects.some(c => c.arrow !== 'none')) return true;
  if (laidOutDiagram.laidOut.some(b => b.type === 'legend' && b.items.some(i => i.line && (i.arrow ?? 'end') !== 'none'))) return true;
  if (laidOutDiagram.laidOut.some(b => b.type === 'sequence' && b.steps.some(x => (x.kind === 'msg' && x.arrow !== 'none') || x.kind === 'self'))) return true;
  return laidOutDiagram.laidOut.some(b => b.type === 'row' && b.arrows.length > 0);
}

// A band's own text runs, or (row/grid) its child boxes — which carry runs of their own.
function bandRuns(b: LaidOutBand): (WrappedRun | LaidOutBox)[] {
  if ('wrappedRuns' in b) return b.wrappedRuns;
  if ('children' in b) return b.children;
  return [];
}

export function emitSvg(laidOutDiagram: LaidOutDiagram, opts: {reveal?: number; noRecolor?: boolean} = {}): string {
  const {width, canvasHeight, day, laidOut, connects, roles} = laidOutDiagram;
  const usesMono = laidOut.some(b => bandRuns(b).some(x => (x as WrappedRun).mono || (('wrappedRuns' in x ? x.wrappedRuns : undefined) ?? []).some(r => r.mono)))
    || laidOut.some(b => b.type === 'table' && b.rows.some(r => r.cells.some(c => c.mono && c.lines.length)));
  const needsArrow = usesArrows(laidOutDiagram);
  const needsDimArrow = connects.some(c => c.dim && c.arrow !== 'none') || laidOut.some(b => b.dim && (
    b.type === 'row' && b.arrows.length > 0
    || b.type === 'legend' && b.items.some(i => i.line && (i.arrow ?? 'end') !== 'none')
    || b.type === 'sequence' && b.steps.some(x => x.kind === 'self' || x.kind === 'msg' && x.arrow !== 'none')
  ));

  // strong arrows have markers of their own (a fixed size, so a thick line does not scale its head)
  const strongArrow = (c: LaidOutConnect) => c.weight === 'strong' && c.arrow !== 'none';
  const strongItem = (i: LaidOutLegendItem) => i.weight === 'strong' && (i.arrow ?? 'end') !== 'none';
  const needsStrongArrow = connects.some(strongArrow) || laidOut.some(b => b.type === 'legend' && b.items.some(strongItem));
  const needsDimStrongArrow = connects.some(c => c.dim && strongArrow(c)) || laidOut.some(b => b.dim && b.type === 'legend' && b.items.some(strongItem));
  const strongMarker = (id: string, fill: string) => `
    <marker id="${id}" viewBox="0 0 10 10" refX="${STRONG_HEAD_REF_X}" refY="5" markerUnits="userSpaceOnUse" markerWidth="${STRONG_HEAD}" markerHeight="${STRONG_HEAD}" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="${fill}"/>
    </marker>`;

  const defs = needsArrow ? `
  <defs>
    <marker id="dsl-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="${PALETTE.text}"/>
    </marker>${needsDimArrow ? `
    <marker id="dsl-arrow-dim" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="${PALETTE.muted}"/>
    </marker>` : ''}${needsStrongArrow ? strongMarker('dsl-arrow-strong', PALETTE.text) : ''}${needsDimStrongArrow ? strongMarker('dsl-arrow-strong-dim', PALETTE.muted) : ''}
  </defs>` : '';

  const style = `
    text { font-family: ${FONT_STACKS.sans}; }${usesMono ? `
    .mono { font-family: ${FONT_STACKS.mono}; }` : ''}
    .emoji { font-family: ${FONT_STACKS.emoji}; }`;

  const dimFill = spotlightDim(laidOutDiagram) === 'fill';
  const body = laidOut.filter(band => visibleAt(band, opts.reveal)).map(band => renderBand(band, day, roles, opts.reveal, dimFill)).join('\n\n  ');
  const connectSvg = connects.filter(c => visibleAt(c, opts.reveal)).map(c => renderConnect(c, day, roles)).join('\n\n  ');

  // doc-medium diagrams carry an accessible name/description and (when built from a file) provenance
  let a11y = '', head = '';
  if (laidOutDiagram.medium === 'doc') {
    const title = diagramTitle(laidOutDiagram), desc = diagramDesc(laidOutDiagram, opts.reveal);
    if (title) {
      a11y = ` role="img" aria-labelledby="svg-title${desc ? ' svg-desc' : ''}"`;
      head = `\n  <title id="svg-title">${escapeXml(title)}</title>${desc ? `\n  <desc id="svg-desc">${escapeXml(desc)}</desc>` : ''}`;
    }
    if (laidOutDiagram.source) head += `\n  <metadata id="svg-diagram">${escapeXml(JSON.stringify(opts.reveal === undefined ? laidOutDiagram.source : {...laidOutDiagram.source, reveal: opts.reveal}))}</metadata>`;
  }

  // transparent: no page rectangle; the root says which page colour the checks assume (lint-svg reads it as the starting background)
  const bgRect = laidOutDiagram.transparent ? '' : `\n  <rect x="0" y="0" width="${width}" height="${canvasHeight}" fill="${PALETTE.bg}"/>`;
  const assumed = laidOutDiagram.transparent ? ` data-assumed-bg="${PALETTE.bg}"` : '';
  const palette = customColors(laidOutDiagram.appearance), paletteAttr = palette.length ? ` data-palette="${[...new Set(palette)].join(' ')}"` : '';
  const svgText = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${canvasHeight}" viewBox="0 0 ${width} ${canvasHeight}"${assumed}${a11y}>${head}${defs}
  <style>${style}
  </style>${bgRect}

  ${body}${connectSvg ? `\n\n  ${connectSvg}` : ''}
</svg>
`;
  // the attribute is added after the recolouring: its values are final colours (a custom white must not be recoloured as a light token)
  const out = opts.noRecolor ? svgText : recolor(svgText, laidOutDiagram.appearance);
  const darkAttr = mapOf(laidOutDiagram.appearance) ? ' data-appearance="dark"' : '';
  return paletteAttr || darkAttr ? out.replace('<svg ', `<svg${darkAttr}${paletteAttr} `) : out;
}

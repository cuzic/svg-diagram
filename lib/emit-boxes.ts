import {PALETTE, CONNECT_LABEL_SIZE, STRONG_STROKE, TAG_SIZE, colorOf, textColorOf, toneStyle, isSolidTone, runColorOf} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import {badgeSvg, pillSvg} from './badge.ts';
import type {LaidOutGroup, LaidOutLegend, LaidOutRow, LaidOutGrid, LaidOutRaw, LaidOutStatus, LaidOutConnect, RawColorTone} from './types/containers.ts';
import type {Theme, EmphasisTone, Align, Rect, Roles} from './types/core.ts';
import type {LaidOutPyramid, LaidOutCurve} from './types/figures.ts';
import type {LaidOutPeople, LaidOutDots} from './types/people-dots.ts';
import type {LaidOutSwimlane} from './types/sequence-table-swimlane.ts';
import type {LaidOutBox, LaidOutCaption, LaidOutBanner} from './types/text-bands.ts';
import {iconSvg} from './icon-svg.ts';
import {ICON_INDENT, STEP_INDENT, TOP_ICON_SIZE, BOX_PAD_X, BOX_PAD_Y, ICON_SIZE, STEP_BADGE_R, STEP_BADGE_BASELINE_OFFSET, LEGEND_SWATCH_W} from './layout-util.ts';
import {visibleAt} from './reveal.ts';
import {PERSON_BOX, PERSON_PATH} from './people.ts';
import {arrowPath, snap4, escapeXml, escapeAttr, emojiSpan, resolveLineColor, renderTextRuns, lineAttrs, arrowMarkers, trimEnds, trimPoints, textLines, rrPath, resolveBoxStyle} from './emit-common.ts';
import {ftaLegendSwatch} from './emit-fta.ts';

import {must} from './must.ts';
// Numbered circle badge for box({step}) — solid accent fill, white number,
// centered on the title's own baseline (same offset every hand-authored
// "① foo" box in this deck used between the badge and its number glyph).
// On a solid box the badge / tag pill has the box's own fill, so a white ring keeps it apart from the box.
export const ringed = (band: LaidOutBox): boolean => !band.dim && isSolidTone(band.tone);


export function renderStepBadge(band: LaidOutBox, day: Theme): string {
  const titleRun = must(band.wrappedRuns[0]);
  // the same padding the text and the icon use (a swimlane step has its own)
  const px = band.padX ?? BOX_PAD_X, titleBaselineY = band.y + (band.padY ?? BOX_PAD_Y) + must(titleRun.lineYs[0]);
  // a centred / right-aligned title: the badge goes just before its first line (titleW, from layout); else at the left edge, after a left icon
  const indent = titleRun.indent ?? 0, left = band.x + px + indent, right = band.x + band.w - px;
  const align = band.align ?? (band.iconAt === 'top' ? 'center' : 'left');
  const textX = band.titleW === undefined || align === 'left' ? undefined : align === 'center' ? (left + right) / 2 - band.titleW / 2 : right - band.titleW;
  const cx = textX !== undefined ? textX - STEP_INDENT + STEP_BADGE_R : band.x + px + STEP_BADGE_R + (band.icon && band.iconAt !== 'top' ? ICON_INDENT : 0);
  const cy = titleBaselineY - STEP_BADGE_BASELINE_OFFSET;
  return badgeSvg({cx, cy, r: STEP_BADGE_R, w: 2 * STEP_BADGE_R, shape: 'circle', label: String(band.step), aria: `手順 ${band.step}`, size: 16, fill: PALETTE[day].accent, ...(ringed(band) ? {stroke: PALETTE.bg} : {}), baseline: titleBaselineY, snap: snap4, esc: escapeXml});
}


// box({icon}): the icon's path scaled from its source viewBox to ICON_SIZE, at the box's top-left. Its colour is a text tone
// (a dimmed box: muted). With a title the label carries the meaning, so the icon is hidden from assistive technology.
export function renderBoxIcon(band: LaidOutBox, day: Theme, tones: ToneEnv): string {
  const top = band.iconAt === 'top', size = top ? band.iconSize ?? TOP_ICON_SIZE : ICON_SIZE;
  const x = top ? band.x + band.w / 2 - size / 2 : band.x + (band.padX ?? BOX_PAD_X), y = band.y + (band.padY ?? BOX_PAD_Y);
  const color = band.dim ? PALETTE.muted : runColorOf(tones, band.iconTone, band.tone, day);
  return '\n  ' + iconSvg({glyph: must(band.iconGlyph), name: must(band.icon), x, y, size, color, dim: band.dim, labelled: !!band.title});
}


export function renderCaption(band: LaidOutCaption, day: Theme, tones: ToneEnv): string {
  return renderTextRuns(band.wrappedRuns, {originX: band.x, originY: band.y, w: band.w, align: band.align ?? 'center', day, tones, dim: band.dim});
}


export type BoxLike = Rect & {tone?: EmphasisTone; dashed?: boolean; dim?: boolean; /** ADR 0034: written as `data-node` on the frame */ dataNode?: string};

export function renderBoxRect(band: BoxLike, day: Theme, tones: ToneEnv, defaultTone: EmphasisTone): string {
  const style = resolveBoxStyle(tones, band.tone ?? defaultTone, day, band.dashed);
  if (band.dim) { style.fill = PALETTE.bg; style.stroke = PALETTE.muted; }
  const dash = style.dashed ? ' stroke-dasharray="6,4"' : band.dim ? ' stroke-dasharray="2,5" stroke-linecap="round"' : '';
  // the right edge snaps like the left one (not the width alone), so a frame ends where a neighbouring band of the same extent ends
  const rx = snap4(band.x), ry = snap4(band.y), rw = snap4(band.x + band.w) - rx, rh = snap4(band.h);
  return `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="8" fill="${style.fill}" stroke="${style.stroke}" stroke-width="2.5"${dash}${band.dataNode ? ` data-node="${escapeAttr(band.dataNode)}"` : ''}/>`;
}


export function renderBoxText(band: LaidOutBox | LaidOutBanner, day: Theme, tones: ToneEnv, defaultAlign: Align): string {
  const align = band.align ?? defaultAlign;
  const px = band.padX ?? BOX_PAD_X, py = band.padY ?? BOX_PAD_Y;
  const originX = band.x + px;
  return renderTextRuns(band.wrappedRuns, {originX, originY: band.y + py, w: band.w - 2 * px, align, day, tones, dim: band.dim, boxTone: band.tone});
}


export function renderTag(band: LaidOutBox, day: Theme, tones: ToneEnv, roles: Roles): string {
  const t = band.tagBox as Rect; // caller checked tagBox
  const fill = band.dim ? PALETTE.muted : colorOf(toneStyle(tones, band.tagTone === 'danger' || band.tagTone === 'muted' ? band.tagTone : 'accent').ink, day);
  return pillSvg({x: snap4(t.x), y: snap4(t.y), w: snap4(t.w), h: t.h, fill, cx: t.x + t.w / 2, baseline: t.y + 17, text: PALETTE.bg, ...(ringed(band) ? {stroke: PALETTE.bg} : {}), size: (roles.tag ?? TAG_SIZE), labelHtml: emojiSpan(band.tag as string)});
}


// The stamp chip: bottom-right inside the shape (layout reserved the strip; rows may have stretched the shape since, so it follows the bottom edge).
export function renderStamp(band: Rect & {stamp?: string; stampW?: number}, roles: Roles): string {
  if (!band.stamp || band.stampW === undefined) return '';
  const x = snap4(band.x + band.w - 8 - band.stampW), y = snap4(band.y + band.h - 6 - 24);
  return `\n  <rect x="${x}" y="${y}" width="${snap4(band.stampW)}" height="24" rx="4" fill="${PALETTE.bg}" stroke="${PALETTE.border}" stroke-width="1"/>\n  <text x="${snap4(band.x + band.w - 8 - band.stampW / 2)}" y="${y + 17}" font-size="${roles.note}" text-anchor="middle" fill="${PALETTE.muted}">${emojiSpan(band.stamp)}</text>`;
}


export function renderBox(band: LaidOutBox, day: Theme, tones: ToneEnv, roles: Roles): string {
  const badge = band.step != null ? `\n  ${renderStepBadge(band, day)}` : '';
  const iconText = band.icon ? renderBoxIcon(band, day, tones) : '';
  const tag = band.tagBox ? `\n  ${renderTag(band, day, tones, roles)}` : '';
  const frame = band.frame === false ? '' : `${renderBoxRect(band, day, tones, 'plain')}\n  `;
  return `${frame}${renderBoxText(band, day, tones, band.iconAt === 'top' ? 'center' : 'left')}${badge}${iconText}${tag}${renderStamp(band, roles)}`;
}


export function renderGroup(band: LaidOutGroup, day: Theme, tones: ToneEnv, roles: Roles): string {
  if (band.frame === false) return renderStamp(band, roles);
  return renderBoxRect(band, day, tones, 'muted') + renderStamp(band, roles);
}


// A line sample (and optional arrowhead) + label per item, laid out by layout.ts.
export function renderLegend(band: LaidOutLegend, day: Theme, tones: ToneEnv, roles: Roles): string {
  const parts: string[] = [];
  for (const it of band.items) {
    const cy = it.y + 12;
    if (it.ftaEvent || it.ftaGate) parts.push(ftaLegendSwatch(it, cy));
    else if (it.swatch || it.mark) { // a cause-tree entity (its role's box) or the core driver mark (a thick frame)
      const style = resolveBoxStyle(tones, it.swatch?.tone ?? 'plain', day, it.swatch?.dashed), x = it.x + 4, y = cy - 8;
      if (it.swatch?.hex) {
        const pts = ([[x + 6, y], [x + 22, y], [x + 28, cy], [x + 22, y + 16], [x + 6, y + 16], [x, cy]] satisfies [number, number][]).map(([px, py]) => `${snap4(px)},${snap4(py)}`).join(' ');
        parts.push(`<polygon points="${pts}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="2"${style.dashed ? ' stroke-dasharray="6,4"' : ''} stroke-linejoin="round"/>`);
      } else {
        parts.push(`<rect x="${snap4(x)}" y="${snap4(y)}" width="28" height="16" rx="4" fill="${style.fill}" stroke="${style.stroke}" stroke-width="${it.mark ? 3.5 : 2.5}"${style.dashed ? ' stroke-dasharray="6,4"' : ''}/>`);
        if (it.swatch?.double) parts.push(`<rect x="${snap4(x + 3)}" y="${snap4(y + 3)}" width="22" height="10" rx="2" fill="${style.fill}" stroke="${style.stroke}" stroke-width="1.5"/>`);
      }
    } else if (it.edge === 'and') { // two arrows joined by an arc across them
      for (const dy of [-5, 5]) parts.push(arrowPath([{x: it.x, y: cy + dy}, {x: it.x + LEGEND_SWATCH_W, y: cy + dy}], PALETTE.text, undefined));
      parts.push(`<path d="M${snap4(it.x + 14)},${cy - 5} Q${snap4(it.x + 20)},${cy} ${snap4(it.x + 14)},${cy + 5}" fill="none" stroke="${PALETTE.text}" stroke-width="2"/>`);
    } else if (it.edge === 'back') { // a declared return: one bold arrow
      parts.push(arrowPath([{x: it.x, y: cy}, {x: it.x + LEGEND_SWATCH_W, y: cy}], PALETTE.text, undefined, 3));
    } else if (it.edge === 'blocks') { // a cutting arrow: dashed, ending in a bar
      parts.push(arrowPath([{x: it.x, y: cy}, {x: it.x + LEGEND_SWATCH_W, y: cy}], PALETTE.text, 'dashed', 2, 'end', 'bar'));
    } else if (it.line) {
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
      const style = resolveBoxStyle(tones, it.tone ?? 'plain', day, it.dashed);
      parts.push(`<rect x="${snap4(it.x + 4)}" y="${snap4(cy - 8)}" width="28" height="16" rx="4" fill="${style.fill}" stroke="${style.stroke}" stroke-width="2.5"${style.dashed ? ' stroke-dasharray="6,4"' : ''}/>`);
    }
    parts.push(`<text x="${Math.round(it.x + LEGEND_SWATCH_W + 8)}" y="${cy + 5}" font-size="${roles.note}" fill="${PALETTE.text}">${emojiSpan(it.label)}</text>`);
  }
  return parts.join('\n  ');
}


export function renderBanner(band: LaidOutBanner, day: Theme, tones: ToneEnv, roles: Roles): string {
  return `${renderBoxRect(band, day, tones, 'accent')}\n  ${renderBoxText(band, day, tones, 'center')}${renderStamp(band, roles)}`;
}


export function renderRow(band: LaidOutRow, day: Theme, tones: ToneEnv, roles: Roles, stage?: number): string {
  const boxes = band.children.filter(c => visibleAt(c, stage)).map(c => renderBox(c, day, tones, roles)).join('\n\n  ');
  const arrows = band.arrows.filter((_, i) => visibleAt(must(band.children[i]), stage) && visibleAt(must(band.children[i + 1]), stage)).map(a =>
    `<path d="M${snap4(a.x1)},${Math.round(a.y1)} L${snap4(a.x2)},${Math.round(a.y2)}" fill="none" stroke="${band.dim ? PALETTE.muted : PALETTE.text}" stroke-width="2.5" marker-end="url(#${band.dim ? 'dsl-arrow-dim' : 'dsl-arrow'})"/>`,
  ).join('\n  ');
  return arrows ? `${boxes}\n\n  ${arrows}` : boxes;
}


export function renderGrid(band: LaidOutGrid, day: Theme, tones: ToneEnv, roles: Roles, stage?: number): string {
  return band.children.filter(c => visibleAt(c, stage)).map(c => renderBox(c, day, tones, roles)).join('\n\n  ');
}


export function renderConnectPath(c: LaidOutConnect): string {
  const points = c.weight === 'strong' ? trimPoints(c.points, c.arrow) : c.points;
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${Math.round(p.x)},${Math.round(p.y)}`).join(' ');
}


export function renderConnect(c: LaidOutConnect, day: Theme, tones: ToneEnv, roles: Roles): string {
  const color = c.dim ? PALETTE.muted : resolveLineColor(tones, c.tone, day);
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


export function renderPyramid(band: LaidOutPyramid, roles: Roles): string {
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
export function renderPeople(band: LaidOutPeople, day: Theme, tones: ToneEnv): string {
  const d = PERSON_PATH, s = band.size / PERSON_BOX.size, n = (v: number) => +v.toFixed(4);
  const color = colorOf(toneStyle(tones, band.tone).ink, day), color2 = colorOf(toneStyle(tones, band.tone2).ink, day), rest = colorOf(toneStyle(tones, band.rest).ink, day);
  const icon = (i: {x: number; y: number; on: boolean; second?: true}) => `<path d="${d}" transform="translate(${n(i.x - PERSON_BOX.from * s)} ${n(i.y - PERSON_BOX.from * s)}) scale(${n(s)})" ${i.on ? `fill="${i.second ? color2 : color}"` : `fill="none" stroke="${rest}" stroke-width="${n(1.5 / s)}"`}/>`;
  const texts = band.texts.map(t => `\n  <text x="${Math.round(t.x)}" y="${Math.round(t.y)}" font-size="${t.size}"${t.bold ? ' font-weight="700"' : ''} fill="${textColorOf(tones, t.tone, day)}">${emojiSpan(t.text)}</text>`).join('');
  return `<g role="img" aria-label="${escapeAttr(band.alt)}">\n  ${band.icons.map(icon).join('\n  ')}\n  </g>${texts}`;
}


// dots(): a lane (an axis line), bars on the lane for its zones, a dot per value piled above it, labels under it.
export function renderDots(band: LaidOutDots, day: Theme, tones: ToneEnv): string {
  const color = (tone: string) => colorOf(toneStyle(tones, tone).ink, day), n = (v: number) => +v.toFixed(2);
  const parts = [`<line x1="${n(band.axis.x1)}" y1="${n(band.axis.y)}" x2="${n(band.axis.x2)}" y2="${n(band.axis.y)}" stroke="${PALETTE.muted}" stroke-width="2"/>`];
  for (const z of band.zones) parts.push(`<rect x="${n(z.x)}" y="${n(z.top)}" width="${n(z.w)}" height="${n(z.y - 4 - z.top)}" fill="${color(z.tone)}" fill-opacity="0.12"/>`);
  for (const z of band.zones) parts.push(`<rect x="${n(z.x)}" y="${n(z.y - 4)}" width="${n(z.w)}" height="8" fill="${color(z.tone)}"/>`);
  const dots = band.dots.map(p => `<circle cx="${n(p.x)}" cy="${n(p.y)}" r="${band.r}" fill="${color(p.tone)}"/>`).join('\n    ');
  parts.push(`<g role="img" aria-label="${escapeAttr(band.alt)}">\n    ${dots}\n  </g>`);
  for (const t of band.texts) parts.push(`<text x="${n(t.x)}" y="${n(t.y)}" text-anchor="${t.anchor}" font-size="${t.size}" fill="${PALETTE.text}">${emojiSpan(t.text)}</text>`);
  return parts.join('\n  ');
}


export function renderCurve(band: LaidOutCurve, day: Theme, tones: ToneEnv): string {
  const parts: string[] = [];
  parts.push(`<path d="M${Math.round(band.axisX)},${Math.round(band.axisTop)} L${Math.round(band.axisX)},${Math.round(band.axisBottom)} L${Math.round(band.axisRight)},${Math.round(band.axisBottom)}" fill="none" stroke="${PALETTE.text}" stroke-width="2"/>`);
  parts.push(`<path d="${band.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${Math.round(p.x)},${Math.round(p.y)}`).join(' ')}" fill="none" stroke="${PALETTE.text}" stroke-width="3"/>`);

  const emphColor = (emphasis: string) => colorOf(toneStyle(tones, emphasis === 'accent' || emphasis === 'danger' ? emphasis : 'muted').ink, day);
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


/**
 * The status badge (diagram({status})): one accessible unit, a dashed outline (not colour alone says "draft"), bold text. Colours are
 * tokens, so appearance: 'dark' recolours it like everything else; `danger` is not used (it means "an example not to follow").
 */
export function renderStatus(band: LaidOutStatus): string {
  const p = band.pill;
  const pill = pillSvg({x: snap4(p.x), y: snap4(p.y), w: snap4(p.w), h: p.h, fill: PALETTE.bg, stroke: PALETTE.muted, sw: 1.5, dash: '4 3', cx: p.x + p.w / 2, baseline: band.textY, text: PALETTE.text, size: band.size, labelHtml: emojiSpan(band.text)});
  return `<g role="img" aria-label="${escapeAttr(band.text)}" data-status="${band.status}">\n  ${pill}\n  </g>`;
}

export function renderRaw(band: LaidOutRaw, day: Theme): string {
  const ctx = {
    x: band.x, y: band.y, w: band.w, h: band.h, day,
    color: (tone: RawColorTone): string => tone === 'accent' ? PALETTE[day].accent
      : tone === 'accent-soft' ? PALETTE[day].soft
      : PALETTE[tone] ?? PALETTE.text, // unknown tones fall back to text at runtime
  };
  return band.draw(ctx);
}



export function renderSwimlane(b: LaidOutSwimlane, day: Theme, roles: Roles): string {
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


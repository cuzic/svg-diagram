import type {SvgBandDefs} from './emit-svg-core.ts';
import {PALETTE, STRONG_STROKE, colorOf, textColorOf, toneStyle} from './tokens.ts';
import {marked, partAttr, partStep, partsOn} from './parts.ts';
import type {ToneEnv} from './tokens.ts';
import {pillSvg} from './badge.ts';
import type {LaidOutLegend, LaidOutRaw, LaidOutStatus, RawColorTone} from './types/containers.ts';
import type {Theme, Roles} from './types/core.ts';
import type {LaidOutPyramid, LaidOutCurve} from './types/figures.ts';
import type {LaidOutPeople, LaidOutDots} from './types/people-dots.ts';
import type {LaidOutSwimlane} from './types/sequence-table-swimlane.ts';
import {boundaryChipH, LEGEND_SWATCH_W} from './layout-util.ts';
import {PERSON_BOX, PERSON_PATH} from './people.ts';
import {arrowPath, snap4, escapeXml, escapeAttr, emojiSpan, lineAttrs, arrowMarkers, trimEnds, textLines, rrPath, resolveBoxStyle} from './emit-common.ts';
import {ftaLegendSwatch} from './emit-fta-symbols.ts';

export {captionTextPlacement, renderCaption} from './emit-caption.ts';
export {renderBanner} from './emit-banner.ts';
export {renderGroup} from './emit-group.ts';
export {ringed, stepBadgeAt, renderStepBadge, renderBoxIcon, tagGeometry, renderTag, renderBox} from './emit-box.ts';
export {frameGeometry, renderBoxRect, stampGeometry, renderStamp} from './emit-box-frame.ts';
export type {BoxLike} from './emit-box-frame.ts';
export {boxTextPlacement} from './emit-box-text.ts';
export {textSvgDefs, childTextSvgDefs} from './emit-box-defs.ts';
export {rowSvgDefs, renderRow} from './emit-row.ts';
export {renderGrid} from './emit-grid.ts';


// A line sample (and optional arrowhead) + label per item, laid out by layout.ts.
export function legendSvgDefs(band: LaidOutLegend): SvgBandDefs {
  const arrow = band.items.some(item => item.line && (item.arrow ?? 'end') !== 'none');
  const strongArrow = band.items.some(item => item.weight === 'strong' && (item.arrow ?? 'end') !== 'none');
  return {arrow, strongArrow};
}

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
  const pill = pillSvg({x: snap4(p.x), y: snap4(p.y), w: snap4(p.w), h: p.h, fill: PALETTE.bg, stroke: PALETTE.muted, sw: 1.5, dash: '4 3', cx: p.x + p.w / 2, baseline: band.textY, rawY: p.y, text: PALETTE.text, size: band.size, labelHtml: emojiSpan(band.text)});
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
  // ADR 0054: a lane (its label cell, body, border and name) and a phase (its divider and name) are parts
  const on = partsOn(b), all: string[] = [];
  let mark = '';
  const parts = {push: (...xs: string[]) => all.push(...xs.map(x => marked(x, mark)))};
  const R = 8, n = b.lanes.length, hasPh = b.phaseH > 0;
  const X1 = b.x + b.w;
  if (hasPh) {
    parts.push(`<path d="${rrPath(b.bodyX, b.y, X1 - b.bodyX, b.phaseH, {tr: R})}" fill="${PALETTE[day].soft}"/>`);
    parts.push(`<path d="${rrPath(b.x, b.y, b.labelW, b.phaseH, {tl: R})}" fill="${PALETTE.code}"/>`);
    for (const [i, ph] of b.phases.entries()) {
      mark = partAttr(on, partStep('phase', i, ph.lines.join('')));
      parts.push(`<path d="M${Math.round(ph.x)},${Math.round(b.y)} V${Math.round(b.y + b.phaseH)}" stroke="${PALETTE.border}" stroke-width="2"/>`);
      parts.push(textLines(ph.lines, {x: ph.x + ph.w / 2, top: b.y + 8, size: roles.note, weight: 700, anchor: 'middle', fill: PALETTE[day].accent}));
    }
  }
  b.lanes.forEach((ln, i) => {
    mark = partAttr(on, partStep('lane', i, ln.labelLines.join('')));
    const first = i === 0 && !hasPh, last = i === n - 1;
    const bodyFill = i % 2 === 0 ? PALETTE.bg : PALETTE.code;
    const labelFill = ln.tone === 'accent' ? PALETTE[day].soft : PALETTE.code;
    parts.push(`<path d="${rrPath(b.x, ln.y, b.labelW, ln.h, {tl: first ? R : 0, bl: last ? R : 0})}" fill="${labelFill}"/>`);
    parts.push(`<path d="${rrPath(b.bodyX, ln.y, X1 - b.bodyX, ln.h, {tr: first ? R : 0, br: last ? R : 0})}" fill="${bodyFill}"/>`);
    if (i > 0 || hasPh) parts.push(`<path d="M${Math.round(b.x)},${Math.round(ln.y)} H${Math.round(X1)}" stroke="${PALETTE.border}" stroke-width="2"/>`);
    parts.push(textLines(ln.labelLines, {x: b.x + b.labelW / 2, top: ln.labelTop, size: roles.title, weight: 700, anchor: 'middle', fill: ln.tone === 'accent' ? PALETTE[day].accent : PALETTE.text}));
  });
  mark = '';
  parts.push(`<path d="M${Math.round(b.bodyX)},${Math.round(b.y)} V${Math.round(b.y + b.h)}" stroke="${PALETTE.text}" stroke-width="2"/>`);
  for (const bd of b.boundaries ?? []) { // a heavy dashed line over the lane border; its name sits in a chip on the label column
    const y = Math.round(bd.y);
    parts.push(`<path d="M${Math.round(b.x)},${y} H${Math.round(X1)}" stroke="${PALETTE.text}" stroke-width="3" stroke-dasharray="10,6"/>`);
    if (bd.label) {
      const h = boundaryChipH(roles.note), w = b.labelW - 16;
      parts.push(`<rect x="${Math.round(b.x + 8)}" y="${Math.round(y - h / 2)}" width="${w}" height="${h}" rx="${h / 2}" fill="${PALETTE.bg}" stroke="${PALETTE.text}" stroke-width="1.5"/>`);
      parts.push(textLines([bd.label], {x: b.x + b.labelW / 2, top: y - h / 2 + 3, size: roles.note, weight: 700, anchor: 'middle', fill: PALETTE.text}));
    }
  }
  parts.push(`<path d="${rrPath(b.x, b.y, b.w, b.h, {tl: R, tr: R, bl: R, br: R})}" fill="none" stroke="${PALETTE.text}" stroke-width="2.5"/>`);
  return all.join('\n  ');
}

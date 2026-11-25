
import {PALETTE} from './tokens.ts';
import {marked, partAttr, partStep, partsOn} from './parts.ts';
import type {Theme, Roles} from './types/core.ts';
import type {LaidOutSwimlane} from './types/sequence-table-swimlane.ts';
import {boundaryChipH} from './layout-util.ts';
import {textLines, rrPath} from './emit-common.ts';

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

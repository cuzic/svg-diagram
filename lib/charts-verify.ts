// What verify checks on a chart band, the same for every chart: each label inside the figure and off every other label, off every bar /
// cell / node that is not its own, off the lines it must not be crossed by; nothing that is solid overlaps another solid; and a label
// drawn in the page colour on a fill (a value inside a bar, a number in a dark cell) is readable on it.
import {segHitsRect} from './bars.ts';
import {overlaps} from './charts-base.ts';
import {PALETTE, colorOf, luminance, paintOf} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import type {LaidOutChart} from './charts.ts';
import type {LaidOutDiagram} from './types/index.ts';

const CONTRAST = 70; // the threshold verify.ts and lint-svg.ts use
const hexOf = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (base: string, over: string, a: number): string => {
  const [b, o] = [hexOf(base), hexOf(over)];
  return `#${b.map((v, i) => Math.round(v * (1 - a) + o[i] * a).toString(16).padStart(2, '0')).join('')}`;
};

export function checkChart(band: LaidOutChart, d: LaidOutDiagram, tones: ToneEnv): string[] {
  const problems: string[] = [];
  const paint = paintOf(tones, d.appearance);
  const who = `${band.kind}${band.id ? ` "${band.id}"` : ''}`;
  for (const [i, b] of band.boxes.entries()) {
    if (b.x < band.x - 0.5 || b.x + b.w > band.x + band.w + 0.5 || b.y < band.y - 0.5 || b.y + b.h > band.y + band.h + 0.5) problems.push(`${who}: label "${b.label}" runs outside the figure (raise width / height, or shorten it)`);
    for (let j = i + 1; j < band.boxes.length; j++) {
      const o = band.boxes[j];
      if (overlaps(b, o)) problems.push(`${who}: label "${b.label}" overlaps label "${o.label}"`);
    }
    band.solids.forEach((s, k) => {
      if (k === b.host) { if (b.x < s.x - 0.5 || b.x + b.w > s.x + s.w + 0.5 || b.y < s.y - 0.5 || b.y + b.h > s.y + s.h + 0.5) problems.push(`${who}: label "${b.label}" runs out of its ${s.label}`); }
      else if (overlaps(b, s)) problems.push(`${who}: label "${b.label}" overlaps ${s.label}`);
    });
    if (!b.plate && band.segs.some(sg => segHitsRect(sg, {x: b.x - 1, y: b.y, w: b.w + 2, h: b.h}))) problems.push(`${who}: a line runs through the label "${b.label}"`);
    if (b.on && !band.dim && !(b.of !== undefined && band.dimIds?.includes(b.of))) {
      const bg = b.on.op === undefined ? paint(colorOf(b.on.fill, d.day)) : mix(paint(PALETTE.bg), paint(colorOf(b.on.fill, d.day)), b.on.op);
      const fg = paint(colorOf(b.on.ink ?? 'bg', d.day)), delta = Math.abs(luminance(fg) - luminance(bg));
      if (delta < CONTRAST) problems.push(`${who}: label "${b.label}" (${fg} on ${bg}) has low contrast (delta=${delta.toFixed(0)}, want >= ${CONTRAST})`);
    }
  }
  for (const [i, s] of band.solids.entries()) for (let j = i + 1; j < band.solids.length; j++) if (overlaps(s, band.solids[j])) problems.push(`${who}: ${s.label} overlaps ${band.solids[j].label}`);
  return problems;
}

export function checkCharts(d: LaidOutDiagram, tones: ToneEnv): string[] {
  return d.laidOut.flatMap(band => band.type === 'chart' ? checkChart(band, d, tones) : []);
}

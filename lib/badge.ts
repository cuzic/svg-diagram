// Badge: a short label (a number, a letter) drawn inside a shape, as ONE primitive.
//
// Every numbered / lettered mark in the tool (callouts, note numbers, robot markers, route points,
// box({step})) used to be a hand-assembled circle + text, with the workarounds repeated at each site
// (an invisible "container" rect so the lint does not read the number as covered, a fixed radius, a
// hard-coded label colour, a +4 nudge for triangles). Here they live in one place:
//  - the shape grows to fit the label (a 1-char label keeps the base radius, longer ones widen it);
//  - the label colour is picked from the fill so the contrast is >= 4.5:1;
//  - the vertical centring is decided per shape;
//  - the SVG is a <g role="img" aria-label data-badge>: one accessible unit, and the lint treats the
//    group as the label's own container.
import {PALETTE, wcagRatio} from './tokens.ts';
import type {ColorKey} from './types/core.ts';

export type BadgeShape = 'circle' | 'square' | 'triangle';
export interface BadgeBox {x: number; y: number; w: number; h: number}

export const BADGE_R = 11;       // base radius: fits 1-2 digits or one letter at the wireframe's 14px
const BADGE_PAD = 6;             // room each side of a label wider than the base shape

/** Width/height of a badge for a label of measured width `textW`; `r` is the base radius. */
export function badgeBox(cx: number, cy: number, textW: number, r = BADGE_R, shape: BadgeShape = 'circle'): BadgeBox {
  const reach = shape === 'triangle' ? r + 3 : r;
  const w = Math.max(2 * reach, textW + 2 * BADGE_PAD);
  return {x: cx - w / 2, y: cy - r - (shape === 'triangle' ? 3 : 0), w, h: 2 * r + (shape === 'triangle' ? 3 : 0)};
}

/** Label colour for a fill (resolved #rrggbb): white-ish `bg` or `text`, whichever contrasts more. */
export function badgeTextKey(fillHex: string): 'bg' | 'text' {
  return wcagRatio(PALETTE.bg, fillHex) >= wcagRatio(PALETTE.text, fillHex) ? 'bg' : 'text';
}

export interface BadgeSvgOpts {
  cx: number; cy: number; shape: BadgeShape; r: number; w: number;
  label: string; aria: string; size: number; weight?: number;
  /** Resolved colours (#rrggbb). `text` is picked from `fill` when omitted. */
  fill: string; stroke?: string | null; sw?: number; text?: string;
  /** Explicit text baseline (box({step}) sits on its title's baseline); else centred on cy. */
  baseline?: number;
  snap: (n: number) => number; esc: (s: string) => string;
}

export function badgeSvg(o: BadgeSvgOpts): string {
  const {cx, cy, r, w, snap} = o;
  const st = o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw ?? 2}"` : '';
  let shape: string;
  if (o.shape === 'square') {
    shape = `<rect x="${snap(cx - w / 2)}" y="${snap(cy - r)}" width="${snap(cx + w / 2) - snap(cx - w / 2)}" height="${snap(cy + r) - snap(cy - r)}" rx="3" fill="${o.fill}"${st}/>`;
  } else if (o.shape === 'triangle') {
    const hw = w / 2, p = (x: number, y: number) => `${Math.round(x)},${Math.round(y)}`;
    shape = `<path d="M${p(cx, cy - r - 3)} L${p(cx + hw, cy + r)} L${p(cx - hw, cy + r)} Z" fill="${o.fill}"${st} stroke-linejoin="round"/>`;
  } else if (w > 2 * r) { // a wide label: the circle becomes a pill
    shape = `<rect x="${snap(cx - w / 2)}" y="${snap(cy - r)}" width="${snap(cx + w / 2) - snap(cx - w / 2)}" height="${snap(cy + r) - snap(cy - r)}" rx="${r}" fill="${o.fill}"${st}/>`;
  } else {
    shape = `<circle cx="${snap(cx)}" cy="${snap(cy)}" r="${r}" fill="${o.fill}"${st}/>`;
  }
  // centred on the shape as drawn (snapped), not on the unsnapped centre: the text must not slide out of a shape that moved up to 2px
  const cyDrawn = o.shape === 'circle' && w <= 2 * r ? snap(cy) : (snap(cy - r) + snap(cy + r)) / 2;
  const base = o.baseline ?? cyDrawn + o.size * 0.36 + (o.shape === 'triangle' ? 4 : 0);
  const fill = o.text ?? PALETTE[badgeTextKey(o.fill)];
  const text = o.label === '' ? '' : `\n  <text x="${Math.round(cx)}" y="${Math.round(base)}" text-anchor="middle" font-size="${o.size}" font-weight="${o.weight ?? 700}" fill="${fill}">${o.esc(o.label)}</text>`;
  return `<g role="img" aria-label="${o.esc(o.aria).replace(/"/g, '&quot;')}" data-badge="">\n  ${shape}${text}\n  </g>`;
}

// ---- pill: a rounded label that holds TEXT (a tag on a box, a chip in a wireframe, the label on a connector) -------------
// The badge's sibling: a badge is a short mark (a number) in a shape, a pill is a word in a stadium. Both are one primitive here,
// so the pill's geometry (corner radius = half the height, text centred) and its text-on-fill look are written once.
export interface PillSvgOpts {
  /** The pill's rect, already snapped by the caller (each drawing context snaps its own way). */
  x: number; y: number; w: number; h: number;
  fill: string; stroke?: string | null; sw?: number;
  /** stroke-dasharray of the outline (the status badge's dashed frame); none by default. */
  dash?: string;
  /** Text: its centre x, baseline, colour, size / weight, and the markup (already escaped / emoji-spanned). */
  cx: number; baseline: number; text: string; size: number; weight?: number; labelHtml: string;
  /** The pill's y before the caller snapped it. The baseline was worked out against that y, so it moves with the snapped rect: the text keeps its place in the pill. */
  rawY?: number;
}

export function pillSvg(o: PillSvgOpts): string {
  const st = o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw ?? 2}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}` : '';
  return `<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="${o.h / 2}" fill="${o.fill}"${st}/>\n  <text x="${Math.round(o.cx)}" y="${Math.round(o.baseline + (o.rawY === undefined ? 0 : o.y - o.rawY))}" text-anchor="middle" font-size="${o.size}"${(o.weight ?? 700) === 400 ? '' : ` font-weight="${o.weight ?? 700}"`} fill="${o.text}">${o.labelHtml}</text>`;
}

export type { ColorKey };

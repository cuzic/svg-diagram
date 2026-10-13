import {PALETTE, EMOJI_RE, STRONG_TRIM, colorOf, textColorOf, toneStyle, runColorOf} from './tokens.ts';
import type {Point, WrappedRun, Theme, EmphasisTone, LineStyle, Arrow, Align, Span} from './types.ts';

import {must} from './must.ts';
export const EMOJI_G = new RegExp(EMOJI_RE.source, 'gu');


export function snap4(n: number): number {
  return Math.round(n / 4) * 4;
}


export const XML_ESC: Record<string, string> = {'&': '&amp;', '<': '&lt;', '>': '&gt;'};

export function escapeXml(s: string): string {
  return s.replace(/[&<>]/g, (c: string) => XML_ESC[c]);
}


// Wraps emoji codepoints in <tspan class="emoji">, using the SAME EMOJI_RE
// lint-svg.ts checks against — generated text can never trip that check.
export function emojiSpan(text: string): string {
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


export const resolveLineColor = textColorOf;


// One line made of bold / coloured pieces: what has the line's own look stays plain text of the <text>, every other piece is a
// <tspan>. No whitespace goes between the tags (it would be drawn); an emoji inside a piece nests in it, so it keeps the piece's weight.
// A dimmed box keeps the bold but loses the colours (its text is all muted).
export function spanTspans(spans: Span[], run: WrappedRun, color: string, day: Theme, dim?: boolean): string {
  return spans.map(sp => {
    const fill = !dim && sp.tone ? resolveTextColor(sp.tone, day) : color;
    const attrs = `${sp.bold && run.weight !== 700 ? ' font-weight="700"' : ''}${fill !== color ? ` fill="${fill}"` : ''}`;
    return attrs ? `<tspan${attrs}>${emojiSpan(sp.text)}</tspan>` : emojiSpan(sp.text);
  }).join('');
}


export function renderTextRuns(
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
      const y = originY + must(run.lineYs[i]);
      const content = run.lineSpans ? spanTspans(run.lineSpans[i], run, color, day, dim) : emojiSpan(line);
      parts.push(`<text x="${lx}" y="${y}"${anchor}${cls} font-size="${run.size}" font-weight="${run.weight}" fill="${color}">${content}</text>`);
    });
  }
  return parts.join('\n  ');
}


export function lineAttrs(line: LineStyle | undefined): string {
  return line === 'dashed' ? ' stroke-dasharray="6,4"' : line === 'dotted' ? ' stroke-dasharray="2,5" stroke-linecap="round"' : '';
}


export function arrowMarkers(arrow: Arrow | undefined, dim = false, strong = false): string {
  const id = `dsl-arrow${strong ? '-strong' : ''}${dim ? '-dim' : ''}`;
  return `${arrow === 'start' || arrow === 'both' ? ` marker-start="url(#${id})"` : ''}${arrow === 'end' || arrow === 'both' ? ` marker-end="url(#${id})"` : ''}`;
}


// A strong line stops STRONG_TRIM short of the end(s) that carry an arrowhead, so the head's tip lands on the box edge.
export function trimEnds(a: number, b: number, arrow: Arrow | undefined): [number, number] {
  const dir = Math.sign(b - a), len = Math.abs(b - a);
  if (len < STRONG_TRIM * 3) return [a, b];
  return [arrow === 'start' || arrow === 'both' ? a + dir * STRONG_TRIM : a, arrow === 'end' || arrow === 'both' ? b - dir * STRONG_TRIM : b];
}


export function trimPoints(points: Point[], arrow: Arrow): Point[] {
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


// An arrow whose head is a shape, not a marker (a marker on a leftward end is not turned by every renderer). The line stops inside the head.
export function arrowPath(points: {x: number; y: number}[], color: string, line: LineStyle | undefined, width = 2, headAt: 'end' | 'both' = 'end'): string {
  const pts = points.map(p => ({...p}));
  const heads: string[] = [];
  const head = (tip: {x: number; y: number}, from: {x: number; y: number}): {x: number; y: number} => {
    const dx = Math.sign(tip.x - from.x), dy = Math.sign(tip.y - from.y), L = 12, W = 5, tx = snap4(tip.x), ty = snap4(tip.y); // the head hangs off the snapped tip, so it is symmetric about its line
    heads.push(`<path d="M${tx},${ty} L${tx - dx * L - dy * W},${ty - dy * L + dx * W} L${tx - dx * L + dy * W},${ty - dy * L - dx * W} z" fill="${color}"/>`);
    return {x: tip.x - dx * (L - 2), y: tip.y - dy * (L - 2)};
  };
  const n = pts.length;
  pts[n - 1] = head(points[n - 1], points[n - 2]);
  if (headAt === 'both') pts[0] = head(points[0], points[1]);
  return `<path d="M${pts.map(p => `${snap4(p.x)},${snap4(p.y)}`).join(' L')}" fill="none" stroke="${color}" stroke-width="${width}"${lineAttrs(line === 'solid' ? undefined : line)}/>\n  ${heads.join('\n  ')}`;
}


// ---- sequence() / table() renderers (geometry comes from seq-table.ts) ------
export const LH_EM = 1.4;


export function strokeLine(d: string, color: string, line: LineStyle | undefined, arrow: Arrow | undefined, width = 2): string {
  if (line === 'double') {
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="6"/>\n  <path d="${d}" fill="none" stroke="${PALETTE.bg}" stroke-width="2"${arrowMarkers(arrow)}/>`;
  }
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}"${lineAttrs(line)}${arrowMarkers(arrow)}/>`;
}


export function textLines(
  lines: string[],
  {x, top, size, weight = 400, anchor = 'start', fill, mono = false}: {x: number; top: number; size: number; weight?: number; anchor?: 'start' | 'middle' | 'end'; fill: string; mono?: boolean},
): string {
  const a = anchor === 'middle' ? ' text-anchor="middle"' : anchor === 'end' ? ' text-anchor="end"' : '';
  const cls = mono ? ' class="mono"' : '';
  return lines.map((l, k) =>
    `<text x="${Math.round(x)}" y="${Math.round(top + size + k * size * LH_EM)}"${a}${cls} font-size="${size}" font-weight="${weight}" fill="${fill}">${emojiSpan(l)}</text>`).join('\n  ');
}


// Rounded rectangle path; `r` per corner so table sections can round only the outer corners.
export function rrPath(x: number, y: number, w: number, h: number, {tl = 0, tr = 0, br = 0, bl = 0}: {tl?: number; tr?: number; br?: number; bl?: number} = {}): string {
  const X = Math.round(x), Y = Math.round(y), W = Math.round(w), H = Math.round(h);
  return `M${X + tl},${Y} H${X + W - tr} ${tr ? `A${tr},${tr} 0 0 1 ${X + W},${Y + tr}` : ''} V${Y + H - br} ${br ? `A${br},${br} 0 0 1 ${X + W - br},${Y + H}` : ''} H${X + bl} ${bl ? `A${bl},${bl} 0 0 1 ${X},${Y + H - bl}` : ''} V${Y + tl} ${tl ? `A${tl},${tl} 0 0 1 ${X + tl},${Y}` : ''} Z`;
}


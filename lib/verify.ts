// Pre-render structural verification of a layoutDiagram() result — runs
// BEFORE emitSvg(), using only the geometry/colors layout.ts already
// computed. Catches sibling/neighbor overlap, canvas-bounds overflow, and
// low-contrast tone combinations without spinning up a Chromium render pass
// at all.
//
// This exists because a real bug found during Phase 2 development (a
// connect() loop-under return path silently overlapping the following
// banner) was only caught by lint-svg.ts's post-render heuristic check —
// but the layout engine already had every number needed to catch it
// instantly, it just wasn't asked to. Text-overflowing-its-own-box is NOT
// checked here because it's structurally impossible for box()/banner()/
// caption() content: a band's height is *derived from* its own wrapped
// text, not guessed independently of it (see layout.ts's
// layoutBoxContent) — there is no code path that can produce a box shorter
// than its own content.
//
// What this can't see: the actual drawn contents of raw() (only its
// self-reported x/y/w/h is checked against neighbors, not what's actually
// inside), and real browser font-rendering quirks (inter-atom kerning we
// assumed was ~0 for CJK, subpixel rounding). lint-svg.ts's Playwright-
// based render check stays as the final safety net for exactly those two
// gaps — verify() is the fast, primary check; lint is the backstop.

import {PALETTE, colorOf, luminance, runColorOf} from './tokens.ts';
import {resolveTextColor, resolveBoxStyle} from './emit.ts';
import {lintDiagram, walkBands} from './rules.ts';
import {spotlightDim} from './spotlight.ts';
import type {EmphasisTone, CheckRect, LaidOutBanner, LaidOutBox, LaidOutCaption, LaidOutDiagram, Rect, Verdict} from './types.ts';

const CONTRAST_THRESHOLD = 70; // same threshold lint-svg.ts's own contrast check uses

// Returns the overlap {dx,dy} if two rects share more than `tolerance`px of
// area in both axes, else null. Rects that merely touch at a shared edge
// (adjacent row children, a box and the row's own bounding rect) are not
// overlaps.
function rectOverlap(a: Rect, b: Rect, tolerance = 0.5): {dx: number; dy: number} | null {
  const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (ox <= tolerance || oy <= tolerance) return null;
  return {dx: ox, dy: oy};
}

function labelOf(band: object): string {
  // bands name themselves differently (box title, banner headline, caption text, or just an id)
  const b = band as {title?: string; headline?: string; id?: string; text?: string};
  return b.title ?? b.headline ?? b.id ?? b.text ?? '(band)';
}

// Every checkable rect: standalone box/banner, row/grid children, raw()'s
// self-reported bounds. Captions are skipped (no background, and their
// width is already wrap-constrained so there's nothing new to check).
function collectRects(d: LaidOutDiagram): CheckRect[] {
  const rects: CheckRect[] = [];
  for (const band of d.laidOut) {
    if (band.type === 'screens') { // check each screen frame, not the bounding box that holds them all
      for (const a of band.anchors) rects.push({id: a.id, label: a.id, x: a.x, y: a.y, w: a.w, h: a.h});
    } else if (band.type === 'bars') {
      for (const [i, b] of band.bars.entries()) rects.push({id: b.id ?? null, label: b.id ?? `bar ${i + 1}`, x: b.x, y: b.y, w: b.w, h: b.h});
    } else if (band.type === 'caption' && band.inkBox) { // a group's title text: connectors must not run through it
      rects.push({id: null, label: `group title "${band.text}"`, ...band.inkBox});
    } else if (band.type === 'row' || band.type === 'grid') {
      for (const c of band.children) rects.push({id: c.id ?? null, label: labelOf(c), x: c.x, y: c.y, w: c.w, h: c.h});
    } else if (band.type === 'box' || band.type === 'banner' || band.type === 'raw' || band.type === 'legend' || band.type === 'sequence' || band.type === 'table' || band.type === 'wireframe' || band.type === 'pyramid' || band.type === 'curve' || band.type === 'plane' || band.type === 'timeline') {
      rects.push({id: ('id' in band ? band.id : undefined) ?? null, label: labelOf(band), x: band.x, y: band.y, w: band.w, h: band.h});
    }
  }
  return rects;
}

function checkTimelines(d: LaidOutDiagram): string[] {
  const problems: string[] = [];
  for (const band of d.laidOut) {
    if (band.type !== 'timeline') continue;
    const line = band.fullLine && {x: band.fullLine.x - 1, y: band.fullLine.y1, w: 2, h: band.fullLine.y2 - band.fullLine.y1};
    for (const [i, b] of band.labelBoxes.entries()) {
      if (line && rectOverlap(b, line)) problems.push(`timeline: label "${b.label}" is crossed by the deadline line (move the mark or change the axis range)`);
      if (b.x < band.x - 0.5 || b.x + b.w > band.x + band.w + 0.5) problems.push(`timeline: label "${b.label}" runs outside the figure (shorten it or widen the figure)`);
      for (let j = i + 1; j < band.labelBoxes.length; j++) {
        const o = rectOverlap(b, band.labelBoxes[j]);
        if (o) problems.push(`timeline: label "${b.label}" overlaps label "${band.labelBoxes[j].label}" by ${Math.round(o.dx)}x${Math.round(o.dy)}px`);
      }
    }
  }
  return problems;
}

function checkBars(d: LaidOutDiagram): string[] {
  const problems: string[] = [];
  for (const band of d.laidOut) {
    if (band.type !== 'bars') continue;
    for (const b of band.labelBoxes) {
      if (b.x < band.x - 0.5 || b.x + b.w > band.x + band.w + 0.5 || b.y < band.y - 0.5 || b.y + b.h > band.y + band.h + 0.5) problems.push(`bars: value label "${b.label}" runs outside the figure (raise width / height or shorten the unit)`);
    }
    for (let i = 0; i < band.labelBoxes.length; i++) for (let j = i + 1; j < band.labelBoxes.length; j++) {
      const o = rectOverlap(band.labelBoxes[i], band.labelBoxes[j]);
      if (o) problems.push(`bars: value label "${band.labelBoxes[i].label}" overlaps value label "${band.labelBoxes[j].label}" by ${Math.round(o.dx)}x${Math.round(o.dy)}px`);
    }
  }
  return problems;
}

function checkNoWrap(d: LaidOutDiagram): string[] {
  const problems: string[] = [];
  const check = (b: LaidOutBox) => { for (const value of b.nowrapOverflow ?? []) problems.push(`stat: value "${value}" does not fit its box without wrapping (widen the box or use size: 'stat')`); };
  for (const band of d.laidOut) {
    if (band.type === 'box') check(band);
    else if (band.type === 'row' || band.type === 'grid') for (const child of band.children) check(child);
  }
  return problems;
}

// plane(): every label it placed must stay inside the figure and clear of the other labels.
function checkPlanes(d: LaidOutDiagram): string[] {
  const problems: string[] = [];
  for (const band of d.laidOut) {
    if (band.type !== 'plane') continue;
    const boxes = band.labelBoxes, fig = band.bounds;
    for (const b of boxes) {
      if (b.x < fig.x - 0.5 || b.x + b.w > fig.x + fig.w + 0.5 || b.y < fig.y - 0.5 || b.y + b.h > fig.y + fig.h + 0.5) problems.push(`plane: label "${b.label}" runs outside the figure (move its point, change labelAt / side, or enlarge the figure)`);
    }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const o = rectOverlap(boxes[i], boxes[j]);
      if (o) problems.push(`plane: label "${boxes[i].label}" overlaps label "${boxes[j].label}" by ${Math.round(o.dx)}x${Math.round(o.dy)}px (change labelAt / side)`);
    }
    (band.paths ?? []).forEach((pa, i) => {
      if (pa.overshoot > 1.5) problems.push(`plane: path ${i + 1} leaves the axes by ${Math.round(pa.overshoot)}px (a curve through these points swings outside the plot; use smooth: false, add points, or widen the axis range)`);
    });
    // a label must not sit on the plane's ink either: an axis or its arrowhead, a tick mark, a point, a guide or a dimension line
    for (const b of boxes) {
      const hit = new Map<string, {dx: number; dy: number}>();
      for (const ob of band.obstacles) {
        if (ob.dim !== undefined && ob.dim === b.dim) continue; // a dimension's own label sits on its own line
        const o = rectOverlap(b, ob);
        if (o && !hit.has(ob.what)) hit.set(ob.what, o);
      }
      for (const [what, o] of hit) problems.push(`plane: label "${b.label}" overlaps ${what} by ${Math.round(o.dx)}x${Math.round(o.dy)}px (move the label: labelAt / side / offset / anchor)`);
    }
  }
  return problems;
}

function checkOverlaps(rects: CheckRect[]): string[] {
  const problems: string[] = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const o = rectOverlap(rects[i], rects[j]);
      if (o) problems.push(`"${rects[i].label}" overlaps "${rects[j].label}" by ${Math.round(o.dx)}x${Math.round(o.dy)}px`);
    }
  }
  return problems;
}

// A connect()'s path/label are allowed to touch or start from their own
// endpoint boxes (that's the whole point) — only flag collision with
// anything ELSE.
function checkConnects(d: LaidOutDiagram, rects: CheckRect[]): string[] {
  const problems: string[] = [];
  for (const c of d.connects) {
    const within = (r: CheckRect, a?: Rect) => !!a && Math.min(r.x + r.w, a.x + a.w) - Math.max(r.x, a.x) > 0.5 && Math.min(r.y + r.h, a.y + a.h) - Math.max(r.y, a.y) > 0.5;
    // an end that is a row / a column of a row (row({id})) owns the boxes in it (a box spanning several columns belongs to each of them)
    const isOwnEndpoint = (r: CheckRect) => (r.id !== null && (r.id === c.fromId || r.id === c.toId)) || within(r, c.fromArea) || within(r, c.toArea);
    for (const r of rects) {
      if (isOwnEndpoint(r)) {
        // The path starts on its own boxes, but the label/chip must not sit on top of their text:
        // a chip wider than the gap between two boxes lands on both bodies.
        const own = c.labelBox && rectOverlap(c.labelBox, r);
        if (own) problems.push(`connect(${c.fromLabel} -> ${c.toLabel}) label "${c.label}" overlaps its own end "${r.label}" by ${Math.round(own.dx)}x${Math.round(own.dy)}px (widen the gap between the boxes, shorten the label, or label a longer leg with route: 'elbow')`);
        continue;
      }
      for (const seg of c.pathSegments) {
        const pathHit = rectOverlap(seg, r);
        if (pathHit) problems.push(`connect(${c.fromLabel} -> ${c.toLabel}) path overlaps "${r.label}" by ${Math.round(pathHit.dx)}x${Math.round(pathHit.dy)}px`);
      }
      if (c.labelBox) {
        const labelHit = rectOverlap(c.labelBox, r);
        if (labelHit) problems.push(`connect(${c.fromLabel} -> ${c.toLabel}) label "${c.label}" overlaps "${r.label}" by ${Math.round(labelHit.dx)}x${Math.round(labelHit.dy)}px`);
      }
    }
  }
  return problems;
}

function checkBounds(d: LaidOutDiagram, rects: CheckRect[]): string[] {
  const problems: string[] = [];
  const eps = 0.5;
  for (const r of rects) {
    if (r.x < -eps || r.y < -eps || r.x + r.w > d.width + eps || r.y + r.h > d.canvasHeight + eps) {
      problems.push(`"${r.label}" at (${Math.round(r.x)},${Math.round(r.y)}) ${Math.round(r.w)}x${Math.round(r.h)} exceeds the ${d.width}x${d.canvasHeight} canvas`);
    }
  }
  return problems;
}

// Contrast is computed purely from the known, closed set of (tone, day)
// color combinations the DSL can ever produce — no rendering needed, this
// is the same formula lint-svg.ts uses, evaluated on values we already know.
function checkContrast(d: LaidOutDiagram): string[] {
  const problems: string[] = [];
  const contrastFor = (band: LaidOutBox | LaidOutBanner | LaidOutCaption, boxTone: EmphasisTone | null): string[] => {
    const boxFill = band.dim ? PALETTE.bg : boxTone ? resolveBoxStyle(boxTone, d.day).fill : PALETTE.bg;
    const found: string[] = [];
    for (const run of band.wrappedRuns ?? []) {
      const fg = band.dim ? PALETTE.muted : runColorOf(run.tone, boxTone ?? undefined, d.day); // dim first: a dimmed solid box is white
      const delta = Math.abs(luminance(fg) - luminance(boxFill));
      if (delta < CONTRAST_THRESHOLD) {
        found.push(`"${run.text.slice(0, 20)}" (${fg} on ${boxFill}, in "${labelOf(band)}") has low contrast (delta=${delta.toFixed(0)}, want >= ${CONTRAST_THRESHOLD})`);
      }
      // a coloured piece of the run is its own text colour on the same fill (a dimmed box paints every piece muted: the run's check covers it)
      if (!band.dim) for (const sp of run.spans ?? []) {
        if (!sp.tone) continue;
        const spanFg = resolveTextColor(sp.tone, d.day), spanDelta = Math.abs(luminance(spanFg) - luminance(boxFill));
        if (spanDelta < CONTRAST_THRESHOLD) found.push(`"${sp.text.slice(0, 20)}" (${spanFg} on ${boxFill}, in "${labelOf(band)}") has low contrast (delta=${spanDelta.toFixed(0)}, want >= ${CONTRAST_THRESHOLD})`);
      }
    }
    return found;
  };
  for (const band of d.laidOut) {
    if (band.type === 'box') problems.push(...contrastFor(band, band.tone ?? 'plain'));
    else if (band.type === 'banner') problems.push(...contrastFor(band, band.tone ?? 'accent'));
    else if (band.type === 'caption') problems.push(...contrastFor(band, null));
    else if (band.type === 'row' || band.type === 'grid') for (const c of band.children) problems.push(...contrastFor(c, c.tone ?? 'plain'));
    else if (band.type === 'bars') for (const b of band.labelBoxes) {
      if (!b.background) continue;
      const dim = b.bar !== undefined && band.bars[b.bar].dim; // a dimmed bar draws its label muted on bg (on the pale fill when spotlight dim is 'fill')
      const fg = dim ? PALETTE.muted : colorOf('bg', d.day), bg = dim ? (spotlightDim(d) === 'fill' ? PALETTE.border : PALETTE.bg) : colorOf(b.background, d.day);
      const delta = Math.abs(luminance(fg) - luminance(bg));
      if (delta < CONTRAST_THRESHOLD) problems.push(`bars: value label "${b.label}" (${fg} on ${bg}) has low contrast (delta=${delta.toFixed(0)}, want >= ${CONTRAST_THRESHOLD})`);
    }
  }
  return problems;
}

// verifyDiagram(laidOutDiagram) -> {ok, problems: string[], warnings: string[]}
// `problems` fail the build; `warnings` (text volume, and the rules of rules.ts) never do.
export function verifyDiagram(d: LaidOutDiagram): Verdict {
  const rects = collectRects(d);
  const problems = [
    ...checkOverlaps(rects),
    ...checkConnects(d, rects),
    ...checkPlanes(d),
    ...checkBars(d),
    ...checkTimelines(d),
    ...checkNoWrap(d),
    ...checkBounds(d, rects),
    ...checkContrast(d),
  ];
  // Rule findings (WCAG contrast, legend, lane order, crossings, density ...). Doc-medium diagrams
  // get the full set; legacy slide diagrams keep their existing text-volume warning only.
  const findings = d.medium === 'doc' ? lintDiagram(d) : lintDiagram(d).filter(f => f.rule === 'density');
  const warnings = [...(d.revealWarnings ?? []), ...findings.filter(f => f.severity === 'warn').map(f => `[${f.rule}] ${f.message}`)];
  if (d.spotlight && walkBands(d.bands).some(b => b.type === 'box' && b.tone === 'muted')) warnings.push('[spotlight-muted] spotlight と muted トーンの箱を併用しているため、dim との違いを形でも確認する');
  return {ok: problems.length === 0, problems, warnings, findings};
}

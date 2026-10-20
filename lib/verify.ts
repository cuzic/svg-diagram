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

import {toneEnv} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import {DARK_NOTE, mergeSides} from './appearance-auto.ts';
import {acceptHint, lintDiagram, walkBands} from './rules.ts';
import {CHECK_PHASES, collectRects, contrastProblems, runCheckPhase, type VerifyOut} from './verify-handlers.ts';
import {labelOf, neverTogether, rectOverlap} from './verify-base.ts';
import type {LaidOutConnect} from './types/containers.ts';
import type {Rect} from './types/core.ts';
import type {LaidOutDiagram} from './types/index.ts';
import type {LaidOutCaption} from './types/text-bands.ts';
import type {CheckRect, Verdict} from './types/verdicts.ts';

import {must} from './must.ts';
function checkOverlaps(rects: CheckRect[]): string[] {
  const problems: string[] = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = must(rects[i]), b = must(rects[j]);
      if (a.holds?.some(h => h.startsWith('@intentional-overlap:') && b.holds?.includes(h))) continue;
      if ((a.life || b.life) && neverTogether(a.life ?? {}, b.life ?? {})) continue;
      const o = rectOverlap(a, b);
      if (o) problems.push(`"${a.label}" overlaps "${b.label}" by ${Math.round(o.dx)}x${Math.round(o.dy)}px`);
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
    const who = connectName(c);
    const within = (r: CheckRect, a?: Rect) => !!a && Math.min(r.x + r.w, a.x + a.w) - Math.max(r.x, a.x) > 0.5 && Math.min(r.y + r.h, a.y + a.h) - Math.max(r.y, a.y) > 0.5;
    // an end that is a row / a column of a row (row({id})) owns the boxes in it (a box spanning several columns belongs to each of them)
    const isOwnEndpoint = (r: CheckRect) => (r.id !== null && (r.id === c.fromId || r.id === c.toId)) || !!r.holds?.some(h => h === c.fromId || h === c.toId) || within(r, c.fromArea) || within(r, c.toArea);
    for (const r of rects) {
      if (isOwnEndpoint(r)) {
        // The path starts on its own boxes, but the label/chip must not sit on top of their text:
        // a chip wider than the gap between two boxes lands on both bodies.
        const own = c.labelBox && rectOverlap(c.labelBox, r);
        if (own) problems.push(`${who} label "${c.label}" overlaps its own end "${r.label}" by ${Math.round(own.dx)}x${Math.round(own.dy)}px (widen the gap between the boxes, shorten the label, or label a longer leg with route: 'elbow')`);
        continue;
      }
      for (const seg of c.pathSegments) {
        const pathHit = rectOverlap(seg, r);
        if (pathHit) problems.push(`${who} path overlaps "${r.label}" by ${Math.round(pathHit.dx)}x${Math.round(pathHit.dy)}px${c.route === 'loop-under' ? '' : " (a line back to an earlier box, or past a box in a row of steps / chevrons: route: 'loop-under' runs it under the boxes)"}`);
      }
      if (c.labelBox) {
        const labelHit = rectOverlap(c.labelBox, r);
        if (labelHit) problems.push(`${who} label "${c.label}" overlaps "${r.label}" by ${Math.round(labelHit.dx)}x${Math.round(labelHit.dy)}px`);
      }
    }
  }
  return problems;
}

const connectName = (c: LaidOutConnect): string =>
  c.annot?.kind === 'callout' ? `callout(${c.toLabel})` : c.annot?.kind === 'bracket' ? `bracket(${c.fromLabel}, ${c.toLabel})` : `connect(${c.fromLabel} -> ${c.toLabel})`;

// bracket() / callout() reserve no room above, left or right of their boxes (only 'below' pushes what follows down), so their line
// and label can leave the canvas or land on a caption, which the other checks do not cover (captions are not obstacles for connect()).
function checkAnnotations(d: LaidOutDiagram): string[] {
  const problems: string[] = [];
  const captions = d.laidOut.filter((b): b is LaidOutCaption => b.type === 'caption' && !b.inkBox);
  for (const c of d.connects) {
    if (!c.annot) continue;
    const who = connectName(c);
    const parts: [string, Rect][] = [...c.pathSegments.map((r): [string, Rect] => ['line', r]), ...(c.labelBox ? [[`label "${c.label}"`, c.labelBox] as [string, Rect]] : [])];
    const fix = c.annot.kind === 'callout' ? "put the bubble on another side, or leave room with spacer()" : "use side: 'below', or leave room with spacer()";
    for (const [what, r] of parts) {
      if (r.x < -0.5 || r.y < -0.5 || r.x + r.w > d.width + 0.5 || r.y + r.h > d.canvasHeight + 0.5) problems.push(`${who} ${what} runs outside the ${d.width}x${d.canvasHeight} canvas (${fix})`);
      for (const cap of captions) {
        const o = rectOverlap(r, cap);
        if (o) problems.push(`${who} ${what} overlaps the caption "${labelOf(cap)}" by ${Math.round(o.dx)}x${Math.round(o.dy)}px (${fix})`);
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

// verifyDiagram(laidOutDiagram) -> {ok, problems: string[], warnings: string[]}
// `problems` fail the build; `warnings` (text volume, and the rules of rules.ts) never do.
export function verifyDiagram(d: LaidOutDiagram): Verdict {
  if (d.appearance === 'auto') { // ADR 0023 D4: the figure is drawn light, and the dark scheme shows the same geometry in the dark colours: check both
    const tones = toneEnv(d.tones), side = (appearance: 'light' | 'dark') => verifyWith({...d, appearance}, tones);
    const light = side('light'), dark = side('dark');
    const note = (s: string) => `${s} (${DARK_NOTE})`;
    const problems = mergeSides(light.problems, dark.problems, s => s, note);
    return {ok: problems.length === 0, problems, warnings: mergeSides(light.warnings, dark.warnings, s => s, note), findings: mergeSides(light.findings, dark.findings, f => `${f.rule}\0${f.message}`, f => ({...f, message: note(f.message)}))};
  }
  return verifyWith(d, toneEnv(d.tones));
}
function verifyWith(d: LaidOutDiagram, tones: ToneEnv): Verdict {
  const rects = collectRects(d);
  const figure: VerifyOut = {problems: [], warnings: []};
  for (const phase of CHECK_PHASES) runCheckPhase(d, tones, phase, figure); // per band type: see verify-handlers.ts
  const causeWarnings = figure.warnings;
  const problems = [
    ...checkOverlaps(rects.filter(r => !r.backdrop)),
    ...checkConnects(d, rects.filter(r => !r.backdrop)),
    ...checkAnnotations(d),
    ...figure.problems,
    ...checkBounds(d, rects),
    ...contrastProblems(d, tones),
  ];
  // Rule findings (WCAG contrast, legend, lane order, crossings, density ...). Doc-medium diagrams
  // get the full set; legacy slide diagrams keep their existing text-volume warning only.
  const findings = d.medium === 'doc' ? lintDiagram(d) : lintDiagram(d).filter(f => f.rule === 'density' || f.rule === 'auto-fit-applied' || f.rule === 'density-compact-restored');
  const warnings = [...(d.revealWarnings ?? []), ...causeWarnings, ...findings.filter(f => f.severity === 'warn').map(f => { const h = acceptHint(f.rule); return `[${f.rule}] ${f.message}${h ? `  → ${h}` : ''}`; })];
  if (d.spotlight && !(typeof d.spotlight === 'object' && d.spotlight.mutedOk) && walkBands(d.bands).some(b => b.type === 'box' && b.tone === 'muted')) warnings.push('[spotlight-muted] spotlight と muted トーンの箱を併用しているため、dim との違いを形でも確認する');
  return {ok: problems.length === 0, problems, warnings, findings};
}

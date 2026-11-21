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
import {acceptHint, lintDiagram, mergeFindingSides, walkBands} from './rules.ts';
import {sourceOf} from './source-ref.ts';
import type {SourceRef} from './source-ref.ts';
import {CHECK_PHASES, collectRects, contrastProblems, runCheckPhase} from './verify-handlers.ts';
import {issueAt, labelOf, neverTogether, rectOverlap} from './verify-base.ts';
import type {LaidOutConnect} from './types/containers.ts';
import type {Rect} from './types/core.ts';
import type {LaidOutDiagram} from './types/index.ts';
import type {LaidOutCaption} from './types/text-bands.ts';
import type {CheckRect, Issue, Verdict} from './types/verdicts.ts';

import {must} from './must.ts';
import {ceil4, connectRoom} from './connect-rules.ts';
function checkOverlaps(rects: CheckRect[]): Issue[] {
  const issues: Issue[] = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = must(rects[i]), b = must(rects[j]);
      if (a.holds?.some(h => h.startsWith('@intentional-overlap:') && b.holds?.includes(h))) continue;
      if ((a.life || b.life) && neverTogether(a.life ?? {}, b.life ?? {})) continue;
      const o = rectOverlap(a, b);
      if (o) issues.push(issueAt(`"${a.label}" overlaps "${b.label}" by ${Math.round(o.dx)}x${Math.round(o.dy)}px`, a.loc, b.loc));
    }
  }
  return issues;
}

// A connect()'s path/label are allowed to touch or start from their own
// endpoint boxes (that's the whole point) — only flag collision with
// anything ELSE.
function checkConnects(d: LaidOutDiagram, rects: CheckRect[]): Issue[] {
  const issues: Issue[] = [];
  for (const c of d.connects) {
    const who = connectName(c);
    const loc = sourceOf(c);
    const within = (r: CheckRect, a?: Rect) => !!a && Math.min(r.x + r.w, a.x + a.w) - Math.max(r.x, a.x) > 0.5 && Math.min(r.y + r.h, a.y + a.h) - Math.max(r.y, a.y) > 0.5;
    // an end that is a row / a column of a row (row({id})) owns the boxes in it (a box spanning several columns belongs to each of them)
    const isOwnEndpoint = (r: CheckRect) => (r.id !== null && (r.id === c.fromId || r.id === c.toId)) || !!r.holds?.some(h => h === c.fromId || h === c.toId) || within(r, c.fromArea) || within(r, c.toArea) || within(r, c.fromVia) || within(r, c.toVia); // the boxes in a frame an end stops on (connect({via})) too
    for (const r of rects) {
      if (isOwnEndpoint(r)) {
        // The path starts on its own boxes, but the label/chip must not sit on top of their text:
        // a chip wider than the gap between two boxes lands on both bodies.
        const own = c.labelBox && rectOverlap(c.labelBox, r);
        if (own) issues.push(issueAt(`${who} label "${c.label}" overlaps its own end "${r.label}" by ${Math.round(own.dx)}x${Math.round(own.dy)}px (${widenHint(c)}, shorten the label, or label a longer leg with route: 'elbow')`, loc, r.loc));
        continue;
      }
      for (const seg of c.pathSegments) {
        const pathHit = rectOverlap(seg, r);
        if (pathHit) issues.push(issueAt(`${who} path overlaps "${r.label}" by ${Math.round(pathHit.dx)}x${Math.round(pathHit.dy)}px${c.route === 'loop-under' || c.route === 'loop-side' ? '' : " (a line back to an earlier box, or past a box in a row of steps / chevrons: route: 'loop-under' runs it under the boxes; between two anchors on the same left / right side of a column, route: 'loop-side' runs it outside)"}`, loc, r.loc));
      }
      if (c.labelBox) {
        const labelHit = rectOverlap(c.labelBox, r);
        if (labelHit) issues.push(issueAt(`${who} label "${c.label}" overlaps "${r.label}" by ${Math.round(labelHit.dx)}x${Math.round(labelHit.dy)}px`, loc, r.loc));
      }
    }
  }
  return issues;
}

/** "widen the gap between the boxes", with the room the label needs on a straight connect (labelRoom(), ADR 0069 D1). */
const widenHint = (c: LaidOutConnect): string => { const need = connectRoom(c); return need !== undefined && Number.isFinite(need) ? `widen the gap between the boxes to ${ceil4(need)}px or more` : 'widen the gap between the boxes'; };

const connectName = (c: LaidOutConnect): string =>
  c.annot?.kind === 'callout' ? `callout(${c.toLabel})` : c.annot?.kind === 'bracket' ? `bracket(${c.fromLabel}, ${c.toLabel})` : `connect(${c.fromLabel} -> ${c.toLabel})`;

// bracket() / callout() reserve no room above, left or right of their boxes (only 'below' pushes what follows down), so their line
// and label can leave the canvas or land on a caption, which the other checks do not cover (captions are not obstacles for connect()).
function checkAnnotations(d: LaidOutDiagram): Issue[] {
  const issues: Issue[] = [];
  const captions = d.laidOut.filter((b): b is LaidOutCaption => b.type === 'caption' && !b.inkBox);
  for (const c of d.connects) {
    if (!c.annot) continue;
    const who = connectName(c);
    const loc = sourceOf(c);
    const parts: [string, Rect][] = [...c.pathSegments.map((r): [string, Rect] => ['line', r]), ...(c.labelBox ? [[`label "${c.label}"`, c.labelBox] as [string, Rect]] : [])];
    const fix = c.annot.kind === 'callout' ? "put the bubble on another side, or leave room with spacer()" : "use side: 'below', or leave room with spacer()";
    for (const [what, r] of parts) {
      if (r.x < -0.5 || r.y < -0.5 || r.x + r.w > d.width + 0.5 || r.y + r.h > d.canvasHeight + 0.5) issues.push(issueAt(`${who} ${what} runs outside the ${d.width}x${d.canvasHeight} canvas (${fix})`, loc));
      for (const cap of captions) {
        const o = rectOverlap(r, cap);
        if (o) issues.push(issueAt(`${who} ${what} overlaps the caption "${labelOf(cap)}" by ${Math.round(o.dx)}x${Math.round(o.dy)}px (${fix})`, loc, sourceOf(cap)));
      }
    }
  }
  return issues;
}

// A 'loop-side' line runs out past the boxes' side, into the margin; boxes that fill the canvas width leave none, and the line is cut off.
function checkLoopSide(d: LaidOutDiagram): Issue[] {
  const issues: Issue[] = [];
  for (const c of d.connects) {
    if (c.route !== 'loop-side') continue;
    const loc = sourceOf(c);
    const out = (r: Rect) => r.x < -0.5 || r.y < -0.5 || r.x + r.w > d.width + 0.5 || r.y + r.h > d.canvasHeight + 0.5;
    if (c.pathSegments.some(out)) issues.push(issueAt(`${connectName(c)} runs outside the ${d.width}x${d.canvasHeight} canvas: the boxes leave no room beside them for route: 'loop-side' (narrow them: row([box({id, width: 700})], {justify: 'center'}) per step, or give dip a smaller value)`, loc));
    else if (c.labelBox && out(c.labelBox)) issues.push(issueAt(`${connectName(c)} label "${c.label}" runs outside the ${d.width}x${d.canvasHeight} canvas: leave more room beside the boxes, or use chip: true (the label then sits on the line)`, loc));
  }
  return issues;
}

function checkBounds(d: LaidOutDiagram, rects: CheckRect[]): Issue[] {
  const issues: Issue[] = [];
  const eps = 0.5;
  for (const r of rects) {
    if (r.x < -eps || r.y < -eps || r.x + r.w > d.width + eps || r.y + r.h > d.canvasHeight + eps) {
      issues.push(issueAt(`"${r.label}" at (${Math.round(r.x)},${Math.round(r.y)}) ${Math.round(r.w)}x${Math.round(r.h)} exceeds the ${d.width}x${d.canvasHeight} canvas`, r.loc));
    }
  }
  return issues;
}

// `problems` fail the build; `warnings` (text volume, and the rules of rules.ts) never do.
export function verifyDiagram(d: LaidOutDiagram): Verdict {
  const tones = toneEnv(d.tones);
  const verified = d.appearance === 'auto' ? verifyAuto(d, tones) : verifyWith(d, tones);
  return {ok: verified.issues.length === 0, problems: verified.issues.map(i => i.message), ...verified};
}

type Verification = Required<Pick<Verdict, 'issues' | 'warnings' | 'findings'>>;

// ADR 0023 D4: both colour schemes share the same laid-out parts and their source references.
function verifyAuto(d: LaidOutDiagram, tones: ToneEnv): Verification {
  const light = verifyWith({...d, appearance: 'light'}, tones);
  const dark = verifyWith({...d, appearance: 'dark'}, tones);
  const note = (s: string) => `${s} (${DARK_NOTE})`;
  const refs = new Map<SourceRef, number>();
  const issueKey = ({message, loc}: Issue): string => {
    if (loc && !refs.has(loc)) refs.set(loc, refs.size + 1);
    return `${loc ? refs.get(loc) : 0}:${message}`;
  };
  return {
    issues: mergeSides(light.issues, dark.issues, issueKey, i => ({...i, message: note(i.message)})),
    warnings: mergeSides(light.warnings, dark.warnings, s => s, note),
    findings: mergeFindingSides(light.findings, dark.findings),
  };
}

function verifyWith(d: LaidOutDiagram, tones: ToneEnv): Verification {
  const rects = collectRects(d);
  const figureIssues: Issue[] = [], causeWarnings: string[] = [];
  for (const phase of CHECK_PHASES) runCheckPhase(d, tones, phase, figureIssues, causeWarnings); // per band type: see verify-handlers.ts
  const issues = [
    ...checkOverlaps(rects.filter(r => !r.backdrop)),
    ...checkConnects(d, rects.filter(r => !r.backdrop)),
    ...checkAnnotations(d),
    ...checkLoopSide(d),
    ...figureIssues,
    ...checkBounds(d, rects),
    ...contrastProblems(d, tones),
  ];
  // Rule findings (WCAG contrast, legend, lane order, crossings, density ...). Doc-medium diagrams
  // get the full set; legacy slide diagrams keep their existing text-volume warning only.
  const findings = d.medium === 'doc' ? lintDiagram(d) : lintDiagram(d).filter(f => f.rule === 'density' || f.rule === 'auto-fit-applied' || f.rule === 'density-compact-restored' || f.rule === 'cause-line-scale-dropped' || f.rule === 'concentric-label-crossing');
  const warnings = [...(d.revealWarnings ?? []), ...causeWarnings, ...findings.filter(f => f.severity === 'warn').map(f => { const h = acceptHint(f.rule); return `[${f.rule}] ${f.message}${h ? `  → ${h}` : ''}`; })];
  if (d.spotlight && !(typeof d.spotlight === 'object' && d.spotlight.mutedOk) && walkBands(d.bands).some(b => b.type === 'box' && b.tone === 'muted')) warnings.push('[spotlight-muted] spotlight と muted トーンの箱を併用しているため、dim との違いを形でも確認する');
  return {issues, warnings, findings};
}

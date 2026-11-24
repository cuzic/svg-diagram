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
import type {SourceRef} from './source-ref.ts';
import {issueAt, neverTogether, rectOverlap} from './verify-base.ts';
import type {LaidOutDiagram} from './types/index.ts';
import type {CheckRect, Issue, Verdict} from './types/verdicts.ts';

import {must} from './must.ts';
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

interface FigureCheck {issues: Issue[]; warnings: string[]}

export interface VerifyServices {
  checkConnectionGeometry?: (diagram: LaidOutDiagram, rects: CheckRect[]) => Issue[];
  collectRects: (diagram: LaidOutDiagram) => CheckRect[];
  checkFigures: (diagram: LaidOutDiagram, tones: ToneEnv) => FigureCheck;
  contrastProblems: (diagram: LaidOutDiagram, tones: ToneEnv) => Issue[];
  lintDiagram: (diagram: LaidOutDiagram) => Verification['findings'];
  acceptHint: (rule: string) => string | undefined;
  mergeFindingSides: (light: Verification['findings'], dark: Verification['findings']) => Verification['findings'];
  hasMutedBox: (diagram: LaidOutDiagram) => boolean;
}

// `problems` fail the build; `warnings` (text volume, and the rules of rules.ts) never do.
export function verifyWithServices(services: VerifyServices, d: LaidOutDiagram): Verdict {
  const tones = toneEnv(d.tones);
  const verified = d.appearance === 'auto' ? verifyAuto(services, d, tones) : verifyWith(services, d, tones);
  return {ok: verified.issues.length === 0, problems: verified.issues.map(i => i.message), ...verified};
}

type Verification = Required<Pick<Verdict, 'issues' | 'warnings' | 'findings'>>;

// ADR 0023 D4: both colour schemes share the same laid-out parts and their source references.
function verifyAuto(services: VerifyServices, d: LaidOutDiagram, tones: ToneEnv): Verification {
  const light = verifyWith(services, {...d, appearance: 'light'}, tones);
  const dark = verifyWith(services, {...d, appearance: 'dark'}, tones);
  const note = (s: string) => `${s} (${DARK_NOTE})`;
  const refs = new Map<SourceRef, number>();
  const issueKey = ({message, loc}: Issue): string => {
    if (loc && !refs.has(loc)) refs.set(loc, refs.size + 1);
    return `${loc ? refs.get(loc) : 0}:${message}`;
  };
  return {
    issues: mergeSides(light.issues, dark.issues, issueKey, i => ({...i, message: note(i.message)})),
    warnings: mergeSides(light.warnings, dark.warnings, s => s, note),
    findings: services.mergeFindingSides(light.findings, dark.findings),
  };
}

function verifyWith(services: VerifyServices, d: LaidOutDiagram, tones: ToneEnv): Verification {
  const {collectRects, checkFigures, contrastProblems, lintDiagram, acceptHint, hasMutedBox} = services;
  const rects = collectRects(d);
  const {issues: figureIssues, warnings: causeWarnings} = checkFigures(d, tones);
  const obstacles = rects.filter(r => !r.backdrop);
  const issues = [
    ...checkOverlaps(obstacles),
    ...(services.checkConnectionGeometry?.(d, obstacles) ?? []),
    ...figureIssues,
    ...checkBounds(d, rects),
    ...contrastProblems(d, tones),
  ];
  // Rule findings (WCAG contrast, legend, lane order, crossings, density ...). Doc-medium diagrams
  // get the full set; legacy slide diagrams keep their existing text-volume warning only.
  const findings = d.medium === 'doc' ? lintDiagram(d) : lintDiagram(d).filter(f => f.rule === 'density' || f.rule === 'auto-fit-applied' || f.rule === 'density-compact-restored' || f.rule === 'cause-line-scale-dropped' || f.rule === 'concentric-label-crossing');
  const warnings = [...(d.revealWarnings ?? []), ...causeWarnings, ...findings.filter(f => f.severity === 'warn').map(f => { const h = acceptHint(f.rule); return `[${f.rule}] ${f.message}${h ? `  → ${h}` : ''}`; })];
  if (d.spotlight && !(typeof d.spotlight === 'object' && d.spotlight.mutedOk) && hasMutedBox(d)) warnings.push('[spotlight-muted] spotlight と muted トーンの箱を併用しているため、dim との違いを形でも確認する');
  return {issues, warnings, findings};
}

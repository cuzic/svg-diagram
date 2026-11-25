// Per-band-type structural checks of verifyDiagram(): the rects a band contributes to the overlap / connector / bounds checks
// (`rects`), the figure-internal checks it runs (`check`, in the `phase` it belongs to) and its text-contrast check (`contrast`).
// One entry per laid-out band type, each checked against its own band type; a band type without one fails to compile.

import {scopeOf} from './anchor-scope.ts';
import {imageContrast, imageProblems, imageRects} from './verify-image.ts';
import {barsContrastProblems, barsProblems, barsRects} from './verify-bars.ts';
import {checkChart} from './charts-verify.ts';
import {luminance as lightLuminance, paintOf} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import {boxLikeContrastProblems, nowrapProblems} from './verify-box-like.ts';
import {spotlightDim} from './spotlight.ts';
import {legibilityProblem} from './wordart.ts';
import {causeFindings} from './verify-cause.ts';
import {sourceOf} from './source-ref.ts';
import type {SourceRef} from './source-ref.ts';
import {bowtieRects} from './verify-bowtie-rects.ts';
import {captionRects} from './verify-caption.ts';
import {comicConnectorProblems, comicRects} from './verify-comic-rects.ts';
import {comicProblems} from './comic/findings.ts';
import {ftaRects} from './verify-fta-rects.ts';
import {childRects, emblemRects, figureRects, frameRects, overlappingFigureRects, ownRect, scopedRect, statusRects} from './verify-rects.ts';
import {classesProblems} from './verify-classes.ts';
import {bpmnProblems} from './verify-bpmn.ts';
import {treeRects} from './verify-tree.ts';
import {cloudProblems, cloudRects} from './verify-cloud.ts';
import {planeProblems} from './verify-plane.ts';
import {quadrantProblems} from './verify-quadrant.ts';
import {timelineProblems} from './verify-timeline.ts';
import {flowProblems} from './verify-flow.ts';
import {ganttProblems} from './verify-gantt.ts';
import {issueAt, statesProblems} from './verify-base.ts';
import type {LaidOutOf, LaidOutType} from './band-table.ts';
import type {LaidOutComic} from './types/comic.ts';
import type {EmphasisTone} from './types/core.ts';
import type {LaidOutDiagram} from './types/index.ts';
import type {LaidOutBanner, LaidOutBox, LaidOutCaption} from './types/text-bands.ts';
import type {CheckRect, Issue} from './types/verdicts.ts';

/** Where a band's findings go: `problems` fail the build, `warnings` never do. */
interface VerifyOut {
  problems: {push(...messages: string[]): void};
  warnings: string[];
  forChild(child: LaidOutBox): VerifyOut;
}

function outFor(issues: Issue[], warnings: string[], loc?: SourceRef): VerifyOut {
  return {
    problems: {push(...messages) { for (const message of messages) issues.push(issueAt(message, loc)); }},
    warnings,
    forChild: child => outFor(issues, warnings, sourceOf(child) ?? loc),
  };
}

/**
 * The order the figure checks run in: every phase goes over all the bands, then the next one starts, so the findings of one kind
 * stay together (and in band order) whichever band types produce them.
 */
export const CHECK_PHASES = ['plane', 'quadrant', 'flow', 'wordart', 'bars', 'chart', 'image', 'timeline', 'states', 'cause', 'cloud', 'gantt', 'classes', 'bpmn', 'comic', 'nowrap'] as const;
export type CheckPhase = typeof CHECK_PHASES[number];

export interface VerifyHandler<B> {
  rects?(band: B): CheckRect[];
  // `tones` comes last so a check that draws on no tone colour can leave it off
  check?: {phase: CheckPhase; run(band: B, d: LaidOutDiagram, out: VerifyOut, tones: ToneEnv): void};
  contrast?(band: B, d: LaidOutDiagram, tones: ToneEnv, out: VerifyOut): void;
}

// ---- rects: every checkable rect ----

const holdsFigure = (band: {id?: string}) => band.id ? {holds: [band.id]} : {};

// ---- figure checks ----

// A transition must not run through a state it does not touch; its label chip must stay inside the figure and clear of states and other chips.
const checkStates = (band: LaidOutOf<'states'>, _d: LaidOutDiagram, {problems}: VerifyOut): void => {
  problems.push(...statesProblems(band));
};

// A comic's layout findings and connectors to its blanks (ADR 0074 D6).
const checkComic = (band: LaidOutComic, d: LaidOutDiagram, {problems}: VerifyOut): void => {
  problems.push(...comicProblems(band).map(f => f.message));
  problems.push(...comicConnectorProblems(band, d.connects.map(c => ({
    fromId: c.fromId, toId: c.toId, fromLabel: c.fromLabel, toLabel: c.toLabel, segments: c.pathSegments,
  }))));
};

const checkNoWrap = (band: LaidOutBox, out: VerifyOut): void => { out.problems.push(...nowrapProblems(band)); };

// wordart(): the letters must read against what is behind them (see legibilityProblem). (The ink always stays inside the band: inkReach
// widens the rect on every side, and a shadow or a mirror image cannot be placed outside it.)
const checkWordArt = (band: LaidOutOf<'wordart'>, d: LaidOutDiagram, {problems}: VerifyOut, tones: ToneEnv): void => {
  const why = legibilityProblem(band.look, d.day, paintOf(tones, d.appearance));
  if (why) problems.push(`wordart "${band.text.slice(0, 20)}": ${why}`);
};

// ---- contrast: computed purely from the known, closed set of (tone, day) colour combinations the DSL can ever produce ----
// The same formula lint-svg.ts uses, evaluated on values we already know.

const lum = (d: LaidOutDiagram, tones: ToneEnv) => { const paint = paintOf(tones, d.appearance); return (hex: string) => lightLuminance(paint(hex)); }; // judged on the colours as drawn

function contrastFor(band: LaidOutBox | LaidOutBanner | LaidOutCaption, boxTone: EmphasisTone | null, d: LaidOutDiagram, tones: ToneEnv, {problems}: VerifyOut): void {
  problems.push(...boxLikeContrastProblems(band, boxTone, d.day, tones, d.appearance));
}

const flowCheck = {phase: 'flow', run: (band: Parameters<typeof flowProblems>[0], _d: LaidOutDiagram, {problems}: VerifyOut) => { problems.push(...flowProblems(band)); }} as const;
const childChecks: VerifyHandler<LaidOutOf<'row' | 'grid'>> = {
  rects: childRects,
  check: {phase: 'nowrap', run: (band, _d, out) => {
    for (const c of band.children) checkNoWrap(c, out.forChild(c));
  }},
  contrast: (band, d, tones, out) => {
    for (const c of band.children) contrastFor(c, c.tone ?? 'plain', d, tones, out.forChild(c));
  },
};

export const VERIFY_HANDLERS = {
  caption: {rects: captionRects, contrast: (band, d, tones, out) => contrastFor(band, null, d, tones, out)},
  box: {rects: ownRect, check: {phase: 'nowrap', run: (band, _d, out) => checkNoWrap(band, out)}, contrast: (band, d, tones, out) => contrastFor(band, band.tone ?? 'plain', d, tones, out)},
  banner: {rects: ownRect, contrast: (band, d, tones, out) => contrastFor(band, band.tone ?? 'accent', d, tones, out)},
  group: {},
  legend: {rects: ownRect},
  row: childChecks,
  grid: childChecks,
  raw: {rects: ownRect},
  status: {rects: statusRects},
  pyramid: {rects: ownRect},
  curve: {rects: ownRect},
  plane: {rects: ownRect, check: {phase: 'plane', run: (band, _d, out) => { out.problems.push(...planeProblems(band)); }}},
  bars: {
    rects: barsRects,
    check: {phase: 'bars', run: (band, _d, out) => { out.problems.push(...barsProblems(band)); }},
    contrast: (band, d, tones, out) => { out.problems.push(...barsContrastProblems(band, d.day, lum(d, tones), spotlightDim(d) === 'fill')); },
  },
  chart: {
    rects: band => band.anchors.map(a => ({id: a.id, label: a.id, x: a.x, y: a.y, w: a.w, h: a.h, ...holdsFigure(band)})), // each bar / cell / node with an id is its own rect: a connector from outside must not run through one
    check: {phase: 'chart', run: (band, d, {problems}, tones) => { problems.push(...checkChart(band, d, tones)); }},
  },
  image: {
    rects: imageRects,
    check: {phase: 'image', run: (band, _d, {problems}) => { problems.push(...imageProblems(band)); }},
    contrast: (band, d, tones, {problems}) => { problems.push(...imageContrast(band, d.day, d.appearance, tones)); },
  },
  people: {rects: ownRect},
  dots: {rects: ownRect},
  math: {rects: ownRect},
  quadrant: {rects: figureRects, check: {phase: 'quadrant', run: (band, _d, out) => { out.problems.push(...quadrantProblems(band)); }}},
  chevron: {rects: figureRects, check: flowCheck},
  wordart: {rects: ownRect, check: {phase: 'wordart', run: checkWordArt}},
  funnel: {rects: figureRects, check: flowCheck},
  cycle: {rects: figureRects, check: flowCheck},
  venn: {rects: overlappingFigureRects, check: flowCheck},
  concentric: {rects: overlappingFigureRects, check: flowCheck},
  emblem: {rects: emblemRects, check: flowCheck},
  valueChain: {rects: figureRects, check: flowCheck},
  timeline: {rects: ownRect, check: {phase: 'timeline', run: (band, _d, out) => { out.problems.push(...timelineProblems(band)); }}},
  bowtie: {rects: bowtieRects},
  comic: {rects: comicRects, check: {phase: 'comic', run: checkComic}},
  fta: {rects: ftaRects},
  // a band node has no label box and is checked as the band it is (its own rects), so the label boxes count only the text nodes
  tree: {rects: treeRects},
  states: {rects: figureRects, check: {phase: 'states', run: checkStates}},
  cause: {rects: figureRects, check: {phase: 'cause', run: (band, _d, out) => {
    const {problems, warnings} = causeFindings(band);
    out.problems.push(...problems);
    out.warnings.push(...warnings);
  }}},
  cloud: {rects: cloudRects, check: {phase: 'cloud', run: (band, _d, out) => { out.problems.push(...cloudProblems(band)); }}},
  gantt: {rects: figureRects, check: {phase: 'gantt', run: (band, _d, out) => { out.problems.push(...ganttProblems(band)); }}},
  classes: {rects: figureRects, check: {phase: 'classes', run: (band, _d, out) => { out.problems.push(...classesProblems(band)); }}},
  bpmn: {rects: figureRects, check: {phase: 'bpmn', run: (band, _d, out) => { out.problems.push(...bpmnProblems(band)); }}},
  swimlane: {},
  sequence: {rects: ownRect},
  table: {rects: ownRect},
  wireframe: {rects: ownRect},
  screens: {rects: frameRects}, // each screen frame, not the bounding box that holds them all
} satisfies {[T in LaidOutType]: VerifyHandler<LaidOutOf<T>>};

/** Band types with no entry in VERIFY_HANDLERS: must be `never`. */
export type UnverifiedBandTypes = Exclude<LaidOutType, keyof typeof VERIFY_HANDLERS>;
export const ALL_BANDS_VERIFIED: UnverifiedBandTypes extends never ? true : never = true;

const handlerOf = (band: LaidOutDiagram['laidOut'][number]): VerifyHandler<LaidOutDiagram['laidOut'][number]> => VERIFY_HANDLERS[band.type] as VerifyHandler<never> as VerifyHandler<LaidOutDiagram['laidOut'][number]>;

/** Every checkable rect, in band order. */
export function collectRects(d: LaidOutDiagram): CheckRect[] {
  return d.laidOut.flatMap(band => {
    // comicRects names panels and slots explicitly: a bare band id can have the same spelling as either.
    const scope = band.type === 'comic' ? undefined : scopeOf(band), loc = sourceOf(band);
    const rects = (handlerOf(band).rects?.(band) ?? []).map(r => loc && !r.loc ? {...r, loc} : r);
    return scope ? rects.map(r => scopedRect(band, scope, r)) : rects;
  });
}

/** The figure checks of one phase, over every band in order. */
export function runCheckPhase(d: LaidOutDiagram, tones: ToneEnv, phase: CheckPhase, issues: Issue[], warnings: string[]): void {
  for (const band of d.laidOut) {
    const check = handlerOf(band).check;
    if (check?.phase === phase) check.run(band, d, outFor(issues, warnings, sourceOf(band)), tones);
  }
}

/** The contrast problems of every band, in band order. */
export function contrastProblems(d: LaidOutDiagram, tones: ToneEnv): Issue[] {
  const issues: Issue[] = [], warnings: string[] = [];
  for (const band of d.laidOut) handlerOf(band).contrast?.(band, d, tones, outFor(issues, warnings, sourceOf(band)));
  return issues;
}

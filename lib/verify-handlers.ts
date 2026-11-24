// Per-band-type structural checks of verifyDiagram(): the rects a band contributes to the overlap / connector / bounds checks
// (`rects`), the figure-internal checks it runs (`check`, in the `phase` it belongs to) and its text-contrast check (`contrast`).
// One entry per laid-out band type, each checked against its own band type; a band type without one fails to compile.

import {bareNameIn, qualify, scopeOf} from './anchor-scope.ts';
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
import {ftaRects} from './verify-fta-rects.ts';
import {anchorRects, frameRects, ownRect, scopedRect} from './verify-rects.ts';
import {classesProblems} from './verify-classes.ts';
import {bpmnProblems} from './verify-bpmn.ts';
import {treeRects} from './verify-tree.ts';
import {cloudProblems, cloudRects} from './verify-cloud.ts';
import {planeProblems} from './verify-plane.ts';
import {quadrantProblems} from './verify-quadrant.ts';
import {timelineProblems} from './verify-timeline.ts';
import {flowProblems} from './verify-flow.ts';
import {ganttProblems} from './verify-gantt.ts';
import {issueAt, labelOf, rectOverlap, statesProblems} from './verify-base.ts';
import type {LaidOutOf, LaidOutType} from './band-table.ts';
import type {ComicLaidBubble, LaidOutComic} from './types/comic.ts';
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

// ---- rects: every checkable rect (captions with no ink box are skipped: no background, and their width is already wrap-constrained) ----

type Anchored = Parameters<typeof anchorRects>[0];
const figureRects = (band: Anchored): CheckRect[] => anchorRects(band);
/** An emblem's obstacle is the bounding box of each shape, not its anchor: a triangle's anchor leaves out its lower corners. */
const emblemRects = (band: Anchored & {bounds?: Anchored['anchors']}): CheckRect[] => anchorRects({...band, anchors: band.bounds ?? band.anchors});
const overlappingFigureRects = (band: Anchored): CheckRect[] => anchorRects(band, `@intentional-overlap:${band.x},${band.y}`);
const holdsFigure = (band: {id?: string}) => band.id ? {holds: [band.id]} : {};
const childRects = (band: {children: LaidOutBox[]}): CheckRect[] => band.children.map(c => {
  const loc = sourceOf(c);
  return {id: c.id ?? null, label: labelOf(c), x: c.x, y: c.y, w: c.w, h: c.h, ...(loc ? {loc} : {})};
});

function comicSlotOwners(band: LaidOutComic): Map<string, ComicLaidBubble> {
  const owners = new Map<string, ComicLaidBubble>();
  for (const bubble of band.bubbles) for (const {id} of bubble.slots) {
    // Layout registers only the first anchor when a worksheet repeats a slot id.
    if (!owners.has(id)) owners.set(id, bubble);
  }
  return owners;
}

function comicRects(band: LaidOutComic): CheckRect[] {
  const scope = scopeOf(band), owners = comicSlotOwners(band);
  return band.panels.map(({id, x, y, w, h}) => {
    const holds = band.id ? [band.id] : [];
    for (const [slot, bubble] of owners) if (bubble.panel === id) holds.push(qualify(scope, slot));
    return {id: qualify(scope, id), label: `comic panel ${id}`, x, y, w, h, holds};
  });
}

// ---- figure checks ----

// A transition must not run through a state it does not touch; its label chip must stay inside the figure and clear of states and other chips.
const checkStates = (band: LaidOutOf<'states'>, _d: LaidOutDiagram, {problems}: VerifyOut): void => {
  problems.push(...statesProblems(band));
};

// A cause arrow must not run through an entity it does not touch; the arrows of an AND must be joined by their arc.
// A comic's data and layout problems (ADR 0074 D6): the findings of its layout that are mistakes (the advice ones are lint findings, lib/rules.ts).
const checkComic = (band: LaidOutComic, d: LaidOutDiagram, {problems}: VerifyOut): void => {
  for (const f of band.findings) if (f.severity === 'problem') problems.push(`comic: ${f.message} [${f.rule}]`);
  if (!d.connects.length) return;
  const scope = scopeOf(band), owners = comicSlotOwners(band);
  for (const c of d.connects) {
    const fromId = bareNameIn(scope, c.fromId), toId = bareNameIn(scope, c.toId);
    const from = fromId === undefined ? undefined : owners.get(fromId), to = toId === undefined ? undefined : owners.get(toId);
    if (!from && !to) continue;
    // Other panels are checked by their frames. Inside the endpoint panels, check the bubbles individually.
    for (const b of band.bubbles) {
      if (b.panel !== from?.panel && b.panel !== to?.panel) continue;
      if (b === from || b === to || b.id === fromId || b.id === toId) continue;
      if (c.pathSegments.some(seg => rectOverlap(seg, b))) {
        problems.push(`connect(${c.fromLabel} -> ${c.toLabel}) の経路がふきだし "${qualify(scope, b.id)}" に重なります。接続の辺か経路を変えてください`);
      }
    }
  }
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
  caption: {rects: band => band.inkBox ? [{id: null, label: `group title "${band.text}"`, ...band.inkBox}] : [], contrast: (band, d, tones, out) => contrastFor(band, null, d, tones, out)},
  box: {rects: ownRect, check: {phase: 'nowrap', run: (band, _d, out) => checkNoWrap(band, out)}, contrast: (band, d, tones, out) => contrastFor(band, band.tone ?? 'plain', d, tones, out)},
  banner: {rects: ownRect, contrast: (band, d, tones, out) => contrastFor(band, band.tone ?? 'accent', d, tones, out)},
  group: {},
  legend: {rects: ownRect},
  row: childChecks,
  grid: childChecks,
  raw: {rects: ownRect},
  status: {rects: band => [{id: null, label: 'status badge', ...band.pill}]},
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

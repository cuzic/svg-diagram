// Pass 1 of the layout: every atom a diagram needs measured, collected into one request map for the single batched measureAll call.
// What each band type needs is one entry of MEASURE_HANDLERS (a typed table: a band type without one fails to compile).

import {splitAtoms} from './atoms.ts';
import {styledAtoms, textRuns} from './layout-text.ts';
import {TAG_SIZE, CONNECT_LABEL_SIZE} from './tokens.ts';
import {groupTitleBand, withSourceLine} from './layout-util.ts';
import {childrenOf} from './band-children.ts';
import {planeTexts} from './plane.ts';
import {imageTexts} from './image.ts';
import {barsTexts} from './bars.ts';
import {dotsTexts, peopleTexts} from './people.ts';
import {timelineTexts} from './timeline.ts';
import {quadrantTexts} from './quadrant.ts';
import {flowShapeTexts} from './flow-shapes.ts';
import {wordArtTexts} from './wordart.ts';
import {treeTexts} from './tree.ts';
import {statesTexts} from './states.ts';
import {causeTexts, cloudTexts} from './toc.ts';
import {ganttTexts} from './gantt.ts';
import {statusTexts, withStatus} from './status.ts';
import {classesTexts} from './classes.ts';
import {bpmnTexts} from './bpmn.ts';
import {chartTexts} from './charts.ts';
import {collectTextRequests} from './seq-table.ts';
import {collectTextRequests as wfTextRequests} from './wireframe.ts';
import type {DiagramData, FontFamily, MeasureRequest, Measured, Roles, WidthOf} from './types/core.ts';
import type {Band} from './types/index.ts';

export type Requests = Map<string, MeasureRequest>;
type BandOf<T extends Band['type']> = Extract<Band, {type: T}>;

/** What a measure handler registers through: single atoms, a band's own text runs, and (for a band that holds bands) its children. */
export interface MeasureCtx {
  readonly roles: Roles;
  /** Every atom of `text` at this size / weight / font. */
  atoms(text: string, size: number, weight: number, font?: FontFamily): void;
  /** A band's tag, stamp and text runs (what a caption / box / banner needs). */
  own(band: Band): void;
  /** A child band, by its own handler. */
  band(band: Band): void;
}

export type MeasureHandler<B> = (band: B, m: MeasureCtx) => void;
export type MeasureHandlerTable = {[T in Band['type']]: MeasureHandler<BandOf<T>>};

function registerAtoms(requests: Requests, text: string, size: number, weight: number, font: FontFamily = 'sans'): void {
  for (const atom of splitAtoms(text)) {
    const key = `${atom} ${size} ${weight} ${font}`;
    if (!requests.has(key)) requests.set(key, {text: atom, size, weight, font});
  }
}

function registerRequests(requests: Requests, band: Band, roles: Roles): void {
  if ('tag' in band && band.tag) registerAtoms(requests, band.tag, (roles.tag ?? TAG_SIZE), 700);
  if ('stamp' in band && band.stamp) registerAtoms(requests, band.stamp, roles.note, 400);
  for (const run of textRuns(band, roles)) {
    const font = run.mono ? 'mono' : 'sans';
    for (const {text, weight} of styledAtoms(run)) {
      const key = `${text} ${run.size} ${weight} ${font}`;
      if (!requests.has(key)) requests.set(key, {text, size: run.size, weight, font});
    }
  }
}

/** A band whose own module lists its text as [text, size, weight, font] tuples. */
const fromTuples = <B,>(texts: (band: B, roles: Roles) => Iterable<readonly [string, number, number, FontFamily]>): MeasureHandler<B> =>
  (band, m) => { for (const [text, size, weight, font] of texts(band, m.roles)) m.atoms(text, size, weight, font); };

const own: MeasureHandler<Band> = (band, m) => m.own(band);
const children: MeasureHandler<Band> = (band, m) => { for (const child of childrenOf(band)) m.band(child); };
/** row / grid children are box-like: their own text only. */
const childrenOwn: MeasureHandler<Band> = (band, m) => { for (const child of childrenOf(band)) m.own(child); };

export const MEASURE_HANDLERS = {
  caption: own, box: own, banner: own, spacer: own, raw: own,
  status: fromTuples(statusTexts),
  group: (band, m) => {
    if (band.stamp) m.atoms(band.stamp, m.roles.note, 400);
    if (band.title) m.own(groupTitleBand(band));
    children(band, m);
  },
  grouprow: children,
  row: childrenOwn,
  grid: (band, m) => {
    if (band.canvas?.title) m.own({type: 'caption', text: band.canvas.title, align: 'left', role: 'title', bold: true, tone: 'text', mono: false});
    childrenOwn(band, m);
  },
  swimlane: (band, m) => {
    for (const l of band.lanes) m.atoms(l.label, m.roles.title, 700);
    for (const p of band.phases ?? []) m.atoms(p.label, m.roles.note, 700);
    for (const st of band.steps) m.own(st);
  },
  legend: (band, m) => { for (const item of band.items) m.atoms(item.label, m.roles.note, 400); },
  // connect() labels are single-line, always the 'note' role at plain weight (see emit.ts's renderConnect) — registered here so their
  // real width is known before layoutDiagram resolves the connect, instead of guessed at draw time.
  connect: (band, m) => { if (band.label) m.atoms(band.label, (m.roles.connectLabel ?? CONNECT_LABEL_SIZE), 400); },
  pyramid: (band, m) => { for (const layer of band.layers) m.atoms(layer.text, m.roles.title, 700); },
  curve: (band, m) => { for (const label of [band.yTopLabel, band.yBottomLabel, band.xLabel]) if (label) m.atoms(label, m.roles.note, 400); },
  image: (band, m) => { fromTuples(imageTexts)(band, m); children(band, m); },
  sequence: fromTuples(collectTextRequests),
  table: fromTuples(collectTextRequests),
  wireframe: fromTuples((band, _roles) => wfTextRequests(band)),
  screens: fromTuples((band, _roles) => wfTextRequests(band)),
  plane: fromTuples(planeTexts),
  quadrant: fromTuples(quadrantTexts),
  chevron: fromTuples(flowShapeTexts),
  wordart: fromTuples(wordArtTexts),
  funnel: fromTuples(flowShapeTexts),
  cycle: fromTuples(flowShapeTexts),
  venn: fromTuples(flowShapeTexts),
  concentric: fromTuples(flowShapeTexts),
  bars: fromTuples(barsTexts),
  chart: fromTuples(chartTexts),
  people: fromTuples(peopleTexts),
  dots: fromTuples(dotsTexts),
  math: () => undefined,
  timeline: fromTuples(timelineTexts),
  bpmn: fromTuples(bpmnTexts),
  classes: fromTuples(classesTexts),
  gantt: fromTuples(ganttTexts),
  cause: fromTuples(causeTexts),
  cloud: fromTuples(cloudTexts),
  states: fromTuples(statesTexts),
  tree: fromTuples(treeTexts),
} satisfies MeasureHandlerTable;

/** Pass 1: every atom this diagram needs measured, at the font sizes of `roles`. Pure: no measuring happens here. */
export function collectMeasures(data: DiagramData, roles: Roles): Requests {
  const d = withStatus(withSourceLine(data));
  const requests: Requests = new Map();
  const m: MeasureCtx = {
    roles,
    atoms: (text, size, weight, font) => registerAtoms(requests, text, size, weight, font),
    own: band => registerRequests(requests, band, roles),
    band: band => (MEASURE_HANDLERS as unknown as Record<string, MeasureHandler<Band>>)[band.type](band, m),
  };
  for (const band of d.bands) m.band(band);
  return requests;
}

/**
 * The width lookup over what measureAll(collectMeasures(...)) returned. An atom that was never registered measures 0 wide,
 * silently (a line then overflows its box); with `strict` that is an error. The caller reads SVG_DIAGRAM_STRICT_WIDTH
 * (layout itself touches no environment).
 */
export function widthOfMeasured(measured: Map<string, Measured>, strict: boolean): WidthOf {
  return (atom, size, weight, font) => {
    const m = measured.get(`${atom} ${size} ${weight} ${font}`);
    if (m) return m.w;
    if (strict) throw new Error(`layout: "${atom}" (${size}px, ${weight}, ${font}) was not registered for measuring, so its width would be 0 (SVG_DIAGRAM_STRICT_WIDTH is set)`);
    return 0;
  };
}

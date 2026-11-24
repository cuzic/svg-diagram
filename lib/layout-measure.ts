// Pass 1 of the layout: every atom a diagram needs measured, collected into one request map for the single batched measureAll call.
// What each band type needs is one entry of MEASURE_HANDLERS (a typed table: a band type without one fails to compile).

import {must} from './must.ts';
import {CONNECT_LABEL_SIZE} from './tokens.ts';
import {groupTitleBand} from './layout-util.ts';
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
import {statusTexts} from './status.ts';
import {classesTexts} from './classes.ts';
import {bpmnTexts} from './bpmn.ts';
import {ftaTexts} from './fta.ts';
import {bowtieMeasure} from './bowtie.ts';
import {comicMeasure} from './comic/measure.ts';
import {chartTexts} from './charts.ts';
import {collectTextRequests} from './seq-table.ts';
import {collectTextRequests as wfTextRequests} from './wireframe.ts';
import type {FontFamily, Roles} from './types/core.ts';
import type {Band} from './types/index.ts';

import {createMeasureCollector} from './measure-core.ts';
import type {MeasureHandler, MeasureHandlerTable} from './measure-core.ts';

export {widthOfMeasured} from './measure-core.ts';
export type {MeasureCtx, MeasureHandler, MeasureHandlerTable, Requests} from './measure-core.ts';

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
  areas: children,
  row: childrenOwn,
  grid: (band, m) => {
    if (band.canvas?.title) m.own({type: 'caption', text: band.canvas.title, align: 'left', role: 'title', bold: true, tone: 'text', mono: false});
    childrenOwn(band, m);
  },
  swimlane: (band, m) => {
    for (const l of band.lanes) m.atoms(l.label, m.roles.title, 700);
    for (const p of band.phases ?? []) m.atoms(p.label, m.roles.note, 700);
    for (const b of band.boundaries ?? []) if (b.label) m.atoms(b.label, m.roles.note, 700);
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
  emblem: fromTuples(flowShapeTexts),
  valueChain: fromTuples(flowShapeTexts),
  bars: fromTuples(barsTexts),
  chart: fromTuples(chartTexts),
  people: fromTuples(peopleTexts),
  dots: fromTuples(dotsTexts),
  math: () => undefined,
  timeline: fromTuples(timelineTexts),
  bpmn: fromTuples(bpmnTexts),
  fta: fromTuples(ftaTexts),
  bowtie: fromTuples(bowtieMeasure),
  comic: fromTuples(comicMeasure),
  classes: fromTuples(classesTexts),
  gantt: fromTuples(ganttTexts),
  cause: fromTuples(causeTexts),
  cloud: fromTuples(cloudTexts),
  states: fromTuples(statesTexts),
  tree: (band, m) => { fromTuples(treeTexts)(band, m); children(band, m); }, // the nodes' own text, then the bands that are nodes
} satisfies MeasureHandlerTable;

export const collectMeasures = createMeasureCollector(band =>
  must((MEASURE_HANDLERS as unknown as Record<string, MeasureHandler<Band>>)[band.type]));

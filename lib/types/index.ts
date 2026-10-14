// Domain types for svg-diagram (types only: nothing in this file exists at runtime).
//
// Layers, in the order data flows through them:
//   1. DSL input   — XxxOpts (what a caller passes to diagram() / box() / wf.col() ...)
//   2. Bands       — Band: what the DSL constructors return (a vertical stack, discriminated on `type`)
//   3. Laid out    — LaidOutBand / LaidOutDiagram: layout.ts output, every band has x/y/w/h
//   4. Verdicts    — Finding / Verdict / FitReport: rules.ts, verify.ts, fit.ts output
//
// Conventions:
//   * Laid-out objects are MUTABLE on purpose (layout.ts creates a band, then fixes h / y / tagBox.y
//     once siblings are known). Do not mark their fields readonly.
//   * Optional (`?`) means "the DSL constructor may leave this undefined", not "may be missing at runtime
//     after defaults were applied" — a constructor that defaults a field (e.g. row().gap) returns it required.
//   * Colours are never raw strings in the DSL: they are token keys (TextTone / BoxTone / ColorKey).
//
// This directory is split by domain; index.ts re-exports everything and holds the Band / LaidOut unions.

export * from './core.ts';
export * from './text-bands.ts';
export * from './containers.ts';
export * from './figures.ts';
export * from './people-dots.ts';
export * from './math.ts';
export * from './bars.ts';
export * from './timeline.ts';
export * from './diagrams.ts';
export * from './image.ts';
export * from './sequence-table-swimlane.ts';
export * from './wireframe.ts';
export * from './wireframe-nodes.ts';
export * from './verdicts.ts';
export * from './project.ts';
import type {ChartBand, LaidOutChart} from '../charts.ts';
import type {FlowShapeBand, LaidOutFlowShape} from '../flow-shapes.ts';
import type {LaidOutQuadrant, QuadrantBand} from '../quadrant.ts';
import type {BarsBand, LaidOutBars} from './bars.ts';
import type {ConnectBand, GridBand, GroupBand, GroupRowBand, LaidOutConnect, LaidOutGrid, LaidOutGroup, LaidOutLegend, LaidOutRaw, LaidOutRow, LegendBand, RawBand, RowBand, SpacerBand} from './containers.ts';
import type {DiagramData, Dimmed, Roles} from './core.ts';
import type {BpmnBand, CauseBand, ClassesBand, CloudBand, LaidOutBpmn, LaidOutCause, LaidOutClasses, LaidOutCloud, LaidOutStates, LaidOutTree, StatesBand, TreeBand} from './diagrams.ts';
import type {CurveBand, LaidOutCurve, LaidOutPlane, LaidOutPyramid, PlaneBand, PyramidBand} from './figures.ts';
import type {ImageBand, LaidOutImage} from './image.ts';
import type {LaidOutMath, MathBand} from './math.ts';
import type {DotsBand, LaidOutDots, LaidOutPeople, PeopleBand} from './people-dots.ts';
import type {LaidOutSequence, LaidOutSwimlane, LaidOutTable, SequenceBand, SwimlaneBand, TableBand} from './sequence-table-swimlane.ts';
import type {BannerBand, BoxBand, CaptionBand, LaidOutBanner, LaidOutBox, LaidOutCaption} from './text-bands.ts';
import type {GanttBand, LaidOutGantt, LaidOutTimeline, NumericTimelineBand, TimelineBand} from './timeline.ts';
import type {LaidOutScreens, LaidOutWireframe, ScreensBand, WireframeBand} from './wireframe.ts';

/** Every band the DSL constructors return. */
export type Band =
  | ChartBand
  | CaptionBand | BoxBand | BannerBand | GroupBand | LegendBand | SpacerBand | RawBand
  | RowBand | GroupRowBand | GridBand | ConnectBand | PyramidBand | CurveBand | PlaneBand | BarsBand | PeopleBand | DotsBand | MathBand | TimelineBand | NumericTimelineBand | TreeBand | StatesBand | CauseBand | CloudBand | GanttBand | ClassesBand | BpmnBand | ImageBand | QuadrantBand | FlowShapeBand
  | SequenceBand | TableBand | SwimlaneBand | WireframeBand | ScreensBand;
export type LaidOutBand = (
  | LaidOutChart
  | LaidOutCaption | LaidOutBox | LaidOutBanner | LaidOutGroup | LaidOutLegend | LaidOutRow | LaidOutGrid
  | LaidOutRaw | LaidOutPyramid | LaidOutCurve | LaidOutPlane | LaidOutBars | LaidOutImage | LaidOutPeople | LaidOutDots | LaidOutMath | LaidOutQuadrant | LaidOutFlowShape | LaidOutTimeline | LaidOutTree | LaidOutStates | LaidOutCause | LaidOutCloud | LaidOutGantt | LaidOutClasses | LaidOutBpmn | LaidOutSwimlane | LaidOutSequence | LaidOutTable
  | LaidOutWireframe | LaidOutScreens) & Dimmed;
/** layoutDiagram() output: the diagram data plus everything layout computed. */
export interface LaidOutDiagram extends DiagramData {
  laidOut: LaidOutBand[];
  canvasHeight: number;
  /** The height the bands need, before diagram({canvas}) pads the canvas up to its fixed height. */
  contentHeight?: number;
  connects: LaidOutConnect[];
  /** Set by build() when fill: true scaled the fonts. */
  fontScale?: number;
  /** The font sizes the layout was made with; emit reads them from here, so a drawing always agrees with its layout. */
  roles: Roles;
}

// Public API: a vertical stack of bands (caption, box, banner, spacer, raw,
// row, grid, connect, pyramid, curve, bars).
//
// Deliberately absent from every function signature: x, y, fill, stroke,
// font-family, and (on the normal path) font-size/height. That absence IS
// the constraint system — a caller cannot express an off-token color or a
// sub-14px font because there is no parameter that accepts one.

//
// This file is only the package entry point ("svg-diagram"): the builders live in lib/dsl/*.ts, one module per family, and
// are pure (no fs / child_process; test/core-purity.test.ts). lib/dsl/render.ts holds diagram() / renderDiagram() / checkDiagram()
// and lib/dsl/io.ts the pieces that touch the disk (build(), image()). shared / defaults / wireframe-numbering are internal and not re-exported.

export * from './dsl/text-bands.ts';
export * from './dsl/sequence-table-swimlane.ts';
export * from './dsl/wireframe.ts';
export * from './dsl/containers.ts';
export * from './dsl/connect.ts';
export * from './dsl/figures.ts';
export * from './dsl/people-dots.ts';
export * from './dsl/charts.ts';
export * from './dsl/charts-stats.ts';
export * from './dsl/bars.ts';
export * from './dsl/qc-semantic.ts';
export * from './dsl/diagrams.ts';
export * from './dsl/timeline-gantt.ts';
export * from './dsl/io.ts';
export * from './dsl/render.ts';

export {wf} from './wireframe.ts';
export {icon} from './icon-registry.ts';
export type {IconName, EmojiName} from './icons.ts';
export {versus} from './versus.ts';
export {steps} from './steps.ts';
export type {StepItem, StepsOpts} from './steps.ts';
export {hero} from './hero.ts';
export {em} from './rich.ts';
export type {HeroOpts, HeroStat} from './hero.ts';
export type {VersusConnectLabels, VersusOpts, VersusPart, VersusSharedOpts} from './versus.ts';
// Every public type (WfNode, TableCell, TextTone, RawColorTone, ...) so project code never has to spell Parameters<typeof wf.col>[0].
export type * from './types/index.ts';
export type * from './semantic-table.ts';

export type {QuadrantOpts, QuadrantItem, QuadrantPreset, QuadrantCell, QuadrantAxis, QuadrantArrow, QuadrantRegion} from './quadrant.ts';
export type {WordArtOpts, WordArtBand, WordArtPreset, OutlineSpec, ShadowSpec, GradientSpec, GlowSpec, ExtrudeSpec, ReflectionSpec, ArtTone} from './wordart.ts';
export type {FlowStep, ChevronOpts, FunnelStage, FunnelOpts, CycleOpts, VennSet, VennOverlap, VennOpts, ConcentricRing, ConcentricOpts, EmblemItem, EmblemShape, EmblemOpts} from './flow-shapes.ts';
export {tally} from './qc-table.ts';
export type {CanvasContent, CanvasKey, CanvasOpts, CanvasTemplate} from './canvas.ts';
export {closeMeasurer} from './measure.ts';
export type {CheckItem, CheckSheetOpts, MatrixMark, MatrixOpts} from './qc-table.ts';
export type {AttributeSample, ControlChartOpts, ControlType, ScatterOpts, ScatterPoint} from './qc-plane.ts';
export type {ChartBand} from './charts.ts';
export type {WaterfallOpts, WaterfallStep} from './charts-waterfall.ts';
export type {PertTask, PertAnalysis, PertResult, CausalLink, CausalLoop, CausalPolarity} from './semnet-analysis.ts';
export {analyzeCriticalPath, analyzeCausalLoops} from './semnet-analysis.ts';
export type {PertOpts, CausalNode, CausalOpts, CausalIntervention, DependencyNode, DependencyEdge, DependencyEdgeType, DependencyOpts, SemnetDirection} from './semnet.ts';
export type {TornadoItem, TornadoOpts} from './charts-tornado.ts';
export type {BubbleAxis, BubbleOpts, BubblePoint} from './charts-bubble.ts';
export type {ButterflyOpts, ButterflyRow} from './charts-butterfly.ts';
export type {ComboAxis, ComboOpts, ComboSeries} from './charts-combo.ts';
export type {HarveyOpts, HarveyRow} from './charts-harvey.ts';
export type {HeatmapOpts} from './charts-heatmap.ts';
export type {RadarOpts, RadarSeries} from './charts-radar.ts';
export type {BurndownSpec, BurnupSpec, LineSeries, LinesAnnotation, LinesAxis, LinesOpts, StrategyCanvasOpts} from './charts-lines.ts';
export type {SankeyLink, SankeyNode, SankeyOpts} from './charts-sankey.ts';
export type {TreemapNode, TreemapOpts} from './charts-treemap.ts';
export type {StackColumn, StackPart, StackedOpts} from './charts-stacked.ts';

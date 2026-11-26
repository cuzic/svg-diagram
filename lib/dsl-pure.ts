// The package entry minus everything that touches the disk or a process (build(), image(), math(), renderDiagram(), checkDiagram(), the
// rendering shell): the builders, diagram() and the public types. lib/dsl.ts re-exports it, and the browser entry (lib/web.ts) builds on
// it. A file reachable from here may not import node:* (test/web-entry.test.ts). ADR 0045.

import {located} from './located-full.ts';
import * as textBands from './dsl/text-bands.ts';
import * as sequenceTableSwimlane from './dsl/sequence-table-swimlane.ts';
import * as wireframes from './dsl/wireframe.ts';
import * as containers from './dsl/containers.ts';
import * as connections from './dsl/connect.ts';
import * as figures from './dsl/figures.ts';
import * as peopleDots from './dsl/people-dots.ts';
import * as charts from './dsl/charts.ts';
import * as chartsStats from './dsl/charts-stats.ts';
import * as barCharts from './dsl/bars.ts';
import {scatter as scatterBand} from './dsl/scatter.ts';
import * as qcSemantic from './dsl/qc-semantic.ts';
import * as diagrams from './dsl/diagrams.ts';
import * as chats from './dsl/chat.ts';
import * as comics from './dsl/comic.ts';
import * as timelineGantt from './dsl/timeline-gantt.ts';
import {canvas as canvasPart} from './compose/canvas.ts';
import {iconRow as iconRowPart} from './compose/icon-row.ts';
import {steps as stepsPart} from './steps.ts';
import {hero as heroPart} from './compose/hero.ts';

export {diagram} from './dsl/diagram.ts';

export type * from './dsl/text-bands.ts';
export {fillScaleLimit} from './dsl/fill-scale-limit.ts';
export const caption = located(textBands.caption);
export const box = located(textBands.box);
export const stat = located(textBands.stat);
export const banner = located(textBands.banner);
export const group = located(textBands.group);
export const legend = located(textBands.legend);
export const raw = located(textBands.raw);

export type * from './dsl/sequence-table-swimlane.ts';
export {cell, stateRow} from './dsl/sequence-table-swimlane.ts';
export const sequence = located(sequenceTableSwimlane.sequence);
export const table = located(sequenceTableSwimlane.table);
export const swimlane = located(sequenceTableSwimlane.swimlane);
export const stateMatrix = located(sequenceTableSwimlane.stateMatrix);

export type * from './dsl/wireframe.ts';
export const wireframe = located(wireframes.wireframe);
export const screens = located(wireframes.screens);

export type * from './dsl/containers.ts';
export const spacer = located(containers.spacer);
export const row = located(containers.row);
export const node = located(containers.node);
export type {IconRowItem} from './compose/icon-row.ts';
export const iconRow = located(iconRowPart);
export const grid = located(containers.grid);
export const areas = located(containers.areas);

export type * from './dsl/connect.ts';
export const connect = located(connections.connect);
export const bracket = located(connections.bracket);
export const callout = located(connections.callout);
export const branch = located(connections.branch);

export type * from './dsl/figures.ts';
export const pyramid = located(figures.pyramid);
export const curve = located(figures.curve);
export const plane = located(figures.plane);
export const quadrant: typeof figures.quadrant = located(figures.quadrant);
export const chevron = located(figures.chevron);
export const funnel = located(figures.funnel);
export const cycle = located(figures.cycle);
export const valueChain = located(figures.valueChain);
export const venn = located(figures.venn);
export const concentric = located(figures.concentric);
export const emblem = located(figures.emblem);
export const wordart = located(figures.wordart);

export type * from './dsl/people-dots.ts';
export const people = located(peopleDots.people);
export const dots = located(peopleDots.dots);

export type * from './dsl/charts.ts';
export const waterfall = located(charts.waterfall);
export const pert = located(charts.pert);
export const causalLoop = located(charts.causalLoop);
export const dependencyNetwork = located(charts.dependencyNetwork);
export const radar = located(charts.radar);
export const lines = located(charts.lines);
export const strategyCanvas = located(charts.strategyCanvas);
export const burndown = located(charts.burndown);
export const burnup = located(charts.burnup);
export const sankey = located(charts.sankey);
export const treemap = located(charts.treemap);
export const stackedBars = located(charts.stackedBars);
export const mekko = located(charts.mekko);
export const heatmap = located(charts.heatmap);
export const tornado = located(charts.tornado);
export const bubble = located(charts.bubble);
export const butterfly = located(charts.butterfly);
export const combo = located(charts.combo);
export const harvey = located(charts.harvey);
export const compare = located(charts.compare);

export type * from './dsl/charts-stats.ts';
export const catplot = located(chartsStats.catplot);
export const boxplot = located(chartsStats.boxplot);
export const violinplot = located(chartsStats.violinplot);
export const stripplot = located(chartsStats.stripplot);
export const swarmplot = located(chartsStats.swarmplot);
export const pointplot = located(chartsStats.pointplot);
export const barplot = located(chartsStats.barplot);
export const displot = located(chartsStats.displot);
export const histplot = located(chartsStats.histplot);
export const kdeplot = located(chartsStats.kdeplot);
export const ecdfplot = located(chartsStats.ecdfplot);
export const rugplot = located(chartsStats.rugplot);
export const hist2d = located(chartsStats.hist2d);
export const jointplot = located(chartsStats.jointplot);
export const kde2d = located(chartsStats.kde2d);
export const pairplot = located(chartsStats.pairplot);
export const regplot = located(chartsStats.regplot);
export const residplot = located(chartsStats.residplot);
export const clustermap = located(chartsStats.clustermap);
export const facet = located(chartsStats.facet);

export type * from './dsl/bars.ts';
export const bars = located(barCharts.bars);
export const rangeBars = located(barCharts.rangeBars);
export const pareto = located(barCharts.pareto);
export const histogram = located(barCharts.histogram);
export const scatter = located(scatterBand);

export type * from './dsl/qc-semantic.ts';
export const controlChart = located(qcSemantic.controlChart);
export const xbarR = located(qcSemantic.xbarR);
export const checkSheet = located(qcSemantic.checkSheet);
export const matrix = located(qcSemantic.matrix);
export const raci = located(qcSemantic.raci);
export const fmea = located(qcSemantic.fmea);
export const isIsNot = located(qcSemantic.isIsNot);
export const isIsNotTests = located(qcSemantic.isIsNotTests);
export const whyWhyTable = located(qcSemantic.whyWhyTable);
export const qfd = located(qcSemantic.qfd);
export const journeyMap = located(qcSemantic.journeyMap);
export const canvas = located(canvasPart);

export type * from './dsl/diagrams.ts';
export {transitionUnits} from './dsl/diagrams.ts';
export const tree = located(diagrams.tree);
export const bpmn = located(diagrams.bpmn);
export const classDiagram = located(diagrams.classDiagram);
export const stateDiagram = located(diagrams.stateDiagram);
export const flowchart = located(diagrams.flowchart);
export const causeTree = located(diagrams.causeTree);
export const whyWhyTree = located(diagrams.whyWhyTree);
export const bowtie = located(diagrams.bowtie);
export type * from './dsl/comic.ts';
export type {ChatBand, ChatInput, ChatMessage, ChatOpts, ChatSheet} from './dsl/chat.ts';
export const chat = located(chats.chat);
export const comic = located(comics.comic);
export {speechBubble} from './dsl/comic.ts';
export const arrowDiagram = located(diagrams.arrowDiagram);
export const affinity = located(diagrams.affinity);
export const pdpc = located(diagrams.pdpc);
export const relationDiagram = located(diagrams.relationDiagram);
export const cloud = located(diagrams.cloud);
export const mindmap = located(diagrams.mindmap);
export const faultTree = located(diagrams.faultTree);

export type * from './dsl/timeline-gantt.ts';
export const gantt = located(timelineGantt.gantt);
export const timeline = located(timelineGantt.timeline);

export {versus} from './compose/versus.ts';

export const steps = located(stepsPart);

export const hero = located(heroPart);

export {styled} from './dsl/styled.ts';
export {rewrite, isType, within, when} from './dsl/rewrite.ts';
export type {BandPatch, RewriteFn, Predicate} from './dsl/rewrite.ts';
export {wf} from './wireframe.ts';
export {icon} from './icon-registry.ts';
export type {IconName, EmojiName} from './icons.ts';
export type {StepItem, StepsOpts} from './steps.ts';
export {em} from './rich.ts';
export type {HeroOpts, HeroStat} from './compose/hero.ts';
export type {VersusConnectLabels, VersusOpts, VersusPart, VersusSharedOpts} from './compose/versus.ts';
// Every public type (WfNode, TableCell, TextTone, RawColorTone, ...) so project code never has to spell Parameters<typeof wf.col>[0].
export type * from './types/index.ts';
export type * from './semantic-table.ts';
export type {QuadrantOpts, QuadrantItem, QuadrantPreset, QuadrantCell, QuadrantAxis, QuadrantArrow, QuadrantRegion} from './quadrant.ts';
export type {WordArtOpts, WordArtBand, WordArtPreset, OutlineSpec, ShadowSpec, GradientSpec, GlowSpec, ExtrudeSpec, ReflectionSpec, ArtTone} from './wordart.ts';
export type {FlowStep, ChevronOpts, FunnelStage, FunnelOpts, CycleOpts, VennSet, VennOverlap, VennOpts, ConcentricRing, ConcentricOpts, ConcentricSector, ConcentricRef, ConcentricPlace, ConcentricMark, CycleLink, EmblemItem, EmblemShape, EmblemOpts} from './flow-shapes.ts';
export {tally} from './qc-table.ts';
export type {CanvasContent, CanvasKey, CanvasOpts, CanvasTemplate} from './compose/canvas.ts';
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
export type {HarveyCell, HarveyOpts, HarveyRow} from './charts-harvey.ts';
export type {CompareCell, CompareOpts} from './charts-compare.ts';
export type {HeatmapOpts} from './charts-heatmap.ts';
export type {RadarOpts, RadarSeries} from './charts-radar.ts';
export type {BurndownSpec, BurnupSpec, LineSeries, LinesAnnotation, LinesAxis, LinesOpts, StrategyCanvasOpts} from './charts-lines.ts';
export type {SankeyLink, SankeyNode, SankeyOpts} from './charts-sankey.ts';
export type {TreemapNode, TreemapOpts} from './charts-treemap.ts';
export type {StackColumn, StackPart, StackedOpts} from './charts-stacked.ts';

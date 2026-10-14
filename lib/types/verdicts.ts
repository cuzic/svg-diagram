// Types: rules, verification, fit, budget.
import type {LaidOutConnect} from './containers.ts';
import type {DiagramData, Rect} from './core.ts';
import type {LaidOutBand, LaidOutDiagram} from './index.ts';

export type Severity = 'warn' | 'info';
/** One rule result (rules.ts). `rule` is a key of RULE_DOCS. */
/** What a machine reads about a finding (`check --format json`): the measured number against the threshold it was judged by, and how to fix it. */
export interface FindingData {band?: string; measured: number; threshold: number; fix?: string}
export interface Finding {rule: string; severity: Severity; message: string; data?: FindingData}
/** What the lint rules read: the diagram's bands plus (optionally) layout results. */
export interface LintTarget extends DiagramData {
  laidOut?: LaidOutBand[];
  connects?: LaidOutConnect[];
  contentHeight?: number;
}
/** verifyDiagram() result: `problems` fail the build, `warnings` never do. */
export interface Verdict {
  ok: boolean;
  problems: string[];
  warnings: string[];
  findings: Finding[];
}
/** A checkable rect in verify.ts (id null when the band has none). */
/** `holds`: ids of anchors drawn inside this rect (an image's marks): a connector that starts on one may cross the rect. `backdrop`: a picture with parts over it, not an obstacle or an overlap partner. */
/** `life`: when it is on screen, if not always (a bar that another `replaces` shares its place with it). */
export interface CheckRect extends Rect {id: string | null; label: string; life?: {reveal?: number; until?: number}; holds?: string[]; backdrop?: boolean}
export interface FitReport {
  scale: number;
  effectiveFont: number;
  recommendedMaxHeight: number;
  imgStyle: string;
  bannerHeight: number;
  warnings: string[];
  /** Present (true) only for doc-medium diagrams. */
  doc?: true;
}
export interface BudgetLimits {boxBody: number; total: number; boxes: number}
export interface BudgetMeasure {boxes: number; total: number; maxBody: {width: number; label: string}}
/** getSlideBudget() result. */
export interface SlideBudget {
  maxHeight: number;
  contentWidth: number;
  index: number;
  cached: boolean;
}
/** build() result. */
export interface BuildResult {
  outPath: string;
  /** The .html written beside the SVG (build(..., {html: true})). */
  htmlPath?: string;
  revealPaths: string[];
  width: number;
  height: number;
  fit: FitReport;
  budget: SlideBudget | null;
  fontScale: number | undefined;
  warnings: string[];
  findings: Finding[];
}
/** renderDiagram() result: everything build() knows before it touches the disk. */
export interface RenderResult {
  svg: string;
  /** The HTML/CSS rendering (lib/emit-html.ts); set only when renderDiagram() was asked for it. */
  html?: string;
  laidOut: LaidOutDiagram;
  verdict: Verdict;
  /** Problems that would keep an <img> from loading the SVG as XML (empty when well-formed). */
  xml: string[];
  /** Things the caller should tell the person (a slide budget that was not measured, ...). */
  notes: string[];
  width: number;
  height: number;
  fit: FitReport;
  budget: SlideBudget | null;
  /** Where the slide budget came from; null when the diagram names no slide. */
  budgetSource: 'measured' | 'cache' | 'default' | null;
  fontScale: number | undefined;
}
/** checkDiagram() result. */
export interface CheckResult {laidOut: LaidOutDiagram; verdict: Verdict}

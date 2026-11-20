// The frames of a Gantt chart and of a BPMN figure as PowerPoint tables, drawn as the svg draws them (emit-figures.ts renderGantt,
// renderBpmn). What sits in the frame (bars, milestones, today's line, the axis labels; events, tasks, gateways, flows) stays shapes
// drawn over the table (bands.ts), from the band's own svg with the frame left out (ganttMarks, bpmnMarks).
import {LINE_HEIGHT_EM} from '../layout-util.ts';
import {resolveBoxStyle} from '../emit-common.ts';
import type {ToneEnv} from '../tokens.ts';
import type {ChartTable, TableCell, TableRule} from '../charts-base.ts';
import type {Roles, Theme} from '../types/core.ts';
import type {LaidOutGantt} from '../types/timeline.ts';
import type {LaidOutBpmn} from '../types/diagrams.ts';

const near = (a: number, b: number): boolean => Math.abs(a - b) < 1;
const edgesOf = (xs: number[]): number[] => xs.toSorted((p, q) => p - q).filter((x, i, s) => i === 0 || !near(x, s[i - 1] as number));
const widths = (edges: number[]): number[] => edges.slice(1).map((x, i) => x - (edges[i] as number));

/** A row label of a Gantt chart: written left of the plot (the axis labels and today's are centred on their x). */
const isRowLabel = (b: LaidOutGantt, t: LaidOutGantt['texts'][number]): boolean => t.anchor === 'start' && t.x < b.plot.x1;

/**
 * The table of a Gantt chart's frame: a column for the row names, one per stretch between two ticks (a tick is the rule between two
 * columns), and the margin right of the plot; a header row (its plot cells ruled below, as the axis), one row per task or section (a
 * section's cells grey) and the padding under the plot.
 */
export function ganttTable(b: LaidOutGantt, roles: Roles): ChartTable {
  const {x1, x2, y1, y2} = b.plot, X = b.x + b.w;
  const edges = edgesOf([b.x, x1, x2, X, ...b.ticks.map(t => t.x).filter(x => x > x1 - 1 && x < x2 + 1)]);
  const n = edges.length - 1, nRows = b.sections.length + b.bars.length, rowH = nRows ? (y2 - y1) / nRows : 0, PAD = b.y + b.h - y2;
  const AXIS: TableRule = {stroke: 'muted', sw: 2}, TICK: TableRule = {stroke: 'border', sw: 1};
  const inPlot = (j: number): boolean => (edges[j] as number) >= x1 - 1 && (edges[j + 1] as number) <= x2 + 1;
  const tickAt = (x: number): boolean => b.ticks.some(t => near(t.x, x));
  const size = b.texts[0]?.size ?? roles.body, pitch = size * LINE_HEIGHT_EM;
  const cells: (TableCell | null)[][] = [], heights: number[] = [];
  const blank = (extra: Partial<TableCell> = {}): TableCell => ({lines: [], align: 'start', valign: 'top', ink: 'text', ...extra});
  cells.push(Array.from({length: n}, (_, j) => blank(inPlot(j) ? {b: AXIS} : {}))); heights.push(y1 - b.y);
  for (let i = 0; i < nRows; i++) {
    const ry = y1 + i * rowH, section = b.sections.some(s => near(s.y, ry));
    const label = b.texts.find(t => isRowLabel(b, t) && t.y > ry && t.y <= ry + rowH);
    const fill = section ? {fill: {key: 'code' as const}} : {};
    cells.push(Array.from({length: n}, (_, j): TableCell => {
      const l = j > 0 && tickAt(edges[j] as number) ? TICK : undefined, r = j < n - 1 && tickAt(edges[j + 1] as number) ? TICK : undefined;
      const rules = {...(l ? {l} : {}), ...(r ? {r} : {}), ...(i === 0 && inPlot(j) ? {t: AXIS} : {})};
      if (j > 0 || !label) return blank({...fill, ...rules});
      // the label's baseline where the svg puts it: PowerPoint puts a line's baseline 0.8 of its pitch below its top
      return {lines: [label.text], align: 'start', valign: 'top', ink: 'text', bold: label.bold, size: label.size, pitch: label.size * LINE_HEIGHT_EM,
        padX: label.x - b.x, padY: Math.max(0, label.y - label.size * LINE_HEIGHT_EM * 0.8 - ry), ...fill, ...rules};
    }));
    heights.push(rowH);
  }
  if (PAD > 0.5) { cells.push(Array.from({length: n}, () => blank())); heights.push(PAD); }
  return {x: b.x, y: b.y, colW: widths(edges), rowH: heights, cells, size, pitch};
}

/** The Gantt chart as drawn over its table: no section strips, tick lines, axis line or row names. */
export const ganttMarks = (b: LaidOutGantt): LaidOutGantt => ({...b, frame: false, sections: [], ticks: [], texts: b.texts.filter(t => !isRowLabel(b, t))});

/** Whether a BPMN figure's lanes make one table: side by side (vertical) or stacked (horizontal), with no gap between them. */
const lanesTile = (b: LaidOutBpmn): boolean => b.lanes.length > 0 && b.lanes.every((l, i) => {
  const p = b.lanes[i - 1];
  if (!p) return true;
  return b.dir === 'v' ? near(p.x + p.w, l.x) && near(p.y, l.y) && near(p.h, l.h) : near(p.y + p.h, l.y) && near(p.x, l.x) && near(p.w, l.w);
});

/** The lane names: the bold lines written in a lane's name column (or header). */
const laneNameOf = (l: LaidOutBpmn['lanes'][number], t: LaidOutBpmn['texts'][number]): boolean => t.bold && (l.labelH === undefined
  ? t.x >= l.x && t.x <= l.x + l.labelW && t.y > l.y && t.y <= l.y + l.h
  : t.x >= l.x && t.x <= l.x + l.w && t.y > l.y && t.y <= l.y + l.labelH);

/**
 * The table of a BPMN figure's lanes: a horizontal one is a row per lane (its name cell grey, then its body), a vertical one a column per
 * lane (its name cell on top). Every side ruled grey as the svg draws each lane's outline. Undefined when the lanes do not tile.
 */
export function bpmnTable(b: LaidOutBpmn, roles: Roles, tones: ToneEnv, day: Theme): ChartTable | undefined {
  if (!lanesTile(b)) return undefined;
  const RULE: TableRule = {stroke: 'muted', sw: 2}, all = {l: RULE, r: RULE, t: RULE, b: RULE};
  const size = roles.body, pitch = Math.round(size * 1.4);
  const name = (l: LaidOutBpmn['lanes'][number]): TableCell => ({lines: b.texts.filter(t => laneNameOf(l, t)).map(t => t.text), align: 'middle', valign: 'middle',
    ink: 'text', bold: true, size, pitch, fill: {key: 'code'}, ...all});
  const body = (l: LaidOutBpmn['lanes'][number]): TableCell => ({lines: [], align: 'middle', valign: 'middle', ink: 'text',
    fill: {key: l.tone === 'plain' ? 'bg' : resolveBoxStyle(tones, l.tone, day).fill as `#${string}`}, ...all});
  const first = b.lanes[0];
  if (!first) return undefined;
  if (b.dir === 'v') {
    const head = first.labelH ?? 0;
    return {x: first.x, y: first.y, colW: b.lanes.map(l => l.w), rowH: [head, first.h - head], cells: [b.lanes.map(name), b.lanes.map(body)], size, pitch};
  }
  return {x: first.x, y: first.y, colW: [first.labelW, first.w - first.labelW], rowH: b.lanes.map(l => l.h), cells: b.lanes.map(l => [name(l), body(l)]), size, pitch};
}

/** The BPMN figure as drawn over its table: no lanes, no lane names. */
export const bpmnMarks = (b: LaidOutBpmn): LaidOutBpmn => ({...b, lanes: [], texts: b.texts.filter(t => !b.lanes.some(l => laneNameOf(l, t)))});

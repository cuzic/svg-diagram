import {must} from './must.ts';
import {partStep} from './parts.ts';
import type {LaidOutChartPart, ChartGeom} from './charts-base.ts';
import {checkIds, numText} from './charts-base.ts';
import {textWidth} from './atoms.ts';
import {analyzeCriticalPath} from './semnet-analysis.ts';
import type {PertAnalysis, PertTask} from './semnet-analysis.ts';
import {arrow, direction, straightenOf, networkCanvas, nodeBox, pathOf} from './semnet-common.ts';
import type {SemnetDirection, SemnetOpts} from './semnet-common.ts';

/** `durationLabel` / `slackLabel`: the words before a task's duration and slack (default 期間 / 余裕). */
export interface PertOpts extends SemnetOpts {unit?: string; compact?: boolean; durationLabel?: string; slackLabel?: string}
export interface PertSpec {tasks: PertTask[]; analysis: PertAnalysis; direction: SemnetDirection; unit: string; compact: boolean; straighten: boolean; durationLabel: string; slackLabel: string}

export function resolvePert(tasks: readonly PertTask[], opts: PertOpts = {}): PertSpec {
  const analysis = analyzeCriticalPath(tasks);
  checkIds('pert', tasks.map(t => t.id), opts.id);
  return {tasks: tasks.map(t => ({...t, predecessors: [...(t.predecessors ?? [])]})), analysis, direction: direction('pert', opts.direction), unit: opts.unit ?? '', compact: !!opts.compact, durationLabel: opts.durationLabel ?? '期間', slackLabel: opts.slackLabel ?? '余裕', straighten: straightenOf('pert', opts.straighten)};
}

export const pertAlt = (s: PertSpec): string => `PERT network. Project duration ${numText(s.analysis.duration)}${s.unit}. Critical path: ${s.analysis.criticalPath.join(' → ')}. ${s.analysis.tasks.map(t => `${t.label}: duration ${numText(t.duration)}, ES ${numText(t.es)}, EF ${numText(t.ef)}, LS ${numText(t.ls)}, LF ${numText(t.lf)}, slack ${numText(t.slack)}`).join('; ')}`;

export function pertTexts(s: PertSpec): [string, number][] {
  return s.analysis.tasks.flatMap(t => [[t.label, 700], ...(s.compact ? [[`${numText(t.duration)}${s.unit} / ${s.slackLabel} ${numText(t.slack)}`, 400]] : [[`ES ${numText(t.es)}`, 400], [`EF ${numText(t.ef)}`, 400], [`LS ${numText(t.ls)}`, 400], [`LF ${numText(t.lf)}`, 400], [`${s.durationLabel} ${numText(t.duration)}${s.unit} ・ ${s.slackLabel} ${numText(t.slack)}`, t.critical ? 700 : 400]])] as [string, number][]);
}

export function layoutPert(s: PertSpec, g: ChartGeom): LaidOutChartPart {
  const w = Math.round((s.compact ? 126 : 154) * (g.geom ?? 1)), h = Math.round((s.compact ? 64 : 104) * (g.geom ?? 1)), ns = s.analysis.tasks.map(t => ({id: t.id, label: t.label, w: Math.max(w, textWidth(g.widthOf, t.label, g.size, 700) + 24), h}));
  const es = s.analysis.tasks.flatMap(t => t.predecessors.map(p => ({from: p, to: t.id}))), {c, positions, paths} = networkCanvas(g, ns, es, s.direction, 0, s.straighten);
  es.forEach((e, i) => { const critical = s.analysis.criticalEdges.some(x => x.from === e.from && x.to === e.to); arrow(c, pathOf(paths, i, e, positions), {stroke: critical ? 'danger' : 'muted', sw: critical ? 4 : 2, edge: e}); });
  // ADR 0054: a task (its box, the critical path's frame and its lines of text) is one part
  for (const t of s.analysis.tasks) c.withPart(partStep('task', t.id, t.label), () => {
    const p = must(positions.get(t.id)), host = nodeBox(c, p, t.id, t.label, t.critical ? 'danger' : 'text', t.critical), cx = p.x + p.w / 2;
    c.text(t.label, cx, p.y + g.size + 8, 'middle', 'text', {bold: true, host, of: t.id});
    if (s.compact) c.text(`${numText(t.duration)}${s.unit} / ${s.slackLabel} ${numText(t.slack)}`, cx, p.y + p.h - 10, 'middle', t.critical ? 'danger' : 'muted', {host, of: t.id});
    else {
      const y = p.y + 2 * g.size + 14, left = p.x + 9, right = p.x + p.w - 9;
      c.text(`ES ${numText(t.es)}`, left, y, 'start', 'muted', {host, of: t.id}); c.text(`EF ${numText(t.ef)}`, right, y, 'end', 'muted', {host, of: t.id});
      c.text(`LS ${numText(t.ls)}`, left, y + c.lineH(), 'start', 'muted', {host, of: t.id}); c.text(`LF ${numText(t.lf)}`, right, y + c.lineH(), 'end', 'muted', {host, of: t.id});
      c.text(`${s.durationLabel} ${numText(t.duration)}${s.unit} ・ ${s.slackLabel} ${numText(t.slack)}`, cx, p.y + p.h - 8, 'middle', t.critical ? 'danger' : 'text', {bold: t.critical, host, of: t.id});
    }
  });
  return c.done();
}

import {at} from './finding-rules.ts';
import {laneStepOf} from './layered-route.ts';
import {parallelRuns} from './polyline-metrics.ts';
import {canvasFontScale} from './tokens.ts';
import {causeBandsOf} from './verify-density.ts';
import type {LaidOutDiagram} from './types/index.ts';
import type {Finding} from './types/verdicts.ts';

// ---- edge-parallel (ADR 0070 D2) ---------------------------------------------------------------------------------------------
// Runs of two arrows side by side closer than the lane step, the gap the router keeps between its lanes: a bundle of such lines cannot be
// followed. Only a cause tree's band (no `origin`): the other routed figures keep short runs at the port step by design (states / classes
// shrink their ports on a short side, so the last run of a fan-in always counts). Arrows that share a tail or a head count too.
export function parallelEdgeFindings(d: Partial<Pick<LaidOutDiagram, 'laidOut' | 'density' | 'canvas' | 'layoutCheck'>>): Finding[] {
  if (!d.laidOut) return [];
  const out: Finding[] = [];
  const severity = d.layoutCheck === 'strict' ? 'warn' : 'info';
  for (const band of causeBandsOf(d.laidOut)) {
    if (band.origin !== undefined) continue;
    // ADR 0070 D7 (U5): on a canvas the lines scale with the text (`WrapEnv.lineScale`), so the lane step does too; a band drawn with the old lines (`lineScaleDropped`) is measured at the scaled step as well, and is reported when it is crowded
    const sep = laneStepOf((d.density === 'compact' && !band.densityRestored ? 0.75 : 1) * (d.canvas ? Math.max(1, canvasFontScale(d.canvas.minText)) : 1));
    const edges = band.edges.filter(e => e.from !== e.to && e.points.length >= 2);
    const pairs = parallelRuns(edges.map(e => e.points), sep).sort((p, q) => q.overlap - p.overlap);
    const total = Math.round(pairs.reduce((n, p) => n + p.overlap, 0));
    if (total <= 2 * sep) continue;
    const name = `cause${band.id ? ` ${band.id}` : ''}`;
    const arrow = (i: number): string => { const e = edges[i] as {from: string; to: string}; return `${e.from} → ${e.to}`; };
    const worst = pairs.slice(0, 3).map(p => `${arrow(p.a)} と ${arrow(p.b)}（間隔 ${Math.round(p.gap)}px、${Math.round(p.overlap)}px）`).join('、');
    out.push({...at(band), rule: 'edge-parallel', severity, message: `${name}: 矢印どうしが ${sep}px より近くで並ぶ所が ${pairs.length} 組、計 ${total}px（${worst}${pairs.length > 3 ? ' ほか' : ''}）。平行線の束はたどれない`, data: {band: name, measured: total, threshold: 2 * sep, fix: "前提条件を行き先の近くに置く（causeTree({tree: 'crt'}) の既定、または layer: 'alap'）、層を飛ぶ矢印を減らす。意図した形なら accept で許容する"}});
  }
  return out;
}

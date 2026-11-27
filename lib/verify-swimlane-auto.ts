import {must} from './must.ts';
import type {LaidOutBpmn} from './types/diagrams.ts';
import {dxdy, rectOverlap, routeHits, routesThroughNodes} from './verify-base.ts';

// A flow must not run through a node it does not touch; flow labels must stay clear of nodes and each other.
export function swimlaneAutoProblems(band: LaidOutBpmn): string[] {
  const problems: string[] = [];
  problems.push(...routesThroughNodes(band.edges, band.anchors, (e, n) => `bpmn: flow ${e.from} -> ${e.to} runs through "${n.id}" (move a node to another lane, or reorder the flow)`));
  // the text of an event / gateway (and a task's name): inside the figure and clear of the lane names, of every flow, and of the other nodes
  for (const b of band.labelBoxes) {
    if (band.anchors.some(a => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h)) continue; // a node's own box
    if (b.x < band.x + (band.lanes[0]?.labelW ?? 0) - 0.5 || b.x + b.w > band.x + band.w + 0.5 || b.y < band.y + (band.lanes[0]?.labelH ?? 0) - 0.5 || b.y + b.h > band.y + band.h + 0.5) problems.push(`bpmn: the text "${b.label}" runs outside its lane area (shorten it, or widen the figure)`);
    for (const n of band.anchors) if (rectOverlap(b, n)) problems.push(`bpmn: the text "${b.label}" overlaps "${n.id}"`);
    for (const e of band.edges) if (routeHits(e.points, b) && !band.labels.some(l => l.x === b.x && l.y === b.y)) problems.push(`bpmn: the text "${b.label}" is crossed by the flow ${e.from} -> ${e.to}`);
  }
  for (const [i, l] of band.labels.entries()) {
    band.edges.forEach((e, k) => { // the chip is white: on another flow it would cut it
      if (k !== l.edge && routeHits(e.points, l)) problems.push(`bpmn: label "${l.text}" sits on the flow ${e.from} -> ${e.to} (it belongs to another flow)`);
    });
    for (const n of band.anchors) if (rectOverlap(l, n)) problems.push(`bpmn: label "${l.text}" overlaps "${n.id}"`);
    for (let j = i + 1; j < band.labels.length; j++) {
      const o = rectOverlap(l, must(band.labels[j]));
      if (o) problems.push(`bpmn: label "${l.text}" overlaps label "${must(band.labels[j]).text}" by ${dxdy(o)}`);
    }
  }
  return problems;
}

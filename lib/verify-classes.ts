import {must} from './must.ts';
import type {LaidOutClasses} from './types/diagrams.ts';
import {dxdy, outsideX, rectOverlap, routeHits, routesThroughNodes} from './verify-base.ts';

// Relations must not run through a class they do not touch; labels and multiplicities must stay clear of classes and each other.
export function classesProblems(band: LaidOutClasses): string[] {
  const problems: string[] = [];
  problems.push(...routesThroughNodes(band.edges, band.anchors, (e, n) => `classes: relation ${e.from} -> ${e.to} runs through class "${n.id}" (reorder the classes, or change dir)`));
  for (const [i, l] of band.labels.entries()) {
    if (outsideX(l, band)) problems.push(`classes: label "${l.text}" runs outside the figure`);
    for (const n of band.anchors) if (rectOverlap(l, n)) problems.push(`classes: label "${l.text}" overlaps class "${n.id}"`);
    band.edges.forEach((e, k) => { // the chip is white: on another relation it would cut it
      if (k !== l.edge && routeHits(e.points, l)) problems.push(`classes: label "${l.text}" sits on the relation ${e.from} -> ${e.to} (it belongs to another relation)`);
    });
    for (let j = i + 1; j < band.labels.length; j++) {
      const o = rectOverlap(l, must(band.labels[j]));
      if (o) problems.push(`classes: label "${l.text}" overlaps label "${must(band.labels[j]).text}" by ${dxdy(o)}`);
    }
  }
  return problems;
}

import {must} from './must.ts';
import type {LaidOutCloud} from './types/diagrams.ts';
import type {CheckRect} from './types/verdicts.ts';
import {outsideX, rectOverlap, routeHits} from './verify-base.ts';

// The numbers on a cloud's arrows must clear the boxes and each other, and stay inside the figure.
export function cloudProblems(band: LaidOutCloud): string[] {
  const problems: string[] = [];
  for (const [i, c] of band.chips.entries()) {
    if (outsideX(c, band)) problems.push(`cloud: the number "${c.text}" on the ${c.arrow} arrow runs outside the figure`);
    for (const n of band.nodes) if (rectOverlap(c, n)) problems.push(`cloud: the number "${c.text}" on the ${c.arrow} arrow overlaps box ${n.key.toUpperCase()} (fewer assumptions on one arrow, or a wider figure)`);
    for (const e of band.edges) if (e.arrow !== c.arrow && routeHits(e.points, c)) problems.push(`cloud: ${c.conflict ? 'the conflict label' : `the number "${c.text}"`} sits on the ${e.arrow} arrow (shorten it)`);
    for (let j = i + 1; j < band.chips.length; j++) if (rectOverlap(c, must(band.chips[j]))) problems.push(`cloud: ${c.conflict || must(band.chips[j]).conflict ? 'the conflict label and the numbers' : `the numbers on the ${c.arrow} and ${must(band.chips[j]).arrow} arrows`} overlap`);
  }
  return problems;
}

export function cloudRects(band: LaidOutCloud): CheckRect[] {
  return band.nodes.map(n => ({id: n.id ?? null, label: n.id ?? `cloud box ${n.key.toUpperCase()}`, x: n.x, y: n.y, w: n.w, h: n.h, ...(band.id ? {holds: [band.id]} : {})}));
}

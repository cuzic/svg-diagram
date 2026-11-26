import type {LaidOutFlowShape} from './flow-shapes.ts';
import {dxdy, eachOverlap, outsideBox} from './verify-base.ts';

export function flowProblems(band: LaidOutFlowShape): string[] {
  const problems: string[] = [];
  for (const t of band.labelBoxes) if (outsideBox(t, band)) problems.push(`${band.type}: label "${t.label}" runs outside the figure`);
  eachOverlap(band.labelBoxes, (a, b, o) => { if (o.dx > 1 && o.dy > 1) problems.push(`${band.type}: label "${a.label}" overlaps label "${b.label}" by ${dxdy(o)}`); });
  for (const name of band.misfits ?? []) problems.push(`${band.type}: the title and items of set "${name}" do not fit inside its circle; use fewer or shorter items, drop the items, or make the figure wider`);
  return problems;
}

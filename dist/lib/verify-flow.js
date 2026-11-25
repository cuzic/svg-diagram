import { dxdy, eachOverlap, outsideBox } from './verify-base.js';
export function flowProblems(band) {
    const problems = [];
    for (const t of band.labelBoxes)
        if (outsideBox(t, band))
            problems.push(`${band.type}: label "${t.label}" runs outside the figure`);
    eachOverlap(band.labelBoxes, (a, b, o) => { if (o.dx > 1 && o.dy > 1)
        problems.push(`${band.type}: label "${a.label}" overlaps label "${b.label}" by ${dxdy(o)}`); });
    return problems;
}

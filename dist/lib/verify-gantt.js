import { must } from './must.js';
import { dxdy, outsideX, rectOverlap, routeHits } from './verify-base.js';
// A gantt's texts must stay inside the figure and apart (the today label against the tick labels, a long tick against the edge).
export function ganttProblems(band) {
    const problems = [];
    for (const d of band.deps) { // a dependency arrow must not run through the bar of a task it does not join
        for (const [k, bar] of band.bars.entries()) {
            if (k === d.from || k === d.to)
                continue;
            if (routeHits(d.points, bar))
                problems.push(`gantt: the arrow "${must(band.bars[d.from]).label}" -> "${must(band.bars[d.to]).label}" runs through the bar "${bar.label}" (reorder the rows, or drop the dependency)`);
        }
    }
    for (const [i, b] of band.labelBoxes.entries()) {
        if (outsideX(b, band))
            problems.push(`gantt: label "${b.label}" runs outside the figure (shorten it or widen the figure)`);
        for (let j = i + 1; j < band.labelBoxes.length; j++) {
            const o = rectOverlap(b, must(band.labelBoxes[j]));
            if (o)
                problems.push(`gantt: label "${b.label}" overlaps label "${must(band.labelBoxes[j]).label}" by ${dxdy(o)}`);
        }
    }
    return problems;
}

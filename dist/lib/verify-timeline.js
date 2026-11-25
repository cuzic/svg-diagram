import { must } from './must.js';
import { dxdy, outsideX, rectOverlap } from './verify-base.js';
export function timelineProblems(band) {
    const problems = [];
    const line = band.fullLine && { x: band.fullLine.x - 1, y: band.fullLine.y1, w: 2, h: band.fullLine.y2 - band.fullLine.y1 };
    for (const [i, b] of band.labelBoxes.entries()) {
        if (line && rectOverlap(b, line))
            problems.push(`timeline: label "${b.label}" is crossed by the deadline line (move the mark or change the axis range)`);
        if (outsideX(b, band))
            problems.push(`timeline: label "${b.label}" runs outside the figure (shorten it or widen the figure)`);
        for (let j = i + 1; j < band.labelBoxes.length; j++) {
            const o = rectOverlap(b, must(band.labelBoxes[j]));
            if (o)
                problems.push(`timeline: label "${b.label}" overlaps label "${must(band.labelBoxes[j]).label}" by ${dxdy(o)}`);
        }
    }
    return problems;
}

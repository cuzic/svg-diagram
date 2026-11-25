import { dxdy, eachOverlap, outsideBox, rectOverlap } from './verify-base.js';
// plane(): every label it placed must stay inside the figure and clear of the other labels.
export function planeProblems(band) {
    const problems = [];
    const boxes = band.labelBoxes, fig = band.bounds;
    for (const b of boxes) {
        if (outsideBox(b, fig))
            problems.push(`plane: label "${b.label}" runs outside the figure (move its point, change labelAt / side, or enlarge the figure)`);
    }
    eachOverlap(boxes, (a, b, o) => problems.push(`plane: label "${a.label}" overlaps label "${b.label}" by ${dxdy(o)} (change labelAt / side)`));
    problems.push(...(band.clashes ?? []));
    (band.paths ?? []).forEach((pa, i) => {
        if (pa.overshoot > 1.5)
            problems.push(`plane: path ${i + 1} leaves the axes by ${Math.round(pa.overshoot)}px (a curve through these points swings outside the plot; use smooth: false, add points, or widen the axis range)`);
    });
    // a label must not sit on the plane's ink either: an axis or its arrowhead, a tick mark, a point, a guide or a dimension line
    for (const b of boxes) {
        const hit = new Map();
        for (const ob of band.obstacles) {
            if (ob.dim !== undefined && ob.dim === b.dim)
                continue; // a dimension's own label sits on its own line
            const o = rectOverlap(b, ob);
            if (o && !hit.has(ob.what))
                hit.set(ob.what, o);
        }
        for (const [what, o] of hit)
            problems.push(`plane: label "${b.label}" overlaps ${what} by ${dxdy(o)} (move the label: labelAt / side / offset / anchor)`);
    }
    return problems;
}

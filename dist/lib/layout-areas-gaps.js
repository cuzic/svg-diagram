import { areasColumns } from './areas.js';
import { canvasSpan } from './canvas.js';
import { parseRef } from './connect-geometry.js';
import { ceil4, labelRoom } from './connect-rules.js';
import { CANVAS_MIN_REGION_W, topIcon } from './layout-util.js';
import { must } from './must.js';
/** Widen gaps between areas when an unobstructed connector needs label room. */
function areasLabelGaps(band, cw, { labelled, idsIn, nodeDrop, onFrame, roles, widthOf }) {
    let gap = band.gap, rowGap = band.rowGap;
    const pairs = []; // the side-by-side pairs, checked again at the final gap
    if (labelled.length) {
        const ids = band.children.map(c => idsIn(c)), place = band.place;
        const cellAt = new Map(); // `${row}/${col}` -> the area there (missing: an empty cell)
        place.forEach((p, i) => { for (let r = p.row; r < p.row + p.rs; r++)
            for (let c = p.col; c < p.col + p.cs; c++)
                cellAt.set(`${r}/${c}`, i); });
        const empty = (rows, cols) => {
            for (let r = rows[0]; r < rows[1]; r++)
                for (let c = cols[0]; c < cols[1]; c++)
                    if (cellAt.has(`${r}/${c}`))
                        return false;
            return true;
        };
        const overlap = (a0, an, b0, bn) => [Math.max(a0, b0), Math.min(a0 + an, b0 + bn)];
        const span = (g, i) => canvasSpan(areasColumns(band.colW, 0, cw, g), must(place[i]));
        // the distance between area `lo` (left) and `hi` (right) at gap g, spacer columns included
        const distance = (g, lo, hi) => { const a = span(g, lo), b = span(g, hi); return b.x - (a.x + a.w); };
        const isBox = (i, id) => { const c = band.children[i]; return c?.type === 'box' && c.id === id; };
        for (const c of labelled) {
            const f = parseRef(c.from), t = parseRef(c.to);
            const i = ids.findIndex(k => k.has(f.id)), j = ids.findIndex(k => k.has(t.id));
            if (i < 0 || j < 0 || i === j)
                continue;
            const a = must(place[i]), b = must(place[j]);
            const rows = overlap(a.row, a.rs, b.row, b.rs), cols = overlap(a.col, a.cs, b.col, b.cs);
            const across = rows[0] < rows[1] && ((f.side === 'right' && t.side === 'left' && a.col + a.cs <= b.col) || (f.side === 'left' && t.side === 'right' && b.col + b.cs <= a.col));
            const down = cols[0] < cols[1] && ((f.side === 'bottom' && t.side === 'top' && a.row + a.rs <= b.row) || (f.side === 'top' && t.side === 'bottom' && b.row + b.rs <= a.row));
            if (across) {
                const [lo, hi] = a.col < b.col ? [i, j] : [j, i], L = must(place[lo]), H = must(place[hi]);
                if (!empty(rows, [L.col + L.cs, H.col]))
                    continue;
                const need = labelRoom(c.label, c.chip, 'horizontal', c.labelAt, roles, widthOf);
                if (!Number.isFinite(need))
                    continue;
                pairs.push({ lo, hi, need });
                if (distance(band.gap, lo, hi) >= need)
                    continue; // a figure that leaves the room keeps its gap
                // the distance is linear in the gap: (k + 1) gaps and the spacer columns' share of what the gaps leave
                const k = H.col - L.col - L.cs, n = band.colW.length, total = band.colW.reduce((x, y) => x + y, 0);
                const share = band.colW.slice(L.col + L.cs, H.col).reduce((x, y) => x + y, 0) / total, per = k + 1 - share * (n - 1);
                let g = per > 0 ? Math.max(band.gap, ceil4((need - share * cw) / per)) : band.gap;
                while (g < cw && distance(g, lo, hi) < need)
                    g += 4; // the columns are whole 4px steps: add a step until the real distance is enough
                gap = Math.max(gap, g);
            }
            else if (down) {
                const [hiI, loI] = a.row < b.row ? [i, j] : [j, i], U = must(place[hiI]), D = must(place[loI]);
                if (!empty([U.row + U.rs, D.row], cols))
                    continue;
                const [top, bottom] = a.row < b.row ? [f, t] : [t, f];
                // two boxes placed directly in areas of the same columns, joined at the same `@t`, are joined by a vertical line; a node (icon
                // above its text) only at its middle. Anything else is 'slanted' (the safe side), as in D1's stacks.
                const vertical = isBox(hiI, top.id) && isBox(loI, bottom.id) && U.col === D.col && U.cs === D.cs && top.at === bottom.at
                    && (top.at === 0.5 || (!topIcon(band.children[hiI]) && !topIcon(band.children[loI])));
                const axis = vertical ? 'vertical' : 'slanted';
                // rows between the two (filled in other columns): their heights add to the route but are not known before layout, so such a
                // pair is not widened (the checks report it if it is still short)
                if (D.row > U.row + U.rs)
                    continue;
                const drop = nodeDrop(band.children[loI], a.row < b.row ? t : f, c.labelAt, a.row < b.row, onFrame(c, a.row < b.row ? 'to' : 'from'));
                const need = labelRoom(c.label, c.chip, axis, c.labelAt, roles, widthOf) + drop, fails = labelRoom(c.label, c.chip, axis, c.labelAt, roles, widthOf, 0) + drop;
                // the rows are on the 4px grid, so the route is the row gap (plus how deep the ends sit in their areas). A gap the checks already
                // pass stays as it is; one that does not grows to the room with its margin.
                if (Number.isFinite(need) && band.rowGap < fails)
                    rowGap = Math.max(rowGap, ceil4(need));
            }
        }
        // growing the column gap must not squeeze an area: each keeps >= 70% of its width (and the 96px every area needs), or the gap stays as
        // declared (the checks report the label, with the gap it needs)
        // a wider gap can take a step off a spacer column (areasColumns cuts every column to whole steps): every pair must fit at the final gap
        if (gap !== band.gap)
            while (gap < cw && pairs.some(q => distance(gap, q.lo, q.hi) < q.need))
                gap += 4;
        if (gap !== band.gap) {
            const fits = place.every((_p, i) => { const before = span(band.gap, i).w, after = span(gap, i).w; return after >= Math.max(0.7 * before, Math.min(before, CANVAS_MIN_REGION_W)); });
            if (!fits)
                gap = band.gap;
        }
    }
    return { gap, rowGap };
}
function areasGroupWidths(band, width, gap) {
    const columns = areasColumns(band.colW, 0, width, gap);
    return band.children.flatMap((child, i) => child.type === 'group'
        ? [{ children: child.children, width: canvasSpan(columns, must(band.place[i])).w - 2 * (child.pad ?? 16) }]
        : []);
}
export const areasPrelayout = { labelGaps: areasLabelGaps, groupWidths: areasGroupWidths };

// Pre-render structural verification of a layoutDiagram() result — runs
// BEFORE emitSvg(), using only the geometry/colors layout.ts already
// computed. Catches sibling/neighbor overlap, canvas-bounds overflow, and
// low-contrast tone combinations without spinning up a Chromium render pass
// at all.
//
// This exists because a real bug found during Phase 2 development (a
// connect() loop-under return path silently overlapping the following
// banner) was only caught by lint-svg.ts's post-render heuristic check —
// but the layout engine already had every number needed to catch it
// instantly, it just wasn't asked to. Text-overflowing-its-own-box is NOT
// checked here because it's structurally impossible for box()/banner()/
// caption() content: a band's height is *derived from* its own wrapped
// text, not guessed independently of it (see layout.ts's
// layoutBoxContent) — there is no code path that can produce a box shorter
// than its own content.
//
// What this can't see: the actual drawn contents of raw() (only its
// self-reported x/y/w/h is checked against neighbors, not what's actually
// inside), and real browser font-rendering quirks (inter-atom kerning we
// assumed was ~0 for CJK, subpixel rounding). lint-svg.ts's Playwright-
// based render check stays as the final safety net for exactly those two
// gaps — verify() is the fast, primary check; lint is the backstop.
import { PALETTE, luminance } from './tokens.js';
import { resolveTextColor, resolveBoxStyle } from './emit.js';
import { lintDiagram } from './rules.js';
const CONTRAST_THRESHOLD = 70; // same threshold lint-svg.ts's own contrast check uses
// Returns the overlap {dx,dy} if two rects share more than `tolerance`px of
// area in both axes, else null. Rects that merely touch at a shared edge
// (adjacent row children, a box and the row's own bounding rect) are not
// overlaps.
function rectOverlap(a, b, tolerance = 0.5) {
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (ox <= tolerance || oy <= tolerance)
        return null;
    return { dx: ox, dy: oy };
}
function labelOf(band) {
    // bands name themselves differently (box title, banner headline, caption text, or just an id)
    const b = band;
    return b.title ?? b.headline ?? b.id ?? b.text ?? '(band)';
}
// Every checkable rect: standalone box/banner, row/grid children, raw()'s
// self-reported bounds. Captions are skipped (no background, and their
// width is already wrap-constrained so there's nothing new to check).
function collectRects(d) {
    const rects = [];
    for (const band of d.laidOut) {
        if (band.type === 'screens') { // check each screen frame, not the bounding box that holds them all
            for (const a of band.anchors)
                rects.push({ id: a.id, label: a.id, x: a.x, y: a.y, w: a.w, h: a.h });
        }
        else if (band.type === 'caption' && band.inkBox) { // a group's title text: connectors must not run through it
            rects.push({ id: null, label: `group title "${band.text}"`, ...band.inkBox });
        }
        else if (band.type === 'row' || band.type === 'grid') {
            for (const c of band.children)
                rects.push({ id: c.id ?? null, label: labelOf(c), x: c.x, y: c.y, w: c.w, h: c.h });
        }
        else if (band.type === 'box' || band.type === 'banner' || band.type === 'raw' || band.type === 'legend' || band.type === 'sequence' || band.type === 'table' || band.type === 'wireframe' || band.type === 'pyramid' || band.type === 'curve') {
            rects.push({ id: ('id' in band ? band.id : undefined) ?? null, label: labelOf(band), x: band.x, y: band.y, w: band.w, h: band.h });
        }
    }
    return rects;
}
function checkOverlaps(rects) {
    const problems = [];
    for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
            const o = rectOverlap(rects[i], rects[j]);
            if (o)
                problems.push(`"${rects[i].label}" overlaps "${rects[j].label}" by ${Math.round(o.dx)}x${Math.round(o.dy)}px`);
        }
    }
    return problems;
}
// A connect()'s path/label are allowed to touch or start from their own
// endpoint boxes (that's the whole point) — only flag collision with
// anything ELSE.
function checkConnects(d, rects) {
    const problems = [];
    for (const c of d.connects) {
        const isOwnEndpoint = (r) => r.id !== null && (r.id === c.fromId || r.id === c.toId);
        for (const r of rects) {
            if (isOwnEndpoint(r)) {
                // The path starts on its own boxes, but the label/chip must not sit on top of their text:
                // a chip wider than the gap between two boxes lands on both bodies.
                const own = c.labelBox && rectOverlap(c.labelBox, r);
                if (own)
                    problems.push(`connect(${c.fromLabel} -> ${c.toLabel}) label "${c.label}" overlaps its own end "${r.label}" by ${Math.round(own.dx)}x${Math.round(own.dy)}px (widen the gap between the boxes, shorten the label, or label a longer leg with route: 'elbow')`);
                continue;
            }
            for (const seg of c.pathSegments) {
                const pathHit = rectOverlap(seg, r);
                if (pathHit)
                    problems.push(`connect(${c.fromLabel} -> ${c.toLabel}) path overlaps "${r.label}" by ${Math.round(pathHit.dx)}x${Math.round(pathHit.dy)}px`);
            }
            if (c.labelBox) {
                const labelHit = rectOverlap(c.labelBox, r);
                if (labelHit)
                    problems.push(`connect(${c.fromLabel} -> ${c.toLabel}) label "${c.label}" overlaps "${r.label}" by ${Math.round(labelHit.dx)}x${Math.round(labelHit.dy)}px`);
            }
        }
    }
    return problems;
}
function checkBounds(d, rects) {
    const problems = [];
    const eps = 0.5;
    for (const r of rects) {
        if (r.x < -eps || r.y < -eps || r.x + r.w > d.width + eps || r.y + r.h > d.canvasHeight + eps) {
            problems.push(`"${r.label}" at (${Math.round(r.x)},${Math.round(r.y)}) ${Math.round(r.w)}x${Math.round(r.h)} exceeds the ${d.width}x${d.canvasHeight} canvas`);
        }
    }
    return problems;
}
// Contrast is computed purely from the known, closed set of (tone, day)
// color combinations the DSL can ever produce — no rendering needed, this
// is the same formula lint-svg.ts uses, evaluated on values we already know.
function checkContrast(d) {
    const problems = [];
    const contrastFor = (band, boxTone) => {
        const boxFill = boxTone ? resolveBoxStyle(boxTone, d.day).fill : PALETTE.bg;
        const found = [];
        for (const run of band.wrappedRuns ?? []) {
            const fg = resolveTextColor(run.tone, d.day);
            const delta = Math.abs(luminance(fg) - luminance(boxFill));
            if (delta < CONTRAST_THRESHOLD) {
                found.push(`"${run.text.slice(0, 20)}" (${fg} on ${boxFill}, in "${labelOf(band)}") has low contrast (delta=${delta.toFixed(0)}, want >= ${CONTRAST_THRESHOLD})`);
            }
        }
        return found;
    };
    for (const band of d.laidOut) {
        if (band.type === 'box')
            problems.push(...contrastFor(band, band.tone ?? 'plain'));
        else if (band.type === 'banner')
            problems.push(...contrastFor(band, band.tone ?? 'accent'));
        else if (band.type === 'caption')
            problems.push(...contrastFor(band, null));
        else if (band.type === 'row' || band.type === 'grid')
            for (const c of band.children)
                problems.push(...contrastFor(c, c.tone ?? 'plain'));
    }
    return problems;
}
// verifyDiagram(laidOutDiagram) -> {ok, problems: string[], warnings: string[]}
// `problems` fail the build; `warnings` (text volume, ADR 0003) never do.
export function verifyDiagram(d) {
    const rects = collectRects(d);
    const problems = [
        ...checkOverlaps(rects),
        ...checkConnects(d, rects),
        ...checkBounds(d, rects),
        ...checkContrast(d),
    ];
    // Rule findings (WCAG contrast, legend, lane order, crossings, density ...). Doc-medium diagrams
    // get the full set; legacy slide diagrams keep their existing text-volume warning only.
    const findings = d.medium === 'doc' ? lintDiagram(d) : lintDiagram(d).filter(f => f.rule === 'density');
    const warnings = findings.filter(f => f.severity === 'warn').map(f => `[${f.rule}] ${f.message}`);
    return { ok: problems.length === 0, problems, warnings, findings };
}

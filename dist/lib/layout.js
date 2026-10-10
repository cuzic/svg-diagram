// Vertical-stack layout engine. Top-level bands (caption/box/banner/row/
// grid/spacer/raw/connect) are stacked with an auto-advancing y cursor —
// nothing in this file ever asks a caller for a y coordinate. row() and
// grid() additionally distribute width across their children (by flex
// ratio, or fixed width block-centered) and give every child in the same
// row/grid-row a shared height (the tallest child's own required height),
// matching how every hand-authored diagram in this deck aligns box borders
// across a row.
//
// Two passes: measure every string this diagram uses in ONE Chromium round
// trip (widths are computed structurally first, without needing text
// metrics — flex/grid math is pure arithmetic), then walk bands top-to-
// bottom deriving heights bottom-up (wrapped line count -> block height ->
// row height -> cursor advance) and assigning x/y. connect() bands don't
// consume vertical space; they're resolved in a final pass once every named
// anchor (any box/child with an explicit `id`) has a known rect.
import { splitAtoms, measureAll } from './measure.js';
import { wrapAtoms } from './wrap.js';
import { collectTextRequests, layoutSequence, layoutTable } from './seq-table.js';
import { collectTextRequests as wfTextRequests, layoutWireframe, layoutScreens } from './wireframe.js';
import { ROLES, PALETTE, SHADES, blendLuminance, bestTextColor } from './tokens.js';
export const LINE_HEIGHT_EM = 1.4; // vertical spacing between wrapped lines within one text block
export const BOX_PAD_X = 20;
export const BOX_PAD_Y = 16;
export const BOX_INNER_GAP = 8; // vertical gap between title/body/note runs within one box
// box({step}) badge geometry — a solid-fill numbered circle sitting on the
// title's own baseline (cy = titleBaselineY - STEP_BADGE_BASELINE_OFFSET,
// matching the offset every hand-authored "① foo" box in this deck already
// used between its badge circle and its own number glyph's baseline).
export const STEP_BADGE_R = 15;
const STEP_BADGE_GAP = 10;
export const STEP_BADGE_BASELINE_OFFSET = 6;
const STEP_INDENT = 2 * STEP_BADGE_R + STEP_BADGE_GAP; // how far the title's first line is pushed right to clear the badge
function textRuns(band) {
    switch (band.type) {
        case 'caption':
            return [{ text: band.text, size: ROLES[band.role ?? 'label'], weight: band.bold ? 700 : 400, mono: !!band.mono, tone: band.tone }];
        case 'banner': {
            const runs = [{ text: band.headline, size: ROLES.banner, weight: 700, mono: false, tone: band.headlineTone }];
            if (band.sub)
                runs.push({ text: band.sub, size: ROLES.note, weight: 400, mono: false, tone: band.subTone ?? 'muted' });
            return runs;
        }
        case 'box': {
            const runs = [];
            if (band.title)
                runs.push({ text: band.title, size: ROLES.title, weight: 700, mono: !!band.titleMono, tone: band.titleTone, indent: band.step != null ? STEP_INDENT : 0 });
            if (band.body)
                runs.push({ text: band.body, size: ROLES.body, weight: 400, mono: !!band.bodyMono, tone: band.bodyTone });
            if (band.lines)
                for (const l of band.lines) {
                    const line = typeof l === 'string' ? { text: l } : l;
                    runs.push({ text: line.text, size: ROLES[line.role ?? 'body'], weight: line.bold ? 700 : 400, mono: !!line.mono, tone: line.tone });
                }
            if (band.note)
                runs.push({ text: band.note, size: ROLES.note, weight: 400, mono: false, tone: band.noteTone ?? 'muted' });
            return runs;
        }
        default:
            return [];
    }
}
// Registers every atom this band's text runs need, at the given wrap width,
// into `requests` (for the single batched measureAll call) — width doesn't
// affect *what* needs measuring (that's per-atom, not per-line), so this can
// run before measurement even for row/grid children whose width was just
// computed structurally.
const TAG_SIZE = 14, TAG_H = 24, TAG_PAD_X = 8;
export const LEGEND_SWATCH_W = 36, LEGEND_ITEM_GAP = 28, LEGEND_ROW_H = 24;
function registerAtoms(requests, text, size, weight, font = 'sans') {
    for (const atom of splitAtoms(text)) {
        const key = `${atom} ${size} ${weight} ${font}`;
        if (!requests.has(key))
            requests.set(key, { text: atom, size, weight, font });
    }
}
// group() title is laid out as a left-aligned bold caption inside the frame.
function groupTitleBand(band) {
    return { type: 'caption', text: band.title, align: band.titleAlign ?? 'left', role: 'title', bold: true, tone: band.titleTone ?? (band.tone === 'accent' ? 'accent' : 'text'), mono: false };
}
function registerRequests(requests, band) {
    if ('tag' in band && band.tag)
        registerAtoms(requests, band.tag, TAG_SIZE, 700);
    for (const run of textRuns(band)) {
        const font = run.mono ? 'mono' : 'sans';
        for (const atom of splitAtoms(run.text)) {
            const key = `${atom} ${run.size} ${run.weight} ${font}`;
            if (!requests.has(key))
                requests.set(key, { text: atom, size: run.size, weight: run.weight, font });
        }
    }
}
// Wraps a box-like band's text runs at `wrapWidth` (content width, i.e.
// already excluding BOX_PAD_X*2) and returns {wrappedRuns, textHeight}.
function layoutBoxContent(band, wrapWidth, widthOf) {
    let relY = 0;
    const wrappedRuns = textRuns(band).map((run) => {
        const font = run.mono ? 'mono' : 'sans';
        const indent = run.indent ?? 0;
        const atomW = (atom) => widthOf(atom, run.size, run.weight, font);
        const lines = wrapAtoms(splitAtoms(run.text), { maxWidth: wrapWidth - indent, atomWidth: atomW });
        const lineYs = lines.map(() => {
            relY += run.size;
            const y = relY;
            relY += run.size * (LINE_HEIGHT_EM - 1);
            return y;
        });
        relY += BOX_INNER_GAP;
        return { ...run, lines, lineYs };
    });
    const textHeight = Math.max(0, relY - BOX_INNER_GAP);
    return { wrappedRuns, textHeight };
}
// Structural width distribution for row()/grid() — pure arithmetic, no text
// metrics needed, so this can run in the same pass that registers measure
// requests (a child's wrap width must be known before we know what to wrap).
function rowChildGeometry(band, contentWidth) {
    const n = band.children.length;
    const gap = band.gap;
    if (band.cols) {
        // Shared column grid: every row declaring the same `cols` + `gap` gets
        // identical column edges, so a box spanning columns 1-2 sits exactly
        // above two boxes in columns 1 and 2 of the next row.
        const cw = (contentWidth - (band.cols - 1) * gap) / band.cols;
        let next = 1;
        const widths = [], xOffsets = [];
        for (const c of band.children) {
            const span = c.span ?? 1;
            const col = c.col ?? next;
            if (col < 1 || col + span - 1 > band.cols)
                throw new Error(`row({cols: ${band.cols}}): child "${c.title ?? c.id ?? '(box)'}" at col ${col} span ${span} falls outside the ${band.cols} columns`);
            widths.push(span * cw + (span - 1) * gap);
            xOffsets.push((col - 1) * (cw + gap));
            next = col + span;
        }
        return { widths, xOffsets };
    }
    if (band.justify === 'stretch') {
        const avail = contentWidth - (n - 1) * gap;
        const flexSum = band.children.reduce((s, c) => s + (c.flex ?? 1), 0);
        const widths = band.children.map(c => avail * (c.flex ?? 1) / flexSum);
        const xOffsets = [];
        let x = 0;
        for (const w of widths) {
            xOffsets.push(x);
            x += w + gap;
        }
        return { widths, xOffsets };
    }
    // fixed-width children, block start- or center-aligned
    const widths = band.children.map(c => c.width ?? band.itemWidth ?? 160);
    const blockWidth = widths.reduce((s, w) => s + w, 0) + (n - 1) * gap;
    const start = band.justify === 'center' ? (contentWidth - blockWidth) / 2 : 0;
    const xOffsets = [];
    let x = start;
    for (const w of widths) {
        xOffsets.push(x);
        x += w + gap;
    }
    return { widths, xOffsets };
}
function gridChildGeometry(band, contentWidth) {
    const cols = band.cols;
    const gap = band.gap;
    const cellWidth = (contentWidth - (cols - 1) * gap) / cols;
    return { cellWidth };
}
export async function layoutDiagram(d) {
    const contentWidth = d.width - 2 * d.pad;
    // ---- pass 1: register + measure every atom this diagram needs, once ----
    const requests = new Map();
    const registerBand = (band) => {
        if (band.type === 'group') {
            if (band.title)
                registerRequests(requests, groupTitleBand(band));
            for (const child of band.children)
                registerBand(child);
        }
        else if (band.type === 'swimlane') {
            for (const l of band.lanes)
                registerAtoms(requests, l.label, ROLES.title, 700);
            for (const p of band.phases ?? [])
                registerAtoms(requests, p.label, ROLES.note, 700);
            for (const st of band.steps)
                registerRequests(requests, st);
        }
        else if (band.type === 'sequence' || band.type === 'table') {
            for (const [text, size, weight, font] of collectTextRequests(band))
                registerAtoms(requests, text, size, weight, font);
        }
        else if (band.type === 'wireframe' || band.type === 'screens') {
            for (const [text, size, weight, font] of wfTextRequests(band))
                registerAtoms(requests, text, size, weight, font);
        }
        else if (band.type === 'legend') {
            for (const item of band.items)
                registerAtoms(requests, item.label, ROLES.note, 400);
        }
        else if (band.type === 'grouprow') {
            for (const child of band.children)
                registerBand(child);
        }
        else if (band.type === 'row') {
            for (const child of band.children)
                registerRequests(requests, child);
        }
        else if (band.type === 'grid') {
            for (const child of band.children)
                registerRequests(requests, child);
        }
        else if (band.type === 'connect' && band.label) {
            // connect() labels are single-line, always the 'note' role at plain
            // weight (see emit.ts's renderConnect) — registered here so their
            // real width is known before layoutDiagram resolves the connect,
            // instead of guessed at draw time.
            for (const atom of splitAtoms(band.label)) {
                const key = `${atom} ${ROLES.note} 400 sans`;
                if (!requests.has(key))
                    requests.set(key, { text: atom, size: ROLES.note, weight: 400, font: 'sans' });
            }
        }
        else if (band.type === 'pyramid') {
            for (const layer of band.layers) {
                for (const atom of splitAtoms(layer.text)) {
                    const key = `${atom} ${ROLES.title} 700 sans`;
                    if (!requests.has(key))
                        requests.set(key, { text: atom, size: ROLES.title, weight: 700, font: 'sans' });
                }
            }
        }
        else if (band.type === 'curve') {
            for (const label of [band.yTopLabel, band.yBottomLabel, band.xLabel]) {
                if (!label)
                    continue;
                for (const atom of splitAtoms(label)) {
                    const key = `${atom} ${ROLES.note} 400 sans`;
                    if (!requests.has(key))
                        requests.set(key, { text: atom, size: ROLES.note, weight: 400, font: 'sans' });
                }
            }
        }
        else {
            registerRequests(requests, band);
        }
    };
    for (const band of d.bands)
        registerBand(band);
    const measured = await measureAll(requests);
    const widthOf = (atom, size, weight, font) => measured.get(`${atom} ${size} ${weight} ${font}`)?.w ?? 0;
    // A labelled straight connector between two side-by-side children (right side -> left side) needs room in the gap
    // between them: a label wider than the gap lands on both boxes, or straddles the groups' frame lines. The row's gap grows to fit it.
    const labelled = [];
    const collectConnects = (bs) => { for (const b of bs) {
        if (b.type === 'connect' && b.label && b.route === 'straight')
            labelled.push(b);
        else if ('children' in b && Array.isArray(b.children))
            collectConnects(b.children);
    } };
    collectConnects(d.bands);
    const idsIn = (b, out = new Set()) => { const x = b; if (x.id)
        out.add(x.id); if (Array.isArray(x.children))
        for (const c of x.children)
            idsIn(c, out); return out; };
    const LABEL_MARGIN = 6; // clear space between a label and the boxes / frame lines on either side
    const MIN_CHILD_W = 80;
    const gapForLabels = (band, cw) => {
        if (band.cols || band.justify !== 'stretch' || !labelled.length)
            return band.gap; // fixed-width rows would overflow the canvas
        const kids = band.children.map(c => idsIn(c));
        let gap = band.gap;
        for (const c of labelled) {
            const f = parseRef(c.from), t = parseRef(c.to);
            const i = kids.findIndex(k => k.has(f.id)), j = kids.findIndex(k => k.has(t.id));
            if (i < 0 || j < 0 || Math.abs(i - j) !== 1 || !((i < j && f.side === 'right' && t.side === 'left') || (i > j && f.side === 'left' && t.side === 'right')))
                continue;
            const w = [...splitAtoms(c.label)].reduce((acc, a) => acc + widthOf(a, LABEL_SIZE, 400, 'sans'), 0) + (c.chip ? 16 : 0);
            gap = Math.max(gap, Math.ceil(w + 2 * LABEL_MARGIN));
        }
        const maxGap = band.children.length > 1 ? (cw - band.children.length * MIN_CHILD_W) / (band.children.length - 1) : band.gap;
        return gap <= maxGap ? gap : band.gap; // would squeeze the children: keep the gap (verify reports the label that does not fit)
    };
    // ---- pass 2: layout top-to-bottom ----
    let cursorY = d.pad;
    const laidOut = [];
    const anchors = new Map(); // id -> {x,y,w,h}
    const connects = [];
    const deferred = []; // connect()s that came before the boxes they name
    const placeBoxLike = (band, x, y, w, isBoxLike) => {
        const chrome = band; // caption has no padX / padY / tag / id: they read as undefined (its `tone` is a TextTone, unused here)
        const wrapWidth = isBoxLike ? w - 2 * (chrome.padX ?? BOX_PAD_X) : w;
        const { wrappedRuns, textHeight } = layoutBoxContent(band, wrapWidth, widthOf);
        const h = isBoxLike ? textHeight + 2 * (chrome.padY ?? BOX_PAD_Y) : textHeight;
        const placed = { ...band, x, y, w, h, wrappedRuns }; // spreading a generic loses the intersection
        if (chrome.tag) {
            const tw = [...splitAtoms(chrome.tag)].reduce((a, atom) => a + widthOf(atom, TAG_SIZE, 700, 'sans'), 0) + 2 * TAG_PAD_X;
            placed.tagBox = { x: chrome.tagAt === undefined ? x + w - tw - 12 : x + w * chrome.tagAt - tw / 2, y: y - TAG_H / 2, w: tw, h: TAG_H };
        }
        if (chrome.id)
            anchors.set(chrome.id, { x, y, w, h });
        return placed;
    };
    const stack = (bands, padX, cw) => {
        for (const band of bands) {
            if (band.type === 'spacer') {
                cursorY += band.h;
                continue;
            }
            if (band.type === 'group') {
                const gp = band.pad ?? 16;
                const startY = cursorY;
                const frame = { type: 'group', x: padX, y: startY, w: cw, h: 0, tone: band.tone, dashed: band.dashed, id: band.id };
                laidOut.push(frame); // pushed first so the frame is drawn under its children
                cursorY += gp;
                if (band.title) {
                    const t = placeBoxLike(groupTitleBand(band), padX + gp, cursorY, cw - 2 * gp, false);
                    const inkW = Math.max(0, ...t.wrappedRuns.flatMap(r => r.lines.map(l => [...splitAtoms(l)].reduce((s, a) => s + widthOf(a, r.size, r.weight, r.mono ? 'mono' : 'sans'), 0))));
                    const inkX = t.align === 'center' ? t.x + (t.w - inkW) / 2 : t.align === 'right' ? t.x + t.w - inkW : t.x;
                    t.inkBox = { x: inkX, y: t.y, w: inkW, h: t.h };
                    laidOut.push(t);
                    cursorY += t.h + d.gap / 2;
                }
                stack(band.children, padX + gp, cw - 2 * gp);
                cursorY = cursorY - d.gap + gp;
                frame.h = cursorY - startY;
                if (band.id)
                    anchors.set(band.id, { x: frame.x, y: frame.y, w: frame.w, h: frame.h });
                cursorY += d.gap;
                continue;
            }
            if (band.type === 'sequence' || band.type === 'table') {
                const placed = band.type === 'sequence' ? layoutSequence(band, padX, cursorY, cw, widthOf) : layoutTable(band, padX, cursorY, cw, widthOf);
                if (band.id)
                    anchors.set(band.id, { x: placed.x, y: placed.y, w: placed.w, h: placed.h });
                laidOut.push(placed);
                cursorY += placed.h + d.gap;
                continue;
            }
            if (band.type === 'wireframe' || band.type === 'screens') {
                const placed = band.type === 'wireframe' ? layoutWireframe(band, padX, cursorY, cw, widthOf) : layoutScreens(band, padX, cursorY, cw, widthOf);
                for (const a of placed.anchors)
                    anchors.set(a.id, { x: a.x, y: a.y, w: a.w, h: a.h });
                laidOut.push(placed);
                cursorY += placed.h + d.gap;
                continue;
            }
            if (band.type === 'swimlane') {
                const labelW = band.labelW ?? 128, colGap = band.colGap ?? 28, padY = 14, padX2 = 14;
                const bodyX = padX + labelW, bodyW = cw - labelW;
                const colW = (bodyW - 2 * padX2 - (band.cols - 1) * colGap) / band.cols;
                if (colW < 60)
                    throw new Error(`swimlane(): ${band.cols} columns leave only ${Math.round(colW)}px each — widen the diagram, shrink labelW, or use fewer columns`);
                const startY = cursorY;
                const wrapLines = (text, size, weight, maxW) => wrapAtoms(splitAtoms(text), { maxWidth: Math.max(20, maxW), atomWidth: (a) => widthOf(a, size, weight, 'sans') });
                // column-group headers across the top
                let phaseH = 0;
                const phases = (band.phases ?? []).map((ph) => {
                    const x = bodyX + padX2 + (ph.from - 1) * (colW + colGap) - colGap / 2;
                    const w = (ph.to - ph.from + 1) * (colW + colGap);
                    const lines = wrapLines(ph.label, ROLES.note, 700, w - 16);
                    phaseH = Math.max(phaseH, lines.length * ROLES.note * LINE_HEIGHT_EM + 16);
                    return { x, w, lines };
                });
                // steps first at y=0 (heights depend on wrapping), then lanes get the tallest step
                const stepsPlaced = band.steps.map(st => {
                    const x = bodyX + padX2 + (st.col - 1) * (colW + colGap);
                    const w = st.span * colW + (st.span - 1) * colGap;
                    return placeBoxLike({ ...st, padX: st.padX ?? 12, padY: st.padY ?? 10 }, x, 0, w, true);
                });
                const laneIndex = new Map(band.lanes.map((l, i) => [l.id, i]));
                const rowGap = 12;
                let y = startY + phaseH;
                const lanes = band.lanes.map((lane, i) => {
                    const labelLines = wrapLines(lane.label, ROLES.title, 700, labelW - 24);
                    const labelH = labelLines.length * ROLES.title * LINE_HEIGHT_EM;
                    const mine = stepsPlaced.filter(s => laneIndex.get(s.lane) === i);
                    const maxStep = Math.max(0, ...mine.map(s => s.h));
                    const rows = 1 + Math.max(0, ...mine.map(s => s.row ?? 0));
                    const blockH = rows * maxStep + (rows - 1) * rowGap;
                    const h = Math.max(blockH, labelH) + 2 * padY;
                    const out = { y, h, labelLines, labelTop: y + (h - labelH) / 2, tone: lane.tone, maxStep, blockTop: y + (h - blockH) / 2 };
                    y += h;
                    return out;
                });
                const frame = { type: 'swimlane', x: padX, y: startY, w: cw, h: y - startY, labelW, bodyX, phaseH, phases, lanes };
                laidOut.push(frame); // before its steps so the lanes draw underneath
                for (const st of stepsPlaced) {
                    const ln = lanes[laneIndex.get(st.lane)]; // an unknown lane id throws here, as before
                    st.y = ln.blockTop + (st.row ?? 0) * (ln.maxStep + rowGap) + (ln.maxStep - st.h) / 2;
                    if (st.id)
                        anchors.set(st.id, { x: st.x, y: st.y, w: st.w, h: st.h });
                    if (st.tagBox)
                        st.tagBox.y = st.y - st.tagBox.h / 2;
                    laidOut.push(st);
                }
                cursorY = y + d.gap;
                continue;
            }
            if (band.type === 'legend') {
                const items = band.items.map(item => {
                    const tw = [...splitAtoms(item.label)].reduce((a, atom) => a + widthOf(atom, ROLES.note, 400, 'sans'), 0);
                    return { ...item, textW: tw, w: LEGEND_SWATCH_W + 8 + tw };
                });
                const rows = [[]];
                let rowW = 0;
                for (const it of items) {
                    const add = (rows.at(-1).length ? LEGEND_ITEM_GAP : 0) + it.w;
                    if (rows.at(-1).length && rowW + add > cw) {
                        rows.push([]);
                        rowW = 0;
                    }
                    rowW += (rows.at(-1).length ? LEGEND_ITEM_GAP : 0) + it.w;
                    rows.at(-1).push(it);
                }
                const placedItems = [];
                rows.forEach((r, ri) => {
                    const total = r.reduce((a, it) => a + it.w, 0) + (r.length - 1) * LEGEND_ITEM_GAP;
                    let x = band.align === 'left' ? padX : padX + (cw - total) / 2;
                    for (const it of r) {
                        placedItems.push({ ...it, x, y: cursorY + ri * (LEGEND_ROW_H + 8) });
                        x += it.w + LEGEND_ITEM_GAP;
                    }
                });
                const h = rows.length * LEGEND_ROW_H + (rows.length - 1) * 8;
                laidOut.push({ type: 'legend', x: padX, y: cursorY, w: cw, h, items: placedItems });
                cursorY += h + d.gap;
                continue;
            }
            if (band.type === 'connect') {
                // Resolved immediately (not deferred) so a loop-under route can
                // reserve real vertical space for its dip + label — a zero-height
                // overlay resolved only after the whole stack is laid out would let
                // the return path silently collide with whatever comes next (this
                // was caught by lint-svg.ts's container-overflow check on the first
                // real test: a loop-under label overlapped the following banner).
                // When an anchor is not laid out yet (connect() declared before a box it
                // names) resolution waits until the whole stack is placed; such a
                // connector reserves no loop-under space.
                if (!anchors.has(parseRef(band.from).id) || !anchors.has(parseRef(band.to).id)) {
                    deferred.push(band);
                    continue;
                }
                const resolved = resolveConnect(band, anchors, widthOf);
                connects.push(resolved);
                if (band.route === 'loop-under') {
                    const labelClearance = band.label ? 24 : 8;
                    cursorY = Math.max(resolved.from.y, resolved.to.y, cursorY) + band.dip + labelClearance;
                }
                continue;
            }
            if (band.type === 'raw') {
                const placed = { ...band, x: padX, y: cursorY, w: cw };
                if (band.id)
                    anchors.set(band.id, { x: placed.x, y: placed.y, w: placed.w, h: placed.h });
                laidOut.push(placed);
                cursorY += band.h + (band.h > 0 ? d.gap : 0);
                continue;
            }
            if (band.type === 'grouprow') {
                // Each child is laid out as if stacked alone at its own x / width, all starting at the row's top; afterwards every
                // frame / box is stretched to the tallest one (a group's inner content keeps its natural height).
                const { widths, xOffsets } = rowChildGeometry({ ...band, gap: gapForLabels(band, cw) }, cw);
                const rowTop = cursorY;
                const stretch = [];
                let rowHeight = 0;
                band.children.forEach((child, i) => {
                    cursorY = rowTop;
                    const x = padX + xOffsets[i];
                    if (child.type === 'box') {
                        const c = placeBoxLike(child, x, rowTop, widths[i], true);
                        const rw = { type: 'row', x, y: rowTop, w: widths[i], h: c.h, children: [c], arrows: [] };
                        laidOut.push(rw);
                        rowHeight = Math.max(rowHeight, c.h);
                        stretch.push(h => { c.h = rw.h = h; if (c.id)
                            anchors.set(c.id, { x: c.x, y: c.y, w: c.w, h }); });
                    }
                    else {
                        const frame = laidOut.length;
                        stack([child], x, widths[i]);
                        const f = laidOut[frame]; // stack() pushes a group's frame first
                        rowHeight = Math.max(rowHeight, f.h);
                        stretch.push(h => { f.h = h; if (child.id)
                            anchors.set(child.id, { x: f.x, y: f.y, w: f.w, h }); });
                    }
                });
                stretch.forEach(s => s(rowHeight));
                cursorY = rowTop + rowHeight + d.gap;
                continue;
            }
            if (band.type === 'row') {
                const { widths, xOffsets } = rowChildGeometry({ ...band, gap: gapForLabels(band, cw) }, cw);
                const placedChildren = band.children.map((child, i) => placeBoxLike(child, padX + xOffsets[i], cursorY, widths[i], true));
                const rowHeight = Math.max(...placedChildren.map(c => c.h));
                for (const c of placedChildren) {
                    c.h = rowHeight;
                    if (c.id)
                        anchors.set(c.id, { x: c.x, y: c.y, w: c.w, h: rowHeight });
                }
                const arrows = [];
                if (band.arrows === 'between') {
                    for (let i = 0; i < placedChildren.length - 1; i++) {
                        const a = placedChildren[i], b = placedChildren[i + 1];
                        const y = cursorY + rowHeight / 2;
                        arrows.push({ x1: a.x + a.w, y1: y, x2: b.x, y2: y });
                    }
                }
                laidOut.push({ type: 'row', x: padX, y: cursorY, w: cw, h: rowHeight, children: placedChildren, arrows });
                cursorY += rowHeight + d.gap;
                continue;
            }
            if (band.type === 'grid') {
                const gridStartY = cursorY;
                const { cellWidth } = gridChildGeometry(band, cw);
                const cols = band.cols;
                const placedRows = [];
                for (let i = 0; i < band.children.length; i += cols) {
                    const rowChildren = band.children.slice(i, i + cols);
                    const placed = rowChildren.map((child, j) => placeBoxLike(child, padX + j * (cellWidth + band.gap), cursorY, cellWidth, true));
                    const rowHeight = Math.max(...placed.map(c => c.h));
                    for (const c of placed) {
                        c.h = rowHeight;
                        if (c.id)
                            anchors.set(c.id, { x: c.x, y: c.y, w: c.w, h: rowHeight });
                    }
                    placedRows.push(...placed);
                    cursorY += rowHeight + band.gap; // this row's gap; replaced by d.gap below after the loop
                }
                laidOut.push({ type: 'grid', x: padX, y: gridStartY, w: cw, children: placedRows });
                cursorY += d.gap - band.gap; // swap the last grid-row's internal gap for the between-bands gap
                continue;
            }
            if (band.type === 'pyramid') {
                const n = band.layers.length;
                const baseWidth = band.width ?? Math.min(cw, 520);
                const apexWidth = baseWidth * band.apexRatio;
                const layerH = band.layerHeight;
                const totalH = n * layerH;
                const cx = padX + cw / 2;
                const layersOut = [];
                for (let i = 0; i < n; i++) { // i=0 is the bottom (widest) layer
                    const bottomY = cursorY + totalH - i * layerH;
                    const topY = bottomY - layerH;
                    const bottomW = baseWidth - (baseWidth - apexWidth) * (i / n);
                    const topW = baseWidth - (baseWidth - apexWidth) * ((i + 1) / n);
                    // Opacity climbs bottom->top using SHADES (see tokens.ts) — the
                    // apex (i = n-1) always gets SHADES[0] = fully opaque, matching
                    // every hand-authored pyramid/funnel in this deck.
                    const opacity = SHADES[Math.min(SHADES.length - 1, n - 1 - i)];
                    // bg luminance is a real alpha-blend against white, so the text
                    // color choice is provably safe (see tokens.ts's bestTextColor
                    // doc comment) without needing a Playwright-rendered check.
                    const bgLum = blendLuminance(PALETTE.bg, PALETTE[d.day].accent, opacity);
                    const textColor = bestTextColor(bgLum);
                    // Wrapped at the narrower (top) edge of this layer, minus padding —
                    // conservative since the layer is only wider than that going down,
                    // so the label can never spill past the trapezoid's slanted sides.
                    const wrapWidth = Math.max(40, topW - 24);
                    const atomW = (atom) => widthOf(atom, ROLES.title, 700, 'sans');
                    const lines = wrapAtoms(splitAtoms(band.layers[i].text), { maxWidth: wrapWidth, atomWidth: atomW });
                    const midY = (topY + bottomY) / 2;
                    const lineGap = ROLES.title * LINE_HEIGHT_EM;
                    const textYs = lines.map((_, li) => Math.round(midY + (li - (lines.length - 1) / 2) * lineGap + ROLES.title * 0.35));
                    layersOut.push({
                        points: [[cx - bottomW / 2, bottomY], [cx + bottomW / 2, bottomY], [cx + topW / 2, topY], [cx - topW / 2, topY]],
                        opacity, textColor, lines, textYs, cx,
                    });
                }
                laidOut.push({ type: 'pyramid', x: cx - baseWidth / 2, y: cursorY, w: baseWidth, h: totalH, day: d.day, layers: layersOut });
                cursorY += totalH + d.gap;
                continue;
            }
            if (band.type === 'curve') {
                const w = band.width ?? cw;
                const h = band.height;
                const x = padX + (cw - w) / 2;
                const y = cursorY;
                const AXIS_LABEL_W = 44, AXIS_BOTTOM_GAP = 28, TOP_PAD = 14, RIGHT_PAD = 8;
                const axisX = x + AXIS_LABEL_W;
                const axisRight = x + w - RIGHT_PAD;
                const axisTop = y + TOP_PAD;
                const axisBottom = y + h - AXIS_BOTTOM_GAP;
                const n = band.points.length;
                const points = band.points.map((p, i) => ({
                    x: n === 1 ? axisX : axisX + i * (axisRight - axisX) / (n - 1),
                    y: axisBottom - Math.max(0, Math.min(1, p.y)) * (axisBottom - axisTop),
                    emphasis: p.emphasis,
                    dropLine: !!p.dropLine,
                }));
                laidOut.push({
                    type: 'curve', x, y, w, h, axisX, axisRight, axisTop, axisBottom, points,
                    yTopLabel: band.yTopLabel, yBottomLabel: band.yBottomLabel, xLabel: band.xLabel,
                });
                cursorY += h + d.gap;
                continue;
            }
            // caption / box / banner
            const isBoxLike = band.type === 'box' || band.type === 'banner';
            const placed = placeBoxLike(band, padX, cursorY, cw, isBoxLike);
            laidOut.push(placed);
            cursorY += placed.h + d.gap;
        }
    };
    stack(d.bands, d.pad, contentWidth);
    for (const band of deferred)
        connects.push(resolveConnect(band, anchors, widthOf)); // throws "unknown anchor id" if it never appears
    const canvasHeight = Math.round(cursorY - d.gap + d.pad);
    return { ...d, laidOut, canvasHeight, connects };
}
// 'id', 'id:side', or 'id:side@t' — t (0..1) slides the anchor along that side
// (default 0.5) so several connectors can leave/enter the same side in parallel.
function parseRef(ref) {
    const [id, sideAt] = ref.split(':');
    const [side, at] = (sideAt ?? 'center').split('@');
    return { id, side, at: at === undefined ? 0.5 : Number(at) };
}
function anchorPoint(rect, side, at = 0.5) {
    switch (side) {
        case 'left': return { x: rect.x, y: rect.y + rect.h * at };
        case 'right': return { x: rect.x + rect.w, y: rect.y + rect.h * at };
        case 'top': return { x: rect.x + rect.w * at, y: rect.y };
        case 'bottom': return { x: rect.x + rect.w * at, y: rect.y + rect.h };
        default: return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
    }
}
// positions along a leg to try for a chip, nearest the middle first
const CHIP_TS = Array.from({ length: 41 }, (_, i) => 0.1 + i * 0.02).sort((a, b) => Math.abs(a - 0.5) - Math.abs(b - 0.5));
const CONNECT_STROKE_PAD = 3; // half-thickness allowance so a perfectly horizontal/vertical path segment still has a non-zero-area bbox to check
const LABEL_SIZE = 14; // must match emit.ts's renderConnect label font-size
function segRect(x0, y0, x1, y1) {
    const xa = Math.min(x0, x1), xb = Math.max(x0, x1);
    const ya = Math.min(y0, y1), yb = Math.max(y0, y1);
    return { x: xa - CONNECT_STROKE_PAD, y: ya - CONNECT_STROKE_PAD, w: (xb - xa) + 2 * CONNECT_STROKE_PAD, h: (yb - ya) + 2 * CONNECT_STROKE_PAD };
}
// Polyline the connector follows. 'straight' is a single segment; 'loop-under'
// is down/across/up; 'elbow' is orthogonal — vertical-horizontal-vertical when
// leaving a top/bottom side, horizontal-vertical-horizontal when leaving a
// left/right side (`bend`, 0..1, is where the middle leg sits between the two
// endpoints). Collinear/duplicate points are dropped so a degenerate elbow
// (aligned endpoints) is just a straight line.
function routePoints(band, from, to, fromSide) {
    let pts;
    if (band.route === 'loop-under') {
        const midY = Math.max(from.y, to.y) + band.dip;
        pts = [from, { x: from.x, y: midY }, { x: to.x, y: midY }, to];
    }
    else if (band.route === 'elbow') {
        const vertical = fromSide === 'top' || fromSide === 'bottom' || (fromSide === 'center' && Math.abs(to.y - from.y) > Math.abs(to.x - from.x));
        if (vertical) {
            const midY = band.bend === 'end' ? to.y - Math.sign(to.y - from.y) * (band.bendOffset ?? 14) : band.bend === 'start' ? from.y + Math.sign(to.y - from.y) * (band.bendOffset ?? 14) : from.y + (to.y - from.y) * band.bend; // 'auto' only reaches here from resolveConnect, which replaces the result
            pts = [from, { x: from.x, y: midY }, { x: to.x, y: midY }, to];
        }
        else {
            const midX = band.bend === 'end' ? to.x - Math.sign(to.x - from.x) * (band.bendOffset ?? 14) : band.bend === 'start' ? from.x + Math.sign(to.x - from.x) * (band.bendOffset ?? 14) : from.x + (to.x - from.x) * band.bend;
            pts = [from, { x: midX, y: from.y }, { x: midX, y: to.y }, to];
        }
    }
    else {
        pts = [from, to];
    }
    return pts.filter((p, i) => i === 0 || p.x !== pts[i - 1].x || p.y !== pts[i - 1].y);
}
// The path's ink as a list of thin segment rects rather than one bounding
// box — a loop-under/elbow path's bbox would cover empty space that other
// boxes legitimately occupy.
function pathSegments(points) {
    const segs = [];
    for (let i = 0; i < points.length - 1; i++)
        segs.push(segRect(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y));
    return segs;
}
function resolveConnect(band, anchors, widthOf) {
    const fromRef = parseRef(band.from), toRef = parseRef(band.to);
    const fromRect = anchors.get(fromRef.id);
    const toRect = anchors.get(toRef.id);
    if (!fromRect)
        throw new Error(`connect(): unknown anchor id "${fromRef.id}" (give the source box an id: '${fromRef.id}')`);
    if (!toRect)
        throw new Error(`connect(): unknown anchor id "${toRef.id}" (give the target box an id: '${toRef.id}')`);
    const from = anchorPoint(fromRect, fromRef.side, fromRef.at);
    const to = anchorPoint(toRect, toRef.side, toRef.at);
    let points = routePoints(band, from, to, fromRef.side);
    if (band.route === 'elbow' && band.bend === 'auto') {
        // Pick the first bend whose path stays clear of every box except the two it joins.
        const others = [...anchors.entries()].filter(([id]) => id !== fromRef.id && id !== toRef.id).map(([, r]) => r);
        const clear = (pts) => pathSegments(pts).every(seg => others.every(r => {
            const ox = Math.min(seg.x + seg.w, r.x + r.w) - Math.max(seg.x, r.x);
            const oy = Math.min(seg.y + seg.h, r.y + r.h) - Math.max(seg.y, r.y);
            return ox <= 0.5 || oy <= 0.5;
        }));
        const cands = ['end', 'start', 0.5, 0.25, 0.75].map(b => routePoints({ ...band, bend: b }, from, to, fromRef.side));
        points = cands.find(clear) ?? cands[0];
    }
    const segments = pathSegments(points);
    let labelX, labelY, labelBox, chipBox;
    if (band.label) {
        const labelWidth = [...splitAtoms(band.label)].reduce((s, a) => s + widthOf(a, LABEL_SIZE, 400, 'sans'), 0);
        const dy = band.chip ? 5 : -6; // a chip sits ON the line; a plain label sits above it
        if (band.route === 'elbow' && points.length === 4) {
            // vertical-first: label rides the middle (horizontal) leg; horizontal-
            // first: it rides the first leg, so a fan of branches from one box
            // gets labels at distinct x positions.
            const [a, b, c2] = points;
            const [p, q] = a.x === b.x ? [b, c2] : [a, b];
            labelX = Math.round((p.x + q.x) / 2);
            labelY = Math.round(p.y + dy);
            // A chip sits on the longest leg, at the first spot along it where the pill touches neither endpoint box.
            if (band.chip && points.length === 4) {
                const cw2 = labelWidth + 16;
                const legs = [];
                for (let i = 0; i < points.length - 1; i++) {
                    const p0 = points[i], p1 = points[i + 1];
                    legs.push({ p0, p1, len: Math.abs(p1.x - p0.x) + Math.abs(p1.y - p0.y) });
                }
                legs.sort((x, y) => y.len - x.len);
                const hit = (r, bx) => !(bx.x + bx.w <= r.x || r.x + r.w <= bx.x || bx.y + bx.h <= r.y || r.y + r.h <= bx.y);
                let pick = null;
                for (const l of legs) {
                    if (l.len < 24)
                        continue;
                    for (const t of CHIP_TS) {
                        const mx = l.p0.x + (l.p1.x - l.p0.x) * t, my = l.p0.y + (l.p1.y - l.p0.y) * t;
                        const bx = { x: mx - cw2 / 2, y: my - 12, w: cw2, h: 24 };
                        if (!hit(fromRect, bx) && !hit(toRect, bx)) {
                            pick = { mx, my };
                            break;
                        }
                    }
                    if (pick)
                        break;
                }
                if (pick) {
                    labelX = Math.round(pick.mx);
                    labelY = Math.round(pick.my + dy);
                }
            }
        }
        else {
            const t = band.labelAt ?? 0.5;
            labelX = Math.round(from.x + (to.x - from.x) * t);
            labelY = Math.round((band.route === 'loop-under' ? Math.max(from.y, to.y) + band.dip : from.y + (to.y - from.y) * t) + dy);
        }
        labelBox = { x: labelX - labelWidth / 2, y: labelY - LABEL_SIZE, w: labelWidth, h: LABEL_SIZE + 4 };
        if (band.chip) {
            chipBox = { x: labelX - (labelWidth + 16) / 2, y: labelY - 17, w: labelWidth + 16, h: 24 };
            labelBox = chipBox;
        }
    }
    // fromLabel/toLabel preserve the original "id:side" strings for error
    // messages — `from`/`to` themselves get overwritten by the spread below
    // with the resolved {x,y} points emit.ts's renderConnectPath needs.
    return { ...band, from, to, fromId: fromRef.id, toId: toRef.id, fromLabel: band.from, toLabel: band.to, points, pathSegments: segments, labelX, labelY, labelBox, chipBox };
}

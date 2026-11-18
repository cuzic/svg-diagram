// Where everything goes on a 16:9 deck slide (ADR 0055, ADR 0056 D2): the heading and lead from the top, the source and callouts from the
// bottom, the figure scaled into what is left; a cover centred (ADR 0066). One calculation for the PowerPoint writer (lib/pptx/deck.ts) and the slide SVG
// (lib/present/slide-svg.ts), so a slide shown by `serve` and the same slide in the .pptx sit the same. Pure: the widths come in as a function.
import { wrapText } from './wrap.js';
/** The slide, in px at 96 dpi: 13.333 × 7.5 in, PowerPoint's 16:9. */
export const SLIDE_W = 1280, SLIDE_H = 720;
export const MARGIN_X = 56;
const TOP = 32, BOTTOM = 28, GAP = 16, FIG_PAD = 6;
/** A figure is never drawn larger than this many times its own size: past it the text looks shouted. */
export const MAX_FIGURE_SCALE = 1.25;
/** The largest a figure is drawn under 'fill': 14 px text comes out at 21 px (about 16 pt), still well under the heading's 37 px. */
export const FILL_FIGURE_SCALE = 1.5;
export const maxScale = (fit) => fit === 'fill' ? FILL_FIGURE_SCALE : MAX_FIGURE_SCALE;
/** The smallest text (pt) a scaled figure may have before the slide is reported as hard to read. */
export const MIN_TEXT_PT = 9;
/** Line pitch as a multiple of the text size. */
export const LINE = 1.3;
/** Sizes in px, colours as RRGGBB. */
export const STYLE = {
    title: { size: 37, bold: true, color: '1F2328' },
    lead: { size: 19, bold: false, color: '5B6370' },
    callout: { size: 16, bold: false, color: '3A4A5A', strong: '1A2A3A', fill: 'EEF4FB', bar: '1F5FA8', padX: 16, padY: 8 },
    source: { size: 13, bold: false, color: '6B7280' },
};
/** Between two columns, px. */
export const COLUMN_GAP = 24;
const CAPTION = { size: 16, bold: true, color: '1F2328' };
const BULLET = /^(?:・|- )/;
/** `text` wrapped to `width` px. */
function wrapped(text, size, width, w, bold) {
    return wrapText(text, { maxWidth: width, atomWidth: a => w(a, size, bold), mode: 'phrase' });
}
/** A callout's text split into lines, each line's runs: the label's characters plain, the rest bold. */
function calloutLines(c, width, w) {
    const st = STYLE.callout, label = c.label ?? '', all = label + c.text;
    let at = 0;
    return wrapped(all, st.size, width, w, true).map(line => {
        const start = Math.max(at, all.indexOf(line, at));
        at = start + line.length;
        const cut = Math.min(line.length, Math.max(0, label.length - start));
        return [
            ...(cut > 0 ? [{ text: line.slice(0, cut), bold: false, color: st.color }] : []),
            ...(cut < line.length ? [{ text: line.slice(cut), bold: true, color: st.strong }] : []),
        ];
    });
}
const textBlock = (name, x, y, width, size, lines, inset = { x: 0, y: 0 }) => ({ kind: 'text', name, x, y, width, size, pitch: Math.round(size * LINE), lines, inset });
/**
 * The slide's blocks and the figure's place. `figure` is the figure's laid-out size in px, when the slide has one. `columns` (ADR 0058) share
 * the room the figure would have, side by side; `scale` 'same' puts every column figure at one scale.
 */
export function planDeckLayout(s, figure, w, columns, scale = 'each', fit = 'width') {
    if (s.layout === 'cover')
        return planCover(s, w);
    const width = SLIDE_W - 2 * MARGIN_X;
    const top = [], bottom = [];
    let y = TOP;
    if (s.title) {
        const st = STYLE.title, lines = wrapped(s.title, st.size, width, w, st.bold);
        top.push(textBlock('title', MARGIN_X, y, width, st.size, lines.map(t => [{ text: t, bold: st.bold, color: st.color }])));
        y += lines.length * Math.round(st.size * LINE) + 6;
    }
    if (s.lead) {
        const st = STYLE.lead, lines = wrapped(s.lead, st.size, width, w, st.bold);
        top.push(textBlock('lead', MARGIN_X, y, width, st.size, lines.map(t => [{ text: t, bold: false, color: st.color }])));
        y += lines.length * Math.round(st.size * LINE);
    }
    let low = sourceBlock(s, w, bottom);
    for (const c of [...(s.callouts ?? [])].reverse()) {
        const st = STYLE.callout, lines = calloutLines(c, width - 4 - 2 * st.padX, w);
        const h = lines.length * Math.round(st.size * LINE) + 2 * st.padY;
        low -= h;
        bottom.push([
            { kind: 'rect', name: 'callout box', x: MARGIN_X, y: low, w: width, h, fill: st.fill },
            { kind: 'rect', name: 'callout bar', x: MARGIN_X, y: low, w: 4, h, fill: st.bar },
            textBlock(c.label ? `callout: ${c.label}` : 'callout', MARGIN_X + 4, low, width - 4, st.size, lines, { x: st.padX, y: st.padY }),
        ]);
        low -= 10;
    }
    let place = null, noRoom = false;
    if (columns?.length) {
        const roomTop = y + (s.title || s.lead ? GAP : 0) + FIG_PAD, roomH = low - (bottom.length ? GAP - 10 : 0) - roomTop - FIG_PAD;
        return { top, bottom, figure: null, noRoom: roomH < 48, columns: planColumns(columns, roomTop, roomH, w, scale, maxScale(fit)), room: { w: width, h: roomH } };
    }
    if (figure) {
        // FIG_PAD on each side: a figure's ink may reach a few px past its laid-out size (a shadow, a label's overhang)
        const roomTop = y + (s.title || s.lead ? GAP : 0) + FIG_PAD, roomH = low - (bottom.length ? GAP - 10 : 0) - roomTop - FIG_PAD;
        const k = Math.min(width / figure.w, roomH / figure.h, maxScale(fit));
        if (!(k > 0) || roomH < 48)
            noRoom = true;
        else {
            const fw = figure.w * k, fh = figure.h * k;
            place = { x: MARGIN_X + (width - fw) / 2, y: roomTop + (roomH - fh) / 2, w: fw, h: fh, k };
        }
    }
    else if (y > low + 10)
        noRoom = true;
    const roomTop = y + (s.title || s.lead ? GAP : 0) + FIG_PAD, roomH = low - (bottom.length ? GAP - 10 : 0) - roomTop - FIG_PAD;
    return { top, bottom, figure: place, noRoom, columns: [], room: { w: width, h: roomH } };
}
/** The source line at the bottom, pushed to `bottom`; the y above it that the rest of the slide may reach. */
function sourceBlock(s, w, bottom) {
    const width = SLIDE_W - 2 * MARGIN_X;
    let low = SLIDE_H - BOTTOM;
    if (s.source) {
        const st = STYLE.source, lines = wrapped(s.source, st.size, width, w, false), h = lines.length * Math.round(st.size * LINE);
        low -= h;
        bottom.push([textBlock('source', MARGIN_X, low, width, st.size, lines.map(t => [{ text: t, bold: false, color: st.color }]))]);
        low -= 10;
    }
    return low;
}
/**
 * A cover (ADR 0066 D4): the event, the title, the lead (the subtitle), a short rule, the date and the presenter, each centred, stacked and
 * set in the middle of the room above the source. `gap` is the room under each to the next one there is. The title is 56 px, else 48
 * (each when it takes two lines at most and the whole fits), else 40 (D5).
 */
export const COVER = {
    width: 1040,
    event: { size: 22, bold: true, color: '1F5FA8', gap: 16 },
    title: { sizes: [56, 48, 40], line: 1.2, bold: true, color: '1F2328', gap: 20 },
    lead: { size: 26, bold: false, color: '5B6370', gap: 36 },
    rule: { w: 80, h: 3, fill: '1F5FA8', gap: 28 },
    date: { size: 20, bold: false, color: '3A4A5A', gap: 8 },
    presenter: { size: 24, bold: true, color: '1F2328', gap: 0 },
};
function planCover(s, w) {
    const bottom = [], low = sourceBlock(s, w, bottom), x = (SLIDE_W - COVER.width) / 2, room = low - TOP;
    const text = (name, value, st, pitch = Math.round(st.size * LINE)) => {
        if (!value)
            return [];
        const lines = wrapped(value, st.size, COVER.width, w, st.bold);
        return [{ name, h: lines.length * pitch, gap: st.gap, text: { lines, size: st.size, pitch, bold: st.bold, color: st.color } }];
    };
    const stack = (size) => [
        ...text('event', s.event, COVER.event),
        ...text('title', s.title, { ...COVER.title, size }, Math.round(size * COVER.title.line)),
        ...text('lead', s.lead, COVER.lead),
        ...(s.date || s.presenter ? [{ name: 'rule', h: COVER.rule.h, gap: COVER.rule.gap, rule: true }] : []),
        ...text('date', s.date, COVER.date),
        ...text('presenter', s.presenter, COVER.presenter),
    ];
    const height = (items) => items.reduce((n, it, k) => n + it.h + (k < items.length - 1 ? it.gap : 0), 0);
    const sizes = COVER.title.sizes, last = sizes[sizes.length - 1] ?? 40;
    let items = stack(last);
    for (const size of sizes) {
        const tried = stack(size), title = tried.find(it => it.name === 'title');
        if (size === last || ((title?.text?.lines.length ?? 0) <= 2 && height(tried) <= room)) {
            items = tried;
            break;
        }
    }
    const h = height(items);
    // a run with no place to break (a URL, a long name) stays one line: wider than the column, it would leave the slide (wrap="none" on the .pptx)
    const tooWide = items.some(it => it.text?.lines.some(l => w(l, it.text?.size ?? 0, it.text?.bold ?? false) > COVER.width + 0.5));
    let y = TOP + Math.max(0, (room - h) / 2);
    const top = items.map(it => {
        const at = y;
        y += it.h + it.gap;
        if (it.rule || !it.text)
            return { kind: 'rect', name: 'cover rule', x: (SLIDE_W - COVER.rule.w) / 2, y: at, w: COVER.rule.w, h: COVER.rule.h, fill: COVER.rule.fill };
        const t = it.text;
        return { ...textBlock(it.name, x, at, COVER.width, t.size, t.lines.map(l => [{ text: l, bold: t.bold, color: t.color }])), pitch: t.pitch, align: 'center' };
    });
    return { top, bottom, figure: null, noRoom: h > room || tooWide, columns: [], room: { w: SLIDE_W - 2 * MARGIN_X, h: Math.max(0, room - h) } };
}
/** Each column's width in px: the row (the slide less its margins and the gaps) shared by the columns' `width`. */
export function columnWidths(columns) {
    const shares = columns.map(c => c.width ?? 1), total = shares.reduce((a, b) => a + b, 0);
    const inner = SLIDE_W - 2 * MARGIN_X - COLUMN_GAP * (columns.length - 1);
    return shares.map(share => inner * share / total);
}
/** The scale a column figure laid out at its column's width is drawn at: 14 px text comes out at 9 pt (ADR 0059). */
export const COLUMN_FIGURE_SCALE = 0.86;
/** The width a spec figure with no `width` of its own is laid out at in a column `px` wide (ADR 0059), within the spec's range. */
export const columnLayoutWidth = (px, range) => Math.max(range.min, Math.min(range.max, Math.round(px / COLUMN_FIGURE_SCALE)));
/** The columns side by side in the room (top, height) the slide's text leaves. */
function planColumns(columns, top, height, w, scale, cap) {
    const widths = columnWidths(columns);
    let x = MARGIN_X;
    const cols = columns.map((c, j) => {
        const width = widths[j] ?? 0, at = x;
        x += width + COLUMN_GAP;
        const lines = c.caption ? wrapped(c.caption, CAPTION.size, width, w, CAPTION.bold) : [];
        return { c, x: at, width, caption: lines.length ? textBlock('column caption', at, top, width, CAPTION.size, lines.map(t => [{ text: t, bold: true, color: CAPTION.color }])) : null };
    });
    // the contents start on one line across the columns (under the tallest caption), so a figure is compared with its neighbour from the top
    const captionH = Math.max(0, ...cols.map(k => k.caption ? k.caption.lines.length * k.caption.pitch + 6 : 0));
    const contentTop = top + captionH, contentH = height - captionH;
    const fits = cols.map(k => k.c.figure ? Math.min(k.width / k.c.figure.w, contentH / k.c.figure.h, cap) : 0);
    const common = Math.min(...fits.filter((_, j) => cols[j]?.c.figure));
    return cols.map((k, j) => {
        if (k.c.figure) {
            const kk = scale === 'same' ? common : fits[j] ?? 0;
            if (!(kk > 0) || contentH < 48)
                return { x: k.x, width: k.width, caption: k.caption, figure: null, text: [], noRoom: true, box: { w: k.width, h: contentH } };
            const fw = k.c.figure.w * kk, fh = k.c.figure.h * kk;
            return { x: k.x, width: k.width, caption: k.caption, figure: { x: k.x + (k.width - fw) / 2, y: contentTop, w: fw, h: fh, k: kk }, text: [], noRoom: false, box: { w: k.width, h: contentH } };
        }
        // text: a paragraph a line of the input; a bullet's following lines hang under its text, not under the bullet
        const st = STYLE.lead, pitch = Math.round(st.size * LINE), blocks = [];
        let yy = contentTop;
        for (const para of (k.c.text ?? '').split(/\r\n|\r|\n/)) {
            if (!para.trim()) {
                yy += Math.round(pitch / 2);
                continue;
            }
            const bullet = BULLET.exec(para), body = bullet ? para.slice(bullet[0].length).trimStart() : para;
            const indent = bullet ? w('・', st.size, false) : 0;
            const lines = wrapped(body, st.size, k.width - indent, w, false);
            if (bullet)
                blocks.push(textBlock('column bullet', k.x, yy, indent, st.size, [[{ text: '・', bold: false, color: '1F2328' }]]));
            blocks.push(textBlock('column text', k.x + indent, yy, k.width - indent, st.size, lines.map(t => [{ text: t, bold: false, color: '1F2328' }])));
            yy += lines.length * pitch + 4;
        }
        return { x: k.x, width: k.width, caption: k.caption, figure: null, text: blocks, noRoom: yy - 4 > contentTop + contentH, box: { w: k.width, h: contentH } };
    });
}
/** Every text of the slide that is measured, at its size and weight: for a shell that measures in a batch first. */
export function deckTexts(s) {
    if (s.layout === 'cover') {
        const C = COVER, at = (t, st) => t ? [{ text: t, size: st.size, bold: st.bold }] : [];
        return [
            ...at(s.event, C.event),
            ...(s.title ? C.title.sizes.map(size => ({ text: s.title, size, bold: C.title.bold })) : []),
            ...at(s.lead, C.lead), ...at(s.date, C.date), ...at(s.presenter, C.presenter),
            ...(s.source ? [{ text: s.source, size: STYLE.source.size, bold: false }] : []),
        ];
    }
    return [
        ...(s.columns ?? []).flatMap(c => [
            ...(c.caption ? [{ text: c.caption, size: CAPTION.size, bold: CAPTION.bold }] : []),
            ...(c.text ? [{ text: c.text.replace(/\r\n|\r|\n/g, ' '), size: STYLE.lead.size, bold: false }, { text: '・', size: STYLE.lead.size, bold: false }] : []),
        ]),
        ...(s.title ? [{ text: s.title, size: STYLE.title.size, bold: STYLE.title.bold }] : []),
        ...(s.lead ? [{ text: s.lead, size: STYLE.lead.size, bold: false }] : []),
        ...(s.source ? [{ text: s.source, size: STYLE.source.size, bold: false }] : []),
        ...(s.callouts ?? []).map(c => ({ text: (c.label ?? '') + c.text, size: STYLE.callout.size, bold: true })),
    ];
}
/** Why a slide could not be made, for a slide with or without a figure, or a cover (ADR 0066). */
export const roomMessage = (hasFigure, cover = false) => cover
    ? 'the cover\'s text does not fit the slide (too many lines, or a line too long to break): shorten the title, lead, event, presenter or source'
    : hasFigure
        ? 'the heading, lead, callouts and source leave no room for the figure: shorten them, or put the figure on a slide of its own'
        : 'the heading and lead run into the callouts and source: shorten them, or split the slide';
/** A warning for a slide whose figure's smallest text is under MIN_TEXT_PT, or null. */
export function smallTextWarning(p) {
    if (p.minTextPt === null || p.scale === null || p.minTextPt >= MIN_TEXT_PT)
        return null;
    const how = p.scale < 1 ? `scaled to ${Math.round(p.scale * 100)}% to fit the slide, its` : 'its';
    return `${how} smallest text is ${p.minTextPt.toFixed(1)}pt (under ${MIN_TEXT_PT}pt): split the figure, or move text off the slide`;
}
/** The layout widths 'fill' tries (ADR 0060): the document's 940 and narrower, each about 12 % less, down to the spec's 320. */
export const FILL_WIDTHS = [827, 728, 640, 563, 496, 436, 384, 338];
/** The rule ids of a verdict's findings (`[rule-id] …`). */
export const ruleIds = (findings) => [...new Set(findings.map(f => /\[([a-z0-9-]+)\]/.exec(f)?.[1] ?? f))];
/**
 * The layout width that draws a figure largest in `box` (ADR 0060): the figure as it is first, then narrower widths while it is the width
 * that holds it back (a narrower figure is taller, so once the height holds it back, narrower only makes it smaller). A width that cannot be
 * laid out ends the search, and so does one that raises a check the figure as it is does not (a narrower box breaking a word in the middle,
 * text crowding: a larger figure that reads worse is not wanted). The scale is min(box width / figure width, box height / figure height, cap);
 * a narrower width is taken only when it draws the figure at least 1 % larger.
 */
export async function fillSearch(box, cap, draw) {
    const scale = (d) => Math.min(box.w / d.w, box.h / d.h, cap);
    const heightBound = (d) => box.h / d.h <= box.w / d.w;
    const first = await draw(null);
    if (!first.ok)
        return first;
    let best = { ok: true, value: first.value, width: null, k: scale(first), tried: 1, narrower: null };
    if (heightBound(first) || best.k >= cap)
        return best;
    for (const width of FILL_WIDTHS) {
        if (width >= first.w)
            continue;
        const d = await draw(width);
        best.tried++;
        if (!d.ok) {
            best.narrower = { width, why: d.why };
            break;
        }
        if (d.flags.some(f => !first.flags.includes(f)))
            break;
        const k = scale(d);
        if (k > best.k * 1.01)
            best = { ...best, value: d.value, width, k };
        if (heightBound(d) || k >= cap)
            break;
    }
    return best;
}
/** The room each figure of a slide is fitted into (ADR 0060): the slide's figure's, and each figure column's (null for a text column). */
export function figureRooms(s, w) {
    const cols = s.columns?.map(c => ({ caption: c.caption, text: c.text === undefined ? undefined : '', width: c.width, figure: c.text === undefined ? { w: 1, h: 1 } : undefined }));
    const l = planDeckLayout(s, cols ? undefined : { w: 1, h: 1 }, w, cols);
    return { figure: l.room, columns: l.columns.map((c, j) => s.columns?.[j]?.text === undefined ? c.box : null) };
}
/** The shares tried for columns left to choice (ADR 0061). */
export const COLUMN_SHARES = {
    2: [[1, 3], [1, 2], [2, 3], [1, 1], [3, 2], [2, 1], [3, 1]],
    3: [[1, 1, 1], [2, 1, 1], [1, 2, 1], [1, 1, 2], [2, 2, 1], [2, 1, 2], [1, 2, 2]],
};
/** The least a figure column's smallest text may come to for its shares to be chosen on the empty room (ADR 0055 D4). */
export const CHOOSE_MIN_PT = 9;
/**
 * The shares for a slide's columns (ADR 0061): each candidate of COLUMN_SHARES is laid out (captions, texts), each figure column fitted by
 * fillSearch, and the one that leaves the least empty room with every figure's smallest text at CHOOSE_MIN_PT or more is taken; when none
 * reaches it, the one whose smallest text is largest. A candidate whose text does not fit its column, or whose figure cannot be laid out,
 * is left out. `draw(j, width)` lays out column j's figure (memoised here: the same width is drawn once).
 */
export async function chooseColumns(s, w, cap, draw) {
    const n = s.columns.length, candidates = COLUMN_SHARES[n] ?? [Array.from({ length: n }, () => 1)];
    const memo = new Map();
    const drawn = (j, width) => { const key = `${j}:${width}`; let p = memo.get(key); if (!p) {
        p = draw(j, width);
        memo.set(key, p);
    } return p; };
    let best = null, lastWhy = '';
    for (const shares of candidates) {
        const cols = s.columns.map((c, j) => ({ caption: c.caption, text: c.text, width: shares[j] ?? 1, figure: c.text === undefined ? { w: 1, h: 1 } : undefined }));
        const layout = planDeckLayout(s, undefined, w, cols);
        if (layout.noRoom || layout.columns.some((c, j) => s.columns[j]?.text !== undefined && c.noRoom))
            continue;
        const figures = [];
        let used = 0, minPt = null, failed = false;
        for (const [j, c] of s.columns.entries()) {
            const place = layout.columns[j];
            if (!place) {
                failed = true;
                break;
            }
            if (c.text !== undefined) {
                figures.push(null);
                const last = place.text[place.text.length - 1];
                used += place.width * (last ? last.y + last.lines.length * last.pitch - (place.text[0]?.y ?? 0) : 0);
                continue;
            }
            let pt;
            const fit = await fillSearch(place.box, cap, async (width) => { const d = await drawn(j, width); if (d.ok)
                pt = d.minPt; return d; });
            if (!fit.ok) {
                failed = true;
                lastWhy = fit.why;
                break;
            }
            // the minPt of the width chosen: drawn again from the memo
            const chosen = await drawn(j, fit.width);
            pt = chosen.ok ? chosen.minPt : pt;
            figures.push(fit);
            const d = chosen.ok ? chosen : null;
            if (d)
                used += d.w * fit.k * d.h * fit.k;
            if (pt !== null && pt !== undefined)
                minPt = Math.min(minPt ?? Infinity, pt * fit.k);
        }
        if (failed)
            continue;
        const empty = layout.room.w * layout.room.h - used;
        const cand = { ok: true, shares: [...shares], figures, empty, minPt, tried: 0, small: false };
        const ok = (c) => c.minPt === null || c.minPt >= CHOOSE_MIN_PT - 1e-9;
        if (!best)
            best = cand;
        else if (ok(cand) && !ok(best))
            best = cand;
        else if (ok(cand) === ok(best)) {
            if (ok(cand) ? cand.empty < best.empty - 1 : (cand.minPt ?? 0) > (best.minPt ?? 0))
                best = cand;
        }
    }
    if (!best)
        return { ok: false, why: lastWhy || 'no shares of the columns fit their text and figures' };
    return { ...best, tried: candidates.length, small: !(best.minPt === null || best.minPt >= CHOOSE_MIN_PT - 1e-9) };
}

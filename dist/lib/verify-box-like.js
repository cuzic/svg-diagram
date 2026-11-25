import { at } from './finding-rules.js';
import { resolveBoxStyle, resolveTextColor } from './emit-common.js';
import { luminance as lightLuminance, paintOf, PALETTE, runColorOf } from './tokens.js';
import { CONTRAST_THRESHOLD, labelOf } from './verify-base.js';
export function nowrapProblems(b) {
    return (b.nowrapOverflow ?? []).map(o => `stat: value "${o.value}" does not fit its box even at the smallest size (${o.min}px: needs ${Math.ceil(o.width)}px, the box has ${Math.floor(o.avail)}px).\n  fix: widen the box (span / flex / width), shorten the value, or put the unit in the label.`);
}
export function boxLikeContrastProblems(band, boxTone, theme, tones, appearance) {
    const problems = [];
    const paint = paintOf(tones, appearance);
    const luminance = (hex) => lightLuminance(paint(hex));
    const boxFill = band.dim ? PALETTE.bg : boxTone ? resolveBoxStyle(tones, boxTone, theme).fill : PALETTE.bg;
    for (const run of band.wrappedRuns ?? []) {
        const fg = band.dim ? PALETTE.muted : runColorOf(tones, run.tone, boxTone ?? undefined, theme); // dim first: a dimmed solid box is white
        const delta = Math.abs(luminance(fg) - luminance(boxFill));
        if (delta < CONTRAST_THRESHOLD) {
            problems.push(`"${run.text.slice(0, 20)}" (${fg} on ${boxFill}, in "${labelOf(band)}") has low contrast (delta=${delta.toFixed(0)}, want >= ${CONTRAST_THRESHOLD})`);
        }
        // a coloured piece of the run is its own text colour on the same fill (a dimmed box paints every piece muted: the run's check covers it)
        if (!band.dim)
            for (const sp of run.spans ?? []) {
                if (!sp.tone)
                    continue;
                const spanFg = resolveTextColor(tones, sp.tone, theme), spanDelta = Math.abs(luminance(spanFg) - luminance(boxFill));
                if (spanDelta < CONTRAST_THRESHOLD)
                    problems.push(`"${sp.text.slice(0, 20)}" (${spanFg} on ${boxFill}, in "${labelOf(band)}") has low contrast (delta=${spanDelta.toFixed(0)}, want >= ${CONTRAST_THRESHOLD})`);
            }
    }
    return problems;
}
/** box-size-ignored: box({size}) is read by neither layout nor emit (said once per figure; the band keeps what the author wrote). */
export function boxSizeFindings(bands) {
    const hit = bands.filter(b => b.type === 'box' && b.size !== undefined);
    return hit.length ? [{ ...at(hit[0], ...hit.slice(1)), rule: 'box-size-ignored', severity: 'warn', message: `box({size}) は効果がない(${hit.length} 個の箱)。大きい文字は役割を使う: stat() / stat({size: 'display'})・caption({role: 'display'})・banner({headlineRole})・bars / plane({labelRole})。次の版で throw する` }] : [];
}
/** stat-fit-shrunk (ADR 0024 D5): a stat() value drawn smaller than its role's size to fit its box. Info: shrinking is the specified behaviour. */
export function statFitFindings(d) {
    const out = [];
    const boxes = [];
    for (const b of d.laidOut ?? []) {
        if (b.type === 'row' || b.type === 'grid')
            boxes.push(...b.children);
        else
            boxes.push(b);
    }
    for (const b of boxes)
        if (b.type === 'box')
            for (const s of b.statShrunk ?? []) {
                out.push({ ...at(b), rule: 'stat-fit-shrunk', severity: 'info', message: `stat の値 "${s.value}" を ${s.from}px から ${s.to}px に縮めた(箱の幅 ${Math.round(b.w)}px に収めるため)。同じ列の stat と大きさがそろわない。箱を広げるか、値を短くすると、そろう` });
            }
    return out;
}
export const boxLikeRules = /* @__PURE__ */ Object.freeze({
    'box-size-ignored': { doc: 'box({size}) は効果がない(レイアウトも描画も読まない)。大きい文字は役割で書く: stat() / stat({size: "display"})・caption({role: "display"})・banner({headlineRole})・bars / plane({labelRole})。次の版で throw する', scope: 'band-grouped' },
    'stat-fit-shrunk': { doc: 'stat() の値が箱の幅に収まらないので、自動で小さい文字にした(隣の stat と大きさがそろわない。箱を広げるか、値を短くするとそろう)', scope: 'band' },
});

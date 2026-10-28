import { must } from './must.js';
import { splitByHeight, splitWidest } from './fit-split.js';
/** What an attempt has to give back: the part of layeredAttempt's result that fitWidth reads. */
/** The layers a result's layout folded (a result with a `lay`), if any. */
const foldedOf = (r) => r.lay?.folded ?? [];
/** Half a pixel of slack, as the layouts themselves allow (`maxAcross: w + 0.5`). */
const SLACK = 0.5;
const lexLess = (a, b) => a.crossings < b.crossings || (a.crossings === b.crossings && a.bends < b.bends);
/**
 * Runs the attempts in order. `first` stops at the first that fits `w` (the rest are not run); `best` runs them all and keeps the best of
 * those that fit `w` and the height budget. Every attempt that ran is in `tried`, with its width and height, whether or not it was chosen.
 */
export function fitWidth(w, attempts, opts) {
    const widthOf = opts.widthOf ?? ((r) => r.size.w);
    const tried = [], results = [];
    let best;
    for (const [index, a] of attempts.entries()) {
        const result = a.run();
        results.push(result);
        const width = widthOf(result);
        tried.push({ label: a.label, w: Math.ceil(width), h: Math.ceil(result.size.h), fitsWidth: width <= w + SLACK });
        if (width > w + SLACK)
            continue;
        if (opts.heightBudget !== undefined && result.size.h > opts.heightBudget + SLACK)
            continue;
        if (opts.mode === 'first')
            return { ok: true, result, index, applied: a.applied ?? [], tried };
        if (!best || lexLess(result.score, best.result.score))
            best = { result, index };
    }
    if (!best)
        return { ok: false, tried, results };
    return { ok: true, result: best.result, index: best.index, applied: must(attempts[best.index]).applied ?? [], tried };
}
/**
 * The message for a figure no attempt fitted: what was tried with its width, what was not tried and why, and one fix.
 *   causeTree(): the figure does not fit 900px.
 *     tried: dir 'up' (as written) 1460px; dir 'right' 1180px
 *     not tried: dir 'right' (dir is explicit; write dir: 'auto' to let it change)
 *     fix: dir: 'auto', or widen the figure (diagram({width: 1100}))
 */
export function fitFailure(who, w, tried, fix, notTried = [], heightBudget, split) {
    // a figure that fits the width but is too tall is a height failure: say so (ADR 0019 D2)
    const tooTall = heightBudget !== undefined && tried.some(t => t.fitsWidth ?? t.w <= w + 0.5);
    const lines = [tooTall ? `${who}: the figure does not fit ${Math.round(w)}px wide by ${Math.round(heightBudget)}px tall (every attempt that fits the width is too tall).` : `${who}: the figure does not fit ${Math.round(w)}px.`];
    if (tried.length)
        lines.push(`  tried: ${tried.map(t => `${t.label} ${t.w}px wide, ${t.h}px tall`).join('; ')}`);
    if (notTried.length)
        lines.push(`  not tried: ${notTried.join('; ')}`);
    lines.push(`  fix: ${fix}`);
    if (split)
        lines.push(`  split: ${split}`);
    return lines.join('\n');
}
/** A width to suggest in a fix: the narrowest tried figure, rounded up to the next 20px and plus the margins the caller gives. */
export function widerThan(tried, margins = 0) {
    const least = Math.min(...tried.map(t => t.w));
    return Math.ceil((least + margins) / 20) * 20;
}
/** One phrase for the `auto-fit-applied` rule: what changed and what it did to the width. */
export function describeApplied(a) {
    const was = a.wasW === undefined ? '' : `(${a.wasW}→${a.nowW ?? '?'}px)`;
    if (a.what === 'fold')
        return `層 ${a.to} を折り返した${was}`;
    if (a.what === 'maxNodeW')
        return `maxNodeW を ${a.from}→${a.to} に${Number(a.to) < Number(a.from) ? '縮めた' : '広げた'}${was}`;
    return `dir を ${a.from} から ${a.to} に変えた${was}`;
}
/** What an attempt changed, with the widths filled in: the figure as first tried (`tried[0]`) against the one chosen. */
export function withWidths(applied, tried, index) {
    return applied.map(a => ({ ...a, wasW: must(tried[0]).w, nowW: must(tried[index]).w }));
}
/** The widths a node may grow to, widest first, when a figure has to be narrowed to fit (ADR 0010 D1). Below the last the text breaks into one or two characters a line. */
export const NARROWING = [200, 160, 130, 110];
const WIDEST = must(NARROWING[0]);
/** `maxNodeW: 'auto'` (ADR 0019 D2): widest first, 10px apart. The first that fits the width and the height budget is kept: fewer lines in a node, a shorter figure. */
export const AUTO_GRID = Array.from({ length: 17 }, (_, i) => 260 - i * 10);
/** The widths a folded figure is cut to, as shares of its width (the first that fits is kept): the settling of the rows between their neighbours can push it wider than one row. */
const FOLD_SHARES = [1, 0.85, 0.7, 0.55];
/**
 * Lays a figure out in the ways ADR 0010 D1 allows and returns the first (or best) that fits `w`, with what was changed to get there.
 * Throws, with what was tried and one fix, when none fits. A figure that fits as written is attempt 0 and changes nothing.
 */
export function fitLayout(plan) {
    const narrow = plan.narrow !== false;
    const alt = plan.alt !== plan.start ? plan.alt : undefined;
    const free = !plan.explicitDir;
    const dirs = free && alt !== undefined ? [plan.start, alt] : [plan.start];
    const widths = plan.autoWidth ? AUTO_GRID : narrow && free && plan.maxNodeW === undefined ? NARROWING : [plan.maxNodeW ?? WIDEST];
    const widthMode = plan.autoWidth ? 'auto' : plan.mode, from0 = plan.autoWidth ? WIDEST : must(widths[0]); // what the figure would have had: the default node width
    // keepWords (ADR 0029 D3): every attempt is tried with the floor (no katakana word broken) first; only when none fits, without it. The order keeps what a figure
    // looked like without the option: narrower with the floor, narrower without, then folded with, folded without (a fold is the last resort in both).
    const floors = plan.keepWords ? [true, false] : [false];
    const suffix = (floor) => plan.keepWords && !floor ? ', words may break' : '';
    const narrowing = (floor) => {
        const list = [];
        for (const mw of widths)
            for (const d of dirs) {
                const applied = [];
                if (d !== plan.start)
                    applied.push({ what: 'dir', from: plan.start, to: d, mode: plan.mode });
                if (mw !== from0)
                    applied.push({ what: 'maxNodeW', from: from0, to: mw, mode: widthMode });
                const note = list.length || plan.autoWidth ? '' : plan.explicitDir || plan.maxNodeW !== undefined ? ' (as written)' : ' (default)';
                list.push({ label: `${plan.noDir ? '' : `dir '${d}'`}${narrow ? `${plan.noDir ? '' : ', '}maxNodeW ${mw}` : ''}${note}${suffix(floor)}`, run: () => plan.build(d, mw, floor), applied });
            }
        return list;
    };
    // Folding (ADR 0010 D7), the last attempt: a layer wider than the figure is cut into rows, at the narrowest node width, the axis kept. `fold: true` also when `dir` is written.
    const canFold = plan.foldable === true && plan.fold !== false;
    const folding = (floor) => {
        const list = [];
        if (canFold && (plan.fold === true || free || plan.autoWidth)) {
            const mw = must(widths[widths.length - 1]), d = plan.start;
            for (const share of FOLD_SHARES) {
                const applied = [];
                if (mw !== from0)
                    applied.push({ what: 'maxNodeW', from: from0, to: mw, mode: widthMode });
                list.push({ label: `dir '${d}', maxNodeW ${mw}, fold${share < 1 ? ` ${Math.round(share * 100)}%` : ''}${suffix(floor)}`, applied, run: () => {
                        const r = plan.build(d, mw, floor, plan.w * share + 0.5);
                        for (const f of foldedOf(r))
                            applied.push({ what: 'fold', from: f.rows, to: f.layer + 1, mode: plan.autoWidth ? 'auto' : plan.explicitDir ? 'written' : plan.mode });
                        return r;
                    } });
            }
        }
        return list;
    };
    // without the option there is one stage (as before); with it, four, each only when the one before found nothing that fits
    const stages = floors.length === 1 ? [[...narrowing(false), ...folding(false)]] : [narrowing(true), narrowing(false), folding(true), folding(false)];
    const fitOpts = { mode: plan.best ? 'best' : 'first', ...(plan.heightBudget === undefined ? {} : { heightBudget: plan.heightBudget }), ...(plan.widthOf ? { widthOf: plan.widthOf } : {}) };
    const allTried = [], allResults = [];
    for (const stage of stages.filter(s => s.length)) {
        const got = fitWidth(plan.w, stage, fitOpts);
        if (got.ok)
            return { result: got.result, applied: withWidths(got.applied, [...allTried, ...got.tried], allTried.length + got.index) };
        allTried.push(...got.tried);
        allResults.push(...got.results);
    }
    const fitted = { ok: false, tried: allTried, results: allResults };
    const notTried = [];
    if (plan.explicitDir)
        notTried.push(`${alt !== undefined ? `dir '${alt}'${narrow ? ' and ' : ''}` : ''}${narrow ? 'narrower nodes' : ''} (dir is explicit; write dir: 'auto' to let ${alt !== undefined || narrow ? 'them' : 'it'} change)`);
    else if (narrow && !plan.autoWidth && plan.maxNodeW !== undefined)
        notTried.push(`narrower nodes (maxNodeW is explicit: ${plan.maxNodeW})`);
    if (!plan.explicitDir && alt === undefined && plan.axisKept)
        notTried.push(plan.axisKept);
    if (plan.foldable && plan.fold === false)
        notTried.push('folding a layer into rows (fold is written: false)');
    notTried.push(...(plan.notTried ?? []));
    const tooTall = plan.heightBudget !== undefined && fitted.tried.some(t => t.fitsWidth ?? t.w <= plan.w + 0.5);
    const wider = widerThan(fitted.tried, 40);
    const fix = tooTall ? 'split the figure in two (fewer entities or fewer layers), or give the canvas more height' : plan.explicitDir ? `dir: 'auto', ${canFold && plan.fold === undefined ? 'or fold: true (a layer wider than the figure is cut into rows, the direction stays), ' : ''}or widen the figure (diagram({width: ${wider}}))` : plan.fix ?? (wider > 1400 ? 'split the figure in two (fewer entities on one level)' : `widen the figure (diagram({width: ${wider}}))`);
    // where to split (ADR 0019 D3): a height failure by the first attempt that fits the width, a width failure by the narrowest one that did not fold
    let split;
    if (plan.layoutOf) {
        const results = fitted.results, lays = results.map(plan.layoutOf);
        if (tooTall) {
            const i = fitted.tried.findIndex(t => t.w <= plan.w + 0.5);
            const at = must(lays[i]);
            if (at.vertical && plan.heightBudget !== undefined)
                split = splitByHeight(at.lay, plan.heightBudget);
        }
        else {
            const unfolded = results.map((r, i) => ({ r, i })).filter(({ i }) => !must(fitted.tried[i]).label.includes('fold'));
            const narrowest = unfolded.sort((a, b) => must(fitted.tried[a.i]).w - must(fitted.tried[b.i]).w)[0];
            if (narrowest)
                split = splitWidest(must(lays[narrowest.i]).lay);
        }
    }
    throw new Error(fitFailure(plan.who, plan.w, fitted.tried, fix, notTried, plan.heightBudget, split));
}
